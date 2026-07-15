import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDashboardQueryString } from './dashboard.api.js';

test('dashboard api keeps date fallback for older running servers', () => {
  const params = new URLSearchParams(buildDashboardQueryString({
    startDate: '2026-06-19',
    endDate: '2026-06-22',
    status: 'all',
    search: '',
    page: 1,
    pageSize: '50'
  }));

  assert.equal(params.get('date'), '2026-06-22');
  assert.equal(params.get('startDate'), '2026-06-19');
  assert.equal(params.get('endDate'), '2026-06-22');
});
