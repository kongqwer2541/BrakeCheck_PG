const lotSummaryColumns = [
  { key: 'lotNumber', label: 'Lot' },
  { key: 'lotPackBarcode', label: 'Lot Pack' },
  { key: 'lotPacking', label: 'Lot ผลิต' },
  { key: 'purchaseOrder', label: 'ใบสั่งซื้อ' },
  { key: 'code', label: 'Code' },
  { key: 'modelName', label: 'รุ่น' },
  { key: 'dimension', label: 'รายละเอียด' },
  { key: 'aciGrade', label: 'เกรด' },
  { key: 'quantity', label: 'จำนวน' },
  { key: 'productionDate', label: 'วันฝน' },
  { key: 'drillSize', label: 'ขนาดรูเจาะ' },
  { key: 'boreSize', label: 'ขนาดรูคว้าน' }
];

const lotTableColumns = [
  { key: 'lotNumber', label: 'Lot' },
  { key: 'lotPackBarcode', label: 'Lot Pack' },
  { key: 'lotPacking', label: 'Lot ผลิต' },
  { key: 'purchaseOrder', label: 'ใบสั่งซื้อ' },
  { key: 'code', label: 'Code' },
  { key: 'modelName', label: 'รุ่น' },
  { key: 'dimension', label: 'รายละเอียด' },
  { key: 'aciGrade', label: 'เกรด' },
  { key: 'quantity', label: 'จำนวน' },
  { key: 'productionDate', label: 'วันฝน' }
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

function renderLotCell(lot, column) {
  const value = lot?.[column.key];
  return `<td>${escapeHtml(value || '-')}</td>`;
}

function renderResultRows(lots, selectedLotNumber) {
  if (!lots.length) {
    return '<tr><td colspan="11" class="empty-cell">ไม่พบ Lot Pack / Lot นี้ในระบบ</td></tr>';
  }

  return lots.map((lot) => `
    <tr
      class="${selectedLotNumber === lot.lotNumber ? 'selected-row' : ''}"
      data-select-lot="${escapeHtml(lot.lotNumber)}"
      tabindex="0"
      aria-label="เลือก Lot ${escapeHtml(lot.lotNumber)}"
    >
      <td>
        <span class="lot-status ${getStatusClass(lot.status)}">
          ${escapeHtml(lot.statusLabel || lot.status || '-')}
        </span>
      </td>
      ${lotTableColumns.map((column) => renderLotCell(lot, column)).join('')}
    </tr>
  `).join('');
}

function renderSelectedLot(selectedLot) {
  if (!selectedLot) {
    return '';
  }

  return `
    <section class="management-panel wide-panel lot-inspection-panel">
      <div class="compact-panel-heading">
        <div>
          <h2>Lot Inspection</h2>
          <p>Lot ${escapeHtml(selectedLot.lotNumber)} / ${escapeHtml(selectedLot.lotPackBarcode)}</p>
        </div>
        <span class="lot-status ${getStatusClass(selectedLot.status)}">
          ${escapeHtml(selectedLot.statusLabel || selectedLot.status || '-')}
        </span>
      </div>

      <dl class="lot-summary-grid">
        ${lotSummaryColumns.map((column) => `
          <div>
            <dt>${escapeHtml(column.label)}</dt>
            <dd>${escapeHtml(selectedLot[column.key] || '-')}</dd>
          </div>
        `).join('')}
      </dl>

      <div class="import-tabs inspection-tabs" role="tablist" aria-label="ฟอร์มตรวจ">
        <button
          class="active"
          type="button"
          data-open-inspection="dimension"
          ${selectedLot.status === 'void' ? 'disabled aria-disabled="true"' : ''}
        >
          ฟอร์มตรวจมิติ
        </button>
        <button
          type="button"
          data-open-inspection="packing"
          ${selectedLot.status === 'void' ? 'disabled aria-disabled="true"' : ''}
        >
          ฟอร์มตรวจบรรจุ
        </button>
      </div>
    </section>
  `;
}

export function renderLotLookupPage({
  lotPackBarcode = '',
  lots = [],
  selectedLot = null,
  message = '',
  error = '',
  isLoading = false,
  hasSearched = false
} = {}) {
  return `
    <section class="lot-lookup-page">
      ${message ? `<p class="alert success">${escapeHtml(message)}</p>` : ''}
      ${error ? `<p class="alert error">${escapeHtml(error)}</p>` : ''}

      <section class="management-panel wide-panel lot-lookup-panel">
        <div class="compact-panel-heading">
          <div>
            <h2>ยิงบาร์โค้ด / ค้นหา Lot</h2>
            <p>ค้นหาจาก Lot Pack หรือ Lot</p>
          </div>
          <span class="summary-pill">${isLoading ? 'กำลังค้นหา' : `${lots.length} รายการ`}</span>
        </div>

        <form id="lotLookupForm" class="lot-lookup-form">
          <label class="field lot-scan-field">
            Lot Pack / Lot
            <input
              id="lotPackBarcodeInput"
              name="lotPackBarcode"
              type="search"
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength="50"
              autocomplete="off"
              value="${escapeHtml(lotPackBarcode)}"
              ${isLoading ? 'disabled aria-disabled="true"' : ''}
              required
            />
          </label>

          <button class="primary-button" type="submit" ${isLoading ? 'disabled aria-disabled="true"' : ''}>
            ${isLoading ? 'กำลังค้นหา...' : 'ค้นหา'}
          </button>
        </form>

        ${hasSearched || isLoading ? `
          <div class="table-wrap">
            <table class="data-table lot-lookup-table">
              <thead>
                <tr>
                  <th>สถานะ</th>
                  ${lotTableColumns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${isLoading
                  ? '<tr><td colspan="11" class="empty-cell">กำลังค้นหา...</td></tr>'
                  : renderResultRows(lots, selectedLot?.lotNumber || '')}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="history-state-panel compact-empty-panel">
            <strong>พร้อมค้นหา Lot Pack / Lot</strong>
          </div>
        `}
      </section>

      ${renderSelectedLot(selectedLot)}
    </section>
  `;
}

export function bindLotLookupPage({
  onSearch,
  onSelectLot,
  onOpenInspection
}) {
  const input = document.querySelector('#lotPackBarcodeInput');
  const form = document.querySelector('#lotLookupForm');

  if (input) {
    input.focus();
    input.select();
  }

  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      onSearch(formData.get('lotPackBarcode'));
    });
  }

  document.querySelectorAll('[data-select-lot]').forEach((row) => {
    row.addEventListener('click', () => {
      onSelectLot(row.dataset.selectLot);
    });

    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelectLot(row.dataset.selectLot);
      }
    });
  });

  document.querySelectorAll('[data-open-inspection]').forEach((button) => {
    button.addEventListener('click', () => {
      onOpenInspection(button.dataset.openInspection);
    });
  });
}
