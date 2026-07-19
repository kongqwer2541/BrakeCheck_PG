import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

process.env.SESSION_SECRET = 'test_session_secret_at_least_32_chars';

const { db, postgresDb } = await import('../config/database.js');
const {
  canEditCompletedDimensionInspection,
  completeDimensionInspection,
  getDimensionInspection,
  saveDimensionInspectionDraft,
  validateInstrumentCodes,
  shouldMeasurePiece,
  shouldSkipTopicByWorkType
} = await import('./dimension-inspection.service.js');

test('complete dimension inspection requires note when any result fails', async (t) => {
  const originalConnect = postgresDb.connect;

  t.after(() => {
    postgresDb.connect = originalConnect;
  });

  postgresDb.connect = async () => ({
    query: async (sql) => {
      if (/FROM lots/i.test(sql)) {
        return {
          rows: [{
            id: 7,
            lot_number: 'LOT-1',
            quantity: 100,
            sample_count: 1,
            status: 'pending'
          }]
        };
      }
      if (/FROM dimension_inspections/i.test(sql)) {
        return { rows: [] };
      }
      if (/FROM sampling_rules/i.test(sql)) {
        return { rows: [{ qty_min: 1, qty_max: null, sample_count: 1 }] };
      }
      if (/FROM form_config/i.test(sql)) {
        return {
          rows: [{
            id: 1,
            topic_name: 'Final result',
            input_count: 1,
            decimal_places: 0,
            input_type: 'pass_fail',
            measure_scope: 'all',
            measure_pieces: 'all',
            rule_key: null,
            display_order: 1
          }]
        };
      }

      return { rows: [], rowCount: 1 };
    },
    release: () => {}
  });

  await assert.rejects(
    () => completeDimensionInspection({
      lotNumber: 'LOT-1',
      input: {
        inspectionDate: '2026-07-19',
        shift: '1',
        instrumentCodes: ['A-01-001', 'A-01-002', 'A-07-003', 'A-01-004', 'A-01-005'],
        brakeType: 'normal',
        brakeModel: 'no_hole',
        sampleCount: 1,
        piecesData: {
          meta: { inspectionNote: '' },
          topics: [{
            topicId: 1,
            topicName: 'Final result',
            rows: [{ pieceNo: 1, values: ['fail'] }]
          }]
        }
      },
      user: { id: 1, role: 'officer', fullName: 'QC Test' }
    }),
    /กรุณากรอกหมายเหตุเมื่อมีผลตรวจไม่ผ่าน/
  );
});

test('dimension inspection service uses PostgreSQL transaction and upsert syntax', async () => {
  const source = await readFile(new URL('./dimension-inspection.service.js', import.meta.url), 'utf8');

  assert.match(source, /import \{ postgresDb \}/);
  assert.match(source, /withPostgresTransaction/);
  assert.match(source, /ON CONFLICT \(lot_id\) DO UPDATE/i);
  assert.doesNotMatch(source, /\.execute\(|ON DUPLICATE KEY|ER_BAD_FIELD_ERROR|ER_NO_SUCH_TABLE|42703/);
});

test('loads dimension inspection details through PostgreSQL', async (t) => {
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
      return { rows: [{ id: 7, lot_number: 'LOT-1', quantity: 100, status: 'pending' }] };
    }
    if (/dimension_instrument_prefixes/i.test(sql)) {
      return {
        rows: Array.from({ length: 5 }, (_, index) => ({ slot_no: index + 1, prefix: 'A-01-' }))
      };
    }
    if (/sampling_rules/i.test(sql)) {
      return { rows: [{ qty_min: 1, qty_max: null, sample_count: 5 }] };
    }

    return { rows: [] };
  };

  const result = await getDimensionInspection({ lotNumber: 'LOT-1' });

  assert.equal(result.ok, true);
  assert.equal(result.lot.lotNumber, 'LOT-1');
  assert.equal(calls.some(({ sql }) => sql.includes('?')), false);
});

