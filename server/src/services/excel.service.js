import { postgresDb } from '../config/database.js';
import { withPostgresTransaction } from '../utils/postgres-transaction.js';
import { readExcelPreview } from '../utils/excel-reader.js';

const maxStoredFileNameLength = 255;

function createHttpError(statusCode, message, details = null) {
  const error = new Error(message);
  error.statusCode = statusCode;

  if (details) {
    error.details = details;
  }

  return error;
}

function requireActorUser(user) {
  const userId = Number(user?.id);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw createHttpError(401, 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
  }

  return userId;
}

function cleanStoredFileName(fileName) {
  const rawFileName = String(fileName || 'unknown.xlsx');
  const baseName = rawFileName
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .trim();

  const safeFileName = baseName
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, maxStoredFileNameLength);

  return safeFileName || 'unknown.xlsx';
}

function markDuplicateRows(rows, existingLots) {
  const existingLotSet = new Set(existingLots);

  return rows.map((row) => {
    if (!row.lotNumber || row.errors.length || !existingLotSet.has(row.lotNumber)) {
      return row;
    }

    return {
      ...row,
      status: 'existing',
      warnings: [
        ...row.warnings,
        'Lot นี้มีอยู่แล้วในระบบ'
      ]
    };
  });
}

function mapRowError(row) {
  return {
    rowNumber: row.rowNumber,
    lotNumber: row.lotNumber,
    lotPackBarcode: row.lotPackBarcode,
    errors: row.errors
  };
}

function createPostgresPlaceholders(length) {
  return Array.from({ length }, (_, index) => `$${index + 1}`).join(', ');
}

async function findExistingLots(lotNumbers) {
  const uniqueLotNumbers = [...new Set(lotNumbers.filter(Boolean))];

  if (!uniqueLotNumbers.length) {
    return [];
  }

  const placeholders = createPostgresPlaceholders(uniqueLotNumbers.length);
  const { rows } = await postgresDb.query(
    `SELECT lot_number
     FROM lots
     WHERE lot_number IN (${placeholders})`,
    uniqueLotNumbers
  );

  return rows.map((row) => row.lot_number);
}

function createSummary(rows, baseSummary) {
  const duplicateLots = rows.filter((row) => row.status === 'existing').length;
  const errorRows = rows.filter((row) => row.errors.length).length;

  return {
    ...baseSummary,
    validRows: rows.length - errorRows,
    errorRows,
    duplicateLots,
    newLots: rows.length - errorRows - duplicateLots,
    previewRows: Math.min(rows.length, 5)
  };
}

async function findExistingProductionDates(productionDates) {
  const uniqueDates = [...new Set(productionDates.filter(Boolean))];

  if (!uniqueDates.length) {
    return [];
  }

  const placeholders = createPostgresPlaceholders(uniqueDates.length);
  const { rows } = await postgresDb.query(
    `SELECT production_date, COUNT(*) AS lot_count
     FROM lots
     WHERE production_date IN (${placeholders})
     GROUP BY production_date
     ORDER BY production_date`,
    uniqueDates
  );

  return rows.map((row) => ({
    productionDate: normalizeDateValue(row.production_date),
    lotCount: Number(row.lot_count)
  }));
}

function normalizeDateValue(value) {
  if (!value) {
    return '';
  }

  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  return String(value).slice(0, 10);
}

