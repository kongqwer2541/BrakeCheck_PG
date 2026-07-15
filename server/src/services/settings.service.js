import { db } from '../config/database.js';

const defaultInstrumentPrefixes = ['A-01-', 'A-01-', 'A-07-', 'A-01-', 'A-01-'];
const settingsMigrationMessage = 'ยังไม่ได้อัปเดตฐานข้อมูลสำหรับ Step 12 กรุณา backup database แล้วรัน migration ของ Step 12 ที่ยังขาด';
const allowedFormTypes = ['dimension', 'packing'];
const allowedInputTypes = ['number', 'pass_fail'];
const allowedRuleKeys = ['', 'hole_inspection'];
const maxTextLength = {
  topicName: 120,
  remark: 300,
  reason: 500,
  userName: 200,
  userPosition: 100
};

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function createHttpErrorWithDetails(statusCode, message, details) {
  const error = createHttpError(statusCode, message);
  error.details = details;
  return error;
}

function getDraftCountsText(draftCounts) {
  return `มิติ ${draftCounts.dimensionDraftCount || 0} ใบ / บรรจุ ${draftCounts.packingDraftCount || 0} ใบ`;
}

function cleanText(value) {
  return String(value || '').trim();
}

function cleanOptionalText(value, fieldName, maxLength) {
  const text = cleanText(value);

  if (!text) {
    return '';
  }

  if (text.length > maxLength) {
    throw createHttpError(400, `${fieldName}ยาวเกิน ${maxLength} ตัวอักษร`);
  }

  return text;
}

function requireText(value, fieldName, maxLength) {
  const text = cleanOptionalText(value, fieldName, maxLength);

  if (!text) {
    throw createHttpError(400, `กรุณาระบุ${fieldName}`);
  }

  return text;
}

function requireActorUser(user) {
  const userId = Number(user?.id);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw createHttpError(401, 'Session หมดอายุ กรุณา Login ใหม่');
  }

  return userId;
}

function validateFormType(value) {
  const formType = cleanText(value);

  if (!allowedFormTypes.includes(formType)) {
    throw createHttpError(400, 'หมวดฟอร์มไม่ถูกต้อง');
  }

  return formType;
}

function validateInputType(value) {
  const inputType = cleanText(value);

  if (!allowedInputTypes.includes(inputType)) {
    throw createHttpError(400, 'ชนิดการประเมินไม่ถูกต้อง');
  }

  return inputType;
}

function validateInteger(value, fieldName, { min, max }) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue < min || numberValue > max) {
    throw createHttpError(400, `${fieldName}ไม่ถูกต้อง`);
  }

  return numberValue;
}

function normalizeMeasurePieces(value) {
  const text = cleanText(value).toLowerCase();

  if (!text || text === 'all' || text === 'ทุกชิ้น') {
    return 'all';
  }

  if (['first', 'first_only', 'piece_1', '1', 'เฉพาะชิ้นที่ 1'].includes(text)) {
    return 'first';
  }

  const numbers = new Set();
  const parts = text.split(',').map((part) => part.trim()).filter(Boolean);

  if (!parts.length) {
    throw createHttpError(400, 'ตรวจชิ้นที่ไม่ถูกต้อง');
  }

  parts.forEach((part) => {
    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);

    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);

      if (!Number.isInteger(start) || !Number.isInteger(end) || start <= 0 || end < start || end > 999) {
        throw createHttpError(400, 'ช่วงตรวจชิ้นที่ไม่ถูกต้อง');
      }

      for (let item = start; item <= end; item += 1) {
        numbers.add(item);
      }
      return;
    }

    const pieceNo = Number(part);

    if (!Number.isInteger(pieceNo) || pieceNo <= 0 || pieceNo > 999) {
      throw createHttpError(400, 'ตรวจชิ้นที่ไม่ถูกต้อง');
    }

    numbers.add(pieceNo);
  });

  return Array.from(numbers).sort((a, b) => a - b).join(',');
}

