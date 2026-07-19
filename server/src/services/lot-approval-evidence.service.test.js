import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

process.env.SESSION_SECRET = 'test_session_secret_at_least_32_chars';

const { postgresDb } = await import('../config/database.js');
const {
  getLotApprovalEvidence,
  mapApprovalEvidenceRow
} = await import('./lot-approval-evidence.service.js');

test('approval evidence uses audit actor snapshot before live user data', () => {
  const evidence = mapApprovalEvidenceRow({
    action: 'approve',
    reason: 'approved',
    created_at: '2026-07-18T00:00:00.000Z',
    actor_name_snapshot: 'Snapshot Name',
    actor_position_snapshot: 'Snapshot Position',
    actor_name: 'Live Name',
    actor_position: 'Live Position'
  });

  assert.equal(evidence.actorName, 'Snapshot Name');
  assert.equal(evidence.actorPosition, 'Snapshot Position');
});

test('approval evidence uses a PostgreSQL result and parameter', async (t) => {
  const originalQuery = postgresDb.query;
  let executedSql = '';
  let executedParams = [];

  t.after(() => {
    postgresDb.query = originalQuery;
  });

  postgresDb.query = async (sql, params = []) => {
    executedSql = sql;
    executedParams = params;
    return {
      rows: [{
        action: 'approve',
        reason: 'approved',
        actor_name_snapshot: 'Admin',
        actor_position_snapshot: 'QC',
        created_at: '2026-07-18T00:00:00.000Z'
      }]
    };
  };

  const result = await getLotApprovalEvidence(7, postgresDb);

  assert.equal(result.approved.actorName, 'Admin');
  assert.match(executedSql, /a\.lot_id = \$1/i);
  assert.deepEqual(executedParams, [7]);
});

test('approval evidence service contains no MySQL query API', async () => {
  const source = await readFile(new URL('./lot-approval-evidence.service.js', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /\.execute\(/);
});
