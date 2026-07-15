import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createExportDimensionPreviewFlow,
  createExportDimensionPreviewState
} from './export-dimension-preview.flow.js';

function createTestFlow({ previewResult } = {}) {
  const state = createExportDimensionPreviewState({ model: '' });
  const renders = [];
  const requests = [];
  const flow = createExportDimensionPreviewFlow({
    state,
    getPreview: async (filters) => {
      requests.push(filters);
      return previewResult || {
        items: [
          { lotId: 10, snapshotInvalid: false },
          { lotId: 20, snapshotInvalid: true }
        ],
        availableTopics: ['Thickness'],
        topicSummary: [],
        summary: { totalLots: 2 }
      };
    },
    render: (options) => renders.push(options),
    handleAccessError: () => false
  });

  return { flow, renders, requests, state };
}

test('loads preview and keeps only selectable lots', async () => {
  const { flow, renders, requests, state } = createTestFlow();
  state.topicNames = ['Thickness'];
  state.selectedLotIds = ['10', '20'];

  await flow.loadPreview();

  assert.deepEqual(requests, [{ model: '', topicNames: ['Thickness'] }]);
  assert.deepEqual(state.selectedLotIds, ['10']);
  assert.equal(state.preview.summary.totalLots, 2);
  assert.equal(state.loading, false);
  assert.deepEqual(renders[0], { error: '', message: '', isLoading: true });
  assert.deepEqual(renders.at(-1), { error: '', isLoading: false });
});

test('filter and lot handlers update preview state without API writes', () => {
  const { flow, state } = createTestFlow();
  state.preview = {
    items: [
      { lotId: 10, snapshotInvalid: false },
      { lotId: 20, snapshotInvalid: true }
    ],
    availableTopics: [],
    topicSummary: [],
    summary: null
  };

  flow.handleLotToggle(10, true);
  flow.handleSelectAllLots(true);
  assert.deepEqual(state.selectedLotIds, ['10']);

  flow.handleFilterChange('exportDimensionModel', '  TEST MODEL  ');
  assert.equal(state.filters.model, 'TEST MODEL');
  assert.deepEqual(state.selectedLotIds, []);
  assert.deepEqual(state.preview.items, []);
  assert.equal(state.previewKey, '');
});

test('filter changes invalidate a slower preview response', async () => {
  const state = createExportDimensionPreviewState({ model: 'OLD MODEL' });
  let finishPreview;
  const flow = createExportDimensionPreviewFlow({
    state,
    getPreview: () => new Promise((resolve) => {
      finishPreview = resolve;
    }),
    render: () => {},
    handleAccessError: () => false
  });

  const pendingPreview = flow.loadPreview();
  flow.handleFilterChange('exportDimensionModel', 'NEW MODEL');
  finishPreview({
    items: [{ lotId: 10, snapshotInvalid: false }],
    availableTopics: [],
    topicSummary: [],
    summary: { totalLots: 1 }
  });
  await pendingPreview;

  assert.equal(state.filters.model, 'NEW MODEL');
  assert.deepEqual(state.preview.items, []);
  assert.equal(state.loading, false);
});

test('topic toggle and clear refresh preview with the current selection', async () => {
  const { flow, requests, state } = createTestFlow();
  state.selectedLotIds = ['10'];

  await flow.handleTopicToggle('  Thickness  ', true);
  assert.deepEqual(state.topicNames, ['Thickness']);
  assert.deepEqual(state.selectedLotIds, []);
  assert.deepEqual(requests.at(-1).topicNames, ['Thickness']);

  await flow.handleTopicToggle('Thickness', false);
  assert.deepEqual(state.topicNames, []);
  assert.deepEqual(requests.at(-1).topicNames, []);

  state.topicNames = ['Width'];
  await flow.handleClearTopics();
  assert.deepEqual(state.topicNames, []);
  assert.deepEqual(requests.at(-1).topicNames, []);
});

test('preview errors stop loading and render the original message', async () => {
  const state = createExportDimensionPreviewState({ model: '' });
  const renders = [];
  const flow = createExportDimensionPreviewFlow({
    state,
    getPreview: async () => {
      throw new Error('Preview failed');
    },
    render: (options) => renders.push(options),
    handleAccessError: () => false
  });

  await flow.loadPreview();

  assert.equal(state.loading, false);
  assert.equal(state.error, 'Preview failed');
  assert.deepEqual(renders.at(-1), {
    error: 'Preview failed',
    isLoading: false
  });
});

test('reset clears preview data for the next signed-in user', () => {
  const { flow, state } = createTestFlow();
  state.preview.items = [{ lotId: 10 }];
  state.topicNames = ['Thickness'];
  state.selectedLotIds = ['10'];
  state.previewKey = 'old-preview';
  const previousRequestId = state.requestId;

  flow.reset({ model: '', productionStartDate: '2026-07-10' });

  assert.deepEqual(state.filters, {
    model: '',
    productionStartDate: '2026-07-10'
  });
  assert.deepEqual(state.preview.items, []);
  assert.deepEqual(state.topicNames, []);
  assert.deepEqual(state.selectedLotIds, []);
  assert.equal(state.previewKey, '');
  assert.equal(state.requestId, previousRequestId + 1);
});
