import test from 'node:test';
import assert from 'node:assert/strict';

import { renderExportReportPage } from './export-report.page.js';

test('export report page follows approval queue table pattern without attachments', () => {
  const html = renderExportReportPage({
    activeTab: 'approved',
    selectedDate: '2026-06-20',
    search: 'LOT',
    items: [{
      lotNumber: 'L001',
      lotPackBarcode: '9001',
      lotPacking: 'P001',
      modelName: 'MODEL-A',
      dimension: '100x50',
      purchaseOrder: 'PO-1',
      quantity: 100,
      productionDate: '2026-06-20',
      status: 'approved',
      statusLabel: 'Approved'
    }],
    summary: { totalItems: 1, page: 1, totalPages: 1, pageSize: '50' }
  });

  assert.match(html, /ส่งออก/);
  assert.match(html, /Approved/);
  assert.match(html, /รับทราบ NG/);
  assert.match(html, /Export Excel/);
  assert.match(html, /Export PDF/);
  assert.match(html, /data-export-pdf-lot="L001"/);
  assert.doesNotMatch(html, /เตรียมใน Step 11\.2/);
  assert.match(html, /ดูข้อมูล/);
  assert.doesNotMatch(html, /ไฟล์แนบ/);
});

test('export report page shows pdf export progress and disables export buttons', () => {
  const html = renderExportReportPage({
    items: [{
      lotNumber: 'L001',
      lotPackBarcode: '9001',
      lotPacking: 'P001',
      modelName: 'MODEL-A',
      dimension: '100x50',
      purchaseOrder: 'PO-1',
      quantity: 100,
      productionDate: '2026-06-20',
      status: 'approved',
      statusLabel: 'Approved'
    }],
    summary: { totalItems: 1, page: 1, totalPages: 1, pageSize: '50' },
    exportingLotNumber: 'L001',
    exportingFormat: 'pdf'
  });

  assert.match(html, /กำลัง Export PDF: L001/);
  assert.match(html, /data-export-pdf-lot="L001" disabled aria-disabled="true"/);
});

test('export report page renders loading state before summary is available', () => {
  assert.doesNotThrow(() => {
    renderExportReportPage({
      summary: null,
      items: [],
      isLoading: true
    });
  });
});
