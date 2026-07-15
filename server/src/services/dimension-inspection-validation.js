export const maxTextLength = {
  lotNumber: 20,
  instrumentCode: 50,
  rivetNo: 50,
  productionCode: 50,
  inspectionNote: 200,
  userName: 100,
  userPosition: 100
};

export function createHttpError(statusCode, message, details = null) {
  const error = new Error(message);
  error.statusCode = statusCode;

  if (details) {
    error.details = details;
  }

  return error;
}

export function cleanText(value) {
  return String(value || '').trim();
}

export function cleanOptionalText(value, fieldName, maxLength) {
  const text = cleanText(value);

  if (!text) {
    return null;
  }

  if (text.length > maxLength) {
    throw createHttpError(400, `${fieldName}ยาวเกิน ${maxLength} ตัวอักษร`);
  }

  return text;
}

export function validateLotNumber(value) {
  const text = cleanText(value);

  if (!text) {
    throw createHttpError(400, 'กรุณาระบุ Lot');
  }

  if (text.length > maxTextLength.lotNumber) {
    throw createHttpError(400, `Lot ยาวเกิน ${maxTextLength.lotNumber} ตัวอักษร`);
  }

  if (!/^[A-Za-z0-9-]+$/.test(text)) {
    throw createHttpError(400, 'Lot ใช้ได้เฉพาะตัวอักษรอังกฤษ ตัวเลข และขีดกลาง');
  }

  return text;
}

export function validateInspectionDate(value, isComplete) {
  const text = cleanText(value);

  if (!text) {
    if (isComplete) {
      throw createHttpError(400, 'กรุณาระบุวันที่ตรวจสอบ');
    }

    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw createHttpError(400, 'วันที่ตรวจสอบไม่ถูกต้อง');
  }

  const [year, month, day] = text.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw createHttpError(400, 'วันที่ตรวจสอบไม่ถูกต้อง');
  }

  return text;
}

export function validateShift(value, isComplete) {
  const text = cleanText(value);

  if (!text) {
    if (isComplete) {
      throw createHttpError(400, 'กรุณาเลือกกะ');
    }

    return null;
  }

  if (!['1', '2'].includes(text)) {
    throw createHttpError(400, 'กะต้องเป็น 1 หรือ 2 เท่านั้น');
  }

  return text;
}

export function validateInstrumentCodes(value, isComplete) {
  if (!Array.isArray(value)) {
    if (isComplete) {
      throw createHttpError(400, 'กรุณาระบุรหัสเครื่องมือวัด 5 รายการ');
    }

    return null;
  }

  if (value.length !== 5) {
    throw createHttpError(400, 'รหัสเครื่องมือวัดต้องมี 5 รายการ');
  }

  const cleanedCodes = value.map((item, index) => {
    const cleanedCode = cleanOptionalText(
      item,
      `รหัสเครื่องมือวัดรายการที่ ${index + 1}`,
      maxTextLength.instrumentCode
    );
    const code = cleanedCode ? cleanedCode.toUpperCase() : '';

    if (isComplete && !code) {
      throw createHttpError(400, `กรุณาระบุรหัสเครื่องมือวัดรายการที่ ${index + 1}`);
    }

    if (code === '-') {
      return code;
    }

    if (code && !/^A-\d{2}-\d{3}$/.test(code)) {
      throw createHttpError(400, `รหัสเครื่องมือวัดรายการที่ ${index + 1} ต้องอยู่ในรูปแบบ A-00-000`);
    }

    return code || '';
  });

  return cleanedCodes;
}
