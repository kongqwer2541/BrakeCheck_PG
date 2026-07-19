import { postgresDb } from '../config/database.js';
import { withPostgresTransaction } from '../utils/postgres-transaction.js';
import { getLotApprovalEvidence } from './lot-approval-evidence.service.js';

const maxTextLength = {
  lotNumber: 20,
  inspectionNote: 200,
  userName: 100,
  userPosition: 100
};
const maxJsonTextLength = 200000;

function createHttpError(statusCode, message, details = null) {
  const error = new Error(message);
  error.statusCode = statusCode;

  if (details) {
    error.details = details;
  }

  return error;
}

function cleanText(value) {
  return String(value || '').trim();
}

function cleanOptionalText(value, fieldName, maxLength) {
  const text = cleanText(value);

  if (!text) {
    return null;
  }

  if (text.length > maxLength) {
    throw createHttpError(400, `${fieldName}ยาวเกิน ${maxLength} ตัวอักษร`);
  }

  return text;
}

function validateLotNumber(value) {
  const text = cleanText(value);

  if (!text) {
    throw createHttpError(400, 'กรุณาระบุ Lot');
  }

  if (text.length > maxTextLength.lotNumber) {
    throw createHttpError(400, `Lot ยาวเกิน ${maxTextLength.lotNumber} ตัวอักษร`);
  }

  if (!/^[A-Za-z0-9-]+$/.test(text)) {
    throw createHttpError(400, 'Lot ใช้ได้เฉพาะตัวอักษรอังกฤษ ตัวเลข และขีดกลาง');
  }

  return text;
}

function validateJsonValue(value, fieldName, isRequired) {
  if (value === null || value === undefined) {
    if (isRequired) {
      throw createHttpError(400, `กรุณาระบุ${fieldName}`);
    }

    return { meta: {}, topics: [] };
  }

  if (typeof value !== 'object') {
    throw createHttpError(400, `${fieldName}ต้องเป็นข้อมูล JSON`);
  }

  let jsonText = '';

  try {
    jsonText = JSON.stringify(value);
  } catch {
    throw createHttpError(400, `${fieldName}ต้องเป็นข้อมูล JSON ที่บันทึกได้`);
  }

  if (jsonText.length > maxJsonTextLength) {
    throw createHttpError(400, `${fieldName}มีขนาดใหญ่เกินไป`);
  }

  return value;
}

function requireActorUser(user) {
  const userId = Number(user?.id);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw createHttpError(401, 'Session หมดอายุ กรุณา Login ใหม่');
  }

  return userId;
}

export function canEditCompletedPackingInspection(user) {
  return ['head', 'assistant'].includes(user?.role);
}

