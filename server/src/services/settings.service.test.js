import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { postgresDb } from '../config/database.js';
import {
  createInspectionTopic,
  deactivateInspectionTopic,
  getSystemSettings,
  isSystemSettingsSchemaError,
  updateInstrumentPrefixes,
  updateInspectionTopicDisplays,
  updateSamplingRules
} from './settings.service.js';

test('settings service uses PostgreSQL query APIs', async () => {
  const source = await readFile(new URL('./settings.service.js', import.meta.url), 'utf8');

  assert.match(source, /import \{ postgresDb \}/);
  assert.doesNotMatch(source, /\.execute\(|GET_LOCK|RELEASE_LOCK|ON DUPLICATE KEY/);
  assert.match(source, /ON CONFLICT \(slot_no\) DO UPDATE/);
  assert.match(source, /RETURNING id/);
  assert.match(source, /pg_try_advisory_lock/);
  assert.match(source, /pg_advisory_unlock/);
  assert.doesNotMatch(source, /pg_try_advisory_xact_lock/);
});

test('settings UI limits topic values to PostgreSQL schema', async () => {
  const source = await readFile(
    new URL('../../../client/src/pages/system-settings.page.js', import.meta.url),
    'utf8'
  );

  assert.match(source, /name="decimalPlaces"[^>]*max="3"/);
  assert.match(source, /name="measurePiecesCustom"[^>]*maxlength="50"/);
});

test('settings schema error is detected for missing Step 12 columns', () => {
  assert.equal(isSystemSettingsSchemaError({ code: '42703' }), true);
  assert.equal(isSystemSettingsSchemaError({ code: '42P01' }), true);
  assert.equal(isSystemSettingsSchemaError({ code: '42601' }), false);
});

test('getSystemSettings returns read-only settings data', async () => {
  const calls = [];
  const connection = {
    async query(sql) {
      calls.push(sql);

      if (sql.includes('system_setting_audit_logs')) {
        return { rows: [] };
      }

      if (sql.includes('FROM form_config')) {
        return { rows: [
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
        ] };
      }

      if (sql.includes('FROM sampling_rules')) {
        return { rows: [
          { id: 1, qty_min: 2, qty_max: 100, sample_count: 2 }
        ] };
      }

      if (sql.includes('FROM dimension_instrument_prefixes')) {
        return { rows: [
          { slot_no: 1, prefix: 'A-01-' },
          { slot_no: 2, prefix: 'A-01-' },
          { slot_no: 3, prefix: 'A-07-' },
          { slot_no: 4, prefix: 'A-01-' },
          { slot_no: 5, prefix: 'A-01-' }
        ] };
      }

      if (sql.includes('dimension_inspections')) {
        return { rows: [{ dimension_draft_count: 0, packing_draft_count: 0 }] };
      }

      if (sql.includes('FROM system_setting_audit_logs')) {
        return { rows: [] };
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
    async query() {
      const error = new Error('column rule_key does not exist');
      error.code = '42703';
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
    async query(sql) {
      if (sql.includes('FROM form_config')) {
        return { rows: [] };
      }

      if (sql.includes('FROM sampling_rules')) {
        return { rows: [] };
      }

      if (sql.includes('system_setting_audit_logs')) {
        const error = new Error('relation does not exist');
        error.code = '42P01';
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
    async query(sql) {
      if (sql.includes('pg_try_advisory_lock')) {
        return { rows: [{ lock_status: true }] };
      }

      if (sql.includes('pg_advisory_unlock')) {
        return { rows: [{ released: true }] };
      }

      if (sql.includes('dimension_inspections')) {
        return { rows: [{ dimension_draft_count: 0, packing_draft_count: 0 }] };
      }

      if (sql.includes('LOWER(TRIM(topic_name))')) {
        return { rows: [{ id: 10, is_active: true }] };
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
    async query(sql) {
      if (sql.includes('pg_try_advisory_lock')) {
        return { rows: [{ lock_status: true }] };
      }

      if (sql.includes('pg_advisory_unlock')) {
        return { rows: [{ released: true }] };
      }

      if (sql.includes('dimension_inspections')) {
        return { rows: [{ dimension_draft_count: 2, packing_draft_count: 1 }] };
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

test('createInspectionTopic rejects values PostgreSQL form_config cannot store', async () => {
  const connection = {
    async query(sql) {
      throw new Error(`Database should not be queried: ${sql}`);
    }
  };
  const input = {
    topicName: 'Width',
    inputType: 'number',
    inputCount: 1,
    decimalPlaces: 3,
    measurePieces: 'all',
    reason: 'validate limits'
  };

  await assert.rejects(
    () => createInspectionTopic({
      formType: 'dimension',
      input: { ...input, decimalPlaces: 4 },
      user: { id: 1 },
      connection
    }),
    (error) => error.statusCode === 400 && /ทศนิยม/.test(error.message)
  );

  await assert.rejects(
    () => createInspectionTopic({
      formType: 'dimension',
      input: { ...input, measurePieces: '1-21' },
      user: { id: 1 },
      connection
    }),
    (error) => error.statusCode === 400 && /ตรวจชิ้น/.test(error.message)
  );
});

test('createInspectionTopic appends the new active topic and writes audit', async (t) => {
  const calls = [];
  let connectionReleased = false;
  const connection = {
    async query(sql, params = []) {
      calls.push({ sql, params });

      if (sql.includes('pg_try_advisory_lock')) {
        return { rows: [{ lock_status: true }] };
      }

      if (sql.includes('pg_advisory_unlock')) {
        return { rows: [{ released: true }] };
      }

      if (sql === 'BEGIN' || sql === 'COMMIT') {
        return { rows: [] };
      }

      if (sql.includes('dimension_inspections')) {
        return { rows: [{ dimension_draft_count: 0, packing_draft_count: 0 }] };
      }

      if (sql.includes('LOWER(TRIM(topic_name))')) {
        return { rows: [] };
      }

      if (sql.includes('MAX(display_order)')) {
        return { rows: [{ max_order: 5 }] };
      }

      if (sql.includes('INSERT INTO form_config')) {
        return { rows: [{ id: 123 }] };
      }

      if (sql.includes('WHERE id = $1')) {
        return { rows: [{
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
        }] };
      }

      if (sql.includes('INSERT INTO system_setting_audit_logs')) {
        return { rows: [] };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
    release(error) {
      assert.equal(error, undefined);
      connectionReleased = true;
    }
  };

  t.mock.method(postgresDb, 'connect', async () => connection);

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
    user: { id: 1, fullName: 'Head User', position: 'Head' }
  });

  assert.equal(result.topic.id, 123);
  assert.equal(result.topic.displayOrder, 6);
  assert.equal(
    calls.some((call) => call.sql.includes('INSERT INTO system_setting_audit_logs')),
    true
  );
  assert.equal(calls.some((call) => call.sql.includes('pg_try_advisory_lock')), true);
  assert.equal(calls.some((call) => call.sql.includes('pg_advisory_unlock')), true);
  assert.equal(calls.some((call) => call.sql.includes('RETURNING id')), true);
  assert.equal(connectionReleased, true);
  assert.ok(
    calls.findIndex((call) => call.sql.includes('pg_try_advisory_lock'))
      < calls.findIndex((call) => call.sql === 'BEGIN')
  );
  assert.ok(
    calls.findIndex((call) => call.sql === 'COMMIT')
      < calls.findIndex((call) => call.sql.includes('pg_advisory_unlock'))
  );
});

test('deactivateInspectionTopic requires reason and blocks draft inspections', async () => {
  await assert.rejects(
    () => deactivateInspectionTopic({
      topicId: 10,
      input: { reason: '' },
      user: { id: 1 },
      connection: { query: async () => ({ rows: [] }) }
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
    async query(sql, params = []) {
      calls.push({ sql, params });

      if (sql.includes('dimension_inspections')) {
        return { rows: [{ dimension_draft_count: 0, packing_draft_count: 0 }] };
      }

      if (sql.includes('UPDATE form_config')) {
        const [displayOrder, remark, id] = params;
        topics.set(Number(id), {
          ...topics.get(Number(id)),
          display_order: displayOrder,
          remark
        });
        return { rows: [] };
      }

      if (sql.includes('WHERE id = $1')) {
        const topic = topics.get(Number(params[0]));
        return { rows: [{
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
        }] };
      }

      if (sql.includes('INSERT INTO system_setting_audit_logs')) {
        return { rows: [] };
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

test('createInspectionTopic rejects when duplicate-name lock cannot be acquired', async (t) => {
  let now = 0;
  t.mock.method(Date, 'now', () => {
    now += 5001;
    return now;
  });

  const connection = {
    async query(sql) {
      if (sql.includes('pg_try_advisory_lock')) {
        return { rows: [{ lock_status: false }] };
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
    async query(sql) {
      if (sql.includes('dimension_inspections')) {
        return { rows: [{ dimension_draft_count: 0, packing_draft_count: 0 }] };
      }

      if (sql.includes('WHERE id = $1')) {
        return { rows: [{
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
        }] };
      }

      if (sql.includes('COUNT(*) AS active_count')) {
        return { rows: [{ active_count: 0 }] };
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
    async query(sql, params = []) {
      calls.push({ sql, params });

      if (sql.includes('dimension_inspections')) {
        return { rows: [{ dimension_draft_count: 0, packing_draft_count: 0 }] };
      }

      if (sql.includes('FROM sampling_rules')) {
        return { rows: [
          { id: 1, qty_min: 1, qty_max: 100, sample_count: 2 },
          { id: 2, qty_min: 101, qty_max: null, sample_count: 3 }
        ] };
      }

      if (sql.includes('DELETE FROM sampling_rules')) {
        return { rows: [] };
      }

      if (sql.includes('INSERT INTO sampling_rules')) {
        return { rows: [] };
      }

      if (sql.includes('INSERT INTO system_setting_audit_logs')) {
        return { rows: [] };
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
      connection: { query: async () => ({ rows: [] }) }
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
      connection: { query: async () => ({ rows: [] }) }
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
    release() {
      calls.push({ sql: 'RELEASE' });
    },
    async query(sql, params = []) {
      calls.push({ sql, params });

      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) {
        return { rows: [] };
      }

      if (sql.includes('dimension_inspections')) {
        return { rows: [{ dimension_draft_count: 0, packing_draft_count: 0 }] };
      }

      if (sql.includes('FROM sampling_rules')) {
        return { rows: [
          { id: 1, qty_min: 1, qty_max: 100, sample_count: 2 },
          { id: 2, qty_min: 101, qty_max: null, sample_count: 3 }
        ] };
      }

      if (sql.includes('DELETE FROM sampling_rules')) {
        return { rows: [] };
      }

      if (sql.includes('INSERT INTO sampling_rules')) {
        insertCount += 1;
        if (insertCount === 2) {
          throw new Error('insert failed');
        }
        return { rows: [] };
      }

      throw new Error(`Unexpected query: ${sql}`);
    }
  };

  t.mock.method(postgresDb, 'connect', async () => connection);

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
    async query(sql, params = []) {
      calls.push({ sql, params });

      if (sql.includes('dimension_inspections')) {
        return { rows: [{ dimension_draft_count: 0, packing_draft_count: 0 }] };
      }

      if (sql.includes('FROM dimension_instrument_prefixes')) {
        return { rows: prefixRows.map((row) => ({ ...row })) };
      }

      if (sql.includes('INSERT INTO dimension_instrument_prefixes')) {
        const [slotNo, prefix] = params;
        const row = prefixRows.find((item) => item.slot_no === slotNo);
        if (row) {
          row.prefix = prefix;
        }
        return { rows: [] };
      }

      if (sql.includes('INSERT INTO system_setting_audit_logs')) {
        return { rows: [] };
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
  assert.equal(calls.some((call) => call.sql.includes('ON CONFLICT (slot_no) DO UPDATE')), true);

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
