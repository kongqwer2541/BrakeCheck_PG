import { db } from '../config/database.js';
import { getLotApprovalEvidence } from './lot-approval-evidence.service.js';
import {
  cleanOptionalText,
  cleanText,
  createHttpError,
  maxTextLength,
  validateInspectionDate,
  validateInstrumentCodes,
  validateLotNumber,
  validateShift
} from './dimension-inspection-validation.js';

export { validateInstrumentCodes } from './dimension-inspection-validation.js';

const brakeTypes = ['normal', 'taper', 'sheet'];
const brakeModels = ['drilled_bored', 'no_hole'];
const rivetHoleThicknessOptions = [2, 2.5, 3, 3.5];
const defaultInstrumentCodePrefixes = ['A-01-', 'A-01-', 'A-07-', 'A-01-', 'A-01-'];
const maxJsonTextLength = 200000;

function normalizeInstrumentPrefixes(prefixRows = []) {
  if (!Array.isArray(prefixRows) || prefixRows.length !== 5) {
    throw createHttpError(500, 'ตั้งค่ารหัสเครื่องมือวัดไม่ครบ 5 ช่อง กรุณาตรวจหน้า settings');
  }

  const prefixes = prefixRows.map((item) => String(item?.prefix || '').trim());

  if (!prefixes.every((prefix) => /^A-\d{2}-$/.test(prefix))) {
    throw createHttpError(500, 'ตั้งค่ารหัสเครื่องมือวัดไม่ถูกต้อง กรุณาตรวจหน้า settings');
  }

  return prefixes;
}

async function getDimensionInstrumentPrefixes(connection) {
  try {
    const [rows] = await connection.execute(
      `SELECT slot_no, prefix
       FROM dimension_instrument_prefixes
       ORDER BY slot_no`
    );

    const prefixes = normalizeInstrumentPrefixes(rows);

    return prefixes.map((prefix, index) => ({
      slotNo: index + 1,
      prefix
    }));
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return defaultInstrumentCodePrefixes.map((prefix, index) => ({
        slotNo: index + 1,
        prefix
      }));
    }

    throw error;
  }
}

async function getSamplingRules(connection) {
  const [rows] = await connection.execute(
    `SELECT qty_min, qty_max, sample_count
     FROM sampling_rules
     ORDER BY qty_min, id`
  );

  return rows.map((row) => ({
    qtyMin: Number(row.qty_min || 0),
    qtyMax: row.qty_max === null || row.qty_max === undefined ? null : Number(row.qty_max),
    sampleCount: Number(row.sample_count || 0)
  }));
}

function validateOption(value, allowedValues, fieldName, isComplete) {
  const text = cleanText(value);

  if (!text) {
    if (isComplete) {
      throw createHttpError(400, `กรุณาเลือก${fieldName}`);
    }

    return null;
  }

  if (!allowedValues.includes(text)) {
    throw createHttpError(400, `${fieldName}ไม่ถูกต้อง`);
  }

  return text;
}

function validateRivetHoleThickness(value, isComplete, { brakeType, brakeModel } = {}) {
  if (brakeType === 'sheet' || brakeModel === 'no_hole') {
    return null;
  }

  if (value === null || value === undefined || value === '') {
    if (isComplete) {
      throw createHttpError(400, 'กรุณาเลือกขนาดความหนารูยึดรีเวท');
    }

    return null;
  }

  const thickness = Number(value);

  if (!rivetHoleThicknessOptions.includes(thickness)) {
    throw createHttpError(400, 'ขนาดความหนารูยึดรีเวทไม่ถูกต้อง');
  }

  return thickness;
}

function validateSampleCount(value, fallbackSampleCount, isComplete) {
  const sampleCount = value === null || value === undefined || value === ''
    ? Number(fallbackSampleCount || 0)
    : Number(value);

  if (!sampleCount) {
    if (isComplete) {
      throw createHttpError(400, 'ไม่พบจำนวนชิ้นสุ่มตรวจ');
    }

    return null;
  }

  if (!Number.isInteger(sampleCount) || sampleCount <= 0 || sampleCount > 999999) {
    throw createHttpError(400, 'จำนวนชิ้นสุ่มตรวจไม่ถูกต้อง');
  }

  return sampleCount;
}

function getConfiguredSampleCountForLot(lot, samplingRules = []) {
  const quantity = Number(lot?.quantity || 0);
  const rule = samplingRules.find((item) => (
    quantity >= Number(item.qtyMin || 0)
    && (item.qtyMax === null || item.qtyMax === undefined || quantity <= Number(item.qtyMax))
  ));

  return rule ? Number(rule.sampleCount || 0) : null;
}

