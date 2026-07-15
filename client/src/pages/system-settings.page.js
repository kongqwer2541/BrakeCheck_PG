function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getInputTypeLabel(inputType) {
  return inputType === 'number' ? 'ตัวเลข' : 'ผ่าน / ไม่ผ่าน';
}

function getMeasurePiecesLabel(value) {
  if (!value || value === 'all') {
    return 'ทุกชิ้น';
  }

  if (value === 'first') {
    return 'เฉพาะชิ้นที่ 1';
  }

  return value;
}

function getRuleKeyLabel(ruleKey) {
  if (ruleKey === 'hole_inspection') {
    return 'ตรวจรูเจาะ/รูคว้าน';
  }

  return 'ไม่มีเงื่อนไขพิเศษ';
}

function getActionLabel(action) {
  const labels = {
    add_topic: 'เพิ่มหัวข้อ',
    update_topic_display: 'แก้ลำดับ/หมายเหตุ',
    deactivate_topic: 'ปิดใช้งานหัวข้อ',
    update_sampling_rules: 'แก้จำนวนสุ่มตรวจ',
    update_instrument_prefixes: 'แก้รหัสเครื่องมือวัด'
  };

  return labels[action] || action || '-';
}

function getTopicNameFromAudit(log) {
  if (log.action === 'update_sampling_rules') {
    return 'จำนวนสุ่มตรวจ';
  }

  if (log.action === 'update_instrument_prefixes') {
    return 'รหัสเครื่องมือวัด';
  }

  const afterData = typeof log.afterData === 'object' && log.afterData ? log.afterData : null;
  const beforeData = typeof log.beforeData === 'object' && log.beforeData ? log.beforeData : null;

  return afterData?.topicName || beforeData?.topicName || `#${log.targetId || '-'}`;
}

function getSettingAreaLabel(area) {
  const labels = {
    dimension: 'ฟอร์มมิติ',
    packing: 'ฟอร์มบรรจุ',
    sampling_rules: 'จำนวนสุ่มตรวจ',
    dimension_instrument_prefixes: 'รหัสเครื่องมือวัด'
  };

  return labels[area] || area || '-';
}

