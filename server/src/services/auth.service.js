import { db } from '../config/database.js';
import { comparePassword, hashPassword, validateNewPassword } from '../utils/password.js';
import { createAuthToken, tokenExpiresIn } from '../utils/token.js';
import {
  createAuthSession,
  revokeAllUserAuthSessions,
  revokeAuthSession
} from './auth-session.service.js';

const maxFailedLogins = 5;

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
  const [rows] = await db.execute(
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
     WHERE employee_code = ?
     LIMIT 1`,
    [employeeCode]
  );

  return rows[0] || null;
}

async function findUserById(userId) {
  const [rows] = await db.execute(
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
     WHERE id = ?
     LIMIT 1`,
    [userId]
  );

  return rows[0] || null;
}

async function recordFailedLogin(user) {
  const nextFailedCount = Number(user.failed_login_count || 0) + 1;

  if (nextFailedCount >= maxFailedLogins) {
    await db.execute(
      `UPDATE users
       SET failed_login_count = ?,
           locked_until = DATE_ADD(NOW(), INTERVAL 15 MINUTE)
       WHERE id = ?`,
      [nextFailedCount, user.id]
    );
    return;
  }

  await db.execute(
    `UPDATE users
     SET failed_login_count = ?
     WHERE id = ?`,
    [nextFailedCount, user.id]
  );
}

async function clearLoginLock(userId) {
  await db.execute(
    `UPDATE users
     SET failed_login_count = 0,
         locked_until = NULL
     WHERE id = ?`,
    [userId]
  );
}

export async function login({ employeeCode, password }) {
  const cleanedEmployeeCode = String(employeeCode || '').trim();

  if (!cleanedEmployeeCode || !password) {
    const error = new Error('กรุณากรอกรหัสพนักงานและรหัสผ่าน');
    error.statusCode = 400;
    throw error;
  }

  const user = await findUserByEmployeeCode(cleanedEmployeeCode);

  if (!user) {
    const error = new Error('รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง');
    error.statusCode = 401;
    throw error;
  }

  if (user.status !== 'active') {
    const error = new Error('บัญชีนี้ถูกระงับการใช้งาน');
    error.statusCode = 403;
    throw error;
  }

  if (isLocked(user)) {
    const error = new Error('บัญชีถูกล็อคชั่วคราว กรุณาลองใหม่ภายหลัง');
    error.statusCode = 423;
    throw error;
  }

  const passwordMatches = await comparePassword(password, user.password_hash);

  if (!passwordMatches) {
    await recordFailedLogin(user);
    const error = new Error('รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง');
    error.statusCode = 401;
    throw error;
  }

  await clearLoginLock(user.id);

  const freshUser = await findUserById(user.id);
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
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();
    await connection.execute(
      `UPDATE users
       SET password_hash = ?,
           must_change_password = FALSE,
           failed_login_count = 0,
           locked_until = NULL
       WHERE id = ?`,
      [newPasswordHash, user.id]
    );
    await revokeAllUserAuthSessions(user.id, 'password_change', connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

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
