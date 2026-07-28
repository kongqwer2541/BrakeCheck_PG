import ExcelJS from 'exceljs';

import { postgresDb } from '../config/database.js';
import { createCurrentNgConfirmationExistsSql } from './lot-approval-evidence.service.js';

const maxModelSearchLength = 200;
const minModelSearchLengthWithoutProductionDate = 3;
const maxPostgresInteger = 2147483647;
const maxTopicNameLength = 120;
const maxPreviewLots = 500;
const maxExportMeasurementPoints = 50000;

const rawDataColumns = [
  { header: 'lot_number', key: 'lot_number', width: 18 },
  { header: 'lot_pack', key: 'lot_pack', width: 18 },
  { header: 'production_lot', key: 'production_lot', width: 18 },
  { header: 'production_date', key: 'production_date', width: 16 },
  { header: 'inspection_date', key: 'inspection_date', width: 16 },
  { header: 'model', key: 'model', width: 22 },
  { header: 'description', key: 'description', width: 24 },
  { header: 'purchase_order', key: 'purchase_order', width: 18 },
  { header: 'grade', key: 'grade', width: 12 },
  { header: 'quantity', key: 'quantity', width: 12 },
  { header: 'topic_name', key: 'topic_name', width: 24 },
  { header: 'piece_index', key: 'piece_index', width: 12 },
  { header: 'point_index', key: 'point_index', width: 12 },
  { header: 'measured_value', key: 'measured_value', width: 16 },
  { header: 'instrument_code', key: 'instrument_code', width: 24 },
  { header: 'inspector_name', key: 'inspector_name', width: 20 },
  { header: 'inspection_status', key: 'inspection_status', width: 18 },
  { header: 'lot_status', key: 'lot_status', width: 14 },
  { header: 'drawing_ref', key: 'drawing_ref', width: 16 },
  { header: 'nominal', key: 'nominal', width: 12 },
  { header: 'lsl', key: 'lsl', width: 12 },
  { header: 'usl', key: 'usl', width: 12 },
  { header: 'tolerance_note', key: 'tolerance_note', width: 24 }
];

const skippedValueColumns = rawDataColumns
  .filter((column) => !['measured_value', 'drawing_ref', 'nominal', 'lsl', 'usl', 'tolerance_note'].includes(column.key))
  .concat([
    { header: 'measured_value_raw', key: 'measured_value_raw', width: 20 },
    { header: 'skip_reason', key: 'skip_reason', width: 18 }
  ]);

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function cleanText(value) {
  return String(value || '').trim();
}

function parseJsonSnapshot(value, fallback = null) {
  if (value === null || value === undefined || value === '') {
    return {
      data: fallback,
      invalid: false
    };
  }

  if (typeof value === 'object') {
    return {
      data: value,
      invalid: false
    };
  }

  try {
    return {
      data: JSON.parse(value),
      invalid: false
    };
  } catch {
    return {
      data: fallback,
      invalid: true
    };
  }
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

function validateDate(value, fieldName) {
  const dateText = cleanText(value);

  if (!dateText) {
    return '';
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    throw createHttpError(400, `${fieldName}ไม่ถูกต้อง`);
  }

  const [year, month, day] = dateText.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw createHttpError(400, `${fieldName}ไม่ถูกต้อง`);
  }

  return dateText;
}

function normalizeDateRange({ startDate, endDate, startFieldName, endFieldName }) {
  const startText = validateDate(startDate, startFieldName);
  const endText = validateDate(endDate, endFieldName);

  if (!startText && !endText) {
    return null;
  }

  const normalizedStart = startText || endText;
  const normalizedEnd = endText || startText;

  if (normalizedStart > normalizedEnd) {
    throw createHttpError(400, 'ช่วงวันที่ไม่ถูกต้อง');
  }

  return {
    startDate: normalizedStart,
    endDate: normalizedEnd
  };
}

function escapeLikeSearch(value) {
  return value.replace(/[\\%_]/g, (matchedText) => `\\${matchedText}`);
}

function addParameter(params, value) {
  params.push(value);
  return `$${params.length}`;
}

