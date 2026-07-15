export const defaultInspectionQueuePageSize = '50';

const pageSizeOptions = [
  { value: defaultInspectionQueuePageSize, label: '50 รายการ' },
  { value: 'all', label: 'ทั้งหมด' }
];

const statusOptions = {
  dimension: [
    { value: 'all', label: 'ทั้งหมด' },
    { value: 'waiting', label: 'รอตรวจมิติ' },
    { value: 'in_progress', label: 'กำลังตรวจ' },
    { value: 'done', label: 'ตรวจมิติแล้ว' },
    { value: 'need_fix', label: 'รอแก้ไข' },
    { value: 'ng', label: 'NG' },
    { value: 'waiting_approve', label: 'รออนุมัติ' },
    { value: 'approved', label: 'Approved' }
  ],
  packing: [
    { value: 'all', label: 'ทั้งหมด' },
    { value: 'waiting', label: 'รอตรวจบรรจุ' },
    { value: 'in_progress', label: 'กำลังตรวจ' },
    { value: 'done', label: 'ตรวจบรรจุแล้ว' },
    { value: 'need_fix', label: 'รอแก้ไข' },
    { value: 'ng', label: 'NG' },
    { value: 'waiting_approve', label: 'รออนุมัติ' },
    { value: 'approved', label: 'Approved' }
  ]
};

const queueTitles = {
  dimension: 'คิวตรวจมิติ',
  packing: 'คิวตรวจบรรจุ'
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

  if (status === 'waiting_approve') {
    return 'waiting';
  }

  if (status === 'need_fix') {
    return 'fix';
  }

  return 'progress';
}

function getRowTone(item) {
  if (item.queueStatus === 'need_fix') {
    return 'needs-fix';
  }

  if (item.queueStatus === 'ng') {
    return 'ng';
  }

  if (item.queueStatus === 'in_progress') {
    return 'progress';
  }

  return '';
}

