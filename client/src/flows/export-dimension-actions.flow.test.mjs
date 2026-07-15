import assert from 'node:assert/strict';
import test from 'node:test';

import { createExportDimensionActions } from './export-dimension-actions.flow.js';
import {
  getExportDimensionPreviewKey
} from '../utils/export-dimension.utils.js';

function createPreviewState() {
  const filters = { model: 'TEST MODEL' };
  const topicNames = ['Thickness'];

  return {
    filters,
    topicNames,
    selectedLotIds: ['10', '20'],
    previewKey: getExportDimensionPreviewKey(filters, topicNames),
    error: '',
    message: ''
  };
}

test('exports selected lots once and reports success', async () => {
  const previewState = createPreviewState();
  const downloads = [];
  const renders = [];
  const actions = createExportDimensionActions({
    previewState,
    downloadExcel: async (payload) => downloads.push(payload),
    render: (options) => renders.push(options),
    handleAccessError: () => false,
    openLot: () => {}
  });

  await actions.handleExportExcel();

  assert.deepEqual(downloads, [{ lotIds: [10, 20], topicNames: ['Thickness'] }]);
  assert.equal(actions.state.exporting, false);
  assert.equal(previewState.message, 'Export Dimension Excel สำเร็จ');
  assert.deepEqual(renders.at(-1), {
    error: '',
    message: 'Export Dimension Excel สำเร็จ',
    isLoading: false
  });
});

test('blocks export when filters no longer match the preview', async () => {
  const previewState = createPreviewState();
  const downloads = [];
  const renders = [];
  previewState.filters.model = 'CHANGED MODEL';
  const actions = createExportDimensionActions({
    previewState,
    downloadExcel: async (payload) => downloads.push(payload),
    render: (options) => renders.push(options),
    handleAccessError: () => false,
    openLot: () => {}
  });

  await actions.handleExportExcel();

  assert.deepEqual(downloads, []);
  assert.deepEqual(previewState.selectedLotIds, []);
  assert.match(renders.at(-1).error, /Preview/);
});

test('ignores a second export while the first download is running', async () => {
  const previewState = createPreviewState();
  let downloadCount = 0;
  let finishDownload;
  const actions = createExportDimensionActions({
    previewState,
    downloadExcel: () => {
      downloadCount += 1;
      return new Promise((resolve) => {
        finishDownload = resolve;
      });
    },
    render: () => {},
    handleAccessError: () => false,
    openLot: () => {}
  });

  const firstExport = actions.handleExportExcel();
  const secondExport = actions.handleExportExcel();

  assert.equal(downloadCount, 1);
  assert.equal(actions.state.exporting, true);
  finishDownload();
  await Promise.all([firstExport, secondExport]);
  assert.equal(actions.state.exporting, false);
});

test('download errors stop exporting and keep a user-facing message', async () => {
  const previewState = createPreviewState();
  const renders = [];
  const actions = createExportDimensionActions({
    previewState,
    downloadExcel: async () => {
      throw new Error('Download failed');
    },
    render: (options) => renders.push(options),
    handleAccessError: () => false,
    openLot: () => {}
  });

  await actions.handleExportExcel();

  assert.equal(actions.state.exporting, false);
  assert.deepEqual(renders.at(-1), {
    error: 'Download failed',
    message: '',
    isLoading: false
  });
});

test('reset invalidates an export that finishes after logout', async () => {
  const previewState = createPreviewState();
  const renders = [];
  let finishDownload;
  const actions = createExportDimensionActions({
    previewState,
    downloadExcel: () => new Promise((resolve) => {
      finishDownload = resolve;
    }),
    render: (options) => renders.push(options),
    handleAccessError: () => false,
    openLot: () => {}
  });

  const exportPromise = actions.handleExportExcel();
  actions.reset();
  finishDownload();
  await exportPromise;

  assert.equal(actions.state.exporting, false);
  assert.equal(previewState.message, '');
  assert.equal(renders.length, 1);
});