function formatAuditDate(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('th-TH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getDraftText(draftCounts = {}) {
  return `มิติ ${draftCounts.dimensionDraftCount || 0} ใบ / บรรจุ ${draftCounts.packingDraftCount || 0} ใบ`;
}

function hasDrafts(draftCounts = {}) {
  return Boolean((draftCounts.dimensionDraftCount || 0) || (draftCounts.packingDraftCount || 0));
}

function renderTopicRows(topics = [], { isBlocked = false } = {}) {
  if (!topics.length) {
    return '<tr><td colspan="10">ยังไม่มีหัวข้อ</td></tr>';
  }

  return topics.map((topic) => `
    <tr
      class="${topic.isActive ? '' : 'inactive-row'}"
      data-topic-row
      data-topic-id="${escapeHtml(topic.id)}"
      data-topic-name="${escapeHtml(topic.topicName)}"
      data-active="${topic.isActive ? 'true' : 'false'}"
      data-original-order="${escapeHtml(topic.displayOrder)}"
      data-original-remark="${escapeHtml(topic.remark || '')}"
      data-input-type="${escapeHtml(topic.inputType)}"
      data-input-count="${escapeHtml(topic.inputCount)}"
      data-decimal-places="${escapeHtml(topic.decimalPlaces)}"
      data-measure-pieces="${escapeHtml(topic.measurePieces || 'all')}"
      data-rule-key="${escapeHtml(topic.ruleKey || '')}"
    >
      <td>
        <input
          class="small-number-input"
          type="number"
          min="1"
          max="9999"
          value="${escapeHtml(topic.displayOrder)}"
          data-topic-order
          ${topic.isActive && !isBlocked ? '' : 'disabled'}
        />
      </td>
      <td class="settings-topic-name-cell">
        <strong>${escapeHtml(topic.topicName)}</strong>
        ${topic.isActive ? '' : '<span class="status-pill muted">ปิดใช้งาน</span>'}
      </td>
      <td>${escapeHtml(getInputTypeLabel(topic.inputType))}</td>
      <td>${escapeHtml(topic.inputCount)}</td>
      <td>${escapeHtml(topic.decimalPlaces)}</td>
      <td>${escapeHtml(getMeasurePiecesLabel(topic.measurePieces))}</td>
      <td>
        <span class="settings-rule-pill ${topic.ruleKey ? '' : 'muted'}">
          ${escapeHtml(getRuleKeyLabel(topic.ruleKey))}
        </span>
      </td>
      <td>
        <input
          type="text"
          maxlength="300"
          value="${escapeHtml(topic.remark || '')}"
          data-topic-remark
          ${topic.isActive && !isBlocked ? '' : 'disabled'}
        />
      </td>
      <td>${topic.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}</td>
      <td class="settings-actions-cell">
        ${topic.isActive && isBlocked ? '<span class="status-pill muted">ล็อก</span>' : ''}
        ${topic.isActive && !isBlocked ? `
          <button class="danger-button small-button" type="button" data-topic-deactivate ${isBlocked ? 'disabled' : ''}>
            ปิดใช้งาน
          </button>
        ` : ''}
        ${topic.isActive ? '' : '-'}
      </td>
    </tr>
  `).join('');
}

function renderTopicCreateForm(formType, { isBlocked = false } = {}) {
  const isPacking = formType === 'packing';

  return `
    <form class="settings-topic-form" data-topic-create-form data-form-type="${escapeHtml(formType)}" data-blocked="${isBlocked ? 'true' : 'false'}">
      <div class="settings-form-grid">
        <label class="field">
          <span>ชื่อหัวข้อ</span>
          <input name="topicName" type="text" maxlength="120" required ${isBlocked ? 'disabled' : ''} />
          <small class="settings-warning" data-inactive-duplicate-warning hidden>มีชื่อเดียวกันในหัวข้อที่ปิดใช้งาน เพิ่มได้ แต่ควรตรวจชื่อให้ชัดเจน</small>
        </label>
        <label class="field">
          <span>ชนิดการประเมิน</span>
          <select name="inputType" ${isBlocked ? 'disabled' : ''}>
            <option value="number">ตัวเลข</option>
            <option value="pass_fail">ผ่าน / ไม่ผ่าน</option>
          </select>
        </label>
        <label class="field">
          <span>จำนวนช่องกรอก</span>
          <input name="inputCount" type="number" min="1" max="10" value="1" ${isPacking || isBlocked ? 'disabled' : ''} />
        </label>
        <label class="field">
          <span>จำนวนทศนิยม</span>
          <input name="decimalPlaces" type="number" min="0" max="4" value="0" ${isBlocked ? 'disabled' : ''} />
        </label>
        <label class="field">
          <span>ตรวจชิ้นที่</span>
          <select name="measurePiecesMode" ${isBlocked ? 'disabled' : ''}>
            <option value="all">ทุกชิ้น</option>
            <option value="first">เฉพาะชิ้นที่ 1</option>
            <option value="custom">ระบุเอง</option>
          </select>
        </label>
        <label class="field" data-custom-pieces-field hidden>
          <span>ระบุชิ้น เช่น 1,3,5 หรือ 1-5</span>
          <input name="measurePiecesCustom" type="text" maxlength="80" ${isBlocked ? 'disabled' : ''} />
        </label>
        <label class="field">
          <span>กฎพิเศษสำหรับหัวข้อ</span>
          <select name="ruleKey" ${isPacking || isBlocked ? 'disabled' : ''}>
            <option value="">ไม่มีเงื่อนไขพิเศษ</option>
            <option value="hole_inspection">ตรวจรูเจาะ/รูคว้าน</option>
          </select>
        </label>
        <label class="field">
          <span>หมายเหตุ</span>
          <input name="remark" type="text" maxlength="300" ${isBlocked ? 'disabled' : ''} />
        </label>
        <label class="field wide-field">
          <span>เหตุผลในการเพิ่มหัวข้อ</span>
          <input name="reason" type="text" maxlength="500" required ${isBlocked ? 'disabled' : ''} />
        </label>
      </div>
      <button class="primary-button" type="submit" ${isBlocked ? 'disabled' : ''}>พรีวิวหัวข้อใหม่</button>
      <div class="settings-preview-panel settings-create-preview-panel" data-topic-create-preview-panel hidden></div>
    </form>
  `;
}

function renderTopicPanel(title, formType, topics = [], draftCounts = {}, isActive = false) {
  const blocked = hasDrafts(draftCounts);

  return `
    <section class="settings-section" data-settings-panel="${escapeHtml(formType)}" ${isActive ? '' : 'hidden'}>
      <div class="compact-panel-heading">
        <div>
          <h2>${escapeHtml(title)}</h2>
          <p>เพิ่มหัวข้อใหม่ / แก้เฉพาะลำดับและหมายเหตุ / ปิดใช้งานเท่านั้น</p>
        </div>
        <span class="status-pill">${topics.filter((topic) => topic.isActive).length} active</span>
      </div>
      ${blocked ? `<p class="alert warning">ยังมี inspection draft ค้าง: ${escapeHtml(getDraftText(draftCounts))} กรุณาทำใบตรวจให้สมบูรณ์ก่อนแก้หัวข้อ</p>` : ''}
      ${blocked ? `
        <div class="settings-locked-panel">
          ปิดการเพิ่ม/แก้/ปิดใช้งานหัวข้อชั่วคราว เพราะยังมีใบตรวจ draft ค้าง
        </div>
      ` : renderTopicCreateForm(formType, { isBlocked: blocked })}
      <label class="settings-toggle">
        <input type="checkbox" data-show-inactive-toggle />
        <span>แสดงหัวข้อที่ปิดใช้งาน</span>
      </label>
      ${blocked ? '' : `
        <div class="settings-bulk-actions">
          <button class="secondary-button" type="button" data-topic-preview-save disabled>
            พรีวิวลำดับ/หมายเหตุ
          </button>
          <span class="settings-change-count" data-topic-change-count>ยังไม่มีการแก้ลำดับ/หมายเหตุ</span>
        </div>
      `}
      <div class="responsive-table-wrap">
        <table class="settings-table topic-management-table">
          <thead>
            <tr>
              <th>ลำดับ</th>
              <th>หัวข้อ</th>
              <th>ชนิด</th>
              <th>ช่อง</th>
              <th>ทศนิยม</th>
              <th>ตรวจชิ้นที่</th>
              <th>กฎพิเศษ</th>
              <th>หมายเหตุ</th>
              <th>สถานะ</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>${renderTopicRows(topics, { isBlocked: blocked })}</tbody>
        </table>
      </div>
      <div class="settings-preview-panel" data-topic-preview-panel hidden></div>
    </section>
  `;
}

function renderSamplingRules(rules = [], panelId, isActive = false, draftCounts = {}) {
  const blocked = hasDrafts(draftCounts);
  const rows = rules.length
    ? rules.map((rule, index) => `
      <tr data-sampling-rule-row>
        <td>
          <input class="small-number-input" type="number" min="1" max="999999999" value="${escapeHtml(rule.qtyMin)}" data-sampling-min ${blocked ? 'disabled' : ''} />
        </td>
        <td>
          <input
            class="small-number-input"
            type="number"
            min="1"
            max="999999999"
            value="${index === rules.length - 1 ? '' : escapeHtml(rule.qtyMax)}"
            placeholder="${index === rules.length - 1 ? 'ขึ้นไป' : ''}"
            data-sampling-max
            ${index === rules.length - 1 ? 'readonly title="แถวสุดท้ายเป็นขึ้นไป"' : ''}
            ${blocked ? 'disabled' : ''}
          />
        </td>
        <td>
          <input class="small-number-input" type="number" min="1" max="999999" value="${escapeHtml(rule.sampleCount)}" data-sampling-count ${blocked ? 'disabled' : ''} />
        </td>
      </tr>
    `).join('')
    : '';

  return `
    <section class="settings-section" data-settings-panel="${escapeHtml(panelId)}" ${isActive ? '' : 'hidden'}>
      <div class="compact-panel-heading">
        <div>
          <h2>จำนวนสุ่มตรวจ</h2>
          <p>แก้แบบบันทึกทั้งชุด แถวสุดท้ายเว้นจำนวนสิ้นสุดไว้เพื่อหมายถึง “ขึ้นไป”</p>
        </div>
      </div>
      ${blocked ? `<p class="alert warning">ยังมี inspection draft ค้าง: ${escapeHtml(getDraftText(draftCounts))} กรุณาทำใบตรวจให้สมบูรณ์ก่อนแก้จำนวนสุ่มตรวจ</p>` : ''}
      <form class="settings-edit-card" data-sampling-rules-form>
        ${rules.length ? `
        <div class="responsive-table-wrap settings-compact-table-wrap">
          <table class="settings-table">
            <thead>
              <tr>
                <th>จำนวนเริ่มต้น</th>
                <th>จำนวนสิ้นสุด</th>
                <th>สุ่มตรวจ</th>
              </tr>
            </thead>
            <tbody data-sampling-rules-body>${rows}</tbody>
          </table>
        </div>
        ` : `
        <div class="settings-empty-state" data-sampling-rules-body>
          <strong>ยังไม่มีกฎสุ่มตรวจ</strong>
          <span>กด “เพิ่มช่วง” เพื่อเริ่มกำหนดจำนวนเริ่มต้น จำนวนสิ้นสุด และจำนวนชิ้นสุ่มตรวจ</span>
        </div>
        `}
        <div class="settings-bulk-actions">
          <button class="secondary-button small-button" type="button" data-sampling-add-row ${blocked ? 'disabled' : ''}>เพิ่มช่วง</button>
          <button class="danger-button small-button settings-remove-button" type="button" data-sampling-remove-row ${blocked ? 'disabled' : ''}>ลบช่วงสุดท้าย</button>
        </div>
        <label class="field wide-field">
          <span>เหตุผลในการแก้จำนวนสุ่มตรวจ</span>
          <input name="reason" type="text" maxlength="500" required ${blocked ? 'disabled' : ''} />
        </label>
        <button class="primary-button" type="submit" ${blocked ? 'disabled' : ''}>บันทึกจำนวนสุ่มตรวจทั้งชุด</button>
      </form>
    </section>
  `;
}

function renderInstrumentPrefixes(prefixes = [], panelId, isActive = false, draftCounts = {}) {
  const blocked = hasDrafts(draftCounts);
  const rows = Array.from({ length: 5 }, (_, index) => prefixes[index] || { slotNo: index + 1, prefix: '' })
    .map((item, index) => `
      <label class="settings-prefix-card">
        <span>เครื่องมือ ${escapeHtml(item.slotNo || index + 1)}</span>
        <div>
          <input type="text" maxlength="20" value="${escapeHtml(item.prefix || '')}" placeholder="A-02-" data-instrument-prefix ${blocked ? 'disabled' : ''} />
          <small>รูปแบบ A-00-</small>
        </div>
      </label>
    `).join('');

  return `
    <section class="settings-section" data-settings-panel="${escapeHtml(panelId)}" ${isActive ? '' : 'hidden'}>
      <div class="compact-panel-heading">
        <div>
          <h2>รหัสเครื่องมือวัด</h2>
          <p>กำหนด prefix 5 ช่อง เช่น A-02- และ QC ยังกรอกรหัสเต็ม เช่น A-02-123</p>
        </div>
      </div>
      ${blocked ? `<p class="alert warning">ยังมี inspection draft ค้าง: ${escapeHtml(getDraftText(draftCounts))} กรุณาทำใบตรวจให้สมบูรณ์ก่อนแก้รหัสเครื่องมือวัด</p>` : ''}
      <form class="settings-edit-card" data-instrument-prefix-form>
        <div class="settings-prefix-grid">
          ${rows}
        </div>
        <label class="field wide-field">
          <span>เหตุผลในการแก้รหัสเครื่องมือวัด</span>
          <input name="reason" type="text" maxlength="500" required ${blocked ? 'disabled' : ''} />
        </label>
        <button class="primary-button" type="submit" ${blocked ? 'disabled' : ''}>บันทึกรหัสเครื่องมือวัด</button>
      </form>
    </section>
  `;
}

function renderAuditLogs(logs = [], panelId, isActive = false) {
  const items = logs.length
    ? logs.map((log) => `
      <article class="settings-audit-card">
        <div class="settings-audit-main">
          <div class="settings-audit-title-row">
            <strong>${escapeHtml(getTopicNameFromAudit(log))}</strong>
            <span class="settings-audit-action">${escapeHtml(getActionLabel(log.action))}</span>
          </div>
          <div class="settings-audit-meta">
            <span>${escapeHtml(formatAuditDate(log.createdAt))}</span>
            <span>${escapeHtml(log.actorName || '-')}</span>
            <span>${escapeHtml(getSettingAreaLabel(log.settingArea))}</span>
          </div>
        </div>
        <div class="settings-audit-reason">
          <span>เหตุผล</span>
          <strong>${escapeHtml(log.reason || '-')}</strong>
        </div>
      </article>
    `).join('')
    : '';

  return `
    <section class="settings-section" data-settings-panel="${escapeHtml(panelId)}" ${isActive ? '' : 'hidden'}>
      <div class="compact-panel-heading">
        <div>
          <h2>ประวัติการตั้งค่า</h2>
          <p>แสดงสรุปอ่านง่าย ส่วน backend เก็บ before_data / after_data เต็ม</p>
        </div>
      </div>
      ${logs.length ? `
        <div class="settings-audit-list">
          ${items}
        </div>
      ` : `
        <div class="settings-empty-state">
          <strong>ยังไม่มีประวัติการตั้งค่า</strong>
          <span>เมื่อมีการเพิ่ม/ปิดหัวข้อ หรือแก้จำนวนสุ่มตรวจ/รหัสเครื่องมือวัด ระบบจะแสดงประวัติที่นี่</span>
        </div>
      `}
    </section>
  `;
}

export function renderSystemSettingsPage({
  settings = null,
  error = '',
  message = '',
  isLoading = false,
  isSaving = false
}) {
  const formTopics = settings?.formTopics || { dimension: [], packing: [] };
  const draftCounts = settings?.draftCounts || { dimensionDraftCount: 0, packingDraftCount: 0 };

  return `
    <section class="settings-page ${isSaving ? 'is-saving' : ''}">
      ${error ? `<p class="alert error">${escapeHtml(error)}</p>` : ''}
      ${message ? `<p class="alert success">${escapeHtml(message)}</p>` : ''}
      ${isLoading ? '<p class="alert">กำลังโหลดตั้งค่าระบบ...</p>' : ''}
      <div class="import-tabs settings-tabs" role="tablist" aria-label="ตั้งค่าระบบ">
        <button class="active" type="button" data-settings-tab="dimension">หัวข้อฟอร์มตรวจมิติ</button>
        <button type="button" data-settings-tab="packing">หัวข้อฟอร์มตรวจบรรจุ</button>
        <button type="button" data-settings-tab="sampling">จำนวนสุ่มตรวจ</button>
        <button type="button" data-settings-tab="instruments">รหัสเครื่องมือวัด</button>
        <button type="button" data-settings-tab="history">ประวัติการตั้งค่า</button>
      </div>
      ${renderTopicPanel('หัวข้อฟอร์มตรวจมิติ', 'dimension', formTopics.dimension, draftCounts, true)}
      ${renderTopicPanel('หัวข้อฟอร์มตรวจบรรจุ', 'packing', formTopics.packing, draftCounts)}
      ${renderSamplingRules(settings?.samplingRules || [], 'sampling', false, draftCounts)}
      ${renderInstrumentPrefixes(settings?.instrumentPrefixes || [], 'instruments', false, draftCounts)}
      ${renderAuditLogs(settings?.auditLogs || [], 'history')}
    </section>
  `;
}

function getCreateFormValues(form) {
  const formData = new FormData(form);
  const measureMode = String(formData.get('measurePiecesMode') || 'all');

  return {
    formType: form.dataset.formType,
    topicName: String(formData.get('topicName') || '').trim(),
    inputType: String(formData.get('inputType') || ''),
    inputCount: Number(formData.get('inputCount') || 1),
    decimalPlaces: Number(formData.get('decimalPlaces') || 0),
    measurePieces: measureMode === 'custom'
      ? String(formData.get('measurePiecesCustom') || '').trim()
      : measureMode,
    ruleKey: String(formData.get('ruleKey') || ''),
    remark: String(formData.get('remark') || '').trim(),
    reason: String(formData.get('reason') || '').trim()
  };
}

function refreshCreateFormState(form) {
  if (form.dataset.blocked === 'true') {
    return;
  }

  const formType = form.dataset.formType;
  const inputType = form.querySelector('[name="inputType"]')?.value;
  const inputCount = form.querySelector('[name="inputCount"]');
  const decimalPlaces = form.querySelector('[name="decimalPlaces"]');
  const measureMode = form.querySelector('[name="measurePiecesMode"]')?.value;
  const customPiecesField = form.querySelector('[data-custom-pieces-field]');

  if (inputCount) {
    inputCount.disabled = formType === 'packing' || inputType === 'pass_fail';
    if (inputCount.disabled) {
      inputCount.value = '1';
    }
  }

  if (decimalPlaces && inputType === 'pass_fail') {
    decimalPlaces.value = '0';
    decimalPlaces.disabled = true;
  } else if (decimalPlaces) {
    decimalPlaces.disabled = false;
  }

  if (customPiecesField) {
    customPiecesField.hidden = measureMode !== 'custom';
  }
}

function updateInactiveDuplicateWarning(form) {
  const input = form.querySelector('[name="topicName"]');
  const warning = form.querySelector('[data-inactive-duplicate-warning]');
  const panel = form.closest('[data-settings-panel]');
  const name = String(input?.value || '').trim().toLowerCase();

  if (!warning || !panel || !name) {
    if (warning) {
      warning.hidden = true;
    }
    return;
  }

  const hasInactiveDuplicate = Array.from(panel.querySelectorAll('[data-topic-row][data-active="false"]'))
    .some((row) => String(row.dataset.topicName || '').trim().toLowerCase() === name);

  warning.hidden = !hasInactiveDuplicate;
}

function getTopicRowValues(row) {
  return {
    topicId: row.dataset.topicId,
    topicName: row.dataset.topicName || '',
    inputType: row.dataset.inputType || 'pass_fail',
    inputCount: Number(row.dataset.inputCount || 1),
    decimalPlaces: Number(row.dataset.decimalPlaces || 0),
    measurePieces: row.dataset.measurePieces || 'all',
    ruleKey: row.dataset.ruleKey || '',
    originalOrder: Number(row.dataset.originalOrder || 0),
    originalRemark: row.dataset.originalRemark || '',
    displayOrder: Number(row.querySelector('[data-topic-order]')?.value || 0),
    remark: String(row.querySelector('[data-topic-remark]')?.value || '').trim()
  };
}

function collectTopicChanges(panel) {
  const changes = [];

  for (const row of panel.querySelectorAll('[data-topic-row][data-active="true"]')) {
    const values = getTopicRowValues(row);

    if (!Number.isInteger(values.displayOrder) || values.displayOrder < 1 || values.displayOrder > 9999) {
      throw new Error('ลำดับต้องเป็นตัวเลข 1-9999');
    }

    if (values.displayOrder !== values.originalOrder || values.remark !== values.originalRemark) {
      changes.push(values);
    }
  }

  return changes;
}

function collectPreviewTopics(panel) {
  return Array.from(panel.querySelectorAll('[data-topic-row][data-active="true"]'))
    .map(getTopicRowValues)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.topicName.localeCompare(b.topicName, 'th'));
}

