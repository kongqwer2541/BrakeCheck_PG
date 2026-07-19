import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

process.env.SESSION_SECRET = 'test_session_secret_at_least_32_chars';

const { db, postgresDb } = await import('../config/database.js');
const {
  canEditCompletedPackingInspection,
  canSavePackingInspectionForLot,
  getPackingInspection,
  getNextLotStatusForPacking,
  getPackingReferenceFromInspection,
  getPackingReferenceFromLot,
  getPackingReferenceFromProductionCode,
  hasPackingFailResult,
  savePackingInspectionDraft,
  validatePackingResultsForComplete
} = await import('./packing-inspection.service.js');

test('packing inspection service uses PostgreSQL transaction and upsert syntax', async () => {
  const source = await readFile(new URL('./packing-inspection.service.js', import.meta.url), 'utf8');

  assert.match(source, /import \{ postgresDb \}/);
  assert.match(source, /withPostgresTransaction/);
  assert.match(source, /ON CONFLICT \(lot_id\) DO UPDATE/i);
  assert.doesNotMatch(source, /\.execute\(|ON DUPLICATE KEY|CURDATE\(\)/);
});

test('loads packing inspection details through PostgreSQL', async (t) => {
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

    if (/FROM lots/i.test(sql)) {
      return {
        rows: [{ id: 7, lot_number: 'LOT-1', lot_packing: 'PACK-1', quantity: 100, status: 'waiting_pack' }]
      };
    }

    return { rows: [] };
  };

  const result = await getPackingInspection({ lotNumber: 'LOT-1' });

  assert.equal(result.ok, true);
  assert.equal(result.packingReference.value, 'PACK-1');
  assert.equal(calls.some(({ sql }) => sql.includes('?')), false);
});

test('saves a packing draft in one PostgreSQL transaction', async (t) => {
  const originalLegacyGetConnection = db.getConnection;
  const originalConnect = postgresDb.connect;
  const calls = [];

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

      if (/FROM lots/i.test(sql)) {
        return {
          rows: [{ id: 7, lot_number: 'LOT-1', lot_packing: 'PACK-1', quantity: 100, status: 'waiting_pack' }]
        };
      }
      if (/FROM packing_inspections/i.test(sql)) {
        if (/FOR UPDATE/i.test(sql)) {
          return { rows: [] };
        }
        return { rows: [{ id: 4, status: 'draft', results_data: { topics: [] } }] };
      }
      if (/FROM form_config/i.test(sql)) {
        return { rows: [] };
      }

      return { rows: [], rowCount: 1 };
    },
    release: () => {}
  });

  const result = await savePackingInspectionDraft({
    lotNumber: 'LOT-1',
    input: { resultsData: { topics: [] } },
    user: { id: 1, role: 'officer', fullName: 'QC Test' }
  });

  assert.equal(result.ok, true);
  assert.equal(calls[0].sql, 'BEGIN');
  assert.equal(calls.at(-1).sql, 'COMMIT');
  const lockedInspectionQuery = calls.find(({ sql }) => (
    /FROM packing_inspections/i.test(sql) && /FOR UPDATE/i.test(sql)
  ));
  assert.ok(lockedInspectionQuery);
  assert.match(lockedInspectionQuery.sql, /FOR UPDATE OF packing_inspections/i);
  assert.ok(calls.some(({ sql }) => /ON CONFLICT \(lot_id\) DO UPDATE/i.test(sql)));
  assert.equal(calls.some(({ sql }) => sql.includes('?')), false);
});

const formConfig = [
  { id: 1, topicName: 'เงื่อนไขการบรรจุ', inputType: 'pass_fail' },
  { id: 2, topicName: 'จำนวนชิ้น / ชุด', inputType: 'pass_fail' }
];

test('complete packing inspection requires every topic result', () => {
  assert.throws(
    () => validatePackingResultsForComplete({
      resultsData: {
        meta: { inspectionNote: '' },
        topics: [{ topicId: 1, topicName: 'เงื่อนไขการบรรจุ', value: 'pass' }]
      },
      formConfig
    }),
    /กรุณาเลือกผลตรวจ/
  );
});

test('packing numeric topics accept numeric values and do not count as fail', () => {
  const numericConfig = [
    { id: 1, topicName: 'Box weight', inputType: 'number', decimalPlaces: 2 }
  ];
  const resultsData = {
    meta: { inspectionNote: '' },
    topics: [{ topicId: 1, topicName: 'Box weight', value: '12.50' }]
  };

  assert.doesNotThrow(() => validatePackingResultsForComplete({
    resultsData,
    formConfig: numericConfig
  }));
  assert.equal(hasPackingFailResult(resultsData), false);
});

test('packing numeric topics reject values with too many decimals', () => {
  assert.throws(
    () => validatePackingResultsForComplete({
      resultsData: {
        meta: { inspectionNote: '' },
        topics: [{ topicId: 1, topicName: 'Box weight', value: '12.555' }]
      },
      formConfig: [{ id: 1, topicName: 'Box weight', inputType: 'number', decimalPlaces: 2 }]
    }),
    /Box weight/
  );
});

