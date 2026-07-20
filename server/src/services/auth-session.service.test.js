import assert from 'node:assert/strict';
import test from 'node:test';

process.env.SESSION_SECRET = 'test_session_secret_at_least_32_chars';

const { postgresDb } = await import('../config/database.js');
const {
  assertActiveAuthSession,
  authSessionRetentionDays,
  createAuthSession,
  getAuthSessionRetentionStatus,
  revokeAuthSession
} = await import('./auth-session.service.js');

test('stores only the session id, user id, and expiry', async (t) => {
  const originalQuery = postgresDb.query;
  const expiresAt = new Date('2030-01-01T00:00:00.000Z');
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

  await createAuthSession({
    userId: 7,
    tokenId: 'test-session-id',
    expiresAt
  });

  assert.match(executedSql, /INSERT INTO auth_sessions/i);
  assert.match(executedSql, /token_id, user_id, expires_at/i);
  assert.deepEqual(executedParams, ['test-session-id', 7, expiresAt]);
  assert.equal(executedParams.length, 3);
});

test('accepts a session that is active in the database', async (t) => {
  const originalQuery = postgresDb.query;
  let executedSql = '';
  let executedParams = [];

  t.after(() => {
    postgresDb.query = originalQuery;
  });
  postgresDb.query = async (sql, params) => {
    executedSql = sql;
    executedParams = params;
    return { rows: [{ id: 1 }] };
  };

  await assert.doesNotReject(() => assertActiveAuthSession({
    userId: 7,
    tokenId: 'test-session-id'
  }));

  assert.match(executedSql, /token_id = \$1[\s\S]*user_id = \$2/i);
  assert.match(executedSql, /revoked_at IS NULL/i);
  assert.match(executedSql, /expires_at > NOW\(\)/i);
  assert.deepEqual(executedParams, ['test-session-id', 7]);
});

test('rejects a request without a session id before querying the database', async (t) => {
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
    () => assertActiveAuthSession({ userId: 7, tokenId: '' }),
    (error) => error.statusCode === 401
  );

  assert.equal(queryCount, 0);
});

test('rejects a session that is missing, expired, or revoked', async (t) => {
  const originalQuery = postgresDb.query;
  t.after(() => {
    postgresDb.query = originalQuery;
  });
  postgresDb.query = async () => ({ rows: [] });

  await assert.rejects(
    () => assertActiveAuthSession({ userId: 7, tokenId: 'revoked-session-id' }),
    (error) => error.statusCode === 401
  );
});

test('revokes only the selected session and remains safe when called twice', async (t) => {
  const originalQuery = postgresDb.query;
  const calls = [];

  t.after(() => {
    postgresDb.query = originalQuery;
  });

  postgresDb.query = async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [], rowCount: 1 };
  };

  const request = {
    userId: 7,
    tokenId: 'current-session-id',
    reason: 'logout'
  };

  await revokeAuthSession(request);
  await revokeAuthSession(request);

  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.match(call.sql, /revoked_at = COALESCE\(revoked_at, CURRENT_TIMESTAMP\)/i);
    assert.match(call.sql, /revoke_reason = COALESCE\(revoke_reason, \$1\)/i);
    assert.match(call.sql, /token_id = \$2[\s\S]*user_id = \$3/i);
    assert.deepEqual(call.params, ['logout', 'current-session-id', 7]);
  }
});

test('reports old sessions without deleting data', async (t) => {
  const originalQuery = postgresDb.query;
  let executedSql = '';
  let executedParams = [];

  t.after(() => {
    postgresDb.query = originalQuery;
  });

  postgresDb.query = async (sql, params) => {
    executedSql = sql;
    executedParams = params;
    return {
      rows: [{
        old_session_count: '12',
        revoked_count: '7',
        expired_count: '5'
      }]
    };
  };

  const result = await getAuthSessionRetentionStatus();

  assert.equal(result.retentionDays, authSessionRetentionDays);
  assert.equal(result.oldSessionCount, 12);
  assert.equal(result.revokedCount, 7);
  assert.equal(result.expiredCount, 5);
  assert.equal(result.cleanupEnabled, false);
  assert.match(executedSql, /^\s*SELECT/i);
  assert.match(executedSql, /\$1::integer \* INTERVAL '1 day'/i);
  assert.deepEqual(executedParams, [authSessionRetentionDays]);
  assert.doesNotMatch(executedSql, /DELETE|UPDATE|TRUNCATE|DROP/i);
  assert.doesNotMatch(executedSql, /DATE_SUB|\?/i);
});
