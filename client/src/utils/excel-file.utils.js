import {
  maxExcelFileSizeBytes,
  maxExcelFileSizeMb
} from '../config/app.config.js';

export function isAllowedExcelFile(file) {
  const fileName = file?.name?.toLowerCase() || '';

  return fileName.endsWith('.xlsx') || fileName.endsWith('.xlsm');
}

export function getExcelFileKey(file) {
  if (!file) {
    return '';
  }

  return [
    file.name,
    file.size,
    file.lastModified
  ].join('|');
}

export function validateExcelFile(file) {
  if (!file) {
    return 'กรุณาเลือกไฟล์ Excel ก่อน';
  }

  if (!isAllowedExcelFile(file)) {
    return 'รองรับเฉพาะไฟล์ .xlsx และ .xlsm เท่านั้น';
  }

  if (file.size > maxExcelFileSizeBytes) {
    return `ไฟล์ Excel ต้องไม่เกิน ${maxExcelFileSizeMb}MB`;
  }

  return '';
}
