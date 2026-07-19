import { postgresDb } from '../config/database.js';

const maxSearchLength = 80;
const defaultHistoryRows = 50;
const allHistoryRowsValue = 'all';
const allowedHistoryPageSizes = [String(defaultHistoryRows), allHistoryRowsValue];

const allowedLotStatuses = [
  'all',
  'pending',
  'temp',
  'waiting_pack',
  'waiting_approve',
  'need_fix',
  'approved',
  'ng',
  'void'
];

const allowedAuditActions = [
  'all',
  'edit',
  'void',
  'approve',
  'cancel_approve',
  'send_back',
  'review_ng',
  'confirm_ng',
  'upload_attachment',
  'delete_attachment'
];

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

const actionLabels = {
  edit: 'แก้ไข',
  void: 'Void',
  approve: 'อนุมัติ',
  cancel_approve: 'ยกเลิกอนุมัติ',
  send_back: 'ส่งกลับแก้ไข',
  review_ng: 'ทบทวน NG',
  confirm_ng: 'รับทราบ NG'
};

actionLabels.upload_attachment = 'แนบไฟล์ Lot';
actionLabels.delete_attachment = 'ลบไฟล์แนบ Lot';

const changedFieldLabels = {
  lotNumber: 'Lot',
  lotPackBarcode: 'Lot Pack',
  lotPacking: 'Lot ผลิต',
  modelName: 'รุ่น',
  dimension: 'รายละเอียด / ขนาด',
  aciGrade: 'เกรด',
  code: 'Code',
  purchaseOrder: 'ใบสั่งซื้อ',
  productionDate: 'วันฝน',
  quantity: 'จำนวนชิ้น',
  sampleCount: 'จำนวนสุ่มตรวจ',
  remark1: 'บันทึก / รหัสยางนอก',
  remark2: 'ยิงเลเซอร์',
  remark3: 'หมายเหตุเพิ่ม',
  manualReason: 'เหตุผลการเพิ่ม Manual',
  status: 'สถานะ',
  importSource: 'แหล่งที่มา',
  voidedAt: 'เวลาที่ Void',
  voidReason: 'เหตุผลการ Void'
};

function getStatusLabel(status) {
  return statusLabels[status] || status || '-';
}

function formatAuditReason(reason) {
  const text = cleanText(reason);
  const dimensionStatusMatch = text.match(/^(?:dimension inspection status|ตรวจมิติเปลี่ยนสถานะ Lot):\s*([a-z_]+)\s*->\s*([a-z_]+)$/);

  if (dimensionStatusMatch) {
    const [, beforeStatus, afterStatus] = dimensionStatusMatch;
    return `ตรวจมิติเปลี่ยนสถานะ Lot: ${getStatusLabel(beforeStatus)} -> ${getStatusLabel(afterStatus)}`;
  }

  return text || '-';
}

function createBadRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function cleanText(value) {
  return String(value || '').trim();
}

function validateOptionalDate(value) {
  const dateText = cleanText(value);

  if (!dateText) {
    return '';
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    throw createBadRequest('วันที่ไม่ถูกต้อง');
  }

  const [year, month, day] = dateText.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw createBadRequest('วันที่ไม่ถูกต้อง');
  }

  return dateText;
}

function cleanSearch(value) {
  return cleanText(value).slice(0, maxSearchLength);
}

function normalizePageSize(value) {
  const pageSize = cleanText(value) || String(defaultHistoryRows);

  if (!allowedHistoryPageSizes.includes(pageSize)) {
    throw createBadRequest('จำนวนรายการต่อหน้าไม่ถูกต้อง');
  }

  if (pageSize === allHistoryRowsValue) {
    return allHistoryRowsValue;
  }

  return defaultHistoryRows;
}

function normalizePage(value) {
  const pageText = value === undefined || value === null || value === ''
    ? ''
    : String(value).trim();
  const page = pageText ? Number(pageText) : 1;

  if (!Number.isInteger(page) || page < 1) {
    throw createBadRequest('หน้าที่เลือกไม่ถูกต้อง');
  }

  return page;
}

function getPagination({ totalRows, pageSize, requestedPage }) {
  if (pageSize === allHistoryRowsValue) {
    return {
      currentPage: 1,
      totalPages: 1,
      limitSql: ''
    };
  }

  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const offset = (currentPage - 1) * pageSize;

  return {
    currentPage,
    totalPages,
    limitSql: `LIMIT ${pageSize} OFFSET ${offset}`
  };
}

function normalizeLotStatus(value) {
  const status = cleanText(value) || 'all';

  if (!allowedLotStatuses.includes(status)) {
    throw createBadRequest('ตัวกรองสถานะไม่ถูกต้อง');
  }

  return status;
}

function normalizeAuditAction(value) {
  const action = cleanText(value) || 'all';

  if (!allowedAuditActions.includes(action)) {
    throw createBadRequest('ตัวกรองประวัติแก้ไขไม่ถูกต้อง');
  }

  return action;
}

