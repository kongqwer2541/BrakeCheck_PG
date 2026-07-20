import assert from 'node:assert/strict';
import test from 'node:test';

process.env.SESSION_SECRET = 'test_session_secret_at_least_32_chars';

const { postgresDb } = await import('../config/database.js');
const { createAuthToken } = await import('../utils/token.js');
const { requireAuth } = await import('./auth.middleware.js');

test('rejects missing and forged tokens before querying the database', async (t) => {
  const originalQuery = postgresDb.query;
  let queryCount = 0;

  t.after(() => {
    postgresDb.query = originalQuery;
  });

  postgresDb.query = async () => {
    queryCount += 1;
    return { rows: [] };
  };

  for (const authorization of [undefined, ['Bearer forged-token'], 'Bearer forged-token']) {
    let nextError = null;
    const headers = authorization ? { authorization } : {};

    await requireAuth({ headers }, {}, (error) => {
      nextError = error || null;
    });

    assert.equal(nextError?.statusCode, 401);
  }

  assert.equal(queryCount, 0);
});

test('rejects a valid token when its database session is not active', async (t) => {
  const originalQuery = postgresDb.query;
  const { token } = createAuthToken({
    id: 7,
    employee_code: '12345678',
    role: 'officer'
  });
  let queryCount = 0;
  let nextError = null;

  t.after(() => {
    postgresDb.query = originalQuery;
  });

  postgresDb.query = async () => {
    queryCount += 1;
    return { rows: [] };
  };

  await requireAuth(
    { headers: { authorization: `Bearer ${token}` } },
    {},
    (error) => {
      nextError = error || null;
    }
  );

  assert.equal(nextError?.statusCode, 401);
  assert.equal(queryCount, 1);
});

test('loads the current user for a valid active session', async (t) => {
  const originalQuery = postgresDb.query;
  const createdToken = createAuthToken({
    id: 7,
    employee_code: '12345678',
    role: 'officer'
  });
  const req = {
    headers: { authorization: `Bearer ${createdToken.token}` }
  };
  let nextError = null;

  t.after(() => {
    postgresDb.query = originalQuery;
  });

  postgresDb.query = async (sql) => {
    if (/FROM auth_sessions/i.test(sql)) {
      return { rows: [{ id: 1 }] };
    }

    if (/FROM users/i.test(sql)) {
      return {
        rows: [{
          id: 7,
          employee_code: '12345678',
          full_name: 'Test User',
          position: 'QC',
          role: 'officer',
          status: 'active',
          must_change_password: false
        }]
      };
    }

    throw new Error('Unexpected test query');
  };

  await requireAuth(req, {}, (error) => {
    nextError = error || null;
  });

  assert.equal(nextError, null);
  assert.equal(req.user.id, 7);
  assert.equal(req.auth.tokenId, createdToken.tokenId);
});

test('rejects a Bearer header that contains extra credentials', async (t) => {
  const originalQuery = postgresDb.query;
  const { token } = createAuthToken({
    id: 7,
    employee_code: '12345678',
    role: 'officer'
  });
  let queryCount = 0;
  let nextError = null;

  t.after(() => {
    postgresDb.query = originalQuery;
  });

  postgresDb.query = async (sql) => {
    queryCount += 1;

    if (/FROM auth_sessions/i.test(sql)) {
      return { rows: [{ id: 1 }] };
    }

    if (/FROM users/i.test(sql)) {
      return {
        rows: [{
          id: 7,
          employee_code: '12345678',
          full_name: 'Test User',
          position: 'QC',
          role: 'officer',
          status: 'active',
          must_change_password: false
        }]
      };
    }

    throw new Error('Unexpected test query');
  };

  await requireAuth(
    { headers: { authorization: `Bearer ${token} extra-value` } },
    {},
    (error) => {
      nextError = error || null;
    }
  );

  assert.equal(nextError?.statusCode, 401);
  assert.equal(queryCount, 0);
});