function validateJsonValue(value, fieldName, isComplete) {
  if (value === null || value === undefined) {
    if (isComplete) {
      throw createHttpError(400, `กรุณาระบุ${fieldName}`);
    }

    return null;
  }

  if (typeof value !== 'object') {
    throw createHttpError(400, `${fieldName}ต้องเป็นข้อมูล JSON`);
  }

  let jsonText = '';

  try {
    jsonText = JSON.stringify(value);
  } catch {
    throw createHttpError(400, `${fieldName}ต้องเป็นข้อมูล JSON ที่บันทึกได้`);
  }

  if (jsonText.length > maxJsonTextLength) {
    throw createHttpError(400, `${fieldName}มีขนาดใหญ่เกินไป`);
  }

  return value;
}

function getMeasuredPieceSet(measurePieces) {
  const text = cleanText(measurePieces).toLowerCase();

  if (!text || text === 'all' || text === 'ทุกชิ้น') {
    return { mode: 'all', pieces: [] };
  }

  if (['first', 'first_only', 'piece_1', '1', 'เฉพาะชิ้นที่ 1'].includes(text)) {
    return { mode: 'custom', pieces: [1] };
  }

  const pieces = [];

  text.split(/[,| ]+/).forEach((value) => {
    const part = value.trim();
    const rangeMatch = part.match(/^(\d+)-(\d+)$/);

    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);

      if (Number.isInteger(start) && Number.isInteger(end) && start > 0 && end >= start) {
        for (let pieceNo = start; pieceNo <= end; pieceNo += 1) {
          pieces.push(pieceNo);
        }
      }
      return;
    }

    const pieceNo = Number(part);

    if (Number.isInteger(pieceNo) && pieceNo > 0) {
      pieces.push(pieceNo);
    }
  });

  return pieces.length ? { mode: 'custom', pieces } : { mode: 'all', pieces: [] };
}

export function shouldMeasurePiece(topic, pieceNo) {
  const measuredPieces = getMeasuredPieceSet(topic?.measurePieces);

  return measuredPieces.mode === 'all' || measuredPieces.pieces.includes(pieceNo);
}

function isHoleInspectionTopic(topic) {
  return topic?.ruleKey === 'hole_inspection' || String(topic?.topicName || '').includes('รูเจาะ/รูคว้าน');
}

export function shouldSkipTopicByWorkType(topic, input = {}) {
  return isHoleInspectionTopic(topic) && (
    input.brakeType === 'sheet' || input.brakeModel === 'no_hole'
  );
}

function shouldMeasureTopicCell(topic, pieceNo, input = {}) {
  return !shouldSkipTopicByWorkType(topic, input) && shouldMeasurePiece(topic, pieceNo);
}

function validateMeasurementValue(value, topic, fieldName) {
  const text = cleanText(value);

  if (!text) {
    return '';
  }

  if (topic.inputType === 'pass_fail') {
    if (!['pass', 'fail'].includes(text)) {
      throw createHttpError(400, `${fieldName}ต้องเป็น pass หรือ fail`);
    }

    return text;
  }

  const decimalPlaces = Number(topic.decimalPlaces || 0);
  const pattern = decimalPlaces === 0
    ? /^\d+$/
    : new RegExp(`^\\d+\\.\\d{${decimalPlaces}}$`);

  if (!pattern.test(text)) {
    throw createHttpError(400, `${fieldName}ต้องเป็นตัวเลขที่มีทศนิยม ${decimalPlaces} ตำแหน่ง`);
  }

  return text;
}

function getConfigTopicForInput(topicInput, configById, configByName) {
  const topicId = cleanText(topicInput?.topicId);
  const topicName = cleanText(topicInput?.topicName);

  return (topicId ? configById.get(topicId) : null) || (topicName ? configByName.get(topicName) : null);
}

function findPiecesTopic(piecesData, configTopic) {
  const topics = Array.isArray(piecesData?.topics) ? piecesData.topics : [];
  const topicId = String(configTopic.id);

  return topics.find((topic) => cleanText(topic?.topicId) === topicId)
    || topics.find((topic) => cleanText(topic?.topicName) === configTopic.topicName)
    || null;
}

function findPiecesRow(topicData, pieceNo) {
  const rows = Array.isArray(topicData?.rows) ? topicData.rows : [];

  return rows.find((row) => Number(row?.pieceNo) === pieceNo) || null;
}

function getPiecesValue(topicData, pieceNo, inputIndex) {
  const row = findPiecesRow(topicData, pieceNo);

  if (!Array.isArray(row?.values) || inputIndex >= row.values.length) {
    return undefined;
  }

  return row.values[inputIndex];
}

export function hasDimensionFailResult(piecesData) {
  const topics = Array.isArray(piecesData?.topics) ? piecesData.topics : [];

  return topics.some((topic) => (
    Array.isArray(topic?.rows)
    && topic.rows.some((row) => (
      Array.isArray(row?.values)
      && row.values.some((value) => value === 'fail')
    ))
  ));
}

