export const defaultSummaryPageSize = 50;

const emptyData = {
  filters: {},
  options: {},
  stats: {},
  trend: [],
  topNgTopics: [],
  topNgModels: [],
  yearly: []
};

const summaryPageRequestStates = new WeakMap();
const summaryPageBindings = new WeakMap();

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderDetailRequestAttribute(request) {
  return escapeHtml(JSON.stringify(request));
}

function formatRate(value) {
  const rate = Number(value);
  return `${Number.isFinite(rate) ? rate.toFixed(2).replace(/\.?0+$/, '') : '0'}%`;
}

function formatValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : '0';
}

function renderEmptyRow(columnCount) {
  return `<tr><td colspan="${columnCount}" class="empty-cell">ไม่พบข้อมูล</td></tr>`;
}

function renderLoadingRow(columnCount) {
  return `<tr><td colspan="${columnCount}" class="loading-cell">กำลังโหลด...</td></tr>`;
}

function renderErrorRow(columnCount, error) {
  return `<tr><td colspan="${columnCount}" class="error-cell">${escapeHtml(error)}</td></tr>`;
}

function renderRows(items, columnCount, renderRow, { isLoading, error }) {
  if (isLoading) {
    return renderLoadingRow(columnCount);
  }

  if (error) {
    return renderErrorRow(columnCount, error);
  }

  if (!items.length) {
    return renderEmptyRow(columnCount);
  }

  return items.map(renderRow).join('');
}

function renderGradeOptions(grades, selectedGrade) {
  return [
    '<option value="">ทุกเกรด</option>',
    ...grades.map((grade) => `
      <option value="${escapeHtml(grade)}" ${String(grade) === String(selectedGrade) ? 'selected' : ''}>
        ${escapeHtml(grade)}
      </option>
    `)
  ].join('');
}

function renderYearControls(years, selectedYears, isDisabled) {
  const selectedYearSet = new Set();

  selectedYears.some((year) => {
    selectedYearSet.add(String(year));
    return selectedYearSet.size === 3;
  });

  const hasMaximumYears = selectedYearSet.size >= 3;

  return years.map((year) => {
    const yearValue = String(year);
    const isSelected = selectedYearSet.has(yearValue);
    const isYearDisabled = isDisabled || (hasMaximumYears && !isSelected);

    return `
      <label class="summary-year-option">
        <input
          type="checkbox"
          data-summary-year="${escapeHtml(yearValue)}"
          ${isSelected ? 'checked' : ''}
          ${isYearDisabled ? 'disabled aria-disabled="true"' : ''}
        >
        ${escapeHtml(yearValue)}
      </label>
    `;
  }).join('');
}

function renderKpis(stats, isDisabled) {
  const kpis = [
    { label: 'Final Lot', value: formatValue(stats.finalLots), request: { view: 'final' } },
    { label: 'Approved', value: formatValue(stats.approvedLots), request: { view: 'approved' } },
    { label: 'Confirmed NG', value: formatValue(stats.confirmedNgLots), request: { view: 'confirmed_ng' } },
    { label: 'NG Rate', value: formatRate(stats.ngRate), request: { view: 'confirmed_ng' } },
    { label: 'Unfinished', value: formatValue(stats.unfinishedTotal), request: { view: 'unfinished', unfinishedStatus: 'all' } }
  ];

  return kpis.map((kpi) => `
    <button
      class="stat-card summary-kpi-button"
      type="button"
      data-summary-detail-request="${renderDetailRequestAttribute(kpi.request)}"
      ${isDisabled ? 'disabled aria-disabled="true"' : ''}
    >
      <span>${escapeHtml(kpi.label)}</span>
      <strong>${escapeHtml(kpi.value)}</strong>
    </button>
  `).join('');
}

function renderTrendRows(items, state, isDisabled) {
  return renderRows(items, 5, (item) => `
    <tr>
      <td>
        <button
          class="secondary-button small-button"
          type="button"
          data-summary-detail-request="${renderDetailRequestAttribute({
            view: 'trend',
            periodStart: item.periodStart,
            periodEnd: item.periodEnd
          })}"
          ${isDisabled ? 'disabled aria-disabled="true"' : ''}
        >
          ${escapeHtml(item.label)}
        </button>
      </td>
      <td>${escapeHtml(formatValue(item.finalLots))}</td>
      <td>${escapeHtml(formatValue(item.approvedLots))}</td>
      <td>${escapeHtml(formatValue(item.confirmedNgLots))}</td>
      <td>${escapeHtml(formatRate(item.ngRate))}</td>
    </tr>
  `, state);
}

