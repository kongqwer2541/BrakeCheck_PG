import { postgresDb } from '../config/database.js';
import { withPostgresTransaction } from '../utils/postgres-transaction.js';
import { hasDimensionFailResult } from './dimension-inspection.service.js';
import { createCurrentNgConfirmationExistsSql } from './lot-approval-evidence.service.js';
import { hasPackingFailResult } from './packing-inspection.service.js';

const maxTextLength = {
  lotNumber: 20,
  lotPackBarcode: 50,
  lotPacking: 50,
  modelName: 200,
  dimension: 100,
  aciGrade: 20,
  code: 20,
  purchaseOrder: 50,
  remark: 1000,
  manualReason: 500,
  editReason: 500,
  voidReason: 500,
  approvalReason: 500
};

const lotLookupLimit = 50;
const maxSearchLength = 80;
const approvalQueueDefaultPageSize = 50;
const approvalQueueStatuses = ['waiting_approve', 'ng'];
const approvalWorkflowTransitions = {
  approve: {
    fromStatus: 'waiting_approve',
    nextStatus: 'approved',
    requiresReason: false,
    defaultReason: 'อนุมัติ Lot'
  },
  cancel_approve: {
    fromStatus: 'approved',
    nextStatus: 'waiting_approve',
    requiresReason: true,
    defaultReason: ''
  },
  send_back: {
    fromStatus: 'waiting_approve',
    nextStatus: 'need_fix',
    requiresReason: true,
    defaultReason: ''
  },
  review_ng: {
    fromStatus: 'ng',
    nextStatus: 'need_fix',
    requiresReason: true,
    defaultReason: ''
  },
  confirm_ng: {
    fromStatus: 'ng',
    nextStatus: 'ng',
    requiresReason: false,
    defaultReason: 'รับทราบ NG'
  }
};

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

function requireText(value, fieldName, maxLength) {
  const text = cleanText(value);

  if (!text) {
    throw createHttpError(400, `กรุณากรอก${fieldName}`);
  }

  if (text.length > maxLength) {
    throw createHttpError(400, `${fieldName}ยาวเกิน ${maxLength} ตัวอักษร`);
  }

  return text;
}

export function isApprovalQueueStatus(status) {
  return approvalQueueStatuses.includes(status);
}

export function validateApprovalQueueTab(value) {
  const tab = cleanText(value) || 'waiting_approve';

  if (!isApprovalQueueStatus(tab)) {
    throw createHttpError(400, 'แท็บคิวตรวจและอนุมัติไม่ถูกต้อง');
  }

  return tab;
}

export function getApprovalWorkflowTransition(action, currentStatus) {
  const selectedAction = cleanText(action);
  const transition = approvalWorkflowTransitions[selectedAction];

  if (!transition) {
    throw createHttpError(400, 'คำสั่งตรวจและอนุมัติไม่ถูกต้อง');
  }

  if (currentStatus !== transition.fromStatus) {
    if (selectedAction === 'send_back' && currentStatus === 'approved') {
      throw createHttpError(409, 'Lot นี้อนุมัติแล้ว ต้องยกเลิกอนุมัติก่อนส่งกลับแก้ไข');
    }

    throw createHttpError(
      409,
      `Lot นี้อยู่สถานะ ${getLotStatusLabel(currentStatus)} ไม่สามารถทำคำสั่งนี้ได้`
    );
  }

  return {
    action: selectedAction,
    nextStatus: transition.nextStatus,
    requiresReason: transition.requiresReason,
    defaultReason: transition.defaultReason
  };
}

function validateLotCode(value, fieldName, maxLength) {
  const text = requireText(value, fieldName, maxLength);

  if (!/^[A-Za-z0-9-]+$/.test(text)) {
    throw createHttpError(400, `${fieldName}ใช้ได้เฉพาะตัวอักษรอังกฤษ ตัวเลข และขีดกลาง`);
  }

  return text;
}

