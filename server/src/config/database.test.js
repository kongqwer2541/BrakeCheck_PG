import assert from 'node:assert/strict';
import test from 'node:test';

async function loadDatabaseConfig() {
  process.env.SESSION_SECRET = 'test_session_secret_at_least_32_chars';
  return import('./database.js');
}

test('PostgreSQL pool handles idle client errors without exposing details', async () => {
  const { postgresDb } = await loadDatabaseConfig();
  const loggedMessages = [];
  const originalConsoleError = console.error;

  console.error = (...args) => loggedMessages.push(args.join(' '));

  try {
    assert.ok(postgresDb.listenerCount('error') > 0);
    assert.doesNotThrow(() => {
      postgresDb.emit('error', new Error('password=secret database=private'));
    });

    const output = loggedMessages.join('\n');
    assert.match(output, /PostgreSQL pool/i);
    assert.doesNotMatch(output, /password=secret|database=private/i);
  } finally {
    console.error = originalConsoleError;
    await postgresDb.end();
  }
});
