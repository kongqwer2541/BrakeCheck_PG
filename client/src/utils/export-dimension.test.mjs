import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createEmptyExportDimensionPreview,
  getExportableLotIds,
  getExportDimensionFilterPayload,
  getExportDimensionPreviewKey,
  normalizeExportDimensionSelectedLots
} from './export-dimension.utils.js';

test('returns only lot IDs with valid snapshots', () => {
  const items = [
    { lotId: 10, snapshotInvalid: false },
    { lotId: 20, snapshotInvalid: true },
    { lotId: '30', snapshotInvalid: false }
  ];

  assert.deepEqual(getExportableLotIds(items), ['10', '30']);
});

test('normalizes selected lots and removes unavailable snapshots', () => {
  const items = [
    { lotId: 10, snapshotInvalid: false },
    { lotId: 20, snapshotInvalid: true },
    { lotId: '30', snapshotInvalid: false }
  ];

  assert.deepEqual(
    normalizeExportDimensionSelectedLots(items, [10, 20, 30, 40]),
    ['10', '30']
  );
});

test('builds the same filter payload and preview key', () => {
  const filters = {
    model: 'TEST MODEL',
    productionStartDate: '2026-07-01',
    productionEndDate: '2026-07-10'
  };
  const topicNames = ['Thickness', 'Width'];
  const payload = getExportDimensionFilterPayload(filters, topicNames);

  assert.deepEqual(payload, { ...filters, topicNames });
  assert.equal(
    getExportDimensionPreviewKey(filters, topicNames),
    JSON.stringify(payload)
  );
});

test('creates a fresh empty preview state', () => {
  const firstPreview = createEmptyExportDimensionPreview();
  const secondPreview = createEmptyExportDimensionPreview();

  assert.deepEqual(firstPreview, {
    items: [],
    availableTopics: [],
    topicSummary: [],
    summary: null
  });
  assert.notEqual(firstPreview.items, secondPreview.items);
});
