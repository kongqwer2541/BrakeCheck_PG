const tokenKey = 'brakecheck_token';
const defaultErrorMessage = 'เกิดข้อผิดพลาด';
const defaultInvalidResponseMessage = 'ข้อมูลตอบกลับจาก server ไม่ถูกต้อง';

export class ApiError extends Error {
  constructor(message, { status = 0, details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function readResponseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function handleApiResponse(response, messages = {}) {
  const data = await readResponseJson(response);

  if (!response.ok) {
    throw new ApiError(data?.message || messages.error || defaultErrorMessage, {
      status: response.status,
      details: data?.details || null
    });
  }

  if (!data) {
    throw new ApiError(messages.invalid || defaultInvalidResponseMessage, {
      status: response.status
    });
  }

  return data;
}

async function fetchApi(path, options = {}, messages = {}) {
  try {
    return await fetch(path, options);
  } catch {
    throw new ApiError(messages.network || 'ไม่สามารถเชื่อมต่อ server ได้', {
      status: 0
    });
  }
}

export async function requestJson(path, options = {}, messages = {}) {
  const {
    useAuth = false,
    headers = {},
    ...fetchOptions
  } = options;

  const response = await fetchApi(path, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
      ...(useAuth ? authHeaders() : {})
    }
  }, messages);

  return handleApiResponse(response, messages);
}

export async function requestForm(path, formData, messages = {}) {
  const response = await fetchApi(path, {
    method: 'POST',
    headers: authHeaders(),
    body: formData
  }, messages);

  return handleApiResponse(response, messages);
}

export function getToken() {
  return sessionStorage.getItem(tokenKey);
}

export function saveToken(token) {
  sessionStorage.setItem(tokenKey, token);
}

export function clearToken() {
  sessionStorage.removeItem(tokenKey);
}

export function authHeaders() {
  const token = getToken();

  return token
    ? {
        Authorization: `Bearer ${token}`
      }
    : {};
}

export function login(employeeCode, password) {
  return requestJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ employeeCode, password })
  });
}

export function getCurrentUser() {
  return requestJson('/api/auth/me', {
    useAuth: true
  });
}

export function logout() {
  return requestJson('/api/auth/logout', {
    method: 'POST',
    useAuth: true,
    body: JSON.stringify({})
  });
}

export function changePassword(currentPassword, newPassword) {
  return requestJson('/api/auth/change-password', {
    method: 'POST',
    useAuth: true,
    body: JSON.stringify({ currentPassword, newPassword })
  });
}
