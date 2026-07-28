export const lastPageStorageKey = 'brakecheck_last_page';

export const pagePermissions = {
  dashboard: ['head', 'assistant', 'officer'],
  barcode: ['head', 'assistant', 'officer'],
  dimension: ['head', 'assistant', 'officer'],
  packing: ['head', 'assistant', 'officer'],
  approval: ['head', 'assistant'],
  export: ['head', 'assistant'],
  exportDimension: ['head', 'assistant'],
  results: ['head', 'assistant', 'officer'],
  summary: ['head', 'assistant'],
  settings: ['head', 'assistant'],
  history: ['head', 'assistant', 'officer'],
  importExcel: ['head', 'assistant'],
  manualLot: ['head', 'assistant'],
  users: ['head']
};

export const sessionExpiredMessage = 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่';
export const permissionDeniedMessage = 'คุณไม่มีสิทธิ์ใช้งานส่วนนี้';
export const serverUnavailableMessage = 'ไม่สามารถเชื่อมต่อ server ได้ กรุณาตรวจสอบว่าเปิด server แล้ว';

export const maxExcelFileSizeMb = 10;
export const maxExcelFileSizeBytes = maxExcelFileSizeMb * 1024 * 1024;
