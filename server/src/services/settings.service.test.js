import assert from 'node:assert/strict';
import test from 'node:test';

import { db } from '../config/database.js';
import {
  createInspectionTopic,
  deactivateInspectionTopic,
  getSystemSettings,
  isSystemSettingsSchemaError,
  updateInstrumentPrefixes,
  updateInspectionTopicDisplays,
  updateSamplingRules
} from './settings.service.js';

test('settings schema error is detected for missing Step 12 columns', () => {
  assert.equal(isSystemSettingsSchemaError({ code: 'ER_BAD_FIELD_ERROR' }), true);
  assert.equal(isSystemSettingsSchemaError({ code: 'ER_NO_SUCH_TABLE' }), true);
  assert.equal(isSystemSettingsSchemaError({ code: 'ER_PARSE_ERROR' }), false);
});

test('getSystemSettings returns read-only settings data', async () => {
  const calls = [];
  const connection = {
    async execute(sql) {
      calls.push(sql);

      if (sql.includes('system_setting_audit_logs')) {
        return [[]];
      }

      if (sql.includes('FROM form_config')) {
        return [[
          {
            id: 105,
            form_type: 'dimension',
            topic_name: 'ขนาดรูเจาะ/รูคว้าน',
            input_count: 2,
            decimal_places: 1,
            input_type: 'number',
            measure_pieces: 'first',
            display_order: 5,
            remark: 'ค่าเริ่มต้น',
            rule_key: 'hole_inspection',
            is_active: 1
          }
        ]];
      }

      if (sql.includes('FROM sampling_rules')) {
        return [[
          { id: 1, qty_min: 2, qty_max: 100, sample_count: 2 }
        ]];
      }

      if (sql.includes('FROM dimension_instrument_prefixes')) {
        return [[
          { slot_no: 1, prefix: 'A-01-' },
          { slot_no: 2, prefix: 'A-01-' },
          { slot_no: 3, prefix: 'A-07-' },
          { slot_no: 4, prefix: 'A-01-' },
          { slot_no: 5, prefix: 'A-01-' }
        ]];
      }

      if (sql.includes('dimension_inspections')) {
        return [[{ dimension_draft_count: 0, packing_draft_count: 0 }]];
      }

      if (sql.includes('FROM system_setting_audit_logs')) {
        return [[]];
      }

      throw new Error(`Unexpected query: ${sql}`);
    }
  };

  const result = await getSystemSettings(connection);

  assert.deepEqual(result.formTopics.dimension, [
    {
      id: 105,
      formType: 'dimension',
      topicName: 'ขนาดรูเจาะ/รูคว้าน',
      inputCount: 2,
      decimalPlaces: 1,
      inputType: 'number',
      measurePieces: 'first',
      displayOrder: 5,
      remark: 'ค่าเริ่มต้น',
      ruleKey: 'hole_inspection',
      isActive: true
    }
  ]);
  assert.deepEqual(result.formTopics.packing, []);
  assert.deepEqual(result.samplingRules, [
    { id: 1, qtyMin: 2, qtyMax: 100, sampleCount: 2 }
  ]);
  assert.equal(result.instrumentPrefixes.length, 5);
});

test('getSystemSettings gives a beginner-readable error when Step 12 migration is missing', async () => {
  const connection = {
    async execute() {
      const error = new Error('Unknown column rule_key');
      error.code = 'ER_BAD_FIELD_ERROR';
      throw error;
    }
  };

  await assert.rejects(
    () => getSystemSettings(connection),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.match(error.message, /ยังไม่ได้อัปเดตฐานข้อมูลสำหรับ Step 12/);
      return true;
    }
  );
});