function normalizeTopicNames(value) {
  const rawValues = Array.isArray(value) ? value : String(value || '').split(',');
  const topicNames = rawValues
    .map((item) => cleanText(item).slice(0, maxTopicNameLength))
    .filter(Boolean);

  return [...new Set(topicNames)];
}

export function normalizeExportDimensionLotIds(value) {
  if (!Array.isArray(value)) {
    throw createHttpError(400, 'กรุณาเลือก Lot อย่างน้อย 1 รายการก่อน Export');
  }

  const parsedLotIds = value.map((item) => Number(item));

  if (parsedLotIds.some((item) => (
    !Number.isSafeInteger(item) || item <= 0 || item > maxPostgresInteger
  ))) {
    throw createHttpError(400, 'รายการ Lot ที่เลือกไม่ถูกต้อง');
  }

  const lotIds = [...new Set(parsedLotIds)];

  if (!lotIds.length) {
    throw createHttpError(400, 'กรุณาเลือก Lot อย่างน้อย 1 รายการก่อน Export');
  }

  if (lotIds.length > maxPreviewLots) {
    throw createHttpError(400, `Export ได้ไม่เกิน ${maxPreviewLots} Lot ต่อครั้ง`);
  }

  return lotIds;
}

export function normalizeExportDimensionPreviewFilters(query = {}) {
  const modelSearch = cleanText(query.model || query.search).slice(0, maxModelSearchLength);
  const productionDateRange = normalizeDateRange({
    startDate: query.productionStartDate || query.startDate,
    endDate: query.productionEndDate || query.endDate,
    startFieldName: 'วันที่ผลิตเริ่มต้น',
    endFieldName: 'วันที่ผลิตสิ้นสุด'
  });
  const inspectionDateRange = normalizeDateRange({
    startDate: query.inspectionStartDate,
    endDate: query.inspectionEndDate,
    startFieldName: 'วันที่ตรวจเริ่มต้น',
    endFieldName: 'วันที่ตรวจสิ้นสุด'
  });
  const topicNames = normalizeTopicNames(query.topicNames || query.topics);

  if (!modelSearch && !productionDateRange) {
    throw createHttpError(400, 'กรุณาระบุรุ่น/รายละเอียด หรือช่วงวันที่ผลิตก่อน Preview');
  }

  if (
    modelSearch &&
    modelSearch.length < minModelSearchLengthWithoutProductionDate &&
    !productionDateRange
  ) {
    throw createHttpError(
      400,
      `ถ้าค้นหารุ่น/รายละเอียดน้อยกว่า ${minModelSearchLengthWithoutProductionDate} ตัวอักษร กรุณาระบุช่วงวันที่ผลิตด้วย`
    );
  }

  return {
    modelSearch,
    productionDateRange,
    inspectionDateRange,
    topicNames
  };
}

function buildPreviewWhere(filters) {
  const conditions = [
    getExportableLotStatusCondition(),
    "dimension_inspections.status = 'completed'"
  ];
  const params = [];

  if (filters.modelSearch) {
    const searchParameter = addParameter(
      params,
      `%${escapeLikeSearch(filters.modelSearch)}%`
    );
    conditions.push(
      `(lots.model_name ILIKE ${searchParameter} ESCAPE '\\' OR lots.dimension ILIKE ${searchParameter} ESCAPE '\\')`
    );
  }

  if (filters.productionDateRange) {
    const startDateParameter = addParameter(params, filters.productionDateRange.startDate);
    const endDateParameter = addParameter(params, filters.productionDateRange.endDate);
    conditions.push(`lots.production_date BETWEEN ${startDateParameter} AND ${endDateParameter}`);
  }

  if (filters.inspectionDateRange) {
    const startDateParameter = addParameter(params, filters.inspectionDateRange.startDate);
    const endDateParameter = addParameter(params, filters.inspectionDateRange.endDate);
    conditions.push(
      `dimension_inspections.inspection_date BETWEEN ${startDateParameter} AND ${endDateParameter}`
    );
  }

  return {
    sql: conditions.join(' AND '),
    params
  };
}

