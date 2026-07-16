import assert from 'node:assert/strict';
import http from 'node:http';
import { describe, test } from 'node:test';

import express from 'express';
import { errorMiddleware } from '../middlewares/error.middleware.js';

process.env.SESSION_SECRET = 'brakecheck-test-session-secret-32-characters';
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '1';
process.env.DB_NAME = 'brakecheck_test';
process.env.DB_USER = 'brakecheck_test';

function requestJson(server, path) {
  const { port } = server.address();

  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method: 'GET'
    }, (response) => {
      let body = '';

      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        resolve({
          statusCode: response.statusCode,
          body: body ? JSON.parse(body) : null
        });
      });
    });

    request.on('error', reject);
    request.end();
  });
}

function getHealthRouteHandlers(databaseRouter) {
  const healthLayer = databaseRouter.stack.find((layer) => (
    layer.route?.path === '/health' && layer.route?.methods?.get
  ));

  assert.ok(healthLayer, 'database health route should exist');
  return healthLayer.route.stack.map((layer) => layer.handle);
}

describe('database routes', () => {
  test('requires login before database health details are checked', async () => {
    const { databaseRouter } = await import('./database.routes.js');
    const app = express();
    app.use('/api/database', databaseRouter);
    app.use(errorMiddleware);
    const server = http.createServer(app);

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

    try {
      const response = await requestJson(server, '/api/database/health');

      assert.equal(response.statusCode, 401);
      assert.equal(response.body.ok, false);
      assert.match(response.body.message, /เข้าสู่ระบบ/);
      assert.equal(response.body.database, undefined);
      assert.equal(response.body.databaseVersion, undefined);
      assert.equal(response.body.engine, undefined);
      assert.equal(response.body.schemaReady, undefined);
      assert.equal(response.body.requiredTables, undefined);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('limits database health details to head and assistant roles', async () => {
    const { databaseRouter } = await import('./database.routes.js');
    const handlers = getHealthRouteHandlers(databaseRouter);

    assert.equal(handlers.length, 3);

    const roleGuard = handlers[1];
    let blockedError;
    roleGuard({ user: { role: 'officer' } }, {}, (error) => {
      blockedError = error;
    });

    assert.equal(blockedError?.statusCode, 403);
    assert.match(blockedError?.message, /สิทธิ์ไม่เพียงพอ/);

    for (const role of ['head', 'assistant']) {
      let nextCalled = false;
      let allowedError;

      roleGuard({ user: { role } }, {}, (error) => {
        nextCalled = true;
        allowedError = error;
      });

      assert.equal(nextCalled, true);
      assert.equal(allowedError, undefined);
    }
  });
});
