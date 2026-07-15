import { requestJson } from './auth.api.js';

function request(path, options = {}) {
  return requestJson(
    path,
    {
      ...options,
      useAuth: true
    },
    {
      error: 'ไม่สามารถเชื่อมต่อ server ได้',
      invalid: 'ข้อมูลที่ได้รับจาก server ไม่ถูกต้อง'
    }
  );
}

export function getUsers() {
  return request('/api/users');
}

export function createUser(user) {
  return request('/api/users', {
    method: 'POST',
    body: JSON.stringify(user)
  });
}

export function updateUser(userId, user) {
  return request(`/api/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(user)
  });
}

export function resetUserPassword(userId, temporaryPassword) {
  return request(`/api/users/${userId}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ temporaryPassword })
  });
}
