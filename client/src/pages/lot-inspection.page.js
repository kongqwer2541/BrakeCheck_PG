const lotHeaderColumns = [
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

const defaultSamplingRanges = [
  { min: 2, max: 100, sampleCount: 2, label: '2 - 100' },
  { min: 101, max: 500, sampleCount: 3, label: '101 - 500' },
  { min: 501, max: 1200, sampleCount: 5, label: '501 - 1200' },
  { min: 1201, max: null, sampleCount: 8, label: '>= 1201' }
];
const defaultInstrumentPrefixes = ['A-01-', 'A-01-', 'A-07-', 'A-01-', 'A-01-'];
const dimensionFinalResultTopicNames = new Set([
  'สรุปผลการตรวจ',
  'final result'
]);

let activeSamplingRanges = defaultSamplingRanges;
let activeInstrumentPrefixes = defaultInstrumentPrefixes;

function normalizeSamplingRanges(rules = []) {
  if (!Array.isArray(rules) || !rules.length) {
    return defaultSamplingRanges;
  }

  const ranges = rules.map((rule) => {
    const min = Number(rule.qtyMin || 0);
    const max = rule.qtyMax === null || rule.qtyMax === undefined ? null : Number(rule.qtyMax);
    const sampleCount = Number(rule.sampleCount || 0);

    return {
      min,
      max,
      sampleCount,
      label: max === null ? `${min} ขึ้นไป` : `${min} - ${max}`
    };
  });

  return ranges.every((range) => range.min > 0 && range.sampleCount > 0)
    ? ranges
    : defaultSamplingRanges;
}

function normalizeInstrumentPrefixes(prefixes = []) {
  if (!Array.isArray(prefixes) || prefixes.length !== 5) {
    return defaultInstrumentPrefixes;
  }

  const values = prefixes.map((item) => String(item?.prefix || '').trim());

  return values.every((prefix) => /^A-\d{2}-$/.test(prefix))
    ? values
    : defaultInstrumentPrefixes;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function requiresDimensionInspectionNote(piecesData) {
  const topics = Array.isArray(piecesData?.topics) ? piecesData.topics : [];
  const hasFailResult = Boolean(piecesData?.meta?.ngStop) || topics.some((topic) => (
    Array.isArray(topic?.rows)
    && topic.rows.some((row) => (
      Array.isArray(row?.values)
      && row.values.some((value) => value === 'fail')
    ))
  ));
  const inspectionNote = String(piecesData?.meta?.inspectionNote || '').trim();

  return hasFailResult && !inspectionNote;
}

export function sortMeasurementInputsByInspectionOrder(inputs = []) {
  return Array.from(inputs)
    .map((input, originalIndex) => ({ input, originalIndex }))
    .sort((left, right) => {
      const leftInput = left.input;
      const rightInput = right.input;
      const leftTypeOrder = leftInput.dataset.inputType === 'pass_fail' ? 1 : 0;
      const rightTypeOrder = rightInput.dataset.inputType === 'pass_fail' ? 1 : 0;

      return leftTypeOrder - rightTypeOrder
        || Number(leftInput.dataset.topicIndex || 0) - Number(rightInput.dataset.topicIndex || 0)
        || Number(leftInput.dataset.pieceNo || 0) - Number(rightInput.dataset.pieceNo || 0)
        || Number(leftInput.dataset.inputIndex || 0) - Number(rightInput.dataset.inputIndex || 0)
        || left.originalIndex - right.originalIndex;
    })
    .map(({ input }) => input);
}

export function getRequiredMissingMeasurementInputs(inputs = [], {
  ngStopTopicId = '',
  finalResultTopicKey = ''
} = {}) {
  const orderedInputs = sortMeasurementInputsByInspectionOrder(inputs);
  const topicGroups = [];

  orderedInputs.forEach((input) => {
    const topicKey = String(input?.dataset?.topicKey || '');
    let group = topicGroups.find((item) => item.topicKey === topicKey);

    if (!group) {
      group = { topicKey, inputs: [] };
      topicGroups.push(group);
    }

    group.inputs.push(input);
  });

  const ngTopicIndex = topicGroups.findIndex(
    (group) => group.topicKey === String(ngStopTopicId || '')
  );

  return topicGroups.flatMap((group, topicIndex) => {
    const missingInputs = group.inputs.filter((input) => {
      const value = String(input?.value || '').trim();
      return !value || value === '-';
    });

    if (ngTopicIndex < 0) {
      return missingInputs;
    }

    if (
      topicIndex <= ngTopicIndex
      || group.topicKey === String(finalResultTopicKey || '')
    ) {
      return missingInputs;
    }

    const hasStartedTopic = group.inputs.some((input) => {
      const value = String(input?.value || '').trim();
      return value && value !== '-';
    });

    return hasStartedTopic ? missingInputs : [];
  });
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

function getApprovalAction(lot) {
  if (lot?.status === 'waiting_approve') {
    return {
      primary: { action: 'approve', label: 'อนุมัติ', needsReason: false },
      secondary: { action: 'send_back', label: 'ส่งกลับแก้ไข', needsReason: true }
    };
  }

  if (lot?.status === 'approved') {
    return {
      primary: { action: 'cancel_approve', label: 'ยกเลิกอนุมัติ', needsReason: true }
    };
  }

  if (lot?.status === 'ng') {
    return {
      primary: { action: 'confirm_ng', label: 'รับทราบ NG', needsReason: false },
      secondary: { action: 'review_ng', label: 'ทบทวน NG', needsReason: true }
    };
  }

  return null;
}

function renderApprovalEvidenceItem(label, evidence) {
  if (!evidence) {
    return '';
  }

  return `
    <div class="approval-evidence-item">
      <strong>${escapeHtml(label)}</strong>
      <span>${escapeHtml(evidence.actorName || '-')}</span>
      <span>${escapeHtml(evidence.actorPosition || '-')}</span>
      <span>${escapeHtml(formatInspectionDateTime(evidence.createdAt))}</span>
      ${evidence.reason ? `<span>หมายเหตุ: ${escapeHtml(evidence.reason)}</span>` : ''}
    </div>
  `;
}

function renderApprovalEvidence(lot) {
  const evidence = lot?.approvalEvidence || {};

  if (lot?.status === 'approved' && evidence.approved) {
    return `
      <div class="approval-evidence-list">
        ${renderApprovalEvidenceItem('อนุมัติโดย', evidence.approved)}
      </div>
    `;
  }

  if (lot?.status === 'approved') {
    return `
      <div class="approval-evidence-list">
        <span>อนุมัติแล้ว แต่ไม่พบข้อมูลผู้อนุมัติใน audit log</span>
      </div>
    `;
  }

  if (lot?.status === 'ng') {
    return `
      <div class="approval-evidence-list">
        ${evidence.ngConfirmed
          ? renderApprovalEvidenceItem('รับทราบ NG โดย', evidence.ngConfirmed)
          : '<span>ยังไม่มีผู้รับทราบ NG</span>'}
      </div>
    `;
  }

  return '';
}

function renderApprovalReviewPanel({ lot, userRole, isSaving, isReadOnly = false }) {
  if (isReadOnly) {
    return renderApprovalEvidence(lot)
      ? `<section class="approval-review-panel"><div>${renderApprovalEvidence(lot)}</div></section>`
      : '';
  }

  if (!['head', 'assistant'].includes(userRole)) {
    return '';
  }

  const actions = getApprovalAction(lot);

  if (!actions) {
    return '';
  }

  const buttons = [actions.primary, actions.secondary].filter(Boolean).map((item) => `
    <button
      class="${item.action === 'approve' ? 'primary-button' : 'secondary-button'} small-button"
      type="button"
      data-approval-action="${escapeHtml(item.action)}"
      data-needs-reason="${item.needsReason ? 'true' : 'false'}"
      ${isSaving ? 'disabled aria-disabled="true"' : ''}
    >
      ${escapeHtml(item.label)}
    </button>
  `).join('');

  return `
    <section class="approval-review-panel">
      <div>
        <strong>ตรวจและอนุมัติ</strong>
        <span>สถานะปัจจุบัน: ${escapeHtml(lot?.statusLabel || lot?.status || '-')}</span>
        ${renderApprovalEvidence(lot)}
      </div>
      <div class="approval-review-actions">
        ${buttons}
      </div>
      <div class="approval-reason-row" data-approval-reason-row hidden>
        <label>
          หมายเหตุ
          <textarea name="approvalReason" maxlength="500" rows="2" placeholder="กรุณาระบุหมายเหตุ"></textarea>
        </label>
        <button class="primary-button small-button" type="button" data-confirm-approval-action ${isSaving ? 'disabled aria-disabled="true"' : ''}>บันทึก</button>
      </div>
      <p class="support-text" data-approval-inline-error hidden></p>
    </section>
  `;
}

function renderLotHeader(lot) {
  const lotPackText = lot.lotPackBarcode || '-';
  const lotNumberText = lot.lotNumber || '-';

  return `
    <section class="management-panel wide-panel lot-inspection-panel">
      <div class="compact-panel-heading">
        <div>
          <h2>Lot Pack ${escapeHtml(lotPackText)}</h2>
          <p>Lot ${escapeHtml(lotNumberText)} / ${escapeHtml(lot.modelName || '-')}${lot.code ? ` / ${escapeHtml(lot.code)}` : ''}</p>
        </div>
        <span class="lot-status ${getStatusClass(lot.status)}">
          ${escapeHtml(lot.statusLabel || lot.status || '-')}
        </span>
      </div>

      <dl class="lot-summary-grid inspection-summary-grid">
        ${lotHeaderColumns.map((column) => `
          <div>
            <dt>${escapeHtml(column.label)}</dt>
            <dd>${escapeHtml(lot[column.key] || '-')}</dd>
          </div>
        `).join('')}
      </dl>
    </section>
  `;
}

function formatAttachmentSize(size) {
  const bytes = Number(size || 0);

  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '-';
  }

  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function renderLotAttachmentsPanel({
  attachments = [],
  userRole = '',
  attachmentError = '',
  isAttachmentUploading = false,
  isReadOnly = false
} = {}) {
  const canManageAttachments = ['head', 'assistant'].includes(userRole) && !isReadOnly;
  const safeAttachments = Array.isArray(attachments) ? attachments : [];
  const listHtml = safeAttachments.length
    ? safeAttachments.map((attachment) => `
      <div class="lot-attachment-row">
        <div>
          <strong>${escapeHtml(attachment.originalName || '-')}</strong>
          <span>${escapeHtml(formatAttachmentSize(attachment.fileSize))} · ${escapeHtml(formatInspectionDateTime(attachment.uploadedAt))}</span>
        </div>
        <div class="lot-attachment-actions">
          <button
            class="secondary-button small-button"
            type="button"
            data-download-attachment-id="${escapeHtml(attachment.id)}"
            data-download-attachment-name="${escapeHtml(attachment.originalName || 'attachment')}"
          >
            ดาวน์โหลด
          </button>
          ${canManageAttachments ? `
            <button
              class="secondary-button danger-button small-button"
              type="button"
              data-delete-attachment-id="${escapeHtml(attachment.id)}"
              ${isAttachmentUploading ? 'disabled aria-disabled="true"' : ''}
            >
              ลบ
            </button>
          ` : ''}
        </div>
      </div>
    `).join('')
    : '<p class="support-text">ยังไม่มีไฟล์แนบสำหรับ Lot นี้</p>';

  return `
    <section class="management-panel wide-panel lot-attachments-panel">
      <div class="compact-panel-heading">
        <div>
          <h2>ไฟล์แนบ Lot</h2>
          <p>รองรับรูปภาพและ PDF ผูกกับ Lot นี้</p>
        </div>
        <span class="pill-count">${safeAttachments.length} ไฟล์</span>
      </div>
      ${attachmentError ? `<p class="alert error">${escapeHtml(attachmentError)}</p>` : ''}
      <div class="lot-attachment-list">
        ${listHtml}
      </div>
    </section>
  `;
}

function renderAttachmentActionControls({ userRole = '', isAttachmentUploading = false, isReadOnly = false } = {}) {
  if (isReadOnly) {
    return '';
  }

  if (!['head', 'assistant', 'officer'].includes(userRole)) {
    return '';
  }

  return `
    <div class="attachment-action-controls">
      <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" data-attachment-file ${isAttachmentUploading ? 'disabled aria-disabled="true"' : ''} />
      <button class="secondary-button small-button attachment-upload-button" type="button" data-attachment-upload ${isAttachmentUploading ? 'disabled aria-disabled="true"' : ''}>
        ${isAttachmentUploading ? 'กำลังแนบ...' : 'แนบไฟล์'}
      </button>
    </div>
  `;
}

function getFieldValue(values, key, fallback = '') {
  return escapeHtml(values?.[key] ?? fallback);
}

function getInspectionNoteValue(formValues = {}) {
  return formValues.inspectionNote ?? formValues.piecesData?.meta?.inspectionNote ?? '';
}

function formatInspectionDateTime(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString('th-TH', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

function renderInspectionSaveInfo(inspection) {
  if (!inspection?.status) {
    return '';
  }

  const isFinal = inspection.status === 'completed';
  const label = isFinal ? 'บันทึกสมบูรณ์โดย' : 'บันทึกชั่วคราวโดย';
  const meta = inspection.piecesData?.meta || inspection.resultsData?.meta || {};
  const snapshotPrefix = isFinal ? 'completed' : 'draft';
  const userName = isFinal
    ? meta[`${snapshotPrefix}SavedByName`] || inspection.completedByName || inspection.completedBy || '-'
    : meta[`${snapshotPrefix}SavedByName`] || inspection.updatedByName || inspection.updatedBy || '-';
  const userPosition = isFinal
    ? meta[`${snapshotPrefix}SavedByPosition`] || inspection.completedByPosition || ''
    : meta[`${snapshotPrefix}SavedByPosition`] || inspection.updatedByPosition || '';
  const savedAt = isFinal
    ? meta[`${snapshotPrefix}SavedAt`] || inspection.completedAt
    : meta[`${snapshotPrefix}SavedAt`] || inspection.updatedAt;

  return `
    <p class="dimension-save-info">
      ${escapeHtml(label)}: <strong>${escapeHtml(userName)}</strong>
      ${userPosition ? `<span>${escapeHtml(userPosition)}</span>` : ''}
      <span>${escapeHtml(formatInspectionDateTime(savedAt))}</span>
    </p>
  `;
}

function getPackingStatusText(inspection) {
  if (inspection?.status === 'completed') {
    return 'บันทึกสมบูรณ์';
  }

  if (inspection?.status === 'draft') {
    return 'บันทึกชั่วคราว';
  }

  return 'ยังไม่บันทึก';
}

function isChipChecked(values, key, value) {
  return String(values?.[key] ?? '') === String(value) ? 'checked' : '';
}

function renderChipGroup({ name, options, values, extraContent = '' }) {
  return `
    <div class="inspection-chip-group">
      ${options.map((option) => `
        <label class="inspection-chip">
          <input
            type="radio"
            name="${escapeHtml(name)}"
            value="${escapeHtml(option.value)}"
            ${isChipChecked(values, name, option.value)}
            ${option.disabled ? 'disabled aria-disabled="true"' : ''}
          />
          <span>${escapeHtml(option.label)}</span>
        </label>
      `).join('')}
      ${extraContent}
    </div>
  `;
}

function getTopicKey(topic, topicIndex) {
  return String(topic?.id || topicIndex + 1);
}

function getInputCount(topic) {
  const inputCount = Number(topic?.inputCount || 0);

  return Number.isInteger(inputCount) && inputCount > 0 ? Math.min(inputCount, 12) : 0;
}

function getDecimalPlaces(topic) {
  const decimalPlaces = Number(topic?.decimalPlaces || 0);

  return Number.isInteger(decimalPlaces) && decimalPlaces >= 0 ? Math.min(decimalPlaces, 3) : 0;
}

function getMeasuredPieceSet(measurePieces) {
  const text = String(measurePieces || 'all').trim().toLowerCase();

  if (!text || text === 'all' || text === 'ทุกชิ้น') {
    return { mode: 'all', pieces: [] };
  }

  if (['first', 'first_only', 'piece_1', '1', 'เฉพาะชิ้นที่ 1'].includes(text)) {
    return { mode: 'custom', pieces: [1] };
  }

  const pieces = text
    .split(/[,| ]+/)
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);

  return pieces.length ? { mode: 'custom', pieces } : { mode: 'all', pieces: [] };
}

function shouldMeasurePiece(topic, pieceNo) {
  const measuredPieces = getMeasuredPieceSet(topic?.measurePieces);

  return measuredPieces.mode === 'all' || measuredPieces.pieces.includes(pieceNo);
}

function isHoleInspectionTopic(topic) {
  return topic?.ruleKey === 'hole_inspection' || String(topic?.topicName || '').includes('รูเจาะ/รูคว้าน');
}

function shouldSkipTopicByWorkType(topic, formValues = {}) {
  return isHoleInspectionTopic(topic) && (
    formValues.brakeType === 'sheet' || formValues.brakeModel === 'no_hole'
  );
}

function shouldDisableRivetHoleThickness(formValues = {}) {
  return formValues.brakeType === 'sheet' || formValues.brakeModel === 'no_hole';
}

function shouldMeasureTopicCell(topic, pieceNo, formValues = {}) {
  return !shouldSkipTopicByWorkType(topic, formValues) && shouldMeasurePiece(topic, pieceNo);
}

function getSavedTopic(piecesData, topic) {
  const savedTopics = Array.isArray(piecesData?.topics) ? piecesData.topics : [];
  const topicId = String(topic?.id || '');

  return savedTopics.find((savedTopic) => (
    topicId && String(savedTopic.topicId || '') === topicId
  )) || savedTopics.find((savedTopic) => (
    savedTopic.topicName && savedTopic.topicName === topic?.topicName
  )) || null;
}

function getSavedMeasurementValue(piecesData, topic, pieceNo, inputIndex) {
  const savedTopic = getSavedTopic(piecesData, topic);
  const savedRows = Array.isArray(savedTopic?.rows) ? savedTopic.rows : [];
  const savedRow = savedRows.find((row) => Number(row.pieceNo) === Number(pieceNo));
  const values = Array.isArray(savedRow?.values) ? savedRow.values : [];

  return values[inputIndex] ?? '';
}

function getDimensionNgStop(piecesData) {
  const ngStop = piecesData?.meta?.ngStop;

  return ngStop && typeof ngStop === 'object' ? ngStop : null;
}

function getDimensionOrderedTopics(formConfig = []) {
  const topics = formConfig
    .map((topic, originalIndex) => ({ topic, originalIndex }))
    .filter(({ topic }) => getInputCount(topic) > 0);

  return topics
    .sort((left, right) => {
      const leftTypeOrder = left.topic.inputType === 'pass_fail' ? 1 : 0;
      const rightTypeOrder = right.topic.inputType === 'pass_fail' ? 1 : 0;

      return leftTypeOrder - rightTypeOrder || left.originalIndex - right.originalIndex;
    })
    .map(({ topic }) => topic);
}

function getDimensionFinalResultTopic(formConfig = []) {
  return getDimensionOrderedTopics(formConfig).find((topic) => {
    const topicName = String(topic?.topicName || '').trim().toLocaleLowerCase();

    return topic.inputType === 'pass_fail' && (
      topic.ruleKey === 'final_result'
      || dimensionFinalResultTopicNames.has(topicName)
    );
  }) || null;
}

function hasDimensionFinalResultFail(formConfig = [], piecesData = null) {
  const finalResultTopic = getDimensionFinalResultTopic(formConfig);

  if (!finalResultTopic) {
    return false;
  }

  const savedTopic = getSavedTopic(piecesData, finalResultTopic);

  return (savedTopic?.rows || []).some((row) => (
    Array.isArray(row?.values) && row.values.includes('fail')
  ));
}

function getSavedPackingTopic(resultsData, topic) {
  const savedTopics = Array.isArray(resultsData?.topics) ? resultsData.topics : [];
  const topicId = String(topic?.id || '');

  return savedTopics.find((savedTopic) => (
    topicId && String(savedTopic.topicId || '') === topicId
  )) || savedTopics.find((savedTopic) => (
    savedTopic.topicName && savedTopic.topicName === topic?.topicName
  )) || null;
}

function getSavedPackingValue(resultsData, topic) {
  return getSavedPackingTopic(resultsData, topic)?.value || '';
}

function renderMeasurementControl({
  topic,
  topicIndex,
  pieceNo,
  inputIndex,
  piecesData,
  isFinalResultTopic = false,
  allowNotInspectedEdit = false
}) {
  const topicKey = getTopicKey(topic, topicIndex);
  const savedValue = getSavedMeasurementValue(piecesData, topic, pieceNo, inputIndex);
  const isNotInspected = savedValue === '-';
  const value = isNotInspected && allowNotInspectedEdit ? '' : savedValue;
  const commonAttributes = `
    data-measurement-input
    data-topic-index="${topicIndex}"
    data-topic-key="${escapeHtml(topicKey)}"
    data-topic-name="${escapeHtml(topic.topicName || '')}"
    data-piece-no="${pieceNo}"
    data-input-index="${inputIndex}"
    data-decimal-places="${getDecimalPlaces(topic)}"
    data-input-type="${escapeHtml(topic.inputType || 'number')}"
    ${isFinalResultTopic ? 'data-final-result-topic="true"' : ''}
  `;

  if (isNotInspected && !allowNotInspectedEdit) {
    return `
      <span class="dimension-ng-skipped-value">
        <input
          ${commonAttributes}
          type="hidden"
          value="-"
          data-not-inspected="true"
          disabled
        />
        ไม่ได้ตรวจ (N/A)
      </span>
    `;
  }

  if (topic.inputType === 'pass_fail') {
    return `
      <div class="dimension-pass-fail-control">
        <input
          ${commonAttributes}
          type="hidden"
          value="${escapeHtml(value)}"
          aria-label="${escapeHtml(topic.topicName)} ชิ้นที่ ${pieceNo}"
        />
        <button
          class="${value === 'pass' ? 'active pass' : ''}"
          type="button"
          data-pass-fail-option="pass"
        >
          ผ่าน
        </button>
        <button
          class="${value === 'fail' ? 'active fail' : ''}"
          type="button"
          data-pass-fail-option="fail"
        >
          ไม่ผ่าน
        </button>
      </div>
    `;
  }

  return `
    <input
      ${commonAttributes}
      type="text"
      inputmode="decimal"
      autocomplete="off"
      value="${escapeHtml(value)}"
      aria-label="${escapeHtml(topic.topicName)} ชิ้นที่ ${pieceNo} ช่องที่ ${inputIndex + 1}"
    />
  `;
}

function renderMeasurementGrid(
  formConfig = [],
  sampleCount = 0,
  piecesData = null,
  formValues = {},
  { allowNotInspectedEdit = false } = {}
) {
  if (!formConfig.length) {
    return `
      <div class="history-state-panel compact-empty-panel">
        <strong>ยังไม่มีหัวข้อฟอร์มตรวจมิติ</strong>
      </div>
    `;
  }

  const safeSampleCount = Number.isInteger(Number(sampleCount)) && Number(sampleCount) > 0
    ? Math.min(Number(sampleCount), 50)
    : 0;
  const topics = formConfig
    .map((topic, topicIndex) => ({ topic, topicIndex, inputCount: getInputCount(topic) }))
    .filter((item) => item.inputCount > 0);

  if (!safeSampleCount || !topics.length) {
    return `
      <div class="history-state-panel compact-empty-panel">
        <strong>ยังไม่พบหัวข้อที่พร้อมกรอกค่าตรวจ</strong>
      </div>
    `;
  }

  const numberTopics = topics.filter(({ topic }) => topic.inputType !== 'pass_fail');
  const passFailTopics = topics.filter(({ topic }) => topic.inputType === 'pass_fail');
  const finalResultTopic = getDimensionFinalResultTopic(formConfig);

  function renderTopicCells(topicItems, pieceNo) {
    return topicItems.map(({ topic, topicIndex, inputCount }) => {
      if (!shouldMeasureTopicCell(topic, pieceNo, formValues)) {
        return `<td class="dimension-skip-cell" colspan="${inputCount}">-</td>`;
      }

      return Array.from({ length: inputCount }, (_, inputIndex) => (
        `<td>${renderMeasurementControl({
          topic,
          topicIndex,
          pieceNo,
          inputIndex,
          piecesData,
          allowNotInspectedEdit,
          isFinalResultTopic: Boolean(
            finalResultTopic && String(finalResultTopic.id) === String(topic.id)
          )
        })}</td>`
      )).join('');
    }).join('');
  }

  function renderMeasurementTable(title, topicItems, modeClass) {
    if (!topicItems.length) {
      return '';
    }

    const totalInputCount = topicItems.reduce((sum, item) => sum + item.inputCount, 0);

    return `
      <section class="dimension-measurement-group ${modeClass}">
        <div class="dimension-measurement-group-title">
          <strong>${escapeHtml(title)}</strong>
          <span>${topicItems.length} หัวข้อ</span>
        </div>
        <div class="dimension-measurement-scroll">
          <table class="dimension-measurement-table" style="min-width: ${Math.max(620, 88 * totalInputCount + 96)}px">
            <thead>
              <tr class="dimension-measurement-topic-row">
                <th scope="col">ชิ้นที่</th>
                ${topicItems.map(({ topic, inputCount }) => `
                  <th scope="col" colspan="${inputCount}">
                    <span>${escapeHtml(topic.topicName)}</span>
                    <small>${topic.inputType === 'pass_fail' ? 'ผ่าน/ไม่ผ่าน' : `${getDecimalPlaces(topic)} ทศนิยม`}</small>
                  </th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              ${Array.from({ length: safeSampleCount }, (_, index) => {
                const pieceNo = index + 1;

                return `
                  <tr>
                    <th scope="row">ชิ้นที่ ${pieceNo}</th>
                    ${renderTopicCells(topicItems, pieceNo)}
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  return `
    <div class="dimension-measurement-sheet">
      <div class="dimension-measurement-summary">
        <strong>${topics.length} หัวข้อ</strong>
        <span>${safeSampleCount} ชิ้นสุ่มตรวจ</span>
      </div>
      <div class="dimension-missing-panel" data-missing-panel hidden></div>
      ${renderMeasurementTable('ค่าตัวเลข', numberTopics, 'number-group')}
      ${renderMeasurementTable('ผลผ่าน / ไม่ผ่าน', passFailTopics, 'pass-fail-group')}
    </div>
  `;
}

function getSamplingRange(quantity = 0) {
  const count = Number(quantity || 0);

  return activeSamplingRanges.find((range) => (
    count >= range.min && (range.max === null || count <= range.max)
  ));
}

function renderFormField(label, controlHtml, className = '') {
  return `
    <div class="field ${className}">
      <span>${escapeHtml(label)}</span>
      ${controlHtml}
    </div>
  `;
}

function getInstrumentPrefix(index) {
  return activeInstrumentPrefixes[index] || defaultInstrumentPrefixes[index] || 'A-01-';
}

function getSavedInstrumentParts(code = '', index = 0) {
  const fallbackPrefix = getInstrumentPrefix(index);
  const value = String(code || '').trim().toUpperCase();

  if (value === '-') {
    return { prefix: fallbackPrefix, suffix: '-' };
  }

  const match = value.match(/^(A-\d{2}-)(\d{3})$/);

  if (match) {
    return { prefix: match[1], suffix: match[2] };
  }

  return {
    prefix: fallbackPrefix,
    suffix: value.startsWith(fallbackPrefix) ? value.slice(fallbackPrefix.length) : value
  };
}

function validateInstrumentSuffixInput(input) {
  const suffix = String(input?.value || '').trim();
  const isValid = !suffix || suffix === '-' || /^\d{3}$/.test(suffix);

  input?.setCustomValidity(isValid ? '' : 'กรอกรหัสเครื่องมือเป็นตัวเลข 3 หลัก, ใส่ - เมื่อไม่ใช้, หรือเว้นว่างไว้');
  return isValid;
}

function validateInstrumentSuffixInputs(form) {
  const invalidInput = Array.from({ length: 5 }, (_, index) => (
    form.querySelector(`[name="instrumentCode${index}"]`)
  )).find((input) => !validateInstrumentSuffixInput(input));

  if (invalidInput) {
    invalidInput.reportValidity();
    invalidInput.focus();
    return false;
  }

  return true;
}

function renderInstrumentRow(formValues = {}) {
  return `
    <div class="dimension-instrument-grid">
      ${Array.from({ length: 5 }, (_, index) => {
        const parts = getSavedInstrumentParts(formValues?.instrumentCodes?.[index], index);

        return `
        <label class="field dimension-instrument-field">
          <span>เครื่องมือ ${index + 1}</span>
          <div class="instrument-code-control">
            <strong>${escapeHtml(parts.prefix)}</strong>
            <input
              name="instrumentCode${index}"
              type="text"
              maxlength="3"
              inputmode="text"
              pattern="[0-9-]*"
              autocomplete="off"
              placeholder="xxx/-"
              value="${escapeHtml(parts.suffix)}"
              data-instrument-prefix="${escapeHtml(parts.prefix)}"
            />
          </div>
        </label>
      `;
      }).join('')}
    </div>
  `;
}

function renderSamplingRow(lot, formValues = {}) {
  const activeRange = getSamplingRange(lot?.quantity);
  const activeSampleCount = Number(formValues?.sampleCount || lot?.sampleCount || 0);

  return `
    <div class="dimension-sampling-grid">
      <div class="dimension-sampling-current">
        <span>จำนวนชิ้นงาน</span>
        <strong>${escapeHtml(lot?.quantity || '-')}</strong>
      </div>
      <div class="dimension-sampling-current">
        <span>จำนวนสุ่มตรวจ</span>
        <strong>${escapeHtml(activeSampleCount || '-')}</strong>
      </div>
      ${activeSamplingRanges.map((range) => `
        <div class="dimension-sampling-option ${activeRange?.label === range.label || activeSampleCount === range.sampleCount ? 'active' : ''}">
          <strong>${escapeHtml(range.label)}</strong>
          <span>${escapeHtml(range.sampleCount)} ชิ้น</span>
        </div>
      `).join('')}
      <input type="hidden" name="sampleCount" value="${escapeHtml(activeSampleCount)}" />
    </div>
  `;
}

function renderDimensionNgStopPanel(formConfig, piecesData, isDisabled) {
  const orderedTopics = getDimensionOrderedTopics(formConfig);
  const finalResultTopic = getDimensionFinalResultTopic(formConfig);
  const selectableTopics = orderedTopics.filter(
    (topic) => String(topic.id) !== String(finalResultTopic?.id || '')
  );
  const ngStop = getDimensionNgStop(piecesData);
  const isVisible = hasDimensionFinalResultFail(formConfig, piecesData);
  const selectedTopicId = isVisible ? String(ngStop?.topicId || '') : '';
  const isSelectDisabled = isDisabled || !isVisible;

  if (!finalResultTopic || !selectableTopics.length) {
    return '';
  }

  return `
    <div
      class="dimension-ng-topic-panel"
      data-dimension-ng-topic-panel
      ${isVisible ? '' : 'hidden'}
    >
      <div class="dimension-ng-topic-copy">
        <strong>รายละเอียดงาน NG</strong>
        <span>หัวข้อที่พบ NG ต้องตรวจครบ ส่วนหัวข้อถัดไปตรวจให้ครบทั้งหัวข้อหรือเว้นไว้เป็น N/A</span>
      </div>
      <label class="field dimension-ng-topic-field">
        <span>หัวข้อที่พบ NG</span>
        <select
          name="ngStopTopicId"
          data-dimension-ng-topic
          ${isDisabled ? 'data-read-only="true"' : ''}
          ${isSelectDisabled ? 'disabled aria-disabled="true"' : ''}
        >
          <option value="">เลือกหัวข้อ</option>
          ${selectableTopics.map((topic) => `
            <option
              value="${escapeHtml(topic.id)}"
              data-topic-name="${escapeHtml(topic.topicName)}"
              ${String(topic.id) === selectedTopicId ? 'selected' : ''}
            >${escapeHtml(topic.topicName)}</option>
          `).join('')}
        </select>
      </label>
      <span class="dimension-ng-topic-status">
        ช่องของหัวข้อถัดไปที่เว้นทั้งหัวข้อจะบันทึกเป็นไม่ได้ตรวจ (N/A)
      </span>
    </div>
  `;
}

function renderDimensionShell({
  lot,
  inspection,
  formConfig = [],
  formValues = {},
  rememberedInstrumentCodes = {},
  message = '',
  error = '',
  userRole = '',
  isSaving = false,
  isAttachmentUploading = false,
  isReadOnly = false
}) {
  const isLockedLot = ['void', 'approved'].includes(lot?.status);
  const canEditCompleted = ['head', 'assistant'].includes(userRole)
    || (userRole === 'officer' && lot?.status === 'need_fix');
  const isCompleted = inspection?.status === 'completed';
  const isCompletedReadOnly = isReadOnly || (isCompleted && !canEditCompleted);
  const draftDisabled = isReadOnly || isSaving || isLockedLot || isCompleted;
  const completeDisabled = isReadOnly || isSaving || isLockedLot || isCompletedReadOnly;
  const activeSampleCount = Number(formValues?.sampleCount || lot?.sampleCount || 0);
  const isRivetHoleThicknessDisabled = shouldDisableRivetHoleThickness(formValues);
  const inspectionStatus = inspection?.status === 'completed'
    ? 'บันทึกสมบูรณ์แล้ว'
    : inspection?.status === 'draft'
      ? 'ตรวจค้างอยู่'
      : 'ยังไม่บันทึก';

  return `
    <form id="dimensionInspectionForm" class="dimension-inspection-form" data-read-only="${isCompletedReadOnly ? 'true' : 'false'}">
      <section class="inspection-shell-panel dimension-form-panel">
        <div class="compact-panel-heading dimension-form-heading">
          <div>
            <h3>ฟอร์มตรวจมิติ</h3>
            <p>รายงาน QC ผ้าเบรก</p>
          </div>
          <span class="status-pill">${escapeHtml(inspectionStatus)}</span>
        </div>

        ${message ? `<p class="alert success">${escapeHtml(message)}</p>` : ''}
        ${error ? `<p class="alert error">${escapeHtml(error)}</p>` : ''}
        ${message || error ? `
          <div class="dimension-save-popup ${error ? 'error' : 'success'}" data-save-popup role="status" aria-live="polite">
            <strong>${escapeHtml(error || message)}</strong>
          </div>
        ` : ''}

        <div class="dimension-section">
          <div class="dimension-section-title">
            <strong>ข้อมูลก่อนเริ่มตรวจ</strong>
            <span>ข้อมูล Lot อยู่ด้านบนแล้ว</span>
          </div>
          <div class="dimension-precheck-grid">
            ${renderFormField('วันที่ตรวจสอบ', `
              <input
                name="inspectionDate"
                type="date"
                value="${getFieldValue(formValues, 'inspectionDate')}"
              />
            `, 'compact-date-field')}
            ${renderFormField('กะที่', renderChipGroup({
              name: 'shift',
              values: formValues,
              options: [
                { value: '1', label: 'กะ 1' },
                { value: '2', label: 'กะ 2' }
              ]
            }), 'compact-shift-field')}
            ${renderFormField('รีเวท No.', `
              <input
                name="rivetNo"
                type="text"
                maxlength="10"
                autocomplete="off"
                value="${getFieldValue(formValues, 'rivetNo')}"
              />
            `, 'compact-rivet-field')}
            ${renderFormField('รหัสผลิต', `
              <input
                name="productionCode"
                type="text"
                maxlength="6"
                inputmode="numeric"
                autocomplete="off"
                value="${getFieldValue(formValues, 'productionCode')}"
              />
            `, 'compact-production-field')}
            ${renderFormField('หมายเหตุ', `
              <input
                type="text"
                readonly
                value="${escapeHtml(lot?.remark1 || '-')}"
              />
            `, 'compact-remark-field')}
          </div>

          <div class="dimension-subsection">
            <div class="dimension-subsection-heading">
              <strong>รหัสเครื่องมือวัด</strong>
              <button
                class="dimension-inline-refresh-button"
                type="button"
                data-use-remembered-instruments
                ${Object.keys(rememberedInstrumentCodes || {}).length ? '' : 'disabled aria-disabled="true"'}
              >
                ใช้รหัสล่าสุด
              </button>
            </div>
            ${renderInstrumentRow(formValues)}
          </div>
        </div>

        <div class="dimension-section">
          <div class="dimension-section-title">
            <strong>ประเภทงานและจำนวนสุ่มตรวจ</strong>
            <span>เรียงตามลำดับเดียวกับเอกสารกระดาษ</span>
          </div>
          <div class="dimension-choice-grid">
            ${renderFormField('ประเภทผ้าเบรก', renderChipGroup({
              name: 'brakeType',
              values: formValues,
              options: [
                { value: 'normal', label: 'ธรรมดา' },
                { value: 'taper', label: 'ปลายเรียว' },
                { value: 'sheet', label: 'แผ่น' }
              ]
            }))}
            ${renderFormField('แบบผ้าเบรก', renderChipGroup({
              name: 'brakeModel',
              values: formValues,
              options: [
                { value: 'drilled_bored', label: 'มีรูเจาะ-รูคว้าน' },
                { value: 'no_hole', label: 'ไม่มีรู' }
              ],
              extraContent: `
                <button class="dimension-inline-refresh-button" type="button" data-refresh-measurement>
                  ปรับช่องตรวจ
                </button>
              `
            }))}
            ${renderFormField('ขนาดความหนารูยึดรีเวท', renderChipGroup({
              name: 'rivetHoleThickness',
              values: isRivetHoleThicknessDisabled ? { ...formValues, rivetHoleThickness: '' } : formValues,
              options: [
                { value: '2', label: '2 มม.', disabled: isRivetHoleThicknessDisabled },
                { value: '2.5', label: '2.5 มม.', disabled: isRivetHoleThicknessDisabled },
                { value: '3', label: '3 มม.', disabled: isRivetHoleThicknessDisabled },
                { value: '3.5', label: '3.5 มม.', disabled: isRivetHoleThicknessDisabled }
              ]
            }))}
          </div>
          ${renderSamplingRow(lot, formValues)}
        </div>

        <div class="dimension-section">
          <div class="dimension-section-title">
            <strong>หัวข้อในการตรวจสอบ</strong>
            <span>${formConfig.length ? `${formConfig.length} หัวข้อจาก form_config` : 'รอเพิ่มหัวข้อใน System Settings'}</span>
          </div>
          ${renderMeasurementGrid(
            formConfig,
            activeSampleCount,
            formValues?.piecesData,
            formValues,
            {
              allowNotInspectedEdit: lot?.status === 'need_fix' && !isCompletedReadOnly
            }
          )}
          ${renderDimensionNgStopPanel(formConfig, formValues?.piecesData, completeDisabled)}
        </div>
      </section>

      <div class="form-actions inspection-actions">
        <button class="primary-button" type="submit" ${draftDisabled ? 'disabled aria-disabled="true"' : ''}>
          ${isSaving ? 'กำลังบันทึก...' : 'บันทึกชั่วคราว'}
        </button>
        <button class="secondary-button dimension-complete-button" type="button" data-complete-save ${completeDisabled ? 'disabled aria-disabled="true"' : ''}>
          บันทึกสมบูรณ์
        </button>
        <label class="field dimension-note-field">
          <span>หมายเหตุการตรวจ</span>
          <input
            name="inspectionNote"
            type="text"
            maxlength="200"
            autocomplete="off"
            value="${escapeHtml(getInspectionNoteValue(formValues))}"
          />
        </label>
        ${renderAttachmentActionControls({ userRole, isAttachmentUploading, isReadOnly })}
      </div>
      ${renderInspectionSaveInfo(inspection)}
    </form>
  `;
}

function renderPackingControl(topic, topicIndex, resultsData) {
  const topicKey = getTopicKey(topic, topicIndex);
  const value = getSavedPackingValue(resultsData, topic);

  if (topic.inputType === 'number') {
    return `
      <input
        class="packing-number-input"
        data-packing-result
        data-topic-key="${escapeHtml(topicKey)}"
        data-topic-name="${escapeHtml(topic.topicName || '')}"
        data-input-type="number"
        type="text"
        inputmode="decimal"
        autocomplete="off"
        value="${escapeHtml(value)}"
      />
    `;
  }

  return `
    <div class="dimension-pass-fail-control packing-pass-fail-control">
      <input
        data-packing-result
        data-topic-key="${escapeHtml(topicKey)}"
        data-topic-name="${escapeHtml(topic.topicName || '')}"
        data-input-type="pass_fail"
        type="hidden"
        value="${escapeHtml(value)}"
      />
      <button
        class="${value === 'pass' ? 'active pass' : ''}"
        type="button"
        data-packing-option="pass"
      >
        ผ่าน
      </button>
      <button
        class="${value === 'fail' ? 'active fail' : ''}"
        type="button"
        data-packing-option="fail"
      >
        ไม่ผ่าน
      </button>
    </div>
  `;
}

function renderPackingTable(formConfig = [], resultsData = null) {
  if (!formConfig.length) {
    return `
      <div class="history-state-panel compact-empty-panel">
        <strong>ยังไม่มีหัวข้อฟอร์มตรวจบรรจุ</strong>
      </div>
    `;
  }

  return `
    <div class="dimension-missing-panel" data-packing-missing-panel hidden></div>
    <div class="dimension-measurement-scroll packing-table-scroll">
      <table class="dimension-measurement-table packing-inspection-table">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">ชื่อหัวข้อ</th>
            <th scope="col">ผลตรวจ</th>
            <th scope="col">หมายเหตุอ้างอิง</th>
          </tr>
        </thead>
        <tbody>
          ${formConfig.map((topic, topicIndex) => `
            <tr>
              <th scope="row">${topicIndex + 1}</th>
              <td class="packing-topic-cell">${escapeHtml(topic.topicName || '-')}</td>
              <td>${renderPackingControl(topic, topicIndex, resultsData)}</td>
              <td class="packing-reference-cell">${escapeHtml(topic.remark || '-')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderPackingShell({
  lot,
  inspection,
  formConfig = [],
  formValues = {},
  message = '',
  error = '',
  userRole = '',
  isSaving = false,
  isAttachmentUploading = false,
  packingReference = null,
  isReadOnly = false
}) {
  const isLockedLot = ['void', 'approved'].includes(lot?.status);
  const canEditCompleted = ['head', 'assistant'].includes(userRole);
  const isFinal = inspection?.status === 'completed';
  const isFormReadOnly = isReadOnly || (isFinal && !canEditCompleted);
  const draftDisabled = isReadOnly || isSaving || isLockedLot || isFinal;
  const completeDisabled = isReadOnly || isSaving || isLockedLot || isFormReadOnly;
  const resultsData = formValues?.resultsData || inspection?.resultsData || { topics: [] };
  const savedReference = resultsData?.meta || {};
  const referenceValue = savedReference.packingReferenceValue || packingReference?.value || lot?.lotPacking || '-';
  const referenceSourceLabel = savedReference.packingReferenceSourceLabel || packingReference?.sourceLabel || 'Lot ผลิตจาก Excel';

  return `
    <form id="packingInspectionForm" class="dimension-inspection-form packing-inspection-form" data-read-only="${isFormReadOnly ? 'true' : 'false'}">
      <section class="inspection-shell-panel dimension-form-panel">
        <div class="compact-panel-heading dimension-form-heading">
          <div>
            <h3>ฟอร์มตรวจบรรจุ</h3>
            <p>ตรวจ Lot ผลิต / สติกเกอร์ / จำนวน / รายละเอียดบรรจุ</p>
          </div>
          <span class="status-pill">${escapeHtml(getPackingStatusText(inspection))}</span>
        </div>

        ${message ? `
          <div class="dimension-save-popup success" data-save-popup role="status" aria-live="polite">
            <strong>${escapeHtml(message)}</strong>
          </div>
        ` : ''}
        ${error ? `
          <div class="dimension-save-popup error" data-save-popup role="status" aria-live="polite">
            <strong>${escapeHtml(error)}</strong>
            <button class="secondary-button" type="button" data-inspection-tab="dimension">
              กลับไปฟอร์มตรวจมิติ
            </button>
          </div>
        ` : ''}

        <div class="dimension-section packing-highlight">
          <div class="dimension-section-title">
            <strong>รหัสอ้างอิงตรวจบรรจุ</strong>
            <span>ข้อมูลสำหรับตรวจบรรจุ</span>
          </div>
          <strong>${escapeHtml(referenceValue)}</strong>
          <span>${escapeHtml(referenceSourceLabel)}</span>
        </div>

        <div class="dimension-section">
          <div class="dimension-section-title">
            <strong>หัวข้อในการตรวจสอบ</strong>
            <span>${formConfig.length ? `${formConfig.length} หัวข้อจาก form_config` : 'รอเพิ่มหัวข้อใน System Settings'}</span>
          </div>
          ${renderPackingTable(formConfig, resultsData)}
        </div>

        <div class="form-actions inspection-actions">
          <button class="primary-button" type="submit" ${draftDisabled ? 'disabled aria-disabled="true"' : ''}>
            ${isSaving ? 'กำลังบันทึก...' : 'บันทึกชั่วคราว'}
          </button>
          <button class="secondary-button dimension-complete-button" type="button" data-packing-complete ${completeDisabled ? 'disabled aria-disabled="true"' : ''}>
            บันทึกสมบูรณ์
          </button>
          <label class="field dimension-note-field">
            <span>หมายเหตุการตรวจบรรจุ</span>
            <input
              name="packingInspectionNote"
              type="text"
              maxlength="200"
              autocomplete="off"
              value="${escapeHtml(formValues?.inspectionNote || resultsData?.meta?.inspectionNote || '')}"
          />
        </label>
        ${renderAttachmentActionControls({ userRole, isAttachmentUploading, isReadOnly })}
        </div>
        ${renderInspectionSaveInfo(inspection)}
      </section>
    </form>
  `;
}

export function renderLotInspectionPage({
  lot = null,
  inspection = null,
  packingInspection = null,
  formConfig = [],
  packingFormConfig = [],
  instrumentPrefixes = [],
  samplingRules = [],
  formValues = {},
  packingValues = {},
  packingReference = null,
  attachments = [],
  attachmentError = '',
  rememberedInstrumentCodes = {},
  message = '',
  activeTab = 'dimension',
  error = '',
  userRole = '',
  isLoading = false,
  isSaving = false,
  isAttachmentUploading = false,
  isReadOnly = false,
  backLabel = 'กลับไปค้นหา Lot'
} = {}) {
  activeInstrumentPrefixes = normalizeInstrumentPrefixes(instrumentPrefixes);
  activeSamplingRanges = normalizeSamplingRanges(samplingRules);

  if (isLoading) {
    return `
      <section class="lot-inspection-page">
        <div class="history-state-panel compact-empty-panel">
          <strong>กำลังโหลดข้อมูล Lot...</strong>
        </div>
      </section>
    `;
  }

  if (error && !lot) {
    return `
      <section class="lot-inspection-page">
        <p class="alert error">${escapeHtml(error)}</p>
        <button class="secondary-button" type="button" data-back-to-lookup>${escapeHtml(backLabel)}</button>
      </section>
    `;
  }

  if (!lot) {
    return `
      <section class="lot-inspection-page">
        <div class="history-state-panel compact-empty-panel">
          <strong>ไม่พบข้อมูล Lot</strong>
        </div>
        <button class="secondary-button" type="button" data-back-to-lookup>${escapeHtml(backLabel)}</button>
      </section>
    `;
  }

  const safeActiveTab = activeTab === 'packing' ? 'packing' : 'dimension';

  return `
    <section class="lot-inspection-page">
      ${lot.status === 'void' ? '<p class="alert error">Lot นี้ถูก Void แล้ว ไม่สามารถตรวจต่อได้</p>' : ''}

      ${renderLotHeader(lot)}
      ${renderApprovalReviewPanel({ lot, userRole, isSaving, isReadOnly })}

      <section class="management-panel wide-panel lot-inspection-panel">
        <div class="inspection-toolbar">
          <div class="import-tabs inspection-tabs" role="tablist" aria-label="ฟอร์มตรวจ">
            <button
              class="${safeActiveTab === 'dimension' ? 'active' : ''}"
              type="button"
              data-inspection-tab="dimension"
            >
              ฟอร์มตรวจมิติ
            </button>
            <button
              class="${safeActiveTab === 'packing' ? 'active' : ''}"
              type="button"
              data-inspection-tab="packing"
            >
              ฟอร์มตรวจบรรจุ
            </button>
          </div>

          <button class="secondary-button" type="button" data-back-to-lookup>${escapeHtml(backLabel)}</button>
        </div>

        ${safeActiveTab === 'packing'
          ? renderPackingShell({
            lot,
            inspection: packingInspection,
            formConfig: packingFormConfig,
            formValues: packingValues,
            message,
            error,
            userRole,
            isSaving,
            isAttachmentUploading,
            packingReference,
            isReadOnly
          })
          : renderDimensionShell({
            lot,
            inspection,
            formConfig,
            formValues,
            rememberedInstrumentCodes,
            message,
            error,
            userRole,
            isSaving,
            isAttachmentUploading,
            isReadOnly
          })}
      </section>
      ${renderLotAttachmentsPanel({ attachments, userRole, attachmentError, isAttachmentUploading, isReadOnly })}
    </section>
  `;
}

function bindPackingInspectionForm({
  form,
  onDraftSave,
  onCompleteSave,
  onFormValuesChange
}) {
  if (form.dataset.readOnly === 'true') {
    form.querySelectorAll('input, button, select, textarea').forEach((control) => {
      control.disabled = true;
      control.setAttribute('aria-disabled', 'true');
    });
  }

  const savePopup = form.querySelector('[data-save-popup]');

  if (savePopup) {
    const hideSavePopup = () => savePopup.classList.add('is-hiding');
    window.setTimeout(hideSavePopup, 2500);
    document.addEventListener('pointerdown', hideSavePopup, { once: true, capture: true });
    form.addEventListener('input', hideSavePopup, { once: true });
    form.addEventListener('change', hideSavePopup, { once: true });
  }

  const resultInputs = Array.from(form.querySelectorAll('[data-packing-result]'));
  const missingPanel = form.querySelector('[data-packing-missing-panel]');
  const noteInput = form.querySelector('[name="packingInspectionNote"]');

  function setMissingState(input, isMissing) {
    const wrapper = input.closest('.dimension-pass-fail-control') || input;
    wrapper.classList.toggle('is-missing', isMissing);
  }

  function getMissingResultInputs() {
    return resultInputs
      .filter((input) => !String(input.value || '').trim())
      .map((input) => ({
        input,
        label: input.dataset.topicName || 'หัวข้อ'
      }));
  }

  function updateMissingPanel(missingItems = [], noteMissing = false) {
    if (!missingPanel) {
      return;
    }

    resultInputs.forEach((input) => setMissingState(input, false));
    missingItems.forEach(({ input }) => setMissingState(input, true));
    noteInput?.classList.toggle('is-missing', noteMissing);
    missingPanel.replaceChildren();

    if (!missingItems.length && !noteMissing) {
      missingPanel.hidden = true;
      return;
    }

    missingPanel.hidden = false;
    const title = document.createElement('strong');
    title.textContent = 'ยังกรอกฟอร์มตรวจบรรจุไม่ครบ';

    const list = document.createElement('ul');
    missingItems.forEach((item) => {
      const listItem = document.createElement('li');
      listItem.textContent = item.label;
      list.appendChild(listItem);
    });

    if (noteMissing) {
      const listItem = document.createElement('li');
      listItem.textContent = 'หมายเหตุเมื่อมีหัวข้อไม่ผ่าน';
      list.appendChild(listItem);
    }

    missingPanel.append(title, list);
  }

  function collectResultsData() {
    const topics = resultInputs.map((input) => ({
      topicId: Number(input.dataset.topicKey) || input.dataset.topicKey,
      topicName: input.dataset.topicName || '',
      value: String(input.value || '').trim()
    })).filter((topic) => topic.value);

    return {
      meta: {
        inspectionNote: String(noteInput?.value || '').trim()
      },
      topics
    };
  }

  function collectFormValues() {
    const resultsData = collectResultsData();

    return {
      inspectionNote: resultsData.meta.inspectionNote,
      resultsData
    };
  }

  function hasFailResult() {
    return resultInputs.some((input) => input.dataset.inputType === 'pass_fail' && input.value === 'fail');
  }

  form.querySelectorAll('[data-packing-option]').forEach((button) => {
    button.addEventListener('click', () => {
      const control = button.closest('.dimension-pass-fail-control');
      const input = control?.querySelector('[data-packing-result]');

      if (!input) {
        return;
      }

      input.value = button.dataset.packingOption || '';
      control.querySelectorAll('[data-packing-option]').forEach((optionButton) => {
        optionButton.classList.toggle('active', optionButton === button);
        optionButton.classList.toggle('pass', optionButton === button && input.value === 'pass');
        optionButton.classList.toggle('fail', optionButton === button && input.value === 'fail');
      });
      updateMissingPanel([]);
      onFormValuesChange(collectFormValues());
    });
  });

  resultInputs
    .filter((input) => input.dataset.inputType === 'number')
    .forEach((input) => {
      input.addEventListener('input', () => {
        updateMissingPanel(getMissingResultInputs(), false);
        onFormValuesChange(collectFormValues(), { render: false });
      });
    });

  noteInput?.addEventListener('input', () => {
    const noteMissing = hasFailResult() && !String(noteInput.value || '').trim();
    updateMissingPanel(getMissingResultInputs(), noteMissing);
    onFormValuesChange(collectFormValues(), { render: false });
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    updateMissingPanel([]);
    onDraftSave(collectFormValues());
  });

  form.querySelector('[data-packing-complete]')?.addEventListener('click', () => {
    const missingItems = getMissingResultInputs();
    const noteMissing = hasFailResult() && !String(noteInput?.value || '').trim();
    updateMissingPanel(missingItems, noteMissing);

    if (missingItems.length) {
      const target = missingItems[0].input.closest('.dimension-pass-fail-control')?.querySelector('button')
        || missingItems[0].input;
      target?.focus();
      return;
    }

    if (noteMissing) {
      noteInput?.focus();
      return;
    }

    onCompleteSave(collectFormValues());
  });

}

export function bindLotInspectionPage({
  onTabChange,
  onDraftSave,
  onCompleteSave,
  onPackingDraftSave,
  onPackingCompleteSave,
  onApprovalAction = () => {},
  onAttachmentUpload = () => {},
  onAttachmentDelete = () => {},
  onAttachmentDownload = () => {},
  onFormValuesChange = () => {},
  onPackingValuesChange = () => {},
  rememberedInstrumentCodes = {},
  onBack
}) {
  document.querySelectorAll('[data-inspection-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      onTabChange(button.dataset.inspectionTab);
    });
  });

  document.querySelectorAll('[data-back-to-lookup]').forEach((button) => {
    button.addEventListener('click', onBack);
  });

  const reasonRow = document.querySelector('[data-approval-reason-row]');
  const reasonInput = document.querySelector('[name="approvalReason"]');
  const reasonError = document.querySelector('[data-approval-inline-error]');
  let pendingApprovalAction = '';

  function showReasonError(message) {
    if (!reasonError) {
      return;
    }

    reasonError.textContent = message;
    reasonError.hidden = !message;
  }

  document.querySelectorAll('[data-approval-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.approvalAction;

      if (button.dataset.needsReason !== 'true') {
        onApprovalAction(action, '');
        return;
      }

      pendingApprovalAction = action;
      if (reasonRow) {
        reasonRow.hidden = false;
      }
      reasonInput?.focus();
      showReasonError('');
    });
  });

  document.querySelector('[data-confirm-approval-action]')?.addEventListener('click', () => {
    const reason = String(reasonInput?.value || '').trim();

    if (!pendingApprovalAction) {
      showReasonError('กรุณาเลือกคำสั่ง');
      return;
    }

    if (!reason) {
      showReasonError('กรุณากรอกหมายเหตุ');
      reasonInput?.focus();
      return;
    }

    onApprovalAction(pendingApprovalAction, reason);
  });

  document.querySelector('[data-attachment-upload]')?.addEventListener('click', () => {
    const fileInput = document.querySelector('[data-attachment-file]');
    const file = fileInput?.files?.[0] || null;
    onAttachmentUpload(file);
  });

  document.querySelectorAll('[data-delete-attachment-id]').forEach((button) => {
    button.addEventListener('click', () => {
      onAttachmentDelete(button.dataset.deleteAttachmentId);
    });
  });

  document.querySelectorAll('[data-download-attachment-id]').forEach((button) => {
    button.addEventListener('click', () => {
      onAttachmentDownload(button.dataset.downloadAttachmentId, button.dataset.downloadAttachmentName || 'attachment');
    });
  });

  const packingForm = document.querySelector('#packingInspectionForm');

  if (packingForm) {
    bindPackingInspectionForm({
      form: packingForm,
      onDraftSave: onPackingDraftSave,
      onCompleteSave: onPackingCompleteSave,
      onFormValuesChange: onPackingValuesChange
    });
  }

  const form = document.querySelector('#dimensionInspectionForm');
  if (!form) {
    return;
  }

  if (form.dataset.readOnly === 'true') {
    form.querySelectorAll('input, button, select, textarea').forEach((control) => {
      control.disabled = true;
      control.setAttribute('aria-disabled', 'true');
    });
  }

  const savePopup = form.querySelector('[data-save-popup]');

  if (savePopup) {
    const hideSavePopup = () => savePopup.classList.add('is-hiding');
    window.setTimeout(hideSavePopup, 2500);
    document.addEventListener('pointerdown', hideSavePopup, { once: true, capture: true });
    form.addEventListener('input', hideSavePopup, { once: true });
    form.addEventListener('change', hideSavePopup, { once: true });
  }

  const instrumentInputs = Array.from({ length: 5 }, (_, index) => (
    form.querySelector(`[name="instrumentCode${index}"]`)
  )).filter(Boolean);
  const measurementInputs = Array.from(form.querySelectorAll('[data-measurement-input]'));
  const orderedMeasurementInputs = sortMeasurementInputsByInspectionOrder(measurementInputs);
  const missingPanel = form.querySelector('[data-missing-panel]');
  const noteInput = form.querySelector('[name="inspectionNote"]');
  const ngTopicSelect = form.querySelector('[data-dimension-ng-topic]');
  const ngTopicPanel = form.querySelector('[data-dimension-ng-topic-panel]');
  const finalResultInputs = measurementInputs.filter(
    (input) => input.dataset.finalResultTopic === 'true'
  );
  let hasShownMissingPanel = false;

  instrumentInputs.forEach((input) => {
    input.addEventListener('input', () => validateInstrumentSuffixInput(input));
    input.addEventListener('change', () => validateInstrumentSuffixInput(input));
  });

  form.querySelector('[data-use-remembered-instruments]')?.addEventListener('click', () => {
    instrumentInputs.forEach((input, index) => {
      const rememberedCode = rememberedInstrumentCodes?.[index];

      if (!rememberedCode) {
        return;
      }

      input.value = getSavedInstrumentParts(rememberedCode, index).suffix;
      validateInstrumentSuffixInput(input);
    });
  });

  function validateMeasurementInput(input) {
    const value = String(input.value || '').trim();

    if (!value) {
      input.setCustomValidity('');
      return true;
    }

    if (value === '-' && input.dataset.notInspected === 'true') {
      input.setCustomValidity('');
      return true;
    }

    if (input.dataset.inputType === 'pass_fail') {
      const isValid = ['pass', 'fail'].includes(value);

      input.setCustomValidity(isValid ? '' : 'เลือกผ่านหรือไม่ผ่านเท่านั้น');
      return isValid;
    }

    const decimalPlaces = Number(input.dataset.decimalPlaces || 0);
    const pattern = decimalPlaces === 0
      ? /^\d+$/
      : new RegExp(`^\\d+\\.\\d{${decimalPlaces}}$`);
    const isValid = pattern.test(value);

    input.setCustomValidity(isValid ? '' : `กรอกตัวเลขให้ครบ ${decimalPlaces} ตำแหน่งทศนิยม`);
    return isValid;
  }

  function setMissingState(input, isMissing) {
    input.classList.toggle('is-missing', isMissing);
    input.closest('.dimension-pass-fail-control')?.classList.toggle('is-missing', isMissing);
  }

  function getMissingMeasurementInputs() {
    const ngStopTopicId = hasFinalResultFailInForm()
      ? String(ngTopicSelect?.value || '').trim()
      : '';
    const finalResultTopicKey = String(finalResultInputs[0]?.dataset.topicKey || '');

    return getRequiredMissingMeasurementInputs(measurementInputs, {
      ngStopTopicId,
      finalResultTopicKey
    })
      .map((input) => {
        const inputIndex = Number(input.dataset.inputIndex || 0) + 1;
        const suffix = input.dataset.inputType === 'pass_fail' ? '' : ` ช่องที่ ${inputIndex}`;

        return {
          input,
          label: `${input.dataset.topicName || 'หัวข้อ'} ชิ้นที่ ${input.dataset.pieceNo}${suffix}`
        };
      });
  }

  function updateMissingPanel(missingItems = [], noteMissing = false) {
    if (!missingPanel) {
      return;
    }

    measurementInputs.forEach((input) => setMissingState(input, false));
    missingItems.forEach(({ input }) => setMissingState(input, true));
    noteInput?.classList.toggle('is-missing', noteMissing);

    missingPanel.replaceChildren();

    if (!missingItems.length && !noteMissing) {
      missingPanel.hidden = true;
      return;
    }

    missingPanel.hidden = false;

    const title = document.createElement('strong');
    title.textContent = 'ยังกรอกฟอร์มตรวจมิติไม่ครบ';

    const list = document.createElement('ul');
    missingItems.slice(0, 8).forEach((item) => {
      const listItem = document.createElement('li');
      listItem.textContent = item.label;
      list.appendChild(listItem);
    });

    if (missingItems.length > 8) {
      const listItem = document.createElement('li');
      listItem.textContent = `และอีก ${missingItems.length - 8} ช่อง`;
      list.appendChild(listItem);
    }

    if (noteMissing) {
      const listItem = document.createElement('li');
      listItem.textContent = 'หมายเหตุเมื่อมีผลตรวจไม่ผ่าน';
      list.appendChild(listItem);
    }

    missingPanel.append(title, list);
  }

  function showMissingMeasurements() {
    const missingItems = getMissingMeasurementInputs();
    const noteMissing = requiresDimensionInspectionNote(collectPiecesData());
    hasShownMissingPanel = true;
    updateMissingPanel(missingItems, noteMissing);

    if (missingItems.length) {
      focusMeasurementTarget(missingItems[0].input);
      return false;
    }

    if (noteMissing) {
      noteInput?.focus();
      return false;
    }

    return true;
  }

  function focusMeasurementTarget(input) {
    if (input.type === 'hidden') {
      const button = input.closest('.dimension-pass-fail-control')?.querySelector('button');

      if (button) {
        button.focus();
      }

      return;
    }

    input.focus();
    input.select?.();
  }

  function focusNextMeasurementInput(currentInput) {
    const currentIndex = orderedMeasurementInputs.indexOf(currentInput);
    const nextInput = orderedMeasurementInputs.slice(currentIndex + 1).find((input) => !input.disabled);

    if (nextInput) {
      focusMeasurementTarget(nextInput);
    }
  }

  measurementInputs.forEach((input) => {
    input.addEventListener('input', () => {
      validateMeasurementInput(input);

      if (hasShownMissingPanel) {
        updateMissingPanel(
          getMissingMeasurementInputs(),
          requiresDimensionInspectionNote(collectPiecesData())
        );
      }
    });
    input.addEventListener('change', () => {
      validateMeasurementInput(input);

      if (hasShownMissingPanel) {
        updateMissingPanel(
          getMissingMeasurementInputs(),
          requiresDimensionInspectionNote(collectPiecesData())
        );
      }
    });
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') {
        return;
      }

      event.preventDefault();

      if (!validateMeasurementInput(input)) {
        input.reportValidity();
        return;
      }

      focusNextMeasurementInput(input);
    });
  });

  form.querySelectorAll('[data-pass-fail-option]').forEach((button) => {
    button.addEventListener('click', () => {
      const control = button.closest('.dimension-pass-fail-control');
      const input = control?.querySelector('[data-measurement-input]');

      if (!input) {
        return;
      }

      input.value = button.dataset.passFailOption || '';
      control.querySelectorAll('[data-pass-fail-option]').forEach((optionButton) => {
        optionButton.classList.toggle('active', optionButton === button);
        optionButton.classList.toggle('pass', optionButton === button && input.value === 'pass');
        optionButton.classList.toggle('fail', optionButton === button && input.value === 'fail');
      });
      validateMeasurementInput(input);
      syncDimensionNgPanel(input);

      if (hasShownMissingPanel) {
        updateMissingPanel(
          getMissingMeasurementInputs(),
          requiresDimensionInspectionNote(collectPiecesData())
        );
      }
      focusNextMeasurementInput(input);
    });
  });

  noteInput?.addEventListener('input', () => {
    if (hasShownMissingPanel) {
      updateMissingPanel(
        getMissingMeasurementInputs(),
        requiresDimensionInspectionNote(collectPiecesData())
      );
    }
  });

  function validateMeasurementInputs() {
    const invalidInput = measurementInputs.find((input) => !validateMeasurementInput(input));

    if (invalidInput) {
      invalidInput.reportValidity();
      invalidInput.focus();
      return false;
    }

    return true;
  }

  function hasFinalResultFailInForm() {
    return finalResultInputs.some((input) => input.value === 'fail');
  }

  function hasOtherFailInForm() {
    return measurementInputs.some((input) => (
      input.dataset.inputType === 'pass_fail'
      && input.dataset.finalResultTopic !== 'true'
      && input.value === 'fail'
    ));
  }

  function setDimensionNgPanelVisible(isVisible) {
    if (ngTopicPanel) {
      ngTopicPanel.hidden = !isVisible;
    }

    if (!ngTopicSelect) {
      return;
    }

    if (!isVisible) {
      ngTopicSelect.value = '';
      ngTopicSelect.setCustomValidity('');
    }

    const isReadOnly = ngTopicSelect.dataset.readOnly === 'true';
    ngTopicSelect.disabled = !isVisible || isReadOnly;
    ngTopicSelect.toggleAttribute('aria-disabled', ngTopicSelect.disabled);
  }

  function syncDimensionNgPanel(changedInput) {
    if (changedInput?.dataset.finalResultTopic !== 'true') {
      return;
    }

    setDimensionNgPanelVisible(hasFinalResultFailInForm());
  }

  function validateDimensionNgWorkflow() {
    finalResultInputs.forEach((input) => input.setCustomValidity(''));
    ngTopicSelect?.setCustomValidity('');

    if (hasOtherFailInForm() && !hasFinalResultFailInForm()) {
      const target = finalResultInputs[0];

      if (target) {
        target.setCustomValidity('กรุณาเลือกไม่ผ่านที่หัวข้อสรุปผลการตรวจ');
        hasShownMissingPanel = true;
        updateMissingPanel([{
          input: target,
          label: 'สรุปผลการตรวจ ต้องเลือกไม่ผ่านเมื่อพบงาน NG'
        }], requiresDimensionInspectionNote(collectPiecesData()));
        focusMeasurementTarget(target);
      }

      return false;
    }

    if (!hasFinalResultFailInForm()) {
      return true;
    }

    const hasSelectedTopic = Boolean(String(ngTopicSelect?.value || '').trim());
    ngTopicSelect?.setCustomValidity(
      hasSelectedTopic ? '' : 'กรุณาเลือกหัวข้อที่พบ NG'
    );

    if (!hasSelectedTopic) {
      ngTopicSelect?.reportValidity();
      ngTopicSelect?.focus();
    }

    return hasSelectedTopic;
  }

  function collectPiecesData() {
    const topicsMap = new Map();
    const formData = new FormData(form);
    const inspectionNote = String(formData.get('inspectionNote') || '').trim();
    const selectedNgStopTopicId = hasFinalResultFailInForm()
      ? String(ngTopicSelect?.value || '').trim()
      : '';
    const selectedNgStopOption = selectedNgStopTopicId
      ? Array.from(ngTopicSelect?.options || []).find(
        (option) => String(option.value) === selectedNgStopTopicId
      )
      : null;

    measurementInputs.forEach((input) => {
      const topicKey = input.dataset.topicKey;
      const pieceNo = Number(input.dataset.pieceNo);
      const inputIndex = Number(input.dataset.inputIndex);

      if (!topicsMap.has(topicKey)) {
        topicsMap.set(topicKey, {
          topicId: Number(topicKey) || topicKey,
          topicName: input.dataset.topicName || '',
          rows: []
        });
      }

      const topic = topicsMap.get(topicKey);
      let row = topic.rows.find((item) => item.pieceNo === pieceNo);

      if (!row) {
        row = { pieceNo, values: [] };
        topic.rows.push(row);
      }

      row.values[inputIndex] = String(input.value || '').trim();
    });

    const meta = { inspectionNote };

    if (selectedNgStopTopicId) {
      meta.ngStop = {
        topicId: Number(selectedNgStopTopicId) || selectedNgStopTopicId,
        topicName: String(selectedNgStopOption?.dataset.topicName || selectedNgStopOption?.textContent || '').trim()
      };
    }

    return {
      meta,
      topics: Array.from(topicsMap.values()).map((topic) => ({
        ...topic,
        rows: topic.rows.sort((a, b) => a.pieceNo - b.pieceNo)
      }))
    };
  }

  function collectFormValues() {
    const formData = new FormData(form);
    const brakeType = formData.get('brakeType');
    const brakeModel = formData.get('brakeModel');
    const shouldClearRivetHoleThickness = shouldDisableRivetHoleThickness({ brakeType, brakeModel });

    return {
      inspectionDate: formData.get('inspectionDate'),
      shift: formData.get('shift'),
      instrumentCodes: Array.from({ length: 5 }, (_, index) => {
        const input = form.querySelector(`[name="instrumentCode${index}"]`);
        const suffix = String(input?.value || '').trim();
        const prefix = String(input?.dataset.instrumentPrefix || getInstrumentPrefix(index)).trim();

        if (suffix === '-') {
          return '-';
        }

        return suffix ? `${prefix}${suffix}` : '';
      }),
      rivetNo: formData.get('rivetNo'),
      productionCode: formData.get('productionCode'),
      brakeType,
      brakeModel,
      rivetHoleThickness: shouldClearRivetHoleThickness ? '' : formData.get('rivetHoleThickness'),
      sampleCount: formData.get('sampleCount'),
      piecesData: collectPiecesData()
    };
  }

  function refreshMeasurementRules() {
    onFormValuesChange(collectFormValues());
  }

  form.querySelector('[data-refresh-measurement]')?.addEventListener('click', refreshMeasurementRules);
  form.querySelectorAll('input[name="brakeType"], input[name="brakeModel"]').forEach((input) => {
    input.addEventListener('change', refreshMeasurementRules);
  });

  ngTopicSelect?.addEventListener('change', () => {
    ngTopicSelect.setCustomValidity('');

    if (hasShownMissingPanel) {
      updateMissingPanel(
        getMissingMeasurementInputs(),
        requiresDimensionInspectionNote(collectPiecesData())
      );
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    if (!validateInstrumentSuffixInputs(event.currentTarget)) {
      return;
    }

    if (!validateMeasurementInputs()) {
      return;
    }

    updateMissingPanel([]);
    onDraftSave(collectFormValues());
  });

  form.querySelector('[data-complete-save]')?.addEventListener('click', () => {
    if (!validateDimensionNgWorkflow()) {
      return;
    }

    if (!validateInstrumentSuffixInputs(form)) {
      return;
    }

    if (!validateMeasurementInputs()) {
      return;
    }

    if (!showMissingMeasurements()) {
      return;
    }

    onCompleteSave(collectFormValues());
  });
}
