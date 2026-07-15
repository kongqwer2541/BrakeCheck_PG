import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

import { db } from '../config/database.js';
import { getDashboardData } from './dashboard.service.js';

test('dashboard loads a production date range and reports latest date', async () => {
  const executed = [];
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    execute: async (sql, params) => {
      executed.push({ sql, params });

      if (sql.includes('MAX(production_date)')) {
        return [[{ latest_date: '2026-06-29' }]];
      }

      if (sql.includes('COUNT(*) AS total_lots')) {
        return [[{
          total_lots: 1,
          completed_lots: 1,
          approved_lots: 0,
          waiting_approve_lots: 1,
          ng_lots: 0
        }]];
      }

      return [[{
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
      }]];
    }
  };
  mock.method(db, 'getConnection', async () => connection);

  const result = await getDashboardData({
    startDate: '2026-06-22',
    endDate: '2026-06-24',
    status: 'all',
    page: 1,
    pageSize: '50'
  });

  const statsQuery = executed.find((item) => item.sql.includes('COUNT(*) AS total_lots'));
  const listQuery = executed.find((item) => item.sql.includes('ORDER BY'));

  assert.match(statsQuery.sql, /production_date BETWEEN \? AND \?/);
  assert.match(listQuery.sql, /production_date BETWEEN \? AND \?/);
  assert.deepEqual(statsQuery.params, ['2026-06-22', '2026-06-24']);
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

test('dashboard keeps date ranges paginated instead of allowing all page size', async () => {
  const executed = [];
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    execute: async (sql, params) => {
      executed.push({ sql, params });

      if (sql.includes('MAX(production_date)')) {
        return [[{ latest_date: '2026-06-29' }]];
      }

      if (sql.includes('COUNT(*) AS total_lots')) {
        return [[{
          total_lots: 75,
          completed_lots: 0,
          approved_lots: 0,
          waiting_approve_lots: 0,
          ng_lots: 0
        }]];
      }

      return [[]];
    }
  };
  mock.method(db, 'getConnection', async () => connection);

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
