import { requestJson } from './auth.api.js';

export function getInspectionQueue({ queueType, startDate, endDate, status, search, page, pageSize }) {
  const params = new URLSearchParams({
    startDate: startDate || '',
    endDate: endDate || '',
    status: status || 'all',
    search: search || '',
    page: String(page || 1),
    pageSize: pageSize || '50'
  });

  return requestJson(
    `/api/inspection-queues/${encodeURIComponent(queueType)}?${params.toString()}`,
    { useAuth: true },
    {
      error: 'ไม่สามารถโหลดคิวงานตรวจได้',
      invalid: 'ข้อมูลคิวงานตรวจจาก server ไม่ถูกต้อง'
    }
  );
}
