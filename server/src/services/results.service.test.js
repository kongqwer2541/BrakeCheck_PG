import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getResultsLots,
  validateResultsTab
} from './results.service.js';

test('results tab allows only completed result groups', () => {
  assert.equal(validateResultsTab(''), 'approved');
  assert.equal(validateResultsTab('approved'), 'approved');
  assert.equal(validateResultsTab('confirmed_ng'), 'confirmed_ng');
  assert.throws(() => validateResultsTab('ng'), /แท็บ Results ไม่ถูกต้อง/);
});

test('results list returns only completed approved lots with approval evidence', async () => {
  const executed = [];
  const connection = {
    execute: async (sql, params) => {
      executed.push({ sql, params });

      if (sql.includes('COUNT(*)')) {
        return [[{ total_items: 1 }]];
      }

      return [[{
        lot_number: 'L-APP-1',
        lot_pack_barcode: 'PACK-1',
        lot_packing: 'PROD-1',
        model_name: 'MODEL-A',
        dimension: '100x50',
        purchase_order: 'PO-1',
        quantity: 100,
        production_date: '2026-06-22',
        status: 'approved',
        attachment_count: 2,
        completed_at: '2026-06-23 08:30:00'
      }]];
    }
  };

  const result = await getResultsLots({
    tab: 'approved',
    startDate: '2026-06-22',
    endDate: '2026-06-22',
    page: 1,
    pageSize: '50',
    connection
  });

  const countQuery = executed.find((item) => item.sql.includes('COUNT(*)'));
  const listQuery = executed.find((item) => item.sql.includes('ORDER BY'));
  assert.match(countQuery.sql, /lots\.status = \?/);
  assert.match(countQuery.sql, /action = \?/);
  assert.doesNotMatch(countQuery.sql, /action = 'approve'/);
  assert.doesNotMatch(listQuery.sql, /action = 'approve'/);
  assert.match(countQuery.sql, /dimension_inspections\.status = 'completed'/);
  assert.match(countQuery.sql, /packing_inspections\.status = 'completed'/);
  assert.deepEqual(countQuery.params, ['approved', '2026-06-22', '2026-06-22', 'approve']);
  assert.deepEqual(listQuery.params, ['approve', 'approved', '2026-06-22', '2026-06-22', 'approve']);
  assert.equal(result.items[0].lotNumber, 'L-APP-1');
  assert.equal(result.items[0].completedAt, '2026-06-23 08:30:00');
  assert.equal(result.summary.totalItems, 1);
});

test('results attachment count ignores deleted attachments', async () => {
  const executed = [];
  const connection = {
    execute: async (sql, params) => {
      executed.push({ sql, params });

      if (sql.includes('MAX(lots.production_date)')) {
        return [[{ latest_date: '2026-06-22' }]];
      }

      if (sql.includes('COUNT(*)')) {
        return [[{ total_items: 1 }]];
      }

      if (sql.includes('COUNT(lot_attachments.id)')) {
        return [[{
          lot_number: 'L-APP-ATTACH',
          lot_pack_barcode: 'PACK-ATTACH',
          lot_packing: 'PROD-ATTACH',
          model_name: 'MODEL-A',
          dimension: '100x50',
          purchase_order: 'PO-ATTACH',
          quantity: 100,
          production_date: '2026-06-22',
          status: 'approved',
          attachment_count: 2,
          completed_at: '2026-06-23 08:30:00'
        }]];
      }

      return [[{ approved_count: 1, confirmed_ng_count: 0 }]];
    }
  };

  const result = await getResultsLots({
    tab: 'approved',
    dateMode: 'all',
    page: 1,
    pageSize: '50',
    connection
  });

  const listQuery = executed.find((item) => item.sql.includes('ORDER BY'));
  assert.match(listQuery.sql, /lot_attachments\.deleted_at IS NULL/);
  assert.equal(result.items[0].attachmentCount, 2);
});

test('results confirmed NG tab requires confirm_ng evidence', async () => {
  const executed = [];
  const connection = {
    execute: async (sql, params) => {
      executed.push({ sql, params });
      return [[{ total_items: 0 }]];
    }
  };

  await getResultsLots({
    tab: 'confirmed_ng',
    dateMode: 'all',
    connection
  });

  const countQuery = executed.find((item) => item.sql.includes('COUNT(*)'));
  const listQuery = executed.find((item) => item.sql.includes('ORDER BY'));
  assert.match(countQuery.sql, /lots\.status = \?/);
  assert.match(countQuery.sql, /action = \?/);
  assert.doesNotMatch(countQuery.sql, /action = 'confirm_ng'/);
  assert.doesNotMatch(listQuery.sql, /action = 'confirm_ng'/);
  assert.deepEqual(countQuery.params, ['ng', 'confirm_ng']);
  assert.deepEqual(listQuery.params, ['confirm_ng', 'ng', 'confirm_ng']);
});

test('results keeps all-dates view paginated instead of allowing all page size', async () => {
  const executed = [];
  const connection = {
    execute: async (sql, params) => {
      executed.push({ sql, params });

      if (sql.includes('COUNT(*)')) {
        return [[{ total_items: 75 }]];
      }

      return [[]];
    }
  };

  const result = await getResultsLots({
    tab: 'approved',
    dateMode: 'all',
    pageSize: 'all',
    connection
  });

  const listQuery = executed.find((item) => item.sql.includes('ORDER BY'));
  assert.match(listQuery.sql, /LIMIT 50 OFFSET 0/);
  assert.equal(result.summary.pageSize, '50');
  assert.equal(result.summary.totalPages, 2);
});