function renderPreviewInput(topic, inputIndex = 0) {
  if (topic.inputType === 'number') {
    const label = topic.inputCount > 1 ? `ช่อง ${inputIndex + 1}` : 'ตัวเลข';
    return `<input type="text" value="" placeholder="${escapeHtml(label)}" disabled />`;
  }

  return `
    <div class="settings-preview-passfail">
      <button type="button" disabled>ผ่าน</button>
      <button type="button" disabled>ไม่ผ่าน</button>
    </div>
  `;
}

function renderPreviewTopicCell(topic) {
  const count = Math.max(1, Math.min(Number(topic.inputCount || 1), 10));
  const inputs = Array.from({ length: count }, (_, index) => renderPreviewInput(topic, index)).join('');
  const ruleLabel = topic.ruleKey ? ` / ${getRuleKeyLabel(topic.ruleKey)}` : '';

  return `
    <div class="settings-preview-topic-cell">
      <strong>${escapeHtml(topic.topicName)}</strong>
      <small>${escapeHtml(getInputTypeLabel(topic.inputType))} / ${escapeHtml(getMeasurePiecesLabel(topic.measurePieces))}${escapeHtml(ruleLabel)}</small>
      <div class="settings-preview-inputs">${inputs}</div>
    </div>
  `;
}

