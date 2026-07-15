import { db } from '../config/database.js';

const defaultPageSize = 50;
const resultTabs = ['approved', 'confirmed_ng'];
const pageSizeValues = ['50'];
const maxSearchLength = 80;

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function cleanText(value) {
  return String(value || '').trim();
}

function toDateText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, '0'),
      String(value.getDate()).padStart(2, '0')
    ].join('-');
  }
  return String(value).slice(0, 10);
}

function toDateTimeText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.replace('T', ' ').slice(0, 19);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${toDateText(value)} ${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}:${String(value.getSeconds()).padStart(2, '0')}`;
  }
  return String(value);
}

export function validateResultsTab(value) {
  const tab = cleanText(value) || 'approved';
  if (!resultTabs.includes(tab)) {
    throw createHttpError(400, 'แท็บ Results ไม่ถูกต้อง');
  }
  return tab;
}

function validateDate(value, fieldName) {
  const text = cleanText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw createHttpError(400, `${fieldName}ไม่ถูกต้อง`);
  }

  const [year, month, day] = text.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw createHttpError(400, `${fieldName}ไม่ถูกต้อง`);
  }

  return text;
}

function normalizeDateRange({ dateMode, startDate, endDate }) {
  if (cleanText(dateMode) === 'all') {
    return null;
  }

  const startText = cleanText(startDate);
  const endText = cleanText(endDate);
  if (!startText && !endText) {
    return null;
  }

  const selectedStart = validateDate(startText || endText, 'วันที่เริ่ม');
  const selectedEnd = validateDate(endText || startText, 'วันที่สิ้นสุด');
  if (selectedStart > selectedEnd) {
    throw createHttpError(400, 'ช่วงวันที่ไม่ถูกต้อง');
  }

  return { startDate: selectedStart, endDate: selectedEnd };
}

function normalizePage(value) {
  const page = Number(value || 1);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function normalizePageSize(value) {
  const pageSize = cleanText(value) || String(defaultPageSize);
  return pageSizeValues.includes(pageSize) ? pageSize : String(defaultPageSize);
}

function cleanSearch(value) {
  return cleanText(value).slice(0, maxSearchLength);
}

function escapeLikeSearch(value) {
  return value.replace(/[\\%_]/g, (matchedText) => `\\${matchedText}`);
}

function buildLimitClause(pageSize, offset) {
  if (pageSize === 'all') return '';
  return `LIMIT ${Number(pageSize) || defaultPageSize} OFFSET ${Number(offset) || 0}`;
}

function buildResultsWhere({ tab, dateRange, search }) {
  const base = buildResultsBaseWhere({ dateRange, search });
  const conditions = ['lots.status = ?', ...base.conditions];
  const params = [tab === 'confirmed_ng' ? 'ng' : 'approved', ...base.params];
  const action = tab === 'confirmed_ng' ? 'confirm_ng' : 'approve';

  conditions.push(`EXISTS (
    SELECT 1
    FROM lot_audit_logs evidence
    WHERE evidence.lot_id = lots.id
      AND evidence.action = ?
  )`);
  params.push(action);

  return {
    sql: `WHERE ${conditions.join(' AND ')}`,
    params,
    action
  };
}

function buildResultsBaseWhere({ dateRange, search }) {
  const conditions = [
    "dimension_inspections.status = 'completed'",
    "packing_inspections.status = 'completed'"
  ];
  const params = [];

  if (dateRange) {
    conditions.push('lots.production_date BETWEEN ? AND ?');
    params.push(dateRange.startDate, dateRange.endDate);
  }

  if (search) {
    const keyword = `%${escapeLikeSearch(search)}%`;
    conditions.push(`(
      lots.lot_number LIKE ? ESCAPE '\\\\'
      OR lots.lot_pack_barcode LIKE ? ESCAPE '\\\\'
      OR lots.lot_packing LIKE ? ESCAPE '\\\\'
      OR lots.model_name LIKE ? ESCAPE '\\\\'
      OR lots.dimension LIKE ? ESCAPE '\\\\'
    )`);
    params.push(keyword, keyword, keyword, keyword, keyword);
  }

  return { conditions, params };
}

async function getLatestResultsDate(connection = db) {
  const [rows] = await connection.execute(
    `SELECT MAX(lots.production_date) AS latest_date
     FROM lots
     INNER JOIN dimension_inspections ON dimension_inspections.lot_id = lots.id
     INNER JOIN packing_inspections ON packing_inspections.lot_id = lots.id
     WHERE lots.status IN ('approved', 'ng')
       AND dimension_inspections.status = 'completed'
       AND packing_inspections.status = 'completed'
       AND (
         EXISTS (
           SELECT 1 FROM lot_audit_logs approved_logs
           WHERE approved_logs.lot_id = lots.id
             AND approved_logs.action = 'approve'
             AND lots.status = 'approved'
         )
         OR EXISTS (
           SELECT 1 FROM lot_audit_logs ng_logs
           WHERE ng_logs.lot_id = lots.id
             AND ng_logs.action = 'confirm_ng'
             AND lots.status = 'ng'
         )
       )`
  );

  return toDateText(rows[0]?.latest_date);
}

async function getResultCounts({ dateRange, search, connection = db }) {
  const base = buildResultsBaseWhere({ dateRange, search });
  const [rows] = await connection.execute(
    `SELECT
       SUM(CASE WHEN lots.status = 'approved' AND EXISTS (
         SELECT 1 FROM lot_audit_logs approved_logs
         WHERE approved_logs.lot_id = lots.id
           AND approved_logs.action = 'approve'
       ) THEN 1 ELSE 0 END) AS approved_count,
       SUM(CASE WHEN lots.status = 'ng' AND EXISTS (
         SELECT 1 FROM lot_audit_logs ng_logs
         WHERE ng_logs.lot_id = lots.id
           AND ng_logs.action = 'confirm_ng'
       ) THEN 1 ELSE 0 END) AS confirmed_ng_count
     FROM lots
     INNER JOIN dimension_inspections ON dimension_inspections.lot_id = lots.id
     INNER JOIN packing_inspections ON packing_inspections.lot_id = lots.id
     WHERE ${base.conditions.join(' AND ')}`,
    base.params
  );

  return {
    approved: Number(rows[0]?.approved_count || 0),
    confirmedNg: Number(rows[0]?.confirmed_ng_count || 0)
  };
}

function mapResultRow(row, tab) {
  return {
    lotNumber: row.lot_number,
    lotPackBarcode: row.lot_pack_barcode || '-',
    lotPacking: row.lot_packing || '-',
    modelName: row.model_name || '-',
    dimension: row.dimension || '-',
    purchaseOrder: row.purchase_order || '-',
    quantity: Number(row.quantity || 0),
    productionDate: toDateText(row.production_date),
    completedAt: toDateTimeText(row.completed_at),
    status: row.status,
    statusLabel: tab === 'confirmed_ng' ? 'รับทราบ NG' : 'Approved',
    attachmentCount: Number(row.attachment_count || 0)
  };
}

export async function getResultsLots({
  tab,
  dateMode,
  startDate,
  endDate,
  search,
  page,
  pageSize,
  connection = db
}) {
  const selectedTab = validateResultsTab(tab);
  const latestDate = await getLatestResultsDate(connection);
  const requestedRange = normalizeDateRange({ dateMode, startDate, endDate });
  const dateRange = requestedRange || (cleanText(dateMode) === 'all' || !latestDate
    ? null
    : { startDate: latestDate, endDate: latestDate });
  const searchText = cleanSearch(search);
  const requestedPage = normalizePage(page);
  const selectedPageSize = normalizePageSize(pageSize);
  const where = buildResultsWhere({ tab: selectedTab, dateRange, search: searchText });

  const [countRows] = await connection.execute(
    `SELECT COUNT(*) AS total_items
     FROM lots
     INNER JOIN dimension_inspections ON dimension_inspections.lot_id = lots.id
     INNER JOIN packing_inspections ON packing_inspections.lot_id = lots.id
     ${where.sql}`,
    where.params
  );

  const totalItems = Number(countRows[0]?.total_items || 0);
  const pageSizeNumber = selectedPageSize === 'all' ? totalItems || defaultPageSize : Number(selectedPageSize);
  const totalPages = selectedPageSize === 'all' ? 1 : Math.max(1, Math.ceil(totalItems / pageSizeNumber));
  const safePage = selectedPageSize === 'all' ? 1 : Math.min(requestedPage, totalPages);
  const offset = selectedPageSize === 'all' ? 0 : (safePage - 1) * pageSizeNumber;
  const limitSql = buildLimitClause(selectedPageSize, offset);

  const [rows] = await connection.execute(
    `SELECT
       lots.lot_number,
       lots.lot_pack_barcode,
       lots.lot_packing,
       lots.model_name,
       lots.dimension,
       lots.purchase_order,
       lots.quantity,
       lots.production_date,
       lots.status,
       completed_evidence.completed_at AS completed_at,
       COUNT(lot_attachments.id) AS attachment_count
     FROM lots
     INNER JOIN dimension_inspections ON dimension_inspections.lot_id = lots.id
     INNER JOIN packing_inspections ON packing_inspections.lot_id = lots.id
     INNER JOIN (
       SELECT lot_id, MAX(created_at) AS completed_at
       FROM lot_audit_logs
       WHERE action = ?
       GROUP BY lot_id
     ) completed_evidence ON completed_evidence.lot_id = lots.id
     LEFT JOIN lot_attachments ON lot_attachments.lot_id = lots.id
       AND lot_attachments.deleted_at IS NULL
     ${where.sql}
     GROUP BY lots.id, completed_evidence.completed_at
     ORDER BY lots.production_date DESC, completed_evidence.completed_at DESC, lots.lot_number ASC
     ${limitSql}`,
    [where.action, ...where.params]
  );

  return {
    ok: true,
    tab: selectedTab,
    latestDate,
    hasNewerDate: Boolean(latestDate && dateRange?.endDate && latestDate > dateRange.endDate),
    counts: await getResultCounts({ dateRange, search: searchText, connection }),
    filters: {
      startDate: dateRange?.startDate || '',
      endDate: dateRange?.endDate || '',
      search: searchText,
      page: safePage,
      pageSize: selectedPageSize
    },
    items: rows.map((row) => mapResultRow(row, selectedTab)),
    summary: {
      totalItems,
      page: safePage,
      pageSize: selectedPageSize,
      totalPages
    }
  };
}