function normalizeTopicInput(input = {}, formType) {
  const topicName = requireText(input.topicName, 'ชื่อหัวข้อ', maxTextLength.topicName);
  const inputType = validateInputType(input.inputType);
  const isPassFail = inputType === 'pass_fail';
  const inputCount = formType === 'dimension' && !isPassFail
    ? validateInteger(input.inputCount ?? 1, 'จำนวนช่องกรอก', { min: 1, max: 10 })
    : 1;
  const decimalPlaces = isPassFail
    ? 0
    : validateInteger(input.decimalPlaces ?? 0, 'จำนวนทศนิยม', { min: 0, max: 4 });
  const ruleKey = cleanText(input.ruleKey);

  if (!allowedRuleKeys.includes(ruleKey)) {
    throw createHttpError(400, 'rule_key ไม่ถูกต้อง');
  }

  if (formType === 'packing' && ruleKey) {
    throw createHttpError(400, 'ฟอร์มบรรจุยังไม่รองรับ rule_key พิเศษ');
  }

  return {
    formType,
    topicName,
    inputType,
    inputCount,
    decimalPlaces,
    measurePieces: normalizeMeasurePieces(input.measurePieces),
    ruleKey,
    remark: cleanOptionalText(input.remark, 'หมายเหตุ', maxTextLength.remark),
    reason: requireText(input.reason, 'เหตุผล', maxTextLength.reason)
  };
}

function normalizeTopicDisplayInput(input = {}) {
  return {
    displayOrder: validateInteger(input.displayOrder, 'ลำดับแสดงผล', { min: 1, max: 9999 }),
    remark: cleanOptionalText(input.remark, 'หมายเหตุ', maxTextLength.remark)
  };
}

function normalizeSamplingRulesInput(rules) {
  if (!Array.isArray(rules) || rules.length < 1 || rules.length > 20) {
    throw createHttpError(400, 'กรุณาระบุกฎสุ่มตรวจ 1-20 แถว');
  }

  let expectedMin = 1;

  return rules.map((rule, index) => {
    const qtyMin = validateInteger(rule?.qtyMin, 'จำนวนเริ่มต้น', { min: 1, max: 999999999 });
    const qtyMax = rule?.qtyMax === null || rule?.qtyMax === ''
      ? null
      : validateInteger(rule?.qtyMax, 'จำนวนสิ้นสุด', { min: 1, max: 999999999 });
    const sampleCount = validateInteger(rule?.sampleCount, 'สุ่มตรวจ', { min: 1, max: 999999 });
    const isLast = index === rules.length - 1;

    if (qtyMin !== expectedMin) {
      throw createHttpError(400, 'ช่วงจำนวนสุ่มตรวจต้องเริ่มที่ 1 และต่อเนื่องกัน');
    }

    if (!isLast && qtyMax === null) {
      throw createHttpError(400, 'เฉพาะแถวสุดท้ายเท่านั้นที่เป็นขึ้นไปได้');
    }

    if (isLast && qtyMax !== null) {
      throw createHttpError(400, 'แถวสุดท้ายต้องเป็นขึ้นไป');
    }

    if (qtyMax !== null && qtyMax < qtyMin) {
      throw createHttpError(400, 'จำนวนสิ้นสุดต้องมากกว่าหรือเท่ากับจำนวนเริ่มต้น');
    }

    expectedMin = qtyMax === null ? expectedMin : qtyMax + 1;

    return { qtyMin, qtyMax, sampleCount };
  });
}

function normalizeInstrumentPrefixesInput(prefixes) {
  if (!Array.isArray(prefixes) || prefixes.length !== 5) {
    throw createHttpError(400, 'ต้องระบุ prefix เครื่องมือวัด 5 ช่อง');
  }

  return prefixes.map((prefix, index) => {
    const text = requireText(prefix, `prefix เครื่องมือ ${index + 1}`, 20);

    if (!/^A-\d{2}-$/.test(text)) {
      throw createHttpError(400, `prefix เครื่องมือ ${index + 1} ต้องอยู่ในรูปแบบ A-00-`);
    }

    return { slotNo: index + 1, prefix: text };
  });
}

export function isSystemSettingsSchemaError(error) {
  return ['ER_BAD_FIELD_ERROR', 'ER_NO_SUCH_TABLE'].includes(error?.code);
}

function mapFormTopic(row) {
  return {
    id: row.id,
    formType: row.form_type,
    topicName: row.topic_name,
    inputCount: Number(row.input_count || 0),
    decimalPlaces: Number(row.decimal_places || 0),
    inputType: row.input_type,
    measurePieces: row.measure_pieces,
    displayOrder: Number(row.display_order || 0),
    remark: row.remark || '',
    ruleKey: row.rule_key || '',
    isActive: Boolean(row.is_active)
  };
}