function getTopicSourceLabel(source) {
  if (source === 'all') return 'All';
  if (source === 'dimension') return 'Dimension';
  if (source === 'packing') return 'Packing';
  return 'Unknown';
}

function renderTopicRows(items, state, isDisabled) {
  return renderRows(items, 3, (item) => `
    <tr>
      <td>${escapeHtml(item.topicName)}${item.isOther ? ` (${escapeHtml(getTopicSourceLabel(item.source))} Other)` : ''}</td>
      <td>${escapeHtml(formatValue(item.ngLots))}</td>
      <td>
        <button
          class="secondary-button small-button"
          type="button"
          data-summary-detail-request="${renderDetailRequestAttribute({
            view: 'topic',
            rankGroup: item.isOther ? 'other' : 'selected',
            topicSource: item.source,
            ...(item.isOther ? {} : { topicName: item.topicName })
          })}"
          ${isDisabled ? 'disabled aria-disabled="true"' : ''}
        >
          ดูรายละเอียด
        </button>
      </td>
    </tr>
  `, state);
}

function renderModelRows(items, state, isDisabled) {
  return renderRows(items, 5, (item) => `
    <tr>
      <td>${escapeHtml(item.modelName)}${item.isLowData ? ' <span class="summary-low-data">ข้อมูลน้อย</span>' : ''}</td>
      <td>${escapeHtml(formatValue(item.finalLots))}</td>
      <td>${escapeHtml(formatValue(item.confirmedNgLots))}</td>
      <td>${escapeHtml(formatRate(item.ngRate))}</td>
      <td>
        <button
          class="secondary-button small-button"
          type="button"
          data-summary-detail-request="${renderDetailRequestAttribute({
            view: 'model',
            rankGroup: item.isOther ? 'other' : 'selected',
            ...(item.isOther ? {} : { modelName: item.modelName })
          })}"
          ${isDisabled ? 'disabled aria-disabled="true"' : ''}
        >
          ดูรายละเอียด
        </button>
      </td>
    </tr>
  `, state);
}

function renderYearlyRows(items, state, isDisabled) {
  return renderRows(items, 6, (item) => `
    <tr>
      <td>
        <button
          class="secondary-button small-button"
          type="button"
          data-summary-detail-request="${renderDetailRequestAttribute({ view: 'year', year: item.year })}"
          ${isDisabled ? 'disabled aria-disabled="true"' : ''}
        >
          ${escapeHtml(item.year)}
        </button>
      </td>
      <td>${escapeHtml(formatValue(item.finalLots))}</td>
      <td>${escapeHtml(formatValue(item.approvedLots))}</td>
      <td>${escapeHtml(formatValue(item.confirmedNgLots))}</td>
      <td>${escapeHtml(formatRate(item.ngRate))}</td>
      <td>${item.ngRateChange == null ? '-' : escapeHtml(formatRate(item.ngRateChange))}</td>
    </tr>
  `, state);
}

function renderDetailRows(items, state, isDisabled) {
  return renderRows(items, 4, (item) => `
    <tr>
      <td>${escapeHtml(item.lotNumber || item.lot || '-')}</td>
      <td>${escapeHtml(item.modelName || '-')}</td>
      <td>${escapeHtml(item.finalResultLabel || item.statusLabel || item.status || '-')}</td>
      <td>${item.lotNumber || item.lot ? `
        <button
          class="secondary-button small-button"
          type="button"
          data-summary-open-lot="${escapeHtml(item.lotNumber || item.lot || '')}"
          ${isDisabled ? 'disabled aria-disabled="true"' : ''}
        >
          ดู Lot
        </button>` : '-'}
      </td>
    </tr>
  `, state);
}

