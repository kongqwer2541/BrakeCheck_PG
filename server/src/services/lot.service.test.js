import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

process.env.SESSION_SECRET = 'test_session_secret_at_least_32_chars';

const { db, postgresDb } = await import('../config/database.js');
const { hasDimensionFailResult } = await import('./dimension-inspection.service.js');
const { hasPackingFailResult } = await import('./packing-inspection.service.js');
const {
  buildApprovalQueueLimitClause,
  createManualLot,
  getApprovalQueue,
  getLotDetail,
  getApprovalWorkflowTransition,
  isApprovalQueueStatus,
  requireNoDuplicateConfirmNg,
  validateApprovalQueueTab
} = await import('./lot.service.js');

test('approval queue contains only waiting approval and NG work', () => {
  assert.equal(isApprovalQueueStatus('waiting_approve'), true);
  assert.equal(isApprovalQueueStatus('ng'), true);
  assert.equal(isApprovalQueueStatus('approved'), false);
  assert.equal(isApprovalQueueStatus('need_fix'), false);
});

test('approval queue tab defaults to waiting approval', () => {
  assert.equal(validateApprovalQueueTab('waiting_approve'), 'waiting_approve');
  assert.equal(validateApprovalQueueTab('ng'), 'ng');
  assert.equal(validateApprovalQueueTab(''), 'waiting_approve');
  assert.throws(() => validateApprovalQueueTab('approved'), /แท็บคิวตรวจและอนุมัติไม่ถูกต้อง/);
});

test('approval queue limit clause uses validated numbers for PostgreSQL', () => {
  assert.equal(buildApprovalQueueLimitClause(50, 0), 'LIMIT 50 OFFSET 0');
  assert.equal(buildApprovalQueueLimitClause(50, 100), 'LIMIT 50 OFFSET 100');
  assert.equal(buildApprovalQueueLimitClause('all', 0), '');
  assert.doesNotMatch(buildApprovalQueueLimitClause(50, 0), /\?/);
});

