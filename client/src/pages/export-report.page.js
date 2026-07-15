export const defaultExportReportPageSize = '50';

const pageSizeOptions = [
  { value: defaultExportReportPageSize, label: '50 รายการ' },
  { value: 'all', label: 'ทั้งหมด' }
];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
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

  return `
    <div class="pagination-controls">
      <span>${escapeHtml(summary.totalItems ?? 0)} รายการ</span>
      <button class="secondary-button small-button" type="button" data-export-page="${page - 1}" ${page <= 1 || isLoading ? 'disabled aria-disabled="true"' : ''}>ก่อนหน้า</button>
      <span>หน้า ${page} / ${totalPages}</span>
      <button class="secondary-button small-button" type="button" data-export-page="${page + 1}" ${page >= totalPages || isLoading ? 'disabled aria-disabled="true"' : ''}>ถัดไป</button>
    </div>
  `;
}

function renderRows(items, isLoading, exportingLotNumber) {
  if (isLoading) {
    return '<tr><td colspan="9">กำลังโหลดรายการส่งออก...</td></tr>';
  }

  if (!items.length) {
    return '<tr><td colspan="9">ยังไม่มีรายการที่ส่งออกได้ในเงื่อนไขนี้</td></tr>';
  }

  const exportDisabled = exportingLotNumber ? 'disabled aria-disabled="true"' : '';

  return items.map((item) => `
    <tr>
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
      <td><span class="lot-status ${item.status === 'ng' ? 'ng' : 'approved'}">${escapeHtml(item.statusLabel || item.status)}</span></td>
      <td>
        <div class="row-action-group">
          <button class="secondary-button small-button" type="button" data-open-export-lot="${escapeHtml(item.lotNumber)}">
            ดูข้อมูล
          </button>
          <button class="primary-button small-button" type="button" data-export-excel-lot="${escapeHtml(item.lotNumber)}" ${exportDisabled}>
            Export Excel
          </button>
          <button class="secondary-button small-button" type="button" data-export-pdf-lot="${escapeHtml(item.lotNumber)}" ${exportDisabled}>
            Export PDF
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

export function renderExportReportPage({
  activeTab = 'approved',
  selectedDate = '',
  search = '',
  items = [],
  summary = {},
  error = '',
  message = '',
  isLoading = false,
  exportingLotNumber = '',
  exportingFormat = ''
} = {}) {
  const safeSummary = summary || {};
  const pageSize = String(safeSummary.pageSize || defaultExportReportPageSize);
  const exportingLabel = exportingFormat === 'pdf' ? 'PDF' : 'Excel';

  return `
    <section class="approval-queue-page export-report-page">
      <div class="compact-panel-heading">
        <div>
          <h2>ส่งออก</h2>
          <p>${escapeHtml(safeSummary.totalItems ?? 0)} รายการที่ส่งออกได้</p>
        </div>
      </div>

      ${message ? `<p class="alert success">${escapeHtml(message)}</p>` : ''}
      ${error ? `<p class="alert error">${escapeHtml(error)}</p>` : ''}
      ${exportingLotNumber ? `<p class="alert">กำลัง Export ${escapeHtml(exportingLabel)}: ${escapeHtml(exportingLotNumber)}</p>` : ''}

      <div class="import-tabs inspection-tabs" role="tablist" aria-label="ส่งออก">
        <button class="${activeTab === 'approved' ? 'active' : ''}" type="button" data-export-tab="approved">Approved</button>
        <button class="${activeTab === 'confirmed_ng' ? 'active' : ''}" type="button" data-export-tab="confirmed_ng">รับทราบ NG</button>
      </div>

      <div class="approval-filter-panel">
        <label>
          วันที่ผลิต
          <input type="date" name="exportDate" value="${escapeHtml(selectedDate)}" ${isLoading ? 'disabled' : ''}>
        </label>
        <label class="approval-all-date">
          <input type="checkbox" name="exportAllDates" ${selectedDate ? '' : 'checked'} ${isLoading ? 'disabled' : ''}>
          ทั้งหมด
        </label>
        <label>
          ค้นหา Lot
          <input type="search" name="exportSearch" value="${escapeHtml(search)}" placeholder="Lot / Lot Pack / Lot ผลิต / รุ่น" maxlength="80" ${isLoading ? 'disabled' : ''}>
        </label>
      </div>

      <section class="latest-lots-panel approval-queue-panel">
        <div class="preview-page-actions">
          <label>
            แสดง
            <select name="exportPageSize" ${isLoading ? 'disabled' : ''}>
              ${renderPageSizeOptions(pageSize)}
            </select>
          </label>
          ${renderPagination(safeSummary, isLoading)}
        </div>
        <div class="table-wrap approval-table-scroll">
          <table class="data-table approval-queue-table">
            <thead>
              <tr>
                <th>Lot</th>
                <th>Lot Pack</th>
                <th>Lot ผลิต</th>
                <th>รุ่น / รายละเอียด</th>
                <th>ใบสั่งซื้อ</th>
                <th>จำนวนชิ้น</th>
                <th>วันที่ผลิต</th>
                <th>สถานะ</th>
                <th>คำสั่ง</th>
              </tr>
            </thead>
            <tbody>
              ${renderRows(items, isLoading, exportingLotNumber)}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  `;
}

export function bindExportReportPage({
  onTabChange,
  onDateChange,
  onAllDatesChange,
  onSearchChange,
  onPageSizeChange,
  onPageChange,
  onOpenLot,
  onExportExcel,
  onExportPdf
}) {
  document.querySelectorAll('[data-export-tab]').forEach((button) => {
    button.addEventListener('click', () => onTabChange(button.dataset.exportTab));
  });

  document.querySelector('[name="exportDate"]')?.addEventListener('change', (event) => {
    onDateChange(event.target.value);
  });

  document.querySelector('[name="exportAllDates"]')?.addEventListener('change', (event) => {
    onAllDatesChange(event.target.checked);
  });

  document.querySelector('[name="exportSearch"]')?.addEventListener('input', (event) => {
    onSearchChange(event.target.value);
  });

  document.querySelector('[name="exportPageSize"]')?.addEventListener('change', (event) => {
    onPageSizeChange(event.target.value);
  });

  document.querySelectorAll('[data-export-page]:not([disabled])').forEach((button) => {
    button.addEventListener('click', () => onPageChange(Number(button.dataset.exportPage)));
  });

  document.querySelectorAll('[data-open-export-lot]').forEach((button) => {
    button.addEventListener('click', () => onOpenLot(button.dataset.openExportLot));
  });

  document.querySelectorAll('[data-export-excel-lot]').forEach((button) => {
    button.addEventListener('click', () => onExportExcel(button.dataset.exportExcelLot));
  });

  document.querySelectorAll('[data-export-pdf-lot]').forEach((button) => {
    button.addEventListener('click', () => onExportPdf(button.dataset.exportPdfLot));
  });
}
