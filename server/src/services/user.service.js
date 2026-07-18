import { postgresDb } from '../config/database.js';
import { hashPassword, validateNewPassword } from '../utils/password.js';
import { withPostgresTransaction } from '../utils/postgres-transaction.js';
import { revokeAllUserAuthSessions } from './auth-session.service.js';

const allowedRoles = ['head', 'assistant', 'officer'];
const allowedStatuses = ['active', 'suspended'];
const maxTextLength = 100;

function publicUser(user) {
  return {
    id: user.id,
    employeeCode: user.employee_code,
    fullName: user.full_name,
    position: user.position,
    role: user.role,
    status: user.status,
    mustChangePassword: Boolean(user.must_change_password),
    failedLoginCount: Number(user.failed_login_count || 0),
    lockedUntil: user.locked_until,
    createdAt: user.created_at,
    updatedAt: user.updated_at
  };
}

function cleanText(value) {
  return String(value || '').trim();
}

function validateUserId(userId) {
  const parsedUserId = Number(userId);

  if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
    const error = new Error('รหัสผู้ใช้ไม่ถูกต้อง');
    error.statusCode = 400;
    throw error;
  }

  return parsedUserId;
}

function validateEmployeeCode(employeeCode) {
  if (!/^\d{8,9}$/.test(employeeCode)) {
    const error = new Error('รหัสพนักงานต้องเป็นตัวเลข 8 หรือ 9 หลัก');
    error.statusCode = 400;
    throw error;
  }
}

function validateRole(role) {
  if (!allowedRoles.includes(role)) {
    const error = new Error('สิทธิ์ผู้ใช้ไม่ถูกต้อง');
    error.statusCode = 400;
    throw error;
  }
}

function validateStatus(status) {
  if (!allowedStatuses.includes(status)) {
    const error = new Error('สถานะผู้ใช้ไม่ถูกต้อง');
    error.statusCode = 400;
    throw error;
  }
}

function validateRequiredUserFields({ fullName, position }) {
  if (!fullName || !position) {
    const error = new Error('กรุณากรอกชื่อและตำแหน่ง');
    error.statusCode = 400;
    throw error;
  }

  if (fullName.length > maxTextLength || position.length > maxTextLength) {
    const error = new Error('ชื่อและตำแหน่งต้องไม่เกิน 100 ตัวอักษร');
    error.statusCode = 400;
    throw error;
  }
}

async function recordUserAudit({ actorUserId, targetUserId, action, detail }, executor = postgresDb) {
  await executor.query(
    `INSERT INTO user_audit_logs (
      actor_user_id,
      target_user_id,
      action,
      detail
    )
    VALUES ($1, $2, $3, $4)`,
    [actorUserId || null, targetUserId || null, action, detail || null]
  );
}

