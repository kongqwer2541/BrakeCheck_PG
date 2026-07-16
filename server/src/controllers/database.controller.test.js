import assert from 'node:assert/strict';
import test from 'node:test';

process.env.SESSION_SECRET = 'brakecheck-test-session-secret-32-characters';

const controllerModule = await import('./database.controller.js');

function createResponseRecorder() {
  return {
    statusCode: null,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

test('database health returns 200 when PostgreSQL connects before schema exists', async () => {
  assert.equal(typeof controllerModule.createDatabaseHealthHandler, 'function');

  const health = {
    ok: true,
    schemaReady: false,
    engine: 'postgresql',
    missingTables: ['users']
  };
  const handler = controllerModule.createDatabaseHealthHandler(async () => health);
  const response = createResponseRecorder();
  let forwardedError;

  await handler({}, response, (error) => {
    forwardedError = error;
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, health);
  assert.equal(forwardedError, undefined);
});

test('database health marks connection errors as unavailable', async () => {
  assert.equal(typeof controllerModule.createDatabaseHealthHandler, 'function');

  const connectionError = new Error('connect ECONNREFUSED');
  const handler = controllerModule.createDatabaseHealthHandler(async () => {
    throw connectionError;
  });
  const response = createResponseRecorder();
  let forwardedError;

  await handler({}, response, (error) => {
    forwardedError = error;
  });

  assert.equal(response.statusCode, null);
  assert.equal(response.body, null);
  assert.equal(forwardedError, connectionError);
  assert.equal(forwardedError.statusCode, 503);
});