function getExportableLotStatusCondition() {
  return `(lots.status = 'approved' OR (
    lots.status = 'ng'
    AND ${createCurrentNgConfirmationExistsSql()}
  ))`;
}

function getSavedTopicByConfig(savedTopics, configTopic) {
  const topicId = String(configTopic?.id || '');

  return savedTopics.find((topic) => (
    topicId && String(topic.topicId || '') === topicId
  )) || savedTopics.find((topic) => (
    topic.topicName && topic.topicName === configTopic?.topicName
  )) || null;
}

function normalizeDimensionTopics(piecesData, formConfigSnapshot = []) {
  const savedTopics = Array.isArray(piecesData?.topics) ? piecesData.topics : [];
  const configTopics = Array.isArray(formConfigSnapshot) ? formConfigSnapshot : [];

  if (!configTopics.length) {
    return savedTopics.map((topic, index) => {
      const rows = Array.isArray(topic?.rows) ? topic.rows : [];
      const inputCount = rows.reduce((max, row) => (
        Math.max(max, Array.isArray(row?.values) ? row.values.length : 0)
      ), 0);

      return {
        topicId: topic.topicId || index + 1,
        topicName: topic.topicName || `topic_${index + 1}`,
        inputCount: Math.max(inputCount, 1),
        inputType: topic.inputType || 'number',
        rows
      };
    });
  }

  return configTopics.map((configTopic) => {
    const savedTopic = getSavedTopicByConfig(savedTopics, configTopic);
    return {
      topicId: configTopic.id || savedTopic?.topicId || '',
      topicName: configTopic.topicName || savedTopic?.topicName || '-',
      inputCount: Math.max(1, Number(configTopic.inputCount || 1)),
      inputType: configTopic.inputType || 'number',
      rows: Array.isArray(savedTopic?.rows) ? savedTopic.rows : []
    };
  });
}

function isNumericMeasurementValue(value) {
  const text = cleanText(value);

  if (!text || text === '-') {
    return false;
  }

  return /^-?\d+(\.\d+)?$/.test(text) && Number.isFinite(Number(text));
}

function getMeasurementSkipReason(value, isStoppedAfterNg = false) {
  const text = cleanText(value);

  if (!text) {
    return 'blank';
  }

  if (text === '-') {
    return isStoppedAfterNg ? 'stopped_after_ng' : 'dash';
  }

  return isNumericMeasurementValue(text) ? '' : 'not_numeric';
}

function assertExportMeasurementPointLimit(totalMeasurementValues) {
  if (totalMeasurementValues > maxExportMeasurementPoints) {
    throw createHttpError(400, `Export ได้ไม่เกิน ${maxExportMeasurementPoints} จุดวัดต่อครั้ง`);
  }
}

function createTopicCounter(topicName) {
  return {
    topicName,
    numericValueCount: 0,
    skippedValueCount: 0
  };
}

function addTopicCounts(target, source) {
  target.numericValueCount += source.numericValueCount;
  target.skippedValueCount += source.skippedValueCount;
}

function countTopicValues(topic) {
  const counter = createTopicCounter(topic.topicName || '-');
  const rows = Array.isArray(topic?.rows) ? topic.rows : [];
  const inputCount = Math.max(1, Number(topic?.inputCount || 1));

  rows.forEach((row) => {
    const values = Array.isArray(row?.values) ? row.values : [];

    for (let inputIndex = 0; inputIndex < inputCount; inputIndex += 1) {
      if (isNumericMeasurementValue(values[inputIndex])) {
        counter.numericValueCount += 1;
      } else {
        counter.skippedValueCount += 1;
      }
    }
  });

  return counter;
}