async function findUserById(userId, executor = postgresDb) {
  const { rows } = await executor.query(
    `SELECT
      id,
      employee_code,
      full_name,
      position,
      role,
      status,
      must_change_password,
      failed_login_count,
      locked_until,
      created_at,
      updated_at
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId]
  );

  return rows[0] || null;
}

async function findUserByEmployeeCode(employeeCode) {
  const { rows } = await postgresDb.query(
    `SELECT id
     FROM users
     WHERE employee_code = $1
     LIMIT 1`,
    [employeeCode]
  );

  return rows[0] || null;
}

export async function listUsers() {
  const { rows } = await postgresDb.query(
    `SELECT
      id,
      employee_code,
      full_name,
      position,
      role,
      status,
      must_change_password,
      failed_login_count,
      locked_until,
      created_at,
      updated_at
     FROM users
     ORDER BY employee_code`
  );

  return {
    ok: true,
    users: rows.map(publicUser)
  };
}

export async function createUser({ actorUserId, employeeCode, fullName, position, role, status, temporaryPassword }) {
  const cleanedEmployeeCode = cleanText(employeeCode);
  const cleanedFullName = cleanText(fullName);
  const cleanedPosition = cleanText(position);
  const selectedRole = cleanText(role) || 'officer';
  const selectedStatus = cleanText(status) || 'active';

  validateEmployeeCode(cleanedEmployeeCode);
  validateRequiredUserFields({
    fullName: cleanedFullName,
    position: cleanedPosition
  });
  validateRole(selectedRole);
  validateStatus(selectedStatus);

  const passwordError = validateNewPassword(temporaryPassword);
  if (passwordError) {
    const error = new Error(passwordError);
    error.statusCode = 400;
    throw error;
  }

  const existingUser = await findUserByEmployeeCode(cleanedEmployeeCode);
  if (existingUser) {
    const error = new Error('รหัสพนักงานนี้มีอยู่ในระบบแล้ว');
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await hashPassword(temporaryPassword);

  let newUser;

  try {
    newUser = await withPostgresTransaction(postgresDb, async (client) => {
      const result = await client.query(
        `INSERT INTO users (
          employee_code,
          password_hash,
          full_name,
          position,
          role,
          status,
          must_change_password
        )
        VALUES ($1, $2, $3, $4, $5, $6, TRUE)
        RETURNING id`,
        [cleanedEmployeeCode, passwordHash, cleanedFullName, cleanedPosition, selectedRole, selectedStatus]
      );
      const createdUser = await findUserById(result.rows[0].id, client);

      await recordUserAudit({
        actorUserId,
        targetUserId: createdUser.id,
        action: 'create_user',
        detail: `Created employee_code=${createdUser.employee_code}, role=${createdUser.role}, status=${createdUser.status}`
      }, client);

      return createdUser;
    });
  } catch (error) {
    if (error.code === '23505') {
      const conflictError = new Error('รหัสพนักงานนี้มีอยู่ในระบบแล้ว');
      conflictError.statusCode = 409;
      throw conflictError;
    }

    throw error;
  }

  return {
    ok: true,
    message: 'เพิ่มผู้ใช้สำเร็จ',
    user: publicUser(newUser)
  };
}

export async function updateUser({ userId, actorUserId, fullName, position, role, status }) {
  const cleanedUserId = validateUserId(userId);
  const currentUser = await findUserById(cleanedUserId);

  if (!currentUser) {
    const error = new Error('ไม่พบผู้ใช้');
    error.statusCode = 404;
    throw error;
  }

  const cleanedFullName = cleanText(fullName);
  const cleanedPosition = cleanText(position);
  const selectedRole = cleanText(role) || currentUser.role;
  const selectedStatus = cleanText(status) || currentUser.status;

  validateRequiredUserFields({
    fullName: cleanedFullName,
    position: cleanedPosition
  });
  validateRole(selectedRole);
  validateStatus(selectedStatus);

  if (cleanedUserId === Number(actorUserId)) {
    if (selectedRole !== currentUser.role || selectedStatus !== 'active') {
      const error = new Error('ไม่สามารถเปลี่ยนสิทธิ์หรือปิดบัญชีของตัวเองได้');
      error.statusCode = 400;
      throw error;
    }
  }

  const updatedUser = await withPostgresTransaction(postgresDb, async (client) => {
    await client.query(
      `UPDATE users
       SET full_name = $1,
           position = $2,
           role = $3,
           status = $4
       WHERE id = $5`,
      [cleanedFullName, cleanedPosition, selectedRole, selectedStatus, cleanedUserId]
    );
    const savedUser = await findUserById(cleanedUserId, client);

    await recordUserAudit({
      actorUserId,
      targetUserId: savedUser.id,
      action: 'update_user',
      detail: `Updated employee_code=${savedUser.employee_code}, role=${savedUser.role}, status=${savedUser.status}`
    }, client);

    return savedUser;
  });

  return {
    ok: true,
    message: 'แก้ไขผู้ใช้สำเร็จ',
    user: publicUser(updatedUser)
  };
}

export async function resetUserPassword({ userId, actorUserId, temporaryPassword }) {
  const cleanedUserId = validateUserId(userId);
  const currentUser = await findUserById(cleanedUserId);

  if (!currentUser) {
    const error = new Error('ไม่พบผู้ใช้');
    error.statusCode = 404;
    throw error;
  }

  const passwordError = validateNewPassword(temporaryPassword);
  if (passwordError) {
    const error = new Error(passwordError);
    error.statusCode = 400;
    throw error;
  }

  const passwordHash = await hashPassword(temporaryPassword);
  const updatedUser = await withPostgresTransaction(postgresDb, async (client) => {
    await client.query(
      `UPDATE users
       SET password_hash = $1,
           must_change_password = TRUE,
           failed_login_count = 0,
           locked_until = NULL
       WHERE id = $2`,
      [passwordHash, cleanedUserId]
    );
    await revokeAllUserAuthSessions(cleanedUserId, 'password_reset', client);
    const savedUser = await findUserById(cleanedUserId, client);

    await recordUserAudit({
      actorUserId,
      targetUserId: savedUser.id,
      action: 'reset_password',
      detail: `Reset password for employee_code=${savedUser.employee_code}`
    }, client);

    return savedUser;
  });

  return {
    ok: true,
    message: 'รีเซ็ตรหัสผ่านสำเร็จ',
    user: publicUser(updatedUser)
  };
}