function renderCreateTopicPreview(form, values) {
  const previewPanel = form.querySelector('[data-topic-create-preview-panel]');

  if (!previewPanel) {
    return;
  }

  previewPanel.hidden = false;
  previewPanel.innerHTML = `
    <div class="settings-preview-header">
      <div>
        <h3>พรีวิวหัวข้อใหม่</h3>
        <p>ยังไม่บันทึกจริงจนกด “ยืนยันเพิ่มหัวข้อ”</p>
      </div>
      <button class="secondary-button small-button" type="button" data-topic-create-preview-cancel>ปิดพรีวิว</button>
    </div>
    <div class="settings-preview-summary">
      <strong>ข้อมูลที่จะเพิ่ม</strong>
      <ul>
        <li>หัวข้อ: ${escapeHtml(values.topicName)}</li>
        <li>ชนิด: ${escapeHtml(getInputTypeLabel(values.inputType))}</li>
        <li>ตรวจชิ้นที่: ${escapeHtml(getMeasurePiecesLabel(values.measurePieces))}</li>
        <li>กฎพิเศษ: ${escapeHtml(getRuleKeyLabel(values.ruleKey))}</li>
        <li>เหตุผล: ${escapeHtml(values.reason)}</li>
      </ul>
    </div>
    <div class="settings-preview-form">
      <div class="settings-preview-form-title">ตัวอย่างช่องกรอกของหัวข้อใหม่</div>
      <div class="settings-preview-topic-grid">
        ${renderPreviewTopicCell({
          topicName: values.topicName,
          inputType: values.inputType,
          inputCount: values.inputCount,
          decimalPlaces: values.decimalPlaces,
          measurePieces: values.measurePieces,
          ruleKey: values.ruleKey
        })}
      </div>
    </div>
    <div class="settings-preview-actions">
      <button class="primary-button" type="button" data-topic-create-preview-confirm>ยืนยันเพิ่มหัวข้อ</button>
    </div>
  `;
}

