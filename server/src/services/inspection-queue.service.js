import { postgresDb } from '../config/database.js';

const defaultPageSize = 50;
const maxSearchLength = 80;
const queueTypes = ['dimension', 'packing'];
const pageSizeValues = ['50', 'all'];
const statusFilters = ['all', 'waiting', 'in_progress', 'done', 'need_fix', 'ng', 'waiting_approve', 'approved'];

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

const queueStatusLabels = {
  dimension: {
    waiting: 'รอตรวจมิติ',
    in_progress: 'กำลังตรวจ',
    done: 'ตรวจมิติแล้ว',
    need_fix: 'รอแก้ไข',
    ng: 'NG',
    waiting_approve: 'รออนุมัติ',
    approved: 'Approved'
  },
  packing: {
    waiting: 'รอตรวจบรรจุ',
    in_progress: 'กำลังตรวจ',
    done: 'ตรวจบรรจุแล้ว',
    need_fix: 'รอแก้ไข',
    ng: 'NG',
    waiting_approve: 'รออนุมัติ',
    approved: 'Approved'
  }
};

const priorityOrder = {
  need_fix: 1,
  ng: 2,
  in_progress: 3,
  waiting: 4,
  done: 5,
  waiting_approve: 6,
  approved: 7
};

function createBadRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function cleanText(value) {
  return String(value || '').trim();
}

function validateQueueType(value) {
  const queueType = cleanText(value);

  if (!queueTypes.includes(queueType)) {
    throw createBadRequest('ประเภทคิวตรวจไม่ถูกต้อง');
  }

  return queueType;
}

function validateDate(value, fieldName) {
  const dateText = cleanText(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    throw createBadRequest(`${fieldName}ไม่ถูกต้อง`);
  }

  const [year, month, day] = dateText.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw createBadRequest(`${fieldName}ไม่ถูกต้อง`);
  }

  return dateText;
}

function toDateText(value) {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value.slice(0, 10);
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, '0'),
      String(value.getDate()).padStart(2, '0')
    ].join('-');
  }

  return String(value).slice(0, 10);
}

function normalizeDateRange({ startDate, endDate }) {
  const startText = cleanText(startDate);
  const endText = cleanText(endDate);

  if (!startText && !endText) {
    return null;
  }

  const selectedStart = validateDate(startText || endText, 'วันที่เริ่ม');
  const selectedEnd = validateDate(endText || startText, 'วันที่สิ้นสุด');

  if (selectedStart > selectedEnd) {
    throw createBadRequest('ช่วงวันที่ไม่ถูกต้อง');
  }

  return {
    startDate: selectedStart,
    endDate: selectedEnd
  };
}

