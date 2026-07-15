import { ApiError, authHeaders, requestJson } from './auth.api.js';

function getFileNameFromHeader(headerValue, fallback) {
  const match = String(headerValue || '').match(/filename="([^"]+)"/);
  return match?.[1] || fallback;
}

export function getExportDimensionPreview({
  model = '',
  productionStartDate = '',
  productionEndDate = '',
  inspectionStartDate = '',
  inspectionEndDate = '',
  topicNames = []
} = {}) {
  const params = new URLSearchParams();

  if (model) {
    params.set('model', model);
  }

  if (productionStartDate) {
    params.set('productionStartDate', productionStartDate);
  }

  if (productionEndDate) {
    params.set('productionEndDate', productionEndDate);
  }

  if (inspectionStartDate) {
    params.set('inspectionStartDate', inspectionStartDate);
  }

  if (inspectionEndDate) {
    params.set('inspectionEndDate', inspectionEndDate);
  }

  if (topicNames.length) {
    params.set('topicNames', topicNames.join(','));
  }

  return requestJson(
    `/api/export-dimension/preview?${params.toString()}`,
    { useAuth: true },
    {
      error: 'ไม่สามารถ Preview ข้อมูล Export Dimension ได้',
      invalid: 'ข้อมูล Preview Export Dimension จาก server ไม่ถูกต้อง'
    }
  );
}

export async function downloadExportDimensionExcel({ lotIds = [], topicNames = [] } = {}) {
  let response;

  try {
    response = await fetch('/api/export-dimension/excel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({ lotIds, topicNames })
    });
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อ server ได้ กรุณาตรวจสอบว่าเปิด server แล้ว', {
      status: 0
    });
  }

  if (!response.ok) {
    let message = 'ไม่สามารถ Export Dimension Excel ได้';

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
    'BrakeCheck_Dimension_History.xlsx'
  );
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