function parseJsonColumn(value, fallback = null) {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mapAuditLog(row) {
  return {
    id: row.id,
    settingArea: row.setting_area,
    action: row.action,
    targetType: row.target_type || '',
    targetId: row.target_id,
    reason: row.reason || '',
    beforeData: parseJsonColumn(row.before_data),
    afterData: parseJsonColumn(row.after_data),
    changedBy: row.changed_by,
    actorName: row.actor_name_snapshot || '',
    actorPosition: row.actor_position_snapshot || '',
    createdAt: row.created_at
  };
}

function mapSamplingRule(row) {
  return {
    id: row.id,
    qtyMin: Number(row.qty_min || 0),
    qtyMax: row.qty_max === null || row.qty_max === undefined ? null : Number(row.qty_max),
    sampleCount: Number(row.sample_count || 0)
  };
}

function mapInstrumentPrefix(row) {
  return {
    slotNo: Number(row.slot_no || 0),
    prefix: row.prefix || ''
  };
}

async function getFormTopics(connection) {
  const [rows] = await connection.execute(
    `SELECT
       id,
       form_type,
       topic_name,
       input_count,
       decimal_places,
       input_type,
       measure_pieces,
       display_order,
       remark,
       rule_key,
       is_active
     FROM form_config
     ORDER BY form_type, is_active DESC, display_order, id`
  );

  return rows.reduce((groups, row) => {
    const topic = mapFormTopic(row);
    groups[topic.formType].push(topic);
    return groups;
  }, { dimension: [], packing: [] });
}

async function getSamplingRules(connection) {
  const [rows] = await connection.execute(
    `SELECT id, qty_min, qty_max, sample_count
     FROM sampling_rules
     ORDER BY qty_min, id`
  );

  return rows.map(mapSamplingRule);
}

async function getInstrumentPrefixes(connection) {
  const [rows] = await connection.execute(
    `SELECT slot_no, prefix
     FROM dimension_instrument_prefixes
     ORDER BY slot_no`
  );

  if (!rows.length) {
    return defaultInstrumentPrefixes.map((prefix, index) => ({
      slotNo: index + 1,
      prefix
    }));
  }

  return rows.map(mapInstrumentPrefix);
}

async function requireSettingsAuditTable(connection) {
  await connection.execute('SELECT id FROM system_setting_audit_logs LIMIT 0');
}

async function getDraftCounts(connection) {
  const [rows] = await connection.execute(
    `SELECT
       (SELECT COUNT(*) FROM dimension_inspections WHERE status = 'draft') AS dimension_draft_count,
       (SELECT COUNT(*) FROM packing_inspections WHERE status = 'draft') AS packing_draft_count`
  );
  const row = rows[0] || {};

  return {
    dimensionDraftCount: Number(row.dimension_draft_count || 0),
    packingDraftCount: Number(row.packing_draft_count || 0)
  };
}

async function requireNoInspectionDrafts(connection) {
  const draftCounts = await getDraftCounts(connection);

  if (draftCounts.dimensionDraftCount || draftCounts.packingDraftCount) {
    throw createHttpErrorWithDetails(
      409,
      `ยังมีใบตรวจ draft ค้าง (${getDraftCountsText(draftCounts)}) กรุณาทำใบตรวจให้สมบูรณ์ก่อนแก้หัวข้อ`,
      draftCounts
    );
  }
}

async function getAuditLogs(connection) {
  const [rows] = await connection.execute(
    `SELECT
       id,
       setting_area,
       action,
       target_type,
       target_id,
       reason,
       before_data,
       after_data,
       changed_by,
       actor_name_snapshot,
       actor_position_snapshot,
       created_at
     FROM system_setting_audit_logs
     ORDER BY created_at DESC, id DESC
     LIMIT 50`
  );

  return rows.map(mapAuditLog);
}

async function findTopicById(topicId, connection) {
  const [rows] = await connection.execute(
    `SELECT
       id,
       form_type,
       topic_name,
       input_count,
       decimal_places,
       input_type,
       measure_pieces,
       display_order,
       remark,
       rule_key,
       is_active
     FROM form_config
     WHERE id = ?
     LIMIT 1`,
    [topicId]
  );

  return rows[0] ? mapFormTopic(rows[0]) : null;
}

async function findNameConflicts({ formType, topicName, excludeTopicId = null, connection }) {
  const params = [formType, topicName.toLowerCase()];
  let excludeSql = '';

  if (excludeTopicId) {
    excludeSql = 'AND id <> ?';
    params.push(excludeTopicId);
  }

  const [rows] = await connection.execute(
    `SELECT id, is_active
     FROM form_config
     WHERE form_type = ?
       AND LOWER(TRIM(topic_name)) = ?
       ${excludeSql}`,
    params
  );

  return {
    hasActive: rows.some((row) => Boolean(row.is_active)),
    hasInactive: rows.some((row) => !row.is_active)
  };
}

async function getNextDisplayOrder(formType, connection) {
  const [rows] = await connection.execute(
    `SELECT COALESCE(MAX(display_order), 0) AS max_order
     FROM form_config
     WHERE form_type = ?`,
    [formType]
  );

  return Number(rows[0]?.max_order || 0) + 1;
}

function getTopicNameLockKey(formType, topicName) {
  return `settings_topic:${formType}:${topicName.toLowerCase()}`;
}

async function acquireTopicNameLock({ formType, topicName, connection }) {
  const [rows] = await connection.execute(
    'SELECT GET_LOCK(?, 5) AS lock_status',
    [getTopicNameLockKey(formType, topicName)]
  );

  if (Number(rows[0]?.lock_status) !== 1) {
    throw createHttpError(409, 'มีผู้ใช้อื่นกำลังเพิ่มหัวข้อชื่อนี้อยู่ กรุณาลองใหม่อีกครั้ง');
  }
}

async function releaseTopicNameLock({ formType, topicName, connection }) {
  await connection.execute(
    'SELECT RELEASE_LOCK(?) AS released',
    [getTopicNameLockKey(formType, topicName)]
  );
}

async function countOtherActiveTopics({ formType, topicId, connection }) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS active_count
     FROM form_config
     WHERE form_type = ?
       AND is_active = TRUE
       AND id <> ?`,
    [formType, topicId]
  );

  return Number(rows[0]?.active_count || 0);
}

async function insertSettingsAuditLog({
  connection,
  settingArea,
  action,
  targetType = 'form_config',
  targetId,
  reason,
  beforeData,
  afterData,
  user
}) {
  const userId = requireActorUser(user);

  await connection.execute(
    `INSERT INTO system_setting_audit_logs (
       setting_area,
       action,
       target_type,
       target_id,
       reason,
       before_data,
       after_data,
       changed_by,
       actor_name_snapshot,
       actor_position_snapshot
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      settingArea,
      action,
      targetType,
      targetId,
      reason || null,
      beforeData ? JSON.stringify(beforeData) : null,
      afterData ? JSON.stringify(afterData) : null,
      userId,
      cleanOptionalText(user?.fullName || user?.employeeCode || user?.id, 'ชื่อผู้แก้', maxTextLength.userName) || null,
      cleanOptionalText(user?.position, 'ตำแหน่งผู้แก้', maxTextLength.userPosition) || null
    ]
  );
}

