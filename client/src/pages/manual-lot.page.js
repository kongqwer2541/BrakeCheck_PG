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

export function renderManualLotPage({
  values = {},
  message = '',
  error = '',
  isSaving = false
} = {}) {
  return `
    <section class="manual-lot-page">
      ${message ? `<p class="alert success">${escapeHtml(message)}</p>` : ''}
      ${error ? `<p class="alert error">${escapeHtml(error)}</p>` : ''}

      <section class="management-panel wide-panel manual-lot-panel">
        <div class="panel-heading">
          <h2>เพิ่ม Manual Lot</h2>
          <p>ใช้เฉพาะกรณีไฟล์ Excel ยังไม่มา หรือไฟล์ผิดรูปแบบ</p>
        </div>

        <form id="manualLotForm" class="manual-lot-form">
          <div class="form-grid two-columns">
            <label class="field">
              Lot
              <input
                name="lotNumber"
                type="text"
                inputmode="numeric"
                maxlength="20"
                autocomplete="off"
                value="${getFieldValue(values, 'lotNumber')}"
                required
              />
            </label>

            <label class="field">
              Lot Pack
              <input
                name="lotPackBarcode"
                type="text"
                inputmode="numeric"
                maxlength="50"
                autocomplete="off"
                value="${getFieldValue(values, 'lotPackBarcode')}"
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
                value="${getFieldValue(values, 'lotPacking', '-')}"
              />
            </label>

            <label class="field">
              วันฝน
              <input
                name="productionDate"
                type="date"
                value="${getFieldValue(values, 'productionDate')}"
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
                value="${getFieldValue(values, 'purchaseOrder')}"
              />
            </label>

            <label class="field">
              Code
              <input
                name="code"
                type="text"
                maxlength="20"
                autocomplete="off"
                value="${getFieldValue(values, 'code')}"
              />
            </label>

            <label class="field">
              รุ่น
              <input
                name="modelName"
                type="text"
                maxlength="200"
                autocomplete="off"
                value="${getFieldValue(values, 'modelName')}"
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
                value="${getFieldValue(values, 'dimension')}"
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
                value="${getFieldValue(values, 'aciGrade')}"
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
                value="${getFieldValue(values, 'quantity')}"
                required
              />
            </label>
          </div>

          <label class="field">
            บันทึก / รหัสยางนอก
            <textarea
              name="remark1"
              maxlength="1000"
              rows="3"
            >${getFieldValue(values, 'remark1')}</textarea>
          </label>

          <label class="field">
            ยิงเลเซอร์
            <textarea
              name="remark2"
              maxlength="1000"
              rows="3"
            >${getFieldValue(values, 'remark2')}</textarea>
          </label>

          <label class="field">
            หมายเหตุเพิ่ม
            <textarea
              name="remark3"
              maxlength="1000"
              rows="3"
            >${getFieldValue(values, 'remark3')}</textarea>
          </label>

          <label class="field">
            เหตุผลการเพิ่ม Manual
            <textarea
              name="manualReason"
              maxlength="500"
              rows="4"
              required
            >${getFieldValue(values, 'manualReason')}</textarea>
          </label>

          <div class="dashboard-alert warning manual-lot-note">
            <strong>ตรวจสอบก่อนบันทึก</strong>
            <span>หลังบันทึกแล้ว Lot จะเข้า Dashboard เป็นสถานะรอตรวจ และใช้แก้ไข/Void ใน Step 6.6</span>
          </div>

          <div class="form-actions">
            <button class="primary-button" type="submit" ${isSaving ? 'disabled aria-disabled="true"' : ''}>
              ${isSaving ? 'กำลังบันทึก...' : 'บันทึก Manual Lot'}
            </button>
          </div>
        </form>
      </section>
    </section>
  `;
}

export function bindManualLotPage({ onSubmit }) {
  const form = document.querySelector('#manualLotForm');
  if (!form) {
    return;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    onSubmit({
      lotNumber: formData.get('lotNumber'),
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
      manualReason: formData.get('manualReason')
    });
  });
}
