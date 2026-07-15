import { requestJson } from './auth.api.js';

export function getSystemSettings() {
  return requestJson(
    '/api/settings',
    { useAuth: true },
    {
      error: 'ไม่สามารถโหลดตั้งค่าระบบได้',
      invalid: 'ข้อมูลตั้งค่าระบบจาก server ไม่ถูกต้อง'
    }
  );
}

export function createInspectionTopic(values) {
  return requestJson(
    '/api/settings/topics',
    {
      method: 'POST',
      useAuth: true,
      body: JSON.stringify(values)
    },
    {
      error: 'ไม่สามารถเพิ่มหัวข้อได้',
      invalid: 'ข้อมูลหัวข้อจาก server ไม่ถูกต้อง'
    }
  );
}

export function updateInspectionTopic(topicId, values) {
  return requestJson(
    `/api/settings/topics/${encodeURIComponent(topicId)}`,
    {
      method: 'PATCH',
      useAuth: true,
      body: JSON.stringify(values)
    },
    {
      error: 'ไม่สามารถบันทึกลำดับ/หมายเหตุได้',
      invalid: 'ข้อมูลหัวข้อจาก server ไม่ถูกต้อง'
    }
  );
}

export function updateInspectionTopics(items) {
  return requestJson(
    '/api/settings/topics/batch-display',
    {
      method: 'PATCH',
      useAuth: true,
      body: JSON.stringify({ items })
    },
    {
      error: 'ไม่สามารถบันทึกลำดับ/หมายเหตุหลายหัวข้อได้',
      invalid: 'ข้อมูลหัวข้อจาก server ไม่ถูกต้อง'
    }
  );
}

export function deactivateInspectionTopic(topicId, values) {
  return requestJson(
    `/api/settings/topics/${encodeURIComponent(topicId)}/deactivate`,
    {
      method: 'POST',
      useAuth: true,
      body: JSON.stringify(values)
    },
    {
      error: 'ไม่สามารถปิดใช้งานหัวข้อได้',
      invalid: 'ข้อมูลหัวข้อจาก server ไม่ถูกต้อง'
    }
  );
}

export function updateSamplingRules(values) {
  return requestJson(
    '/api/settings/sampling-rules',
    {
      method: 'PUT',
      useAuth: true,
      body: JSON.stringify(values)
    },
    {
      error: 'ไม่สามารถบันทึกจำนวนสุ่มตรวจได้',
      invalid: 'ข้อมูลจำนวนสุ่มตรวจจาก server ไม่ถูกต้อง'
    }
  );
}

export function updateInstrumentPrefixes(values) {
  return requestJson(
    '/api/settings/instrument-prefixes',
    {
      method: 'PUT',
      useAuth: true,
      body: JSON.stringify(values)
    },
    {
      error: 'ไม่สามารถบันทึกรหัสเครื่องมือวัดได้',
      invalid: 'ข้อมูลรหัสเครื่องมือวัดจาก server ไม่ถูกต้อง'
    }
  );
}
