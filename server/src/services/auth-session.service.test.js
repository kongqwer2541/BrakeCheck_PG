import assert from 'node:assert/strict';
import test from 'node:test';

process.env.SESSION_SECRET = 'test_session_secret_at_least_32_chars';

const { postgresDb } = await import('../config/database.js');
const {
  assertActiveAuthSession,
  authSessionRetentionDays,
  getAuthSessionRetentionStatus
} = await import('./auth-session.service.js');

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
  assert.deepEqual(executedParams, ['test-session-id', 7]);
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
