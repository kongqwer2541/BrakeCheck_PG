import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collapseTopModels,
  getQualitySummary,
  getQualitySummaryLots,
  getTrendGrouping,
  normalizeSummaryFilters
} from './summary.service.js';

function createSummaryTestConnection({
  stats = {},
  options = { grades: [], years: [] },
  trend = [],
  topics = [],
  models = [],
  yearly = []
} = {}) {
  const calls = [];
  const queryRows = {
    'summary:stats': [stats],
    'summary:options': [options],
    'summary:trend': trend,
    'summary:topics': topics,
    'summary:models': models,
    'summary:yearly': yearly
  };

  return {
    calls,
    connection: {
      query: async (sql, params) => {
        calls.push({ sql, params });
        const queryName = Object.keys(queryRows).find((name) => sql.includes(name));
        return { rows: queryName ? queryRows[queryName] : [] };
      }
    }
  };
}

const noQueryConnection = {
  query: async () => {
    throw new Error('query must not run for invalid summary drill-down input');
  }
};

function createSummaryLotsConnection(calls, {
  total = 1,
  lots = [{
    lot_number: 'LOT-001',
    production_date: '2026-07-10',
    model_name: 'MODEL-A',
    dimension: '10x20',
    aci_grade: '525 A',
    final_result: 'confirmed_ng',
    ng_topics: ['Thickness', 'Box condition']
  }]
} = {}) {
  return {
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.includes('summary:lots:count')) {
        return { rows: [{ total_lots: total }] };
      }
      if (sql.includes('summary:lots:list')) {
        return { rows: lots };
      }
      return { rows: [] };
    }
  };
}

test('summary defaults to current month and three calendar years', () => {
  const result = normalizeSummaryFilters({}, new Date('2026-07-28T00:00:00.000Z'));

  assert.deepEqual(result, {
    startDate: '2026-07-01',
    endDate: '2026-07-31',
    modelSearch: '',
    grade: '',
    topicSource: 'all',
    years: [2026, 2025, 2024],
    trendGrouping: 'day'
  });
});

test('summary rejects ranges longer than 366 days', () => {
  assert.throws(
    () => normalizeSummaryFilters({
      startDate: '2025-01-01',
      endDate: '2026-01-02'
    }),
    (error) => error.statusCode === 400
  );
});

test('summary accepts only three unique years and known topic sources', () => {
  assert.throws(
    () => normalizeSummaryFilters({ years: '2026,2025,2024,2023' }),
    (error) => error.statusCode === 400
  );
  assert.throws(
    () => normalizeSummaryFilters({ topicSource: 'unknown' }),
    (error) => error.statusCode === 400
  );
});

test('summary rejects model and grade filters that exceed their limits', () => {
  assert.throws(
    () => normalizeSummaryFilters({ modelSearch: 'A'.repeat(121) }),
    (error) => error.statusCode === 400
  );
  assert.throws(
    () => normalizeSummaryFilters({ grade: 'A'.repeat(21) }),
    (error) => error.statusCode === 400
  );
});

test('summary selects day week and month grouping from range length', () => {
  assert.equal(getTrendGrouping('2026-07-01', '2026-07-31'), 'day');
  assert.equal(getTrendGrouping('2026-05-01', '2026-07-31'), 'week');
  assert.equal(getTrendGrouping('2025-08-01', '2026-07-31'), 'month');
});

test('summary calculates final results NG rate and unfinished groups', async () => {
  const calls = [];
  const connection = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.includes('summary:stats')) {
        return { rows: [{
          final_lots: 10,
          approved_lots: 8,
          confirmed_ng_lots: 2,
          waiting_inspection: 1,
          in_progress: 2,
          need_fix: 1,
          waiting_packing: 1,
          waiting_approval: 2
        }] };
      }
      if (sql.includes('summary:options')) {
        return { rows: [{ grades: ['525 A'], years: [2026] }] };
      }
      return { rows: [] };
    }
  };

  const result = await getQualitySummary({
    startDate: '2026-07-01',
    endDate: '2026-07-31',
    years: '2026'
  }, connection);

  assert.deepEqual(result.stats, {
    finalLots: 10,
    approvedLots: 8,
    confirmedNgLots: 2,
    ngRate: 20,
    unfinishedTotal: 7,
    unfinished: {
      waitingInspection: 1,
      inProgress: 2,
      needFix: 1,
      waitingPacking: 1,
      waitingApproval: 2
    }
  });
  assert.ok(calls.every(({ params }) => Array.isArray(params)));

  const statsSql = calls.find(({ sql }) => sql.includes('summary:stats')).sql;
  assert.match(statsSql, /lots\.status <> 'void'/);
  assert.match(statsSql, /action = 'approve'/);
  assert.match(statsSql, /action = 'confirm_ng'/);
  assert.match(statsSql, /review_ng/);
  assert.doesNotMatch(statsSql, /changed_by|actor_name_snapshot|password_hash|token_hash/);
});