function renderDetailSection(detail, isDisabled) {
  if (!detail?.view) {
    return '';
  }

  const page = Math.max(Number(detail.page) || 1, 1);
  const totalPages = Math.max(Number(detail.totalPages) || 1, 1);
  const items = Array.isArray(detail.items) ? detail.items : [];
  const state = { isLoading: Boolean(detail.isLoading), error: detail.error || '' };

  return `
    <section class="latest-lots-panel summary-detail-panel">
      <div class="panel-heading">
        <div>
          <h2>${escapeHtml(detail.title || 'Summary Detail')}</h2>
          <p>${escapeHtml(detail.totalItems ?? items.length)} รายการ</p>
        </div>
      </div>
      <div class="table-wrap">
        <table class="data-table summary-detail-table">
          <thead><tr><th>Lot</th><th>Model</th><th>สถานะ</th><th>คำสั่ง</th></tr></thead>
          <tbody>${renderDetailRows(items, state, isDisabled || state.isLoading)}</tbody>
        </table>
      </div>
      <div class="preview-page-actions">
        <button
          class="secondary-button small-button"
          type="button"
          data-summary-page="${page - 1}"
          ${page <= 1 || isDisabled || state.isLoading ? 'disabled aria-disabled="true"' : ''}
        >
          ก่อนหน้า
        </button>
        <span>หน้า ${escapeHtml(page)} / ${escapeHtml(totalPages)}</span>
        <button
          class="secondary-button small-button"
          type="button"
          data-summary-page="${page + 1}"
          ${page >= totalPages || isDisabled || state.isLoading ? 'disabled aria-disabled="true"' : ''}
        >
          ถัดไป
        </button>
      </div>
    </section>
  `;
}

