import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

process.env.SESSION_SECRET = 'test_session_secret_at_least_32_chars';

const { db, postgresDb } = await import('../config/database.js');
const { getInspectionQueue } = await import('./inspection-queue.service.js');

test('inspection queue uses PostgreSQL without MySQL pool APIs', async () => {
  const source = await readFile(new URL('./inspection-queue.service.js', import.meta.url), 'utf8');

  assert.match(source, /import \{ postgresDb \}/);
  assert.doesNotMatch(source, /\bdb\.execute|\.execute\(/);
});

test('inspection queue uses PostgreSQL parameters and literal wildcard search', async (t) => {
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

    if (/MAX\(production_date\)/i.test(sql)) {
      return { rows: [{ latest_date: '2026-07-18' }] };
    }

    return { rows: [] };
  };

  const result = await getInspectionQueue({
    queueType: 'dimension',
    startDate: '2026-07-18',
    endDate: '2026-07-18',
    status: 'all',
    search: 'LOT%_\\1',
    page: 1,
    pageSize: 50
  });

  assert.equal(result.ok, true);
  const listQuery = calls.find(({ sql }) => /FROM lots[\s\S]*LEFT JOIN/i.test(sql));
  assert.ok(listQuery);
  assert.match(listQuery.sql, /production_date BETWEEN \$1 AND \$2/i);
  assert.match(listQuery.sql, /lot_number ILIKE \$3 ESCAPE '\\'/i);
  assert.deepEqual(listQuery.params, [
    '2026-07-18',
    '2026-07-18',
    '%LOT\\%\\_\\\\1%',
    '%LOT\\%\\_\\\\1%',
    '%LOT\\%\\_\\\\1%',
    '%LOT\\%\\_\\\\1%'
  ]);
});
