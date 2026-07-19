import crypto from 'crypto';
import path from 'path';
import ExcelJS from 'exceljs';

const allowedExtensions = ['.xlsx', '.xlsm'];
const maxPreviewRows = 5;
const maxScanRows = 20;
const maxWorksheetRows = 2000;
const maxImportRows = 1000;
const emptyProductionDateError = 'วันฝนว่าง';
const invalidProductionDateError = 'วันฝนไม่ถูกต้อง';
const minimumProductionYear = 2000;
const lotPackDateFallbackWarning = 'วันฝนอ่านจาก Lot Pack เพราะคอลัมน์ T ว่างหรือสูตรไม่มีค่า cached result ที่ถูกต้อง';

const expectedColumns = [
  { key: 'lotNumber', column: 'A', label: 'Lot', allowedHeaders: ['Lot'] },
  { key: 'purchaseOrder', column: 'E', label: 'เลขที่ใบสั่งซื้อ', allowedHeaders: ['เลขที่ใบสั่งซื้อ', '4'] },
  { key: 'code', column: 'F', label: 'Code', allowedHeaders: ['Code'] },
  { key: 'remark1', column: 'H', label: 'บันทึก (รหัสของนอก)', allowedHeaders: ['บันทึก(รหัสของนอก)'] },
  { key: 'gradeMain', column: 'M', label: 'เกรด', allowedHeaders: ['เกรด'] },
  { key: 'gradeSub', column: 'N', label: 'เจาะ-ไม่เจาะ', allowedHeaders: ['เจาะ-ไม่เจาะ'] },
  { key: 'outerSize', column: 'O', label: 'กว้าง-หนา-ยาว', allowedHeaders: ['กว้าง-หนา-ยาว'] },
  { key: 'lotPackBarcode', column: 'R', label: 'Lot Pack', allowedHeaders: ['Lot Pack'] },
  { key: 'productionDate', column: 'T', label: 'วันฝน', allowedHeaders: ['วันฝน'] },
  { key: 'remark2', column: 'U', label: 'ยิงเลเซอร์', allowedHeaders: ['ยิงเลเซอร์'] },
  { key: 'quantity', column: 'W', label: 'จำนวนชิ้น', allowedHeaders: ['จำนวนชิ้น'] },
  { key: 'lotPacking', column: 'X', label: 'Lot ผลิต', allowedHeaders: ['Lot ผลิต'] },
  { key: 'boreSize', column: 'AJ', label: 'ดอกคว้าน', allowedHeaders: ['ดอกคว้าน'] },
  { key: 'drillSize', column: 'AK', label: 'ดอกเจาะ', allowedHeaders: ['ดอกเจาะ'] },
  { key: 'modelName', column: 'AL', label: 'รุ่นผลิตภัณฑ์', allowedHeaders: ['รุ่นผลิตภัณฑ์'] },
  { key: 'rivetNo', column: 'AM', label: 'รีเวท', allowedHeaders: ['รีเวท'] },
  { key: 'remark3', column: 'AN', label: 'หมายเหตุ', allowedHeaders: ['หมายเหตุ'] }
];

function createBadRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function cleanText(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function normalizeHeader(value) {
  return cleanText(value).toLowerCase().replace(/\s+/g, '');
}

function getFileExtension(fileName) {
  return path.extname(fileName || '').toLowerCase();
}

function getCellResult(cell) {
  const value = cell?.value;

  if (value && typeof value === 'object') {
    if (Object.hasOwn(value, 'result')) {
      return value.result;
    }

    if (Object.hasOwn(value, 'formula') || Object.hasOwn(value, 'sharedFormula')) {
      return '';
    }

    if (Object.hasOwn(value, 'text')) {
      return value.text;
    }

    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text || '').join('');
    }

    if (value instanceof Date) {
      return value;
    }
  }

  return value;
}

function getCellText(worksheet, column, rowNumber) {
  return cleanText(getCellResult(worksheet.getCell(`${column}${rowNumber}`)));
}

function columnMatchesHeader(cellValue, expectedColumn) {
  const normalizedValue = normalizeHeader(cellValue);

  if (!normalizedValue) {
    return false;
  }

  return expectedColumn.allowedHeaders.some((header) => normalizedValue === normalizeHeader(header));
}