function normalizeNumericLookup(value, fieldName, maxLength) {
  const text = String(value || '').replace(/\s+/g, '');

  if (!text) {
    throw createHttpError(400, `กรุณากรอก${fieldName}`);
  }

  if (text.length > maxLength) {
    throw createHttpError(400, `${fieldName}ยาวเกิน ${maxLength} ตัวอักษร`);
  }

  if (!/^[0-9]+$/.test(text)) {
    throw createHttpError(400, `${fieldName}ต้องเป็นตัวเลขเท่านั้น`);
  }

  return text;
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

function validateDate(value) {
  const dateText = requireText(value, 'วันฝน', 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    throw createHttpError(400, 'วันฝนไม่ถูกต้อง');
  }

  const [year, month, day] = dateText.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw createHttpError(400, 'วันฝนไม่ถูกต้อง');
  }

  return dateText;
}

function validateQuantity(value) {
  const quantity = Number(value);

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw createHttpError(400, 'จำนวนชิ้นต้องเป็นตัวเลขมากกว่า 0');
  }

  if (quantity > 999999) {
    throw createHttpError(400, 'จำนวนชิ้นมากเกินไป');
  }

  return quantity;
}

async function getSampleCount(quantity, connection) {
  const { rows } = await connection.query(
    `SELECT sample_count
     FROM sampling_rules
     WHERE qty_min <= $1
       AND (qty_max IS NULL OR qty_max >= $2)
     ORDER BY qty_min DESC
     LIMIT 1`,
    [quantity, quantity]
  );

  if (!rows.length) {
    throw createHttpError(400, `ไม่พบกฎการสุ่มตรวจสำหรับจำนวนชิ้น ${quantity}`);
  }

  return Number(rows[0].sample_count);
}

function normalizeManualLot(input = {}) {
  const lotNumber = validateLotCode(input.lotNumber, 'Lot', maxTextLength.lotNumber);
  const lotPackBarcode = validateLotCode(input.lotPackBarcode, 'Lot Pack', maxTextLength.lotPackBarcode);
  const lotPacking = cleanOptionalText(input.lotPacking, 'Lot ผลิต', maxTextLength.lotPacking) || '-';
  const quantity = validateQuantity(input.quantity);

  return {
    lotNumber,
    lotPackBarcode,
    lotPacking,
    modelName: requireText(input.modelName, 'รุ่น', maxTextLength.modelName),
    dimension: requireText(input.dimension, 'รายละเอียด / ขนาด', maxTextLength.dimension),
    aciGrade: requireText(input.aciGrade, 'เกรด', maxTextLength.aciGrade),
    code: cleanOptionalText(input.code, 'Code', maxTextLength.code),
    purchaseOrder: cleanOptionalText(input.purchaseOrder, 'ใบสั่งซื้อ', maxTextLength.purchaseOrder),
    remark1: cleanOptionalText(input.remark1, 'บันทึก / รหัสยางนอก', maxTextLength.remark),
    remark2: cleanOptionalText(input.remark2, 'ยิงเลเซอร์', maxTextLength.remark),
    remark3: cleanOptionalText(input.remark3, 'หมายเหตุเพิ่ม', maxTextLength.remark),
    productionDate: validateDate(input.productionDate),
    quantity,
    manualReason: requireText(input.manualReason, 'เหตุผลการเพิ่ม Manual', maxTextLength.manualReason)
  };
}

function normalizeLotUpdate(input = {}) {
  const lotPackBarcode = validateLotCode(input.lotPackBarcode, 'Lot Pack', maxTextLength.lotPackBarcode);
  const lotPacking = cleanOptionalText(input.lotPacking, 'Lot ผลิต', maxTextLength.lotPacking) || '-';
  const quantity = validateQuantity(input.quantity);

  return {
    lotPackBarcode,
    lotPacking,
    modelName: requireText(input.modelName, 'รุ่น', maxTextLength.modelName),
    dimension: requireText(input.dimension, 'รายละเอียด / ขนาด', maxTextLength.dimension),
    aciGrade: requireText(input.aciGrade, 'เกรด', maxTextLength.aciGrade),
    code: cleanOptionalText(input.code, 'Code', maxTextLength.code),
    purchaseOrder: cleanOptionalText(input.purchaseOrder, 'ใบสั่งซื้อ', maxTextLength.purchaseOrder),
    remark1: cleanOptionalText(input.remark1, 'บันทึก / รหัสยางนอก', maxTextLength.remark),
    remark2: cleanOptionalText(input.remark2, 'ยิงเลเซอร์', maxTextLength.remark),
    remark3: cleanOptionalText(input.remark3, 'หมายเหตุเพิ่ม', maxTextLength.remark),
    productionDate: validateDate(input.productionDate),
    quantity,
    editReason: requireText(input.editReason, 'เหตุผลการแก้ไข', maxTextLength.editReason)
  };
}

