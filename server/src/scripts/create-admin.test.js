import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, test } from 'node:test';

describe('create-admin script', () => {
  test('stops before database access when ADMIN_PASSWORD is missing', () => {
    const result = spawnSync(process.execPath, ['src/scripts/create-admin.js'], {
      cwd: new URL('../..', import.meta.url),
      encoding: 'utf8',
      env: {
        ...process.env,
        ADMIN_PASSWORD: '',
        SESSION_SECRET: 'brakecheck-test-session-secret-32-characters',
        DB_HOST: '127.0.0.1',
        DB_PORT: '1',
        DB_NAME: 'brakecheck_test',
        DB_USER: 'brakecheck_test'
      }
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /ADMIN_PASSWORD/);
    assert.doesNotMatch(result.stderr, /ECONNREFUSED|Access denied|ER_ACCESS_DENIED_ERROR/);
  });

  test('rejects the old default admin password before database access', () => {
    const result = spawnSync(process.execPath, ['src/scripts/create-admin.js'], {
      cwd: new URL('../..', import.meta.url),
      encoding: 'utf8',
      env: {
        ...process.env,
        ADMIN_PASSWORD: 'Admin1234',
        SESSION_SECRET: 'brakecheck-test-session-secret-32-characters',
        DB_HOST: '127.0.0.1',
        DB_PORT: '1',
        DB_NAME: 'brakecheck_test',
        DB_USER: 'brakecheck_test'
      }
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /old default password/);
    assert.doesNotMatch(result.stderr, /ECONNREFUSED|Access denied|ER_ACCESS_DENIED_ERROR/);
  });
});