function mapPreviewLot(row, selectedTopicNames) {
  const piecesDataSnapshot = parseJsonSnapshot(row.pieces_data, { topics: [] });
  const formConfigSnapshot = parseJsonSnapshot(row.form_config_snapshot, []);
  const piecesData = piecesDataSnapshot.data;
  const formConfig = formConfigSnapshot.data;
  const snapshotInvalid = piecesDataSnapshot.invalid || formConfigSnapshot.invalid;
  const selectedTopicSet = new Set(selectedTopicNames);
  const topicCounts = [];
  const allTopicCounts = [];
  const lotCounter = {
    numericValueCount: 0,
    skippedValueCount: 0
  };

  normalizeDimensionTopics(piecesData, formConfig)
    .filter((topic) => topic.inputType !== 'pass_fail')
    .forEach((topic) => {
      const topicName = cleanText(topic.topicName) || '-';
      const counter = countTopicValues({ ...topic, topicName });
      const hasValues = counter.numericValueCount + counter.skippedValueCount > 0;

      if (!hasValues) {
        return;
      }

      allTopicCounts.push(counter);

      if (!selectedTopicSet.size || selectedTopicSet.has(topicName)) {
        topicCounts.push(counter);
        addTopicCounts(lotCounter, counter);
      }
    });

  return {
    lotId: row.id,
    lotNumber: row.lot_number,
    lotPack: row.lot_pack_barcode || '-',
    productionLot: row.lot_packing || '-',
    productionDate: toDateText(row.production_date),
    inspectionDate: toDateText(row.inspection_date),
    model: row.model_name || '-',
    description: row.dimension || '-',
    purchaseOrder: row.purchase_order || '-',
    grade: row.aci_grade || '-',
    quantity: Number(row.quantity || 0),
    inspectorName: row.inspector_name || '-',
    inspectionStatus: row.inspection_status || '',
    lotStatus: row.lot_status || '',
    snapshotInvalid,
    numericValueCount: lotCounter.numericValueCount,
    skippedValueCount: lotCounter.skippedValueCount,
    topicCounts,
    allTopicCounts
  };
}

function getInstrumentCodeText(codes) {
  return Array.isArray(codes)
    ? codes.map((code) => cleanText(code)).filter(Boolean).join(', ')
    : '';
}

function createMeasurementBaseRow(row, topicName, pieceNo, inputIndex, instrumentCodeText) {
  return {
    lot_number: row.lot_number,
    lot_pack: row.lot_pack_barcode || '-',
    production_lot: row.lot_packing || '-',
    production_date: toDateText(row.production_date),
    inspection_date: toDateText(row.inspection_date),
    model: row.model_name || '-',
    description: row.dimension || '-',
    purchase_order: row.purchase_order || '-',
    grade: row.aci_grade || '-',
    quantity: Number(row.quantity || 0),
    topic_name: topicName,
    piece_index: pieceNo,
    point_index: inputIndex + 1,
    instrument_code: instrumentCodeText,
    inspector_name: row.inspector_name || '-',
    inspection_status: row.inspection_status || '',
    lot_status: row.lot_status || ''
  };
}

function buildMeasurementRowsForLot(row, selectedTopicNames, currentMeasurementCount = 0) {
  const piecesDataSnapshot = parseJsonSnapshot(row.pieces_data, { topics: [] });
  const formConfigSnapshot = parseJsonSnapshot(row.form_config_snapshot, []);
  const instrumentCodesSnapshot = parseJsonSnapshot(row.instrument_codes, []);
  const selectedTopicSet = new Set(selectedTopicNames);
  const rawRows = [];
  const skippedRows = [];

  if (piecesDataSnapshot.invalid || formConfigSnapshot.invalid || instrumentCodesSnapshot.invalid) {
    return {
      snapshotInvalid: true,
      rawRows,
      skippedRows
    };
  }

  const instrumentCodeText = getInstrumentCodeText(instrumentCodesSnapshot.data);

  const normalizedTopics = normalizeDimensionTopics(
    piecesDataSnapshot.data,
    formConfigSnapshot.data
  );
  const ngStop = piecesDataSnapshot.data?.meta?.ngStop;
  const ngStopIndex = ngStop
    ? normalizedTopics.findIndex((topic) => (
      String(topic.topicId) === String(ngStop.topicId)
      || topic.topicName === ngStop.topicName
    ))
    : -1;

  normalizedTopics
    .map((topic, topicIndex) => ({ topic, topicIndex }))
    .filter(({ topic }) => topic.inputType !== 'pass_fail')
    .forEach(({ topic, topicIndex }) => {
      const topicName = cleanText(topic.topicName) || '-';

      if (selectedTopicSet.size && !selectedTopicSet.has(topicName)) {
        return;
      }

      const inputCount = Math.max(1, Number(topic.inputCount || 1));
      const rows = Array.isArray(topic.rows) ? topic.rows : [];

      rows.forEach((pieceRow) => {
        const pieceNo = Number(pieceRow?.pieceNo);
        const values = Array.isArray(pieceRow?.values) ? pieceRow.values : [];

        for (let inputIndex = 0; inputIndex < inputCount; inputIndex += 1) {
          const rawValue = values[inputIndex];
          const skipReason = getMeasurementSkipReason(
            rawValue,
            ngStopIndex >= 0 && topicIndex > ngStopIndex
          );
          const baseRow = createMeasurementBaseRow(row, topicName, pieceNo, inputIndex, instrumentCodeText);

          if (skipReason) {
            skippedRows.push({
              ...baseRow,
              measured_value_raw: cleanText(rawValue),
              skip_reason: skipReason
            });
          } else {
            rawRows.push({
              ...baseRow,
              measured_value: Number(cleanText(rawValue)),
              drawing_ref: '',
              nominal: '',
              lsl: '',
              usl: '',
              tolerance_note: ''
            });
          }

          assertExportMeasurementPointLimit(
            currentMeasurementCount + rawRows.length + skippedRows.length
          );
        }
      });
    });

  return {
    snapshotInvalid: false,
    rawRows,
    skippedRows
  };
}

