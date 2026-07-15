import assert from 'node:assert/strict';
import http from 'node:http';
import { describe, test } from 'node:test';

import express from 'express';
import { errorMiddleware } from './error.middleware.js';

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

async function withServer(app, callback) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    return await callback(server);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

describe('error middleware', () => {
  test('hides internal server error details from API response', async () => {
    const app = express();

    app.get('/boom', () => {
      throw new Error('ER_ACCESS_DENIED_ERROR: SELECT * FROM users failed at server/src/config/database.js:7');
    });
    app.use(errorMiddleware);

    await withServer(app, async (server) => {
      const response = await requestJson(server, '/boom');

      assert.equal(response.statusCode, 500);
      assert.equal(response.body.ok, false);
      assert.equal(response.body.message, 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง');
      assert.doesNotMatch(response.body.message, /ER_ACCESS_DENIED_ERROR|SELECT|server\/src|database\.js/);
      assert.equal(response.body.details, undefined);
      assert.equal(response.body.stack, undefined);
    });
  });

  test('keeps expected user-facing validation errors readable', async () => {
    const app = express();

    app.get('/bad-request', () => {
      const error = new Error('กรุณากรอก Lot');
      error.statusCode = 400;
      error.details = [{ field: 'lot', message: 'จำเป็นต้องกรอก Lot' }];
      throw error;
    });
    app.use(errorMiddleware);

    await withServer(app, async (server) => {
      const response = await requestJson(server, '/bad-request');

      assert.equal(response.statusCode, 400);
      assert.equal(response.body.ok, false);
      assert.equal(response.body.message, 'กรุณากรอก Lot');
      assert.deepEqual(response.body.details, [{ field: 'lot', message: 'จำเป็นต้องกรอก Lot' }]);
    });
  });
});
