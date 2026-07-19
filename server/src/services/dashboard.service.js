import { postgresDb } from '../config/database.js';
import { withPostgresTransaction } from '../utils/postgres-transaction.js';

const allowedStatusFilters = ['all', 'pending', 'waiting', 'in_progress', 'need_fix', 'waiting_approve', 'approved', 'ng'];
const maxSearchLength = 80;
const defaultDashboardRows = 50;
const allowedDashboardPageSizes = [String(defaultDashboardRows)];

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

function createBadRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function cleanText(value) {
  return String(value || '').trim();
}

function validateDate(value) {
  const dateText = cleanText(value);

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

function normalizeDateRange({ date, startDate, endDate }) {
  const startText = cleanText(startDate);
  const endText = cleanText(endDate);
  const dateText = cleanText(date);
  const selectedStart = validateDate(startText || dateText || endText);
  const selectedEnd = validateDate(endText || dateText || startText);

  if (selectedStart > selectedEnd) {
    throw createBadRequest('ช่วงวันที่ไม่ถูกต้อง');
  }

  return {
    startDate: selectedStart,
    endDate: selectedEnd
  };
}

function normalizeStatusFilter(value) {
  const status = cleanText(value) || 'all';

  if (!allowedStatusFilters.includes(status)) {
    throw createBadRequest('ตัวกรองสถานะไม่ถูกต้อง');
  }

  return status;
}

function cleanSearch(value) {
  return cleanText(value).slice(0, maxSearchLength);
}

function normalizePageSize(value) {
  const pageSize = cleanText(value) || String(defaultDashboardRows);

  if (pageSize === 'all') {
    return defaultDashboardRows;
  }

  if (!allowedDashboardPageSizes.includes(pageSize)) {
    throw createBadRequest('จำนวนรายการต่อหน้าไม่ถูกต้อง');
  }

  return defaultDashboardRows;
}

function normalizePage(value) {
  const page = Number(value || 1);

  if (!Number.isInteger(page) || page < 1) {
    throw createBadRequest('หน้าที่เลือกไม่ถูกต้อง');
  }

  return page;
}

function escapeLikeSearch(value) {
  return value.replace(/[\\%_]/g, (matchedText) => `\\${matchedText}`);
}

function addParameter(params, value) {
  params.push(value);
  return `$${params.length}`;
}

function createWhereClause({ dateRange, status, search }) {
  const params = [];
  const startDateParam = addParameter(params, dateRange.startDate);
  const endDateParam = addParameter(params, dateRange.endDate);
  const conditions = [`production_date BETWEEN ${startDateParam} AND ${endDateParam}`];

  if (status === 'waiting' || status === 'pending') {
    conditions.push("status IN ('pending', 'waiting_pack')");
  } else if (status === 'in_progress') {
    conditions.push("status = 'temp'");
  } else if (status === 'all') {
    conditions.push("status <> 'void'");
  } else if (status !== 'all') {
    conditions.push(`status = ${addParameter(params, status)}`);
  }

  if (search) {
    const searchParam = addParameter(params, `%${escapeLikeSearch(search)}%`);
    conditions.push(`(
      lot_number ILIKE ${searchParam} ESCAPE '\\'
      OR lot_pack_barcode ILIKE ${searchParam} ESCAPE '\\'
      OR lot_packing ILIKE ${searchParam} ESCAPE '\\'
    )`);
  }

  return {
    sql: `WHERE ${conditions.join(' AND ')}`,
    params
  };
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

function mapLot(row) {
  return {
    lotNumber: row.lot_number,
    lotPackBarcode: row.lot_pack_barcode || '-',
    lotPacking: row.lot_packing || '-',
    purchaseOrder: row.purchase_order || '-',
    modelName: row.model_name || '-',
    detail: row.dimension || '-',
    aciGrade: row.aci_grade || '-',
    quantity: Number(row.quantity || 0),
    status: row.status,
    statusLabel: statusLabels[row.status] || row.status,
    importSource: row.import_source,
    updatedAt: row.updated_at
  };
}

async function getLatestDashboardDate(connection = postgresDb) {
  const { rows } = await connection.query(
    `SELECT MAX(production_date) AS latest_date
     FROM lots
     WHERE status <> 'void'`
  );

  return toDateText(rows[0]?.latest_date);
}

async function getStats({ dateRange, status, search, connection = postgresDb }) {
  const where = createWhereClause({ dateRange, status, search });

  const { rows } = await connection.query(
    `SELECT
       COUNT(*) AS total_lots,
       SUM(CASE WHEN status IN ('waiting_pack', 'waiting_approve', 'approved', 'ng') THEN 1 ELSE 0 END) AS completed_lots,
       SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved_lots,
       SUM(CASE WHEN status = 'waiting_approve' THEN 1 ELSE 0 END) AS waiting_approve_lots,
       SUM(CASE WHEN status = 'ng' THEN 1 ELSE 0 END) AS ng_lots
     FROM lots
     ${where.sql}`,
    where.params
  );

  const stats = rows[0] || {};

  return {
    totalLots: Number(stats.total_lots || 0),
    completedLots: Number(stats.completed_lots || 0),
    approvedLots: Number(stats.approved_lots || 0),
    waitingApproveLots: Number(stats.waiting_approve_lots || 0),
    ngLots: Number(stats.ng_lots || 0)
  };
}

async function getLots({ dateRange, status, search, pageSize, page, connection = postgresDb }) {
  const where = createWhereClause({ dateRange, status, search });
  const offset = (page - 1) * pageSize;
  const limitSql = `LIMIT ${pageSize} OFFSET ${offset}`;

  const { rows } = await connection.query(
    `SELECT
       lot_number,
       lot_pack_barcode,
       lot_packing,
       purchase_order,
       model_name,
       dimension,
       aci_grade,
       quantity,
       status,
       import_source,
       updated_at
     FROM lots
     ${where.sql}
     ORDER BY lot_number ASC
     ${limitSql}`,
    where.params
  );

  return rows.map(mapLot);
}

export async function getDashboardData({
  date,
  startDate,
  endDate,
  status = 'all',
  search = '',
  page = 1,
  pageSize = defaultDashboardRows
}) {
  const dateRange = normalizeDateRange({ date, startDate, endDate });
  const statusFilter = normalizeStatusFilter(status);
  const searchText = cleanSearch(search);
  const selectedPageSize = normalizePageSize(pageSize);
  const requestedPage = normalizePage(page);
  return withPostgresTransaction(postgresDb, async (connection) => {
    const latestDate = await getLatestDashboardDate(connection);
    const stats = await getStats({
      dateRange,
      status: statusFilter,
      search: searchText,
      connection
    });
    const totalRows = stats.totalLots;
    const totalPages = Math.max(1, Math.ceil(totalRows / selectedPageSize));
    const currentPage = Math.min(requestedPage, totalPages);
    const items = await getLots({
      dateRange,
      status: statusFilter,
      search: searchText,
      pageSize: selectedPageSize,
      page: currentPage,
      connection
    });

    return {
      ok: true,
      latestDate,
      hasNewerDate: Boolean(latestDate && latestDate > dateRange.endDate),
      filters: {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        status: statusFilter,
        search: searchText,
        page: currentPage,
        pageSize: selectedPageSize
      },
      stats,
      items,
      summary: {
        totalItems: totalRows,
        page: currentPage,
        pageSize: selectedPageSize,
        totalPages
      }
    };
  });
}
