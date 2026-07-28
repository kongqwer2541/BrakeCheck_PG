import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('./main.css', import.meta.url), 'utf8');

function getRule(source, selectorPattern, label) {
  const match = source.match(new RegExp(`${selectorPattern}\\s*\\{([^}]*)\\}`, 's'));

  assert.ok(match, `Missing ${label} rule`);
  return match[1];
}

function getMediaSection(source, width, nextWidth) {
  const marker = `@media (max-width: ${width}px)`;
  const start = source.indexOf(marker);

  assert.notEqual(start, -1, `Missing ${width}px breakpoint`);

  const nextMarker = nextWidth ? `@media (max-width: ${nextWidth}px)` : '';
  const end = nextMarker ? source.indexOf(nextMarker, start + marker.length) : source.length;

  assert.ok(!nextMarker || end > start, `Missing ${nextWidth}px breakpoint after ${width}px`);
  return source.slice(start, end);
}

test('summary uses stable desktop grids and horizontally scrollable tables', () => {
  const pageRule = getRule(css, '\\.summary-page', '.summary-page');
  const filterRule = getRule(css, '\\.summary-filters', '.summary-filters');
  const kpiGridRule = getRule(
    css,
    '\\.summary-page\\s*>\\s*\\.stats-grid',
    '.summary-page > .stats-grid'
  );
  const tableWrapRule = getRule(
    css,
    '\\.summary-page\\s+\\.table-wrap',
    '.summary-page .table-wrap'
  );
  const tableRule = getRule(
    css,
    [
      '\\.summary-trend-table',
      '\\.summary-topic-table',
      '\\.summary-model-table',
      '\\.summary-yearly-table',
      '\\.summary-detail-table'
    ].join('\\s*,\\s*'),
    'Summary table'
  );

  assert.match(pageRule, /display:\s*grid/);
  assert.doesNotMatch(pageRule, /(?:background|border|box-shadow)\s*:/);
  assert.match(filterRule, /grid-template-columns:\s*repeat\(4,\s*minmax\(160px,\s*1fr\)\)/);
  assert.match(kpiGridRule, /grid-template-columns:\s*repeat\(5,\s*minmax\(140px,\s*1fr\)\)/);
  assert.match(tableWrapRule, /overflow-x:\s*auto/);
  assert.match(tableRule, /min-width:\s*760px/);
});

test('summary grid panels can shrink so tables scroll inside the panel', () => {
  const panelRule = getRule(
    css,
    '\\.summary-page\\s*>\\s*\\.latest-lots-panel',
    '.summary-page > .latest-lots-panel'
  );
  const tableWrapRule = getRule(
    css,
    '\\.summary-page\\s+\\.table-wrap',
    '.summary-page .table-wrap'
  );

  assert.match(panelRule, /min-width:\s*0/);
  assert.match(tableWrapRule, /min-width:\s*0/);
  assert.match(tableWrapRule, /overflow-x:\s*auto/);
});

test('summary switches to two columns before the sidebar makes the workspace too narrow', () => {
  const narrowDesktop = getMediaSection(css, 1060, 900);

  assert.match(
    getRule(narrowDesktop, '\\.summary-filters', '.summary-filters at 1060px'),
    /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/
  );
  assert.match(
    getRule(narrowDesktop, '\\.summary-page\\s*>\\s*\\.stats-grid', 'KPI grid at 1060px'),
    /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/
  );
  assert.match(
    getRule(narrowDesktop, '\\.summary-breakdown', '.summary-breakdown at 1060px'),
    /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/
  );
});

test('summary uses two columns at 900px and one column at 640px', () => {
  const tablet = getMediaSection(css, 900, 640);
  const mobile = getMediaSection(css, 640);

  assert.match(
    getRule(tablet, '\\.summary-filters', '.summary-filters at 900px'),
    /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/
  );
  assert.match(
    getRule(tablet, '\\.summary-page\\s*>\\s*\\.stats-grid', 'KPI grid at 900px'),
    /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/
  );
  assert.match(
    getRule(mobile, '\\.summary-filters', '.summary-filters at 640px'),
    /grid-template-columns:\s*1fr/
  );
  assert.match(
    getRule(mobile, '\\.summary-page\\s*>\\s*\\.stats-grid', 'KPI grid at 640px'),
    /grid-template-columns:\s*1fr/
  );
});

test('summary cards use the project radius and long text can wrap', () => {
  const cardRule = getRule(
    css,
    [
      '\\.summary-filters',
      '\\.summary-kpi-button',
      '\\.summary-unfinished-panel',
      '\\.summary-detail-panel'
    ].join('\\s*,\\s*'),
    'Summary card radius'
  );
  const kpiRule = getRule(css, '\\.summary-kpi-button', '.summary-kpi-button');
  const filterChildrenRule = getRule(
    css,
    '\\.summary-filters\\s*>\\s*\\*',
    '.summary-filters > *'
  );
  const breakdownChildrenRule = getRule(
    css,
    '\\.summary-breakdown\\s*>\\s*\\*',
    '.summary-breakdown > *'
  );

  assert.match(cardRule, /border-radius:\s*8px/);
  assert.match(kpiRule, /min-width:\s*0/);
  assert.match(kpiRule, /overflow-wrap:\s*anywhere/);
  assert.match(filterChildrenRule, /min-width:\s*0/);
  assert.match(breakdownChildrenRule, /overflow-wrap:\s*anywhere/);
});
