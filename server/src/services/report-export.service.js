import PDFDocument from 'pdfkit';
import { postgresDb } from '../config/database.js';
import {
  createCurrentNgConfirmationExistsSql,
  getLotApprovalEvidence
} from './lot-approval-evidence.service.js';
import {
  assertPdfThaiFontsAvailable,
  pdfFont,
  registerPdfFonts
} from './report-export-pdf-fonts.js';
import { buildLotReportWorkbook } from './report-export-excel-sections.js';
import { addPdfReportSections } from './report-export-pdf-sections.js';
import {
  cleanText,
  createHttpError,
  sanitizeReportFileNamePart,
  validateReportExportTab,
  validateReportLotNumber
} from './report-export-validation.js';

export { reportCellValue } from './report-export-excel-layout.js';

export {
  isReportExportTab,
  sanitizeReportFileNamePart,
  validateReportExportTab,
  validateReportLotNumber
} from './report-export-validation.js';

const defaultPageSize = 50;
const maxReportExportAllItems = 1000;
const invalidJsonSnapshot = Symbol('invalid-json-snapshot');

const brakeTypeLabels = {
  normal: 'ธรรมดา',
  taper: 'ปลายเรียว',
  sheet: 'แผ่น'
};

const brakeModelLabels = {
  drilled_bored: 'มีรูเจาะ-รูคว้าน',
  no_hole: 'ไม่มีรู'
};

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

function parseCompletedSnapshot(value, fallback) {
  const parsed = parseJsonColumn(value, invalidJsonSnapshot);

  return {
    data: parsed === invalidJsonSnapshot ? fallback : parsed,
    invalid: parsed === invalidJsonSnapshot
  };
}

function hasSavedTopics(snapshot) {
  return Array.isArray(snapshot?.topics) && snapshot.topics.length > 0;
}

function toDateText(value) {
  if (!value) {
    return '';
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

function toDateTimeText(value) {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value.replace('T', ' ').slice(0, 19);
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const date = toDateText(value);
    const hours = String(value.getHours()).padStart(2, '0');
    const minutes = String(value.getMinutes()).padStart(2, '0');
    const seconds = String(value.getSeconds()).padStart(2, '0');
    return `${date} ${hours}:${minutes}:${seconds}`;
  }

  return String(value);
}

function validateOptionalDate(value) {
  const text = cleanText(value);

  if (!text || text === 'all') {
    return '';
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw createHttpError(400, 'วันที่ผลิตไม่ถูกต้อง');
  }

  const [year, month, day] = text.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw createHttpError(400, 'วันที่ผลิตไม่ถูกต้อง');
  }

  return text;
}

function normalizeSearch(value) {
  return cleanText(value).slice(0, 80);
}

function escapeLikeSearch(value) {
  return value.replace(/[\\%_]/g, (matchedText) => `\\${matchedText}`);
}

function addParameter(params, value) {
  params.push(value);
  return `$${params.length}`;
}