function normalizeStatus(value) {
  const status = cleanText(value) || 'all';

  if (!statusFilters.includes(status)) {
    throw createBadRequest('ตัวกรองสถานะไม่ถูกต้อง');
  }

  return status;
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

async function getLatestProductionDate(connection = postgresDb) {
  const { rows } = await connection.query(
    `SELECT MAX(production_date) AS latest_date
     FROM lots
     WHERE production_date IS NOT NULL
       AND status <> 'void'`
  );

  return toDateText(rows[0]?.latest_date);
}

function buildBaseWhere({ dateRange, search }) {
  const conditions = ["lots.status <> 'void'"];
  const params = [];

  if (dateRange) {
    params.push(dateRange.startDate, dateRange.endDate);
    conditions.push(`lots.production_date BETWEEN $${params.length - 1} AND $${params.length}`);
  } else {
    conditions.push('lots.production_date IS NULL');
  }

  if (search) {
    const likeSearch = `%${escapeLikeSearch(search)}%`;
    const firstSearchParam = params.length + 1;
    conditions.push(`(
      lots.lot_number ILIKE $${firstSearchParam} ESCAPE '\\'
      OR lots.lot_pack_barcode ILIKE $${firstSearchParam + 1} ESCAPE '\\'
      OR lots.lot_packing ILIKE $${firstSearchParam + 2} ESCAPE '\\'
      OR lots.model_name ILIKE $${firstSearchParam + 3} ESCAPE '\\'
    )`);
    params.push(likeSearch, likeSearch, likeSearch, likeSearch);
  }

  return {
    sql: `WHERE ${conditions.join(' AND ')}`,
    params
  };
}

function getLatestNgSource(row) {
  if (row.latest_ng_reason?.startsWith('ตรวจมิติเปลี่ยนสถานะ Lot:')) {
    return 'dimension';
  }

  if (row.latest_ng_reason?.startsWith('ตรวจบรรจุเปลี่ยนสถานะ Lot:')) {
    return 'packing';
  }

  return '';
}

function isPackingRelevant(row, latestNgSource) {
  return Boolean(
    row.packing_status ||
    ['waiting_pack', 'waiting_approve', 'approved'].includes(row.status) ||
    latestNgSource === 'packing' ||
    (row.status === 'need_fix' && (row.packing_status === 'completed' || latestNgSource === 'packing'))
  );
}

function getQueueStatus(row, queueType) {
  const latestNgSource = getLatestNgSource(row);

  if (row.status === 'need_fix') {
    if (queueType === 'packing' && !isPackingRelevant(row, latestNgSource)) {
      return '';
    }

    return 'need_fix';
  }

  if (row.status === 'ng') {
    if (queueType === 'packing' && latestNgSource === 'dimension') {
      return '';
    }

    return !latestNgSource || latestNgSource === queueType ? 'ng' : 'done';
  }

  if (queueType === 'dimension') {
    if (row.dimension_status === 'completed' || ['waiting_pack', 'waiting_approve', 'approved'].includes(row.status)) {
      return row.status === 'waiting_approve' || row.status === 'approved' ? row.status : 'done';
    }

    if (row.dimension_status === 'draft' || row.status === 'temp') {
      return 'in_progress';
    }

    return 'waiting';
  }

  if (!isPackingRelevant(row, latestNgSource)) {
    return '';
  }

  if (row.packing_status === 'completed' || ['waiting_approve', 'approved'].includes(row.status)) {
    return row.status === 'waiting_approve' || row.status === 'approved' ? row.status : 'done';
  }

  if (row.packing_status === 'draft') {
    return 'in_progress';
  }

  if (row.status === 'waiting_pack') {
    return 'waiting';
  }

  return '';
}

function mapQueueItem(row, queueType) {
  const queueStatus = getQueueStatus(row, queueType);
  const latestNgSource = getLatestNgSource(row);

  if (!queueStatus) {
    return null;
  }

  return {
    lotNumber: row.lot_number,
    lotPackBarcode: row.lot_pack_barcode || '-',
    lotPacking: row.lot_packing || '-',
    modelName: row.model_name || '-',
    detail: row.dimension || '-',
    purchaseOrder: row.purchase_order || '-',
    aciGrade: row.aci_grade || '-',
    quantity: Number(row.quantity || 0),
    productionDate: toDateText(row.production_date),
    status: row.status,
    statusLabel: statusLabels[row.status] || row.status,
    queueStatus,
    queueStatusLabel: queueStatusLabels[queueType][queueStatus] || row.status,
    latestNgSource,
    priority: priorityOrder[queueStatus] || 99,
    updatedAt: row.updated_at
  };
}

function getStats(items) {
  return items.reduce((stats, item) => {
    stats.total += 1;
    stats[item.queueStatus] = (stats[item.queueStatus] || 0) + 1;

    if (['done', 'waiting_approve', 'approved'].includes(item.queueStatus)) {
      stats.doneTotal += 1;
    }

    return stats;
  }, {
    total: 0,
    waiting: 0,
    in_progress: 0,
    done: 0,
    doneTotal: 0,
    need_fix: 0,
    ng: 0,
    waiting_approve: 0,
    approved: 0
  });
}

function matchesStatusFilter(item, selectedStatus) {
  if (selectedStatus === 'all') {
    return true;
  }

  if (selectedStatus === 'done') {
    return ['done', 'waiting_approve', 'approved'].includes(item.queueStatus);
  }

  return item.queueStatus === selectedStatus;
}

async function getRows({ dateRange, search, connection = postgresDb }) {
  const where = buildBaseWhere({ dateRange, search });

  const { rows } = await connection.query(
    `SELECT
       lots.lot_number,
       lots.lot_pack_barcode,
       lots.lot_packing,
       lots.model_name,
       lots.dimension,
       lots.purchase_order,
       lots.aci_grade,
       lots.quantity,
       lots.production_date,
       lots.status,
       lots.updated_at,
       dimension_inspections.status AS dimension_status,
       dimension_inspections.completed_at AS dimension_completed_at,
       packing_inspections.status AS packing_status,
       packing_inspections.completed_at AS packing_completed_at,
       latest_ng.reason AS latest_ng_reason
     FROM lots
     LEFT JOIN dimension_inspections ON dimension_inspections.lot_id = lots.id
     LEFT JOIN packing_inspections ON packing_inspections.lot_id = lots.id
     LEFT JOIN (
       SELECT log_rows.lot_id, log_rows.reason
       FROM lot_audit_logs log_rows
       INNER JOIN (
         SELECT lot_id, MAX(id) AS latest_id
         FROM lot_audit_logs
         WHERE reason LIKE 'ตรวจมิติเปลี่ยนสถานะ Lot:%-> NG'
            OR reason LIKE 'ตรวจบรรจุเปลี่ยนสถานะ Lot:%-> NG'
         GROUP BY lot_id
       ) latest_rows ON latest_rows.latest_id = log_rows.id
     ) latest_ng ON latest_ng.lot_id = lots.id
     ${where.sql}`,
    where.params
  );

  return rows;
}

export async function getInspectionQueue({
  queueType,
  startDate,
  endDate,
  status,
  search,
  page,
  pageSize
}) {
  const selectedQueueType = validateQueueType(queueType);
  const latestDate = await getLatestProductionDate();
  const requestedRange = normalizeDateRange({ startDate, endDate });
  const dateRange = requestedRange || (latestDate ? { startDate: latestDate, endDate: latestDate } : null);
  const selectedStatus = normalizeStatus(status);
  const searchText = cleanSearch(search);
  const requestedPage = normalizePage(page);
  const selectedPageSize = normalizePageSize(pageSize);
  const rows = await getRows({ dateRange, search: searchText });
  const allItems = rows
    .map((row) => mapQueueItem(row, selectedQueueType))
    .filter(Boolean)
    .filter((item) => matchesStatusFilter(item, selectedStatus))
    .sort((a, b) => a.priority - b.priority || String(a.lotNumber).localeCompare(String(b.lotNumber)));
  const totalItems = allItems.length;
  const pageSizeNumber = selectedPageSize === 'all' ? totalItems || defaultPageSize : Number(selectedPageSize);
  const totalPages = selectedPageSize === 'all' ? 1 : Math.max(1, Math.ceil(totalItems / pageSizeNumber));
  const safePage = selectedPageSize === 'all' ? 1 : Math.min(requestedPage, totalPages);
  const startIndex = selectedPageSize === 'all' ? 0 : (safePage - 1) * pageSizeNumber;
  const items = selectedPageSize === 'all'
    ? allItems
    : allItems.slice(startIndex, startIndex + pageSizeNumber);

  return {
    ok: true,
    queueType: selectedQueueType,
    latestDate,
    hasNewerDate: Boolean(latestDate && dateRange?.endDate && latestDate > dateRange.endDate),
    filters: {
      startDate: dateRange?.startDate || '',
      endDate: dateRange?.endDate || '',
      status: selectedStatus,
      search: searchText,
      page: safePage,
      pageSize: selectedPageSize
    },
    stats: getStats(allItems),
    items,
    summary: {
      totalItems,
      page: safePage,
      pageSize: selectedPageSize,
      totalPages
    }
  };
}