test('lot service uses PostgreSQL without MySQL pool APIs', async () => {
  const source = await readFile(new URL('./lot.service.js', import.meta.url), 'utf8');

  assert.match(source, /import \{ postgresDb \}/);
  assert.doesNotMatch(source, /\bdb\.execute|\.beginTransaction\(|\.execute\(/);
});

test('loads lot details with PostgreSQL parameters', async (t) => {
  const originalLegacyExecute = db.execute;
  const originalQuery = postgresDb.query;
  let executedSql = '';
  let executedParams = [];

  t.after(() => {
    db.execute = originalLegacyExecute;
    postgresDb.query = originalQuery;
  });

  db.execute = async () => {
    throw new Error('Legacy MySQL pool was used.');
  };
  postgresDb.query = async (sql, params) => {
    executedSql = sql;
    executedParams = params;
    return {
      rows: [{
        id: 1,
        lot_number: 'LOT-001',
        lot_pack_barcode: '10001',
        lot_packing: '-',
        production_date: '2026-07-18',
        quantity: 100,
        sample_count: 5,
        status: 'pending',
        import_source: 'manual'
      }]
    };
  };

  const result = await getLotDetail({ lotNumber: 'LOT-001' });

  assert.equal(result.lot.lotNumber, 'LOT-001');
  assert.match(executedSql, /WHERE lot_number = \$1/i);
  assert.doesNotMatch(executedSql, /\?/);
  assert.deepEqual(executedParams, ['LOT-001']);
});

test('creates a manual lot in one PostgreSQL transaction', async (t) => {
  const originalLegacyGetConnection = db.getConnection;
  const originalConnect = postgresDb.connect;
  const calls = [];
  let released = false;

  t.after(() => {
    db.getConnection = originalLegacyGetConnection;
    postgresDb.connect = originalConnect;
  });

  db.getConnection = async () => {
    throw new Error('Legacy MySQL pool was used.');
  };
  postgresDb.connect = async () => ({
    query: async (sql, params = []) => {
      calls.push({ sql, params });

      if (/SELECT id, lot_number/i.test(sql)) {
        return { rows: [] };
      }
      if (/FROM sampling_rules/i.test(sql)) {
        return { rows: [{ sample_count: 5 }] };
      }

      return { rows: [], rowCount: 1 };
    },
    release: () => {
      released = true;
    }
  });

  const result = await createManualLot({
    input: {
      lotNumber: 'LOT-001',
      lotPackBarcode: '10001',
      lotPacking: '',
      modelName: 'Model A',
      dimension: '10x20',
      aciGrade: 'A',
      productionDate: '2026-07-18',
      quantity: 100,
      manualReason: 'Phase 5.2 test'
    },
    user: { id: 1 }
  });

  assert.equal(result.lot.sampleCount, 5);
  assert.equal(calls[0].sql, 'BEGIN');
  assert.equal(calls.at(-1).sql, 'COMMIT');
  assert.equal(released, true);
  assert.ok(calls.some(({ sql }) => /VALUES \(\$1, \$2/i.test(sql)));
  assert.equal(calls.some(({ sql }) => sql.includes('?')), false);
});

test('rejects a manual lot without an authenticated actor before database access', async (t) => {
  const originalConnect = postgresDb.connect;
  let databaseAccessed = false;

  t.after(() => {
    postgresDb.connect = originalConnect;
  });

  postgresDb.connect = async () => {
    databaseAccessed = true;
    throw new Error('Database must not be accessed without an actor.');
  };

  await assert.rejects(
    () => createManualLot({
      input: {
        lotNumber: 'LOT-001',
        lotPackBarcode: '10001',
        modelName: 'Model A',
        dimension: '10x20',
        aciGrade: 'A',
        productionDate: '2026-07-18',
        quantity: 100,
        manualReason: 'Phase 5.2 test'
      }
    }),
    (error) => error.statusCode === 401
  );

  assert.equal(databaseAccessed, false);
});

test('maps PostgreSQL duplicate lot errors to conflict', async (t) => {
  const originalLegacyGetConnection = db.getConnection;
  const originalConnect = postgresDb.connect;

  t.after(() => {
    db.getConnection = originalLegacyGetConnection;
    postgresDb.connect = originalConnect;
  });

  db.getConnection = async () => {
    throw new Error('Legacy MySQL pool was used.');
  };
  postgresDb.connect = async () => ({
    query: async (sql) => {
      if (/SELECT id, lot_number/i.test(sql)) {
        return { rows: [] };
      }
      if (/FROM sampling_rules/i.test(sql)) {
        return { rows: [{ sample_count: 5 }] };
      }
      if (/INSERT INTO lots/i.test(sql)) {
        const error = new Error('duplicate');
        error.code = '23505';
        throw error;
      }
      return { rows: [] };
    },
    release: () => {}
  });

  await assert.rejects(
    () => createManualLot({
      input: {
        lotNumber: 'LOT-001',
        lotPackBarcode: '10001',
        modelName: 'Model A',
        dimension: '10x20',
        aciGrade: 'A',
        productionDate: '2026-07-18',
        quantity: 100,
        manualReason: 'Phase 5.2 test'
      },
      user: { id: 1 }
    }),
    (error) => error.statusCode === 409
  );
});

test('approval queue search remains case-insensitive on PostgreSQL', async (t) => {
  const originalQuery = postgresDb.query;
  const calls = [];

  t.after(() => {
    postgresDb.query = originalQuery;
  });

  postgresDb.query = async (sql, params = []) => {
    calls.push({ sql, params });
    return { rows: [{ total: 0 }] };
  };

  await getApprovalQueue({
    tab: 'waiting_approve',
    date: '',
    search: 'Model-A',
    page: 1,
    pageSize: 50
  });

  const listQuery = calls.find(({ sql }) => /FROM lots[\s\S]*LEFT JOIN/i.test(sql));
  assert.ok(listQuery);
  assert.match(listQuery.sql, /lot_number ILIKE \$2/i);
  assert.match(listQuery.sql, /model_name ILIKE \$5/i);
  assert.deepEqual(listQuery.params, [
    'waiting_approve',
    '%Model-A%',
    '%Model-A%',
    '%Model-A%',
    '%Model-A%'
  ]);
});

test('approval queue search treats PostgreSQL wildcard characters as text', async (t) => {
  const originalQuery = postgresDb.query;
  const calls = [];

  t.after(() => {
    postgresDb.query = originalQuery;
  });

  postgresDb.query = async (sql, params = []) => {
    calls.push({ sql, params });
    return { rows: [{ total: 0 }] };
  };

  await getApprovalQueue({
    tab: 'waiting_approve',
    date: '',
    search: 'A%_\\B',
    page: 1,
    pageSize: 50
  });

  const listQuery = calls.find(({ sql }) => /FROM lots[\s\S]*LEFT JOIN/i.test(sql));
  assert.ok(listQuery);
  assert.equal(listQuery.sql.split("ESCAPE '\\'").length - 1, 4);
  assert.deepEqual(listQuery.params, [
    'waiting_approve',
    '%A\\%\\_\\\\B%',
    '%A\\%\\_\\\\B%',
    '%A\\%\\_\\\\B%',
    '%A\\%\\_\\\\B%'
  ]);
});

test('approval queue and badge require acknowledgement from the current NG cycle', async (t) => {
  const originalQuery = postgresDb.query;
  const calls = [];

  t.after(() => {
    postgresDb.query = originalQuery;
  });

  postgresDb.query = async (sql, params = []) => {
    calls.push({ sql, params });
    return { rows: [{ total: 0 }] };
  };

  await getApprovalQueue({
    tab: 'ng',
    date: '',
    search: '',
    page: 1,
    pageSize: 50
  });

  const countQuery = calls[0];
  const listQuery = calls[1];
  const badgeQuery = calls[2];

  assert.match(countQuery.sql, /NOT EXISTS[\s\S]*FROM lot_audit_logs[\s\S]*action = \$2/i);
  assert.match(listQuery.sql, /NOT EXISTS[\s\S]*FROM lot_audit_logs[\s\S]*action = \$2/i);
  assert.match(countQuery.sql, /reviewed_ng\.action = 'review_ng'[\s\S]*reviewed_ng\.id > acknowledged_ng\.id/i);
  assert.match(listQuery.sql, /reviewed_ng\.action = 'review_ng'[\s\S]*reviewed_ng\.id > acknowledged_ng\.id/i);
  assert.deepEqual(countQuery.params, ['ng', 'confirm_ng']);
  assert.deepEqual(listQuery.params, ['ng', 'confirm_ng']);
  assert.match(badgeQuery.sql, /NOT EXISTS[\s\S]*FROM lot_audit_logs[\s\S]*action = \$1/i);
  assert.match(badgeQuery.sql, /reviewed_ng\.action = 'review_ng'[\s\S]*reviewed_ng\.id > acknowledged_ng\.id/i);
  assert.deepEqual(badgeQuery.params, ['confirm_ng']);
});

test('approval workflow uses shared inspection fail helpers', () => {
  assert.equal(hasDimensionFailResult({
    topics: [{ rows: [{ values: ['pass', 'fail'] }] }]
  }), true);
  assert.equal(hasPackingFailResult({
    topics: [{ value: 'fail' }]
  }), true);
});

test('approval workflow actions move only from allowed statuses', () => {
  assert.deepEqual(getApprovalWorkflowTransition('approve', 'waiting_approve'), {
    action: 'approve',
    nextStatus: 'approved',
    requiresReason: false,
    defaultReason: 'อนุมัติ Lot'
  });
  assert.deepEqual(getApprovalWorkflowTransition('cancel_approve', 'approved'), {
    action: 'cancel_approve',
    nextStatus: 'waiting_approve',
    requiresReason: true,
    defaultReason: ''
  });
  assert.deepEqual(getApprovalWorkflowTransition('send_back', 'waiting_approve'), {
    action: 'send_back',
    nextStatus: 'need_fix',
    requiresReason: true,
    defaultReason: ''
  });
  assert.deepEqual(getApprovalWorkflowTransition('review_ng', 'ng'), {
    action: 'review_ng',
    nextStatus: 'need_fix',
    requiresReason: true,
    defaultReason: ''
  });

  assert.throws(() => getApprovalWorkflowTransition('approve', 'ng'), /สถานะ NG/);
  assert.throws(() => getApprovalWorkflowTransition('send_back', 'approved'), /ต้องยกเลิกอนุมัติก่อน/);
});

test('confirm NG keeps NG status and records acknowledgement action', () => {
  assert.deepEqual(getApprovalWorkflowTransition('confirm_ng', 'ng'), {
    action: 'confirm_ng',
    nextStatus: 'ng',
    requiresReason: false,
    defaultReason: 'รับทราบ NG'
  });

  assert.throws(
    () => getApprovalWorkflowTransition('confirm_ng', 'waiting_approve'),
    /รออนุมัติ/
  );
});

test('confirm NG rejects duplicate acknowledgement audit', () => {
  assert.doesNotThrow(() => requireNoDuplicateConfirmNg('confirm_ng', 0));
  assert.doesNotThrow(() => requireNoDuplicateConfirmNg('approve', 1));
  assert.throws(
    () => requireNoDuplicateConfirmNg('confirm_ng', 1),
    /รับทราบ NG แล้ว/
  );
});