async function runSettingsMutation(callback, connection) {
  if (connection) {
    return callback(connection);
  }

  const dbConnection = await db.getConnection();

  try {
    await dbConnection.beginTransaction();
    const result = await callback(dbConnection);
    await dbConnection.commit();
    return result;
  } catch (error) {
    await dbConnection.rollback();
    throw error;
  } finally {
    dbConnection.release();
  }
}

export async function getSystemSettings(connection = db) {
  try {
    await requireSettingsAuditTable(connection);

    return {
      formTopics: await getFormTopics(connection),
      samplingRules: await getSamplingRules(connection),
      draftCounts: await getDraftCounts(connection),
      auditLogs: await getAuditLogs(connection),
      instrumentPrefixes: await getInstrumentPrefixes(connection)
    };
  } catch (error) {
    if (isSystemSettingsSchemaError(error)) {
      throw createHttpError(409, settingsMigrationMessage);
    }

    throw error;
  }
}

export async function updateSamplingRules({
  rules,
  reason,
  user,
  connection = null
}) {
  const normalizedRules = normalizeSamplingRulesInput(rules);
  const cleanedReason = requireText(reason, 'เหตุผล', maxTextLength.reason);

  return runSettingsMutation(async (activeConnection) => {
    await requireNoInspectionDrafts(activeConnection);

    const beforeRules = await getSamplingRules(activeConnection);

    await activeConnection.execute('DELETE FROM sampling_rules');

    for (const rule of normalizedRules) {
      await activeConnection.execute(
        `INSERT INTO sampling_rules (qty_min, qty_max, sample_count)
         VALUES (?, ?, ?)`,
        [rule.qtyMin, rule.qtyMax, rule.sampleCount]
      );
    }

    const afterRules = await getSamplingRules(activeConnection);

    await insertSettingsAuditLog({
      connection: activeConnection,
      settingArea: 'sampling_rules',
      action: 'update_sampling_rules',
      targetType: 'sampling_rules',
      targetId: null,
      reason: cleanedReason,
      beforeData: beforeRules,
      afterData: afterRules,
      user
    });

    return {
      ok: true,
      message: 'บันทึกจำนวนสุ่มตรวจแล้ว',
      rules: afterRules
    };
  }, connection);
}

