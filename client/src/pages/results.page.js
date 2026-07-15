export const defaultResultsPageSize = '50';

const pageSizeOptions = [
  { value: defaultResultsPageSize, label: '50 รายการ' }
];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderDateCaption(startDate, endDate, dateMode) {
  if (dateMode === 'all') return 'ทั้งหมด';
  if (!startDate && !endDate) return 'ยังไม่มีวันที่ผลิตในระบบ';
  if (startDate === endDate) return startDate;
  return `${startDate} ถึง ${endDate}`;
}

function renderPageSizeOptions(selectedPageSize) {
  return pageSizeOptions.map((option) => `
    <option value="${escapeHtml(option.value)}" ${option.value === selectedPageSize ? 'selected' : ''}>
      ${escapeHtml(option.label)}
    </option>
  `).join('');
}

function renderPagination(summary = {}, isLoading = false) {
  const page = Number(summary.page || 1);
  const totalPages = Number(summary.totalPages || 1);
  const pageSize = String(summary.pageSize || defaultResultsPageSize);
  return `
    <div class="pagination-controls">
      <span>${escapeHtml(summary.totalItems ?? 0)} รายการ</span>
      <button class="secondary-button small-button" type="button" data-results-page="${page - 1}" ${page <= 1 || pageSize === 'all' || isLoading ? 'disabled aria-disabled="true"' : ''}>ก่อนหน้า</button>
      <span>หน้า ${escapeHtml(page)} / ${escapeHtml(totalPages)}</span>
      <button class="secondary-button small-button" type="button" data-results-page="${page + 1}" ${page >= totalPages || pageSize === 'all' || isLoading ? 'disabled aria-disabled="true"' : ''}>ถัดไป</button>
    </div>
  `;
}

function getStatusClass(item) {
  return item.status === 'ng' ? 'ng' : 'approved';
}

function renderRows(items, isLoading) {
  if (isLoading) {
    return '<tr><td colspan="10">กำลังโหลด Results...</td></tr>';
  }

  if (!items.length) {
    return '<tr><td colspan="10">ยังไม่มี Results ในเงื่อนไขนี้</td></tr>';
  }

  return items.map((item) => `
    <tr class="queue-click-row results-click-row" tabindex="0" data-open-result-lot="${escapeHtml(item.lotNumber)}">
      <td><strong>${escapeHtml(item.lotNumber)}</strong></td>
      <td>${escapeHtml(item.lotPackBarcode)}</td>
      <td>${escapeHtml(item.lotPacking)}</td>
      <td>
        <strong>${escapeHtml(item.modelName || '-')}</strong>
        <span>${escapeHtml(item.dimension || '-')}</span>
      </td>
      <td>${escapeHtml(item.purchaseOrder || '-')}</td>
      <td>${escapeHtml(item.quantity)}</td>
      <td>${escapeHtml(item.productionDate || '-')}</td>
      <td>${escapeHtml(item.completedAt || '-')}</td>
      <td><span class="lot-status ${getStatusClass(item)}">${escapeHtml(item.statusLabel || item.status)}</span></td>
      <td>${Number.isInteger(item.attachmentCount) ? `${escapeHtml(item.attachmentCount)} ไฟล์` : '-'}</td>
    </tr>
  `).join('');
}

