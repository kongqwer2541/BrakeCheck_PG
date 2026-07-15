function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatFileSize(size) {
  const numberSize = Number(size || 0);

  if (numberSize < 1024) {
    return `${numberSize} B`;
  }

  if (numberSize < 1024 * 1024) {
    return `${(numberSize / 1024).toFixed(1)} KB`;
  }

  return `${(numberSize / 1024 / 1024).toFixed(1)} MB`;
}

function getPreviewRows(preview) {
  if (!preview) {
    return [];
  }

  return Array.isArray(preview.rows) ? preview.rows : preview.previewRows || [];
}

function renderDateList(dates = []) {
  if (!dates.length) {
    return '-';
  }

  return dates.map((date) => escapeHtml(date)).join(', ');
}

function renderWarnings(warnings = []) {
  if (!warnings.length) {
    return '';
  }

  return `
    <div class="dashboard-alert warning">
      <strong>คำเตือน</strong>
      <span>${warnings.map((warning) => escapeHtml(warning)).join(' / ')}</span>
    </div>
  `;
}

function renderSummaryCards(preview) {
  if (!preview) {
    return '';
  }

  const summary = preview.summary || {};
  const items = [
    { label: 'แถวทั้งหมด', value: summary.totalRows ?? 0 },
    { label: 'Lot ใหม่', value: summary.newLots ?? 0 },
    { label: 'Lot ซ้ำในระบบ', value: summary.duplicateLots ?? 0 },
    { label: 'แถวผิดพลาด', value: summary.errorRows ?? 0 }
  ];

  return `
    <section class="import-summary-grid" aria-label="สรุปข้อมูล Excel">
      ${items.map((item) => `
        <article class="import-summary-card">
          <p>${escapeHtml(item.label)}</p>
          <strong>${escapeHtml(item.value)}</strong>
        </article>
      `).join('')}
    </section>
  `;
}

function renderFileMeta(preview) {
  if (!preview) {
    return '';
  }

  const summary = preview.summary || {};

  return `
    <div class="import-file-meta">
      <span>ไฟล์: <strong>${escapeHtml(preview.file?.originalName)}</strong></span>
      <span>ขนาด: <strong>${escapeHtml(formatFileSize(preview.file?.size))}</strong></span>
      <span>ชีท: <strong>${escapeHtml(preview.sheet?.name)}</strong></span>
      <span>วันฝน: <strong>${renderDateList(summary.productionDates)}</strong></span>
    </div>
  `;
}