function hasInspectionNoteField(piecesData) {
  return Boolean(
    piecesData
    && typeof piecesData === 'object'
    && piecesData.meta
    && typeof piecesData.meta === 'object'
    && Object.prototype.hasOwnProperty.call(piecesData.meta, 'inspectionNote')
  );
}

function cleanInspectionNoteFromPiecesData(piecesData) {
  if (!hasInspectionNoteField(piecesData)) {
    return null;
  }

  return cleanOptionalText(
    piecesData.meta.inspectionNote,
    'หมายเหตุการตรวจ',
    maxTextLength.inspectionNote
  ) || '';
}

function attachInspectionNote(piecesData, inspectionNote) {
  const normalizedPiecesData = {
    ...piecesData,
    topics: Array.isArray(piecesData?.topics) ? piecesData.topics : []
  };

  if (inspectionNote === null) {
    return normalizedPiecesData;
  }

  const meta = {};

  if (inspectionNote) {
    meta.inspectionNote = inspectionNote;
  } else {
    delete meta.inspectionNote;
  }

  if (Object.keys(meta).length) {
    normalizedPiecesData.meta = meta;
  } else {
    delete normalizedPiecesData.meta;
  }

  return normalizedPiecesData;
}

function attachInspectionSaveSnapshot(piecesData, status, user) {
  const normalizedPiecesData = {
    ...piecesData,
    topics: Array.isArray(piecesData?.topics) ? piecesData.topics : []
  };
  const meta = normalizedPiecesData.meta && typeof normalizedPiecesData.meta === 'object'
    ? { ...normalizedPiecesData.meta }
    : {};
  const keyPrefix = status === 'completed' ? 'completed' : 'draft';
  const savedByName = cleanOptionalText(
    user?.fullName || user?.employeeCode || user?.id,
    'ชื่อผู้บันทึก',
    maxTextLength.userName
  ) || '';
  const savedByPosition = cleanOptionalText(
    user?.position,
    'ตำแหน่งผู้บันทึก',
    maxTextLength.userPosition
  ) || '';

  meta[`${keyPrefix}SavedByName`] = savedByName;
  meta[`${keyPrefix}SavedAt`] = new Date().toISOString();

  if (savedByPosition) {
    meta[`${keyPrefix}SavedByPosition`] = savedByPosition;
  } else {
    delete meta[`${keyPrefix}SavedByPosition`];
  }

  normalizedPiecesData.meta = meta;
  return normalizedPiecesData;
}

function mergeDraftPiecesData(existingPiecesData, incomingPiecesData, formConfig, sampleCount, input = {}) {
  const safeSampleCount = Number(sampleCount || 0);
  const inspectionNote = hasInspectionNoteField(incomingPiecesData)
    ? cleanInspectionNoteFromPiecesData(incomingPiecesData)
    : cleanInspectionNoteFromPiecesData(existingPiecesData);

  if (!Array.isArray(formConfig) || !formConfig.length || !Number.isInteger(safeSampleCount) || safeSampleCount <= 0) {
    return attachInspectionNote(incomingPiecesData, inspectionNote);
  }

  const topics = [];

  formConfig.forEach((configTopic) => {
    const inputCount = Number(configTopic.inputCount || 0);

    if (!Number.isInteger(inputCount) || inputCount <= 0) {
      return;
    }

    const existingTopic = findPiecesTopic(existingPiecesData, configTopic);
    const incomingTopic = findPiecesTopic(incomingPiecesData, configTopic);
    const rows = [];

    for (let pieceNo = 1; pieceNo <= safeSampleCount; pieceNo += 1) {
      if (!shouldMeasureTopicCell(configTopic, pieceNo, input)) {
        continue;
      }

      const values = Array.from({ length: inputCount }, (_, inputIndex) => {
        const incomingValue = getPiecesValue(incomingTopic, pieceNo, inputIndex);

        if (incomingValue !== undefined) {
          return incomingValue;
        }

        const existingValue = getPiecesValue(existingTopic, pieceNo, inputIndex);
        return existingValue !== undefined ? existingValue : '';
      });

      if (values.some((value) => cleanText(value))) {
        rows.push({ pieceNo, values });
      }
    }

    if (rows.length) {
      topics.push({
        topicId: configTopic.id,
        topicName: configTopic.topicName,
        rows
      });
    }
  });

  return attachInspectionNote({ topics }, inspectionNote);
}

