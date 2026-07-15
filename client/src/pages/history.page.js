const historyTabs = [
  { id: 'lots', label: 'ประวัติ Lot' },
  { id: 'imports', label: 'ประวัติ Import' },
  { id: 'audits', label: 'ประวัติแก้ไข' }
];

const lotStatusOptions = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'pending', label: 'รอตรวจ' },
  { value: 'temp', label: 'กำลังตรวจ' },
  { value: 'waiting_pack', label: 'รอตรวจบรรจุ' },
  { value: 'waiting_approve', label: 'รออนุมัติ' },
  { value: 'need_fix', label: 'รอแก้ไข' },
  { value: 'approved', label: 'Approved' },
  { value: 'ng', label: 'NG' },
  { value: 'void', label: 'Void' }
];

const auditActionOptions = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'edit', label: 'แก้ไข' },
  { value: 'void', label: 'Void' },
  { value: 'approve', label: 'อนุมัติ' },
  { value: 'cancel_approve', label: 'ยกเลิกอนุมัติ' },
  { value: 'send_back', label: 'ส่งกลับแก้ไข' },
  { value: 'review_ng', label: 'ทบทวน NG' },
  { value: 'confirm_ng', label: 'รับทราบ NG' }
];

auditActionOptions.push(
  { value: 'upload_attachment', label: 'แนบไฟล์ Lot' },
  { value: 'delete_attachment', label: 'ลบไฟล์แนบ Lot' }
);

const defaultHistoryPageSize = '50';