function renderRowErrors(errors = []) {
  if (!errors.length) {
    return '';
  }

  return `
    <section class="import-error-panel">
      <div class="panel-heading">
        <h2>รายการที่ต้องแก้ไข</h2>
        <p>${errors.length} แถว</p>
      </div>
      <div class="table-wrap">
        <table class="data-table import-error-table">
          <thead>
            <tr>
              <th>แถว</th>
              <th>Lot</th>
              <th>Lot Pack</th>
              <th>ปัญหา</th>
            </tr>
          </thead>
          <tbody>
            ${errors.map((row) => `
              <tr>
                <td>${escapeHtml(row.rowNumber)}</td>
                <td>${escapeHtml(row.lotNumber || '-')}</td>
                <td>${escapeHtml(row.lotPackBarcode || '-')}</td>
                <td>${escapeHtml((row.errors || []).join(', '))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderColumnErrors(columns = []) {
  const invalidColumns = columns.filter((column) => !column.ok);

  if (!invalidColumns.length) {
    return '';
  }

  return `
    <section class="import-error-panel">
      <div class="panel-heading">
        <h2>คอลัมน์ที่ไม่ตรงกับระบบ</h2>
        <p>${invalidColumns.length} คอลัมน์</p>
      </div>
      <div class="table-wrap">
        <table class="data-table import-error-table">
          <thead>
            <tr>
              <th>คอลัมน์</th>
              <th>ระบบต้องการ</th>
              <th>ไฟล์ที่อ่านได้</th>
            </tr>
          </thead>
          <tbody>
            ${invalidColumns.map((column) => `
              <tr>
                <td>${escapeHtml(column.column)}</td>
                <td>${escapeHtml(column.expected)}</td>
                <td>${escapeHtml(column.actual || '-')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderDuplicateLots(duplicateLots = []) {
  if (!duplicateLots.length) {
    return '';
  }

  return `
    <section class="import-error-panel">
      <div class="panel-heading">
        <h2>Lot ที่มีในระบบแล้ว</h2>
        <p>${duplicateLots.length} Lot</p>
      </div>
      <div class="table-wrap">
        <table class="data-table import-error-table">
          <thead>
            <tr>
              <th>แถว</th>
              <th>Lot</th>
              <th>Lot Pack</th>
            </tr>
          </thead>
          <tbody>
            ${duplicateLots.map((row) => `
              <tr>
                <td>${escapeHtml(row.rowNumber)}</td>
                <td>${escapeHtml(row.lotNumber)}</td>
                <td>${escapeHtml(row.lotPackBarcode || '-')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderErrorDetails(details) {
  if (!details) {
    return '';
  }

  return [
    Array.isArray(details.columns) ? renderColumnErrors(details.columns) : '',
    Array.isArray(details.duplicateLots) ? renderDuplicateLots(details.duplicateLots) : '',
    Array.isArray(details.errors) ? renderRowErrors(details.errors) : ''
  ].join('');
}

function getIssueCount({ preview, errorDetails }) {
  const previewErrors = preview?.errors?.length || 0;
  const invalidColumns = errorDetails?.columns?.filter((column) => !column.ok).length || 0;
  const duplicateLots = errorDetails?.duplicateLots?.length || 0;
  const detailErrors = errorDetails?.errors?.length || 0;

  return previewErrors + invalidColumns + duplicateLots + detailErrors;
}

function getRowStatus(row) {
  const errors = Array.isArray(row.errors) ? row.errors : [];
  const warnings = Array.isArray(row.warnings) ? row.warnings : [];

  if (errors.length) {
    return { label: 'ผิดพลาด', className: 'ng' };
  }

  if (row.status === 'existing') {
    return { label: 'มีในระบบแล้ว', className: 'waiting' };
  }

  if (warnings.length) {
    return { label: 'มีคำเตือน', className: 'progress' };
  }

  return { label: 'พร้อมบันทึก', className: 'approved' };
}

function renderRowStatusNote(row) {
  const issues = [
    ...(Array.isArray(row.errors) ? row.errors : []),
    ...(Array.isArray(row.warnings) ? row.warnings : [])
  ].filter(Boolean);

  if (!issues.length) {
    return '';
  }

  return `<small class="support-text import-row-status-note">${issues.map((issue) => escapeHtml(issue)).join(', ')}</small>`;
}

function hasProductionDateError(rows = []) {
  return rows.some((row) => (
    Array.isArray(row.errors) && row.errors.some((error) => String(error).includes('วันฝน'))
  ));
}

function renderImportBlockNote({
  summary,
  rows,
  saveBlocked,
  conflictDates
}) {
  const reasons = [];

  if (summary.errorRows) {
    reasons.push('แก้ข้อมูลผิดพลาดในไฟล์ Excel');
  }

  if (summary.duplicateLots) {
    reasons.push('ตรวจ Lot ซ้ำก่อนบันทึก');
  }

  if (saveBlocked || hasProductionDateError(rows)) {
    reasons.push('แก้วันฝน (Column T) ใน Excel');
  }

  if (conflictDates.length) {
    reasons.push('ยืนยันวันฝนเดิมก่อนบันทึก');
  }

  if (!reasons.length) {
    return '';
  }

  return `<p class="support-text import-block-note">${reasons.map((reason) => escapeHtml(reason)).join(' / ')}</p>`;
}

function getPagination(rows, pageSize, page) {
  if (pageSize === 'all') {
    return {
      totalRows: rows.length,
      totalPages: 1,
      currentPage: 1,
      visibleRows: rows
    };
  }

  const size = Number(pageSize) || 50;
  const totalPages = Math.max(1, Math.ceil(rows.length / size));
  const currentPage = Math.min(Math.max(Number(page) || 1, 1), totalPages);
  const startIndex = (currentPage - 1) * size;

  return {
    totalRows: rows.length,
    totalPages,
    currentPage,
    visibleRows: rows.slice(startIndex, startIndex + size)
  };
}

function renderPreviewRows(rows = []) {
  if (!rows.length) {
    return `
      <tr>
        <td colspan="14" class="empty-cell">ยังไม่มีตัวอย่างข้อมูล</td>
      </tr>
    `;
  }

  return rows.map((row) => {
    const status = getRowStatus(row);

    return `
      <tr>
        <td>${escapeHtml(row.rowNumber)}</td>
        <td>${escapeHtml(row.lotNumber)}</td>
        <td>${escapeHtml(row.lotPackBarcode)}</td>
        <td>${escapeHtml(row.lotPacking)}</td>
        <td>${escapeHtml(row.purchaseOrder)}</td>
        <td>${escapeHtml(row.code)}</td>
        <td>${escapeHtml(row.modelName)}</td>
        <td>${escapeHtml(row.outerSize)}</td>
        <td>${escapeHtml(row.aciGrade)}</td>
        <td>${escapeHtml(row.quantity)}</td>
        <td>${escapeHtml(row.productionDate)}</td>
        <td>${escapeHtml(row.boreSize)}</td>
        <td>${escapeHtml(row.drillSize)}</td>
        <td>
          <span class="lot-status ${status.className}">${escapeHtml(status.label)}</span>
          ${renderRowStatusNote(row)}
        </td>
      </tr>
    `;
  }).join('');
}

function renderPaginationControls({ pagination, pageSize }) {
  return `
    <div class="preview-table-tools">
      <label class="field compact-field">
        แสดง
        <select id="previewPageSize">
          <option value="50" ${pageSize === '50' ? 'selected' : ''}>50 รายการ</option>
          <option value="all" ${pageSize === 'all' ? 'selected' : ''}>ทั้งหมด</option>
        </select>
      </label>
      <div class="preview-page-actions">
        <span>${escapeHtml(pagination.totalRows)} รายการ</span>
        <button
          class="secondary-button small-button"
          type="button"
          data-preview-page="${pagination.currentPage - 1}"
          ${pagination.currentPage <= 1 || pageSize === 'all' ? 'disabled aria-disabled="true"' : ''}
        >
          ก่อนหน้า
        </button>
        <span>หน้า ${escapeHtml(pagination.currentPage)} / ${escapeHtml(pagination.totalPages)}</span>
        <button
          class="secondary-button small-button"
          type="button"
          data-preview-page="${pagination.currentPage + 1}"
          ${pagination.currentPage >= pagination.totalPages || pageSize === 'all' ? 'disabled aria-disabled="true"' : ''}
        >
          ถัดไป
        </button>
      </div>
    </div>
  `;
}

function renderImportTabs({ activeTab, preview, errorDetails }) {
  const issueCount = getIssueCount({ preview, errorDetails });
  const tabs = [
    { id: 'upload', label: 'อัปโหลด', disabled: false },
    { id: 'summary', label: 'สรุป', disabled: !preview },
    { id: 'preview', label: 'Preview', disabled: !preview },
    { id: 'issues', label: `ปัญหา${issueCount ? ` (${issueCount})` : ''}`, disabled: !preview && !errorDetails }
  ];

  return `
    <div class="import-tabs" role="tablist" aria-label="เมนูนำเข้า Excel">
      ${tabs.map((tab) => `
        <button
          class="${activeTab === tab.id ? 'active' : ''}"
          type="button"
          data-import-tab="${escapeHtml(tab.id)}"
          ${tab.disabled ? 'disabled aria-disabled="true"' : ''}
        >
          ${escapeHtml(tab.label)}
        </button>
      `).join('')}
    </div>
  `;
}

function renderUploadPanel({ selectedFileName, isPreviewLoading, isSaving }) {
  const isBusy = isPreviewLoading || isSaving;

  return `
    <form id="importExcelForm" class="management-panel form-panel import-upload-panel compact-upload-panel">
      <div>
        <h2>อัปโหลด Excel</h2>
        <p class="support-text">รองรับ .xlsx และ .xlsm อ่านเฉพาะชีท DATA</p>
      </div>

      <label class="field import-file-field">
        ไฟล์ Excel
        <input
          id="excelFileInput"
          name="excelFile"
          type="file"
          accept=".xlsx,.xlsm"
          ${isBusy ? 'disabled aria-disabled="true"' : ''}
        />
      </label>

      ${selectedFileName ? `
        <div class="selected-file">
          <span>ไฟล์ที่เลือก</span>
          <strong>${escapeHtml(selectedFileName)}</strong>
        </div>
      ` : ''}

      <button class="primary-button" type="submit" ${isBusy ? 'disabled aria-disabled="true"' : ''}>
        ${isPreviewLoading ? 'กำลัง Preview...' : 'Preview'}
      </button>
    </form>
  `;
}

function renderSummaryPanel(preview) {
  if (!preview) {
    return `
      <section class="import-empty-panel compact-empty-panel">
        <h2>ยังไม่มีข้อมูลสรุป</h2>
        <p>เลือกไฟล์แล้วกด Preview ก่อน</p>
      </section>
    `;
  }

  return `
    <section class="management-panel import-tab-panel">
      ${renderFileMeta(preview)}
      ${renderSummaryCards(preview)}
      ${renderWarnings(preview.warnings)}
    </section>
  `;
}

function renderIssuesPanel({ preview, errorDetails }) {
  const content = [
    renderWarnings(preview?.warnings || []),
    renderRowErrors(preview?.errors || []),
    renderErrorDetails(errorDetails)
  ].join('');

  if (!content.trim()) {
    return `
      <section class="import-empty-panel compact-empty-panel">
        <h2>ไม่พบปัญหาในไฟล์นี้</h2>
        <p>ถ้าข้อมูล Preview ถูกต้อง สามารถกด Confirm Save ได้</p>
      </section>
    `;
  }

  return `
    <section class="import-tab-panel import-issues-panel">
      ${content}
    </section>
  `;
}

function renderPreviewPanel({
  preview,
  isSaving,
  pageSize,
  page,
  saveBlocked,
  conflictDates
}) {
  if (!preview) {
    return `
      <section class="import-empty-panel">
        <h2>ยังไม่มีข้อมูล Preview</h2>
        <p>เลือกไฟล์ Excel แล้วกด Preview เพื่อตรวจข้อมูลก่อนบันทึกลงฐานข้อมูล</p>
      </section>
    `;
  }

  const rows = getPreviewRows(preview);
  const summary = preview.summary || {};
  const pagination = getPagination(rows, pageSize, page);
  const hasBlockingIssue = Boolean(
    summary.errorRows ||
    summary.duplicateLots ||
    saveBlocked ||
    conflictDates.length
  );

  return `
    <section class="management-panel wide-panel import-preview-panel import-table-panel">
      <div class="panel-heading compact-panel-heading">
        <div>
          <h2>Preview ข้อมูลทั้งหมด</h2>
          <p>ตรวจสอบ Lot, Lot Pack, Lot ผลิต, วันฝน (Column T), รุ่น, เกรด และจำนวนก่อนบันทึก</p>
        </div>
        <button
          id="confirmImportButton"
          class="primary-button"
          type="button"
          ${hasBlockingIssue || isSaving ? 'disabled aria-disabled="true"' : ''}
        >
          ${isSaving ? 'กำลังบันทึก...' : 'Confirm Save'}
        </button>
      </div>

      ${hasBlockingIssue ? renderImportBlockNote({ summary, rows, saveBlocked, conflictDates }) : ''}
      ${renderPaginationControls({ pagination, pageSize })}

      <div class="table-wrap import-preview-wrap">
        <table class="data-table import-preview-table">
          <thead>
            <tr>
              <th>แถว</th>
              <th>Lot</th>
              <th>Lot Pack</th>
              <th>Lot ผลิต</th>
              <th>ใบสั่งซื้อ</th>
              <th>Code</th>
              <th>รุ่น</th>
              <th>รายละเอียด</th>
              <th>เกรด</th>
              <th>จำนวน</th>
              <th>วันฝน (Column T)</th>
              <th>รูคว้าน</th>
              <th>รูเจาะ</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            ${renderPreviewRows(pagination.visibleRows)}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderConfirmOverwritePanel(conflictDates = [], isSaving = false) {
  if (!conflictDates.length) {
    return '';
  }

  return `
    <section class="import-confirm-panel">
      <div>
        <strong>พบข้อมูลวันฝนเดิมในระบบ</strong>
        <p>วันฝน: ${conflictDates.map((item) => (
          `${escapeHtml(item.productionDate)} (${escapeHtml(item.lotCount)} Lot)`
        )).join(', ')}</p>
      </div>
      <button
        id="confirmOverwriteButton"
        class="primary-button"
        type="button"
        ${isSaving ? 'disabled aria-disabled="true"' : ''}
      >
        ${isSaving ? 'กำลังบันทึก...' : 'ยืนยันบันทึกเพิ่ม'}
      </button>
    </section>
  `;
}

function renderActiveTabContent({
  activeTab,
  preview,
  errorDetails,
  isSaving,
  previewPageSize,
  previewPage,
  saveBlocked,
  conflictDates
}) {
  if (activeTab === 'summary') {
    return renderSummaryPanel(preview);
  }

  if (activeTab === 'issues') {
    return renderIssuesPanel({ preview, errorDetails });
  }

  if (activeTab === 'preview') {
    return renderPreviewPanel({
      preview,
      isSaving,
      pageSize: previewPageSize,
      page: previewPage,
      saveBlocked,
      conflictDates
    });
  }

  return `
    <section class="import-empty-panel compact-empty-panel">
      <h2>พร้อมอัปโหลดไฟล์ Excel</h2>
      <p>เลือกไฟล์ด้านบนแล้วกด Preview เพื่อดูข้อมูลก่อนบันทึกจริง</p>
    </section>
  `;
}

function getSafeActiveTab(activeTab, preview, errorDetails) {
  if (activeTab === 'preview' && !preview) {
    return 'upload';
  }

  if (activeTab === 'summary' && !preview) {
    return 'upload';
  }

  if (activeTab === 'issues' && !preview && !errorDetails) {
    return 'upload';
  }

  return activeTab;
}

export function renderImportExcelPage({
  selectedFileName = '',
  preview = null,
  message = '',
  error = '',
  errorDetails = null,
  isPreviewLoading = false,
  isSaving = false,
  conflictDates = [],
  activeTab = 'upload',
  previewPageSize = '50',
  previewPage = 1,
  saveBlocked = false
} = {}) {
  const safeActiveTab = getSafeActiveTab(activeTab, preview, errorDetails);

  return `
    <section class="import-page">
      ${message ? `<p class="alert success">${escapeHtml(message)}</p>` : ''}
      ${error ? `<p class="alert error">${escapeHtml(error)}</p>` : ''}
      ${renderConfirmOverwritePanel(conflictDates, isSaving)}
      ${renderUploadPanel({ selectedFileName, isPreviewLoading, isSaving })}
      ${renderImportTabs({ activeTab: safeActiveTab, preview, errorDetails })}
      ${renderActiveTabContent({
        activeTab: safeActiveTab,
        preview,
        errorDetails,
        isSaving,
        previewPageSize,
        previewPage,
        saveBlocked,
        conflictDates
      })}
    </section>
  `;
}

export function bindImportExcelPage({
  onFileChange,
  onPreview,
  onConfirmSave,
  onConfirmOverwrite,
  onTabChange,
  onPreviewPageSizeChange,
  onPreviewPageChange
}) {
  const fileInput = document.querySelector('#excelFileInput');
  if (fileInput) {
    fileInput.addEventListener('change', (event) => {
      onFileChange(event.target.files?.[0] || null);
    });
  }

  const importForm = document.querySelector('#importExcelForm');
  if (importForm) {
    importForm.addEventListener('submit', (event) => {
      event.preventDefault();
      onPreview();
    });
  }

  document.querySelectorAll('[data-import-tab]:not([disabled])').forEach((button) => {
    button.addEventListener('click', () => {
      onTabChange(button.dataset.importTab);
    });
  });

  const previewPageSize = document.querySelector('#previewPageSize');
  if (previewPageSize) {
    previewPageSize.addEventListener('change', () => {
      onPreviewPageSizeChange(previewPageSize.value);
    });
  }

  document.querySelectorAll('[data-preview-page]:not([disabled])').forEach((button) => {
    button.addEventListener('click', () => {
      onPreviewPageChange(Number(button.dataset.previewPage));
    });
  });

  const confirmImportButton = document.querySelector('#confirmImportButton');
  if (confirmImportButton) {
    confirmImportButton.addEventListener('click', onConfirmSave);
  }

  const confirmOverwriteButton = document.querySelector('#confirmOverwriteButton');
  if (confirmOverwriteButton) {
    confirmOverwriteButton.addEventListener('click', onConfirmOverwrite);
  }
}
