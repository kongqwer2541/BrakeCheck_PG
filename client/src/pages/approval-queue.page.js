export const defaultApprovalQueuePageSize = '50';

const pageSizeOptions = [
  { value: defaultApprovalQueuePageSize, label: '50 รายการ' },
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
      <button class="secondary-button small-button" type="button" data-approval-page="${page - 1}" ${page <= 1 || isLoading ? 'disabled aria-disabled="true"' : ''}>ก่อนหน้า</button>
      <span>หน้า ${page} / ${totalPages}</span>
      <button class="secondary-button small-button" type="button" data-approval-page="${page + 1}" ${page >= totalPages || isLoading ? 'disabled aria-disabled="true"' : ''}>ถัดไป</button>
    </div>
  `;
}

function renderAttachmentCount(item) {
  return Number.isInteger(item.attachmentCount) ? `${item.attachmentCount} ไฟล์` : '-';
}

function renderRows(items, isLoading) {
  if (isLoading) {
    return '<tr><td colspan="10">กำลังโหลดคิวตรวจและอนุมัติ...</td></tr>';
  }

  if (!items.length) {
    return '<tr><td colspan="10">ยังไม่มีรายการในคิวนี้</td></tr>';
  }

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
      <td><span class="lot-status ${item.status === 'ng' ? 'ng' : 'waiting'}">${escapeHtml(item.statusLabel || item.status)}</span></td>
      <td>${escapeHtml(renderAttachmentCount(item))}</td>
      <td>
        <button class="secondary-button small-button" type="button" data-open-approval-lot="${escapeHtml(item.lotNumber)}">
          เปิดตรวจสอบ
        </button>
      </td>
    </tr>
  `).join('');
}

export function renderApprovalQueuePage({
  activeTab = 'waiting_approve',
  selectedDate = '',
  search = '',
  items = [],
  summary = {},
  badgeCount = 0,
  error = '',
  isLoading = false
} = {}) {
  const safeSummary = summary || {};
  const pageSize = String(safeSummary.pageSize || defaultApprovalQueuePageSize);

  return `
    <section class="approval-queue-page">
      <div class="compact-panel-heading">
        <div>
          <h2>คิวตรวจและอนุมัติ</h2>
          <p>${escapeHtml(badgeCount)} งานที่ต้องตรวจ</p>
        </div>
      </div>

      ${error ? `<p class="alert error">${escapeHtml(error)}</p>` : ''}

      <div class="import-tabs inspection-tabs" role="tablist" aria-label="คิวตรวจและอนุมัติ">
        <button class="${activeTab === 'waiting_approve' ? 'active' : ''}" type="button" data-approval-tab="waiting_approve">รออนุมัติ</button>
        <button class="${activeTab === 'ng' ? 'active' : ''}" type="button" data-approval-tab="ng">งาน NG</button>
      </div>

      <div class="approval-filter-panel">
        <label>
          วันที่ผลิต
          <input type="date" name="approvalDate" value="${escapeHtml(selectedDate)}" ${isLoading ? 'disabled' : ''}>
        </label>
        <label class="approval-all-date">
          <input type="checkbox" name="approvalAllDates" ${selectedDate ? '' : 'checked'} ${isLoading ? 'disabled' : ''}>
          ทั้งหมด
        </label>
        <label>
          ค้นหา Lot
          <input type="search" name="approvalSearch" value="${escapeHtml(search)}" placeholder="Lot / Lot Pack / Lot ผลิต / รุ่น" maxlength="80" ${isLoading ? 'disabled' : ''}>
        </label>
      </div>

      <section class="latest-lots-panel approval-queue-panel">
        <div class="preview-page-actions">
          <label>
            แสดง
            <select name="approvalPageSize" ${isLoading ? 'disabled' : ''}>
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
                <th>ไฟล์แนบ</th>
                <th>คำสั่ง</th>
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

export function bindApprovalQueuePage({
  onTabChange,
  onDateChange,
  onAllDatesChange,
  onSearchChange,
  onPageSizeChange,
  onPageChange,
  onOpenLot
}) {
  document.querySelectorAll('[data-approval-tab]').forEach((button) => {
    button.addEventListener('click', () => onTabChange(button.dataset.approvalTab));
  });

  document.querySelector('[name="approvalDate"]')?.addEventListener('change', (event) => {
    onDateChange(event.target.value);
  });

  document.querySelector('[name="approvalAllDates"]')?.addEventListener('change', (event) => {
    onAllDatesChange(event.target.checked);
  });

  document.querySelector('[name="approvalSearch"]')?.addEventListener('input', (event) => {
    onSearchChange(event.target.value);
  });

  document.querySelector('[name="approvalPageSize"]')?.addEventListener('change', (event) => {
    onPageSizeChange(event.target.value);
  });

  document.querySelectorAll('[data-approval-page]:not([disabled])').forEach((button) => {
    button.addEventListener('click', () => onPageChange(Number(button.dataset.approvalPage)));
  });

  document.querySelectorAll('[data-open-approval-lot]').forEach((button) => {
    button.addEventListener('click', () => onOpenLot(button.dataset.openApprovalLot));
  });
}