function createCounterMapKey(value) {
  return cleanText(value) || '-';
}

function incrementCounter(map, key, fieldName) {
  const mapKey = createCounterMapKey(key);

  if (!map.has(mapKey)) {
    map.set(mapKey, {
      name: mapKey,
      numericValueCount: 0,
      skippedValueCount: 0
    });
  }

  map.get(mapKey)[fieldName] += 1;
}

function buildExportSummaries(rawRows, skippedRows) {
  const topicMap = new Map();
  const lotMap = new Map();

  rawRows.forEach((row) => {
    incrementCounter(topicMap, row.topic_name, 'numericValueCount');
    incrementCounter(lotMap, row.lot_number, 'numericValueCount');
  });

  skippedRows.forEach((row) => {
    incrementCounter(topicMap, row.topic_name, 'skippedValueCount');
    incrementCounter(lotMap, row.lot_number, 'skippedValueCount');
  });

  return {
    topicSummary: Array.from(topicMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'th')),
    lotSummary: Array.from(lotMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'th'))
  };
}

function buildExportDataFromRows(rows, topicNames = []) {
  const rawRows = [];
  const skippedRows = [];
  let snapshotInvalidCount = 0;

  rows.forEach((row) => {
    const lotRows = buildMeasurementRowsForLot(
      row,
      topicNames,
      rawRows.length + skippedRows.length
    );

    if (lotRows.snapshotInvalid) {
      snapshotInvalidCount += 1;
      return;
    }

    rawRows.push(...lotRows.rawRows);
    skippedRows.push(...lotRows.skippedRows);
  });

  if (snapshotInvalidCount) {
    throw createHttpError(409, `พบ snapshot ที่อ่านไม่ได้ ${snapshotInvalidCount} Lot กรุณาตรวจสอบข้อมูลก่อน Export`);
  }

  const totalMeasurementValues = rawRows.length + skippedRows.length;

  if (!totalMeasurementValues) {
    throw createHttpError(400, 'ไม่พบค่าตรวจตาม Lot หรือหัวข้อที่เลือก');
  }

  return {
    rawRows,
    skippedRows,
    ...buildExportSummaries(rawRows, skippedRows),
    summary: {
      totalLots: rows.length,
      numericValueCount: rawRows.length,
      skippedValueCount: skippedRows.length,
      totalMeasurementValues
    }
  };
}