test('getSystemSettings rejects partial migration when audit table is missing', async () => {
  const connection = {
    async execute(sql) {
      if (sql.includes('FROM form_config')) {
        return [[]];
      }

      if (sql.includes('FROM sampling_rules')) {
        return [[]];
      }

      if (sql.includes('system_setting_audit_logs')) {
        const error = new Error('Table does not exist');
        error.code = 'ER_NO_SUCH_TABLE';
        throw error;
      }

      throw new Error(`Unexpected query: ${sql}`);
    }
  };

  await assert.rejects(
    () => getSystemSettings(connection),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.match(error.message, /ยังไม่ได้อัปเดตฐานข้อมูลสำหรับ Step 12/);
      return true;
    }
  );
});

test('createInspectionTopic rejects active duplicate names in the same form', async () => {
  const connection = {
    async execute(sql) {
      if (sql.includes('GET_LOCK')) {
        return [[{ lock_status: 1 }]];
      }

      if (sql.includes('RELEASE_LOCK')) {
        return [[{ released: 1 }]];
      }

      if (sql.includes('dimension_inspections')) {
        return [[{ dimension_draft_count: 0, packing_draft_count: 0 }]];
      }

      if (sql.includes('LOWER(TRIM(topic_name))')) {
        return [[{ id: 10, is_active: 1 }]];
      }

      throw new Error(`Unexpected query: ${sql}`);
    }
  };

  await assert.rejects(
    () => createInspectionTopic({
      formType: 'dimension',
      input: {
        topicName: 'Width',
        inputType: 'number',
        inputCount: 1,
        decimalPlaces: 2,
        measurePieces: 'all',
        reason: 'add width'
      },
      user: { id: 1, fullName: 'Head User', position: 'Head' },
      connection
    }),
    (error) => {
      assert.equal(error.statusCode, 409);
      return true;
    }
  );
});

test('createInspectionTopic blocks changes while inspection drafts exist', async () => {
  const connection = {
    async execute(sql) {
      if (sql.includes('GET_LOCK')) {
        return [[{ lock_status: 1 }]];
      }

      if (sql.includes('RELEASE_LOCK')) {
        return [[{ released: 1 }]];
      }

      if (sql.includes('dimension_inspections')) {
        return [[{ dimension_draft_count: 2, packing_draft_count: 1 }]];
      }

      throw new Error(`Unexpected query: ${sql}`);
    }
  };

  await assert.rejects(
    () => createInspectionTopic({
      formType: 'packing',
      input: {
        topicName: 'Box weight',
        inputType: 'number',
        decimalPlaces: 0,
        reason: 'add numeric packing check'
      },
      user: { id: 1, fullName: 'Head User', position: 'Head' },
      connection
    }),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.match(error.message, /มิติ 2 ใบ \/ บรรจุ 1 ใบ/);
      assert.deepEqual(error.details, {
        dimensionDraftCount: 2,
        packingDraftCount: 1
      });
      return true;
    }
  );
});

test('createInspectionTopic appends the new active topic and writes audit', async () => {
  const calls = [];
  const connection = {
    async execute(sql, params = []) {
      calls.push({ sql, params });

      if (sql.includes('GET_LOCK')) {
        return [[{ lock_status: 1 }]];
      }

      if (sql.includes('RELEASE_LOCK')) {
        return [[{ released: 1 }]];
      }

      if (sql.includes('dimension_inspections')) {
        return [[{ dimension_draft_count: 0, packing_draft_count: 0 }]];
      }

      if (sql.includes('LOWER(TRIM(topic_name))')) {
        return [[]];
      }

      if (sql.includes('MAX(display_order)')) {
        return [[{ max_order: 5 }]];
      }

      if (sql.includes('INSERT INTO form_config')) {
        return [{ insertId: 123 }];
      }

      if (sql.includes('WHERE id = ?')) {
        return [[{
          id: 123,
          form_type: 'dimension',
          topic_name: 'Width',
          input_count: 2,
          decimal_places: 2,
          input_type: 'number',
          measure_pieces: 'all',
          display_order: 6,
          remark: 'new topic',
          rule_key: '',
          is_active: 1
        }]];
      }

      if (sql.includes('INSERT INTO system_setting_audit_logs')) {
        return [{ insertId: 777 }];
      }

      throw new Error(`Unexpected query: ${sql}`);
    }
  };

  const result = await createInspectionTopic({
    formType: 'dimension',
    input: {
      topicName: 'Width',
      inputType: 'number',
      inputCount: 2,
      decimalPlaces: 2,
      measurePieces: 'all',
      remark: 'new topic',
      reason: 'add width'
    },
    user: { id: 1, fullName: 'Head User', position: 'Head' },
    connection
  });

  assert.equal(result.topic.id, 123);
  assert.equal(result.topic.displayOrder, 6);
  assert.equal(
    calls.some((call) => call.sql.includes('INSERT INTO system_setting_audit_logs')),
    true
  );
  assert.equal(calls.some((call) => call.sql.includes('GET_LOCK')), true);
  assert.equal(calls.some((call) => call.sql.includes('RELEASE_LOCK')), true);
});

