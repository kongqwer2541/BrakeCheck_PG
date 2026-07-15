import { requestJson } from './auth.api.js';

export function getResultsLots({ tab, dateMode, startDate, endDate, search, page, pageSize }) {
  const params = new URLSearchParams({
    tab: tab || 'approved',
    dateMode: dateMode || '',
    startDate: startDate || '',
    endDate: endDate || '',
    search: search || '',
    page: String(page || 1),
    pageSize: pageSize || '50'
  });

  return requestJson(
    `/api/results/lots?${params.toString()}`,
    { useAuth: true },
    {
      error: 'ไม่สามารถโหลด Results ได้',
      invalid: 'ข้อมูล Results จาก server ไม่ถูกต้อง'
    }
  );
}
