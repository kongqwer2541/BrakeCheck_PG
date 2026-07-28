function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function toNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function renderMetric(label, value) {
  return `
    <div class="export-dimension-metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderTopics(availableTopics = [], selectedTopicNames = [], isLoading = false) {
  if (!availableTopics.length) {
    return '<p class="export-dimension-muted">กด Preview เพื่อแสดงหัวข้อการวัด</p>';
  }

  const selectedTopicSet = new Set(selectedTopicNames);

  return `
    <div class="export-dimension-topic-list">
      ${availableTopics.map((topic) => {
        const topicName = topic.topicName || '';
        return `
          <label>
            <input
              type="checkbox"
              value="${escapeHtml(topicName)}"
              data-export-dimension-topic
              ${selectedTopicSet.has(topicName) ? 'checked' : ''}
              ${isLoading ? 'disabled' : ''}
            >
            <span>${escapeHtml(topicName)}</span>
            <small>${escapeHtml(toNumber(topic.numericValueCount) + toNumber(topic.skippedValueCount))} ค่า</small>
          </label>
        `;
      }).join('')}
    </div>
  `;
}

function renderTopicSummary(topicSummary = []) {
  if (!topicSummary.length) {
    return '';
  }

  return `
    <div class="export-dimension-topic-summary">
      ${topicSummary.map((topic) => `
        <span>${escapeHtml(topic.topicName)}: ${escapeHtml(topic.numericValueCount)} ตัวเลข / ${escapeHtml(topic.skippedValueCount)} ข้าม</span>
      `).join('')}
    </div>
  `;
}

function renderRows(items = [], selectedLotIds = [], isLoading = false, isExporting = false) {
  if (isLoading) {
    return '<tr><td colspan="11">กำลัง Preview ข้อมูล Export Dimension...</td></tr>';
  }

  if (!items.length) {
    return '<tr><td colspan="11">ยังไม่มีข้อมูล กรุณาเลือก filter แล้วกด Preview</td></tr>';
  }

  const selectedLotIdSet = new Set(selectedLotIds.map(String));
  const disabled = isExporting ? 'disabled aria-disabled="true"' : '';

  return items.map((item) => {
    const lotId = String(item.lotId || '');
    const isInvalid = Boolean(item.snapshotInvalid);
    const isConfirmedNg = item.lotStatus === 'ng';
    const statusClass = isInvalid || isConfirmedNg ? 'ng' : 'approved';
    const statusLabel = isInvalid
      ? 'Snapshot ผิดปกติ'
      : isConfirmedNg
        ? 'รับทราบ NG'
        : 'Approved';
    return `
      <tr>
        <td>
          <input
            type="checkbox"
            data-export-dimension-lot
            value="${escapeHtml(lotId)}"
            ${selectedLotIdSet.has(lotId) ? 'checked' : ''}
            ${isInvalid || isExporting ? 'disabled aria-disabled="true"' : ''}
          >
        </td>
        <td><strong>${escapeHtml(item.lotNumber)}</strong></td>
        <td>${escapeHtml(item.lotPack)}</td>
        <td>${escapeHtml(item.productionLot)}</td>
        <td>${escapeHtml(item.productionDate)}</td>
        <td>${escapeHtml(item.inspectionDate)}</td>
        <td>
          <strong>${escapeHtml(item.model)}</strong>
          <span>${escapeHtml(item.description)}</span>
        </td>
        <td>${escapeHtml(item.purchaseOrder)}</td>
        <td>${escapeHtml(item.quantity)}</td>
        <td>
          <span class="lot-status ${statusClass}">
            ${statusLabel}
          </span>
          <small>${escapeHtml(item.numericValueCount)} ตัวเลข / ${escapeHtml(item.skippedValueCount)} ข้าม</small>
        </td>
        <td>
          <button class="secondary-button small-button" type="button" data-export-dimension-open="${escapeHtml(item.lotNumber)}" ${disabled}>
            ดูข้อมูล
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

export function renderExportDimensionPage({
  filters = {},
  preview = {},
  selectedTopicNames = [],
  selectedLotIds = [],
  error = '',
  message = '',
  isLoading = false,
  isExporting = false
} = {}) {
  const items = Array.isArray(preview.items) ? preview.items : [];
  const availableTopics = Array.isArray(preview.availableTopics) ? preview.availableTopics : [];
  const topicSummary = Array.isArray(preview.topicSummary) ? preview.topicSummary : [];
  const summary = preview.summary || {};
  const exportableItems = items.filter((item) => !item.snapshotInvalid);
  const allVisibleSelected = exportableItems.length
    && exportableItems.every((item) => selectedLotIds.map(String).includes(String(item.lotId)));
  const selectedCount = selectedLotIds.length;
  const canExport = selectedCount > 0 && !isLoading && !isExporting && summary.canExport !== false;

  return `
    <section class="approval-queue-page export-dimension-page">
      <div class="compact-panel-heading">
        <div>
          <h2>Export Dimension</h2>
          <p>${escapeHtml(summary.totalLots ?? 0)} Lot / ${escapeHtml(summary.numericValueCount ?? 0)} ค่าตัวเลข</p>
        </div>
      </div>

      ${message ? `<p class="alert success">${escapeHtml(message)}</p>` : ''}
      ${error ? `<p class="alert error">${escapeHtml(error)}</p>` : ''}
      ${summary.canExport === false ? `<p class="alert warning">จำนวนค่ามากเกินกว่าที่กำหนด กรุณากรองข้อมูลให้แคบลง</p>` : ''}
      ${summary.snapshotInvalidCount ? `<p class="alert warning">พบ Lot snapshot ผิดปกติ ${escapeHtml(summary.snapshotInvalidCount)} รายการ กรุณาตรวจสอบก่อน Export</p>` : ''}

      <div class="export-dimension-filter-panel">
        <label>
          รุ่น / รายละเอียด
          <input type="search" name="exportDimensionModel" value="${escapeHtml(filters.model)}" placeholder="เช่น ABC123" maxlength="120" ${isLoading ? 'disabled' : ''}>
        </label>
        <label>
          วันที่ผลิตเริ่ม
          <input type="date" name="exportDimensionProductionStartDate" value="${escapeHtml(filters.productionStartDate)}" ${isLoading ? 'disabled' : ''}>
        </label>
        <label>
          วันที่ผลิตสิ้นสุด
          <input type="date" name="exportDimensionProductionEndDate" value="${escapeHtml(filters.productionEndDate)}" ${isLoading ? 'disabled' : ''}>
        </label>
        <label>
          วันที่ตรวจเริ่ม
          <input type="date" name="exportDimensionInspectionStartDate" value="${escapeHtml(filters.inspectionStartDate)}" ${isLoading ? 'disabled' : ''}>
        </label>
        <label>
          วันที่ตรวจสิ้นสุด
          <input type="date" name="exportDimensionInspectionEndDate" value="${escapeHtml(filters.inspectionEndDate)}" ${isLoading ? 'disabled' : ''}>
        </label>
        <button class="primary-button" type="button" data-export-dimension-preview ${isLoading ? 'disabled aria-disabled="true"' : ''}>
          ${isLoading ? 'กำลัง Preview...' : 'Preview'}
        </button>
      </div>

      <section class="latest-lots-panel export-dimension-topic-panel">
        <div class="compact-panel-heading">
          <div>
            <h3>หัวข้อการวัด</h3>
            <p>ไม่เลือก = Export ทุกหัวข้อที่พบ</p>
          </div>
          <button class="secondary-button small-button" type="button" data-export-dimension-clear-topics ${isLoading || !selectedTopicNames.length ? 'disabled aria-disabled="true"' : ''}>
            ล้างหัวข้อ
          </button>
        </div>
        ${renderTopics(availableTopics, selectedTopicNames, isLoading)}
        ${renderTopicSummary(topicSummary)}
      </section>

      <section class="latest-lots-panel approval-queue-panel">
        <div class="preview-page-actions">
          ${renderMetric('Lot ที่เลือก', selectedCount)}
          ${renderMetric('ค่าตัวเลข', summary.numericValueCount ?? 0)}
          ${renderMetric('ค่าที่ข้าม', summary.skippedValueCount ?? 0)}
          <label class="export-dimension-select-all">
            <input type="checkbox" data-export-dimension-select-all ${allVisibleSelected ? 'checked' : ''} ${!exportableItems.length || isExporting ? 'disabled' : ''}>
            เลือก Lot ที่พร้อม Export ทั้งหมด
          </label>
          <button class="primary-button export-dimension-download-button" type="button" data-export-dimension-download ${canExport ? '' : 'disabled aria-disabled="true"'}>
            ${isExporting ? 'กำลัง Export...' : 'Export Excel'}
          </button>
        </div>

        <div class="table-wrap approval-table-scroll">
          <table class="data-table approval-queue-table export-dimension-table">
            <thead>
              <tr>
                <th>เลือก</th>
                <th>Lot</th>
                <th>Lot Pack</th>
                <th>Lot ผลิต</th>
                <th>วันที่ผลิต</th>
                <th>วันที่ตรวจ</th>
                <th>รุ่น / รายละเอียด</th>
                <th>ใบสั่งซื้อ</th>
                <th>จำนวน</th>
                <th>สถานะ</th>
                <th>คำสั่ง</th>
              </tr>
            </thead>
            <tbody>
              ${renderRows(items, selectedLotIds, isLoading, isExporting)}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  `;
}

export function bindExportDimensionPage({
  onFilterChange,
  onPreview,
  onTopicToggle,
  onClearTopics,
  onLotToggle,
  onSelectAllLots,
  onOpenLot,
  onExportExcel
}) {
  [
    'exportDimensionModel',
    'exportDimensionProductionStartDate',
    'exportDimensionProductionEndDate',
    'exportDimensionInspectionStartDate',
    'exportDimensionInspectionEndDate'
  ].forEach((name) => {
    document.querySelector(`[name="${name}"]`)?.addEventListener('change', (event) => {
      onFilterChange(name, event.target.value);
    });
  });

  document.querySelector('[data-export-dimension-preview]')?.addEventListener('click', onPreview);
  document.querySelector('[data-export-dimension-clear-topics]')?.addEventListener('click', onClearTopics);
  document.querySelector('[data-export-dimension-download]')?.addEventListener('click', onExportExcel);

  document.querySelector('[data-export-dimension-select-all]')?.addEventListener('change', (event) => {
    onSelectAllLots(event.target.checked);
  });

  document.querySelectorAll('[data-export-dimension-topic]').forEach((input) => {
    input.addEventListener('change', () => onTopicToggle(input.value, input.checked));
  });

  document.querySelectorAll('[data-export-dimension-lot]').forEach((input) => {
    input.addEventListener('change', () => onLotToggle(input.value, input.checked));
  });

  document.querySelectorAll('[data-export-dimension-open]').forEach((button) => {
    button.addEventListener('click', () => onOpenLot(button.dataset.exportDimensionOpen));
  });
}
