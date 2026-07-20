import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import test from 'node:test';

process.env.SESSION_SECRET = 'test_session_secret_at_least_32_chars';

const { postgresDb } = await import('../config/database.js');
const { changePassword, getCurrentUser, login, logout } = await import('./auth.service.js');

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

test('logout revokes only the current session', async (t) => {
  const originalQuery = postgresDb.query;
  let executedSql = '';
  let executedParams = [];

  t.after(() => {
    postgresDb.query = originalQuery;
  });

  postgresDb.query = async (sql, params) => {
    executedSql = sql;
    executedParams = params;
    return { rows: [], rowCount: 1 };
  };

  const result = await logout({
    userId: 7,
    tokenId: 'current-session-id'
  });

  assert.equal(result.ok, true);
  assert.match(executedSql, /UPDATE auth_sessions/i);
  assert.match(executedSql, /token_id = \$2[\s\S]*user_id = \$3/i);
  assert.deepEqual(executedParams, ['logout', 'current-session-id', 7]);
});

test('rejects a missing login body before querying the database', async (t) => {
  const originalQuery = postgresDb.query;
  let queryCount = 0;

  t.after(() => {
    postgresDb.query = originalQuery;
  });

  postgresDb.query = async () => {
    queryCount += 1;
    return { rows: [] };
  };

  await assert.rejects(
    () => login(),
    (error) => error.statusCode === 400
  );

  assert.equal(queryCount, 0);
});

test('rejects non-string login credentials before querying the database', async (t) => {
  const originalQuery = postgresDb.query;
  let queryCount = 0;

  t.after(() => {
    postgresDb.query = originalQuery;
  });

  postgresDb.query = async () => {
    queryCount += 1;
    return { rows: [] };
  };

  await assert.rejects(
    () => login({ employeeCode: {}, password: ['invalid'] }),
    (error) => error.statusCode === 400
  );

  assert.equal(queryCount, 0);
});

test('creates a session for valid credentials and does not expose the password hash', async (t) => {
  const originalQuery = postgresDb.query;
  const password = 'CorrectPass123!';
  const passwordHash = await bcrypt.hash(password, 4);
  let clearLockCall = null;
  let sessionCall = null;

  t.after(() => {
    postgresDb.query = originalQuery;
  });

  postgresDb.query = async (sql, params = []) => {
    if (/FROM users[\s\S]*employee_code = \$1/i.test(sql)) {
      return { rows: [databaseUser({ password_hash: passwordHash })] };
    }

    if (/failed_login_count = 0/i.test(sql)) {
      clearLockCall = { sql, params };
      return { rows: [], rowCount: 1 };
    }

    if (/FROM users[\s\S]*WHERE id = \$1/i.test(sql)) {
      return { rows: [databaseUser({ password_hash: passwordHash })] };
    }

    if (/INSERT INTO auth_sessions/i.test(sql)) {
      sessionCall = { sql, params };
      return { rows: [], rowCount: 1 };
    }

    throw new Error('Unexpected test query');
  };

  const result = await login({ employeeCode: '12345678', password });

  assert.equal(result.ok, true);
  assert.equal(result.user.employeeCode, '12345678');
  assert.equal(Object.hasOwn(result.user, 'passwordHash'), false);
  assert.equal(Object.hasOwn(result.user, 'password_hash'), false);
  assert.deepEqual(clearLockCall.params, [7]);
  assert.equal(sessionCall.params[1], 7);
});

test('returns the same generic error for suspended and locked accounts', async (t) => {
  const originalQuery = postgresDb.query;
  const genericMessage = 'รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง';

  t.after(() => {
    postgresDb.query = originalQuery;
  });

  postgresDb.query = async (sql, params = []) => {
    if (!/FROM users[\s\S]*employee_code = \$1/i.test(sql)) {
      throw new Error('Unexpected test query');
    }

    if (params[0] === '11111111') {
      return { rows: [databaseUser({ status: 'suspended' })] };
    }

    return {
      rows: [databaseUser({
        locked_until: new Date(Date.now() + 15 * 60 * 1000)
      })]
    };
  };

  for (const employeeCode of ['11111111', '22222222']) {
    await assert.rejects(
      () => login({ employeeCode, password: 'WrongPass123!' }),
      (error) => error.statusCode === 401 && error.message === genericMessage
    );
  }
});

test('locks the account on the fifth failed login but returns a generic error', async (t) => {
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
      return {
        rows: [{
          failed_login_count: 5,
          locked_until: new Date(Date.now() + 15 * 60 * 1000)
        }],
        rowCount: 1
      };
    }

    throw new Error('Unexpected test query');
  };

  await assert.rejects(
    () => login({ employeeCode: '12345678', password: 'WrongPass123!' }),
    (error) => (
      error.statusCode === 401
      && error.message === 'รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง'
    )
  );

  assert.match(
    updateCall.sql,
    /ELSE failed_login_count \+ 1/i
  );
  assert.match(
    updateCall.sql,
    /CASE[\s\S]*failed_login_count \+ 1 >= \$1[\s\S]*INTERVAL '15 minutes'/i
  );
  assert.match(updateCall.sql, /RETURNING failed_login_count, locked_until/i);
  assert.deepEqual(updateCall.params, [5, 7]);
});

test('starts a new failed-login count after an expired lock', async (t) => {
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
          failed_login_count: 5,
          locked_until: new Date(Date.now() - 1000)
        })]
      };
    }

    if (/^\s*UPDATE users/i.test(sql)) {
      updateCall = { sql, params };
      return {
        rows: [{ failed_login_count: 1, locked_until: null }],
        rowCount: 1
      };
    }

    throw new Error('Unexpected test query');
  };

  await assert.rejects(
    () => login({ employeeCode: '12345678', password: 'WrongPass123!' }),
    (error) => error.statusCode === 401
  );

  assert.match(updateCall.sql, /locked_until <= CURRENT_TIMESTAMP/i);
});

test('does not create a session when the account becomes suspended during login', async (t) => {
  const originalQuery = postgresDb.query;
  const passwordHash = await bcrypt.hash('CorrectPass123!', 4);

  t.after(() => {
    postgresDb.query = originalQuery;
  });

  postgresDb.query = async (sql) => {
    if (/FROM users[\s\S]*employee_code = \$1/i.test(sql)) {
      return { rows: [databaseUser({ password_hash: passwordHash })] };
    }

    if (/failed_login_count = 0/i.test(sql)) {
      return { rows: [], rowCount: 1 };
    }

    if (/FROM users[\s\S]*WHERE id = \$1/i.test(sql)) {
      return { rows: [databaseUser({ status: 'suspended' })] };
    }

    if (/INSERT INTO auth_sessions/i.test(sql)) {
      throw new Error('A session must not be created for an inactive account');
    }

    throw new Error('Unexpected test query');
  };

  await assert.rejects(
    () => login({ employeeCode: '12345678', password: 'CorrectPass123!' }),
    (error) => (
      error.statusCode === 401
      && error.message === 'รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง'
    )
  );
});