function requireCompletePiecesData(piecesData, formConfig, sampleCount, input = {}) {
  const safeSampleCount = Number(sampleCount || 0);

  if (!Array.isArray(formConfig) || !formConfig.length || !Number.isInteger(safeSampleCount) || safeSampleCount <= 0) {
    throw createHttpError(400, 'ยังไม่มีหัวข้อฟอร์มตรวจมิติสำหรับบันทึกสมบูรณ์');
  }

  let requiredCellCount = 0;

  for (const configTopic of formConfig) {
    const inputCount = Number(configTopic.inputCount || 0);

    if (!Number.isInteger(inputCount) || inputCount <= 0) {
      throw createHttpError(400, `หัวข้อ ${configTopic.topicName} ยังไม่ได้กำหนดจำนวนช่องกรอก`);
    }

    const topicData = findPiecesTopic(piecesData, configTopic);

    for (let pieceNo = 1; pieceNo <= safeSampleCount; pieceNo += 1) {
      if (!shouldMeasureTopicCell(configTopic, pieceNo, input)) {
        continue;
      }

      for (let inputIndex = 0; inputIndex < inputCount; inputIndex += 1) {
        requiredCellCount += 1;

        if (!cleanText(getPiecesValue(topicData, pieceNo, inputIndex))) {
          throw createHttpError(
            400,
            `กรุณากรอกหัวข้อ ${configTopic.topicName} ชิ้นที่ ${pieceNo} ช่องที่ ${inputIndex + 1} ให้ครบก่อนบันทึกสมบูรณ์`
          );
        }
      }
    }
  }

  if (!requiredCellCount) {
    throw createHttpError(400, 'ไม่มีช่องตรวจมิติที่ต้องกรอกสำหรับบันทึกสมบูรณ์');
  }
}

function validatePiecesData(piecesData, formConfig, sampleCount, isComplete, input = {}) {
  if (piecesData === null) {
    return null;
  }

  const topics = Array.isArray(piecesData?.topics) ? piecesData.topics : [];
  const inspectionNote = cleanInspectionNoteFromPiecesData(piecesData);

  if (!topics.length) {
    if (isComplete) {
      throw createHttpError(400, 'ข้อมูลชิ้นงานที่วัดต้องมีอย่างน้อย 1 หัวข้อ');
    }

    return attachInspectionNote({ topics: [] }, inspectionNote);
  }

  if (!Array.isArray(formConfig) || !formConfig.length) {
    throw createHttpError(400, 'ยังไม่มีหัวข้อฟอร์มตรวจมิติสำหรับตรวจสอบข้อมูลชิ้นงาน');
  }

  const safeSampleCount = Number(sampleCount || 0);

  if (!Number.isInteger(safeSampleCount) || safeSampleCount <= 0) {
    throw createHttpError(400, 'ไม่พบจำนวนชิ้นสุ่มตรวจสำหรับตรวจสอบข้อมูลชิ้นงาน');
  }

  const configById = new Map(formConfig.map((topic) => [String(topic.id), topic]));
  const configByName = new Map(formConfig.map((topic) => [topic.topicName, topic]));
  const seenTopicIds = new Set();

  const normalizedTopics = topics.map((topicInput, topicIndex) => {
    const topic = getConfigTopicForInput(topicInput, configById, configByName);

    if (!topic) {
      throw createHttpError(400, `หัวข้อค่าตรวจลำดับที่ ${topicIndex + 1} ไม่ตรงกับ config ปัจจุบัน`);
    }

    const topicKey = String(topic.id);

    if (seenTopicIds.has(topicKey)) {
      throw createHttpError(400, `หัวข้อ ${topic.topicName} ซ้ำในข้อมูลชิ้นงาน`);
    }

    seenTopicIds.add(topicKey);

    const inputCount = Number(topic.inputCount || 0);
    const rows = Array.isArray(topicInput?.rows) ? topicInput.rows : [];
    const seenPieces = new Set();

    if (!Number.isInteger(inputCount) || inputCount <= 0) {
      throw createHttpError(400, `หัวข้อ ${topic.topicName} ยังไม่ได้กำหนดจำนวนช่องกรอก`);
    }

    const normalizedRows = rows.map((rowInput) => {
      const pieceNo = Number(rowInput?.pieceNo);

      if (!Number.isInteger(pieceNo) || pieceNo <= 0 || pieceNo > safeSampleCount) {
        throw createHttpError(400, `ชิ้นที่วัดของหัวข้อ ${topic.topicName} ไม่ถูกต้อง`);
      }

      if (!shouldMeasureTopicCell(topic, pieceNo, input)) {
        throw createHttpError(400, `หัวข้อ ${topic.topicName} ไม่ต้องวัดชิ้นที่ ${pieceNo}`);
      }

      if (seenPieces.has(pieceNo)) {
        throw createHttpError(400, `หัวข้อ ${topic.topicName} มีชิ้นที่ ${pieceNo} ซ้ำ`);
      }

      seenPieces.add(pieceNo);

      const values = Array.isArray(rowInput?.values) ? rowInput.values : [];

      if (values.length > inputCount) {
        throw createHttpError(400, `หัวข้อ ${topic.topicName} มีจำนวนช่องมากกว่า config`);
      }

      return {
        pieceNo,
        values: Array.from({ length: inputCount }, (_, inputIndex) => (
          validateMeasurementValue(values[inputIndex], topic, `หัวข้อ ${topic.topicName} ชิ้นที่ ${pieceNo} ช่องที่ ${inputIndex + 1}`)
        ))
      };
    });

    if (isComplete && !normalizedRows.length) {
      throw createHttpError(400, `หัวข้อ ${topic.topicName} ยังไม่มีข้อมูลชิ้นงาน`);
    }

    return {
      topicId: topic.id,
      topicName: topic.topicName,
      rows: normalizedRows.sort((a, b) => a.pieceNo - b.pieceNo)
    };
  });

  return attachInspectionNote({ topics: normalizedTopics }, inspectionNote);
}

