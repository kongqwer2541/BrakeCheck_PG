import test from 'node:test';
import assert from 'node:assert/strict';

import { renderApprovalQueuePage } from './approval-queue.page.js';

test('approval queue renders tablet-friendly table with attachment placeholder', () => {
  const html = renderApprovalQueuePage({
    activeTab: 'waiting_approve',
    selectedDate: '2026-06-18',
    search: '',
    items: [{
      lotNumber: 'L001',
      lotPackBarcode: '9001',
      lotPacking: 'P001',
      modelName: 'MODEL-A',
      dimension: '100x50',
      purchaseOrder: 'PO-1',
      quantity: 100,
      productionDate: '2026-06-18',
      status: 'waiting_approve',
      statusLabel: 'รออนุมัติ',
      attachmentCount: 2
    }],
    summary: { totalItems: 1, page: 1, totalPages: 1, pageSize: '50' },
    badgeCount: 4
  });

  assert.match(html, /คิวตรวจและอนุมัติ/);
  assert.match(html, /รออนุมัติ/);
  assert.match(html, /งาน NG/);
  assert.match(html, /ไฟล์แนบ/);
  assert.match(html, />2 /);
  assert.match(html, /เปิดตรวจสอบ/);
  assert.match(html, /approval-table-scroll/);
});

test('approval queue renders while loading before summary is available', () => {
  assert.doesNotThrow(() => {
    renderApprovalQueuePage({
      summary: null,
      items: [],
      isLoading: true
    });
  });
});
