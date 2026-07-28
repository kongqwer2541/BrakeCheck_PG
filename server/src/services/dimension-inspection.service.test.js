import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

process.env.SESSION_SECRET = 'test_session_secret_at_least_32_chars';

const { db, postgresDb } = await import('../config/database.js');
const dimensionInspectionService = await import('./dimension-inspection.service.js');
const {
  canEditCompletedDimensionInspection,
  completeDimensionInspection,
  getDimensionInspection,
  saveDimensionInspectionDraft,
  validateInstrumentCodes,
  shouldMeasurePiece,
  shouldSkipTopicByWorkType
} = dimensionInspectionService;

test('dimension draft merge preserves and explicitly clears the selected NG topic', () => {
  assert.equal(typeof dimensionInspectionService.mergeDraftPiecesData, 'function');

  const formConfig = [
    {
      id: 1,
      topicName: 'Width',
      inputCount: 1,
      inputType: 'number',
      measurePieces: 'all'
    },
    {
      id: 2,
      topicName: 'Final result',
      inputCount: 1,
      inputType: 'pass_fail',
      measurePieces: 'all'
    }
  ];
  const existingPiecesData = {
    meta: {
      inspectionNote: 'old note',
      ngStop: { topicId: 1, topicName: 'Width' }
    },
    topics: [
      {
        topicId: 1,
        topicName: 'Width',
        rows: [{ pieceNo: 1, values: ['10.00'] }]
      }
    ]
  };
  const incomingWithNg = {
    meta: {
      inspectionNote: 'new note',
      ngStop: { topicId: 1, topicName: 'Width' }
    },
    topics: [
      {
        topicId: 2,
        topicName: 'Final result',
        rows: [{ pieceNo: 1, values: ['fail'] }]
      }
    ]
  };

  const preserved = dimensionInspectionService.mergeDraftPiecesData(
    existingPiecesData,
    incomingWithNg,
    formConfig,
    1
  );
  assert.deepEqual(preserved.meta.ngStop, { topicId: 1, topicName: 'Width' });
  assert.equal(preserved.meta.inspectionNote, 'new note');

  const cleared = dimensionInspectionService.mergeDraftPiecesData(
    preserved,
    {
      meta: { inspectionNote: 'changed to pass' },
      topics: [
        {
          topicId: 2,
          topicName: 'Final result',
          rows: [{ pieceNo: 1, values: ['pass'] }]
        }
      ]
    },
    formConfig,
    1
  );
  assert.equal(cleared.meta.ngStop, undefined);
});

test('dimension final result uses its stable identity instead of the last pass-fail topic', () => {
  assert.equal(typeof dimensionInspectionService.getDimensionFinalResultTopic, 'function');

  const finalResult = dimensionInspectionService.getDimensionFinalResultTopic([
    { id: 1, topicName: 'Width', inputType: 'number' },
    { id: 2, topicName: 'Final result', inputType: 'pass_fail' },
    { id: 3, topicName: 'Surface condition', inputType: 'pass_fail' }
  ]);

  assert.equal(finalResult.id, 2);
});

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
          rows: [
            {
              id: 1,
              topic_name: 'Width',
              input_count: 1,
              decimal_places: 2,
              input_type: 'number',
              measure_scope: 'all',
              measure_pieces: 'all',
              rule_key: null,
              display_order: 1
            },
            {
              id: 2,
              topic_name: 'Final result',
              input_count: 1,
              decimal_places: 0,
              input_type: 'pass_fail',
              measure_scope: 'all',
              measure_pieces: 'all',
              rule_key: null,
              display_order: 2
            }
          ]
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
          meta: {
            inspectionNote: '',
            ngStop: { topicId: 1, topicName: 'Width' }
          },
          topics: [
            {
              topicId: 1,
              topicName: 'Width',
              rows: [{ pieceNo: 1, values: ['10.00'] }]
            },
            {
              topicId: 2,
              topicName: 'Final result',
              rows: [{ pieceNo: 1, values: ['fail'] }]
            }
          ]
        }
      },
      user: { id: 1, role: 'officer', fullName: 'QC Test' }
    }),
    /กรุณากรอกหมายเหตุเมื่อมีผลตรวจไม่ผ่าน/
  );
});

