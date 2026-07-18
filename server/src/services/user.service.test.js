import assert from 'node:assert/strict';
import test from 'node:test';

process.env.SESSION_SECRET = 'test_session_secret_at_least_32_chars';

const { postgresDb } = await import('../config/database.js');
const {
  createUser,
  listUsers,
  resetUserPassword,
  updateUser
} = await import('./user.service.js');

test('lists users from a PostgreSQL result object', async (t) => {
  const originalQuery = postgresDb.query;

  t.after(() => {
    postgresDb.query = originalQuery;
  });

  postgresDb.query = async () => ({
    rows: [{
      id: 3,
      employee_code: '12345678',
      full_name: 'Test User',
      position: 'QC',
      role: 'officer',
      status: 'active',
      must_change_password: true,
      failed_login_count: 0,
      locked_until: null,
      created_at: new Date('2026-01-01T00:00:00Z'),
      updated_at: new Date('2026-01-01T00:00:00Z')
    }]
  });

  const result = await listUsers();

  assert.equal(result.users.length, 1);
  assert.equal(result.users[0].employeeCode, '12345678');
});

test('creates a user with RETURNING id and PostgreSQL parameters', async (t) => {
  const originalQuery = postgresDb.query;
  const originalConnect = postgresDb.connect;
  const clientCalls = [];

  t.after(() => {
    postgresDb.query = originalQuery;
    postgresDb.connect = originalConnect;
  });

  postgresDb.query = async (sql) => {
    if (/SELECT id[\s\S]*WHERE employee_code/i.test(sql)) {
      return { rows: [] };
    }
    throw new Error('Unexpected pool query');
  };
  postgresDb.connect = async () => ({
    query: async (sql, params = []) => {
      clientCalls.push({ sql, params });

      if (/^\s*INSERT INTO users/i.test(sql)) {
        return { rows: [{ id: 9 }], rowCount: 1 };
      }
      if (/FROM users[\s\S]*WHERE id/i.test(sql)) {
        return {
          rows: [{
            id: 9,
            employee_code: '12345678',
            full_name: 'Test User',
            position: 'QC',
            role: 'officer',
            status: 'active',
            must_change_password: true,
            failed_login_count: 0,
            locked_until: null,
            created_at: new Date('2026-01-01T00:00:00Z'),
            updated_at: new Date('2026-01-01T00:00:00Z')
          }]
        };
      }

      return { rows: [], rowCount: 1 };
    },
    release: () => {}
  });

  const result = await createUser({
    actorUserId: 1,
    employeeCode: '12345678',
    fullName: 'Test User',
    position: 'QC',
    role: 'officer',
    status: 'active',
    temporaryPassword: 'TemporaryPass123!'
  });

  const insertCall = clientCalls.find(({ sql }) => /^\s*INSERT INTO users/i.test(sql));
  const auditIndex = clientCalls.findIndex(({ sql }) => /^\s*INSERT INTO user_audit_logs/i.test(sql));
  const commitIndex = clientCalls.findIndex(({ sql }) => /^COMMIT$/i.test(sql));
  assert.equal(result.user.id, 9);
  assert.match(insertCall.sql, /VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, TRUE\)/i);
  assert.match(insertCall.sql, /RETURNING id/i);
  assert.equal(insertCall.params.length, 6);
  assert.ok(auditIndex > 0 && auditIndex < commitIndex);
});

test('maps PostgreSQL duplicate employee codes to conflict', async (t) => {
  const originalQuery = postgresDb.query;
  const originalConnect = postgresDb.connect;
  const transactionSql = [];

  t.after(() => {
    postgresDb.query = originalQuery;
    postgresDb.connect = originalConnect;
  });

  postgresDb.query = async (sql) => {
    if (/SELECT id[\s\S]*WHERE employee_code/i.test(sql)) {
      return { rows: [] };
    }

    throw new Error('Unexpected pool query');
  };
  postgresDb.connect = async () => ({
    query: async (sql) => {
      transactionSql.push(sql);
      if (/^\s*INSERT INTO users/i.test(sql)) {
        const error = new Error('duplicate value');
        error.code = '23505';
        throw error;
      }
      return { rows: [], rowCount: 0 };
    },
    release: () => {}
  });

  await assert.rejects(
    () => createUser({
      actorUserId: 1,
      employeeCode: '12345678',
      fullName: 'Test User',
      position: 'QC',
      role: 'officer',
      status: 'active',
      temporaryPassword: 'TemporaryPass123!'
    }),
    (error) => error.statusCode === 409 && !/duplicate value/i.test(error.message)
  );
  assert.ok(transactionSql.some((sql) => /^ROLLBACK$/i.test(sql)));
});