test('summary keeps top five rows and combines the rest as Other', () => {
  const rows = [
    { modelName: 'A', finalLots: 10, confirmedNgLots: 5 },
    { modelName: 'B', finalLots: 10, confirmedNgLots: 4 },
    { modelName: 'C', finalLots: 10, confirmedNgLots: 3 },
    { modelName: 'D', finalLots: 10, confirmedNgLots: 2 },
    { modelName: 'E', finalLots: 10, confirmedNgLots: 1 },
    { modelName: 'F', finalLots: 4, confirmedNgLots: 1 },
    { modelName: 'G', finalLots: 6, confirmedNgLots: 1 }
  ];

  assert.deepEqual(collapseTopModels(rows).at(-1), {
    modelName: 'อื่น ๆ',
    finalLots: 10,
    confirmedNgLots: 2,
    ngRate: 20,
    isOther: true,
    isLowData: false
  });
});

test('summary returns one global top-five topic ranking and one exact Other row', async () => {
  const { connection, calls } = createSummaryTestConnection({
    topics: [
      { source: 'dimension', topic_name: 'A', ng_lots: 6, is_other: false },
      { source: 'packing', topic_name: 'B', ng_lots: 5, is_other: false },
      { source: 'dimension', topic_name: 'C', ng_lots: 4, is_other: false },
      { source: 'packing', topic_name: 'D', ng_lots: 3, is_other: false },
      { source: 'dimension', topic_name: 'E', ng_lots: 2, is_other: false },
      { source: 'all', topic_name: null, ng_lots: 2, is_other: true }
    ]
  });

  const result = await getQualitySummary({
    startDate: '2026-07-01',
    endDate: '2026-07-31',
    years: '2026',
    topicSource: 'all'
  }, connection);

  assert.equal(result.topNgTopics.length, 6);
  assert.deepEqual(result.topNgTopics.at(-1), {
    source: 'all',
    topicName: 'อื่น ๆ',
    ngLots: 2,
    isOther: true
  });

  const topicSql = calls.find(({ sql }) => sql.includes('summary:topics')).sql;
  assert.match(topicSql, /ROW_NUMBER\(\) OVER/);
  assert.match(topicSql, /COUNT\(DISTINCT scoped_topics\.lot_id\)/);
  assert.match(topicSql, /topic_rank <= 5/);
});

test('summary maps trend periods from final-result totals', async () => {
  const { connection } = createSummaryTestConnection({
    trend: [{
      period_start: '2026-07-01',
      final_lots: 10,
      approved_lots: 8,
      confirmed_ng_lots: 2
    }]
  });

  const result = await getQualitySummary({
    startDate: '2026-07-01',
    endDate: '2026-07-31',
    years: '2026'
  }, connection);

  assert.deepEqual(result.trend, [{
    periodKey: '2026-07-01',
    label: '01/07/2026',
    periodStart: '2026-07-01',
    periodEnd: '2026-07-01',
    finalLots: 10,
    approvedLots: 8,
    confirmedNgLots: 2,
    ngRate: 20
  }]);
});

test('summary clamps week drill-down periods to the selected date range', async () => {
  const { connection } = createSummaryTestConnection({
    trend: [
      {
        period_start: '2026-05-04',
        final_lots: 2,
        approved_lots: 1,
        confirmed_ng_lots: 1
      },
      {
        period_start: '2026-07-06',
        final_lots: 2,
        approved_lots: 1,
        confirmed_ng_lots: 1
      }
    ]
  });

  const result = await getQualitySummary({
    startDate: '2026-05-08',
    endDate: '2026-07-10',
    years: '2026'
  }, connection);

  assert.equal(result.trend[0].periodStart, '2026-05-08');
  assert.equal(result.trend[0].periodEnd, '2026-05-10');
  assert.equal(result.trend[1].periodStart, '2026-07-06');
  assert.equal(result.trend[1].periodEnd, '2026-07-10');
});

