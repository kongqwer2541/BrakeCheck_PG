import { ApiError, authHeaders, requestForm, requestJson } from './auth.api.js';

function ensureLotResponse(response) {
  if (!response?.lot?.lotNumber) {
    throw new ApiError('ข้อมูล Lot จาก server ไม่ถูกต้อง', {
      status: 0
    });
  }

  return response;
}

function normalizeNumericLookup(value) {
  return String(value || '').replace(/\s+/g, '');
}

export function createManualLot(lot) {
  return requestJson(
    '/api/lots/manual',
    {
      method: 'POST',
      useAuth: true,
      body: JSON.stringify(lot)
    },
    {
      error: 'ไม่สามารถเพิ่ม Manual Lot ได้',
      invalid: 'ข้อมูลตอบกลับจาก server ไม่ถูกต้อง'
    }
  );
}

export async function getLot(lotNumber) {
  const response = await requestJson(
    `/api/lots/${encodeURIComponent(lotNumber)}`,
    {
      useAuth: true
    },
    {
      error: 'ไม่สามารถโหลดข้อมูล Lot ได้',
      invalid: 'ข้อมูลตอบกลับจาก server ไม่ถูกต้อง'
    }
  );

  return ensureLotResponse(response);
}

export async function lookupLotsByScanCode(scanCode) {
  const normalizedScanCode = normalizeNumericLookup(scanCode);
  const response = await requestJson(
    `/api/lots/lookup/by-lot-pack?lotPackBarcode=${encodeURIComponent(normalizedScanCode)}`,
    {
      useAuth: true
    },
    {
      error: 'ไม่สามารถค้นหา Lot Pack / Lot ได้',
      invalid: 'ข้อมูลตอบกลับจาก server ไม่ถูกต้อง'
    }
  );

  if (!Array.isArray(response?.lots)) {
    throw new ApiError('ข้อมูล Lot จาก server ไม่ถูกต้อง', {
      status: 0
    });
  }

  return response;
}

export async function getApprovalQueue({ tab, date, search, page, pageSize }) {
  const params = new URLSearchParams({
    tab: tab || 'waiting_approve',
    date: date || 'all',
    search: search || '',
    page: String(page || 1),
    pageSize: pageSize || '50'
  });

  return requestJson(
    `/api/lots/approval-queue?${params.toString()}`,
    { useAuth: true },
    {
      error: 'ไม่สามารถโหลดคิวตรวจและอนุมัติได้',
      invalid: 'ข้อมูลคิวตรวจและอนุมัติจาก server ไม่ถูกต้อง'
    }
  );
}

function sendLotWorkflowAction(lotNumber, path, reason, messages) {
  return requestJson(
    `/api/lots/${encodeURIComponent(lotNumber)}/${path}`,
    {
      method: 'POST',
      useAuth: true,
      body: JSON.stringify({ reason })
    },
    messages
  );
}

export function approveLot(lotNumber) {
  return sendLotWorkflowAction(lotNumber, 'approve', '', {
    error: 'ไม่สามารถอนุมัติ Lot ได้',
    invalid: 'ข้อมูลอนุมัติจาก server ไม่ถูกต้อง'
  });
}

export function cancelLotApproval(lotNumber, reason) {
  return sendLotWorkflowAction(lotNumber, 'cancel-approval', reason, {
    error: 'ไม่สามารถยกเลิกอนุมัติ Lot ได้',
    invalid: 'ข้อมูลยกเลิกอนุมัติจาก server ไม่ถูกต้อง'
  });
}

export function sendBackLot(lotNumber, reason) {
  return sendLotWorkflowAction(lotNumber, 'send-back', reason, {
    error: 'ไม่สามารถส่งกลับแก้ไขได้',
    invalid: 'ข้อมูลส่งกลับแก้ไขจาก server ไม่ถูกต้อง'
  });
}

export function reviewNgLot(lotNumber, reason) {
  return sendLotWorkflowAction(lotNumber, 'review-ng', reason, {
    error: 'ไม่สามารถทบทวน NG ได้',
    invalid: 'ข้อมูลทบทวน NG จาก server ไม่ถูกต้อง'
  });
}

export function confirmNgLot(lotNumber) {
  return sendLotWorkflowAction(lotNumber, 'confirm-ng', '', {
    error: 'ไม่สามารถรับทราบ NG ได้',
    invalid: 'ข้อมูลรับทราบ NG จาก server ไม่ถูกต้อง'
  });
}

export function getLotAttachments(lotNumber) {
  return requestJson(
    `/api/lots/${encodeURIComponent(lotNumber)}/attachments`,
    { useAuth: true },
    {
      error: 'ไม่สามารถโหลดไฟล์แนบ Lot ได้',
      invalid: 'ข้อมูลไฟล์แนบจาก server ไม่ถูกต้อง'
    }
  );
}

