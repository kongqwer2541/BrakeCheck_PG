import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

process.env.SESSION_SECRET = 'test_session_secret_at_least_32_chars';

const { db, postgresDb } = await import('../config/database.js');
const {
  getAuditHistory,
  getImportHistory,
  getLotHistory
} = await import('./history.service.js');

test('history service uses PostgreSQL query APIs', async () => {
  const source = await readFile(new URL('./history.service.js', import.meta.url), 'utf8');

  assert.match(source, /import \{ postgresDb \}/);
  assert.doesNotMatch(source, /\.execute\(|\bdb\./);
});

test('lot history uses PostgreSQL parameters and escaped search', async (t) => {
  const originalLegacyExecute = db.execute;
  const originalQuery = postgresDb.query;
  const calls = [];

  t.after(() => {
    db.execute = originalLegacyExecute;
    postgresDb.query = originalQuery;
  });
  db.execute = async () => {
    throw new Error('Legacy MySQL pool was used.');
  };
  postgresDb.query = async (sql, params = []) => {
    calls.push({ sql, params });
    if (/COUNT\(\*\)/i.test(sql)) return { rows: [{ total: 1 }] };
    return { rows: [{ lot_number: 'LOT-1', status: 'approved', quantity: 10 }] };
  };

  const result = await getLotHistory({
    date: '2026-07-18',
    status: 'approved',
    search: 'LOT%_\\1',
    page: 1,
    pageSize: '50'
  });

  const countQuery = calls.find(({ sql }) => /COUNT\(\*\)/i.test(sql));
  assert.match(countQuery.sql, /l\.production_date = \$1/);
  assert.match(countQuery.sql, /l\.status = \$2/);
  assert.match(countQuery.sql, /l\.lot_number ILIKE \$3 ESCAPE '\\'/);
  assert.deepEqual(countQuery.params, ['2026-07-18', 'approved', '%LOT\\%\\_\\\\1%']);
  assert.equal(result.items[0].lotNumber, 'LOT-1');
});

test('import history filters PostgreSQL timestamps and file names', async (t) => {
  const originalQuery = postgresDb.query;
  const calls = [];

  t.after(() => {
    postgresDb.query = originalQuery;
  });
  postgresDb.query = async (sql, params = []) => {
    calls.push({ sql, params });
    if (/COUNT\(\*\)/i.test(sql)) return { rows: [{ total: 1 }] };
    return { rows: [{ id: 1, original_file_name: 'test.xlsx', total_rows: 1, imported_rows: 1 }] };
  };

  const result = await getImportHistory({
    date: '2026-07-18',
    search: 'test_',
    page: 1,
    pageSize: '50'
  });

  const countQuery = calls.find(({ sql }) => /COUNT\(\*\)/i.test(sql));
  assert.match(countQuery.sql, /DATE\(b\.uploaded_at\) = \$1/);
  assert.match(countQuery.sql, /b\.original_file_name ILIKE \$2 ESCAPE '\\'/);
  assert.deepEqual(countQuery.params, ['2026-07-18', '%test\\_%']);
  assert.equal(result.items[0].originalFileName, 'test.xlsx');
});

test('audit history keeps snapshot actor data with PostgreSQL filters', async (t) => {
  const originalQuery = postgresDb.query;
  const calls = [];

  t.after(() => {
    postgresDb.query = originalQuery;
  });
  postgresDb.query = async (sql, params = []) => {
    calls.push({ sql, params });
    if (/COUNT\(\*\)/i.test(sql)) return { rows: [{ total: 1 }] };
    return { rows: [{
      id: 1,
      action: 'approve',
      reason: 'approved',
      lot_number: 'LOT-1',
      actor_name_snapshot: 'Snapshot Name',
      actor_position_snapshot: 'Snapshot Position',
      changed_by_name_snapshot: 'Snapshot Name',
      changed_by_position_snapshot: 'Snapshot Position',
      changed_by_name: 'Live Name',
      changed_by_position: 'Live Position'
    }] };
  };

  const result = await getAuditHistory({
    date: '2026-07-18',
    action: 'approve',
    search: 'LOT_',
    page: 1,
    pageSize: '50'
  });

  const countQuery = calls.find(({ sql }) => /COUNT\(\*\)/i.test(sql));
  assert.match(countQuery.sql, /DATE\(a\.created_at\) = \$1/);
  assert.match(countQuery.sql, /a\.action = \$2/);
  assert.match(countQuery.sql, /l\.lot_number ILIKE \$3 ESCAPE '\\'/);
  assert.deepEqual(countQuery.params, ['2026-07-18', 'approve', '%LOT\\_%']);
  assert.equal(result.items[0].changedBy, 'Snapshot Name');
});