function renderTopicPreview(panel, changes) {
  const previewPanel = panel.querySelector('[data-topic-preview-panel]');
  const topics = collectPreviewTopics(panel);
  const changeRows = changes.map((change) => `
    <li>
      ${escapeHtml(change.topicName)}:
      ลำดับ ${escapeHtml(change.originalOrder)} → ${escapeHtml(change.displayOrder)}
      ${change.remark !== change.originalRemark ? ' / หมายเหตุเปลี่ยน' : ''}
    </li>
  `).join('');
  const topicCells = topics.map(renderPreviewTopicCell).join('');

  if (!previewPanel) {
    return;
  }

  previewPanel.hidden = false;
  previewPanel.innerHTML = `
    <div class="settings-preview-header">
      <div>
        <h3>พรีวิวฟอร์มก่อนบันทึก</h3>
        <p>ตัวอย่างนี้ใช้ดูภาพรวมเท่านั้น ยังไม่บันทึกจริงจนกด “ยืนยันบันทึก”</p>
      </div>
      <button class="secondary-button small-button" type="button" data-topic-preview-cancel>ปิดพรีวิว</button>
    </div>
    <div class="settings-preview-summary">
      <strong>รายการที่จะบันทึก ${changes.length} หัวข้อ</strong>
      <ul>${changeRows}</ul>
    </div>
    <div class="settings-preview-form">
      <div class="settings-preview-form-title">ตัวอย่างหน้าฟอร์มตรวจ</div>
      <div class="settings-preview-topic-grid">${topicCells}</div>
    </div>
    <div class="settings-preview-actions">
      <button class="primary-button" type="button" data-topic-preview-confirm>ยืนยันบันทึก</button>
    </div>
  `;
}