function hasJsonContent(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return value && typeof value === 'object' && Object.keys(value).length > 0;
}

function requireCompleteJsonContent({ formConfigSnapshot, piecesData }) {
  if (!hasJsonContent(formConfigSnapshot)) {
    throw createHttpError(400, 'Snapshot โครงฟอร์มต้องมีข้อมูลอย่างน้อย 1 รายการ');
  }

  if (!hasJsonContent(piecesData)) {
    throw createHttpError(400, 'ข้อมูลชิ้นงานที่วัดต้องมีข้อมูลอย่างน้อย 1 รายการ');
  }
}

async function resolveCompleteFormConfigSnapshot(currentInspection, connection) {
  const existingSnapshot = parseJsonColumn(currentInspection?.form_config_snapshot);

  if (currentInspection?.status === 'completed' && hasJsonContent(existingSnapshot)) {
    return existingSnapshot;
  }

  return getActiveDimensionFormConfig(connection);
}

function requireActorUser(user) {
  if (!user?.id) {
    throw createHttpError(401, 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
  }

  return user.id;
}

export function canEditCompletedDimensionInspection(user, lotStatus = '') {
  if (['head', 'assistant'].includes(user?.role)) {
    return true;
  }

  return user?.role === 'officer' && lotStatus === 'need_fix';
}

function requireEditableInspection({ lot, inspection, user }) {
  if (!lot) {
    throw createHttpError(404, 'ไม่พบ Lot ที่ต้องการ');
  }

  if (lot.status === 'void') {
    throw createHttpError(409, 'Lot นี้ถูก Void แล้ว ไม่สามารถบันทึกฟอร์มตรวจมิติได้');
  }

  if (lot.status === 'approved') {
    throw createHttpError(409, 'Lot นี้ Approved แล้ว ต้องยกเลิก Approved ก่อนจึงจะแก้ไขได้');
  }

  if (inspection?.status === 'completed' && !canEditCompletedDimensionInspection(user, lot.status)) {
    throw createHttpError(403, 'ใบตรวจมิติบันทึกสมบูรณ์แล้ว ต้องเป็นงานที่ถูกส่งกลับหรือผู้ช่วยหัวหน้าขึ้นไปเท่านั้นที่แก้ไขได้');
  }
}

function requireValidStatusTransition({ currentInspection, nextStatus }) {
  if (currentInspection?.status === 'completed' && nextStatus === 'draft') {
    throw createHttpError(409, 'ใบตรวจมิติบันทึกสมบูรณ์แล้ว ไม่สามารถย้อนกลับเป็นบันทึกชั่วคราวได้');
  }
}

function normalizeInspectionInput(input = {}, lot, isComplete, {
  configuredSampleCount = null
} = {}) {
  const formConfigSnapshot = isComplete
    ? null
    : validateJsonValue(input.formConfigSnapshot, 'Snapshot โครงฟอร์ม', false);
  const piecesData = validateJsonValue(input.piecesData, 'ข้อมูลชิ้นงานที่วัด', isComplete);

  const brakeType = validateOption(input.brakeType, brakeTypes, 'ประเภทผ้าเบรก', isComplete);
  const brakeModel = validateOption(input.brakeModel, brakeModels, 'แบบผ้าเบรก', isComplete);

  return {
    inspectionDate: validateInspectionDate(input.inspectionDate, isComplete),
    shift: validateShift(input.shift, isComplete),
    instrumentCodes: validateInstrumentCodes(input.instrumentCodes, isComplete),
    rivetNo: cleanOptionalText(input.rivetNo, 'รีเวท No.', maxTextLength.rivetNo),
    productionCode: cleanOptionalText(input.productionCode, 'รหัสผลิต', maxTextLength.productionCode),
    brakeType,
    brakeModel,
    rivetHoleThickness: validateRivetHoleThickness(input.rivetHoleThickness, isComplete, { brakeType, brakeModel }),
    sampleCount: validateSampleCount(configuredSampleCount, lot.sample_count, isComplete),
    formConfigSnapshot,
    piecesData
  };
}

function toDateText(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return value.slice(0, 10);
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return String(value).slice(0, 10);
}

function parseJsonColumn(value, fallback = null) {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function getLotStatusLabel(status) {
  const statusLabels = {
    pending: 'รอตรวจ',
    temp: 'กำลังตรวจ',
    waiting_pack: 'รอตรวจบรรจุ',
    waiting_approve: 'รออนุมัติ',
    need_fix: 'รอแก้ไข',
    approved: 'Approved',
    ng: 'NG',
    void: 'Void'
  };

  return statusLabels[status] || status || '-';
}

function mapInspection(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    status: row.status,
    inspectionDate: toDateText(row.inspection_date),
    shift: row.shift || '',
    instrumentCodes: parseJsonColumn(row.instrument_codes, []),
    rivetNo: row.rivet_no || '',
    productionCode: row.production_code || '',
    brakeType: row.brake_type || '',
    brakeModel: row.brake_model || '',
    rivetHoleThickness: row.rivet_hole_thickness === null ? null : Number(row.rivet_hole_thickness),
    sampleCount: row.sample_count === null ? null : Number(row.sample_count),
    formConfigSnapshot: parseJsonColumn(row.form_config_snapshot),
    piecesData: parseJsonColumn(row.pieces_data),
    completedBy: row.completed_by,
    completedByName: row.completed_by_name || '',
    completedByPosition: row.completed_by_position || '',
    completedAt: row.completed_at,
    updatedBy: row.updated_by,
    updatedByName: row.updated_by_name || '',
    updatedByPosition: row.updated_by_position || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapLot(row) {
  return {
    lotNumber: row.lot_number,
    lotPackBarcode: row.lot_pack_barcode || '',
    lotPacking: row.lot_packing || '-',
    purchaseOrder: row.purchase_order || '',
    code: row.code || '',
    modelName: row.model_name || '',
    dimension: row.dimension || '',
    aciGrade: row.aci_grade || '',
    quantity: Number(row.quantity || 0),
    productionDate: toDateText(row.production_date) || '',
    drillSize: row.drill_size ?? '',
    boreSize: row.bore_size ?? '',
    rivetNo: row.rivet_no || '',
    status: row.status,
    statusLabel: getLotStatusLabel(row.status),
    sampleCount: Number(row.sample_count || 0)
  };
}

function getLotStatusSnapshot(lot) {
  if (!lot) {
    return null;
  }

  return {
    lotNumber: lot.lot_number,
    status: lot.status
  };
}

function getNextLotStatusForInspection(status, piecesData) {
  if (status === 'draft') {
    return 'temp';
  }

  return hasDimensionFailResult(piecesData) ? 'ng' : 'waiting_pack';
}

function getDimensionStatusMessage(nextLotStatus, status) {
  if (status === 'draft') {
    return 'บันทึกฟอร์มตรวจมิติชั่วคราวแล้ว';
  }

  if (nextLotStatus === 'ng') {
    return 'บันทึกฟอร์มตรวจมิติสมบูรณ์แล้ว พบผลไม่ผ่าน';
  }

  return 'บันทึกฟอร์มตรวจมิติสมบูรณ์แล้ว รอตรวจบรรจุ';
}

async function insertDimensionStatusAuditLog({
  lot,
  beforeStatus,
  afterStatus,
  userId,
  connection
}) {
  await connection.execute(
    `INSERT INTO lot_audit_logs (
       lot_id,
       action,
       reason,
       before_data,
       after_data,
       changed_by
     )
     VALUES (?, 'edit', ?, ?, ?, ?)`,
    [
      lot.id,
      `ตรวจมิติเปลี่ยนสถานะ Lot: ${getLotStatusLabel(beforeStatus)} -> ${getLotStatusLabel(afterStatus)}`,
      JSON.stringify({ ...getLotStatusSnapshot(lot), status: beforeStatus }),
      JSON.stringify({ ...getLotStatusSnapshot(lot), status: afterStatus }),
      userId
    ]
  );
}

async function updateLotStatusForInspection({
  lot,
  nextStatus,
  userId,
  connection
}) {
  if (lot.status === nextStatus) {
    return;
  }

  const beforeStatus = lot.status;

  await connection.execute(
    `UPDATE lots
     SET status = ?
     WHERE id = ?`,
    [nextStatus, lot.id]
  );

  await insertDimensionStatusAuditLog({
    lot,
    beforeStatus,
    afterStatus: nextStatus,
    userId,
    connection
  });

  lot.status = nextStatus;
}

async function findLotForInspection(lotNumber, connection, lock = false) {
  const [rows] = await connection.execute(
    `SELECT
       id,
       lot_number,
       lot_pack_barcode,
       lot_packing,
       purchase_order,
       code,
       model_name,
       dimension,
       aci_grade,
       quantity,
       production_date,
       drill_size,
       bore_size,
       rivet_no,
       status,
       sample_count
     FROM lots
     WHERE lot_number = ?
     LIMIT 1
     ${lock ? 'FOR UPDATE' : ''}`,
    [lotNumber]
  );

  return rows[0] || null;
}

async function getActiveDimensionFormConfig(connection) {
  let rows = [];

  try {
    [rows] = await connection.execute(
      `SELECT
         id,
         topic_name,
         input_count,
         decimal_places,
         input_type,
         measure_pieces,
         rule_key,
         display_order
       FROM form_config
       WHERE form_type = 'dimension'
         AND is_active = TRUE
       ORDER BY display_order, id`
    );
  } catch (error) {
    if (error?.code !== 'ER_BAD_FIELD_ERROR') {
      throw error;
    }

    [rows] = await connection.execute(
      `SELECT
         id,
         topic_name,
         input_count,
         decimal_places,
         input_type,
         measure_pieces,
         display_order
       FROM form_config
       WHERE form_type = 'dimension'
         AND is_active = TRUE
       ORDER BY display_order, id`
    );
  }

  return rows.map((row) => ({
    id: row.id,
    topicName: row.topic_name,
    inputCount: Number(row.input_count || 0),
    decimalPlaces: Number(row.decimal_places || 0),
    inputType: row.input_type,
    measurePieces: row.measure_pieces,
    ruleKey: row.rule_key || '',
    displayOrder: Number(row.display_order || 0)
  }));
}

async function findInspectionByLotId(lotId, connection, lock = false) {
  if (lock) {
    const [lockedRows] = await connection.execute(
      `SELECT
         id,
         status,
         inspection_date,
         shift,
         instrument_codes,
         rivet_no,
         production_code,
         brake_type,
         brake_model,
         rivet_hole_thickness,
         sample_count,
         form_config_snapshot,
         pieces_data,
         updated_by,
         completed_by,
         completed_at,
         created_at,
         updated_at
       FROM dimension_inspections
       WHERE lot_id = ?
       LIMIT 1
       FOR UPDATE`,
      [lotId]
    );

    return lockedRows[0] || null;
  }

  const [rows] = await connection.execute(
    `SELECT
       dimension_inspections.id,
       dimension_inspections.status,
       dimension_inspections.inspection_date,
       dimension_inspections.shift,
       dimension_inspections.instrument_codes,
       dimension_inspections.rivet_no,
       dimension_inspections.production_code,
       dimension_inspections.brake_type,
       dimension_inspections.brake_model,
       dimension_inspections.rivet_hole_thickness,
       dimension_inspections.sample_count,
       dimension_inspections.form_config_snapshot,
       dimension_inspections.pieces_data,
       dimension_inspections.updated_by,
       updated_user.full_name AS updated_by_name,
       updated_user.position AS updated_by_position,
       dimension_inspections.completed_by,
       completed_user.full_name AS completed_by_name,
       completed_user.position AS completed_by_position,
       dimension_inspections.completed_at,
       dimension_inspections.created_at,
       dimension_inspections.updated_at
     FROM dimension_inspections
     LEFT JOIN users updated_user
       ON updated_user.id = dimension_inspections.updated_by
     LEFT JOIN users completed_user
       ON completed_user.id = dimension_inspections.completed_by
     WHERE dimension_inspections.lot_id = ?
     LIMIT 1`,
    [lotId]
  );

  return rows[0] || null;
}

async function upsertInspection({ lot, input, userId, status, connection }) {
  const completedBy = status === 'completed' ? userId : null;
  const completedAtSql = status === 'completed' ? 'NOW()' : 'NULL';

  await connection.execute(
    `INSERT INTO dimension_inspections (
       lot_id,
       status,
       inspection_date,
       shift,
       instrument_codes,
       rivet_no,
       production_code,
       brake_type,
       brake_model,
       rivet_hole_thickness,
       sample_count,
       form_config_snapshot,
       pieces_data,
       created_by,
       updated_by,
       completed_by,
       completed_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${completedAtSql})
     ON DUPLICATE KEY UPDATE
       status = VALUES(status),
       inspection_date = VALUES(inspection_date),
       shift = VALUES(shift),
       instrument_codes = VALUES(instrument_codes),
       rivet_no = VALUES(rivet_no),
       production_code = VALUES(production_code),
       brake_type = VALUES(brake_type),
       brake_model = VALUES(brake_model),
       rivet_hole_thickness = VALUES(rivet_hole_thickness),
       sample_count = VALUES(sample_count),
       form_config_snapshot = VALUES(form_config_snapshot),
       pieces_data = VALUES(pieces_data),
       updated_by = VALUES(updated_by),
       completed_by = VALUES(completed_by),
       completed_at = ${completedAtSql}`,
    [
      lot.id,
      status,
      input.inspectionDate,
      input.shift,
      input.instrumentCodes ? JSON.stringify(input.instrumentCodes) : null,
      input.rivetNo,
      input.productionCode,
      input.brakeType,
      input.brakeModel,
      input.rivetHoleThickness,
      input.sampleCount,
      input.formConfigSnapshot ? JSON.stringify(input.formConfigSnapshot) : null,
      input.piecesData ? JSON.stringify(input.piecesData) : null,
      userId,
      userId,
      completedBy
    ]
  );
}

export async function getDimensionInspection({ lotNumber }) {
  const cleanedLotNumber = validateLotNumber(lotNumber);
  const lot = await findLotForInspection(cleanedLotNumber, db);

  if (!lot) {
    throw createHttpError(404, 'ไม่พบ Lot ที่ต้องการ');
  }

  const inspection = await findInspectionByLotId(lot.id, db);
  const formConfig = await getActiveDimensionFormConfig(db);
  const instrumentPrefixes = await getDimensionInstrumentPrefixes(db);
  const samplingRules = await getSamplingRules(db);
  const approvalEvidence = await getLotApprovalEvidence(lot.id, db);

  return {
    ok: true,
    lot: {
      ...mapLot(lot),
      approvalEvidence
    },
    inspection: mapInspection(inspection),
    formConfig,
    instrumentPrefixes,
    samplingRules
  };
}

export async function saveDimensionInspectionDraft({ lotNumber, input, user }) {
  return saveDimensionInspection({
    lotNumber,
    input,
    user,
    status: 'draft',
    isComplete: false,
    message: 'บันทึกฟอร์มตรวจมิติชั่วคราวแล้ว'
  });
}

export async function completeDimensionInspection({ lotNumber, input, user }) {
  return saveDimensionInspection({
    lotNumber,
    input,
    user,
    status: 'completed',
    isComplete: true,
    message: 'บันทึกฟอร์มตรวจมิติสมบูรณ์แล้ว'
  });
}

async function saveDimensionInspection({ lotNumber, input, user, status, isComplete, message }) {
  const cleanedLotNumber = validateLotNumber(lotNumber);
  const actorUserId = requireActorUser(user);
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const lot = await findLotForInspection(cleanedLotNumber, connection, true);
    const currentInspection = lot ? await findInspectionByLotId(lot.id, connection, true) : null;
    requireEditableInspection({ lot, inspection: currentInspection, user });
    requireValidStatusTransition({ currentInspection, nextStatus: status });

    const samplingRules = await getSamplingRules(connection);
    const configuredSampleCount = getConfiguredSampleCountForLot(lot, samplingRules);
    const normalizedInput = normalizeInspectionInput(input, lot, isComplete, {
      configuredSampleCount
    });
    const activeFormConfig = await getActiveDimensionFormConfig(connection);
    const piecesDataConfig = isComplete
      ? await resolveCompleteFormConfigSnapshot(currentInspection, connection)
      : activeFormConfig;

    if (isComplete) {
      normalizedInput.formConfigSnapshot = piecesDataConfig;
      requireCompleteJsonContent(normalizedInput);
    }

    const incomingPiecesData = validatePiecesData(
      normalizedInput.piecesData,
      piecesDataConfig,
      normalizedInput.sampleCount,
      isComplete,
      normalizedInput
    );

    if (isComplete) {
      const existingPiecesData = parseJsonColumn(currentInspection?.pieces_data, { topics: [] });
      const inspectionNote = hasInspectionNoteField(normalizedInput.piecesData)
        ? cleanInspectionNoteFromPiecesData(normalizedInput.piecesData)
        : cleanInspectionNoteFromPiecesData(existingPiecesData);

      normalizedInput.piecesData = attachInspectionNote(incomingPiecesData, inspectionNote);
      requireCompletePiecesData(
        normalizedInput.piecesData,
        piecesDataConfig,
        normalizedInput.sampleCount,
        normalizedInput
      );
    } else {
      const existingPiecesData = parseJsonColumn(currentInspection?.pieces_data, { topics: [] });
      const mergedPiecesData = mergeDraftPiecesData(
        existingPiecesData,
        incomingPiecesData,
        piecesDataConfig,
        normalizedInput.sampleCount,
        normalizedInput
      );

      normalizedInput.piecesData = validatePiecesData(
        mergedPiecesData,
        piecesDataConfig,
        normalizedInput.sampleCount,
        false,
        normalizedInput
      );
    }

    normalizedInput.piecesData = attachInspectionSaveSnapshot(
      normalizedInput.piecesData,
      status,
      user
    );
    const nextLotStatus = getNextLotStatusForInspection(status, normalizedInput.piecesData);

    await upsertInspection({
      lot,
      input: normalizedInput,
      userId: actorUserId,
      status,
      connection
    });

    await updateLotStatusForInspection({
      lot,
      nextStatus: nextLotStatus,
      userId: actorUserId,
      connection
    });

    const savedInspection = await findInspectionByLotId(lot.id, connection);

    await connection.commit();

    return {
      ok: true,
      message: getDimensionStatusMessage(nextLotStatus, status) || message,
      lot: mapLot(lot),
      inspection: mapInspection(savedInspection)
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