function getUnconfirmedProductionDates(existingProductionDates, confirmedProductionDates) {
  const confirmedDateSet = new Set((confirmedProductionDates || []).map(normalizeDateValue));

  return existingProductionDates.filter((row) => (
    !confirmedDateSet.has(normalizeDateValue(row.productionDate))
  ));
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

async function createImportBatch({ connection, file, preview, importedRows, skippedRows, actorUserId }) {
  const { rows } = await connection.query(
    `INSERT INTO excel_import_batches (
       original_file_name,
       file_hash,
       file_size,
       sheet_name,
       production_dates,
       total_rows,
       imported_rows,
       skipped_rows,
       uploaded_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      cleanStoredFileName(file.originalname),
      preview.file.hash,
      file.size,
      preview.sheet.name,
      JSON.stringify(preview.summary.productionDates),
      preview.summary.totalRows,
      importedRows,
      skippedRows,
      actorUserId
    ]
  );

  return rows[0].id;
}

async function insertLot({ connection, row, actorUserId, importBatchId }) {
  const sampleCount = await getSampleCount(row.quantity, connection);

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
       drill_size,
       bore_size,
       rivet_no,
       production_date,
       quantity,
       sample_count,
       remark1,
       remark2,
       remark3,
       status,
       imported_by,
       import_batch_id,
       import_source
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'pending', $18, $19, 'excel')`,
    [
      row.lotNumber,
      row.lotPackBarcode || null,
      row.lotPacking || '-',
      row.modelName || null,
      row.outerSize || null,
      row.aciGrade || null,
      row.code || null,
      row.purchaseOrder || null,
      row.drillSize,
      row.boreSize,
      row.rivetNo || null,
      row.productionDate,
      row.quantity,
      sampleCount,
      row.remark1 || null,
      row.remark2 || null,
      row.remark3 || null,
      actorUserId,
      importBatchId
    ]
  );
}

export async function previewExcelImport({ file }) {
  const preview = await readExcelPreview(file);
  const existingLots = await findExistingLots(preview.rows.map((row) => row.lotNumber));
  const rows = markDuplicateRows(preview.rows, existingLots);
  const summary = createSummary(rows, preview.summary);

  return {
    ok: true,
    file: preview.file,
    sheet: preview.sheet,
    columns: preview.columns,
    summary,
    warnings: preview.warnings,
    rows,
    previewRows: rows.slice(0, summary.previewRows),
    errors: rows
      .filter((row) => row.errors.length)
      .map(mapRowError)
  };
}

export async function saveExcelImport({ file, user, confirmedProductionDates = [] }) {
  const actorUserId = requireActorUser(user);
  const preview = await readExcelPreview(file);
  const existingLots = await findExistingLots(preview.rows.map((row) => row.lotNumber));
  const rows = markDuplicateRows(preview.rows, existingLots);
  const summary = createSummary(rows, preview.summary);
  const errorRows = rows.filter((row) => row.errors.length);

  if (errorRows.length) {
    throw createHttpError(400, 'ไฟล์ Excel ยังมีข้อมูลผิดพลาด กรุณาแก้ไขก่อนบันทึก', {
      summary,
      errors: errorRows.map(mapRowError)
    });
  }

  if (summary.duplicateLots > 0) {
    throw createHttpError(409, 'มี Lot ที่ถูกนำเข้าแล้วในระบบ กรุณาตรวจสอบก่อนบันทึก', {
      summary,
      duplicateLots: rows
        .filter((row) => row.status === 'existing')
        .map((row) => ({
          rowNumber: row.rowNumber,
          lotNumber: row.lotNumber,
          lotPackBarcode: row.lotPackBarcode
        }))
    });
  }

  const sameDateRows = await findExistingProductionDates(preview.summary.productionDates);
  const unconfirmedProductionDates = getUnconfirmedProductionDates(sameDateRows, confirmedProductionDates);
  if (unconfirmedProductionDates.length) {
    throw createHttpError(409, 'วันฝนนี้มีข้อมูลอยู่แล้ว กรุณายืนยันก่อนบันทึกเพิ่ม', {
      productionDates: unconfirmedProductionDates
    });
  }

  try {
    return await withPostgresTransaction(postgresDb, async (connection) => {
      const importBatchId = await createImportBatch({
        connection,
        file,
        preview,
        importedRows: rows.length,
        skippedRows: 0,
        actorUserId
      });

      for (const row of rows) {
        await insertLot({ connection, row, actorUserId, importBatchId });
      }

      return {
        ok: true,
        message: 'บันทึกข้อมูล Excel สำเร็จ',
        importBatchId,
        summary: {
          ...summary,
          importedRows: rows.length,
          skippedRows: 0
        }
      };
    });
  } catch (error) {
    if (error.code === '23505') {
      throw createHttpError(409, 'มี Lot ซ้ำในระบบ กรุณาตรวจสอบไฟล์ Excel อีกครั้ง');
    }

    throw error;
  }
}