function refreshTopicChangeState(panel) {
  const button = panel.querySelector('[data-topic-preview-save]');
  const countLabel = panel.querySelector('[data-topic-change-count]');

  if (!button || !countLabel) {
    return;
  }

  try {
    const changes = collectTopicChanges(panel);
    button.disabled = changes.length === 0;
    countLabel.textContent = changes.length
      ? `มีรายการที่แก้ไข ${changes.length} หัวข้อ`
      : 'ยังไม่มีการแก้ลำดับ/หมายเหตุ';
  } catch (error) {
    button.disabled = true;
    countLabel.textContent = error.message;
  }
}

function activateSettingsTab(activeTab = 'dimension') {
  document.querySelectorAll('[data-settings-tab]').forEach((tabButton) => {
    tabButton.classList.toggle('active', tabButton.dataset.settingsTab === activeTab);
  });

  document.querySelectorAll('[data-settings-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.settingsPanel !== activeTab;
  });
}

function createSamplingRuleRowHtml({ qtyMin = '', qtyMax = '', sampleCount = '' } = {}) {
  return `
    <tr data-sampling-rule-row>
      <td><input class="small-number-input" type="number" min="1" max="999999999" value="${escapeHtml(qtyMin)}" data-sampling-min /></td>
      <td><input class="small-number-input" type="number" min="1" max="999999999" value="${escapeHtml(qtyMax)}" data-sampling-max /></td>
      <td><input class="small-number-input" type="number" min="1" max="999999" value="${escapeHtml(sampleCount)}" data-sampling-count /></td>
    </tr>
  `;
}