function renderStatusOptions(queueType, selectedStatus) {
  return (statusOptions[queueType] || statusOptions.dimension).map((status) => `
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

function renderCompactStats(stats = {}) {
  const currentStats = stats || {};
  const parts = [
    ['ทั้งหมด', currentStats.total],
    ['รอแก้ไข', currentStats.need_fix],
    ['NG', currentStats.ng],
    ['กำลังตรวจ', currentStats.in_progress],
    ['รอตรวจ', currentStats.waiting],
    ['ตรวจแล้ว', currentStats.doneTotal ?? currentStats.done],
    ['รออนุมัติ', currentStats.waiting_approve],
    ['Approved', currentStats.approved]
  ];

  return `
    <div class="queue-stats-strip" aria-label="จำนวนตามสถานะ">
      ${parts.map(([label, value]) => `
        <span><strong>${escapeHtml(value || 0)}</strong> ${escapeHtml(label)}</span>
      `).join('')}
    </div>
  `;
}

function renderPaginationControls({ summary, pageSize, page, isLoading }) {
  const currentPageSize = String(summary?.pageSize || pageSize || defaultInspectionQueuePageSize);
  const totalRows = Number(summary?.totalItems || 0);
  const totalPages = currentPageSize === 'all' ? 1 : Math.max(1, Number(summary?.totalPages || 1));
  const currentPage = currentPageSize === 'all'
    ? 1
    : Math.min(Math.max(Number(summary?.page || page) || 1, 1), totalPages);

  return `
    <div class="preview-table-tools dashboard-table-tools">
      <label class="field compact-field">
        แสดง
        <select id="inspectionQueuePageSize" ${isLoading ? 'disabled aria-disabled="true"' : ''}>
          ${pageSizeOptions.map((option) => `
            <option value="${escapeHtml(option.value)}" ${currentPageSize === option.value ? 'selected' : ''}>
              ${escapeHtml(option.label)}
            </option>
          `).join('')}
        </select>
      </label>
      <div class="preview-page-actions">
        <span>${escapeHtml(totalRows)} รายการ</span>
        <button
          class="secondary-button small-button"
          type="button"
          data-inspection-page="${currentPage - 1}"
          ${currentPage <= 1 || currentPageSize === 'all' || isLoading ? 'disabled aria-disabled="true"' : ''}
        >
          ก่อนหน้า
        </button>
        <span>หน้า ${escapeHtml(currentPage)} / ${escapeHtml(totalPages)}</span>
        <button
          class="secondary-button small-button"
          type="button"
          data-inspection-page="${currentPage + 1}"
          ${currentPage >= totalPages || currentPageSize === 'all' || isLoading ? 'disabled aria-disabled="true"' : ''}
        >
          ถัดไป
        </button>
      </div>
    </div>
  `;
}

function renderRows({ items, isLoading, error }) {
  if (isLoading) {
    return '<tr><td colspan="8" class="loading-cell">กำลังโหลดคิวงานตรวจ...</td></tr>';
  }

  if (error) {
    return `<tr><td colspan="8" class="error-cell">${escapeHtml(error)}</td></tr>`;
  }

  if (!items.length) {
    return '<tr><td colspan="8" class="empty-cell">ไม่พบงานตรวจในช่วงวันที่นี้</td></tr>';
  }

  return items.map((item) => `
    <tr class="queue-click-row ${escapeHtml(getRowTone(item))}" tabindex="0" data-open-lot="${escapeHtml(item.lotNumber)}">
      <td>${escapeHtml(item.lotNumber)}</td>
      <td>${escapeHtml(item.lotPackBarcode)}</td>
      <td>${escapeHtml(item.lotPacking)}</td>
      <td class="dashboard-model-cell">
        <strong>${escapeHtml(item.modelName)}</strong>
        <span>${escapeHtml(item.detail)}</span>
      </td>
      <td>${escapeHtml(item.purchaseOrder)}</td>
      <td>${escapeHtml(item.aciGrade)}</td>
      <td>${escapeHtml(item.quantity)}</td>
      <td>
        <span class="lot-status ${getStatusClass(item.queueStatus)}">${escapeHtml(item.queueStatusLabel)}</span>
      </td>
    </tr>
  `).join('');
}

function renderCards({ items, isLoading, error }) {
  if (isLoading) {
    return '<div class="queue-card-state">กำลังโหลดคิวงานตรวจ...</div>';
  }

  if (error) {
    return `<div class="queue-card-state error">${escapeHtml(error)}</div>`;
  }

  if (!items.length) {
    return '<div class="queue-card-state">ไม่พบงานตรวจในช่วงวันที่นี้</div>';
  }

  return items.map((item) => `
    <article class="queue-work-card ${escapeHtml(getRowTone(item))}" tabindex="0" data-open-lot="${escapeHtml(item.lotNumber)}">
      <div class="queue-card-topline">
        <strong>Lot ${escapeHtml(item.lotNumber)}</strong>
        <span class="lot-status ${getStatusClass(item.queueStatus)}">${escapeHtml(item.queueStatusLabel)}</span>
      </div>
      <div class="queue-card-meta">
        <span>Lot Pack: ${escapeHtml(item.lotPackBarcode)}</span>
        <span>Lot ผลิต: ${escapeHtml(item.lotPacking)}</span>
      </div>
      <p>${escapeHtml(item.modelName)} / ${escapeHtml(item.detail)}</p>
      <div class="queue-card-meta">
        <span>ใบสั่งซื้อ: ${escapeHtml(item.purchaseOrder)}</span>
        <span>เกรด: ${escapeHtml(item.aciGrade)}</span>
        <span>จำนวน: ${escapeHtml(item.quantity)}</span>
      </div>
    </article>
  `).join('');
}

export function renderInspectionQueuePage({
  queueType = 'dimension',
  startDate = '',
  endDate = '',
  latestDate = '',
  hasNewerDate = false,
  status = 'all',
  search = '',
  stats = null,
  items = [],
  summary = null,
  pageSize = defaultInspectionQueuePageSize,
  page = 1,
  isLoading = false,
  error = ''
} = {}) {
  return `
    <section class="dashboard-page inspection-queue-page">
      <div class="queue-toolbar">
        <div>
          <h2>${escapeHtml(queueTitles[queueType] || queueTitles.dimension)}</h2>
          <p>วันที่ผลิต: ${escapeHtml(renderDateCaption(startDate, endDate))}</p>
        </div>
        <button class="secondary-button small-button" type="button" data-queue-refresh ${isLoading ? 'disabled aria-disabled="true"' : ''}>
          รีเฟรช
        </button>
      </div>

      <section class="dashboard-filters inspection-queue-filters" aria-label="ตัวกรองคิวงานตรวจ">
        <label class="field compact-field">
          วันที่
          <input id="inspectionQueueDate" type="date" value="${escapeHtml(endDate || startDate)}" />
        </label>
        <div class="queue-date-actions">
          <button class="secondary-button small-button" type="button" data-queue-range="1">ย้อนหลัง 1 วัน</button>
          <button class="secondary-button small-button" type="button" data-queue-range="3">ย้อนหลัง 3 วัน</button>
          <button class="secondary-button small-button" type="button" data-queue-latest ${!latestDate || (!hasNewerDate && startDate === latestDate && endDate === latestDate) ? 'disabled aria-disabled="true"' : ''}>
            ไปวันล่าสุด
          </button>
        </div>
        <label class="field compact-field">
          สถานะ
          <select id="inspectionQueueStatus">
            ${renderStatusOptions(queueType, status)}
          </select>
        </label>
        <label class="field search-field">
          ค้นหา Lot
          <input
            id="inspectionQueueSearch"
            type="search"
            placeholder="Lot / Lot Pack / Lot ผลิต"
            value="${escapeHtml(search)}"
          />
        </label>
      </section>

      ${hasNewerDate ? `
        <div class="dashboard-alert info compact-alert">
          <strong>มีงานวันที่ใหม่กว่า</strong>
          <span>${escapeHtml(latestDate)}</span>
        </div>
      ` : ''}

      ${error ? `
        <div class="dashboard-alert error">
          <strong>เกิดข้อผิดพลาด</strong>
          <span>${escapeHtml(error)}</span>
        </div>
      ` : ''}

      ${renderCompactStats(stats)}

      <section class="latest-lots-panel queue-lots-panel">
        <div class="panel-heading">
          <h2>รายการงานตรวจ</h2>
          <p>${isLoading ? 'กำลังโหลด' : `${summary?.totalItems ?? items.length} รายการ`}</p>
        </div>
        ${renderPaginationControls({ summary, pageSize, page, isLoading })}
        <div class="table-wrap queue-table-wrap">
          <table class="data-table dashboard-table queue-table">
            <thead>
              <tr>
                <th>Lot</th>
                <th>Lot Pack</th>
                <th>Lot ผลิต</th>
                <th>รุ่น / รายละเอียด</th>
                <th>ใบสั่งซื้อ</th>
                <th>เกรด</th>
                <th>จำนวน</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              ${renderRows({ items, isLoading, error })}
            </tbody>
          </table>
        </div>
        <div class="queue-card-list">
          ${renderCards({ items, isLoading, error })}
        </div>
      </section>
    </section>
  `;
}

export function bindInspectionQueuePage({
  onDateChange,
  onRangeChange,
  onLatest,
  onStatusChange,
  onSearchChange,
  onPageSizeChange,
  onPageChange,
  onRefresh,
  onOpenLot
}) {
  document.querySelector('#inspectionQueueDate')?.addEventListener('change', (event) => {
    onDateChange(event.target.value);
  });

  document.querySelectorAll('[data-queue-range]').forEach((button) => {
    button.addEventListener('click', () => {
      onRangeChange(Number(button.dataset.queueRange));
    });
  });

  document.querySelector('[data-queue-latest]:not([disabled])')?.addEventListener('click', () => {
    onLatest();
  });

  document.querySelector('#inspectionQueueStatus')?.addEventListener('change', (event) => {
    onStatusChange(event.target.value);
  });

  document.querySelector('#inspectionQueueSearch')?.addEventListener('input', (event) => {
    onSearchChange(event.target.value);
  });

  document.querySelector('#inspectionQueuePageSize')?.addEventListener('change', (event) => {
    onPageSizeChange(event.target.value);
  });

  document.querySelectorAll('[data-inspection-page]:not([disabled])').forEach((button) => {
    button.addEventListener('click', () => {
      onPageChange(Number(button.dataset.inspectionPage));
    });
  });

  document.querySelector('[data-queue-refresh]')?.addEventListener('click', () => {
    onRefresh();
  });

  document.querySelectorAll('[data-open-lot]').forEach((item) => {
    const open = () => onOpenLot(item.dataset.openLot);
    let lastPointerUpAt = 0;
    let lastOpenAt = 0;
    const openOnce = () => {
      const now = Date.now();
      if (now - lastOpenAt < 500) return;
      lastOpenAt = now;
      open();
    };

    item.addEventListener('dblclick', openOnce);
    item.addEventListener('pointerup', (event) => {
      if (event.pointerType === 'mouse') return;

      const now = Date.now();
      if (now - lastPointerUpAt <= 450) {
        event.preventDefault();
        openOnce();
      }
      lastPointerUpAt = now;
    });
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openOnce();
      }
    });
  });
}
