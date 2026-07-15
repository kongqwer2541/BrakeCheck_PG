import test from 'node:test';
import assert from 'node:assert/strict';

import { renderImportExcelPage } from './import-excel.page.js';

function createPreviewRow(overrides = {}) {
  return {
    rowNumber: 2,
    lotNumber: '260709001',
    lotPackBarcode: '260709ABC',
    lotPacking: '-',
    purchaseOrder: 'PO-1',
    code: 'CODE-1',
    modelName: 'MODEL-A',
    outerSize: '100x50',
    aciGrade: '535 A',
    quantity: 100,
    productionDate: '2026-07-09',
    boreSize: '',
    drillSize: '',
    status: 'new',
    errors: [],
    warnings: [],
    ...overrides
  };
}

test('import preview explains when วันฝน uses Lot Pack fallback', () => {
  const html = renderImportExcelPage({
    activeTab: 'preview',
    preview: {
      rows: [createPreviewRow({
        warnings: ['วันฝนอ่านจาก Lot Pack เพราะคอลัมน์ T ว่างหรือสูตรไม่มีค่า cached result ที่ถูกต้อง']
      })],
      summary: { totalRows: 1, productionDates: ['2026-07-09'] }
    }
  });

  assert.match(html, /วันฝน \(Column T\)/);
  assert.match(html, /วันฝนอ่านจาก Lot Pack/);
});

test('import preview tells QC to fix Column T when วันฝน is invalid', () => {
  const html = renderImportExcelPage({
    activeTab: 'preview',
    preview: {
      rows: [createPreviewRow({
        productionDate: '',
        errors: ['วันฝนไม่ถูกต้อง']
      })],
      errors: [createPreviewRow({
        productionDate: '',
        errors: ['วันฝนไม่ถูกต้อง']
      })],
      summary: { totalRows: 1, errorRows: 1, productionDates: [] }
    }
  });

  assert.match(html, /แก้วันฝน \(Column T\) ใน Excel/);
  assert.match(html, /วันฝนไม่ถูกต้อง/);
});

test('import preview ignores malformed row issues safely', () => {
  const html = renderImportExcelPage({
    activeTab: 'preview',
    preview: {
      rows: [createPreviewRow({
        errors: 'วันฝนไม่ถูกต้อง',
        warnings: 'วันฝนอ่านจาก Lot Pack'
      })],
      summary: { totalRows: 1, productionDates: ['2026-07-09'] }
    }
  });

  assert.match(html, /พร้อมบันทึก/);
  assert.doesNotMatch(html, /วันฝนไม่ถูกต้อง/);
  assert.doesNotMatch(html, /วันฝนอ่านจาก Lot Pack/);
});

test('import preview lists blocking reasons separately', () => {
  const html = renderImportExcelPage({
    activeTab: 'preview',
    saveBlocked: true,
    conflictDates: [{ productionDate: '2026-07-09', lotCount: 2 }],
    preview: {
      rows: [createPreviewRow({ errors: ['วันฝนไม่ถูกต้อง'] })],
      summary: {
        totalRows: 1,
        errorRows: 1,
        duplicateLots: 1,
        productionDates: []
      }
    }
  });

  assert.match(html, /แก้ข้อมูลผิดพลาดในไฟล์ Excel/);
  assert.match(html, /ตรวจ Lot ซ้ำก่อนบันทึก/);
  assert.match(html, /แก้วันฝน \(Column T\) ใน Excel/);
  assert.match(html, /ยืนยันวันฝนเดิมก่อนบันทึก/);
});
