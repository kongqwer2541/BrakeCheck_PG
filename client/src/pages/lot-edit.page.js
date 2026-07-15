function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getFieldValue(values, key, fallback = '') {
  return escapeHtml(values?.[key] ?? fallback);
}

function getLotValue(lot, key, fallback = '') {
  return escapeHtml(lot?.[key] ?? fallback);
}

function renderStatusNote(lot) {
  if (!lot) {
    return '';
  }

  if (lot.status === 'approved') {
    return `
      <div class="dashboard-alert warning">
        <strong>Lot นี้ Approved แล้ว</strong>
        <span>ต้องยกเลิก Approved ก่อนจึงจะแก้ไขได้</span>
      </div>
    `;
  }

  if (lot.status === 'void') {
    return `
      <div class="dashboard-alert warning">
        <strong>Lot นี้ถูก Void แล้ว</strong>
        <span>ไม่สามารถแก้ไขหรือ Void ซ้ำได้</span>
      </div>
    `;
  }

  return `
    <div class="dashboard-alert warning">
      <strong>ตรวจสอบก่อนบันทึก</strong>
      <span>การแก้ไข Lot จะถูกเก็บประวัติพร้อมเหตุผล ผู้แก้ไข และเวลา</span>
    </div>
  `;
}

export function renderLotEditPage({
  lot = null,
  values = null,
  message = '',
  error = '',
  isLoading = false,
  isSaving = false
} = {}) {
  const formValues = values || lot || {};
  const isLocked = !lot || lot.status === 'approved' || lot.status === 'void' || isLoading || isSaving;

  if (isLoading) {
    return `
      <section class="lot-edit-page">
        <section class="management-panel wide-panel">
          <div class="loading-cell">กำลังโหลดข้อมูล Lot...</div>
        </section>
      </section>
    `;
  }

  return `
    <section class="lot-edit-page">
      ${message ? `<p class="alert success">${escapeHtml(message)}</p>` : ''}
      ${error ? `<p class="alert error">${escapeHtml(error)}</p>` : ''}

      <section class="management-panel wide-panel lot-edit-panel">
        <div class="panel-heading">
          <div>
            <h2>แก้ไข Lot ${getLotValue(lot, 'lotNumber')}</h2>
            <p>แก้ไขข้อมูลที่นำเข้าแล้ว หรือ Void กรณีข้อมูลผิด โดยไม่ลบประวัติถาวร</p>
          </div>
          <button class="secondary-button" type="button" id="backToDashboardButton">กลับ Dashboard</button>
        </div>

        ${renderStatusNote(lot)}

        <form id="lotEditForm" class="manual-lot-form">
          <div class="form-grid two-columns">
            <label class="field">
              Lot
              <input
                name="lotNumber"
                type="text"
                value="${getLotValue(lot, 'lotNumber')}"
                readonly
              />
            </label>

            <label class="field">
              Lot Pack
              <input
                name="lotPackBarcode"
                type="text"
                maxlength="50"
                autocomplete="off"
                value="${getFieldValue(formValues, 'lotPackBarcode')}"
                ${isLocked ? 'disabled' : ''}
                required
              />
            </label>

            <label class="field">
              Lot ผลิต
              <input
                name="lotPacking"
                type="text"
                maxlength="50"
                autocomplete="off"
                value="${getFieldValue(formValues, 'lotPacking', '-')}"
                ${isLocked ? 'disabled' : ''}
              />
            </label>

            <label class="field">
              วันฝน
              <input
                name="productionDate"
                type="date"
                value="${getFieldValue(formValues, 'productionDate')}"
                ${isLocked ? 'disabled' : ''}
                required
              />
            </label>

            <label class="field">
              ใบสั่งซื้อ
              <input
                name="purchaseOrder"
                type="text"
                maxlength="50"
                autocomplete="off"
                value="${getFieldValue(formValues, 'purchaseOrder')}"
                ${isLocked ? 'disabled' : ''}
              />
            </label>

            <label class="field">
              Code
              <input
                name="code"
                type="text"
                maxlength="20"
                autocomplete="off"
                value="${getFieldValue(formValues, 'code')}"
                ${isLocked ? 'disabled' : ''}
              />
            </label>

            <label class="field">
              รุ่น
              <input
                name="modelName"
                type="text"
                maxlength="200"
                autocomplete="off"
                value="${getFieldValue(formValues, 'modelName')}"
                ${isLocked ? 'disabled' : ''}
                required
              />
            </label>

            <label class="field">
              รายละเอียด / ขนาด
              <input
                name="dimension"
                type="text"
                maxlength="100"
                autocomplete="off"
                value="${getFieldValue(formValues, 'dimension')}"
                ${isLocked ? 'disabled' : ''}
                required
              />
            </label>

            <label class="field">
              เกรด
              <input
                name="aciGrade"
                type="text"
                maxlength="20"
                autocomplete="off"
                value="${getFieldValue(formValues, 'aciGrade')}"
                ${isLocked ? 'disabled' : ''}
                required
              />
            </label>

            <label class="field">
              จำนวนชิ้น
              <input
                name="quantity"
                type="number"
                min="1"
                step="1"
                value="${getFieldValue(formValues, 'quantity')}"
                ${isLocked ? 'disabled' : ''}
                required
              />
            </label>
          </div>

          <label class="field">
            บันทึก / รหัสยางนอก
            <textarea name="remark1" maxlength="1000" rows="3" ${isLocked ? 'disabled' : ''}>${getFieldValue(formValues, 'remark1')}</textarea>
          </label>

          <label class="field">
            ยิงเลเซอร์
            <textarea name="remark2" maxlength="1000" rows="3" ${isLocked ? 'disabled' : ''}>${getFieldValue(formValues, 'remark2')}</textarea>
          </label>

          <label class="field">
            หมายเหตุเพิ่ม
            <textarea name="remark3" maxlength="1000" rows="3" ${isLocked ? 'disabled' : ''}>${getFieldValue(formValues, 'remark3')}</textarea>
          </label>

          <label class="field">
            เหตุผลการแก้ไข
            <textarea name="editReason" maxlength="500" rows="3" ${isLocked ? 'disabled' : ''} required>${getFieldValue(formValues, 'editReason')}</textarea>
          </label>

          <div class="form-actions">
            <button class="primary-button" type="submit" ${isLocked ? 'disabled aria-disabled="true"' : ''}>
              ${isSaving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
            </button>
          </div>
        </form>
      </section>

      <section class="management-panel wide-panel lot-void-panel">
        <div class="panel-heading">
          <h2>Void Lot</h2>
          <p>ใช้เมื่อต้องยกเลิก Lot ที่ผิด โดยยังเก็บประวัติไว้ตรวจสอบย้อนหลัง</p>
        </div>
        <form id="lotVoidForm" class="manual-lot-form">
          <label class="field">
            เหตุผลการ Void
            <textarea name="voidReason" maxlength="500" rows="3" ${isLocked ? 'disabled' : ''} required></textarea>
          </label>
          <div class="form-actions">
            <button class="danger-button" type="submit" ${isLocked ? 'disabled aria-disabled="true"' : ''}>
              Void Lot
            </button>
          </div>
        </form>
      </section>
    </section>
  `;
}

