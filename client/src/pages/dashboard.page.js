const statusFilters = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'waiting', label: 'รอตรวจ' },
  { value: 'in_progress', label: 'กำลังตรวจ' },
  { value: 'need_fix', label: 'รอแก้ไข' },
  { value: 'waiting_approve', label: 'รออนุมัติ' },
  { value: 'approved', label: 'Approved' },
  { value: 'ng', label: 'NG' }
];

export const defaultDashboardPageSize = '50';

const dashboardPageSizeOptions = [
  { value: defaultDashboardPageSize, label: '50 รายการ' },
  { value: 'all', label: 'ทั้งหมด' }
];

const dashboardTableColumnCount = 9;

const emptyStats = {
  totalLots: 0,
  completedLots: 0,
  approvedLots: 0,
  waitingApproveLots: 0,
  ngLots: 0
};

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

  if (status === 'need_fix') {
    return 'fix';
  }

  if (status === 'temp') {
    return 'progress';
  }

  return 'progress';
}

function renderStatCards(stats = emptyStats) {
  const currentStats = stats || emptyStats;
  const dashboardStats = [
    {
      label: 'รายการตรวจสอบ',
      value: currentStats.totalLots,
      unit: 'Lot',
      tone: 'green'
    },
    {
      label: 'Approved แล้ว',
      value: currentStats.approvedLots,
      unit: 'Lot',
      tone: 'blue'
    },
    {
      label: 'รออนุมัติ',
      value: currentStats.waitingApproveLots,
      unit: 'Lot',
      tone: 'orange'
    },
    {
      label: 'NG',
      value: currentStats.ngLots,
      unit: 'Lot',
      tone: 'red'
    }
  ];

  return dashboardStats.map((stat) => `
    <article class="stat-card ${stat.tone}">
      <p>${escapeHtml(stat.label)}</p>
      <strong>${stat.value}</strong>
      <span>${escapeHtml(stat.unit)}</span>
    </article>
  `).join('');
}

function canManageLot(userRole) {
  return ['head', 'assistant'].includes(userRole);
}

function renderLotActionButtons(item, userRole) {
  if (!canManageLot(userRole)) {
    return '-';
  }

  const isLocked = item.status === 'approved' || item.status === 'void';
  const lockedTitle = item.status === 'approved'
    ? 'Approved แล้ว ต้องยกเลิก Approved ก่อน'
    : 'Lot นี้ Void แล้ว';

  return `
    <div class="table-action-group">
      <button
        class="secondary-button small-button"
        type="button"
        data-lot-edit="${escapeHtml(item.lotNumber)}"
        ${isLocked ? `disabled aria-disabled="true" title="${escapeHtml(lockedTitle)}"` : ''}
      >
        แก้ไข
      </button>
      <button
        class="danger-button small-button dashboard-cancel-button"
        type="button"
        data-lot-void="${escapeHtml(item.lotNumber)}"
        ${isLocked ? `disabled aria-disabled="true" title="${escapeHtml(lockedTitle)}"` : ''}
      >
        ยกเลิก
      </button>
    </div>
  `;
}

function renderInspectionRows(items, userRole) {
  if (!items.length) {
    return `
      <tr>
        <td colspan="${dashboardTableColumnCount}" class="empty-cell">ยังไม่มีรายการตรวจสอบตามวันที่และตัวกรองนี้</td>
      </tr>
    `;
  }

  return items.map((item) => `
    <tr>
      <td>${escapeHtml(item.lotNumber)}</td>
      <td>${escapeHtml(item.lotPackBarcode)}</td>
      <td>${escapeHtml(item.lotPacking)}</td>
      <td class="dashboard-model-cell">
        <strong>${escapeHtml(item.modelName)}</strong>
        <span>${escapeHtml(item.detail)} - ${escapeHtml(item.quantity)} ชิ้น</span>
      </td>
      <td>${escapeHtml(item.purchaseOrder)}</td>
      <td>${escapeHtml(item.aciGrade)}</td>
      <td>${escapeHtml(item.quantity)}</td>
      <td>
        <span class="lot-status ${getStatusClass(item.status)} dashboard-status-badge">${escapeHtml(item.statusLabel)}</span>
      </td>
      <td>${renderLotActionButtons(item, userRole)}</td>
    </tr>
  `).join('');
}