function findHeaderRow(worksheet) {
  for (let rowNumber = 1; rowNumber <= Math.min(maxScanRows, worksheet.rowCount); rowNumber += 1) {
    const matchedColumns = expectedColumns.filter((column) => (
      columnMatchesHeader(getCellText(worksheet, column.column, rowNumber), column)
    ));

    if (matchedColumns.length >= 8 && columnMatchesHeader(getCellText(worksheet, 'A', rowNumber), expectedColumns[0])) {
      return rowNumber;
    }
  }

  return null;
}

function validateColumns(worksheet, headerRow) {
  return expectedColumns.map((column) => {
    const actualHeader = getCellText(worksheet, column.column, headerRow);

    return {
      key: column.key,
      column: column.column,
      expected: column.label,
      actual: actualHeader,
      ok: columnMatchesHeader(actualHeader, column)
    };
  });
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const cleanedValue = cleanText(value).replace(/,/g, '');
  const parsedValue = Number(cleanedValue);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function toInteger(value) {
  const parsedValue = toNumber(value);

  if (parsedValue === null) {
    return null;
  }

  return Number.isInteger(parsedValue) ? parsedValue : Math.round(parsedValue);
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function isProductionDateInAllowedRange(date) {
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const year = date.getFullYear();
  const maximumProductionYear = new Date().getFullYear() + 1;

  return year >= minimumProductionYear && year <= maximumProductionYear;
}

function parseProductionDate(value) {
  if (!value) {
    return { value: null, error: emptyProductionDateError };
  }

  if (value instanceof Date) {
    if (isProductionDateInAllowedRange(value)) {
      return { value: formatDate(value), error: '' };
    }

    return { value: null, error: invalidProductionDateError };
  }

  if (typeof value === 'number') {
    const excelDate = new Date(Math.round((value - 25569) * 86400 * 1000));

    if (isProductionDateInAllowedRange(excelDate)) {
      return { value: formatDate(excelDate), error: '' };
    }
  }

  const text = cleanText(value);
  const thaiDateMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);

  if (thaiDateMatch) {
    const [, day, month, rawYear] = thaiDateMatch;
    let year = Number(rawYear);

    if (year < 100) {
      year += 2000;
    }

    if (year > 2400) {
      year -= 543;
    }

    const date = new Date(year, Number(month) - 1, Number(day));

    if (
      isProductionDateInAllowedRange(date) &&
      date.getFullYear() === year &&
      date.getMonth() === Number(month) - 1 &&
      date.getDate() === Number(day)
    ) {
      return { value: formatDate(date), error: '' };
    }
  }

  const isoDateMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (isoDateMatch) {
    const [, rawYear, month, day] = isoDateMatch;
    const year = Number(rawYear);
    const date = new Date(year, Number(month) - 1, Number(day));

    if (
      isProductionDateInAllowedRange(date) &&
      date.getFullYear() === year &&
      date.getMonth() === Number(month) - 1 &&
      date.getDate() === Number(day)
    ) {
      return { value: formatDate(date), error: '' };
    }
  }

  return { value: null, error: invalidProductionDateError };
}

function parseDateFromLotPack(value) {
  const text = cleanText(value);
  const match = text.match(/^(\d{2})(\d{2})(\d{2})/);

  if (!match) {
    return null;
  }

  const [, rawYear, month, day] = match;
  const year = 2000 + Number(rawYear);
  const date = new Date(year, Number(month) - 1, Number(day));

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return null;
  }

  return formatDate(date);
}

export function resolveProductionDate(columnTValue, lotPackBarcode) {
  const productionDate = parseProductionDate(columnTValue);

  if (productionDate.value) {
    return {
      value: productionDate.value,
      errors: [],
      warnings: []
    };
  }

  if (productionDate.error === emptyProductionDateError) {
    const fallbackProductionDate = parseDateFromLotPack(lotPackBarcode);

    if (fallbackProductionDate) {
      return {
        value: fallbackProductionDate,
        errors: [],
        warnings: [lotPackDateFallbackWarning]
      };
    }
  }

  return {
    value: null,
    errors: [productionDate.error],
    warnings: []
  };
}