export function bindLotEditPage({ onSubmit, onVoid, onBack }) {
  const backButton = document.querySelector('#backToDashboardButton');
  if (backButton) {
    backButton.addEventListener('click', onBack);
  }

  const editForm = document.querySelector('#lotEditForm');
  if (editForm) {
    editForm.addEventListener('submit', (event) => {
      event.preventDefault();

      const formData = new FormData(event.currentTarget);
      onSubmit({
        lotPackBarcode: formData.get('lotPackBarcode'),
        lotPacking: formData.get('lotPacking'),
        productionDate: formData.get('productionDate'),
        purchaseOrder: formData.get('purchaseOrder'),
        code: formData.get('code'),
        modelName: formData.get('modelName'),
        dimension: formData.get('dimension'),
        aciGrade: formData.get('aciGrade'),
        quantity: formData.get('quantity'),
        remark1: formData.get('remark1'),
        remark2: formData.get('remark2'),
        remark3: formData.get('remark3'),
        editReason: formData.get('editReason')
      });
    });
  }

  const voidForm = document.querySelector('#lotVoidForm');
  if (voidForm) {
    voidForm.addEventListener('submit', (event) => {
      event.preventDefault();

      const formData = new FormData(event.currentTarget);
      onVoid(formData.get('voidReason'));
    });
  }
}