function escapeLikeSearch(value) {
  return value.replace(/[\\%_]/g, (matchedText) => `\\${matchedText}`);
}

function addParameter(params, value) {
  params.push(value);
  return `$${params.length}`;
}

function toDateText(value) {
  if (!value) {
    return '-';
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return String(value).slice(0, 10);
}

function toDateTimeText(value) {
  if (!value) {
    return '-';
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    const hour = String(value.getHours()).padStart(2, '0');
    const minute = String(value.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  }

  return String(value).slice(0, 16).replace('T', ' ');
}

function safeJson(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getChangedFields(beforeData, afterData) {
  const before = safeJson(beforeData) || {};
  const after = safeJson(afterData) || {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  return Array.from(keys)
    .filter((key) => JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null))
    .sort()
    .map((key) => changedFieldLabels[key] || key);
}

function createLotWhere({ selectedDate, status, search }) {
  const conditions = [];
  const params = [];

  if (selectedDate) {
    conditions.push(`l.production_date = ${addParameter(params, selectedDate)}`);
  }

  if (status !== 'all') {
    conditions.push(`l.status = ${addParameter(params, status)}`);
  }

  if (search) {
    const searchParam = addParameter(params, `%${escapeLikeSearch(search)}%`);
    conditions.push(`(
      l.lot_number ILIKE ${searchParam} ESCAPE '\\'
      OR l.lot_pack_barcode ILIKE ${searchParam} ESCAPE '\\'
      OR l.lot_packing ILIKE ${searchParam} ESCAPE '\\'
      OR l.purchase_order ILIKE ${searchParam} ESCAPE '\\'
      OR l.model_name ILIKE ${searchParam} ESCAPE '\\'
    )`);
  }

  return {
    sql: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params
  };
}

function createImportWhere({ selectedDate, search }) {
  const conditions = [];
  const params = [];

  if (selectedDate) {
    conditions.push(`DATE(b.uploaded_at) = ${addParameter(params, selectedDate)}`);
  }

  if (search) {
    const searchParam = addParameter(params, `%${escapeLikeSearch(search)}%`);
    conditions.push(`b.original_file_name ILIKE ${searchParam} ESCAPE '\\'`);
  }

  return {
    sql: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params
  };
}

function createAuditWhere({ selectedDate, action, search }) {
  const conditions = [];
  const params = [];

  if (selectedDate) {
    conditions.push(`DATE(a.created_at) = ${addParameter(params, selectedDate)}`);
  }

  if (action !== 'all') {
    conditions.push(`a.action = ${addParameter(params, action)}`);
  }

  if (search) {
    const searchParam = addParameter(params, `%${escapeLikeSearch(search)}%`);
    conditions.push(`(
      l.lot_number ILIKE ${searchParam} ESCAPE '\\'
      OR l.lot_pack_barcode ILIKE ${searchParam} ESCAPE '\\'
      OR l.lot_packing ILIKE ${searchParam} ESCAPE '\\'
      OR a.reason ILIKE ${searchParam} ESCAPE '\\'
    )`);
  }

  return {
    sql: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params
  };
}

function mapLot(row) {
  return {
    lotNumber: row.lot_number,
    lotPackBarcode: row.lot_pack_barcode || '-',
    lotPacking: row.lot_packing || '-',
    purchaseOrder: row.purchase_order || '-',
    modelName: row.model_name || '-',
    dimension: row.dimension || '-',
    aciGrade: row.aci_grade || '-',
    quantity: Number(row.quantity || 0),
    status: row.status,
    statusLabel: statusLabels[row.status] || row.status,
    importSource: row.import_source || '-',
    productionDate: toDateText(row.production_date),
    importedBy: row.imported_by_name || '-',
    updatedAt: toDateTimeText(row.updated_at)
  };
}

function mapImportBatch(row) {
  return {
    id: row.id,
    originalFileName: row.original_file_name,
    sheetName: row.sheet_name,
    totalRows: Number(row.total_rows || 0),
    importedRows: Number(row.imported_rows || 0),
    skippedRows: Number(row.skipped_rows || 0),
    uploadedBy: row.uploaded_by_name || '-',
    uploadedAt: toDateTimeText(row.uploaded_at)
  };
}

function mapAudit(row) {
  const changedFields = getChangedFields(row.before_data, row.after_data);

  return {
    id: row.id,
    lotNumber: row.lot_number || '-',
    lotPackBarcode: row.lot_pack_barcode || '-',
    lotPacking: row.lot_packing || '-',
    action: row.action,
    actionLabel: actionLabels[row.action] || row.action,
    reason: formatAuditReason(row.reason),
    changedFields,
    changedBy: row.changed_by_name_snapshot || row.changed_by_name || '-',
    changedByPosition: row.changed_by_position_snapshot || row.changed_by_position || '-',
    createdAt: toDateTimeText(row.created_at)
  };
}

export async function getLotHistory({ date, status, search, page, pageSize }) {
  const selectedDate = validateOptionalDate(date);
  const selectedStatus = normalizeLotStatus(status);
  const searchText = cleanSearch(search);
  const selectedPageSize = normalizePageSize(pageSize);
  const requestedPage = normalizePage(page);
  const where = createLotWhere({
    selectedDate,
    status: selectedStatus,
    search: searchText
  });

  const { rows: countRows } = await postgresDb.query(
    `SELECT COUNT(*) AS total
     FROM lots l
     ${where.sql}`,
    where.params
  );

  const totalRows = Number(countRows[0]?.total || 0);
  const pagination = getPagination({
    totalRows,
    pageSize: selectedPageSize,
    requestedPage
  });

  const { rows } = await postgresDb.query(
    `SELECT
       l.lot_number,
       l.lot_pack_barcode,
       l.lot_packing,
       l.purchase_order,
       l.model_name,
       l.dimension,
       l.aci_grade,
       l.quantity,
       l.status,
       l.import_source,
       l.production_date,
       l.updated_at,
       u.full_name AS imported_by_name
     FROM lots l
     LEFT JOIN users u ON u.id = l.imported_by
     ${where.sql}
     ORDER BY l.updated_at DESC, l.id DESC
     ${pagination.limitSql}`,
    where.params
  );

  return {
    ok: true,
    items: rows.map(mapLot),
    summary: {
      totalItems: totalRows,
      shownItems: rows.length,
      page: pagination.currentPage,
      pageSize: selectedPageSize,
      totalPages: pagination.totalPages
    }
  };
}

export async function getImportHistory({ date, search, page, pageSize }) {
  const selectedDate = validateOptionalDate(date);
  const searchText = cleanSearch(search);
  const selectedPageSize = normalizePageSize(pageSize);
  const requestedPage = normalizePage(page);
  const where = createImportWhere({ selectedDate, search: searchText });

  const { rows: countRows } = await postgresDb.query(
    `SELECT COUNT(*) AS total
     FROM excel_import_batches b
     ${where.sql}`,
    where.params
  );

  const totalRows = Number(countRows[0]?.total || 0);
  const pagination = getPagination({
    totalRows,
    pageSize: selectedPageSize,
    requestedPage
  });

  const { rows } = await postgresDb.query(
    `SELECT
       b.id,
       b.original_file_name,
       b.sheet_name,
       b.total_rows,
       b.imported_rows,
       b.skipped_rows,
       b.uploaded_at,
       u.full_name AS uploaded_by_name
     FROM excel_import_batches b
     LEFT JOIN users u ON u.id = b.uploaded_by
     ${where.sql}
     ORDER BY b.uploaded_at DESC, b.id DESC
     ${pagination.limitSql}`,
    where.params
  );

  return {
    ok: true,
    items: rows.map(mapImportBatch),
    summary: {
      totalItems: totalRows,
      shownItems: rows.length,
      page: pagination.currentPage,
      pageSize: selectedPageSize,
      totalPages: pagination.totalPages
    }
  };
}

export async function getAuditHistory({ date, action, search, page, pageSize }) {
  const selectedDate = validateOptionalDate(date);
  const selectedAction = normalizeAuditAction(action);
  const searchText = cleanSearch(search);
  const selectedPageSize = normalizePageSize(pageSize);
  const requestedPage = normalizePage(page);
  const where = createAuditWhere({
    selectedDate,
    action: selectedAction,
    search: searchText
  });

  const { rows: countRows } = await postgresDb.query(
    `SELECT COUNT(*) AS total
     FROM lot_audit_logs a
     INNER JOIN lots l ON l.id = a.lot_id
     ${where.sql}`,
    where.params
  );

  const totalRows = Number(countRows[0]?.total || 0);
  const pagination = getPagination({
    totalRows,
    pageSize: selectedPageSize,
    requestedPage
  });

  const { rows } = await postgresDb.query(
    `SELECT
       a.id,
       a.action,
       a.reason,
       a.before_data,
       a.after_data,
       a.created_at,
       l.lot_number,
       l.lot_pack_barcode,
       l.lot_packing,
       a.actor_name_snapshot AS changed_by_name_snapshot,
       a.actor_position_snapshot AS changed_by_position_snapshot,
       u.full_name AS changed_by_name,
       u.position AS changed_by_position
     FROM lot_audit_logs a
     INNER JOIN lots l ON l.id = a.lot_id
     LEFT JOIN users u ON u.id = a.changed_by
     ${where.sql}
     ORDER BY a.created_at DESC, a.id DESC
     ${pagination.limitSql}`,
    where.params
  );

  return {
    ok: true,
    items: rows.map(mapAudit),
    summary: {
      totalItems: totalRows,
      shownItems: rows.length,
      page: pagination.currentPage,
      pageSize: selectedPageSize,
      totalPages: pagination.totalPages
    }
  };
}