function createSamplingRulesTableHtml() {
  return `
    <div class="responsive-table-wrap settings-compact-table-wrap">
      <table class="settings-table">
        <thead>
          <tr>
            <th>จำนวนเริ่มต้น</th>
            <th>จำนวนสิ้นสุด</th>
            <th>สุ่มตรวจ</th>
          </tr>
        </thead>
        <tbody data-sampling-rules-body></tbody>
      </table>
    </div>
  `;
}

function refreshSamplingPlaceholders(form) {
  const rows = Array.from(form.querySelectorAll('[data-sampling-rule-row]'));

  rows.forEach((row, index) => {
    const maxInput = row.querySelector('[data-sampling-max]');
    if (maxInput) {
      const isLast = index === rows.length - 1;
      maxInput.placeholder = isLast ? 'ขึ้นไป' : '';
      maxInput.readOnly = isLast;
      maxInput.title = isLast ? 'แถวสุดท้ายเป็นขึ้นไป' : '';
      maxInput.classList.toggle('readonly-input', isLast);

      if (isLast) {
        maxInput.value = '';
      }
    }
  });
}

function collectSamplingRules(form) {
  const rules = Array.from(form.querySelectorAll('[data-sampling-rule-row]')).map((row, index, rows) => ({
    qtyMin: Number(row.querySelector('[data-sampling-min]')?.value || 0),
    qtyMax: index === rows.length - 1
      ? null
      : Number(row.querySelector('[data-sampling-max]')?.value || 0),
    sampleCount: Number(row.querySelector('[data-sampling-count]')?.value || 0)
  }));
  const reason = String(new FormData(form).get('reason') || '').trim();

  if (!reason) {
    throw new Error('กรุณาระบุเหตุผลในการแก้จำนวนสุ่มตรวจ');
  }

  return { rules, reason };
}

function collectInstrumentPrefixes(form) {
  const prefixes = Array.from(form.querySelectorAll('[data-instrument-prefix]'))
    .map((input) => String(input.value || '').trim());
  const reason = String(new FormData(form).get('reason') || '').trim();

  if (prefixes.length !== 5 || prefixes.some((prefix) => !/^A-\d{2}-$/.test(prefix))) {
    throw new Error('prefix เครื่องมือวัดต้องมี 5 ช่อง และอยู่ในรูปแบบ A-00- เช่น A-02-');
  }

  if (!reason) {
    throw new Error('กรุณาระบุเหตุผลในการแก้รหัสเครื่องมือวัด');
  }

  return { prefixes, reason };
}

