import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { renderResultsPage } from './results.page.js';

test('results page renders top filters and read-only clickable rows without action button', () => {
  const html = renderResultsPage({
    activeTab: 'approved',
    startDate: '2026-06-22',
    endDate: '2026-06-22',
    latestDate: '2026-06-22',
    search: '',
    items: [{
      lotNumber: 'L-APP-1',
      lotPackBarcode: 'PACK-1',
      lotPacking: 'PROD-1',
      modelName: 'MODEL-A',
      dimension: '100x50',
      purchaseOrder: 'PO-1',
      quantity: 100,
      productionDate: '2026-06-22',
      completedAt: '2026-06-23 08:30:00',
      status: 'approved',
      statusLabel: 'Approved',
      attachmentCount: 2
    }],
    summary: { totalItems: 1, page: 1, totalPages: 1, pageSize: '50' },
    counts: { approved: 1, confirmedNg: 0 }
  });

  assert.match(html, /Results/);
  assert.match(html, /Approved/);
  assert.match(html, /รับทราบ NG/);
  assert.match(html, /ย้อนหลัง 1 วัน/);
  assert.match(html, /ย้อนหลัง 3 วัน/);
  assert.match(html, /ไปวันล่าสุด/);
  assert.match(html, /data-open-result-lot="L-APP-1"/);
  assert.match(html, /วันที่จบงาน/);
  assert.doesNotMatch(html, /<th>คำสั่ง<\/th>/);
  assert.doesNotMatch(html, /เปิดดู/);
});

test('results page does not offer all rows page size', () => {
  const html = renderResultsPage({
    summary: { totalItems: 75, page: 1, totalPages: 2, pageSize: '50' }
  });

  assert.doesNotMatch(html, /<option value="all">/);
});

test('results page gives the Lot search field a wide responsive grid column', async () => {
  const html = renderResultsPage();
  const css = await readFile(new URL('../styles/main.css', import.meta.url), 'utf8');

  assert.match(html, /inspection-queue-filters results-filter-layout/);
  assert.match(
    css,
    /\.results-filter-layout\s*\{[\s\S]*grid-template-columns:\s*minmax\(150px,\s*190px\)\s+auto\s+minmax\(320px,\s*1fr\)/
  );
});