function renderDashboardRows({ items, isLoading, error, userRole }) {
  if (isLoading) {
    return `
      <tr>
        <td colspan="${dashboardTableColumnCount}" class="loading-cell">กำลังโหลดรายการตรวจสอบ...</td>
      </tr>
    `;
  }

  if (error) {
    return `
      <tr>
        <td colspan="${dashboardTableColumnCount}" class="error-cell">${escapeHtml(error)}</td>
      </tr>
    `;
  }

  return renderInspectionRows(items, userRole);
}

function renderStatusOptions(selectedStatus) {
  return statusFilters.map((status) => `
    <option value="${escapeHtml(status.value)}" ${selectedStatus === status.value ? 'selected' : ''}>
      ${escapeHtml(status.label)}
    </option>
  `).join('');
}

function renderDateCaption(startDate, endDate) {
  if (!startDate && !endDate) {
    return 'ยังไม่มีวันที่ผลิตในระบบ';
  }

  if (startDate === endDate) {
    return startDate;
  }

  return `${startDate} ถึง ${endDate}`;
}

function getLatestTargetDate({ latestDate, todayDate, startDate, endDate }) {
  return latestDate || todayDate || endDate || startDate;
}

function isLatestButtonDisabled({ latestDate, todayDate, startDate, endDate }) {
  const targetDate = getLatestTargetDate({ latestDate, todayDate, startDate, endDate });
  return !targetDate || (startDate === targetDate && endDate === targetDate);
}

