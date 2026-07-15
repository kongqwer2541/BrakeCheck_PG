import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import ExcelJS from 'exceljs';

async function loadExcelReader() {
  return import('./excel-reader.js');
}

const headers = {
  A: 'Lot',
  E: 'เลขที่ใบสั่งซื้อ',
  F: 'Code',
  H: 'บันทึก(รหัสของนอก)',
  M: 'เกรด',
  N: 'เจาะ-ไม่เจาะ',
  O: 'กว้าง-หนา-ยาว',
  R: 'Lot Pack',
  T: 'วันฝน',
  U: 'ยิงเลเซอร์',
  W: 'จำนวนชิ้น',
  X: 'Lot ผลิต',
  AJ: 'ดอกคว้าน',
  AK: 'ดอกเจาะ',
  AL: 'รุ่นผลิตภัณฑ์',
  AM: 'รีเวท',
  AN: 'หมายเหตุ'
};

async function createPreviewRow({ lotNumber, lotPackBarcode, columnT }) {
  const { readExcelPreview } = await loadExcelReader();
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('DATA');

  for (const [column, header] of Object.entries(headers)) {
    worksheet.getCell(`${column}1`).value = header;
  }

  worksheet.getCell('A2').value = lotNumber;
  worksheet.getCell('E2').value = 'PO-TEST';
  worksheet.getCell('F2').value = 'CODE-TEST';
  worksheet.getCell('H2').value = 'Remark';
  worksheet.getCell('M2').value = '535';
  worksheet.getCell('N2').value = 'A';
  worksheet.getCell('O2').value = '100x50';
  worksheet.getCell('R2').value = lotPackBarcode;
  worksheet.getCell('T2').value = columnT;
  worksheet.getCell('U2').value = 'Laser';
  worksheet.getCell('W2').value = 100;
  worksheet.getCell('X2').value = '';
  worksheet.getCell('AJ2').value = 1;
  worksheet.getCell('AK2').value = 2;
  worksheet.getCell('AL2').value = 'MODEL-TEST';
  worksheet.getCell('AM2').value = 'RIVET';
  worksheet.getCell('AN2').value = '';

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const preview = await readExcelPreview({
    originalname: 'production-date-test.xlsx',
    size: buffer.length,
    buffer
  });

  return preview.rows[0];
}

describe('resolveProductionDate', () => {
  test('uses Column T when it contains a valid date', async () => {
    const { resolveProductionDate } = await loadExcelReader();

    assert.equal(typeof resolveProductionDate, 'function');

    const result = resolveProductionDate(new Date(2026, 6, 9), '260708ABC');

    assert.equal(result.value, '2026-07-09');
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.warnings, []);
  });

  test('falls back to Lot Pack only when Column T is empty', async () => {
    const { resolveProductionDate } = await loadExcelReader();
    const result = resolveProductionDate('', '260709ABC');

    assert.equal(result.value, '2026-07-09');
    assert.deepEqual(result.errors, []);
    assert.match(result.warnings[0], /Lot Pack/);
  });

  test('blocks save when Column T is empty and Lot Pack has no valid date', async () => {
    const { resolveProductionDate } = await loadExcelReader();
    const result = resolveProductionDate('', 'BAD-LOT-PACK');

    assert.equal(result.value, null);
    assert.deepEqual(result.errors, ['วันฝนว่าง']);
    assert.deepEqual(result.warnings, []);
  });

  test('blocks save when Column T is invalid even if Lot Pack has a valid date', async () => {
    const { resolveProductionDate } = await loadExcelReader();
    const result = resolveProductionDate('not-a-date', '260709ABC');

    assert.equal(result.value, null);
    assert.deepEqual(result.errors, ['วันฝนไม่ถูกต้อง']);
    assert.deepEqual(result.warnings, []);
  });
});

describe('readExcelPreview production date rules', () => {
  test('uses Column T when it contains a valid date', async () => {
    const row = await createPreviewRow({
      lotNumber: '260709001',
      lotPackBarcode: '260708ABC',
      columnT: new Date(2026, 6, 9)
    });

    assert.equal(row.productionDate, '2026-07-09');
    assert.deepEqual(row.errors, []);
    assert.deepEqual(row.warnings, []);
  });

  test('falls back to Lot Pack only when Column T is empty', async () => {
    const row = await createPreviewRow({
      lotNumber: '260709002',
      lotPackBarcode: '260709ABC',
      columnT: ''
    });

    assert.equal(row.productionDate, '2026-07-09');
    assert.deepEqual(row.errors, []);
    assert.match(row.warnings[0], /Lot Pack/);
  });

  test('blocks save when Column T is empty and Lot Pack has no valid date', async () => {
    const row = await createPreviewRow({
      lotNumber: '260709003',
      lotPackBarcode: 'BADPACK',
      columnT: ''
    });

    assert.equal(row.productionDate, null);
    assert.deepEqual(row.errors, ['วันฝนว่าง']);
    assert.deepEqual(row.warnings, []);
  });

  test('blocks save when Column T is invalid even if Lot Pack has a valid date', async () => {
    const row = await createPreviewRow({
      lotNumber: '260709004',
      lotPackBarcode: '260709ABC',
      columnT: 'not-a-date'
    });

    assert.equal(row.productionDate, null);
    assert.deepEqual(row.errors, ['วันฝนไม่ถูกต้อง']);
    assert.deepEqual(row.warnings, []);
  });
});