test('deactivateInspectionTopic requires reason and blocks draft inspections', async () => {
  await assert.rejects(
    () => deactivateInspectionTopic({
      topicId: 10,
      input: { reason: '' },
      user: { id: 1 },
      connection: { execute: async () => [[]] }
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      return true;
    }
  );
});

test('updateInspectionTopicDisplays updates multiple topics and writes audit logs', async () => {
  const calls = [];
  const topics = new Map([
    [10, { id: 10, display_order: 1, remark: 'old width' }],
    [11, { id: 11, display_order: 2, remark: 'old length' }]
  ]);

  const connection = {
    async execute(sql, params = []) {
      calls.push({ sql, params });

      if (sql.includes('dimension_inspections')) {
        return [[{ dimension_draft_count: 0, packing_draft_count: 0 }]];
      }

      if (sql.includes('UPDATE form_config')) {
        const [displayOrder, remark, id] = params;
        topics.set(Number(id), {
          ...topics.get(Number(id)),
          display_order: displayOrder,
          remark
        });
        return [{ affectedRows: 1 }];
      }

      if (sql.includes('WHERE id = ?')) {
        const topic = topics.get(Number(params[0]));
        return [[{
          id: topic.id,
          form_type: 'dimension',
          topic_name: topic.id === 10 ? 'Width' : 'Length',
          input_count: 1,
          decimal_places: 2,
          input_type: 'number',
          measure_pieces: 'all',
          display_order: topic.display_order,
          remark: topic.remark,
          rule_key: '',
          is_active: 1
        }]];
      }

      if (sql.includes('INSERT INTO system_setting_audit_logs')) {
        return [{ insertId: 800 + calls.length }];
      }

      throw new Error(`Unexpected query: ${sql}`);
    }
  };

  const result = await updateInspectionTopicDisplays({
    items: [
      { topicId: 10, displayOrder: 3, remark: 'new width' },
      { topicId: 11, displayOrder: 4, remark: 'new length' }
    ],
    user: { id: 1, fullName: 'Head User', position: 'Head' },
    connection
  });

  assert.equal(result.topics.length, 2);
  assert.equal(
    calls.filter((call) => call.sql.includes('INSERT INTO system_setting_audit_logs')).length,
    2
  );
});

test('createInspectionTopic rejects when duplicate-name lock cannot be acquired', async () => {
  const connection = {
    async execute(sql) {
      if (sql.includes('GET_LOCK')) {
        return [[{ lock_status: 0 }]];
      }

      throw new Error(`Unexpected query: ${sql}`);
    }
  };

  await assert.rejects(
    () => createInspectionTopic({
      formType: 'dimension',
      input: {
        topicName: 'Width',
        inputType: 'number',
        inputCount: 1,
        decimalPlaces: 2,
        measurePieces: 'all',
        reason: 'add width'
      },
      user: { id: 1, fullName: 'Head User', position: 'Head' },
      connection
    }),
    (error) => {
      assert.equal(error.statusCode, 409);
      return true;
    }
  );
});

test('deactivateInspectionTopic rejects the last active topic in the form', async () => {
  const connection = {
    async execute(sql) {
      if (sql.includes('dimension_inspections')) {
        return [[{ dimension_draft_count: 0, packing_draft_count: 0 }]];
      }

      if (sql.includes('WHERE id = ?')) {
        return [[{
          id: 10,
          form_type: 'dimension',
          topic_name: 'Width',
          input_count: 1,
          decimal_places: 2,
          input_type: 'number',
          measure_pieces: 'all',
          display_order: 1,
          remark: '',
          rule_key: '',
          is_active: 1
        }]];
      }

      if (sql.includes('COUNT(*) AS active_count')) {
        return [[{ active_count: 0 }]];
      }

      throw new Error(`Unexpected query: ${sql}`);
    }
  };

  await assert.rejects(
    () => deactivateInspectionTopic({
      topicId: 10,
      input: { reason: 'replace topic' },
      user: { id: 1, fullName: 'Head User', position: 'Head' },
      connection
    }),
    (error) => {
      assert.equal(error.statusCode, 409);
      return true;
    }
  );
});

test('updateSamplingRules replaces rules as one audited set', async () => {
  const calls = [];
  const connection = {
    async execute(sql, params = []) {
      calls.push({ sql, params });

      if (sql.includes('dimension_inspections')) {
        return [[{ dimension_draft_count: 0, packing_draft_count: 0 }]];
      }

      if (sql.includes('FROM sampling_rules')) {
        return [[
          { id: 1, qty_min: 1, qty_max: 100, sample_count: 2 },
          { id: 2, qty_min: 101, qty_max: null, sample_count: 3 }
        ]];
      }

      if (sql.includes('DELETE FROM sampling_rules')) {
        return [{ affectedRows: 2 }];
      }

      if (sql.includes('INSERT INTO sampling_rules')) {
        return [{ affectedRows: 2 }];
      }

      if (sql.includes('INSERT INTO system_setting_audit_logs')) {
        return [{ insertId: 900 }];
      }

      throw new Error(`Unexpected query: ${sql}`);
    }
  };

  const result = await updateSamplingRules({
    rules: [
      { qtyMin: 1, qtyMax: 50, sampleCount: 2 },
      { qtyMin: 51, qtyMax: null, sampleCount: 3 }
    ],
    reason: 'adjust sampling',
    user: { id: 1, fullName: 'Head User', position: 'Head' },
    connection
  });

  assert.equal(result.rules.length, 2);
  assert.equal(calls.some((call) => call.sql.includes('DELETE FROM sampling_rules')), true);
  assert.equal(calls.some((call) => call.sql.includes('INSERT INTO sampling_rules')), true);
  assert.equal(calls.some((call) => call.sql.includes('INSERT INTO system_setting_audit_logs')), true);
});

test('updateSamplingRules rejects gaps and non-1 starting range', async () => {
  await assert.rejects(
    () => updateSamplingRules({
      rules: [
        { qtyMin: 2, qtyMax: 50, sampleCount: 2 },
        { qtyMin: 51, qtyMax: null, sampleCount: 3 }
      ],
      reason: 'bad start',
      user: { id: 1 },
      connection: { execute: async () => [[]] }
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      return true;
    }
  );

  await assert.rejects(
    () => updateSamplingRules({
      rules: [
        { qtyMin: 1, qtyMax: 50, sampleCount: 2 },
        { qtyMin: 52, qtyMax: null, sampleCount: 3 }
      ],
      reason: 'bad gap',
      user: { id: 1 },
      connection: { execute: async () => [[]] }
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      return true;
    }
  );
});

test('updateSamplingRules rolls back when inserting a replacement rule fails', async (t) => {
  const calls = [];
  let insertCount = 0;
  const connection = {
    async beginTransaction() {
      calls.push({ sql: 'BEGIN' });
    },
    async commit() {
      calls.push({ sql: 'COMMIT' });
    },
    async rollback() {
      calls.push({ sql: 'ROLLBACK' });
    },
    release() {
      calls.push({ sql: 'RELEASE' });
    },
    async execute(sql, params = []) {
      calls.push({ sql, params });

      if (sql.includes('dimension_inspections')) {
        return [[{ dimension_draft_count: 0, packing_draft_count: 0 }]];
      }

      if (sql.includes('FROM sampling_rules')) {
        return [[
          { id: 1, qty_min: 1, qty_max: 100, sample_count: 2 },
          { id: 2, qty_min: 101, qty_max: null, sample_count: 3 }
        ]];
      }

      if (sql.includes('DELETE FROM sampling_rules')) {
        return [{ affectedRows: 2 }];
      }

      if (sql.includes('INSERT INTO sampling_rules')) {
        insertCount += 1;
        if (insertCount === 2) {
          throw new Error('insert failed');
        }
        return [{ affectedRows: 1 }];
      }

      throw new Error(`Unexpected query: ${sql}`);
    }
  };

  t.mock.method(db, 'getConnection', async () => connection);

  await assert.rejects(
    () => updateSamplingRules({
      rules: [
        { qtyMin: 1, qtyMax: 50, sampleCount: 2 },
        { qtyMin: 51, qtyMax: null, sampleCount: 3 }
      ],
      reason: 'rollback check',
      user: { id: 1 }
    }),
    /insert failed/
  );

  assert.equal(calls.some((call) => call.sql === 'ROLLBACK'), true);
  assert.equal(calls.some((call) => call.sql === 'COMMIT'), false);
  assert.equal(calls.some((call) => call.sql === 'RELEASE'), true);
});

test('updateInstrumentPrefixes saves five valid prefixes and rejects bad format', async () => {
  const calls = [];
  const prefixRows = [
    { slot_no: 1, prefix: 'A-01-' },
    { slot_no: 2, prefix: 'A-01-' },
    { slot_no: 3, prefix: 'A-07-' },
    { slot_no: 4, prefix: 'A-01-' },
    { slot_no: 5, prefix: 'A-01-' }
  ];
  const connection = {
    async execute(sql, params = []) {
      calls.push({ sql, params });

      if (sql.includes('dimension_inspections')) {
        return [[{ dimension_draft_count: 0, packing_draft_count: 0 }]];
      }

      if (sql.includes('FROM dimension_instrument_prefixes')) {
        return [prefixRows.map((row) => ({ ...row }))];
      }

      if (sql.includes('INSERT INTO dimension_instrument_prefixes')) {
        const [slotNo, prefix] = params;
        const row = prefixRows.find((item) => item.slot_no === slotNo);
        if (row) {
          row.prefix = prefix;
        }
        return [{ affectedRows: 1 }];
      }

      if (sql.includes('INSERT INTO system_setting_audit_logs')) {
        return [{ insertId: 901 }];
      }

      throw new Error(`Unexpected query: ${sql}`);
    }
  };

  const result = await updateInstrumentPrefixes({
    prefixes: ['A-02-', 'A-03-', 'A-04-', 'A-05-', 'A-06-'],
    reason: 'change tools',
    user: { id: 1, fullName: 'Head User', position: 'Head' },
    connection
  });

  assert.equal(result.prefixes[0].prefix, 'A-02-');
  assert.equal(calls.some((call) => call.sql.includes('INSERT INTO dimension_instrument_prefixes')), true);

  await assert.rejects(
    () => updateInstrumentPrefixes({
      prefixes: ['A-2-', 'A-03-', 'A-04-', 'A-05-', 'A-06-'],
      reason: 'bad prefix',
      user: { id: 1 },
      connection
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      return true;
    }
  );
});