function getDashboardPagination(summary, pageSize, page) {
  const totalRows = Number(summary?.totalItems || 0);
  const currentPageSize = String(summary?.pageSize || pageSize || defaultDashboardPageSize);

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

function renderDashboardPaginationControls({ summary, pageSize, page, isLoading }) {
  const pagination = getDashboardPagination(summary, pageSize, page);
  const currentPageSize = String(summary?.pageSize || pageSize || defaultDashboardPageSize);

  return `
    <div class="preview-table-tools dashboard-table-tools">
      <label class="field compact-field">
        แสดง
        <select id="dashboardPageSize" ${isLoading ? 'disabled aria-disabled="true"' : ''}>
          ${dashboardPageSizeOptions.map((option) => `
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
          data-dashboard-page="${pagination.currentPage - 1}"
          ${pagination.currentPage <= 1 || currentPageSize === 'all' || isLoading ? 'disabled aria-disabled="true"' : ''}
        >
          ก่อนหน้า
        </button>
        <span>หน้า ${escapeHtml(pagination.currentPage)} / ${escapeHtml(pagination.totalPages)}</span>
        <button
          class="secondary-button small-button"
          type="button"
          data-dashboard-page="${pagination.currentPage + 1}"
          ${pagination.currentPage >= pagination.totalPages || currentPageSize === 'all' || isLoading ? 'disabled aria-disabled="true"' : ''}
        >
          ถัดไป
        </button>
      </div>
    </div>
  `;
}

export function renderDashboardPage({
  startDate = '',
  endDate = '',
  latestDate = '',
  todayDate = '',
  hasNewerDate = false,
  status = 'all',
  search = '',
  stats = emptyStats,
  items = [],
  summary = null,
  pageSize = defaultDashboardPageSize,
  page = 1,
  isLoading = false,
  error = '',
  tableError = '',
  notice = '',
  userRole = ''
} = {}) {
  const currentStats = stats || emptyStats;
  const isDashboardLatestDisabled = isLatestButtonDisabled({ latestDate, todayDate, startDate, endDate });

  return `
    <section class="dashboard-page">
      <section class="dashboard-filters" aria-label="ตัวกรองรายการตรวจสอบ">
        <label class="field compact-field">
          วันที่
          <input id="dashboardDate" type="date" value="${escapeHtml(endDate || startDate)}" />
        </label>
        <div class="queue-date-actions">
          <button class="secondary-button small-button" type="button" data-dashboard-range="1">ย้อนหลัง 1 วัน</button>
          <button class="secondary-button small-button" type="button" data-dashboard-range="3">ย้อนหลัง 3 วัน</button>
          <button class="secondary-button small-button" type="button" data-dashboard-latest ${isDashboardLatestDisabled ? 'disabled aria-disabled="true"' : ''}>
            ไปวันล่าสุด
          </button>
        </div>
        <label class="field compact-field">
          สถานะ
          <select id="dashboardStatus">
            ${renderStatusOptions(status)}
          </select>
        </label>
        <label class="field search-field">
          ค้นหา Lot
          <input
            id="dashboardSearch"
            type="search"
            placeholder="Lot / Lot Pack / Lot ผลิต"
            value="${escapeHtml(search)}"
          />
        </label>
      </section>

      <div class="queue-toolbar dashboard-summary-toolbar">
        <div>
          <h2>Dashboard</h2>
          <p>วันที่ผลิต: ${escapeHtml(renderDateCaption(startDate, endDate))}</p>
        </div>
      </div>

      ${notice ? `
        <div class="dashboard-alert info">
          <strong>แจ้งเตือน</strong>
          <span>${escapeHtml(notice)}</span>
        </div>
      ` : ''}

      ${error ? `
        <div class="dashboard-alert error">
          <strong>เกิดข้อผิดพลาด</strong>
          <span>${escapeHtml(error)}</span>
        </div>
      ` : ''}

      ${currentStats.waitingApproveLots ? `
        <div class="dashboard-alert warning">
          <strong>${escapeHtml(currentStats.waitingApproveLots)} Lot รออนุมัติ</strong>
          <span>มีงานรอตรวจเอกสาร Approved</span>
        </div>
      ` : ''}

      <section class="stats-grid">
        ${renderStatCards(currentStats)}
      </section>

      ${currentStats.ngLots ? `
        <div class="ng-strip">
          <strong>${escapeHtml(currentStats.ngLots)} Lot เป็น NG</strong>
          <span>โปรดตรวจสอบรายการ NG ตามตัวกรองวันที่</span>
        </div>
      ` : ''}

      <section class="latest-lots-panel">
        <div class="panel-heading">
          <h2>รายการตรวจสอบ</h2>
          <p>${isLoading ? 'กำลังโหลด' : `${summary?.totalItems ?? items.length} รายการ`}</p>
        </div>
        ${renderDashboardPaginationControls({ summary, pageSize, page, isLoading })}
        <div class="table-wrap">
          <table class="data-table dashboard-table">
            <thead>
              <tr>
                <th>Lot</th>
                <th>Lot Pack</th>
                <th>Lot ผลิต</th>
                <th>รุ่น / รายละเอียด</th>
                <th>ใบสั่งซื้อ</th>
                <th>เกรด</th>
                <th>จำนวนชิ้น</th>
                <th>สถานะ</th>
                <th>คำสั่ง</th>
              </tr>
            </thead>
            <tbody>
              ${renderDashboardRows({ items, isLoading, error: tableError, userRole })}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  `;
}

export function bindDashboardPage({
  onDateChange,
  onRangeChange,
  onLatest,
  onStatusChange,
  onSearchChange,
  onPageSizeChange,
  onPageChange,
  onEditLot,
  onVoidLot
}) {
  const dashboardDate = document.querySelector('#dashboardDate');
  if (dashboardDate) {
    dashboardDate.addEventListener('change', () => {
      onDateChange(dashboardDate.value);
    });
  }

  document.querySelectorAll('[data-dashboard-range]').forEach((button) => {
    button.addEventListener('click', () => {
      onRangeChange(Number(button.dataset.dashboardRange));
    });
  });

  document.querySelector('[data-dashboard-latest]:not([disabled])')?.addEventListener('click', () => {
    onLatest();
  });

  const dashboardStatus = document.querySelector('#dashboardStatus');
  if (dashboardStatus) {
    dashboardStatus.addEventListener('change', () => {
      onStatusChange(dashboardStatus.value);
    });
  }

  const dashboardSearch = document.querySelector('#dashboardSearch');
  if (dashboardSearch) {
    dashboardSearch.addEventListener('input', () => {
      onSearchChange(dashboardSearch.value);
    });
  }

  const dashboardPageSize = document.querySelector('#dashboardPageSize');
  if (dashboardPageSize) {
    dashboardPageSize.addEventListener('change', () => {
      onPageSizeChange(dashboardPageSize.value);
    });
  }

  document.querySelectorAll('[data-dashboard-page]:not([disabled])').forEach((button) => {
    button.addEventListener('click', () => {
      onPageChange(Number(button.dataset.dashboardPage));
    });
  });

  document.querySelectorAll('[data-lot-edit]:not([disabled])').forEach((button) => {
    button.addEventListener('click', () => {
      onEditLot(button.dataset.lotEdit);
    });
  });

  document.querySelectorAll('[data-lot-void]:not([disabled])').forEach((button) => {
    button.addEventListener('click', () => {
      onVoidLot(button.dataset.lotVoid);
    });
  });

}