export function renderSummaryPage({
  data = null,
  isLoading = false,
  error = '',
  detail = null,
  detailLoading = false
} = {}) {
  const currentData = data || emptyData;
  const filters = currentData.filters || {};
  const options = currentData.options || {};
  const stats = currentData.stats || {};
  const state = { isLoading: Boolean(isLoading), error: error || '' };
  const requestDisabled = Boolean(isLoading || detailLoading);
  const selectedYears = Array.isArray(filters.years) ? filters.years : [];
  const currentDetail = detail || currentData.detail || null;
  const detailForRender = currentDetail
    ? { ...currentDetail, isLoading: Boolean(currentDetail.isLoading || detailLoading) }
    : null;

  return `
    <section class="summary-page">
      <div class="queue-toolbar summary-toolbar">
        <div>
          <h2>Summary</h2>
          <p>อัปเดตล่าสุด: ${escapeHtml(currentData.updatedAt || '-')}</p>
        </div>
        <button
          class="secondary-button small-button"
          type="button"
          data-summary-refresh
          ${requestDisabled ? 'disabled aria-disabled="true"' : ''}
        >
          Refresh
        </button>
      </div>

      <section class="dashboard-filters summary-filters" aria-label="Summary filters">
        <label class="field compact-field">
          Start date
          <input type="date" data-summary-start-date value="${escapeHtml(filters.startDate)}" ${requestDisabled ? 'disabled' : ''}>
        </label>
        <label class="field compact-field">
          End date
          <input type="date" data-summary-end-date value="${escapeHtml(filters.endDate)}" ${requestDisabled ? 'disabled' : ''}>
        </label>
        <label class="field search-field">
          Model
          <input type="search" data-summary-model-search maxlength="120" value="${escapeHtml(filters.modelSearch)}" ${requestDisabled ? 'disabled' : ''}>
        </label>
        <label class="field compact-field">
          Grade
          <select data-summary-grade ${requestDisabled ? 'disabled' : ''}>
            ${renderGradeOptions(Array.isArray(options.grades) ? options.grades : [], filters.grade)}
          </select>
        </label>
        <label class="field compact-field">
          Topic source
          <select data-summary-topic-source ${requestDisabled ? 'disabled' : ''}>
            <option value="all" ${filters.topicSource === 'all' ? 'selected' : ''}>All</option>
            <option value="dimension" ${filters.topicSource === 'dimension' ? 'selected' : ''}>Dimension</option>
            <option value="packing" ${filters.topicSource === 'packing' ? 'selected' : ''}>Packing</option>
          </select>
        </label>
        <div class="summary-year-controls" aria-label="Years">
          ${renderYearControls(Array.isArray(options.years) ? options.years : [], selectedYears, requestDisabled)}
        </div>
        <button
          class="primary-button small-button"
          type="button"
          data-summary-apply
          ${requestDisabled ? 'disabled aria-disabled="true"' : ''}
        >
          Apply
        </button>
      </section>

      ${state.isLoading ? '<p class="alert">กำลังโหลด Summary...</p>' : ''}
      ${state.error ? `<p class="alert error">${escapeHtml(state.error)}</p>` : ''}

      <section class="stats-grid">
        ${renderKpis(stats, requestDisabled)}
      </section>

      <section class="latest-lots-panel summary-unfinished-panel">
        <div class="panel-heading"><h2>Unfinished</h2></div>
        <div class="summary-breakdown">
          <button class="secondary-button small-button" type="button" data-summary-detail-request="${renderDetailRequestAttribute({ view: 'unfinished', unfinishedStatus: 'pending' })}" ${requestDisabled ? 'disabled aria-disabled="true"' : ''}>Waiting inspection: ${escapeHtml(formatValue(stats.unfinished?.waitingInspection))}</button>
          <button class="secondary-button small-button" type="button" data-summary-detail-request="${renderDetailRequestAttribute({ view: 'unfinished', unfinishedStatus: 'temp' })}" ${requestDisabled ? 'disabled aria-disabled="true"' : ''}>In progress: ${escapeHtml(formatValue(stats.unfinished?.inProgress))}</button>
          <button class="secondary-button small-button" type="button" data-summary-detail-request="${renderDetailRequestAttribute({ view: 'unfinished', unfinishedStatus: 'need_fix' })}" ${requestDisabled ? 'disabled aria-disabled="true"' : ''}>Need fix: ${escapeHtml(formatValue(stats.unfinished?.needFix))}</button>
          <button class="secondary-button small-button" type="button" data-summary-detail-request="${renderDetailRequestAttribute({ view: 'unfinished', unfinishedStatus: 'waiting_pack' })}" ${requestDisabled ? 'disabled aria-disabled="true"' : ''}>Waiting packing: ${escapeHtml(formatValue(stats.unfinished?.waitingPacking))}</button>
          <button class="secondary-button small-button" type="button" data-summary-detail-request="${renderDetailRequestAttribute({ view: 'unfinished', unfinishedStatus: 'waiting_approve' })}" ${requestDisabled ? 'disabled aria-disabled="true"' : ''}>Waiting approval: ${escapeHtml(formatValue(stats.unfinished?.waitingApproval))}</button>
        </div>
      </section>

      <section class="latest-lots-panel">
        <div class="panel-heading"><h2>Quality Trend</h2></div>
        <div class="table-wrap">
          <table class="data-table summary-trend-table">
            <thead><tr><th>Period</th><th>Final</th><th>Approved</th><th>Confirmed NG</th><th>NG Rate</th></tr></thead>
            <tbody>${renderTrendRows(Array.isArray(currentData.trend) ? currentData.trend : [], state, requestDisabled)}</tbody>
          </table>
        </div>
      </section>

      <section class="latest-lots-panel">
        <div class="panel-heading"><h2>Top NG Topic</h2></div>
        <div class="table-wrap">
          <table class="data-table summary-topic-table">
            <thead><tr><th>Topic</th><th>NG Lot</th><th>คำสั่ง</th></tr></thead>
            <tbody>${renderTopicRows(Array.isArray(currentData.topNgTopics) ? currentData.topNgTopics : [], state, requestDisabled)}</tbody>
          </table>
        </div>
      </section>

      <section class="latest-lots-panel">
        <div class="panel-heading"><h2>Top NG Model</h2></div>
        <div class="table-wrap">
          <table class="data-table summary-model-table">
            <thead><tr><th>Model</th><th>Final</th><th>Confirmed NG</th><th>NG Rate</th><th>คำสั่ง</th></tr></thead>
            <tbody>${renderModelRows(Array.isArray(currentData.topNgModels) ? currentData.topNgModels : [], state, requestDisabled)}</tbody>
          </table>
        </div>
      </section>

      <section class="latest-lots-panel">
        <div class="panel-heading"><h2>Annual Comparison</h2></div>
        <div class="table-wrap">
          <table class="data-table summary-yearly-table">
            <thead><tr><th>Year</th><th>Final</th><th>Approved</th><th>Confirmed NG</th><th>NG Rate</th><th>Change</th></tr></thead>
            <tbody>${renderYearlyRows(Array.isArray(currentData.yearly) ? currentData.yearly : [], state, requestDisabled)}</tbody>
          </table>
        </div>
      </section>

      ${renderDetailSection(detailForRender, requestDisabled)}
    </section>
  `;
}

