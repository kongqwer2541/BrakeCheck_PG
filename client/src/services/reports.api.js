import { ApiError, authHeaders, requestJson } from './auth.api.js';

export function getReportExportLots({ tab, date, search, page, pageSize }) {
  const params = new URLSearchParams({
    tab: tab || 'approved',
    date: date || 'all',
    search: search || '',
    page: String(page || 1),
    pageSize: pageSize || '50'
  });

  return requestJson(
    `/api/reports/export/lots?${params.toString()}`,
    { useAuth: true },
    {
      error: 'ไม่สามารถโหลดรายการส่งออกได้',
      invalid: 'ข้อมูลรายการส่งออกจาก server ไม่ถูกต้อง'
    }
  );
}

function getFileNameFromHeader(headerValue, fallback) {
  const match = String(headerValue || '').match(/filename="([^"]+)"/);
  return match?.[1] || fallback;
}

async function downloadLotReportFile({ lotNumber, format, fallbackExtension, defaultError }) {
  const response = await fetch(
    `/api/reports/export/lots/${encodeURIComponent(lotNumber)}/${format}`,
    {
      headers: authHeaders()
    }
  );

  if (!response.ok) {
    let message = defaultError;

    try {
      const errorData = await response.json();
      message = errorData?.message || message;
    } catch {
      // Keep the default friendly message for non-JSON download errors.
    }

    throw new ApiError(message, { status: response.status });
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = getFileNameFromHeader(
    response.headers.get('Content-Disposition'),
    `BrakeCheck_Report_${lotNumber}.${fallbackExtension}`
  );
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadLotReportExcel(lotNumber) {
  return downloadLotReportFile({
    lotNumber,
    format: 'excel',
    fallbackExtension: 'xlsx',
    defaultError: 'ไม่สามารถ Export Excel ได้'
  });
}

export function downloadLotReportPdf(lotNumber) {
  return downloadLotReportFile({
    lotNumber,
    format: 'pdf',
    fallbackExtension: 'pdf',
    defaultError: 'ไม่สามารถ Export PDF ได้'
  });
}
