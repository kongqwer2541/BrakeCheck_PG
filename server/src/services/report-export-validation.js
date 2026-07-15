const reportTabs = ['approved', 'confirmed_ng'];
const maxLotNumberLength = 20;

export function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function cleanText(value) {
  return String(value || '').trim();
}

function requireText(value, fieldName, maxLength) {
  const text = cleanText(value);

  if (!text) {
    throw createHttpError(400, `กรุณาระบุ${fieldName}`);
  }

  if (text.length > maxLength) {
    throw createHttpError(400, `${fieldName} ต้องไม่เกิน ${maxLength} ตัวอักษร`);
  }

  return text;
}

export function validateReportLotNumber(value) {
  const text = requireText(value, 'Lot', maxLotNumberLength);

  if (!/^[A-Za-z0-9-]+$/.test(text)) {
    throw createHttpError(400, 'Lot ใช้ได้เฉพาะตัวอักษรอังกฤษ ตัวเลข และขีดกลาง');
  }

  return text;
}

export function isReportExportTab(tab) {
  return reportTabs.includes(tab);
}

export function validateReportExportTab(value) {
  const tab = cleanText(value) || 'approved';

  if (!isReportExportTab(tab)) {
    throw createHttpError(400, 'แท็บส่งออกไม่ถูกต้อง');
  }

  return tab;
}

export function sanitizeReportFileNamePart(value) {
  const cleaned = cleanText(value).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-');
  return cleaned || 'report';
}