function getFilterValues() {
  return {
    startDate: document.querySelector('[data-summary-start-date]')?.value || '',
    endDate: document.querySelector('[data-summary-end-date]')?.value || '',
    modelSearch: document.querySelector('[data-summary-model-search]')?.value || '',
    grade: document.querySelector('[data-summary-grade]')?.value || '',
    topicSource: document.querySelector('[data-summary-topic-source]')?.value || ''
  };
}

function getSelectedYears() {
  return Array.from(document.querySelectorAll('[data-summary-year]'))
    .filter((input) => input.checked)
    .map((input) => Number(input.dataset.summaryYear))
    .filter(Number.isFinite);
}

function clearSummaryPageBindings() {
  const bindings = summaryPageBindings.get(document) || [];

  bindings.forEach(({ element, type, listener }) => {
    element.removeEventListener(type, listener);
  });

  summaryPageBindings.set(document, []);
}

function addSummaryPageListener(element, type, listener) {
  element.addEventListener(type, listener);
  summaryPageBindings.get(document).push({ element, type, listener });
}

function runSummaryRequestOnce(handler) {
  const requestState = summaryPageRequestStates.get(document) || { isInFlight: false };

  if (requestState.isInFlight) {
    return;
  }

  requestState.isInFlight = true;
  summaryPageRequestStates.set(document, requestState);

  let result;
  try {
    result = handler();
  } catch {
    requestState.isInFlight = false;
    return;
  }

  if (!result || typeof result.then !== 'function') {
    requestState.isInFlight = false;
    return;
  }

  result
    .catch(() => {})
    .finally(() => {
      requestState.isInFlight = false;
    });
}

export function bindSummaryPage({
  onApplyFilters = () => {},
  onRefresh = () => {},
  onTopicSourceChange = () => {},
  onYearsChange = () => {},
  onOpenDetails = () => {},
  onDetailPageChange = () => {},
  onOpenLot = () => {}
} = {}) {
  clearSummaryPageBindings();

  const applyButton = document.querySelector('[data-summary-apply]:not([disabled])');
  if (applyButton) {
    addSummaryPageListener(applyButton, 'click', () => {
      runSummaryRequestOnce(() => onApplyFilters(getFilterValues()));
    });
  }

  const refreshButton = document.querySelector('[data-summary-refresh]:not([disabled])');
  if (refreshButton) {
    addSummaryPageListener(refreshButton, 'click', () => {
      runSummaryRequestOnce(onRefresh);
    });
  }

  const topicSource = document.querySelector('[data-summary-topic-source]');
  if (topicSource) {
    addSummaryPageListener(topicSource, 'change', (event) => {
    if (!event.target.disabled) {
        runSummaryRequestOnce(() => onTopicSourceChange(event.target.value));
    }
    });
  }

  document.querySelectorAll('[data-summary-year]').forEach((input) => {
    addSummaryPageListener(input, 'change', (event) => {
      if (event.target.disabled) {
        return;
      }

      const selectedYears = getSelectedYears();
      if (selectedYears.length > 3) {
        event.target.checked = false;
        runSummaryRequestOnce(() => onYearsChange(getSelectedYears()));
        return;
      }

      runSummaryRequestOnce(() => onYearsChange(selectedYears));
    });
  });

  document.querySelectorAll('[data-summary-detail-request]:not([disabled])').forEach((button) => {
    addSummaryPageListener(button, 'click', () => {
      let request;
      try {
        request = JSON.parse(button.dataset.summaryDetailRequest);
      } catch {
        return;
      }

      if (!request || typeof request !== 'object' || Array.isArray(request)) {
        return;
      }

      runSummaryRequestOnce(() => onOpenDetails(request));
    });
  });

  document.querySelectorAll('[data-summary-page]:not([disabled])').forEach((button) => {
    addSummaryPageListener(button, 'click', () => {
      runSummaryRequestOnce(() => onDetailPageChange(Number(button.dataset.summaryPage)));
    });
  });

  document.querySelectorAll('[data-summary-open-lot]:not([disabled])').forEach((button) => {
    addSummaryPageListener(button, 'click', () => {
      runSummaryRequestOnce(() => onOpenLot(button.dataset.summaryOpenLot));
    });
  });
}