export function uploadLotAttachment(lotNumber, file) {
  const formData = new FormData();
  formData.append('attachmentFile', file);

  return requestForm(
    `/api/lots/${encodeURIComponent(lotNumber)}/attachments`,
    formData,
    {
      error: 'ไม่สามารถอัปโหลดไฟล์แนบได้',
      invalid: 'ข้อมูลไฟล์แนบจาก server ไม่ถูกต้อง'
    }
  );
}

export function deleteLotAttachment(lotNumber, attachmentId) {
  return requestJson(
    `/api/lots/${encodeURIComponent(lotNumber)}/attachments/${encodeURIComponent(attachmentId)}`,
    {
      method: 'DELETE',
      useAuth: true,
      body: JSON.stringify({})
    },
    {
      error: 'ไม่สามารถลบไฟล์แนบได้',
      invalid: 'ข้อมูลไฟล์แนบจาก server ไม่ถูกต้อง'
    }
  );
}

export async function downloadLotAttachment(lotNumber, attachmentId, originalName = 'attachment') {
  const response = await fetch(
    `/api/lots/${encodeURIComponent(lotNumber)}/attachments/${encodeURIComponent(attachmentId)}/download`,
    {
      headers: authHeaders()
    }
  );

  if (!response.ok) {
    let message = 'ไม่สามารถดาวน์โหลดไฟล์แนบได้';

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
  link.download = originalName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function updateLot(lotNumber, lot) {
  const response = await requestJson(
    `/api/lots/${encodeURIComponent(lotNumber)}`,
    {
      method: 'PUT',
      useAuth: true,
      body: JSON.stringify(lot)
    },
    {
      error: 'ไม่สามารถบันทึกการแก้ไข Lot ได้',
      invalid: 'ข้อมูลตอบกลับจาก server ไม่ถูกต้อง'
    }
  );

  return ensureLotResponse(response);
}

export async function voidLot(lotNumber, reason) {
  const response = await requestJson(
    `/api/lots/${encodeURIComponent(lotNumber)}/void`,
    {
      method: 'POST',
      useAuth: true,
      body: JSON.stringify({ reason })
    },
    {
      error: 'ไม่สามารถ Void Lot ได้',
      invalid: 'ข้อมูลตอบกลับจาก server ไม่ถูกต้อง'
    }
  );

  return ensureLotResponse(response);
}

export async function getDimensionInspection(lotNumber) {
  return requestJson(
    `/api/lots/${encodeURIComponent(lotNumber)}/dimension-inspection`,
    {
      useAuth: true
    },
    {
      error: 'ไม่สามารถโหลดฟอร์มตรวจมิติได้',
      invalid: 'ข้อมูลตอบกลับจาก server ไม่ถูกต้อง'
    }
  );
}

export async function saveDimensionInspectionDraft(lotNumber, values) {
  return requestJson(
    `/api/lots/${encodeURIComponent(lotNumber)}/dimension-inspection/draft`,
    {
      method: 'POST',
      useAuth: true,
      body: JSON.stringify(values)
    },
    {
      error: 'ไม่สามารถบันทึกฟอร์มตรวจมิติชั่วคราวได้',
      invalid: 'ข้อมูลตอบกลับจาก server ไม่ถูกต้อง'
    }
  );
}

export async function completeDimensionInspection(lotNumber, values) {
  return requestJson(
    `/api/lots/${encodeURIComponent(lotNumber)}/dimension-inspection/complete`,
    {
      method: 'POST',
      useAuth: true,
      body: JSON.stringify(values)
    },
    {
      error: 'ไม่สามารถบันทึกฟอร์มตรวจมิติสมบูรณ์ได้',
      invalid: 'ข้อมูลตอบกลับจาก server ไม่ถูกต้อง'
    }
  );
}

export async function getPackingInspection(lotNumber) {
  return requestJson(
    `/api/lots/${encodeURIComponent(lotNumber)}/packing-inspection`,
    {
      useAuth: true
    },
    {
      error: 'ไม่สามารถโหลดฟอร์มตรวจบรรจุได้',
      invalid: 'ข้อมูลตอบกลับจาก server ไม่ถูกต้อง'
    }
  );
}

export async function savePackingInspectionDraft(lotNumber, values) {
  return requestJson(
    `/api/lots/${encodeURIComponent(lotNumber)}/packing-inspection/draft`,
    {
      method: 'POST',
      useAuth: true,
      body: JSON.stringify(values)
    },
    {
      error: 'ไม่สามารถบันทึกฟอร์มตรวจบรรจุชั่วคราวได้',
      invalid: 'ข้อมูลตอบกลับจาก server ไม่ถูกต้อง'
    }
  );
}

export async function completePackingInspection(lotNumber, values) {
  return requestJson(
    `/api/lots/${encodeURIComponent(lotNumber)}/packing-inspection/complete`,
    {
      method: 'POST',
      useAuth: true,
      body: JSON.stringify(values)
    },
    {
      error: 'ไม่สามารถบันทึกฟอร์มตรวจบรรจุสมบูรณ์ได้',
      invalid: 'ข้อมูลตอบกลับจาก server ไม่ถูกต้อง'
    }
  );
}