export function bindSystemSettingsPage({
  activeTab = 'dimension',
  onTabChange = () => {},
  onCreateTopic = () => {},
  onUpdateTopic = () => {},
  onUpdateTopics = () => {},
  onDeactivateTopic = () => {},
  onUpdateSamplingRules = () => {},
  onUpdateInstrumentPrefixes = () => {}
} = {}) {
  activateSettingsTab(activeTab);

  document.querySelectorAll('[data-settings-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      const activeTab = button.dataset.settingsTab;

      activateSettingsTab(activeTab);
      onTabChange(activeTab);
    });
  });

  document.querySelectorAll('[data-show-inactive-toggle]').forEach((toggle) => {
    toggle.addEventListener('change', () => {
      toggle.closest('[data-settings-panel]')?.classList.toggle('show-inactive', toggle.checked);
    });
  });

  document.querySelectorAll('[data-settings-panel]').forEach((panel) => {
    refreshTopicChangeState(panel);

    panel.querySelectorAll('[data-topic-order], [data-topic-remark]').forEach((input) => {
      input.addEventListener('input', () => {
        refreshTopicChangeState(panel);
        const previewPanel = panel.querySelector('[data-topic-preview-panel]');
        if (previewPanel) {
          previewPanel.hidden = true;
          previewPanel.innerHTML = '';
        }
      });
    });

    panel.querySelector('[data-topic-preview-save]')?.addEventListener('click', () => {
      let changes = [];

      try {
        changes = collectTopicChanges(panel);
      } catch (error) {
        window.alert(error.message);
        refreshTopicChangeState(panel);
        return;
      }

      if (!changes.length) {
        window.alert('ยังไม่มีการแก้ลำดับ/หมายเหตุ');
        refreshTopicChangeState(panel);
        return;
      }

      renderTopicPreview(panel, changes);
    });

    panel.querySelector('[data-topic-preview-panel]')?.addEventListener('click', (event) => {
      const previewPanel = event.currentTarget;

      if (event.target.closest('[data-topic-preview-cancel]')) {
        previewPanel.hidden = true;
        previewPanel.innerHTML = '';
        return;
      }

      if (event.target.closest('[data-topic-preview-confirm]')) {
        let changes = [];

        try {
          changes = collectTopicChanges(panel);
        } catch (error) {
          window.alert(error.message);
          refreshTopicChangeState(panel);
          return;
        }

        if (changes.length) {
          onUpdateTopics(changes.map((change) => ({
            topicId: change.topicId,
            displayOrder: change.displayOrder,
            remark: change.remark
          })));
        }
      }
    });
  });

  document.querySelectorAll('[data-topic-create-form]').forEach((form) => {
    refreshCreateFormState(form);
    updateInactiveDuplicateWarning(form);

    form.addEventListener('input', () => {
      refreshCreateFormState(form);
      updateInactiveDuplicateWarning(form);
      const previewPanel = form.querySelector('[data-topic-create-preview-panel]');
      if (previewPanel) {
        previewPanel.hidden = true;
        previewPanel.innerHTML = '';
      }
    });
    form.addEventListener('change', () => {
      refreshCreateFormState(form);
      updateInactiveDuplicateWarning(form);
      const previewPanel = form.querySelector('[data-topic-create-preview-panel]');
      if (previewPanel) {
        previewPanel.hidden = true;
        previewPanel.innerHTML = '';
      }
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      renderCreateTopicPreview(form, getCreateFormValues(form));
    });

    form.querySelector('[data-topic-create-preview-panel]')?.addEventListener('click', (event) => {
      const previewPanel = event.currentTarget;

      if (event.target.closest('[data-topic-create-preview-cancel]')) {
        previewPanel.hidden = true;
        previewPanel.innerHTML = '';
        return;
      }

      if (event.target.closest('[data-topic-create-preview-confirm]')) {
        onCreateTopic(getCreateFormValues(form));
      }
    });
  });

  document.querySelectorAll('[data-topic-update]').forEach((button) => {
    button.addEventListener('click', () => {
      const row = button.closest('[data-topic-row]');

      if (!row) {
        return;
      }

      onUpdateTopic(row.dataset.topicId, {
        displayOrder: Number(row.querySelector('[data-topic-order]')?.value || 0),
        remark: String(row.querySelector('[data-topic-remark]')?.value || '').trim()
      });
    });
  });

  document.querySelectorAll('[data-topic-deactivate]').forEach((button) => {
    button.addEventListener('click', () => {
      const row = button.closest('[data-topic-row]');
      const topicName = row?.dataset.topicName || '';
      const reason = window.prompt(`กรุณาระบุเหตุผลในการปิดใช้งานหัวข้อ: ${topicName}`);

      if (!row || !String(reason || '').trim()) {
        return;
      }

      onDeactivateTopic(row.dataset.topicId, { reason: String(reason).trim() });
    });
  });

  document.querySelectorAll('[data-sampling-rules-form]').forEach((form) => {
    refreshSamplingPlaceholders(form);

    form.querySelector('[data-sampling-add-row]')?.addEventListener('click', () => {
      let body = form.querySelector('[data-sampling-rules-body]');
      if (!body) {
        return;
      }

      if (!body.tagName || body.tagName.toLowerCase() !== 'tbody') {
        body.insertAdjacentHTML('beforebegin', createSamplingRulesTableHtml());
        body.remove();
        body = form.querySelector('[data-sampling-rules-body]');
      }

      body.insertAdjacentHTML('beforeend', createSamplingRuleRowHtml());
      refreshSamplingPlaceholders(form);
    });

    form.querySelector('[data-sampling-remove-row]')?.addEventListener('click', () => {
      const rows = form.querySelectorAll('[data-sampling-rule-row]');
      if (rows.length <= 1) {
        window.alert('ต้องมีช่วงสุ่มตรวจอย่างน้อย 1 แถว');
        return;
      }

      rows[rows.length - 1].remove();
      refreshSamplingPlaceholders(form);
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      try {
        onUpdateSamplingRules(collectSamplingRules(form));
      } catch (error) {
        window.alert(error.message);
      }
    });
  });

  document.querySelectorAll('[data-instrument-prefix-form]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();

      try {
        onUpdateInstrumentPrefixes(collectInstrumentPrefixes(form));
      } catch (error) {
        window.alert(error.message);
      }
    });
  });
}