async function findLotByNumber(lotNumber, connection) {
  const { rows } = await connection.query(
    `SELECT id, lot_number
     FROM lots
     WHERE lot_number = $1
     LIMIT 1`,
    [lotNumber]
  );

  return rows[0] || null;
}

async function findLotDetailByNumber(lotNumber, connection) {
  const { rows } = await connection.query(
    `SELECT
       id,
       lot_number,
       lot_pack_barcode,
       lot_packing,
       model_name,
       dimension,
       aci_grade,
       code,
       purchase_order,
       production_date,
       quantity,
       sample_count,
       remark1,
       remark2,
       remark3,
       manual_reason,
       status,
       import_source,
       voided_by,
       voided_at,
       void_reason,
       created_at,
       updated_at
     FROM lots
     WHERE lot_number = $1
     LIMIT 1`,
    [lotNumber]
  );

  return rows[0] || null;
}

async function findLotDetailForUpdate(lotNumber, connection) {
  const { rows } = await connection.query(
    `SELECT
       id,
       lot_number,
       lot_pack_barcode,
       lot_packing,
       model_name,
       dimension,
       aci_grade,
       code,
       purchase_order,
       production_date,
       quantity,
       sample_count,
       remark1,
       remark2,
       remark3,
       manual_reason,
       status,
       import_source,
       voided_by,
       voided_at,
       void_reason,
       created_at,
       updated_at
     FROM lots
     WHERE lot_number = $1
     LIMIT 1
     FOR UPDATE`,
    [lotNumber]
  );

  return rows[0] || null;
}

async function findApprovalInspectionStatus(lotId, connection) {
  const { rows } = await connection.query(
    `SELECT
       d.status AS dimension_status,
       d.pieces_data AS dimension_pieces_data,
       p.status AS packing_status,
       p.results_data AS packing_results_data
     FROM lots l
     LEFT JOIN dimension_inspections d ON d.lot_id = l.id
     LEFT JOIN packing_inspections p ON p.lot_id = l.id
     WHERE l.id = $1
     LIMIT 1`,
    [lotId]
  );

  return rows[0] || {};
}

function requireEditableLot(lot) {
  if (!lot) {
    throw createHttpError(404, 'ไม่พบ Lot ที่ต้องการ');
  }

  if (lot.status === 'approved') {
    throw createHttpError(409, 'Lot นี้ Approved แล้ว ต้องยกเลิก Approved ก่อนจึงจะแก้ไขได้');
  }

  if (lot.status === 'void') {
    throw createHttpError(409, 'Lot นี้ถูก Void แล้ว ไม่สามารถแก้ไขซ้ำได้');
  }
}

function requireActorUser(user) {
  const userId = Number(user?.id);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw createHttpError(401, 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
  }

  return userId;
}

