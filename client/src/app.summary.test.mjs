import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('app wires Summary navigation and opens Lot details read-only', async () => {
  const source = await readFile(new URL('./app.js', import.meta.url), 'utf8');
  const routes = await readFile(new URL('./app.routes.js', import.meta.url), 'utf8');
  const page = await readFile(new URL('./pages/summary.page.js', import.meta.url), 'utf8');
  const api = await readFile(new URL('./services/summary.api.js', import.meta.url), 'utf8');
  const controller = await readFile(new URL('../../server/src/controllers/summary.controller.js', import.meta.url), 'utf8');

  assert.match(routes, /summary:\s*\{\s*action:\s*'summary'\s*\}/);
  assert.match(source, /import\s*\{\s*getQualitySummary,\s*getQualitySummaryLots\s*\}/);
  assert.match(source, /summary:\s*\(\)\s*=>\s*loadSummary\(\)/);
  assert.match(source, /function handleSummaryApplyFilters[\s\S]*return loadSummary\(\)/);
  assert.match(source, /function handleSummaryRefresh[\s\S]*return loadSummary\(\)/);
  assert.match(source, /function handleSummaryOpenDetails[\s\S]*return loadSummaryDetails\(\)/);
  assert.match(source, /function handleSummaryDetailPageChange[\s\S]*return loadSummaryDetails\(\)/);
  assert.match(source, /currentMainPage !== 'summary'/);
  assert.match(source, /function handleOpenSummaryLot/);
  assert.match(source, /rememberLastPage\('summary'\)[\s\S]*lotInspectionReadOnly = true/);
  assert.match(source, /\.\.\.requestedDetail/);
  assert.match(page, /data-summary-detail-request=/);
  assert.match(page, /JSON\.parse\(button\.dataset\.summaryDetailRequest\)/);
  assert.match(api, /topicSource: filters\.topicSource/);
  assert.doesNotMatch(api, /source: filters\.source/);
  assert.match(controller, /topicSource: req\.query\.topicSource/);
  assert.doesNotMatch(controller, /source: req\.query\.source/);
});
