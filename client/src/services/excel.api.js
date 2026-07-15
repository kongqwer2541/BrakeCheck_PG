import { requestForm } from './auth.api.js';

function requestExcel(path, formData) {
  return requestForm(
    path,
    formData,
    {
      error: 'ไม่สามารถประมวลผลไฟล์ Excel ได้',
      invalid: 'ข้อมูลตอบกลับจากระบบนำเข้า Excel ไม่ถูกต้อง'
    }
  );
}

function createExcelFormData(file, confirmedProductionDates = []) {
  const formData = new FormData();
  formData.append('excelFile', file);

  if (confirmedProductionDates.length) {
    formData.append('confirmedProductionDates', JSON.stringify(confirmedProductionDates));
  }

  return formData;
}

export function previewExcelFile(file) {
  return requestExcel('/api/excel/preview', createExcelFormData(file));
}

export function importExcelFile(file, confirmedProductionDates = []) {
  return requestExcel('/api/excel/import', createExcelFormData(file, confirmedProductionDates));
}
