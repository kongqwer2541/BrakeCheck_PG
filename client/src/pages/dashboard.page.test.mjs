import test from 'node:test';
import assert from 'node:assert/strict';

import { renderDashboardPage } from './dashboard.page.js';

test('dashboard uses queue-style date filters without shift or shortcut actions', () => {
  const html = renderDashboardPage({
    startDate: '2026-06-22',
    endDate: '2026-06-22',
    latestDate: '2026-06-29',
    hasNewerDate: true,
    status: 'all',
    items: [],
    summary: { totalItems: 0, page: 1, totalPages: 1, pageSize: '50' },
    userRole: 'assistant'
  });

  assert.match(html, /data-dashboard-range="1"/);
  assert.match(html, /data-dashboard-range="3"/);
  assert.match(html, /data-dashboard-latest/);
  assert.doesNotMatch(html, /shift-filter/);
  assert.doesNotMatch(html, /quick-actions/);
  assert.doesNotMatch(html, /ยิงบาร์โค้ด|คิว Approved|อัปโหลด Excel|รายการ NG/);
});

test('dashboard action and status badges fit readable Thai labels', () => {
  const html = renderDashboardPage({
    startDate: '2026-06-22',
    endDate: '2026-06-22',
    status: 'all',
    items: [{
      lotNumber: '260526003',
      lotPackBarcode: '260526002',
      lotPacking: '260526-008',
      modelName: 'FUSO TRUCK SUPERGREAT R',
      detail: '170*13.0*8.0-170',
      purchaseOrder: 'T1LE009',
      aciGrade: '535 A',
      quantity: 200,
      status: 'temp',
      statusLabel: 'กำลังตรวจ'
    }],
    summary: { totalItems: 1, page: 1, totalPages: 1, pageSize: '50' },
    userRole: 'assistant'
  });

  assert.match(html, />\s*ยกเลิก\s*</);
  assert.doesNotMatch(html, />Void</);
  assert.match(html, /class="lot-status progress dashboard-status-badge"/);
  assert.match(html, /class="danger-button small-button dashboard-cancel-button"/);
});

test('dashboard latest button stays available when viewing a date range ending at latest date', () => {
  const html = renderDashboardPage({
    startDate: '2026-06-19',
    endDate: '2026-06-22',
    latestDate: '2026-06-22',
    hasNewerDate: false,
    status: 'all',
    items: [],
    summary: { totalItems: 0, page: 1, totalPages: 1, pageSize: '50' },
    userRole: 'assistant'
  });

  assert.match(html, /data-dashboard-latest/);
  assert.doesNotMatch(html, /data-dashboard-latest disabled/);
});

test('dashboard latest button can use end date when latest date is not loaded yet', () => {
  const html = renderDashboardPage({
    startDate: '2026-06-19',
    endDate: '2026-06-22',
    latestDate: '',
    todayDate: '2026-06-29',
    hasNewerDate: false,
    status: 'all',
    items: [],
    summary: { totalItems: 0, page: 1, totalPages: 1, pageSize: '50' },
    userRole: 'assistant'
  });

  assert.match(html, /data-dashboard-latest/);
  assert.doesNotMatch(html, /data-dashboard-latest disabled/);
});
