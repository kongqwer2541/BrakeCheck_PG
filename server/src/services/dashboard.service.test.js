import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SESSION_SECRET = 'test_session_secret_at_least_32_chars';

const { db, postgresDb } = await import('../config/database.js');
const { getDashboardData } = await import('./dashboard.service.js');

test('dashboard loads a PostgreSQL date range with escaped search', async (t) => {
  const originalLegacyGetConnection = db.getConnection;
  const originalConnect = postgresDb.connect;
  const executed = [];
  const connection = {
    release: () => {},
    query: async (sql, params = []) => {
      executed.push({ sql, params });

      if (sql.includes('MAX(production_date)')) {
        return { rows: [{ latest_date: '2026-06-29' }] };
      }

      if (sql.includes('COUNT(*) AS total_lots')) {
        return { rows: [{
          total_lots: 1,
          completed_lots: 1,
          approved_lots: 0,
          waiting_approve_lots: 1,
          ng_lots: 0
        }] };
      }

      if (sql.includes('ORDER BY')) return { rows: [{
        lot_number: '260526003',
        lot_pack_barcode: '260526002',
        lot_packing: '260526-008',
        purchase_order: 'T1LE009',
        model_name: 'FUSO TRUCK SUPERGREAT R',
        dimension: '170*13.0*8.0-170',
        aci_grade: '535 A',
        quantity: 200,
        status: 'waiting_approve',
        import_source: 'excel',
        updated_at: '2026-06-22 10:00:00'
      }] };

      return { rows: [] };
    }
  };

  t.after(() => {
    db.getConnection = originalLegacyGetConnection;
    postgresDb.connect = originalConnect;
  });
  db.getConnection = async () => {
    throw new Error('Legacy MySQL pool was used.');
  };
  postgresDb.connect = async () => connection;

  const result = await getDashboardData({
    startDate: '2026-06-22',
    endDate: '2026-06-24',
    status: 'all',
    search: 'LOT%_\\1',
    page: 1,
    pageSize: '50'
  });

  const statsQuery = executed.find((item) => item.sql.includes('COUNT(*) AS total_lots'));
  const listQuery = executed.find((item) => item.sql.includes('ORDER BY'));

  assert.match(statsQuery.sql, /production_date BETWEEN \$1 AND \$2/);
  assert.match(statsQuery.sql, /lot_number ILIKE \$3 ESCAPE '\\'/);
  assert.match(listQuery.sql, /production_date BETWEEN \$1 AND \$2/);
  assert.deepEqual(statsQuery.params, ['2026-06-22', '2026-06-24', '%LOT\\%\\_\\\\1%']);
  assert.equal(executed[0].sql, 'BEGIN');
  assert.equal(executed.at(-1).sql, 'COMMIT');
  assert.equal(result.latestDate, '2026-06-29');
  assert.equal(result.hasNewerDate, true);
  assert.equal(result.filters.startDate, '2026-06-22');
  assert.equal(result.filters.endDate, '2026-06-24');
});

test('dashboard rejects void status from the public dashboard filter', async () => {
  await assert.rejects(
    () => getDashboardData({
      startDate: '2026-06-22',
      endDate: '2026-06-22',
      status: 'void'
    }),
    /ตัวกรองสถานะไม่ถูกต้อง/
  );
});

test('dashboard keeps date ranges paginated instead of allowing all page size', async (t) => {
  const originalLegacyGetConnection = db.getConnection;
  const originalConnect = postgresDb.connect;
  const executed = [];
  const connection = {
    release: () => {},
    query: async (sql, params = []) => {
      executed.push({ sql, params });

      if (sql.includes('MAX(production_date)')) {
        return { rows: [{ latest_date: '2026-06-29' }] };
      }

      if (sql.includes('COUNT(*) AS total_lots')) {
        return { rows: [{
          total_lots: 75,
          completed_lots: 0,
          approved_lots: 0,
          waiting_approve_lots: 0,
          ng_lots: 0
        }] };
      }

      return { rows: [] };
    }
  };

  t.after(() => {
    db.getConnection = originalLegacyGetConnection;
    postgresDb.connect = originalConnect;
  });
  db.getConnection = async () => {
    throw new Error('Legacy MySQL pool was used.');
  };
  postgresDb.connect = async () => connection;

  const result = await getDashboardData({
    startDate: '2026-06-22',
    endDate: '2026-06-24',
    status: 'all',
    pageSize: 'all',
    page: 1
  });

  const listQuery = executed.find((item) => item.sql.includes('ORDER BY'));
  assert.match(listQuery.sql, /LIMIT 50 OFFSET 0/);
  assert.equal(result.filters.pageSize, 50);
  assert.equal(result.summary.totalPages, 2);
});