export function buildExportDimensionPreviewFromRows(rows = [], filters = {}) {
  const selectedTopicNames = Array.isArray(filters.topicNames) ? filters.topicNames : [];
  const availableTopicMap = new Map();
  const topicSummaryMap = new Map();
  const items = rows.map((row) => mapPreviewLot(row, selectedTopicNames));
  const summary = {
    totalLots: items.length,
    numericValueCount: 0,
    skippedValueCount: 0,
    snapshotInvalidCount: 0,
    canExport: true,
    limit: {
      maxPreviewLots,
      maxExportMeasurementPoints
    }
  };

  items.forEach((item) => {
    summary.numericValueCount += item.numericValueCount;
    summary.skippedValueCount += item.skippedValueCount;
    if (item.snapshotInvalid) {
      summary.snapshotInvalidCount += 1;
    }

    item.allTopicCounts.forEach((topic) => {
      if (!availableTopicMap.has(topic.topicName)) {
        availableTopicMap.set(topic.topicName, createTopicCounter(topic.topicName));
      }
      addTopicCounts(availableTopicMap.get(topic.topicName), topic);
    });

    item.topicCounts.forEach((topic) => {
      if (!topicSummaryMap.has(topic.topicName)) {
        topicSummaryMap.set(topic.topicName, createTopicCounter(topic.topicName));
      }
      addTopicCounts(topicSummaryMap.get(topic.topicName), topic);
    });

    delete item.allTopicCounts;
  });

  summary.canExport = summary.numericValueCount <= maxExportMeasurementPoints;

  return {
    filters,
    items,
    availableTopics: Array.from(availableTopicMap.values())
      .sort((a, b) => a.topicName.localeCompare(b.topicName, 'th')),
    topicSummary: Array.from(topicSummaryMap.values())
      .sort((a, b) => a.topicName.localeCompare(b.topicName, 'th')),
    summary
  };
}

