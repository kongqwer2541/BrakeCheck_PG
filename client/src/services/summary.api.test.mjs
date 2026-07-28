import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSummaryLotsQueryString,
  buildSummaryQueryString
} from './summary.api.js';

test('summary api serializes approved filters without dropping Thai text', () => {
  const params = new URLSearchParams(buildSummaryQueryString({
    startDate: '2026-07-01',
    endDate: '2026-07-31',
    modelSearch: 'Isuzu CX',
    grade: '525 A',
    topicSource: 'dimension',
    years: [2026, 2025, 2024]
  }));

  assert.equal(params.get('modelSearch'), 'Isuzu CX');
  assert.equal(params.get('grade'), '525 A');
  assert.equal(params.get('years'), '2026,2025,2024');
});

test('summary lot api keeps strict drill-down fields and pagination', () => {
  const params = new URLSearchParams(buildSummaryLotsQueryString({
    view: 'topic',
    topicSource: 'dimension',
    rankGroup: 'selected',
    topicName: 'ความหนา',
    page: 2,
    pageSize: 50
  }));

  assert.equal(params.get('view'), 'topic');
  assert.equal(params.get('topicSource'), 'dimension');
  assert.equal(params.get('rankGroup'), 'selected');
  assert.equal(params.has('source'), false);
  assert.equal(params.get('topicName'), 'ความหนา');
  assert.equal(params.get('page'), '2');
});