test('complete dimension inspection allows remaining topics to be skipped after an explicit NG stop', async (t) => {
  const originalConnect = postgresDb.connect;
  let upsertParams = null;

  t.after(() => {
    postgresDb.connect = originalConnect;
  });

  postgresDb.connect = async () => ({
    query: async (sql, params = []) => {
      if (/FROM lots/i.test(sql)) {
        return {
          rows: [{
            id: 7,
            lot_number: 'LOT-NG-STOP',
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
          rows: [
            {
              id: 1,
              topic_name: 'Width',
              input_count: 1,
              decimal_places: 2,
              input_type: 'number',
              measure_pieces: 'all',
              rule_key: null,
              display_order: 1
            },
            {
              id: 2,
              topic_name: 'Length',
              input_count: 2,
              decimal_places: 1,
              input_type: 'number',
              measure_pieces: 'all',
              rule_key: null,
              display_order: 2
            },
            {
              id: 3,
              topic_name: 'Thickness',
              input_count: 2,
              decimal_places: 2,
              input_type: 'number',
              measure_pieces: 'all',
              rule_key: null,
              display_order: 3
            },
            {
              id: 4,
              topic_name: 'Final result',
              input_count: 1,
              decimal_places: 0,
              input_type: 'pass_fail',
              measure_pieces: 'all',
              rule_key: null,
              display_order: 4
            }
          ]
        };
      }
      if (/INSERT INTO dimension_inspections/i.test(sql)) {
        upsertParams = params;
      }

      return { rows: [], rowCount: 1 };
    },
    release: () => {}
  });

  const completedInput = {
    inspectionDate: '2026-07-23',
    shift: '1',
    instrumentCodes: ['A-01-001', 'A-01-002', 'A-07-003', 'A-01-004', 'A-01-005'],
    brakeType: 'normal',
    brakeModel: 'drilled_bored',
    rivetHoleThickness: '2',
    sampleCount: 1,
    piecesData: {
      meta: {
        inspectionNote: 'Length is outside tolerance',
        ngStop: {
          topicId: 2,
          topicName: 'Length'
        }
      },
      topics: [
        {
          topicId: 1,
          topicName: 'Width',
          rows: [{ pieceNo: 1, values: ['10.00'] }]
        },
        {
          topicId: 2,
          topicName: 'Length',
          rows: [{ pieceNo: 1, values: ['65.6', '65.7'] }]
        },
        {
          topicId: 3,
          topicName: 'Thickness',
          rows: [{ pieceNo: 1, values: ['', ''] }]
        },
        {
          topicId: 4,
          topicName: 'Final result',
          rows: [{ pieceNo: 1, values: ['fail'] }]
        }
      ]
    }
  };
  const result = await completeDimensionInspection({
    lotNumber: 'LOT-NG-STOP',
    input: completedInput,
    user: { id: 1, role: 'officer', fullName: 'QC Test' }
  });

  assert.equal(result.lot.status, 'ng');
  assert.ok(upsertParams);

  const savedPiecesData = JSON.parse(upsertParams[12]);
  assert.equal(savedPiecesData.meta.ngStop.topicId, 2);
  assert.equal(savedPiecesData.meta.inspectionNote, 'Length is outside tolerance');
  assert.deepEqual(savedPiecesData.topics[1].rows[0].values, ['65.6', '65.7']);
  assert.deepEqual(savedPiecesData.topics[2].rows[0].values, ['-', '-']);
  assert.deepEqual(savedPiecesData.topics[3].rows[0].values, ['fail']);

  const dashWithoutNgStop = structuredClone(completedInput);
  delete dashWithoutNgStop.piecesData.meta.ngStop;
  dashWithoutNgStop.piecesData.topics[2].rows[0].values = ['-', '-'];
  await assert.rejects(
    () => saveDimensionInspectionDraft({
      lotNumber: 'LOT-NG-STOP',
      input: dashWithoutNgStop,
      user: { id: 1, role: 'officer', fullName: 'QC Test' }
    }),
    (error) => error?.statusCode === 400 && error.message.includes('Thickness')
  );

  const ngStopWithoutMeasuredValue = structuredClone(completedInput);
  ngStopWithoutMeasuredValue.piecesData.topics[1].rows[0].values = ['', ''];
  await assert.rejects(
    () => completeDimensionInspection({
      lotNumber: 'LOT-NG-STOP',
      input: ngStopWithoutMeasuredValue,
      user: { id: 1, role: 'officer', fullName: 'QC Test' }
    }),
    (error) => error?.statusCode === 400 && error.message.includes('Length')
  );

  const incompleteNgTopic = structuredClone(completedInput);
  incompleteNgTopic.piecesData.topics[1].rows[0].values = ['65.6', ''];
  await assert.rejects(
    () => completeDimensionInspection({
      lotNumber: 'LOT-NG-STOP',
      input: incompleteNgTopic,
      user: { id: 1, role: 'officer', fullName: 'QC Test' }
    }),
    (error) => error?.statusCode === 400 && error.message.includes('Length')
  );

  const partialLaterTopic = structuredClone(completedInput);
  partialLaterTopic.piecesData.topics[2].rows[0].values = ['11.11', ''];
  await assert.rejects(
    () => completeDimensionInspection({
      lotNumber: 'LOT-NG-STOP',
      input: partialLaterTopic,
      user: { id: 1, role: 'officer', fullName: 'QC Test' }
    }),
    (error) => error?.statusCode === 400 && error.message.includes('Thickness')
  );

  const completeLaterTopic = structuredClone(completedInput);
  completeLaterTopic.piecesData.topics[2].rows[0].values = ['11.11', '11.12'];
  await completeDimensionInspection({
    lotNumber: 'LOT-NG-STOP',
    input: completeLaterTopic,
    user: { id: 1, role: 'officer', fullName: 'QC Test' }
  });
  assert.deepEqual(
    JSON.parse(upsertParams[12]).topics[2].rows[0].values,
    ['11.11', '11.12']
  );

  const finalResultMissing = structuredClone(completedInput);
  finalResultMissing.piecesData.topics[3].rows[0].values = [''];
  await assert.rejects(
    () => completeDimensionInspection({
      lotNumber: 'LOT-NG-STOP',
      input: finalResultMissing,
      user: { id: 1, role: 'officer', fullName: 'QC Test' }
    }),
    (error) => error?.statusCode === 400 && error.message.includes('Final result')
  );

  const finalResultPass = structuredClone(completedInput);
  finalResultPass.piecesData.topics[3].rows[0].values = ['pass'];
  await assert.rejects(
    () => completeDimensionInspection({
      lotNumber: 'LOT-NG-STOP',
      input: finalResultPass,
      user: { id: 1, role: 'officer', fullName: 'QC Test' }
    }),
    (error) => error?.statusCode === 400 && error.message.includes('Final result')
  );

  const finalNgWithoutTopic = structuredClone(completedInput);
  delete finalNgWithoutTopic.piecesData.meta.ngStop;
  await assert.rejects(
    () => completeDimensionInspection({
      lotNumber: 'LOT-NG-STOP',
      input: finalNgWithoutTopic,
      user: { id: 1, role: 'officer', fullName: 'QC Test' }
    }),
    (error) => error?.statusCode === 400
  );

  const finalResultAsNgTopic = structuredClone(completedInput);
  finalResultAsNgTopic.piecesData.meta.ngStop = {
    topicId: 4,
    topicName: 'Final result'
  };
  await assert.rejects(
    () => completeDimensionInspection({
      lotNumber: 'LOT-NG-STOP',
      input: finalResultAsNgTopic,
      user: { id: 1, role: 'officer', fullName: 'QC Test' }
    }),
    (error) => error?.statusCode === 400 && error.message.includes('Final result')
  );

  const ngStopWithoutNote = structuredClone(completedInput);
  ngStopWithoutNote.piecesData.meta.inspectionNote = '';
  await assert.rejects(
    () => completeDimensionInspection({
      lotNumber: 'LOT-NG-STOP',
      input: ngStopWithoutNote,
      user: { id: 1, role: 'officer', fullName: 'QC Test' }
    }),
    (error) => error?.statusCode === 400
  );

  const mismatchedNgStopTopic = structuredClone(completedInput);
  mismatchedNgStopTopic.piecesData.meta.ngStop.topicName = 'Width';
  await assert.rejects(
    () => completeDimensionInspection({
      lotNumber: 'LOT-NG-STOP',
      input: mismatchedNgStopTopic,
      user: { id: 1, role: 'officer', fullName: 'QC Test' }
    }),
    (error) => error?.statusCode === 400
  );
});

test('re-completing a dimension inspection uses current active topics', async (t) => {
  const originalConnect = postgresDb.connect;
  let upsertParams = null;

  t.after(() => {
    postgresDb.connect = originalConnect;
  });

  postgresDb.connect = async () => ({
    query: async (sql, params = []) => {
      if (/FROM lots/i.test(sql)) {
        return {
          rows: [{
            id: 7,
            lot_number: 'LOT-1',
            quantity: 100,
            sample_count: 1,
            status: 'waiting_pack'
          }]
        };
      }
      if (/FROM dimension_inspections/i.test(sql)) {
        return {
          rows: [{
            id: 3,
            status: 'completed',
            form_config_snapshot: [{
              id: 99,
              topicName: 'Removed test topic',
              inputCount: 1,
              decimalPlaces: 2,
              inputType: 'number',
              measurePieces: 'all',
              ruleKey: '',
              displayOrder: 1
            }],
            pieces_data: {
              topics: [{
                topicId: 99,
                topicName: 'Removed test topic',
                rows: [{ pieceNo: 1, values: ['1.00'] }]
              }]
            }
          }]
        };
      }
      if (/FROM sampling_rules/i.test(sql)) {
        return { rows: [{ qty_min: 1, qty_max: null, sample_count: 1 }] };
      }
      if (/FROM form_config/i.test(sql)) {
        return {
          rows: [
            {
              id: 1,
              topic_name: 'Current width',
              input_count: 1,
              decimal_places: 2,
              input_type: 'number',
              measure_pieces: 'all',
              rule_key: null,
              display_order: 1
            },
            {
              id: 2,
              topic_name: 'Final result',
              input_count: 1,
              decimal_places: 0,
              input_type: 'pass_fail',
              measure_pieces: 'all',
              rule_key: null,
              display_order: 2
            }
          ]
        };
      }
      if (/INSERT INTO dimension_inspections/i.test(sql)) {
        upsertParams = params;
      }

      return { rows: [], rowCount: 1 };
    },
    release: () => {}
  });

  const result = await completeDimensionInspection({
    lotNumber: 'LOT-1',
    input: {
      inspectionDate: '2026-07-19',
      shift: '1',
      instrumentCodes: ['A-01-001', 'A-01-002', 'A-07-003', 'A-01-004', 'A-01-005'],
      brakeType: 'normal',
      brakeModel: 'no_hole',
      sampleCount: 1,
      piecesData: {
        topics: [
          {
            topicId: 1,
            topicName: 'Current width',
            rows: [{ pieceNo: 1, values: ['11.11'] }]
          },
          {
            topicId: 2,
            topicName: 'Final result',
            rows: [{ pieceNo: 1, values: ['pass'] }]
          }
        ]
      }
    },
    user: { id: 1, role: 'head', fullName: 'QC Head' }
  });

  assert.equal(result.ok, true);
  assert.ok(upsertParams);
  assert.deepEqual(
    JSON.parse(upsertParams[11]).map((topic) => topic.topicName),
    ['Current width', 'Final result']
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