export function renderResultsPage({
  activeTab = 'approved',
  dateMode = '',
  startDate = '',
  endDate = '',
  latestDate = '',
  hasNewerDate = false,
  search = '',
  items = [],
  summary = {},
  counts = {},
  error = '',
  isLoading = false
} = {}) {
  const safeSummary = summary || {};
  const pageSize = String(safeSummary.pageSize || defaultResultsPageSize);

  return `
    <section class="dashboard-page inspection-queue-page results-page">
      <div class="queue-toolbar">
        <div>
          <h2>Results</h2>
          <p>วันที่ผลิต: ${escapeHtml(renderDateCaption(startDate, endDate, dateMode))}</p>
        </div>
        <button class="secondary-button small-button" type="button" data-results-refresh ${isLoading ? 'disabled aria-disabled="true"' : ''}>
          รีเฟรช
        </button>
      </div>

      <section class="dashboard-filters inspection-queue-filters" aria-label="ตัวกรอง Results">
        <label class="field compact-field">
          วันที่
          <input id="resultsDate" type="date" value="${escapeHtml(endDate || startDate)}" ${isLoading ? 'disabled' : ''} />
        </label>
        <div class="queue-date-actions">
          <button class="secondary-button small-button" type="button" data-results-range="1" ${isLoading ? 'disabled aria-disabled="true"' : ''}>ย้อนหลัง 1 วัน</button>
          <button class="secondary-button small-button" type="button" data-results-range="3" ${isLoading ? 'disabled aria-disabled="true"' : ''}>ย้อนหลัง 3 วัน</button>
          <button class="secondary-button small-button" type="button" data-results-all ${dateMode === 'all' || isLoading ? 'disabled aria-disabled="true"' : ''}>ทั้งหมด</button>
          <button class="secondary-button small-button" type="button" data-results-latest ${!latestDate || (!hasNewerDate && dateMode !== 'all' && startDate === latestDate && endDate === latestDate) || isLoading ? 'disabled aria-disabled="true"' : ''}>ไปวันล่าสุด</button>
        </div>
        <label class="field search-field">
          ค้นหา Lot
          <input
            id="resultsSearch"
            type="search"
            placeholder="Lot / Lot Pack / Lot ผลิต / รุ่น"
            value="${escapeHtml(search)}"
            maxlength="80"
            ${isLoading ? 'disabled' : ''}
          />
        </label>
      </section>

      ${error ? `<p class="alert error">${escapeHtml(error)}</p>` : ''}

      <div class="import-tabs inspection-tabs" role="tablist" aria-label="Results">
        <button class="${activeTab === 'approved' ? 'active' : ''}" type="button" data-results-tab="approved">Approved (${escapeHtml(counts.approved || 0)})</button>
        <button class="${activeTab === 'confirmed_ng' ? 'active' : ''}" type="button" data-results-tab="confirmed_ng">รับทราบ NG (${escapeHtml(counts.confirmedNg || 0)})</button>
      </div>

      <section class="latest-lots-panel approval-queue-panel">
        <div class="preview-page-actions">
          <label>
            แสดง
            <select name="resultsPageSize" ${isLoading ? 'disabled' : ''}>
              ${renderPageSizeOptions(pageSize)}
            </select>
          </label>
          ${renderPagination(safeSummary, isLoading)}
        </div>
        <div class="table-wrap approval-table-scroll">
          <table class="data-table approval-queue-table results-table">
            <thead>
              <tr>
                <th>Lot</th>
                <th>Lot Pack</th>
                <th>Lot ผลิต</th>
                <th>รุ่น / รายละเอียด</th>
                <th>ใบสั่งซื้อ</th>
                <th>จำนวนชิ้น</th>
                <th>วันที่ผลิต</th>
                <th>วันที่จบงาน</th>
                <th>สถานะ</th>
                <th>ไฟล์แนบ</th>
              </tr>
            </thead>
            <tbody>
              ${renderRows(items, isLoading)}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  `;
}

export function bindResultsPage({
  onTabChange,
  onDateChange,
  onRangeChange,
  onAllDates,
  onLatest,
  onSearchChange,
  onPageSizeChange,
  onPageChange,
  onRefresh,
  onOpenLot
}) {
  document.querySelectorAll('[data-results-tab]').forEach((button) => {
    button.addEventListener('click', () => onTabChange(button.dataset.resultsTab));
  });
  document.querySelector('#resultsDate')?.addEventListener('change', (event) => onDateChange(event.target.value));
  document.querySelectorAll('[data-results-range]').forEach((button) => {
    button.addEventListener('click', () => onRangeChange(Number(button.dataset.resultsRange)));
  });
  document.querySelector('[data-results-all]:not([disabled])')?.addEventListener('click', () => onAllDates());
  document.querySelector('[data-results-latest]:not([disabled])')?.addEventListener('click', () => onLatest());
  document.querySelector('#resultsSearch')?.addEventListener('input', (event) => onSearchChange(event.target.value));
  document.querySelector('[name="resultsPageSize"]')?.addEventListener('change', (event) => onPageSizeChange(event.target.value));
  document.querySelectorAll('[data-results-page]:not([disabled])').forEach((button) => {
    button.addEventListener('click', () => onPageChange(Number(button.dataset.resultsPage)));
  });
  document.querySelector('[data-results-refresh]')?.addEventListener('click', () => onRefresh());

  let selectedAt = 0;
  let selectedLot = '';
  let lastTouchAt = 0;

  document.querySelectorAll('[data-open-result-lot]').forEach((row) => {
    const open = () => onOpenLot(row.dataset.openResultLot);
    const selectOrOpen = () => {
      const now = Date.now();
      const lotNumber = row.dataset.openResultLot;
      if (selectedLot === lotNumber && now - selectedAt <= 700) {
        open();
        return;
      }
      selectedLot = lotNumber;
      selectedAt = now;
      document.querySelectorAll('[data-open-result-lot]').forEach((item) => {
        item.classList.toggle('is-selected', item === row);
      });
    };

    row.addEventListener('click', () => {
      if (Date.now() - lastTouchAt < 500) {
        return;
      }
      selectOrOpen();
    });
    row.addEventListener('pointerup', (event) => {
      if (event.pointerType === 'mouse') return;
      lastTouchAt = Date.now();
      selectOrOpen();
    });
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        open();
      }
    });
  });
}