test('summary counts each NG Lot once per topic and marks low-data models', async () => {
  const { connection, calls } = createSummaryTestConnection({
    topics: [
      { source: 'dimension', topic_name: 'ความหนา', ng_lots: 3 },
      { source: 'packing', topic_name: 'สภาพกล่อง', ng_lots: 2 }
    ],
    models: [
      { model_name: 'MODEL-A', final_lots: 4, confirmed_ng_lots: 2 }
    ]
  });

  const result = await getQualitySummary({
    startDate: '2026-07-01',
    endDate: '2026-07-31',
    years: '2026'
  }, connection);

  assert.equal(result.topNgTopics[0].ngLots, 3);
  assert.equal(result.topNgModels[0].ngRate, 50);
  assert.equal(result.topNgModels[0].isLowData, true);

  const topicSql = calls.find(({ sql }) => sql.includes('summary:topics')).sql;
  assert.match(topicSql, /COUNT\(DISTINCT/);
  assert.match(topicSql, /pieces_data\s*#>>\s*'\{meta,ngStop,topicName\}'/);
  assert.match(topicSql, /jsonb_array_elements/);
  assert.match(topicSql, /topic->>'value'\s*=\s*'fail'/);
});

test('summary compares selected calendar years against the next older year', async () => {
  const { connection } = createSummaryTestConnection({
    yearly: [
      {
        year: 2025,
        final_lots: 100,
        approved_lots: 92,
        confirmed_ng_lots: 8
      },
      {
        year: 2026,
        final_lots: 100,
        approved_lots: 95,
        confirmed_ng_lots: 5
      }
    ]
  });

  const result = await getQualitySummary({
    startDate: '2026-07-01',
    endDate: '2026-07-31',
    years: '2026,2025'
  }, connection);

  assert.deepEqual(result.yearly, [
    {
      year: 2026,
      finalLots: 100,
      approvedLots: 95,
      confirmedNgLots: 5,
      ngRate: 5,
      ngRateChange: -3
    },
    {
      year: 2025,
      finalLots: 100,
      approvedLots: 92,
      confirmedNgLots: 8,
      ngRate: 8,
      ngRateChange: null
    }
  ]);
});

test('summary drill-down rejects unknown view and invalid page data', async () => {
  await assert.rejects(
    () => getQualitySummaryLots({ view: 'delete' }, noQueryConnection),
    (error) => error.statusCode === 400
  );
  await assert.rejects(
    () => getQualitySummaryLots({ view: 'final', page: '0' }, noQueryConnection),
    (error) => error.statusCode === 400
  );
  await assert.rejects(
    () => getQualitySummaryLots({ view: 'final', pageSize: '24' }, noQueryConnection),
    (error) => error.statusCode === 400
  );
});

test('summary drill-down validates view-specific filters', async () => {
  const invalidInputs = [
    { view: 'trend', periodStart: 'bad', periodEnd: '2026-07-01' },
    { view: 'topic', topicSource: 'all', topicName: 'Thickness' },
    { view: 'topic', topicSource: 'dimension', topicName: '', rankGroup: 'selected' },
    { view: 'model', modelName: '', rankGroup: 'selected' },
    { view: 'model', modelName: 'A'.repeat(201) },
    { view: 'year', year: '1999' },
    { view: 'unfinished', unfinishedStatus: 'unknown' }
  ];

  for (const input of invalidInputs) {
    await assert.rejects(
      () => getQualitySummaryLots(input, noQueryConnection),
      (error) => error.statusCode === 400
    );
  }
});

test('summary drill-down rejects trend periods outside the selected range', async () => {
  await assert.rejects(
    () => getQualitySummaryLots({
      view: 'trend',
      startDate: '2026-07-08',
      endDate: '2026-07-12',
      periodStart: '2026-07-06',
      periodEnd: '2026-07-12'
    }, noQueryConnection),
    (error) => error.statusCode === 400
  );
});

test('summary drill-down escapes wildcard search and stays paginated', async () => {
  const calls = [];
  const connection = createSummaryLotsConnection(calls);

  const result = await getQualitySummaryLots({
    view: 'final',
    startDate: '2026-07-01',
    endDate: '2026-07-31',
    modelSearch: 'A%_\\',
    page: '1',
    pageSize: '50'
  }, connection);

  assert.deepEqual(result.summary, {
    total: 1,
    page: 1,
    pageSize: 50,
    totalPages: 1
  });
  assert.deepEqual(result.items, [{
    lotNumber: 'LOT-001',
    productionDate: '2026-07-10',
    modelName: 'MODEL-A',
    dimension: '10x20',
    grade: '525 A',
    finalResult: 'confirmed_ng',
    finalResultLabel: 'Confirmed NG',
    ngTopics: ['Thickness', 'Box condition']
  }]);
  assert.ok(calls.flatMap((call) => call.params).includes('%A\\%\\_\\\\%'));

  const listSql = calls.find((call) => call.sql.includes('summary:lots:list')).sql;
  assert.match(listSql, /lots\.lot_number/);
  assert.match(listSql, /ORDER BY production_date DESC, lot_number DESC/);
  assert.match(listSql, /action = 'approve'/);
  assert.match(listSql, /action = 'confirm_ng'/);
  assert.match(listSql, /jsonb_array_elements/);
  assert.doesNotMatch(listSql, /changed_by|actor_name_snapshot|password_hash|token_hash/);
});

test('summary drill-down uses period and selected-year date ranges', async () => {
  const trendCalls = [];
  await getQualitySummaryLots({
    view: 'trend',
    periodStart: '2026-07-06',
    periodEnd: '2026-07-12'
  }, createSummaryLotsConnection(trendCalls));

  assert.ok(trendCalls.flatMap((call) => call.params).includes('2026-07-06'));
  assert.ok(trendCalls.flatMap((call) => call.params).includes('2026-07-12'));

  const yearCalls = [];
  await getQualitySummaryLots(
    { view: 'year', year: '2025' },
    createSummaryLotsConnection(yearCalls)
  );

  assert.ok(yearCalls.flatMap((call) => call.params).includes('2025-01-01'));
  assert.ok(yearCalls.flatMap((call) => call.params).includes('2025-12-31'));
});

test('summary drill-down keeps waiting approval and other rankings aligned with summary', async () => {
  const unfinishedCalls = [];
  await getQualitySummaryLots({
    view: 'unfinished',
    unfinishedStatus: 'waiting_approve'
  }, createSummaryLotsConnection(unfinishedCalls));

  const unfinishedSql = unfinishedCalls.find((call) => call.sql.includes('summary:lots:list')).sql;
  assert.match(unfinishedSql, /status = 'waiting_approve'/);
  assert.match(unfinishedSql, /status = 'ng' AND NOT (classified_lots\.)?has_current_ng_confirmation/);

  const topicCalls = [];
  await getQualitySummaryLots({
    view: 'topic',
    topicSource: 'all',
    rankGroup: 'other'
  }, createSummaryLotsConnection(topicCalls));

  const topicSql = topicCalls.find((call) => call.sql.includes('summary:lots:list')).sql;
  assert.match(topicSql, /LIMIT 5/);
  assert.match(
    topicSql,
    /AND EXISTS\s*\(\s*SELECT 1\s*FROM topic_lots\s*WHERE topic_lots\.lot_id = classified_lots\.id[\s\S]*topic_lots\.topic_name IS NOT NULL[\s\S]*AND NOT EXISTS/
  );
  assert.match(topicSql, /top_ranked_topics\.source = topic_lots\.source/);
  assert.ok(!topicCalls.flatMap((call) => call.params).includes('all'));

  const modelCalls = [];
  await getQualitySummaryLots({
    view: 'model', rankGroup: 'other' }, createSummaryLotsConnection(modelCalls));

  const modelSql = modelCalls.find((call) => call.sql.includes('summary:lots:list')).sql;
  assert.match(modelSql, /LIMIT 5/);
  assert.match(modelSql, /NOT EXISTS/);
});

test('summary topic detail uses topicSource instead of a hidden source field', async () => {
  const calls = [];

  await getQualitySummaryLots({
    view: 'topic',
    topicSource: 'packing',
    source: 'dimension',
    topicName: 'Box condition',
    rankGroup: 'selected'
  }, createSummaryLotsConnection(calls));

  const parameters = calls.flatMap((call) => call.params);
  assert.ok(parameters.includes('packing'));
  assert.ok(!parameters.includes('dimension'));
});