test('packing numeric topics require exact configured decimal places', () => {
  assert.throws(
    () => validatePackingResultsForComplete({
      resultsData: {
        meta: { inspectionNote: '' },
        topics: [{ topicId: 1, topicName: 'Box weight', value: '12.5' }]
      },
      formConfig: [{ id: 1, topicName: 'Box weight', inputType: 'number', decimalPlaces: 2 }]
    }),
    /Box weight/
  );

  assert.doesNotThrow(() => validatePackingResultsForComplete({
    resultsData: {
      meta: { inspectionNote: '' },
      topics: [{ topicId: 1, topicName: 'Box weight', value: '12.50' }]
    },
    formConfig: [{ id: 1, topicName: 'Box weight', inputType: 'number', decimalPlaces: 2 }]
  }));
});

test('complete packing inspection requires note when any topic fails', () => {
  assert.throws(
    () => validatePackingResultsForComplete({
      resultsData: {
        meta: { inspectionNote: '' },
        topics: [
          { topicId: 1, topicName: 'เงื่อนไขการบรรจุ', value: 'pass' },
          { topicId: 2, topicName: 'จำนวนชิ้น / ชุด', value: 'fail' }
        ]
      },
      formConfig
    }),
    /กรุณากรอกหมายเหตุ/
  );
});

test('packing status sends passing lots to approval and failing lots to ng', () => {
  const passing = {
    topics: [
      { topicId: 1, value: 'pass' },
      { topicId: 2, value: 'pass' }
    ]
  };
  const failing = {
    topics: [
      { topicId: 1, value: 'pass' },
      { topicId: 2, value: 'fail' }
    ]
  };

  assert.equal(hasPackingFailResult(passing), false);
  assert.equal(hasPackingFailResult(failing), true);
  assert.equal(getNextLotStatusForPacking('draft', passing), 'temp');
  assert.equal(getNextLotStatusForPacking('draft', failing), 'ng');
  assert.equal(getNextLotStatusForPacking('completed', passing), 'waiting_approve');
  assert.equal(getNextLotStatusForPacking('completed', failing), 'ng');
});

test('packing reference uses Lot ผลิต from Excel when available', () => {
  assert.equal(getPackingReferenceFromLot({ lot_packing: '-' }), null);
  assert.equal(getPackingReferenceFromLot({ lot_packing: '' }), null);
  assert.deepEqual(getPackingReferenceFromLot({ lot_packing: 'PACK-001' }), {
    value: 'PACK-001',
    source: 'lot_packing',
    sourceLabel: 'Lot ผลิตจาก Excel'
  });
});

test('packing reference falls back to production code from dimension inspection', () => {
  assert.equal(getPackingReferenceFromProductionCode('-'), null);
  assert.equal(getPackingReferenceFromProductionCode(''), null);
  assert.deepEqual(getPackingReferenceFromProductionCode(' 595658 '), {
    value: '595658',
    source: 'dimension_production_code',
    sourceLabel: 'รหัสผลิตจากฟอร์มตรวจมิติ'
  });
});

test('saved packing reference snapshot is readable from saved inspection data', () => {
  assert.deepEqual(getPackingReferenceFromInspection({
    results_data: JSON.stringify({
      meta: {
        packingReferenceValue: '595658',
        packingReferenceSource: 'dimension_production_code',
        packingReferenceSourceLabel: 'รหัสผลิตจากฟอร์มตรวจมิติ'
      },
      topics: []
    })
  }), {
    value: '595658',
    source: 'dimension_production_code',
    sourceLabel: 'รหัสผลิตจากฟอร์มตรวจมิติ'
  });
});

test('packing save is allowed only in the expected lot workflow states', () => {
  assert.equal(canSavePackingInspectionForLot({
    lotStatus: 'waiting_pack',
    inspectionStatus: null,
    userRole: 'officer'
  }), true);
  assert.equal(canSavePackingInspectionForLot({
    lotStatus: 'temp',
    inspectionStatus: 'draft',
    userRole: 'officer'
  }), true);
  assert.equal(canSavePackingInspectionForLot({
    lotStatus: 'ng',
    inspectionStatus: 'draft',
    userRole: 'officer'
  }), true);
  assert.equal(canSavePackingInspectionForLot({
    lotStatus: 'pending',
    inspectionStatus: null,
    userRole: 'officer'
  }), false);
});

test('completed packing inspection can be edited only by assistant or head', () => {
  assert.equal(canEditCompletedPackingInspection({ role: 'officer' }), false);
  assert.equal(canEditCompletedPackingInspection({ role: 'assistant' }), true);
  assert.equal(canEditCompletedPackingInspection({ role: 'head' }), true);
  assert.equal(canSavePackingInspectionForLot({
    lotStatus: 'waiting_approve',
    inspectionStatus: 'completed',
    userRole: 'officer'
  }), false);
  assert.equal(canSavePackingInspectionForLot({
    lotStatus: 'waiting_approve',
    inspectionStatus: 'completed',
    userRole: 'assistant'
  }), true);
});
