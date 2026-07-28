import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  bindSummaryPage,
  defaultSummaryPageSize,
  renderSummaryPage
} from './summary.page.js';

const fixture = {
  filters: {
    startDate: '2026-07-01',
    endDate: '2026-07-31',
    modelSearch: '',
    grade: '',
    topicSource: 'all',
    years: [2026, 2025, 2024],
    trendGrouping: 'day'
  },
  options: { grades: ['525 A'], years: [2026, 2025, 2024, 2023] },
  updatedAt: '2026-07-28T10:30:00.000Z',
  stats: {
    finalLots: 10,
    approvedLots: 8,
    confirmedNgLots: 2,
    ngRate: 20,
    unfinishedTotal: 3,
    unfinished: {
      waitingInspection: 1,
      inProgress: 1,
      needFix: 0,
      waitingPacking: 0,
      waitingApproval: 1
    }
  },
  trend: [{
    periodKey: '2026-07-01',
    label: '01/07/2026',
    periodStart: '2026-07-01',
    periodEnd: '2026-07-01',
    finalLots: 10,
    approvedLots: 8,
    confirmedNgLots: 2,
    ngRate: 20
  }],
  topNgTopics: [{
    source: 'dimension',
    topicName: 'ความหนา',
    ngLots: 2,
    isOther: false
  }],
  topNgModels: [{
    modelName: 'MODEL-A',
    finalLots: 4,
    confirmedNgLots: 2,
    ngRate: 50,
    isLowData: true,
    isOther: false
  }],
  yearly: [{
    year: 2026,
    finalLots: 10,
    approvedLots: 8,
    confirmedNgLots: 2,
    ngRate: 20,
    ngRateChange: null
  }]
};

