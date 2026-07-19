import { postgresDb } from '../config/database.js';
import { comparePassword, hashPassword, validateNewPassword } from '../utils/password.js';
import { withPostgresTransaction } from '../utils/postgres-transaction.js';
import { createAuthToken, tokenExpiresIn } from '../utils/token.js';
import {
  createAuthSession,
  revokeAllUserAuthSessions,
  revokeAuthSession
} from './auth-session.service.js';

const maxFailedLogins = 5;

function invalidCredentialsError() {
  const error = new Error('รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง');
  error.statusCode = 401;
  return error;
}

function publicUser(user) {
  return {
    id: user.id,
    employeeCode: user.employee_code,
    fullName: user.full_name,
    position: user.position,
    role: user.role,
    status: user.status,
    mustChangePassword: Boolean(user.must_change_password)
  };
}

function isLocked(user) {
  return user.locked_until && new Date(user.locked_until).getTime() > Date.now();
}

async function findUserByEmployeeCode(employeeCode) {
  const { rows } = await postgresDb.query(
    `SELECT
      id,
      employee_code,
      password_hash,
      full_name,
      position,
      role,
      status,
      must_change_password,
      failed_login_count,
      locked_until
     FROM users
     WHERE employee_code = $1
     LIMIT 1`,
    [employeeCode]
  );

  return rows[0] || null;
}

async function findUserById(userId) {
  const { rows } = await postgresDb.query(
    `SELECT
      id,
      employee_code,
      password_hash,
      full_name,
      position,
      role,
      status,
      must_change_password,
      failed_login_count,
      locked_until
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId]
  );

  return rows[0] || null;
}

async function recordFailedLogin(userId) {
  const { rows } = await postgresDb.query(
    `UPDATE users
     SET failed_login_count = CASE
           WHEN locked_until IS NOT NULL AND locked_until <= CURRENT_TIMESTAMP THEN 1
           ELSE failed_login_count + 1
         END,
         locked_until = CASE
           WHEN locked_until IS NOT NULL AND locked_until <= CURRENT_TIMESTAMP THEN NULL
           WHEN failed_login_count + 1 >= $1
             THEN CURRENT_TIMESTAMP + INTERVAL '15 minutes'
           ELSE locked_until
         END
     WHERE id = $2
     RETURNING failed_login_count, locked_until`,
    [maxFailedLogins, userId]
  );

  return rows[0] || null;
}

async function clearLoginLock(userId) {
  await postgresDb.query(
    `UPDATE users
     SET failed_login_count = 0,
         locked_until = NULL
     WHERE id = $1`,
    [userId]
  );
}

export async function login(credentials = {}) {
  const { employeeCode, password } = credentials || {};
  const cleanedEmployeeCode = typeof employeeCode === 'string'
    ? employeeCode.trim()
    : '';

  if (!cleanedEmployeeCode || typeof password !== 'string' || !password) {
    const error = new Error('กรุณากรอกรหัสพนักงานและรหัสผ่าน');
    error.statusCode = 400;
    throw error;
  }

  const user = await findUserByEmployeeCode(cleanedEmployeeCode);

  if (!user) {
    throw invalidCredentialsError();
  }

  if (user.status !== 'active') {
    throw invalidCredentialsError();
  }

  if (isLocked(user)) {
    throw invalidCredentialsError();
  }

  const passwordMatches = await comparePassword(password, user.password_hash);

  if (!passwordMatches) {
    await recordFailedLogin(user.id);
    throw invalidCredentialsError();
  }

  await clearLoginLock(user.id);

  const freshUser = await findUserById(user.id);

  if (!freshUser || freshUser.status !== 'active') {
    throw invalidCredentialsError();
  }

  const { token, tokenId, expiresAt } = createAuthToken(freshUser);
  await createAuthSession({
    userId: freshUser.id,
    tokenId,
    expiresAt
  });

  return {
    ok: true,
    token,
    tokenExpiresIn,
    user: publicUser(freshUser)
  };
}

export async function getCurrentUser(userId) {
  const user = await findUserById(userId);

  if (!user || user.status !== 'active') {
    const error = new Error('ไม่พบผู้ใช้หรือบัญชีถูกระงับ');
    error.statusCode = 401;
    throw error;
  }

  return {
    ok: true,
    user: publicUser(user)
  };
}

export async function changePassword({ userId, currentPassword, newPassword }) {
  const user = await findUserById(userId);

  if (!user || user.status !== 'active') {
    const error = new Error('ไม่พบผู้ใช้หรือบัญชีถูกระงับ');
    error.statusCode = 401;
    throw error;
  }

  const passwordError = validateNewPassword(newPassword);
  if (passwordError) {
    const error = new Error(passwordError);
    error.statusCode = 400;
    throw error;
  }

  const passwordMatches = await comparePassword(currentPassword || '', user.password_hash);
  if (!passwordMatches) {
    const error = new Error('รหัสผ่านปัจจุบันไม่ถูกต้อง');
    error.statusCode = 401;
    throw error;
  }

  const newPasswordHash = await hashPassword(newPassword);
  await withPostgresTransaction(postgresDb, async (client) => {
    await client.query(
      `UPDATE users
       SET password_hash = $1,
           must_change_password = FALSE,
           failed_login_count = 0,
           locked_until = NULL
       WHERE id = $2`,
      [newPasswordHash, user.id]
    );
    await revokeAllUserAuthSessions(user.id, 'password_change', client);
  });

  const updatedUser = await findUserById(user.id);

  return {
    ok: true,
    message: 'เปลี่ยนรหัสผ่านสำเร็จ',
    user: publicUser(updatedUser)
  };
}

export async function logout({ userId, tokenId }) {
  await revokeAuthSession({ userId, tokenId });

  return {
    ok: true,
    message: 'ออกจากระบบสำเร็จ'
  };
}
