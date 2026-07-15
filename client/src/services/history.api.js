import { requestJson } from './auth.api.js';

function buildParams(params) {
  return new URLSearchParams(params).toString();
}

export function getLotHistory({ date, status, search, page, pageSize }) {
  const params = buildParams({
    date,
    status,
    search,
    page,
    pageSize
  });

  return requestJson(
    `/api/history/lots?${params}`,
    { useAuth: true },
    {
      error: 'ไม่สามารถโหลดประวัติ Lot ได้',
      invalid: 'ข้อมูลประวัติ Lot ที่ได้รับไม่ถูกต้อง'
    }
  );
}

export function getImportHistory({ date, search, page, pageSize }) {
  const params = buildParams({
    date,
    search,
    page,
    pageSize
  });

  return requestJson(
    `/api/history/imports?${params}`,
    { useAuth: true },
    {
      error: 'ไม่สามารถโหลดประวัติ Import ได้',
      invalid: 'ข้อมูลประวัติ Import ที่ได้รับไม่ถูกต้อง'
    }
  );
}

export function getAuditHistory({ date, action, search, page, pageSize }) {
  const params = buildParams({
    date,
    action,
    search,
    page,
    pageSize
  });

  return requestJson(
    `/api/history/audits?${params}`,
    { useAuth: true },
    {
      error: 'ไม่สามารถโหลดประวัติการแก้ไขได้',
      invalid: 'ข้อมูลประวัติการแก้ไขที่ได้รับไม่ถูกต้อง'
    }
  );
}