test('updates a user and writes its audit record in one transaction', async (t) => {
  const originalQuery = postgresDb.query;
  const originalConnect = postgresDb.connect;
  const clientCalls = [];
  const user = {
    id: 9,
    employee_code: '12345678',
    full_name: 'Test User',
    position: 'QC',
    role: 'officer',
    status: 'active',
    must_change_password: false,
    failed_login_count: 0,
    locked_until: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z')
  };

  t.after(() => {
    postgresDb.query = originalQuery;
    postgresDb.connect = originalConnect;
  });

  postgresDb.query = async () => ({ rows: [user] });
  postgresDb.connect = async () => ({
    query: async (sql, params = []) => {
      clientCalls.push({ sql, params });
      if (/FROM users[\s\S]*WHERE id = \$1/i.test(sql)) {
        return { rows: [{ ...user, role: 'assistant' }] };
      }
      return { rows: [], rowCount: 1 };
    },
    release: () => {}
  });

  const result = await updateUser({
    userId: 9,
    actorUserId: 1,
    fullName: 'Test User',
    position: 'QC',
    role: 'assistant',
    status: 'active'
  });

  assert.equal(result.user.role, 'assistant');
  assert.match(clientCalls[0].sql, /^BEGIN$/i);
  assert.match(clientCalls[1].sql, /^\s*UPDATE users/i);
  assert.match(clientCalls[2].sql, /FROM users[\s\S]*WHERE id = \$1/i);
  assert.match(clientCalls[3].sql, /^\s*INSERT INTO user_audit_logs/i);
  assert.deepEqual(clientCalls[3].params.slice(0, 3), [1, 9, 'update_user']);
  assert.match(clientCalls[4].sql, /^COMMIT$/i);
});

test('resets a password and revokes existing sessions in one transaction', async (t) => {
  const originalQuery = postgresDb.query;
  const originalConnect = postgresDb.connect;
  const clientCalls = [];
  let released = false;
  const user = {
    id: 9,
    employee_code: '12345678',
    full_name: 'Test User',
    position: 'QC',
    role: 'officer',
    status: 'active',
    must_change_password: true,
    failed_login_count: 0,
    locked_until: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z')
  };

  t.after(() => {
    postgresDb.query = originalQuery;
    postgresDb.connect = originalConnect;
  });

  postgresDb.query = async (sql) => {
    if (/FROM users[\s\S]*WHERE id = \$1/i.test(sql)) {
      return { rows: [user] };
    }

    return { rows: [], rowCount: 1 };
  };
  postgresDb.connect = async () => ({
    query: async (sql, params = []) => {
      clientCalls.push({ sql, params });
      if (/FROM users[\s\S]*WHERE id = \$1/i.test(sql)) {
        return { rows: [user] };
      }
      return { rows: [], rowCount: 1 };
    },
    release: () => {
      released = true;
    }
  });

  await resetUserPassword({
    userId: 9,
    actorUserId: 1,
    temporaryPassword: 'ReplacementPass123!'
  });

  assert.match(clientCalls[0].sql, /^BEGIN$/i);
  assert.match(clientCalls[1].sql, /UPDATE users[\s\S]*password_hash = \$1/i);
  assert.equal(clientCalls[1].params[1], 9);
  assert.match(clientCalls[2].sql, /UPDATE auth_sessions/i);
  assert.deepEqual(clientCalls[2].params, ['password_reset', 9]);
  assert.match(clientCalls[3].sql, /FROM users[\s\S]*WHERE id = \$1/i);
  assert.match(clientCalls[4].sql, /^\s*INSERT INTO user_audit_logs/i);
  assert.deepEqual(clientCalls[4].params.slice(0, 3), [1, 9, 'reset_password']);
  assert.match(clientCalls[5].sql, /^COMMIT$/i);
  assert.equal(released, true);
});