export async function updateInstrumentPrefixes({
  prefixes,
  reason,
  user,
  connection = null
}) {
  const normalizedPrefixes = normalizeInstrumentPrefixesInput(prefixes);
  const cleanedReason = requireText(reason, 'เหตุผล', maxTextLength.reason);

  return runSettingsMutation(async (activeConnection) => {
    await requireNoInspectionDrafts(activeConnection);

    const beforePrefixes = await getInstrumentPrefixes(activeConnection);

    for (const item of normalizedPrefixes) {
      await activeConnection.execute(
        `INSERT INTO dimension_instrument_prefixes (slot_no, prefix)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE prefix = VALUES(prefix), updated_at = CURRENT_TIMESTAMP`,
        [item.slotNo, item.prefix]
      );
    }

    const afterPrefixes = await getInstrumentPrefixes(activeConnection);

    await insertSettingsAuditLog({
      connection: activeConnection,
      settingArea: 'dimension_instrument_prefixes',
      action: 'update_instrument_prefixes',
      targetType: 'dimension_instrument_prefixes',
      targetId: null,
      reason: cleanedReason,
      beforeData: beforePrefixes,
      afterData: afterPrefixes,
      user
    });

    return {
      ok: true,
      message: 'บันทึก prefix เครื่องมือวัดแล้ว',
      prefixes: afterPrefixes
    };
  }, connection);
}