function normalizePage(value) {
  const page = Number(value || 1);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function normalizePageSize(value) {
  if (value === 'all') {
    return 'all';
  }

  const pageSize = Number(value || defaultPageSize);
  return Number.isInteger(pageSize) && pageSize > 0 && pageSize <= 100
    ? pageSize
    : defaultPageSize;
}

export function buildReportQueueLimitClause(pageSize, offset) {
  if (pageSize === 'all') {
    return '';
  }

  const safePageSize = Number.isInteger(Number(pageSize)) && Number(pageSize) > 0
    ? Number(pageSize)
    : defaultPageSize;
  const safeOffset = Number.isInteger(Number(offset)) && Number(offset) >= 0
    ? Number(offset)
    : 0;

  return `LIMIT ${safePageSize} OFFSET ${safeOffset}`;
}

export function assertReportExportAllLimit({ pageSize, totalItems }) {
  if (pageSize !== 'all' || totalItems <= maxReportExportAllItems) {
    return;
  }

  throw createHttpError(
    400,
    `รายการส่งออกมีเกิน ${maxReportExportAllItems} รายการ กรุณากรองวันที่หรือค้นหาเพิ่มเติม`
  );
}

function createReportWhere({ tab, date, search }) {
  const conditions = [];
  const params = [];

  if (tab === 'approved') {
    conditions.push(`lots.status = ${addParameter(params, 'approved')}`);
  } else {
    const statusParam = addParameter(params, 'ng');
    conditions.push(
      `lots.status = ${statusParam} AND ${createCurrentNgConfirmationExistsSql()}`
    );
  }

  if (date) {
    conditions.push(`lots.production_date = ${addParameter(params, date)}`);
  }

  if (search) {
    const searchParam = addParameter(params, `%${escapeLikeSearch(search)}%`);
    conditions.push(`(
      lots.lot_number ILIKE ${searchParam} ESCAPE '\\'
      OR lots.lot_pack_barcode ILIKE ${searchParam} ESCAPE '\\'
      OR lots.lot_packing ILIKE ${searchParam} ESCAPE '\\'
      OR lots.model_name ILIKE ${searchParam} ESCAPE '\\'
    )`);
  }

  return {
    sql: `WHERE ${conditions.join(' AND ')}`,
    params
  };
}

function getStatusLabel(status, tab = '') {
  if (tab === 'confirmed_ng' || status === 'ng') {
    return 'รับทราบ NG';
  }

  if (status === 'approved') {
    return 'Approved';
  }

  return status || '-';
}

function mapReportQueueRow(row, tab) {
  return {
    lotNumber: row.lot_number,
    lotPackBarcode: row.lot_pack_barcode || '-',
    lotPacking: row.lot_packing || '-',
    modelName: row.model_name || '',
    dimension: row.dimension || '',
    purchaseOrder: row.purchase_order || '',
    quantity: Number(row.quantity || 0),
    productionDate: toDateText(row.production_date),
    status: row.status,
    statusLabel: getStatusLabel(row.status, tab)
  };
}

export async function getReportExportLots({ tab, date, search, page, pageSize }) {
  const selectedTab = validateReportExportTab(tab);
  const selectedDate = validateOptionalDate(date);
  const searchText = normalizeSearch(search);
  const requestedPage = normalizePage(page);
  const selectedPageSize = normalizePageSize(pageSize);
  const where = createReportWhere({
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
  assertReportExportAllLimit({ pageSize: selectedPageSize, totalItems });
  const pageSizeNumber = selectedPageSize === 'all' ? totalItems || defaultPageSize : selectedPageSize;
  const totalPages = selectedPageSize === 'all' ? 1 : Math.max(1, Math.ceil(totalItems / pageSizeNumber));
  const safePage = Math.min(requestedPage, totalPages);
  const offset = (safePage - 1) * pageSizeNumber;
  const limitSql = buildReportQueueLimitClause(selectedPageSize, offset);

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
       status
     FROM lots
     ${where.sql}
     ORDER BY production_date DESC, updated_at DESC, lot_number ASC
     ${limitSql}`,
    where.params
  );

  return {
    tab: selectedTab,
    items: rows.map((row) => mapReportQueueRow(row, selectedTab)),
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

function countDimensionFails(piecesData) {
  const topics = Array.isArray(piecesData?.topics) ? piecesData.topics : [];
  return topics.reduce((total, topic) => {
    const rows = Array.isArray(topic?.rows) ? topic.rows : [];
    return total + rows.reduce((rowTotal, row) => {
      const values = Array.isArray(row?.values) ? row.values : [];
      return rowTotal + values.filter((value) => value === 'fail').length;
    }, 0);
  }, 0);
}

export function getDimensionSummary(piecesData) {
  const failCount = countDimensionFails(piecesData);

  return {
    label: failCount ? `ไม่ผ่าน (พบ ${failCount} จุด)` : 'ผ่าน',
    failCount
  };
}

export function getPackingSummary(resultsData) {
  const topics = Array.isArray(resultsData?.topics) ? resultsData.topics : [];
  const failCount = topics.filter((topic) => cleanText(topic?.value) === 'fail').length;
  const note = cleanText(resultsData?.meta?.inspectionNote);

  return {
    label: failCount ? `ไม่ผ่าน (พบ ${failCount} หัวข้อ)` : 'ผ่าน',
    failCount,
    note
  };
}

function mapReportDetail(row) {
  if (!row) {
    return null;
  }

  const dimensionSnapshot = row.dimension_status === 'completed'
    ? parseCompletedSnapshot(row.dimension_pieces_data, { topics: [] })
    : { data: { topics: [] }, invalid: false };
  const packingSnapshot = row.packing_status === 'completed'
    ? parseCompletedSnapshot(row.packing_results_data, { meta: {}, topics: [] })
    : { data: { meta: {}, topics: [] }, invalid: false };
  const dimensionInspection = {
    status: row.dimension_status || '',
    inspectionDate: toDateText(row.dimension_inspection_date),
    shift: row.dimension_shift || '',
    instrumentCodes: parseJsonColumn(row.dimension_instrument_codes, []),
    rivetNo: row.dimension_rivet_no || '',
    productionCode: row.dimension_production_code || '',
    brakeType: row.dimension_brake_type || '',
    brakeModel: row.dimension_brake_model || '',
    rivetHoleThickness: row.dimension_rivet_hole_thickness === null || row.dimension_rivet_hole_thickness === undefined
      ? ''
      : Number(row.dimension_rivet_hole_thickness),
    sampleCount: row.dimension_sample_count === null || row.dimension_sample_count === undefined
      ? ''
      : Number(row.dimension_sample_count),
    formConfigSnapshot: parseJsonColumn(row.dimension_form_config_snapshot, []),
    completedAt: row.dimension_completed_at,
    completedByName: row.dimension_completed_by_name || '',
    completedByPosition: row.dimension_completed_by_position || '',
    piecesData: dimensionSnapshot.data,
    snapshotInvalid: dimensionSnapshot.invalid
  };
  const packingInspection = {
    status: row.packing_status || '',
    inspectionDate: toDateText(row.packing_inspection_date),
    formConfigSnapshot: parseJsonColumn(row.packing_form_config_snapshot, []),
    completedAt: row.packing_completed_at,
    completedByName: row.packing_completed_by_name || '',
    completedByPosition: row.packing_completed_by_position || '',
    resultsData: packingSnapshot.data,
    snapshotInvalid: packingSnapshot.invalid
  };

  return {
    id: row.id,
    lotNumber: row.lot_number,
    lotPackBarcode: row.lot_pack_barcode || '-',
    lotPacking: row.lot_packing || '-',
    modelName: row.model_name || '-',
    dimension: row.dimension || '-',
    aciGrade: row.aci_grade || '-',
    code: row.code || '-',
    purchaseOrder: row.purchase_order || '-',
    productionDate: toDateText(row.production_date),
    quantity: Number(row.quantity || 0),
    status: row.status,
    statusLabel: getStatusLabel(row.status),
    dimensionInspection,
    packingInspection
  };
}

async function findReportDetailByLotNumber(lotNumber, connection) {
  const { rows } = await connection.query(
    `SELECT
       lots.id,
       lots.lot_number,
       lots.lot_pack_barcode,
       lots.lot_packing,
       lots.model_name,
       lots.dimension,
       lots.aci_grade,
       lots.code,
       lots.purchase_order,
       lots.production_date,
       lots.quantity,
       lots.status,
       dimension_inspections.status AS dimension_status,
       dimension_inspections.inspection_date AS dimension_inspection_date,
       dimension_inspections.shift AS dimension_shift,
       dimension_inspections.instrument_codes AS dimension_instrument_codes,
       dimension_inspections.rivet_no AS dimension_rivet_no,
       dimension_inspections.production_code AS dimension_production_code,
       dimension_inspections.brake_type AS dimension_brake_type,
       dimension_inspections.brake_model AS dimension_brake_model,
       dimension_inspections.rivet_hole_thickness AS dimension_rivet_hole_thickness,
       dimension_inspections.sample_count AS dimension_sample_count,
       dimension_inspections.form_config_snapshot AS dimension_form_config_snapshot,
       dimension_inspections.pieces_data AS dimension_pieces_data,
       dimension_inspections.completed_at AS dimension_completed_at,
       dimension_user.full_name AS dimension_completed_by_name,
       dimension_user.position AS dimension_completed_by_position,
       packing_inspections.status AS packing_status,
       packing_inspections.inspection_date AS packing_inspection_date,
       packing_inspections.form_config_snapshot AS packing_form_config_snapshot,
       packing_inspections.results_data AS packing_results_data,
       packing_inspections.completed_at AS packing_completed_at,
       packing_user.full_name AS packing_completed_by_name,
       packing_user.position AS packing_completed_by_position
     FROM lots
     LEFT JOIN dimension_inspections
       ON dimension_inspections.lot_id = lots.id
     LEFT JOIN users dimension_user
       ON dimension_user.id = dimension_inspections.completed_by
     LEFT JOIN packing_inspections
       ON packing_inspections.lot_id = lots.id
     LEFT JOIN users packing_user
       ON packing_user.id = packing_inspections.completed_by
     WHERE lots.lot_number = $1
     LIMIT 1`,
    [lotNumber]
  );

  return mapReportDetail(rows[0]);
}

export function assertReportReadyForExport(lot, evidence) {
  if (!lot) {
    throw createHttpError(404, 'ไม่พบ Lot ที่ต้องการส่งออก');
  }

  if (lot.status === 'approved') {
    if (!evidence?.approved) {
      throw createHttpError(409, 'ไม่พบหลักฐานการอนุมัติสำหรับส่งออกรายงาน');
    }
  } else if (lot.status === 'ng' && evidence?.ngConfirmed) {
    // NG lots can be exported only after acknowledgement evidence exists.
  } else {
    throw createHttpError(409, 'Lot นี้ยังไม่พร้อมส่งออกรายงาน');
  }

  if (lot.dimensionInspection?.status !== 'completed') {
    throw createHttpError(409, 'ยังไม่มีใบตรวจมิติที่บันทึกสมบูรณ์สำหรับส่งออกรายงาน');
  }

  const packingStatus = lot.packingInspection?.status || '';
  const packingSkippedForDimensionNg = (
    lot.status === 'ng' &&
    Boolean(evidence?.ngConfirmed) &&
    !packingStatus
  );

  if (packingStatus !== 'completed' && !packingSkippedForDimensionNg) {
    throw createHttpError(409, 'ยังไม่มีใบตรวจบรรจุที่บันทึกสมบูรณ์สำหรับส่งออกรายงาน');
  }

  if (lot.dimensionInspection.snapshotInvalid || !hasSavedTopics(lot.dimensionInspection.piecesData)) {
    throw createHttpError(409, 'snapshot ใบตรวจมิติไม่พร้อมส่งออกรายงาน');
  }

  if (
    packingStatus === 'completed' &&
    (lot.packingInspection.snapshotInvalid || !hasSavedTopics(lot.packingInspection.resultsData))
  ) {
    throw createHttpError(409, 'snapshot ใบตรวจบรรจุไม่พร้อมส่งออกรายงาน');
  }
}

function getReportSavedTopicByConfig(savedTopics, configTopic) {
  const topicId = String(configTopic?.id || '');

  return savedTopics.find((topic) => (
    topicId && String(topic.topicId || '') === topicId
  )) || savedTopics.find((topic) => (
    topic.topicName && topic.topicName === configTopic?.topicName
  )) || null;
}

function normalizeReportDimensionTopics(piecesData, formConfigSnapshot = []) {
  const savedTopics = Array.isArray(piecesData?.topics) ? piecesData.topics : [];
  const configTopics = Array.isArray(formConfigSnapshot) ? formConfigSnapshot : [];

  if (!configTopics.length) {
    return savedTopics.map((topic, index) => {
      const rows = Array.isArray(topic?.rows) ? topic.rows : [];
      const inputCount = rows.reduce((max, row) => (
        Math.max(max, Array.isArray(row?.values) ? row.values.length : 0)
      ), 0);

      return {
        id: topic.topicId || index + 1,
        topicName: topic.topicName || `หัวข้อ ${index + 1}`,
        inputCount: Math.max(inputCount, 1),
        inputType: 'number',
        decimalPlaces: '',
        rows
      };
    });
  }

  return configTopics.map((configTopic) => {
    const savedTopic = getReportSavedTopicByConfig(savedTopics, configTopic);
    return {
      ...configTopic,
      topicName: configTopic.topicName || savedTopic?.topicName || '-',
      inputCount: Math.max(1, Number(configTopic.inputCount || 1)),
      inputType: configTopic.inputType || 'number',
      decimalPlaces: configTopic.decimalPlaces,
      rows: Array.isArray(savedTopic?.rows) ? savedTopic.rows : []
    };
  });
}

function getReportDimensionPieceNumbers(topics) {
  const numbers = new Set();

  topics.forEach((topic) => {
    const rows = Array.isArray(topic?.rows) ? topic.rows : [];
    rows.forEach((row) => {
      const pieceNo = Number(row?.pieceNo);
      if (Number.isInteger(pieceNo) && pieceNo > 0) {
        numbers.add(pieceNo);
      }
    });
  });

  return Array.from(numbers).sort((a, b) => a - b);
}

function getReportDimensionValue(topic, pieceNo, inputIndex) {
  const rows = Array.isArray(topic?.rows) ? topic.rows : [];
  const row = rows.find((item) => Number(item?.pieceNo) === Number(pieceNo));
  const values = Array.isArray(row?.values) ? row.values : [];
  return values[inputIndex] ?? '';
}

function toReportPassFailText(value) {
  if (value === 'pass') {
    return 'ผ่าน';
  }

  if (value === 'fail') {
    return 'ไม่ผ่าน';
  }

  return value || '-';
}

function normalizeReportPackingTopics(resultsData, formConfigSnapshot = []) {
  const savedTopics = Array.isArray(resultsData?.topics) ? resultsData.topics : [];
  const configTopics = Array.isArray(formConfigSnapshot) ? formConfigSnapshot : [];

  if (!configTopics.length) {
    return savedTopics;
  }

  return configTopics.map((configTopic) => {
    const savedTopic = getReportSavedTopicByConfig(savedTopics, configTopic);
    return {
      ...configTopic,
      topicName: configTopic.topicName || savedTopic?.topicName || '-',
      referenceNote: configTopic.remark || savedTopic?.referenceNote || '',
      inputType: configTopic.inputType || savedTopic?.inputType || 'pass_fail',
      value: savedTopic?.value || ''
    };
  });
}

function toReportPackingValueText(topic) {
  if (topic.inputType === 'pass_fail') {
    return toReportPassFailText(topic.value);
  }

  return topic.value || '-';
}

export function buildReportPackingRows(resultsData, formConfigSnapshot) {
  return normalizeReportPackingTopics(resultsData, formConfigSnapshot).map((topic, index) => [
    index + 1,
    topic.topicName || '-',
    topic.referenceNote || topic.remark || '-',
    toReportPackingValueText(topic)
  ]);
}

function getReportInspectionSavedBy(inspection, dataKey) {
  const meta = inspection?.[dataKey]?.meta || {};
  return meta.completedSavedByName || inspection?.completedByName || '-';
}

function getReportInspectionSavedAt(inspection, dataKey) {
  const meta = inspection?.[dataKey]?.meta || {};
  return toDateTimeText(meta.completedSavedAt || inspection?.completedAt);
}

function getReportLabel(map, value) {
  return map[value] || value || '-';
}

function getReportSectionDeps() {
  return {
    brakeModelLabels,
    brakeTypeLabels,
    buildReportPackingRows,
    cleanText,
    getDimensionSummary,
    getPackingSummary,
    getReportDimensionPieceNumbers,
    getReportDimensionValue,
    getReportInspectionSavedAt,
    getReportInspectionSavedBy,
    getReportLabel,
    normalizeReportDimensionTopics,
    toDateText,
    toDateTimeText,
    toReportPassFailText
  };
}

function collectPdfBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

async function buildLotReportPdfDocument({ lot, evidence, fontPaths }) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 28,
    autoFirstPage: true
  });
  const bufferPromise = collectPdfBuffer(doc);

  registerPdfFonts(doc, fontPaths);
  doc.info.Title = `BrakeCheck Report ${lot.lotNumber}`;
  doc.info.Creator = 'BrakeCheck';
  pdfFont(doc, false);

  addPdfReportSections(doc, {
    lot,
    evidence,
    deps: getReportSectionDeps()
  });

  doc.end();
  return bufferPromise;
}

async function getReadyLotReport(lotNumber) {
  const cleanedLotNumber = validateReportLotNumber(lotNumber);
  let lot = null;
  let evidence = { approved: null, ngConfirmed: null };
  const connection = await postgresDb.connect();

  try {
    lot = await findReportDetailByLotNumber(cleanedLotNumber, connection);
    evidence = lot ? await getLotApprovalEvidence(lot.id, connection) : evidence;
    assertReportReadyForExport(lot, evidence);
  } finally {
    connection.release();
  }

  return { lot, evidence };
}

export async function buildLotReportPdf({ lotNumber }) {
  const fontPaths = assertPdfThaiFontsAvailable();
  const { lot, evidence } = await getReadyLotReport(lotNumber);
  const buffer = await buildLotReportPdfDocument({ lot, evidence, fontPaths });
  const fileDate = toDateText(new Date());
  const fileName = `BrakeCheck_Report_${sanitizeReportFileNamePart(lot.lotNumber)}_${fileDate}.pdf`;

  return {
    fileName,
    buffer,
    mimeType: 'application/pdf'
  };
}

export async function buildLotReportExcel({ lotNumber }) {
  const { lot, evidence } = await getReadyLotReport(lotNumber);
  const workbook = await buildLotReportWorkbook({
    lot,
    evidence,
    deps: getReportSectionDeps()
  });
  const buffer = await workbook.xlsx.writeBuffer();
  const fileDate = toDateText(new Date());
  const fileName = `BrakeCheck_Report_${sanitizeReportFileNamePart(lot.lotNumber)}_${fileDate}.xlsx`;

  return {
    fileName,
    buffer,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  };
}