test('summary renders approved KPIs tables and read-only drill actions', () => {
  const html = renderSummaryPage({ data: fixture });

  assert.match(html, /Summary/);
  assert.match(html, /10/);
  assert.match(html, /20%/);
  assert.match(html, /ความหนา/);
  assert.match(html, /MODEL-A/);
  assert.match(html, /ข้อมูลน้อย/);
  assert.match(html, /data-summary-detail-request="{&quot;view&quot;:&quot;topic&quot;,&quot;rankGroup&quot;:&quot;selected&quot;,&quot;topicSource&quot;:&quot;dimension&quot;,&quot;topicName&quot;/);
  assert.match(html, /data-summary-detail-request="{&quot;view&quot;:&quot;model&quot;,&quot;rankGroup&quot;:&quot;selected&quot;,&quot;modelName&quot;:&quot;MODEL-A&quot;}/);
  assert.match(html, /data-summary-detail-request="{&quot;view&quot;:&quot;trend&quot;,&quot;periodStart&quot;:&quot;2026-07-01&quot;,&quot;periodEnd&quot;:&quot;2026-07-01&quot;}/);
  assert.match(html, /data-summary-detail-request="{&quot;view&quot;:&quot;year&quot;,&quot;year&quot;:2026}/);
  assert.match(html, /data-summary-detail-request="{&quot;view&quot;:&quot;unfinished&quot;,&quot;unfinishedStatus&quot;:&quot;pending&quot;}/);
  assert.match(html, /value="packing"/);
  assert.doesNotMatch(html, /value="additional"/);
  assert.doesNotMatch(html, /data-summary-(approve|confirm-ng|edit)/);
});

test('summary escapes server text and renders loading empty and error states', () => {
  assert.doesNotMatch(
    renderSummaryPage({
      data: {
        ...fixture,
        topNgModels: [{
          modelName: '<img src=x onerror=alert(1)>',
          finalLots: 1,
          confirmedNgLots: 1,
          ngRate: 100,
          isLowData: true
        }]
      }
    }),
    /<img/
  );
  assert.match(renderSummaryPage({ isLoading: true }), /กำลังโหลด/);
  assert.match(
    renderSummaryPage({ error: 'ไม่สามารถโหลด Summary ได้' }),
    /ไม่สามารถโหลด Summary ได้/
  );
  assert.match(renderSummaryPage({ data: { ...fixture, trend: [] } }), /ไม่พบข้อมูล/);
});

test('summary uses readable Thai UI copy without mojibake markers', async () => {
  const pageSource = await readFile(new URL('./summary.page.js', import.meta.url), 'utf8');
  const detailHtml = renderSummaryPage({
    data: fixture,
    detail: {
      view: 'final',
      title: 'Final lots',
      page: 1,
      totalPages: 2,
      totalItems: 1,
      items: [{
        lotNumber: 'LOT-001',
        modelName: 'MODEL-A',
        finalResultLabel: 'Approved'
      }]
    }
  });
  const loadingHtml = renderSummaryPage({ isLoading: true });
  const mojibakeMarker = /[\u0080-\u009f]|เน€|เธ[”–—]/u;

  assert.doesNotMatch(pageSource, mojibakeMarker);
  assert.doesNotMatch(`${loadingHtml}\n${detailHtml}`, mojibakeMarker);
  assert.match(loadingHtml, /กำลังโหลด Summary\.\.\./);
  assert.match(detailHtml, /ทุกเกรด/);
  assert.match(detailHtml, /ข้อมูลน้อย/);
  assert.match(detailHtml, /ดูรายละเอียด/);
  assert.match(detailHtml, /ดู Lot/);
  assert.match(detailHtml, /1 รายการ/);
  assert.match(detailHtml, /<th>สถานะ<\/th><th>คำสั่ง<\/th>/);
  assert.match(detailHtml, /ก่อนหน้า/);
  assert.match(detailHtml, /หน้า 1 \/ 2/);
  assert.match(detailHtml, /ถัดไป/);
});

test('summary renders complete Other-row detail requests with their ranking context', () => {
  const html = renderSummaryPage({
    data: {
      ...fixture,
      topNgTopics: [
        { source: 'all', topicName: 'Other', ngLots: 3, isOther: true },
        { source: 'dimension', topicName: 'Other', ngLots: 2, isOther: true },
        { source: 'packing', topicName: 'Other', ngLots: 1, isOther: true }
      ],
      topNgModels: [{ modelName: 'Other', finalLots: 4, confirmedNgLots: 2, ngRate: 50, isOther: true }]
    }
  });

  assert.match(html, /Other \(All Other\)/);
  assert.match(html, /Other \(Dimension Other\)/);
  assert.match(html, /Other \(Packing Other\)/);
  assert.match(html, /data-summary-detail-request="{&quot;view&quot;:&quot;topic&quot;,&quot;rankGroup&quot;:&quot;other&quot;,&quot;topicSource&quot;:&quot;all&quot;}/);
  assert.match(html, /data-summary-detail-request="{&quot;view&quot;:&quot;topic&quot;,&quot;rankGroup&quot;:&quot;other&quot;,&quot;topicSource&quot;:&quot;dimension&quot;}/);
  assert.match(html, /data-summary-detail-request="{&quot;view&quot;:&quot;topic&quot;,&quot;rankGroup&quot;:&quot;other&quot;,&quot;topicSource&quot;:&quot;packing&quot;}/);
  assert.match(html, /data-summary-detail-request="{&quot;view&quot;:&quot;model&quot;,&quot;rankGroup&quot;:&quot;other&quot;}/);
});

test('summary disables only unchecked annual years after three are selected', () => {
  const html = renderSummaryPage({ data: fixture });

  assert.match(html, /data-summary-year="2026"[^>]*checked/);
  assert.match(html, /data-summary-year="2025"[^>]*checked/);
  assert.match(html, /data-summary-year="2024"[^>]*checked/);
  assert.match(html, /data-summary-year="2023"[^>]*disabled/);
  assert.match(renderSummaryPage({ data: fixture, isLoading: true }), /data-summary-refresh[^>]*disabled/);
  assert.match(html, /data-summary-model-search[^>]*maxlength="120"/);
  assert.equal(defaultSummaryPageSize, 50);
});

test('summary renders only three selected years when the incoming filter has more', () => {
  const html = renderSummaryPage({
    data: {
      ...fixture,
      filters: { ...fixture.filters, years: [2026, 2025, 2024, 2023] }
    }
  });

  assert.equal((html.match(/data-summary-year="[^"]+"[^>]*checked/g) || []).length, 3);
  assert.doesNotMatch(html, /data-summary-year="2023"[^>]*checked/);
  assert.match(html, /data-summary-year="2023"[^>]*disabled/);
});

test('summary renders loading error and empty states for a selected detail table', () => {
  const detail = { view: 'topic', title: 'Topic lots', items: [] };

  assert.match(
    renderSummaryPage({ data: fixture, detail, detailLoading: true }),
    /กำลังโหลด/
  );
  assert.match(
    renderSummaryPage({ data: fixture, detail: { ...detail, error: 'Detail unavailable' } }),
    /Detail unavailable/
  );
  assert.match(renderSummaryPage({ data: fixture, detail }), /ไม่พบข้อมูล/);
});

function createElement({ dataset = {}, value = '', checked = false } = {}) {
  const listeners = new Map();

  return {
    dataset,
    value,
    checked,
    addEventListener(type, listener) {
      listeners.set(type, [...(listeners.get(type) || []), listener]);
    },
    removeEventListener(type, listener) {
      listeners.set(type, (listeners.get(type) || []).filter((item) => item !== listener));
    },
    trigger(type) {
      listeners.get(type)?.forEach((listener) => listener({ target: this }));
    }
  };
}

function decodeHtmlAttribute(value) {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&#039;', "'");
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

test('summary bindings pass read-only filter and drill actions to handlers', () => {
  const startDate = createElement({ value: '2026-07-01' });
  const endDate = createElement({ value: '2026-07-31' });
  const modelSearch = createElement({ value: 'MODEL-A' });
  const grade = createElement({ value: '525 A' });
  const topicSource = createElement({ value: 'dimension' });
  const year2026 = createElement({ dataset: { summaryYear: '2026' }, checked: true });
  const year2025 = createElement({ dataset: { summaryYear: '2025' }, checked: false });
  const apply = createElement();
  const refresh = createElement();
  const detail = createElement({ dataset: { summaryDetailRequest: JSON.stringify({
    view: 'topic',
    rankGroup: 'selected',
    topicSource: 'dimension',
    topicName: 'Thickness'
  }) } });
  const page = createElement({ dataset: { summaryPage: '2' } });
  const lot = createElement({ dataset: { summaryOpenLot: 'LOT-001' } });
  const selectorMap = new Map([
    ['[data-summary-start-date]', startDate],
    ['[data-summary-end-date]', endDate],
    ['[data-summary-model-search]', modelSearch],
    ['[data-summary-grade]', grade],
    ['[data-summary-topic-source]', topicSource],
    ['[data-summary-apply]:not([disabled])', apply],
    ['[data-summary-refresh]:not([disabled])', refresh]
  ]);
  const selectorAllMap = new Map([
    ['[data-summary-year]', [year2026, year2025]],
    ['[data-summary-detail-request]:not([disabled])', [detail]],
    ['[data-summary-page]:not([disabled])', [page]],
    ['[data-summary-open-lot]:not([disabled])', [lot]]
  ]);
  const originalDocument = globalThis.document;
  const calls = [];

  globalThis.document = {
    querySelector(selector) {
      return selectorMap.get(selector) || null;
    },
    querySelectorAll(selector) {
      return selectorAllMap.get(selector) || [];
    }
  };

  try {
    bindSummaryPage({
      onApplyFilters: (filters) => calls.push(['apply', filters]),
      onRefresh: () => calls.push(['refresh']),
      onTopicSourceChange: (source) => calls.push(['source', source]),
      onYearsChange: (years) => calls.push(['years', years]),
      onOpenDetails: (request) => calls.push(['detail', request]),
      onDetailPageChange: (nextPage) => calls.push(['page', nextPage]),
      onOpenLot: (lotNumber) => calls.push(['lot', lotNumber])
    });

    apply.trigger('click');
    refresh.trigger('click');
    topicSource.trigger('change');
    year2025.trigger('change');
    detail.trigger('click');
    page.trigger('click');
    lot.trigger('click');
  } finally {
    globalThis.document = originalDocument;
  }

  assert.deepEqual(calls, [
    ['apply', {
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      modelSearch: 'MODEL-A',
      grade: '525 A',
      topicSource: 'dimension'
    }],
    ['refresh'],
    ['source', 'dimension'],
    ['years', [2026]],
    ['detail', {
      view: 'topic',
      rankGroup: 'selected',
      topicSource: 'dimension',
      topicName: 'Thickness'
    }],
    ['page', 2],
    ['lot', 'LOT-001']
  ]);
});

test('summary detail request preserves Thai quotes and ampersands through the DOM dataset', () => {
  const topicName = 'ความหนา "A" & B';
  const html = renderSummaryPage({
    data: {
      ...fixture,
      topNgTopics: [{ source: 'dimension', topicName, ngLots: 2, isOther: false }]
    }
  });
  const encodedRequest = [...html.matchAll(/data-summary-detail-request="([^"]+)"/g)]
    .map((match) => match[1])
    .find((value) => value.includes('&quot;topicName&quot;'));
  const detail = createElement({
    dataset: { summaryDetailRequest: decodeHtmlAttribute(encodedRequest) }
  });
  const originalDocument = globalThis.document;
  let receivedRequest;

  globalThis.document = {
    querySelector() {
      return null;
    },
    querySelectorAll(selector) {
      return selector === '[data-summary-detail-request]:not([disabled])' ? [detail] : [];
    }
  };

  try {
    bindSummaryPage({
      onOpenDetails: (request) => {
        receivedRequest = request;
      }
    });
    detail.trigger('click');
  } finally {
    globalThis.document = originalDocument;
  }

  assert.deepEqual(receivedRequest, {
    view: 'topic',
    rankGroup: 'selected',
    topicSource: 'dimension',
    topicName
  });
});

test('summary bindings undo a fourth selected year', () => {
  const year2026 = createElement({ dataset: { summaryYear: '2026' }, checked: true });
  const year2025 = createElement({ dataset: { summaryYear: '2025' }, checked: true });
  const year2024 = createElement({ dataset: { summaryYear: '2024' }, checked: true });
  const year2023 = createElement({ dataset: { summaryYear: '2023' }, checked: true });
  const originalDocument = globalThis.document;
  const selectedYears = [];

  globalThis.document = {
    querySelector() {
      return null;
    },
    querySelectorAll(selector) {
      return selector === '[data-summary-year]'
        ? [year2026, year2025, year2024, year2023]
        : [];
    }
  };

  try {
    bindSummaryPage({
      onYearsChange: (years) => selectedYears.push(years)
    });

    year2023.trigger('change');
  } finally {
    globalThis.document = originalDocument;
  }

  assert.equal(year2023.checked, false);
  assert.deepEqual(selectedYears, [[2026, 2025, 2024]]);
});

test('summary bindings allow only one Summary request until it settles', async () => {
  const apply = createElement();
  const refresh = createElement();
  const detail = createElement({ dataset: { summaryDetailRequest: JSON.stringify({ view: 'final' }) } });
  const page = createElement({ dataset: { summaryPage: '2' } });
  const lot = createElement({ dataset: { summaryOpenLot: 'LOT-001' } });
  const applyRequest = createDeferred();
  const refreshRequest = createDeferred();
  const detailRequest = createDeferred();
  const pageRequest = createDeferred();
  const lotRequest = createDeferred();
  const originalDocument = globalThis.document;
  const calls = { apply: 0, refresh: 0, detail: 0, page: 0, lot: 0 };

  globalThis.document = {
    querySelector(selector) {
      return new Map([
        ['[data-summary-apply]:not([disabled])', apply],
        ['[data-summary-refresh]:not([disabled])', refresh]
      ]).get(selector) || null;
    },
    querySelectorAll(selector) {
      return new Map([
        ['[data-summary-year]', []],
        ['[data-summary-detail-request]:not([disabled])', [detail]],
        ['[data-summary-page]:not([disabled])', [page]],
        ['[data-summary-open-lot]:not([disabled])', [lot]]
      ]).get(selector) || [];
    }
  };

  try {
    const handlers = {
      onApplyFilters: () => {
        calls.apply += 1;
        return applyRequest.promise;
      },
      onRefresh: () => {
        calls.refresh += 1;
        return refreshRequest.promise;
      },
      onOpenDetails: () => {
        calls.detail += 1;
        return detailRequest.promise;
      },
      onDetailPageChange: () => {
        calls.page += 1;
        return pageRequest.promise;
      },
      onOpenLot: () => {
        calls.lot += 1;
        return lotRequest.promise;
      }
    };

    bindSummaryPage(handlers);
    bindSummaryPage(handlers);

    refresh.trigger('click');
    refresh.trigger('click');
    apply.trigger('click');
    detail.trigger('click');
    page.trigger('click');
    lot.trigger('click');

    assert.deepEqual(calls, { apply: 0, refresh: 1, detail: 0, page: 0, lot: 0 });

    refreshRequest.resolve();
    await flushPromises();

    apply.trigger('click');
    assert.deepEqual(calls, { apply: 1, refresh: 1, detail: 0, page: 0, lot: 0 });

    applyRequest.reject(new Error('retry apply'));
    await flushPromises();

    detail.trigger('click');
    page.trigger('click');
    lot.trigger('click');

    assert.deepEqual(calls, { apply: 1, refresh: 1, detail: 1, page: 0, lot: 0 });

    detailRequest.resolve();
    await flushPromises();

    page.trigger('click');
    assert.deepEqual(calls, { apply: 1, refresh: 1, detail: 1, page: 1, lot: 0 });

    pageRequest.resolve();
    await flushPromises();

    lot.trigger('click');
    assert.deepEqual(calls, { apply: 1, refresh: 1, detail: 1, page: 1, lot: 1 });
  } finally {
    globalThis.document = originalDocument;
  }
});

test('summary bindings replace old handlers when the page binds again', () => {
  const apply = createElement();
  const originalDocument = globalThis.document;
  const calls = [];

  globalThis.document = {
    querySelector(selector) {
      return selector === '[data-summary-apply]:not([disabled])' ? apply : null;
    },
    querySelectorAll() {
      return [];
    }
  };

  try {
    bindSummaryPage({ onApplyFilters: () => calls.push('old') });
    bindSummaryPage({ onApplyFilters: () => calls.push('new') });

    apply.trigger('click');
  } finally {
    globalThis.document = originalDocument;
  }

  assert.deepEqual(calls, ['new']);
});

test('summary detail rows omit open-Lot actions when the Lot key is missing', () => {
  const html = renderSummaryPage({
    data: fixture,
    detail: {
      view: 'topic',
      items: [{ modelName: 'MODEL-A', statusLabel: 'Approved' }]
    }
  });

  assert.doesNotMatch(html, /data-summary-open-lot=/);
});

test('summary detail rows render the service final result label first', () => {
  const html = renderSummaryPage({
    data: fixture,
    detail: {
      view: 'final',
      items: [{ lotNumber: 'LOT-001', modelName: 'MODEL-A', finalResultLabel: 'Confirmed NG', statusLabel: 'Stale status' }]
    }
  });

  assert.match(html, /Confirmed NG/);
  assert.doesNotMatch(html, /Stale status/);
});