test('saves a dimension draft in one PostgreSQL transaction', async (t) => {
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
        return { rows: [{ id: 7, lot_number: 'LOT-1', quantity: 100, sample_count: 5, status: 'pending' }] };
      }
      if (/FROM dimension_inspections/i.test(sql)) {
        if (/FOR UPDATE/i.test(sql)) {
          return { rows: [] };
        }
        return { rows: [{ id: 3, status: 'draft', pieces_data: { topics: [] } }] };
      }
      if (/FROM sampling_rules/i.test(sql)) {
        return { rows: [{ qty_min: 1, qty_max: null, sample_count: 5 }] };
      }
      if (/FROM form_config/i.test(sql)) {
        return { rows: [] };
      }

      return { rows: [], rowCount: 1 };
    },
    release: () => {}
  });

  const result = await saveDimensionInspectionDraft({
    lotNumber: 'LOT-1',
    input: {
      inspectionDate: '',
      shift: '',
      instrumentCodes: ['', '', '', '', ''],
      piecesData: { topics: [] }
    },
    user: { id: 1, role: 'officer', fullName: 'QC Test' }
  });

  assert.equal(result.ok, true);
  assert.equal(calls[0].sql, 'BEGIN');
  assert.equal(calls.at(-1).sql, 'COMMIT');
  assert.ok(calls.some(({ sql }) => /ON CONFLICT \(lot_id\) DO UPDATE/i.test(sql)));
  assert.equal(calls.some(({ sql }) => sql.includes('?')), false);
});

test('hole inspection rule skips topics by rule_key without depending on Thai topic name', () => {
  const topic = {
    topicName: 'หัวข้อใหม่จาก Settings',
    ruleKey: 'hole_inspection'
  };

  assert.equal(shouldSkipTopicByWorkType(topic, { brakeType: 'normal', brakeModel: 'no_hole' }), true);
  assert.equal(shouldSkipTopicByWorkType(topic, { brakeType: 'sheet', brakeModel: 'drilled_bored' }), true);
  assert.equal(shouldSkipTopicByWorkType(topic, { brakeType: 'normal', brakeModel: 'drilled_bored' }), false);
});

test('hole inspection rule keeps Thai topic name fallback for old config data', () => {
  const topic = {
    topicName: 'ขนาดรูเจาะ/รูคว้าน'
  };

  assert.equal(shouldSkipTopicByWorkType(topic, { brakeType: 'sheet', brakeModel: 'drilled_bored' }), true);
});

test('custom measure pieces support comma list and ranges', () => {
  const topic = { measurePieces: '1,3-5' };

  assert.equal(shouldMeasurePiece(topic, 1), true);
  assert.equal(shouldMeasurePiece(topic, 2), false);
  assert.equal(shouldMeasurePiece(topic, 3), true);
  assert.equal(shouldMeasurePiece(topic, 5), true);
});

test('dimension instrument codes accept any A-00-000 code without slot prefix lock', () => {
  const codes = validateInstrumentCodes(
    ['A-02-111', 'A-03-111', 'A-05-111', '-', 'A-01-125'],
    true
  );

  assert.deepEqual(codes, ['A-02-111', 'A-03-111', 'A-05-111', '-', 'A-01-125']);
});

test('dimension instrument codes allow blank draft codes without internal error', () => {
  const codes = validateInstrumentCodes(
    ['A-02-111', '', null, '-', ''],
    false
  );

  assert.deepEqual(codes, ['A-02-111', '', '', '-', '']);
});

test('officer can edit a completed dimension inspection only after send back', () => {
  assert.equal(canEditCompletedDimensionInspection({ role: 'officer' }, 'waiting_approve'), false);
  assert.equal(canEditCompletedDimensionInspection({ role: 'officer' }, 'need_fix'), true);
  assert.equal(canEditCompletedDimensionInspection({ role: 'assistant' }, 'waiting_approve'), true);
  assert.equal(canEditCompletedDimensionInspection({ role: 'head' }, 'approved'), true);
});
