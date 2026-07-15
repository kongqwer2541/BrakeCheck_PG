import { requestJson } from './auth.api.js';

export function buildDashboardQueryString({ startDate, endDate, status, search, page, pageSize }) {
  const params = new URLSearchParams({
    date: endDate || startDate,
    startDate,
    endDate,
    status,
    search,
    page,
    pageSize
  });

  return params.toString();
}

export function getDashboardData({ startDate, endDate, status, search, page, pageSize }) {
  return requestJson(
    `/api/dashboard?${buildDashboardQueryString({ startDate, endDate, status, search, page, pageSize })}`,
    { useAuth: true },
    {
      error: 'ไม่สามารถโหลดข้อมูล Dashboard ได้',
      invalid: 'ข้อมูล Dashboard ที่ได้รับไม่ถูกต้อง'
    }
  );
}