export async function createInspectionTopic({
  formType,
  input,
  user,
  connection = null
}) {
  const normalizedFormType = validateFormType(formType);
  const normalizedInput = normalizeTopicInput(input, normalizedFormType);

  async function createWithConnection(activeConnection) {
    await requireNoInspectionDrafts(activeConnection);

    const conflicts = await findNameConflicts({
      formType: normalizedFormType,
      topicName: normalizedInput.topicName,
      connection: activeConnection
    });

    if (conflicts.hasActive) {
      throw createHttpError(409, 'มีหัวข้อชื่อนี้ที่ใช้งานอยู่แล้วในฟอร์มนี้');
    }

    const displayOrder = await getNextDisplayOrder(normalizedFormType, activeConnection);
    const [result] = await activeConnection.execute(
      `INSERT INTO form_config (
         form_type,
         topic_name,
         input_count,
         decimal_places,
         input_type,
         measure_pieces,
         rule_key,
         display_order,
         remark,
         is_active
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [
        normalizedFormType,
        normalizedInput.topicName,
        normalizedInput.inputCount,
        normalizedInput.decimalPlaces,
        normalizedInput.inputType,
        normalizedInput.measurePieces,
        normalizedInput.ruleKey || null,
        displayOrder,
        normalizedInput.remark || null
      ]
    );

    const topic = await findTopicById(result.insertId, activeConnection);

    await insertSettingsAuditLog({
      connection: activeConnection,
      settingArea: normalizedFormType,
      action: 'add_topic',
      targetId: topic.id,
      reason: normalizedInput.reason,
      beforeData: null,
      afterData: topic,
      user
    });

    return {
      ok: true,
      message: 'เพิ่มหัวข้อใหม่แล้ว',
      topic,
      duplicateInactiveWarning: conflicts.hasInactive
    };
  }

  if (connection) {
    await acquireTopicNameLock({
      formType: normalizedFormType,
      topicName: normalizedInput.topicName,
      connection
    });

    try {
      return await createWithConnection(connection);
    } finally {
      await releaseTopicNameLock({
        formType: normalizedFormType,
        topicName: normalizedInput.topicName,
        connection
      });
    }
  }

  const dbConnection = await db.getConnection();
  let lockAcquired = false;
  let transactionStarted = false;

  try {
    await acquireTopicNameLock({
      formType: normalizedFormType,
      topicName: normalizedInput.topicName,
      connection: dbConnection
    });
    lockAcquired = true;

    await dbConnection.beginTransaction();
    transactionStarted = true;
    const result = await createWithConnection(dbConnection);
    await dbConnection.commit();
    transactionStarted = false;
    return result;
  } catch (error) {
    if (transactionStarted) {
      await dbConnection.rollback();
    }
    throw error;
  } finally {
    if (lockAcquired) {
      await releaseTopicNameLock({
        formType: normalizedFormType,
        topicName: normalizedInput.topicName,
        connection: dbConnection
      });
    }
    dbConnection.release();
  }
}

export async function updateInspectionTopicDisplay({
  topicId,
  input,
  user,
  connection = null
}) {
  const id = validateInteger(topicId, 'หัวข้อ', { min: 1, max: 999999999 });
  const normalizedInput = normalizeTopicDisplayInput(input);

  return runSettingsMutation(async (activeConnection) => {
    await requireNoInspectionDrafts(activeConnection);

    const beforeTopic = await findTopicById(id, activeConnection);

    if (!beforeTopic) {
      throw createHttpError(404, 'ไม่พบหัวข้อที่ต้องการแก้ไข');
    }

    await activeConnection.execute(
      `UPDATE form_config
       SET display_order = ?,
           remark = ?
       WHERE id = ?`,
      [normalizedInput.displayOrder, normalizedInput.remark || null, id]
    );

    const afterTopic = await findTopicById(id, activeConnection);

    await insertSettingsAuditLog({
      connection: activeConnection,
      settingArea: beforeTopic.formType,
      action: 'update_topic_display',
      targetId: id,
      reason: cleanOptionalText(input?.reason, 'เหตุผล', maxTextLength.reason),
      beforeData: beforeTopic,
      afterData: afterTopic,
      user
    });

    return {
      ok: true,
      message: 'บันทึกลำดับ/หมายเหตุแล้ว',
      topic: afterTopic
    };
  }, connection);
}

export async function updateInspectionTopicDisplays({
  items,
  user,
  connection = null
}) {
  if (!Array.isArray(items) || items.length < 1) {
    throw createHttpError(400, 'กรุณาระบุหัวข้อที่ต้องการบันทึก');
  }

  if (items.length > 100) {
    throw createHttpError(400, 'บันทึกหัวข้อได้สูงสุด 100 รายการต่อครั้ง');
  }

  return runSettingsMutation(async (activeConnection) => {
    await requireNoInspectionDrafts(activeConnection);

    const topics = [];

    for (const item of items) {
      const result = await updateInspectionTopicDisplay({
        topicId: item?.topicId,
        input: item,
        user,
        connection: activeConnection
      });

      topics.push(result.topic);
    }

    return {
      ok: true,
      message: `บันทึกการแก้ไข ${topics.length} หัวข้อแล้ว`,
      topics
    };
  }, connection);
}

export async function deactivateInspectionTopic({
  topicId,
  input,
  user,
  connection = null
}) {
  const id = validateInteger(topicId, 'หัวข้อ', { min: 1, max: 999999999 });
  const reason = requireText(input?.reason, 'เหตุผล', maxTextLength.reason);

  return runSettingsMutation(async (activeConnection) => {
    await requireNoInspectionDrafts(activeConnection);

    const beforeTopic = await findTopicById(id, activeConnection);

    if (!beforeTopic) {
      throw createHttpError(404, 'ไม่พบหัวข้อที่ต้องการปิดใช้งาน');
    }

    if (!beforeTopic.isActive) {
      throw createHttpError(409, 'หัวข้อนี้ปิดใช้งานอยู่แล้ว');
    }

    const otherActiveCount = await countOtherActiveTopics({
      formType: beforeTopic.formType,
      topicId: id,
      connection: activeConnection
    });

    if (otherActiveCount < 1) {
      throw createHttpError(409, 'ต้องเหลือหัวข้อที่ใช้งานอย่างน้อย 1 หัวข้อในฟอร์มนี้');
    }

    await activeConnection.execute(
      `UPDATE form_config
       SET is_active = FALSE
       WHERE id = ?`,
      [id]
    );

    const afterTopic = await findTopicById(id, activeConnection);

    await insertSettingsAuditLog({
      connection: activeConnection,
      settingArea: beforeTopic.formType,
      action: 'deactivate_topic',
      targetId: id,
      reason,
      beforeData: beforeTopic,
      afterData: afterTopic,
      user
    });

    return {
      ok: true,
      message: 'ปิดใช้งานหัวข้อแล้ว',
      topic: afterTopic
    };
  }, connection);
}
