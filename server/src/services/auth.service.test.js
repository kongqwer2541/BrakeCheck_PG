import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import test from 'node:test';

process.env.SESSION_SECRET = 'test_session_secret_at_least_32_chars';

const { postgresDb } = await import('../config/database.js');
const { changePassword, getCurrentUser, login } = await import('./auth.service.js');

function databaseUser(overrides = {}) {
  return {
    id: 7,
    employee_code: '12345678',
    password_hash: 'unused-in-this-test',
    full_name: 'Test User',
    position: 'QC',
    role: 'officer',
    status: 'active',
    must_change_password: false,
    failed_login_count: 0,
    locked_until: null,
    ...overrides
  };
}

test('loads the current user with PostgreSQL parameters', async (t) => {
  const originalQuery = postgresDb.query;
  let executedSql = '';
  let executedParams = [];

  t.after(() => {
    postgresDb.query = originalQuery;
  });

  postgresDb.query = async (sql, params) => {
    executedSql = sql;
    executedParams = params;
    return { rows: [databaseUser()] };
  };

  const result = await getCurrentUser(7);

  assert.equal(result.user.employeeCode, '12345678');
  assert.match(executedSql, /WHERE id = \$1/i);
  assert.deepEqual(executedParams, [7]);
  assert.doesNotMatch(executedSql, /\?/);
});

test('changes a password in one PostgreSQL transaction', async (t) => {
  const originalQuery = postgresDb.query;
  const originalConnect = postgresDb.connect;
  const currentPassword = 'CurrentPass123!';
  const currentHash = await bcrypt.hash(currentPassword, 4);
  const clientCalls = [];
  let released = false;

  t.after(() => {
    postgresDb.query = originalQuery;
    postgresDb.connect = originalConnect;
  });

  postgresDb.query = async () => ({
    rows: [databaseUser({ password_hash: currentHash })]
  });
  postgresDb.connect = async () => ({
    query: async (sql, params = []) => {
      clientCalls.push({ sql, params });
      return { rows: [], rowCount: 1 };
    },
    release: () => {
      released = true;
    }
  });

  await changePassword({
    userId: 7,
    currentPassword,
    newPassword: 'NewPass456!'
  });

  assert.match(clientCalls[0].sql, /^BEGIN$/i);
  assert.match(clientCalls[1].sql, /password_hash = \$1[\s\S]*WHERE id = \$2/i);
  assert.equal(clientCalls[1].params[1], 7);
  assert.match(clientCalls[2].sql, /revoke_reason = \$1[\s\S]*user_id = \$2/i);
  assert.deepEqual(clientCalls[2].params, ['password_change', 7]);
  assert.match(clientCalls[3].sql, /^COMMIT$/i);
  assert.equal(released, true);
});

test('increments failed logins atomically before locking the account', async (t) => {
  const originalQuery = postgresDb.query;
  const passwordHash = await bcrypt.hash('CorrectPass123!', 4);
  let updateCall = null;

  t.after(() => {
    postgresDb.query = originalQuery;
  });

  postgresDb.query = async (sql, params = []) => {
    if (/FROM users[\s\S]*employee_code = \$1/i.test(sql)) {
      return {
        rows: [databaseUser({
          password_hash: passwordHash,
          failed_login_count: 4
        })]
      };
    }

    if (/^\s*UPDATE users/i.test(sql)) {
      updateCall = { sql, params };
      return { rows: [], rowCount: 1 };
    }

    throw new Error('Unexpected test query');
  };

  await assert.rejects(
    () => login({ employeeCode: '12345678', password: 'WrongPass123!' }),
    (error) => error.statusCode === 401
  );

  assert.match(
    updateCall.sql,
    /failed_login_count = failed_login_count \+ 1/i
  );
  assert.match(
    updateCall.sql,
    /CASE[\s\S]*failed_login_count \+ 1 >= \$1[\s\S]*INTERVAL '15 minutes'/i
  );
  assert.deepEqual(updateCall.params, [5, 7]);
});