function getRowValue(worksheet, rowNumber, column) {
  return getCellResult(worksheet.getCell(`${column}${rowNumber}`));
}

function rowHasImportData(worksheet, rowNumber) {
  return Boolean(cleanText(getRowValue(worksheet, rowNumber, 'A')));
}

function buildRow(worksheet, rowNumber) {
  const gradeMain = cleanText(getRowValue(worksheet, rowNumber, 'M'));
  const gradeSub = cleanText(getRowValue(worksheet, rowNumber, 'N'));
  const quantity = toInteger(getRowValue(worksheet, rowNumber, 'W'));
  const lotNumber = cleanText(getRowValue(worksheet, rowNumber, 'A'));
  const lotPackBarcode = cleanText(getRowValue(worksheet, rowNumber, 'R'));
  const productionDate = resolveProductionDate(getRowValue(worksheet, rowNumber, 'T'), lotPackBarcode);
  const lotPacking = cleanText(getRowValue(worksheet, rowNumber, 'X')) || '-';
  const rowErrors = [];
  const rowWarnings = [];

  if (!lotNumber) {
    rowErrors.push('Lot ว่าง');
  } else if (!/^\d{7,12}$/.test(lotNumber)) {
    rowWarnings.push('รูปแบบ Lot ไม่ตรง YYMMDD+ลำดับ');
  }

  if (!lotPackBarcode) {
    rowErrors.push('Lot Pack ว่าง');
  }

  if (quantity === null) {
    rowErrors.push('จำนวนชิ้นต้องเป็นตัวเลข');
  } else if (quantity < 0) {
    rowErrors.push('จำนวนชิ้นต้องไม่ติดลบ');
  }

  rowWarnings.push(...productionDate.warnings);
  rowErrors.push(...productionDate.errors);

  return {
    rowNumber,
    lotNumber,
    purchaseOrder: cleanText(getRowValue(worksheet, rowNumber, 'E')),
    code: cleanText(getRowValue(worksheet, rowNumber, 'F')),
    remark1: cleanText(getRowValue(worksheet, rowNumber, 'H')),
    aciGrade: [gradeMain, gradeSub].filter(Boolean).join(' '),
    outerSize: cleanText(getRowValue(worksheet, rowNumber, 'O')),
    lotPackBarcode,
    productionDate: productionDate.value,
    remark2: cleanText(getRowValue(worksheet, rowNumber, 'U')),
    quantity,
    lotPacking,
    boreSize: toNumber(getRowValue(worksheet, rowNumber, 'AJ')),
    drillSize: toNumber(getRowValue(worksheet, rowNumber, 'AK')),
    modelName: cleanText(getRowValue(worksheet, rowNumber, 'AL')),
    rivetNo: cleanText(getRowValue(worksheet, rowNumber, 'AM')),
    remark3: cleanText(getRowValue(worksheet, rowNumber, 'AN')),
    status: rowErrors.length ? 'error' : 'new',
    errors: rowErrors,
    warnings: rowWarnings
  };
}

function markDuplicateLotNumbers(rows) {
  const lotRows = new Map();

  rows.forEach((row) => {
    if (!row.lotNumber) {
      return;
    }

    const rowNumbers = lotRows.get(row.lotNumber) || [];
    rowNumbers.push(row.rowNumber);
    lotRows.set(row.lotNumber, rowNumbers);
  });

  const duplicateLots = new Map(
    [...lotRows.entries()].filter(([, rowNumbers]) => rowNumbers.length > 1)
  );

  if (!duplicateLots.size) {
    return rows;
  }

  return rows.map((row) => {
    const duplicateRowNumbers = duplicateLots.get(row.lotNumber);

    if (!duplicateRowNumbers) {
      return row;
    }

    return {
      ...row,
      status: 'error',
      errors: [
        ...row.errors,
        `Lot ซ้ำในไฟล์ Excel แถวที่ ${duplicateRowNumbers.join(', ')}`
      ]
    };
  });
}