function styleHeaderRow(sheet) {
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle', wrapText: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

function addRowsWorksheet(workbook, sheetName, columns, rows) {
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns;
  sheet.addRows(rows);
  styleHeaderRow(sheet);
  return sheet;
}

function addSummarySheet(workbook, exportData) {
  const sheet = workbook.addWorksheet('summary');

  sheet.addRow(['summary_by_topic']);
  sheet.addRow(['topic_name', 'numeric_value_count', 'skipped_value_count']);
  exportData.topicSummary.forEach((item) => {
    sheet.addRow([item.name, item.numericValueCount, item.skippedValueCount]);
  });

  sheet.addRow([]);
  sheet.addRow(['summary_by_lot']);
  sheet.addRow(['lot_number', 'numeric_value_count', 'skipped_value_count']);
  exportData.lotSummary.forEach((item) => {
    sheet.addRow([item.name, item.numericValueCount, item.skippedValueCount]);
  });

  sheet.columns = [
    { width: 28 },
    { width: 22 },
    { width: 22 }
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(2).font = { bold: true };
  sheet.getRow(exportData.topicSummary.length + 4).font = { bold: true };
  sheet.getRow(exportData.topicSummary.length + 5).font = { bold: true };
}

function addMetadataSheet(workbook, exportData, topicNames) {
  const sheet = workbook.addWorksheet('metadata');
  const selectedTopics = topicNames.length ? topicNames.join(', ') : 'all';

  sheet.addRows([
    ['key', 'value'],
    ['export_scope', 'approved_and_confirmed_ng_completed_dimension'],
    ['selected_topics', selectedTopics],
    ['lot_count', exportData.summary.totalLots],
    ['numeric_value_count', exportData.summary.numericValueCount],
    ['skipped_value_count', exportData.summary.skippedValueCount],
    ['total_measurement_values', exportData.summary.totalMeasurementValues],
    ['max_measurement_values', maxExportMeasurementPoints],
    ['cp_cpk', 'not_calculated_in_brakecheck'],
    ['spec_columns', 'blank_for_external_drawing_input']
  ]);
  sheet.columns = [
    { width: 32 },
    { width: 48 }
  ];
  sheet.getRow(1).font = { bold: true };
}

export function buildExportDimensionWorkbookFromRows(rows = [], options = {}) {
  const topicNames = normalizeTopicNames(options.topicNames);
  const exportData = buildExportDataFromRows(rows, topicNames);
  const workbook = new ExcelJS.Workbook();

  workbook.creator = 'BrakeCheck';
  workbook.created = new Date();

  addRowsWorksheet(workbook, 'raw_data', rawDataColumns, exportData.rawRows);
  addRowsWorksheet(workbook, 'skipped_values', skippedValueColumns, exportData.skippedRows);
  addSummarySheet(workbook, exportData);
  addMetadataSheet(workbook, exportData, topicNames);

  return {
    workbook,
    summary: exportData.summary
  };
}

function assertPreviewLotLimit(rowCount) {
  if (rowCount > maxPreviewLots) {
    throw createHttpError(
      400,
      `พบ Lot เกิน ${maxPreviewLots} รายการ กรุณากรองรุ่น วันที่ผลิต หรือวันที่ตรวจให้แคบลง`
    );
  }
}

export async function getExportDimensionPreview(query) {
  const filters = normalizeExportDimensionPreviewFilters(query);
  const where = buildPreviewWhere(filters);
  const { rows } = await postgresDb.query(
    `SELECT
       lots.id,
       lots.lot_number,
       lots.lot_pack_barcode,
       lots.lot_packing,
       lots.model_name,
       lots.dimension,
       lots.aci_grade,
       lots.purchase_order,
       lots.production_date,
       lots.quantity,
       lots.status AS lot_status,
       dimension_inspections.status AS inspection_status,
       dimension_inspections.inspection_date,
       dimension_inspections.form_config_snapshot,
       dimension_inspections.pieces_data,
       completed_user.full_name AS inspector_name
     FROM lots
     INNER JOIN dimension_inspections
       ON dimension_inspections.lot_id = lots.id
     LEFT JOIN users completed_user
       ON completed_user.id = dimension_inspections.completed_by
     WHERE ${where.sql}
     ORDER BY lots.production_date DESC, lots.lot_number ASC
     LIMIT ${maxPreviewLots + 1}`,
    where.params
  );

  assertPreviewLotLimit(rows.length);

  return buildExportDimensionPreviewFromRows(rows, filters);
}

async function findExportDimensionRowsByLotIds(lotIds) {
  const placeholders = lotIds.map((_, index) => `$${index + 1}`).join(', ');
  const { rows } = await postgresDb.query(
    `SELECT
       lots.id,
       lots.lot_number,
       lots.lot_pack_barcode,
       lots.lot_packing,
       lots.model_name,
       lots.dimension,
       lots.aci_grade,
       lots.purchase_order,
       lots.production_date,
       lots.quantity,
       lots.status AS lot_status,
       dimension_inspections.status AS inspection_status,
       dimension_inspections.inspection_date,
       dimension_inspections.instrument_codes,
       dimension_inspections.form_config_snapshot,
       dimension_inspections.pieces_data,
       completed_user.full_name AS inspector_name
     FROM lots
     INNER JOIN dimension_inspections
       ON dimension_inspections.lot_id = lots.id
     LEFT JOIN users completed_user
       ON completed_user.id = dimension_inspections.completed_by
     WHERE lots.id IN (${placeholders})
       AND ${getExportableLotStatusCondition()}
       AND dimension_inspections.status = 'completed'
     ORDER BY lots.production_date DESC, lots.lot_number ASC`,
    lotIds
  );

  if (rows.length !== lotIds.length) {
    throw createHttpError(409, `บาง Lot ไม่พร้อม export จำนวน ${lotIds.length - rows.length} รายการ กรุณา Preview ใหม่`);
  }

  return rows;
}

export async function buildExportDimensionExcel({ lotIds, topicNames }) {
  const selectedLotIds = normalizeExportDimensionLotIds(lotIds);
  const selectedTopicNames = normalizeTopicNames(topicNames);
  const rows = await findExportDimensionRowsByLotIds(selectedLotIds);
  const { workbook } = buildExportDimensionWorkbookFromRows(rows, {
    topicNames: selectedTopicNames
  });
  const buffer = await workbook.xlsx.writeBuffer();
  const fileDate = toDateText(new Date());

  return {
    fileName: `BrakeCheck_Export_Dimension_${fileDate}.xlsx`,
    buffer,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  };
}