const historyPageSizeOptions = [
  { value: defaultHistoryPageSize, label: '50 รายการ' },
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

function getStatusClass(status) {
  if (status === 'approved') {
    return 'approved';
  }

  if (status === 'ng') {
    return 'ng';
  }

  if (status === 'void') {
    return 'void';
  }

  if (status === 'waiting_approve') {
    return 'waiting';
  }

  return 'progress';
}

function getActionClass(action) {
  return action === 'void' ? 'void' : 'waiting';
}

function renderTabButtons(activeTab, isLoading) {
  return historyTabs.map((tab) => `
    <button
      class="${activeTab === tab.id ? 'active' : ''}"
      type="button"
      data-history-tab="${escapeHtml(tab.id)}"
      ${isLoading ? 'disabled aria-disabled="true"' : ''}
    >
      ${escapeHtml(tab.label)}
    </button>
  `).join('');
}

function renderOptions(options, selectedValue) {
  return options.map((option) => `
    <option value="${escapeHtml(option.value)}" ${selectedValue === option.value ? 'selected' : ''}>
      ${escapeHtml(option.label)}
    </option>
  `).join('');
}

function renderSummary(summary, isLoading) {
  if (isLoading) {
    return 'กำลังโหลด';
  }

  const totalItems = Number(summary?.totalItems || 0);
  const shownItems = Number(summary?.shownItems || 0);

  return `${shownItems} / ${totalItems} รายการ`;
}

function getPagination(summary, pageSize, page) {
  const totalRows = Number(summary?.totalItems || 0);
  const currentPageSize = String(summary?.pageSize || pageSize || defaultHistoryPageSize);

  if (currentPageSize === 'all') {
    return {
      totalRows,
      totalPages: 1,
      currentPage: 1
    };
  }

  const totalPages = Math.max(1, Number(summary?.totalPages || 1));
  const currentPage = Math.min(Math.max(Number(summary?.page || page) || 1, 1), totalPages);

  return {
    totalRows,
    totalPages,
    currentPage
  };
}

function renderPaginationControls({ summary, pageSize, page, isLoading }) {
  const pagination = getPagination(summary, pageSize, page);
  const currentPageSize = String(summary?.pageSize || pageSize || defaultHistoryPageSize);

  return `
    <div class="preview-table-tools history-table-tools">
      <label class="field compact-field">
        แสดง
        <select id="historyPageSize" ${isLoading ? 'disabled aria-disabled="true"' : ''}>
          ${historyPageSizeOptions.map((option) => `
            <option value="${escapeHtml(option.value)}" ${currentPageSize === option.value ? 'selected' : ''}>
              ${escapeHtml(option.label)}
            </option>
          `).join('')}
        </select>
      </label>
      <div class="preview-page-actions">
        <span>${escapeHtml(pagination.totalRows)} รายการ</span>
        <button
          class="secondary-button small-button"
          type="button"
          data-history-page="${pagination.currentPage - 1}"
          ${pagination.currentPage <= 1 || currentPageSize === 'all' || isLoading ? 'disabled aria-disabled="true"' : ''}
        >
          ก่อนหน้า
        </button>
        <span>หน้า ${escapeHtml(pagination.currentPage)} / ${escapeHtml(pagination.totalPages)}</span>
        <button
          class="secondary-button small-button"
          type="button"
          data-history-page="${pagination.currentPage + 1}"
          ${pagination.currentPage >= pagination.totalPages || currentPageSize === 'all' || isLoading ? 'disabled aria-disabled="true"' : ''}
        >
          ถัดไป
        </button>
      </div>
    </div>
  `;
}

function renderLotRows(items) {
  if (!items.length) {
    return '<tr><td colspan="10" class="empty-cell">ไม่พบประวัติ Lot ตามตัวกรองนี้</td></tr>';
  }

  return items.map((item) => `
    <tr>
      <td>${escapeHtml(item.lotNumber)}</td>
      <td>${escapeHtml(item.lotPackBarcode)}</td>
      <td>${escapeHtml(item.lotPacking)}</td>
      <td>${escapeHtml(item.productionDate)}</td>
      <td>${escapeHtml(item.purchaseOrder)}</td>
      <td class="history-model-cell">
        <strong>${escapeHtml(item.modelName)}</strong>
        <span>${escapeHtml(item.dimension)}</span>
      </td>
      <td>${escapeHtml(item.aciGrade)}</td>
      <td>${escapeHtml(item.quantity)}</td>
      <td><span class="lot-status ${getStatusClass(item.status)}">${escapeHtml(item.statusLabel)}</span></td>
      <td>${escapeHtml(item.updatedAt)}</td>
    </tr>
  `).join('');
}

function renderImportRows(items) {
  if (!items.length) {
    return '<tr><td colspan="7" class="empty-cell">ไม่พบประวัติ Import ตามตัวกรองนี้</td></tr>';
  }

  return items.map((item) => `
    <tr>
      <td>${escapeHtml(item.uploadedAt)}</td>
      <td class="history-file-cell">${escapeHtml(item.originalFileName)}</td>
      <td>${escapeHtml(item.sheetName)}</td>
      <td>${escapeHtml(item.totalRows)}</td>
      <td>${escapeHtml(item.importedRows)}</td>
      <td>${escapeHtml(item.skippedRows)}</td>
      <td>${escapeHtml(item.uploadedBy)}</td>
    </tr>
  `).join('');
}

function renderAuditRows(items) {
  if (!items.length) {
    return '<tr><td colspan="9" class="empty-cell">ไม่พบประวัติการแก้ไขตามตัวกรองนี้</td></tr>';
  }

  return items.map((item) => `
    <tr>
      <td>${escapeHtml(item.createdAt)}</td>
      <td>${escapeHtml(item.lotNumber)}</td>
      <td>${escapeHtml(item.lotPackBarcode)}</td>
      <td>${escapeHtml(item.lotPacking)}</td>
      <td><span class="lot-status ${getActionClass(item.action)}">${escapeHtml(item.actionLabel)}</span></td>
      <td>${escapeHtml((item.changedFields || []).join(', ') || '-')}</td>
      <td class="history-reason-cell">${escapeHtml(item.reason)}</td>
      <td>${escapeHtml(item.changedBy)}</td>
      <td>${escapeHtml(item.changedByPosition || '-')}</td>
    </tr>
  `).join('');
}

function renderTable({ activeTab, items, isLoading, error }) {
  if (isLoading) {
    return `
      <div class="history-state-panel">
        <strong>กำลังโหลดข้อมูล...</strong>
      </div>
    `;
  }

  if (error) {
    return `
      <div class="history-state-panel error">
        <strong>เกิดข้อผิดพลาด</strong>
        <span>${escapeHtml(error)}</span>
      </div>
    `;
  }

  if (activeTab === 'imports') {
    return `
      <div class="table-wrap">
        <table class="data-table history-table">
          <thead>
            <tr>
              <th>เวลาอัปโหลด</th>
              <th>ชื่อไฟล์</th>
              <th>ชีท</th>
              <th>แถวทั้งหมด</th>
              <th>บันทึก</th>
              <th>ข้าม</th>
              <th>ผู้อัปโหลด</th>
            </tr>
          </thead>
          <tbody>${renderImportRows(items)}</tbody>
        </table>
      </div>
    `;
  }

  if (activeTab === 'audits') {
    return `
      <div class="table-wrap">
        <table class="data-table history-table">
          <thead>
            <tr>
              <th>เวลา</th>
              <th>Lot</th>
              <th>Lot Pack</th>
              <th>Lot ผลิต</th>
              <th>คำสั่ง</th>
              <th>ข้อมูลที่เปลี่ยน</th>
              <th>เหตุผล</th>
              <th>ผู้ทำรายการ</th>
              <th>ตำแหน่ง</th>
            </tr>
          </thead>
          <tbody>${renderAuditRows(items)}</tbody>
        </table>
      </div>
    `;
  }

  return `
    <div class="table-wrap">
      <table class="data-table history-table">
        <thead>
          <tr>
            <th>Lot</th>
            <th>Lot Pack</th>
            <th>Lot ผลิต</th>
            <th>วันฝน</th>
            <th>ใบสั่งซื้อ</th>
            <th>รุ่น / รายละเอียด</th>
            <th>เกรด</th>
            <th>จำนวน</th>
            <th>สถานะ</th>
            <th>อัปเดตล่าสุด</th>
          </tr>
        </thead>
        <tbody>${renderLotRows(items)}</tbody>
      </table>
    </div>
  `;
}

function renderActiveFilter({ activeTab, status, action, isLoading }) {
  if (activeTab === 'lots') {
    return `
      <label class="field compact-field">
        สถานะ
        <select id="historyStatus" ${isLoading ? 'disabled aria-disabled="true"' : ''}>
          ${renderOptions(lotStatusOptions, status)}
        </select>
      </label>
    `;
  }

  if (activeTab === 'audits') {
    return `
      <label class="field compact-field">
        คำสั่ง
        <select id="historyAction" ${isLoading ? 'disabled aria-disabled="true"' : ''}>
          ${renderOptions(auditActionOptions, action)}
        </select>
      </label>
    `;
  }

  return '';
}

function getSearchPlaceholder(activeTab) {
  if (activeTab === 'imports') {
    return 'ชื่อไฟล์ Excel';
  }

  if (activeTab === 'audits') {
    return 'Lot / Lot Pack / Lot ผลิต / เหตุผล';
  }

  return 'Lot / Lot Pack / Lot ผลิต / รุ่น / ใบสั่งซื้อ';
}

export function renderHistoryPage({
  activeTab = 'lots',
  selectedDate = '',
  status = 'all',
  action = 'all',
  search = '',
  pageSize = defaultHistoryPageSize,
  page = 1,
  items = [],
  summary = null,
  isLoading = false,
  error = ''
} = {}) {
  return `
    <section class="history-page">
      <section class="management-panel wide-panel history-panel">
        <div class="compact-panel-heading">
          <div>
            <h2>ประวัติ & NG</h2>
            <p>ดูประวัติ Lot, การนำเข้า Excel และการแก้ไขย้อนหลังแบบรวมในหน้าเดียว</p>
          </div>
          <span class="summary-pill">${renderSummary(summary, isLoading)}</span>
        </div>

        <div class="import-tabs history-tabs" role="tablist" aria-label="ประวัติระบบ">
          ${renderTabButtons(activeTab, isLoading)}
        </div>

        <section class="history-filters" aria-label="ตัวกรองประวัติ">
          <label class="field compact-field">
            วันที่
            <input id="historyDate" type="date" value="${escapeHtml(selectedDate)}" ${isLoading ? 'disabled aria-disabled="true"' : ''} />
          </label>

          ${renderActiveFilter({ activeTab, status, action, isLoading })}

          <label class="field search-field">
            ค้นหา
            <input
              id="historySearch"
              type="search"
              maxlength="80"
              placeholder="${escapeHtml(getSearchPlaceholder(activeTab))}"
              value="${escapeHtml(search)}"
              ${isLoading ? 'disabled aria-disabled="true"' : ''}
            />
          </label>

          <button
            id="clearHistoryDate"
            class="secondary-button small-button"
            type="button"
            ${isLoading || !selectedDate ? 'disabled aria-disabled="true"' : ''}
          >
            ล้างวันที่
          </button>
        </section>

        ${renderPaginationControls({ summary, pageSize, page, isLoading })}

        ${renderTable({ activeTab, items, isLoading, error })}
      </section>
    </section>
  `;
}

export function bindHistoryPage({
  onTabChange,
  onDateChange,
  onClearDate,
  onStatusChange,
  onActionChange,
  onSearchChange,
  onPageSizeChange,
  onPageChange
}) {
  document.querySelectorAll('[data-history-tab]:not([disabled])').forEach((button) => {
    button.addEventListener('click', () => {
      onTabChange(button.dataset.historyTab);
    });
  });

  const historyDate = document.querySelector('#historyDate');
  if (historyDate) {
    historyDate.addEventListener('change', () => {
      onDateChange(historyDate.value);
    });
  }

  const clearHistoryDate = document.querySelector('#clearHistoryDate');
  if (clearHistoryDate) {
    clearHistoryDate.addEventListener('click', onClearDate);
  }

  const historyStatus = document.querySelector('#historyStatus');
  if (historyStatus) {
    historyStatus.addEventListener('change', () => {
      onStatusChange(historyStatus.value);
    });
  }

  const historyAction = document.querySelector('#historyAction');
  if (historyAction) {
    historyAction.addEventListener('change', () => {
      onActionChange(historyAction.value);
    });
  }

  const historySearch = document.querySelector('#historySearch');
  if (historySearch) {
    historySearch.addEventListener('input', () => {
      onSearchChange(historySearch.value);
    });
  }

  const historyPageSize = document.querySelector('#historyPageSize');
  if (historyPageSize) {
    historyPageSize.addEventListener('change', () => {
      onPageSizeChange(historyPageSize.value);
    });
  }

  document.querySelectorAll('[data-history-page]:not([disabled])').forEach((button) => {
    button.addEventListener('click', () => {
      onPageChange(Number(button.dataset.historyPage));
    });
  });
}