function mapLotDetail(row) {
  return {
    lotNumber: row.lot_number,
    lotPackBarcode: row.lot_pack_barcode || '',
    lotPacking: row.lot_packing || '-',
    modelName: row.model_name || '',
    dimension: row.dimension || '',
    aciGrade: row.aci_grade || '',
    code: row.code || '',
    purchaseOrder: row.purchase_order || '',
    productionDate: toDateText(row.production_date) || '',
    quantity: Number(row.quantity || 0),
    sampleCount: Number(row.sample_count || 0),
    remark1: row.remark1 || '',
    remark2: row.remark2 || '',
    remark3: row.remark3 || '',
    manualReason: row.manual_reason || '',
    status: row.status,
    statusLabel: getLotStatusLabel(row.status),
    importSource: row.import_source,
    voidedAt: row.voided_at,
    voidReason: row.void_reason || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapLotLookupRow(row) {
  return {
    lotNumber: row.lot_number,
    lotPackBarcode: row.lot_pack_barcode || '',
    lotPacking: row.lot_packing || '-',
    purchaseOrder: row.purchase_order || '',
    code: row.code || '',
    modelName: row.model_name || '',
    dimension: row.dimension || '',
    aciGrade: row.aci_grade || '',
    drillSize: row.drill_size ?? '',
    boreSize: row.bore_size ?? '',
    quantity: Number(row.quantity || 0),
    productionDate: toDateText(row.production_date) || '',
    status: row.status,
    statusLabel: getLotStatusLabel(row.status)
  };
}

function mapLotLookupResult(rows, matchType) {
  const limitedRows = rows.slice(0, lotLookupLimit);

  return {
    matchType,
    count: limitedRows.length,
    hasMore: rows.length > lotLookupLimit,
    lots: limitedRows.map(mapLotLookupRow)
  };
}

async function findLotLookupRowsByLotPack(lotPackBarcode) {
  const { rows } = await postgresDb.query(
    `SELECT
       lot_number,
       lot_pack_barcode,
       lot_packing,
       purchase_order,
       code,
       model_name,
       dimension,
       aci_grade,
       drill_size,
       bore_size,
       quantity,
       production_date,
       status
     FROM lots
     WHERE lot_pack_barcode = $1
     ORDER BY
       production_date DESC,
       lot_number ASC
     LIMIT ${lotLookupLimit + 1}`,
    [lotPackBarcode]
  );

  return mapLotLookupResult(rows, 'lotPack');
}

async function findLotLookupRowsByLotNumber(lotNumber) {
  const { rows } = await postgresDb.query(
    `SELECT
       lot_number,
       lot_pack_barcode,
       lot_packing,
       purchase_order,
       code,
       model_name,
       dimension,
       aci_grade,
       drill_size,
       bore_size,
       quantity,
       production_date,
       status
     FROM lots
     WHERE lot_number = $1
     ORDER BY
       production_date DESC,
       lot_number ASC
     LIMIT ${lotLookupLimit + 1}`,
    [lotNumber]
  );

  return mapLotLookupResult(rows, 'lot');
}

function getLotSnapshot(row) {
  return {
    lotNumber: row.lot_number,
    lotPackBarcode: row.lot_pack_barcode,
    lotPacking: row.lot_packing,
    modelName: row.model_name,
    dimension: row.dimension,
    aciGrade: row.aci_grade,
    code: row.code,
    purchaseOrder: row.purchase_order,
    productionDate: toDateText(row.production_date),
    quantity: Number(row.quantity || 0),
    sampleCount: Number(row.sample_count || 0),
    remark1: row.remark1,
    remark2: row.remark2,
    remark3: row.remark3,
    manualReason: row.manual_reason,
    status: row.status,
    importSource: row.import_source,
    voidedAt: row.voided_at,
    voidReason: row.void_reason
  };
}

function requireReadyForApproval(inspectionStatus) {
  if (inspectionStatus.dimension_status !== 'completed') {
    throw createHttpError(409, 'ยังไม่มีใบตรวจมิติที่บันทึกสมบูรณ์');
  }

  if (inspectionStatus.packing_status !== 'completed') {
    throw createHttpError(409, 'ยังไม่มีใบตรวจบรรจุที่บันทึกสมบูรณ์');
  }

  const dimensionPiecesData = parseJsonColumn(inspectionStatus.dimension_pieces_data, { topics: [] });
  const packingResultsData = parseJsonColumn(inspectionStatus.packing_results_data, { topics: [] });

  if (hasDimensionFailResult(dimensionPiecesData) || hasPackingFailResult(packingResultsData)) {
    throw createHttpError(409, 'ใบตรวจล่าสุดยังมีผลไม่ผ่าน ไม่สามารถอนุมัติได้');
  }
}

function normalizeApprovalReason(reason, transition) {
  if (!transition.requiresReason) {
    return transition.defaultReason;
  }

  return requireText(reason, 'หมายเหตุ', maxTextLength.approvalReason);
}

function buildAuditActorSnapshot(user) {
  if (!user?.id) {
    return {
      name: null,
      position: null
    };
  }

  return {
    name: cleanText(user.fullName || user.employeeCode || user.id).slice(0, 200) || null,
    position: cleanText(user.position).slice(0, 100) || null
  };
}

export function requireNoDuplicateConfirmNg(action, existingAuditCount) {
  if (action === 'confirm_ng' && Number(existingAuditCount || 0) > 0) {
    throw createHttpError(409, 'Lot นี้มีผู้รับทราบ NG แล้ว');
  }
}

async function countLotAuditAction({ lotId, action, connection }) {
  const { rows } = await connection.query(
    `SELECT COUNT(*) AS total
     FROM lot_audit_logs current_action
     WHERE current_action.lot_id = $1
       AND current_action.action = $2
       AND NOT EXISTS (
         SELECT 1
         FROM lot_audit_logs reviewed_ng
         WHERE reviewed_ng.lot_id = current_action.lot_id
           AND reviewed_ng.action = 'review_ng'
           AND reviewed_ng.id > current_action.id
       )`,
    [lotId, action]
  );

  return Number(rows?.[0]?.total || 0);
}

async function insertLotAuditLog({ lotId, action, reason, beforeData, afterData, userId, actorSnapshot, connection }) {
  await connection.query(
    `INSERT INTO lot_audit_logs (
       lot_id,
       action,
       reason,
       before_data,
       after_data,
       changed_by,
       actor_name_snapshot,
       actor_position_snapshot
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      lotId,
      action,
      reason,
      JSON.stringify(beforeData),
      JSON.stringify(afterData),
      userId || null,
      actorSnapshot?.name || null,
      actorSnapshot?.position || null
    ]
  );
}

function normalizeApprovalSearch(value) {
  const text = cleanText(value);

  if (text.length > maxSearchLength) {
    throw createHttpError(400, `คำค้นหายาวเกิน ${maxSearchLength} ตัวอักษร`);
  }

  return text;
}

function validateOptionalDate(value) {
  const text = cleanText(value);

  if (!text || text === 'all') {
    return '';
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw createHttpError(400, 'วันที่ผลิตไม่ถูกต้อง');
  }

  return text;
}

function normalizeApprovalPage(value) {
  const page = Number(value || 1);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function normalizeApprovalPageSize(value) {
  if (value === 'all') {
    return 'all';
  }

  const pageSize = Number(value || approvalQueueDefaultPageSize);
  return Number.isInteger(pageSize) && pageSize > 0 && pageSize <= 100
    ? pageSize
    : approvalQueueDefaultPageSize;
}

export function buildApprovalQueueLimitClause(pageSize, offset) {
  if (pageSize === 'all') {
    return '';
  }

  const safePageSize = Number.isInteger(pageSize) && pageSize > 0 && pageSize <= 100
    ? pageSize
    : approvalQueueDefaultPageSize;
  const safeOffset = Number.isInteger(offset) && offset >= 0
    ? offset
    : 0;

  return `LIMIT ${safePageSize} OFFSET ${safeOffset}`;
}

function createApprovalQueueWhere({ tab, date, search }) {
  const conditions = ['lots.status = $1'];
  const params = [tab];

  if (tab === 'ng') {
    params.push('confirm_ng');
    conditions.push(`NOT ${createCurrentNgConfirmationExistsSql({
      confirmationAlias: 'acknowledged_ng',
      actionExpression: `$${params.length}`
    })}`);
  }

  if (date) {
    params.push(date);
    conditions.push(`lots.production_date = $${params.length}`);
  }

  if (search) {
    const firstSearchParam = params.length + 1;
    conditions.push(`(
      lots.lot_number ILIKE $${firstSearchParam} ESCAPE '\\'
      OR lots.lot_pack_barcode ILIKE $${firstSearchParam + 1} ESCAPE '\\'
      OR lots.lot_packing ILIKE $${firstSearchParam + 2} ESCAPE '\\'
      OR lots.model_name ILIKE $${firstSearchParam + 3} ESCAPE '\\'
    )`);
    const escapedSearch = search.replace(/[\\%_]/g, '\\$&');
    const likeSearch = `%${escapedSearch}%`;
    params.push(likeSearch, likeSearch, likeSearch, likeSearch);
  }

  return {
    sql: `WHERE ${conditions.join(' AND ')}`,
    params
  };
}

function mapApprovalQueueRow(row) {
  return {
    lotNumber: row.lot_number,
    lotPackBarcode: row.lot_pack_barcode || '',
    lotPacking: row.lot_packing || '-',
    modelName: row.model_name || '',
    dimension: row.dimension || '',
    purchaseOrder: row.purchase_order || '',
    quantity: Number(row.quantity || 0),
    productionDate: toDateText(row.production_date) || '',
    status: row.status,
    statusLabel: getLotStatusLabel(row.status),
    attachmentCount: Number(row.attachment_count || 0)
  };
}

export async function getApprovalQueue({ tab, date, search, page, pageSize }) {
  const selectedTab = validateApprovalQueueTab(tab);
  const selectedDate = validateOptionalDate(date);
  const searchText = normalizeApprovalSearch(search);
  const requestedPage = normalizeApprovalPage(page);
  const selectedPageSize = normalizeApprovalPageSize(pageSize);
  const where = createApprovalQueueWhere({
    tab: selectedTab,
    date: selectedDate,
    search: searchText
  });

  const { rows: countRows } = await postgresDb.query(
    `SELECT COUNT(*) AS total
     FROM lots
     ${where.sql}`,
    where.params
  );
  const totalItems = Number(countRows[0]?.total || 0);
  const pageSizeNumber = selectedPageSize === 'all' ? totalItems || approvalQueueDefaultPageSize : selectedPageSize;
  const totalPages = selectedPageSize === 'all' ? 1 : Math.max(1, Math.ceil(totalItems / pageSizeNumber));
  const safePage = Math.min(requestedPage, totalPages);
  const offset = (safePage - 1) * pageSizeNumber;
  const limitSql = buildApprovalQueueLimitClause(selectedPageSize, offset);

  const { rows } = await postgresDb.query(
    `SELECT
       lot_number,
       lot_pack_barcode,
       lot_packing,
       model_name,
       dimension,
       purchase_order,
       quantity,
       production_date,
       status,
       updated_at,
       COALESCE(attachment_counts.attachment_count, 0) AS attachment_count
     FROM lots
     LEFT JOIN (
       SELECT lot_id, COUNT(*) AS attachment_count
       FROM lot_attachments
       WHERE deleted_at IS NULL
       GROUP BY lot_id
     ) attachment_counts ON attachment_counts.lot_id = lots.id
     ${where.sql}
     ORDER BY updated_at DESC, lot_number ASC
     ${limitSql}`,
    where.params
  );

  const { rows: badgeRows } = await postgresDb.query(
    `SELECT COUNT(*) AS total
     FROM lots
     WHERE lots.status = 'waiting_approve'
       OR (
         lots.status = 'ng'
         AND NOT ${createCurrentNgConfirmationExistsSql({
           confirmationAlias: 'acknowledged_ng',
           actionExpression: '$1'
         })}
       )`,
    ['confirm_ng']
  );

  return {
    ok: true,
    tab: selectedTab,
    items: rows.map(mapApprovalQueueRow),
    badgeCount: Number(badgeRows[0]?.total || 0),
    summary: {
      totalItems,
      page: safePage,
      pageSize: selectedPageSize,
      totalPages,
      date: selectedDate || 'all',
      search: searchText
    }
  };
}

export async function applyApprovalWorkflowAction({ lotNumber, action, reason, user }) {
  const cleanedLotNumber = validateLotCode(lotNumber, 'Lot', maxTextLength.lotNumber);
  const actorUserId = requireActorUser(user);
  const actorSnapshot = buildAuditActorSnapshot(user);
  return withPostgresTransaction(postgresDb, async (connection) => {

    const currentLot = await findLotDetailForUpdate(cleanedLotNumber, connection);
    if (!currentLot) {
      throw createHttpError(404, 'ไม่พบ Lot ที่ต้องการ');
    }

    const transition = getApprovalWorkflowTransition(action, currentLot.status);
    const auditReason = normalizeApprovalReason(reason, transition);

    if (transition.action === 'approve') {
      const inspectionStatus = await findApprovalInspectionStatus(currentLot.id, connection);
      requireReadyForApproval(inspectionStatus);
    }

    if (transition.action === 'confirm_ng') {
      const existingAuditCount = await countLotAuditAction({
        lotId: currentLot.id,
        action: transition.action,
        connection
      });
      requireNoDuplicateConfirmNg(transition.action, existingAuditCount);
    }

    const beforeData = getLotSnapshot(currentLot);

    await connection.query(
      `UPDATE lots
       SET status = $1
       WHERE id = $2`,
      [transition.nextStatus, currentLot.id]
    );

    const updatedLot = await findLotDetailByNumber(cleanedLotNumber, connection);
    const afterData = getLotSnapshot(updatedLot);

    await insertLotAuditLog({
      lotId: currentLot.id,
      action: transition.action,
      reason: auditReason,
      beforeData,
      afterData,
      userId: actorUserId,
      actorSnapshot,
      connection
    });

    return {
      ok: true,
      message: getApprovalWorkflowMessage(transition.action),
      lot: mapLotDetail(updatedLot)
    };
  });
}

function getApprovalWorkflowMessage(action) {
  const messages = {
    approve: 'อนุมัติ Lot สำเร็จ',
    cancel_approve: 'ยกเลิกอนุมัติ Lot สำเร็จ',
    send_back: 'ส่งกลับแก้ไขสำเร็จ',
    review_ng: 'ส่งงาน NG ไปทบทวนสำเร็จ',
    confirm_ng: 'รับทราบ NG สำเร็จ'
  };

  return messages[action] || 'บันทึกสถานะสำเร็จ';
}

export async function createManualLot({ input, user }) {
  const actorUserId = requireActorUser(user);
  const lot = normalizeManualLot(input);
  try {
    return await withPostgresTransaction(postgresDb, async (connection) => {
      const existingLot = await findLotByNumber(lot.lotNumber, connection);
      if (existingLot) {
        throw createHttpError(409, 'Lot นี้มีอยู่แล้วในระบบ กรุณาตรวจสอบก่อนบันทึก');
      }

      const sampleCount = await getSampleCount(lot.quantity, connection);

      await connection.query(
        `INSERT INTO lots (
           lot_number,
           lot_pack_barcode,
           lot_packing,
           model_name,
           dimension,
           aci_grade,
           code,
           purchase_order,
           production_date,
           quantity,
           sample_count,
           remark1,
           remark2,
           remark3,
           manual_reason,
           status,
           imported_by,
           import_source
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'pending', $16, 'manual')`,
        [
          lot.lotNumber,
          lot.lotPackBarcode,
          lot.lotPacking,
          lot.modelName,
          lot.dimension,
          lot.aciGrade,
          lot.code,
          lot.purchaseOrder,
          lot.productionDate,
          lot.quantity,
          sampleCount,
          lot.remark1,
          lot.remark2,
          lot.remark3,
          lot.manualReason,
          actorUserId
        ]
      );

      return {
        ok: true,
        message: 'เพิ่ม Manual Lot สำเร็จ',
        lot: {
          lotNumber: lot.lotNumber,
          lotPackBarcode: lot.lotPackBarcode,
          lotPacking: lot.lotPacking,
          productionDate: lot.productionDate,
          quantity: lot.quantity,
          sampleCount,
          importSource: 'manual',
          status: 'pending'
        }
      };
    });
  } catch (error) {
    if (error.code === '23505') {
      throw createHttpError(409, 'Lot นี้มีอยู่แล้วในระบบ กรุณาตรวจสอบก่อนบันทึก');
    }

    throw error;
  }
}

export async function getLotDetail({ lotNumber }) {
  const cleanedLotNumber = validateLotCode(lotNumber, 'Lot', maxTextLength.lotNumber);
  const lot = await findLotDetailByNumber(cleanedLotNumber, postgresDb);

  if (!lot) {
    throw createHttpError(404, 'ไม่พบ Lot ที่ต้องการ');
  }

  return {
    ok: true,
    lot: mapLotDetail(lot)
  };
}

export async function lookupLotsByScanCode({ scanCode }) {
  const cleanedScanCode = normalizeNumericLookup(
    scanCode,
    'Lot Pack / Lot',
    maxTextLength.lotPackBarcode
  );

  const lotPackResult = await findLotLookupRowsByLotPack(cleanedScanCode);

  if (lotPackResult.count > 0) {
    return {
      ok: true,
      query: cleanedScanCode,
      limit: lotLookupLimit,
      ...lotPackResult
    };
  }

  const lotResult = await findLotLookupRowsByLotNumber(cleanedScanCode);

  return {
    ok: true,
    query: cleanedScanCode,
    limit: lotLookupLimit,
    ...lotResult
  };
}

export async function updateLot({ lotNumber, input, user }) {
  const cleanedLotNumber = validateLotCode(lotNumber, 'Lot', maxTextLength.lotNumber);
  const lotUpdate = normalizeLotUpdate(input);
  const actorUserId = requireActorUser(user);
  const actorSnapshot = buildAuditActorSnapshot(user);
  return withPostgresTransaction(postgresDb, async (connection) => {

    const currentLot = await findLotDetailForUpdate(cleanedLotNumber, connection);
    requireEditableLot(currentLot);

    const sampleCount = await getSampleCount(lotUpdate.quantity, connection);
    const beforeData = getLotSnapshot(currentLot);

    await connection.query(
      `UPDATE lots
       SET lot_pack_barcode = $1,
           lot_packing = $2,
           model_name = $3,
           dimension = $4,
           aci_grade = $5,
           code = $6,
           purchase_order = $7,
           production_date = $8,
           quantity = $9,
           sample_count = $10,
           remark1 = $11,
           remark2 = $12,
           remark3 = $13
       WHERE id = $14`,
      [
        lotUpdate.lotPackBarcode,
        lotUpdate.lotPacking,
        lotUpdate.modelName,
        lotUpdate.dimension,
        lotUpdate.aciGrade,
        lotUpdate.code,
        lotUpdate.purchaseOrder,
        lotUpdate.productionDate,
        lotUpdate.quantity,
        sampleCount,
        lotUpdate.remark1,
        lotUpdate.remark2,
        lotUpdate.remark3,
        currentLot.id
      ]
    );

    const updatedLot = await findLotDetailByNumber(cleanedLotNumber, connection);
    const afterData = getLotSnapshot(updatedLot);

    await insertLotAuditLog({
      lotId: currentLot.id,
      action: 'edit',
      reason: lotUpdate.editReason,
      beforeData,
      afterData,
      userId: actorUserId,
      actorSnapshot,
      connection
    });

    return {
      ok: true,
      message: 'บันทึกการแก้ไข Lot สำเร็จ',
      lot: mapLotDetail(updatedLot)
    };
  });
}

export async function voidLot({ lotNumber, reason, user }) {
  const cleanedLotNumber = validateLotCode(lotNumber, 'Lot', maxTextLength.lotNumber);
  const voidReason = requireText(reason, 'เหตุผลการ Void', maxTextLength.voidReason);
  const actorUserId = requireActorUser(user);
  const actorSnapshot = buildAuditActorSnapshot(user);
  return withPostgresTransaction(postgresDb, async (connection) => {

    const currentLot = await findLotDetailForUpdate(cleanedLotNumber, connection);
    requireEditableLot(currentLot);

    const beforeData = getLotSnapshot(currentLot);

    await connection.query(
      `UPDATE lots
       SET status = 'void',
           voided_by = $1,
           voided_at = CURRENT_TIMESTAMP,
           void_reason = $2
       WHERE id = $3`,
      [
        actorUserId,
        voidReason,
        currentLot.id
      ]
    );

    const updatedLot = await findLotDetailByNumber(cleanedLotNumber, connection);
    const afterData = getLotSnapshot(updatedLot);

    await insertLotAuditLog({
      lotId: currentLot.id,
      action: 'void',
      reason: voidReason,
      beforeData,
      afterData,
      userId: actorUserId,
      actorSnapshot,
      connection
    });

    return {
      ok: true,
      message: 'Void Lot สำเร็จ',
      lot: mapLotDetail(updatedLot)
    };
  });
}