function toDateText(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return value.slice(0, 10);
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return String(value).slice(0, 10);
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

function getLotStatusLabel(status) {
  const statusLabels = {
    pending: 'รอตรวจ',
    temp: 'กำลังตรวจ',
    waiting_pack: 'รอตรวจบรรจุ',
    waiting_approve: 'รออนุมัติ',
    need_fix: 'รอแก้ไข',
    approved: 'Approved',
    ng: 'NG',
    void: 'Void'
  };

  return statusLabels[status] || status || '-';
}

function isBlankPackingReference(value) {
  const text = cleanText(value);
  return !text || text === '-';
}

export function getPackingReferenceFromLot(lot) {
  const lotPacking = cleanText(lot?.lot_packing ?? lot?.lotPacking);

  if (isBlankPackingReference(lotPacking)) {
    return null;
  }

  return {
    value: lotPacking,
    source: 'lot_packing',
    sourceLabel: 'Lot ผลิตจาก Excel'
  };
}

export function getPackingReferenceFromProductionCode(productionCode) {
  const cleanedProductionCode = cleanText(productionCode);

  if (isBlankPackingReference(cleanedProductionCode)) {
    return null;
  }

  return {
    value: cleanedProductionCode,
    source: 'dimension_production_code',
    sourceLabel: 'รหัสผลิตจากฟอร์มตรวจมิติ'
  };
}

export function getPackingReferenceFromInspection(inspection) {
  const meta = parseJsonColumn(inspection?.results_data ?? inspection?.resultsData, { meta: {} })?.meta || {};
  const value = cleanText(meta.packingReferenceValue);
  const source = cleanText(meta.packingReferenceSource);
  const sourceLabel = cleanText(meta.packingReferenceSourceLabel);

  if (isBlankPackingReference(value)) {
    return null;
  }

  return {
    value,
    source: source || 'saved_snapshot',
    sourceLabel: sourceLabel || 'ข้อมูลที่บันทึกไว้'
  };
}

export function canSavePackingInspectionForLot({ lotStatus, inspectionStatus, userRole }) {
  if (inspectionStatus === 'completed' && canEditCompletedPackingInspection({ role: userRole })) {
    return true;
  }

  if (inspectionStatus === 'draft' && ['temp', 'ng'].includes(lotStatus)) {
    return true;
  }

  return lotStatus === 'waiting_pack';
}

export function hasPackingFailResult(resultsData) {
  const topics = Array.isArray(resultsData?.topics) ? resultsData.topics : [];
  return topics.some((topic) => cleanText(topic?.value) === 'fail');
}

export function getNextLotStatusForPacking(status, resultsData) {
  if (hasPackingFailResult(resultsData)) {
    return 'ng';
  }

  if (status === 'draft') {
    return 'temp';
  }

  return 'waiting_approve';
}

function getInspectionNote(resultsData) {
  return cleanOptionalText(
    resultsData?.meta?.inspectionNote,
    'หมายเหตุการตรวจบรรจุ',
    maxTextLength.inspectionNote
  ) || '';
}

function getSavedTopic(resultsData, configTopic) {
  const topics = Array.isArray(resultsData?.topics) ? resultsData.topics : [];
  const topicId = String(configTopic.id);

  return topics.find((topic) => cleanText(topic?.topicId) === topicId)
    || topics.find((topic) => cleanText(topic?.topicName) === configTopic.topicName)
    || null;
}

function validatePackingTopicValue(value, configTopic) {
  const text = cleanText(value);

  if (!text) {
    return '';
  }

  if (configTopic.inputType === 'pass_fail') {
    if (!['pass', 'fail'].includes(text)) {
      throw createHttpError(400, `${configTopic.topicName} ต้องเลือกผ่านหรือไม่ผ่าน`);
    }

    return text;
  }

  const decimalPlaces = Number(configTopic.decimalPlaces || 0);
  const pattern = decimalPlaces === 0
    ? /^\d+$/
    : new RegExp(`^\\d+\\.\\d{${decimalPlaces}}$`);

  if (!pattern.test(text)) {
    throw createHttpError(400, `${configTopic.topicName} ต้องเป็นตัวเลขที่มีทศนิยม ${decimalPlaces} ตำแหน่ง`);
  }

  return text;
}

function normalizePackingResults(resultsData, formConfig = []) {
  const inspectionNote = getInspectionNote(resultsData);
  const topics = formConfig.map((configTopic) => {
    const savedTopic = getSavedTopic(resultsData, configTopic);
    const value = validatePackingTopicValue(savedTopic?.value, configTopic);

    return {
      topicId: configTopic.id,
      topicName: configTopic.topicName,
      referenceNote: configTopic.remark || '',
      inputType: configTopic.inputType || 'pass_fail',
      value
    };
  }).filter((topic) => topic.value);

  return {
    meta: inspectionNote ? { inspectionNote } : {},
    topics
  };
}

export function validatePackingResultsForComplete({ resultsData, formConfig }) {
  if (!Array.isArray(formConfig) || !formConfig.length) {
    throw createHttpError(400, 'ยังไม่มีหัวข้อฟอร์มตรวจบรรจุสำหรับบันทึกสมบูรณ์');
  }

  formConfig.forEach((configTopic) => {
    const topic = getSavedTopic(resultsData, configTopic);
    const value = validatePackingTopicValue(topic?.value, configTopic);

    if (!value) {
      const actionText = configTopic.inputType === 'pass_fail' ? 'เลือก' : 'กรอก';
      throw createHttpError(400, `กรุณา${actionText}ผลตรวจ ${configTopic.topicName}`);
    }
  });

  if (hasPackingFailResult(resultsData) && !getInspectionNote(resultsData)) {
    throw createHttpError(400, 'กรุณากรอกหมายเหตุเมื่อมีหัวข้อไม่ผ่าน');
  }
}

function attachPackingSaveSnapshot(resultsData, status, user) {
  const normalizedResultsData = {
    ...resultsData,
    topics: Array.isArray(resultsData?.topics) ? resultsData.topics : []
  };
  const meta = normalizedResultsData.meta && typeof normalizedResultsData.meta === 'object'
    ? { ...normalizedResultsData.meta }
    : {};
  const keyPrefix = status === 'completed' ? 'completed' : 'draft';
  const savedByName = cleanOptionalText(
    user?.fullName || user?.employeeCode || user?.id,
    'ชื่อผู้บันทึก',
    maxTextLength.userName
  ) || '';
  const savedByPosition = cleanOptionalText(
    user?.position,
    'ตำแหน่งผู้บันทึก',
    maxTextLength.userPosition
  ) || '';

  meta[`${keyPrefix}SavedByName`] = savedByName;
  meta[`${keyPrefix}SavedAt`] = new Date().toISOString();

  if (savedByPosition) {
    meta[`${keyPrefix}SavedByPosition`] = savedByPosition;
  } else {
    delete meta[`${keyPrefix}SavedByPosition`];
  }

  normalizedResultsData.meta = meta;
  return normalizedResultsData;
}

function attachPackingReferenceSnapshot(resultsData, packingReference) {
  const normalizedResultsData = {
    ...resultsData,
    topics: Array.isArray(resultsData?.topics) ? resultsData.topics : []
  };
  const meta = normalizedResultsData.meta && typeof normalizedResultsData.meta === 'object'
    ? { ...normalizedResultsData.meta }
    : {};

  meta.packingReferenceValue = packingReference.value;
  meta.packingReferenceSource = packingReference.source;
  meta.packingReferenceSourceLabel = packingReference.sourceLabel;
  normalizedResultsData.meta = meta;

  return normalizedResultsData;
}

function mapLot(row) {
  return {
    lotNumber: row.lot_number,
    lotPackBarcode: row.lot_pack_barcode || '',
    lotPacking: row.lot_packing || '-',
    purchaseOrder: row.purchase_order || '',
    code: row.code || '',
    modelName: row.model_name || '',
    dimension: row.dimension || '',
    aciGrade: row.aci_grade || '',
    quantity: Number(row.quantity || 0),
    productionDate: toDateText(row.production_date) || '',
    drillSize: row.drill_size ?? '',
    boreSize: row.bore_size ?? '',
    rivetNo: row.rivet_no || '',
    status: row.status,
    statusLabel: getLotStatusLabel(row.status),
    sampleCount: Number(row.sample_count || 0)
  };
}

function mapInspection(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    status: row.status,
    inspectionDate: toDateText(row.inspection_date),
    formConfigSnapshot: parseJsonColumn(row.form_config_snapshot),
    resultsData: parseJsonColumn(row.results_data, { meta: {}, topics: [] }),
    completedBy: row.completed_by,
    completedByName: row.completed_by_name || '',
    completedByPosition: row.completed_by_position || '',
    completedAt: row.completed_at,
    updatedBy: row.updated_by,
    updatedByName: row.updated_by_name || '',
    updatedByPosition: row.updated_by_position || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function getLotStatusSnapshot(lot) {
  if (!lot) {
    return null;
  }

  return {
    lotNumber: lot.lot_number,
    status: lot.status
  };
}

async function findLotForPacking(lotNumber, connection, lock = false) {
  const { rows } = await connection.query(
    `SELECT
       id,
       lot_number,
       lot_pack_barcode,
       lot_packing,
       purchase_order,
       code,
       model_name,
       dimension,
       aci_grade,
       quantity,
       production_date,
       drill_size,
       bore_size,
       rivet_no,
       status,
       sample_count
     FROM lots
     WHERE lot_number = $1
     LIMIT 1
     ${lock ? 'FOR UPDATE' : ''}`,
    [lotNumber]
  );

  return rows[0] || null;
}

async function getActivePackingFormConfig(connection) {
  const { rows } = await connection.query(
    `SELECT
       id,
       topic_name,
       input_count,
       decimal_places,
       input_type,
       measure_pieces,
       display_order,
       remark
     FROM form_config
     WHERE form_type = 'packing'
       AND is_active = TRUE
     ORDER BY display_order, id`
  );

  return rows.map((row) => ({
    id: row.id,
    topicName: row.topic_name,
    inputCount: Number(row.input_count || 0),
    decimalPlaces: Number(row.decimal_places || 0),
    inputType: row.input_type,
    measurePieces: row.measure_pieces,
    displayOrder: Number(row.display_order || 0),
    remark: row.remark || ''
  }));
}

async function findInspectionByLotId(lotId, connection, lock = false) {
  const lockSql = lock ? 'FOR UPDATE OF packing_inspections' : '';
  const { rows } = await connection.query(
    `SELECT
       packing_inspections.id,
       packing_inspections.status,
       packing_inspections.inspection_date,
       packing_inspections.form_config_snapshot,
       packing_inspections.results_data,
       packing_inspections.updated_by,
       updated_user.full_name AS updated_by_name,
       updated_user.position AS updated_by_position,
       packing_inspections.completed_by,
       completed_user.full_name AS completed_by_name,
       completed_user.position AS completed_by_position,
       packing_inspections.completed_at,
       packing_inspections.created_at,
       packing_inspections.updated_at
     FROM packing_inspections
     LEFT JOIN users updated_user
       ON updated_user.id = packing_inspections.updated_by
     LEFT JOIN users completed_user
       ON completed_user.id = packing_inspections.completed_by
     WHERE packing_inspections.lot_id = $1
     LIMIT 1
     ${lockSql}`,
    [lotId]
  );

  return rows[0] || null;
}

async function findDimensionProductionCodeByLotId(lotId, connection) {
  const { rows } = await connection.query(
    `SELECT production_code
     FROM dimension_inspections
     WHERE lot_id = $1
     ORDER BY updated_at DESC, id DESC
     LIMIT 1`,
    [lotId]
  );

  return cleanText(rows[0]?.production_code);
}

async function resolvePackingReference(lot, connection) {
  const lotPackingReference = getPackingReferenceFromLot(lot);

  if (lotPackingReference) {
    return lotPackingReference;
  }

  const productionCodeReference = getPackingReferenceFromProductionCode(
    await findDimensionProductionCodeByLotId(lot.id, connection)
  );

  if (productionCodeReference) {
    return productionCodeReference;
  }

  throw createHttpError(
    400,
    'Lot นี้ยังไม่มี Lot ผลิต หรือรหัสผลิตจากฟอร์มตรวจมิติ กรุณากลับไปบันทึกตรวจมิติก่อน'
  );
}

function requireEditableInspection({ lot, inspection, user }) {
  if (!lot) {
    throw createHttpError(404, 'ไม่พบ Lot ที่ต้องการ');
  }

  if (lot.status === 'void') {
    throw createHttpError(409, 'Lot นี้ถูก Void แล้ว ไม่สามารถตรวจบรรจุได้');
  }

  if (lot.status === 'approved') {
    throw createHttpError(409, 'Lot นี้ Approved แล้ว ต้องยกเลิก Approved ก่อนจึงจะแก้ไขได้');
  }

  if (inspection?.status === 'completed' && !canEditCompletedPackingInspection(user)) {
    throw createHttpError(403, 'ใบตรวจบรรจุบันทึกสมบูรณ์แล้ว ผู้ช่วยหัวหน้าขึ้นไปเท่านั้นที่แก้ไขได้');
  }
}

function requireValidStatusTransition({ currentInspection, nextStatus }) {
  if (currentInspection?.status === 'completed' && nextStatus === 'draft') {
    throw createHttpError(409, 'ใบตรวจบรรจุบันทึกสมบูรณ์แล้ว ไม่สามารถย้อนกลับเป็นบันทึกชั่วคราวได้');
  }
}

function requirePackingLotStatus({ lot, inspection, user }) {
  if (canSavePackingInspectionForLot({
    lotStatus: lot.status,
    inspectionStatus: inspection?.status,
    userRole: user?.role
  })) {
    return;
  }

  if (lot.status !== 'waiting_pack') {
    throw createHttpError(
      409,
      `Lot นี้อยู่สถานะ${getLotStatusLabel(lot.status)} ต้องเป็นสถานะรอตรวจบรรจุก่อน`
    );
  }
}

async function resolveCompleteFormConfigSnapshot(currentInspection, connection) {
  const snapshot = parseJsonColumn(currentInspection?.form_config_snapshot);

  if (Array.isArray(snapshot) && snapshot.length) {
    return snapshot;
  }

  return getActivePackingFormConfig(connection);
}

async function upsertInspection({ lot, input, userId, status, connection }) {
  const completedBy = status === 'completed' ? userId : null;

  await connection.query(
    `INSERT INTO packing_inspections (
       lot_id,
       status,
       inspection_date,
       form_config_snapshot,
       results_data,
       created_by,
       updated_by,
       completed_by,
       completed_at
     )
     VALUES (
       $1, $2, CURRENT_DATE, $3, $4, $5, $6, $7,
       CASE WHEN $2 = 'completed' THEN CURRENT_TIMESTAMP ELSE NULL END
     )
     ON CONFLICT (lot_id) DO UPDATE SET
       status = EXCLUDED.status,
       inspection_date = EXCLUDED.inspection_date,
       form_config_snapshot = EXCLUDED.form_config_snapshot,
       results_data = EXCLUDED.results_data,
       updated_by = EXCLUDED.updated_by,
       completed_by = EXCLUDED.completed_by,
       completed_at = EXCLUDED.completed_at`,
    [
      lot.id,
      status,
      input.formConfigSnapshot ? JSON.stringify(input.formConfigSnapshot) : null,
      input.resultsData ? JSON.stringify(input.resultsData) : null,
      userId,
      userId,
      completedBy
    ]
  );
}

async function insertPackingStatusAuditLog({
  lot,
  beforeStatus,
  afterStatus,
  reason,
  userId,
  connection
}) {
  await connection.query(
    `INSERT INTO lot_audit_logs (
       lot_id,
       action,
       reason,
       before_data,
       after_data,
       changed_by
     )
     VALUES ($1, 'edit', $2, $3, $4, $5)`,
    [
      lot.id,
      reason,
      JSON.stringify({ ...getLotStatusSnapshot(lot), status: beforeStatus }),
      JSON.stringify({ ...getLotStatusSnapshot(lot), status: afterStatus }),
      userId
    ]
  );
}

async function updateLotStatusForPacking({
  lot,
  nextStatus,
  userId,
  connection
}) {
  if (lot.status === nextStatus) {
    return;
  }

  const beforeStatus = lot.status;
  const reason = `ตรวจบรรจุเปลี่ยนสถานะ Lot: ${getLotStatusLabel(beforeStatus)} -> ${getLotStatusLabel(nextStatus)}`;

  await connection.query(
    `UPDATE lots
     SET status = $1
     WHERE id = $2`,
    [nextStatus, lot.id]
  );

  await insertPackingStatusAuditLog({
    lot,
    beforeStatus,
    afterStatus: nextStatus,
    reason,
    userId,
    connection
  });

  lot.status = nextStatus;
}

export async function getPackingInspection({ lotNumber }) {
  const cleanedLotNumber = validateLotNumber(lotNumber);
  const lot = await findLotForPacking(cleanedLotNumber, postgresDb);

  if (!lot) {
    throw createHttpError(404, 'ไม่พบ Lot ที่ต้องการ');
  }

  const inspection = await findInspectionByLotId(lot.id, postgresDb);
  const formConfig = await getActivePackingFormConfig(postgresDb);
  const packingReference = getPackingReferenceFromInspection(inspection)
    || await resolvePackingReference(lot, postgresDb);
  const approvalEvidence = await getLotApprovalEvidence(lot.id, postgresDb);

  return {
    ok: true,
    lot: {
      ...mapLot(lot),
      approvalEvidence
    },
    inspection: mapInspection(inspection),
    formConfig,
    packingReference
  };
}

export async function savePackingInspectionDraft({ lotNumber, input, user }) {
  return savePackingInspection({
    lotNumber,
    input,
    user,
    status: 'draft',
    isComplete: false,
    message: 'บันทึกฟอร์มตรวจบรรจุชั่วคราวแล้ว'
  });
}

export async function completePackingInspection({ lotNumber, input, user }) {
  return savePackingInspection({
    lotNumber,
    input,
    user,
    status: 'completed',
    isComplete: true,
    message: 'บันทึกฟอร์มตรวจบรรจุสมบูรณ์แล้ว'
  });
}

async function savePackingInspection({ lotNumber, input, user, status, isComplete, message }) {
  const cleanedLotNumber = validateLotNumber(lotNumber);
  const actorUserId = requireActorUser(user);
  return withPostgresTransaction(postgresDb, async (connection) => {

    const lot = await findLotForPacking(cleanedLotNumber, connection, true);
    const currentInspection = lot ? await findInspectionByLotId(lot.id, connection, true) : null;
    requireEditableInspection({ lot, inspection: currentInspection, user });
    requireValidStatusTransition({ currentInspection, nextStatus: status });
    requirePackingLotStatus({ lot, inspection: currentInspection, user });
    const packingReference = await resolvePackingReference(lot, connection);

    const activeFormConfig = await getActivePackingFormConfig(connection);
    const formConfig = isComplete
      ? await resolveCompleteFormConfigSnapshot(currentInspection, connection)
      : activeFormConfig;
    const incomingResultsData = validateJsonValue(input?.resultsData, 'ข้อมูลตรวจบรรจุ', isComplete);
    const normalizedResultsData = normalizePackingResults(incomingResultsData, formConfig);

    if (isComplete) {
      validatePackingResultsForComplete({
        resultsData: normalizedResultsData,
        formConfig
      });
    }

    const resultsWithReference = attachPackingReferenceSnapshot(normalizedResultsData, packingReference);
    const resultsData = attachPackingSaveSnapshot(resultsWithReference, status, user);
    const nextLotStatus = getNextLotStatusForPacking(status, resultsData);

    await upsertInspection({
      lot,
      input: {
        formConfigSnapshot: formConfig,
        resultsData
      },
      userId: actorUserId,
      status,
      connection
    });

    await updateLotStatusForPacking({
      lot,
      nextStatus: nextLotStatus,
      userId: actorUserId,
      connection
    });

    const savedInspection = await findInspectionByLotId(lot.id, connection);

    return {
      ok: true,
      message: nextLotStatus === 'ng'
        ? 'บันทึกฟอร์มตรวจบรรจุสมบูรณ์แล้ว พบผลไม่ผ่าน'
        : message,
      lot: mapLot(lot),
      inspection: mapInspection(savedInspection),
      packingReference
    };
  });
}