function collectRows(worksheet, headerRow) {
  const rows = [];

  for (let rowNumber = headerRow + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    if (!rowHasImportData(worksheet, rowNumber)) {
      continue;
    }

    rows.push(buildRow(worksheet, rowNumber));

    if (rows.length > maxImportRows) {
      throw createBadRequest(`ไฟล์ Excel มีข้อมูลมากเกินไป ระบบรองรับไม่เกิน ${maxImportRows} แถวต่อครั้ง`);
    }
  }

  return markDuplicateLotNumbers(rows);
}

function createSummary(rows) {
  const productionDates = [...new Set(rows.map((row) => row.productionDate).filter(Boolean))];
  const lotPackGroups = new Set(rows.map((row) => row.lotPackBarcode).filter(Boolean)).size;
  const errorRows = rows.filter((row) => row.errors.length).length;

  return {
    totalRows: rows.length,
    validRows: rows.length - errorRows,
    errorRows,
    previewRows: rows.slice(0, maxPreviewRows).length,
    lotPackGroups,
    productionDates,
    hasMultipleProductionDates: productionDates.length > 1
  };
}

function createWarnings({ rows, summary }) {
  const warnings = [];

  if (summary.hasMultipleProductionDates) {
    warnings.push('ไฟล์นี้มีวันฝนมากกว่า 1 วัน โปรดตรวจสอบก่อนยืนยัน');
  }

  const rowsWithoutDate = rows.filter((row) => !row.productionDate).length;
  if (rowsWithoutDate) {
    warnings.push(`มี ${rowsWithoutDate} แถวที่ไม่มีวันฝน`);
  }

  return warnings;
}

function validateFile(file) {
  if (!file) {
    throw createBadRequest('กรุณาเลือกไฟล์ Excel');
  }

  const extension = getFileExtension(file.originalname);
  if (!allowedExtensions.includes(extension)) {
    throw createBadRequest('รองรับเฉพาะไฟล์ .xlsx และ .xlsm เท่านั้น');
  }

  if (!file.buffer?.length) {
    throw createBadRequest('ไฟล์ Excel ว่างหรืออ่านไม่ได้');
  }

  const fileSignature = file.buffer.subarray(0, 2).toString('utf8');
  if (fileSignature !== 'PK') {
    throw createBadRequest('ไฟล์ไม่ใช่รูปแบบ Excel ที่ถูกต้อง');
  }
}

export function getImportFileHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export async function readExcelPreview(file) {
  validateFile(file);

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(file.buffer);
  } catch (error) {
    throw createBadRequest('ไม่สามารถอ่านไฟล์ Excel ได้ โปรดตรวจสอบว่าไฟล์ไม่เสียหาย');
  }

  const worksheet = workbook.getWorksheet('DATA');
  if (!worksheet) {
    throw createBadRequest('ไม่พบชีตชื่อ DATA ในไฟล์ Excel');
  }

  if (worksheet.rowCount > maxWorksheetRows) {
    throw createBadRequest(`ชีต DATA มีจำนวนแถวมากเกินไป ระบบรองรับไม่เกิน ${maxWorksheetRows} แถวต่อไฟล์`);
  }

  const headerRow = findHeaderRow(worksheet);
  if (!headerRow) {
    throw createBadRequest('ไม่พบแถวหัวคอลัมน์ของชีต DATA');
  }

  const columns = validateColumns(worksheet, headerRow);
  const invalidColumns = columns.filter((column) => !column.ok);
  if (invalidColumns.length) {
    const error = createBadRequest('ชื่อคอลัมน์ในชีต DATA ไม่ตรงกับรูปแบบที่ระบบกำหนด');
    error.details = { columns };
    throw error;
  }

  const rows = collectRows(worksheet, headerRow);
  if (!rows.length) {
    throw createBadRequest('ไม่พบข้อมูล Lot ในชีต DATA');
  }

  const summary = createSummary(rows);

  return {
    file: {
      originalName: file.originalname,
      size: file.size,
      hash: getImportFileHash(file.buffer)
    },
    sheet: {
      name: worksheet.name,
      headerRow
    },
    columns,
    rows,
    summary,
    warnings: createWarnings({ rows, summary })
  };
}
