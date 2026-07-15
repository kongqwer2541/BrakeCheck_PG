import { db } from '../config/database.js';

export const authSessionRetentionDays = 180;

function sessionExpiredError() {
  const error = new Error('Session หมดอายุหรือออกจากระบบแล้ว กรุณาเข้าสู่ระบบใหม่');
  error.statusCode = 401;
  return error;
}

export async function createAuthSession({ userId, tokenId, expiresAt }) {
  await db.execute(
    `INSERT INTO auth_sessions (token_id, user_id, expires_at)
     VALUES (?, ?, ?)`,
    [tokenId, userId, expiresAt]
  );
}

export async function assertActiveAuthSession({ userId, tokenId }) {
  if (!tokenId) {
    throw sessionExpiredError();
  }

  const [rows] = await db.execute(
    `SELECT id
     FROM auth_sessions
     WHERE token_id = ?
       AND user_id = ?
       AND revoked_at IS NULL
       AND expires_at > NOW()
     LIMIT 1`,
    [tokenId, userId]
  );

  if (!rows[0]) {
    throw sessionExpiredError();
  }
}

export async function revokeAuthSession({ userId, tokenId, reason = 'logout' }) {
  await db.execute(
    `UPDATE auth_sessions
     SET revoked_at = COALESCE(revoked_at, NOW()),
         revoke_reason = COALESCE(revoke_reason, ?)
     WHERE token_id = ?
       AND user_id = ?`,
    [reason, tokenId, userId]
  );
}

export async function revokeAllUserAuthSessions(userId, reason, executor = db) {
  await executor.execute(
    `UPDATE auth_sessions
     SET revoked_at = NOW(),
         revoke_reason = ?
     WHERE user_id = ?
       AND revoked_at IS NULL`,
    [reason, userId]
  );
}

export async function getAuthSessionRetentionStatus() {
  const [rows] = await db.execute(
    `SELECT
       COUNT(*) AS old_session_count,
       SUM(CASE WHEN revoked_at IS NOT NULL THEN 1 ELSE 0 END) AS revoked_count,
       SUM(CASE WHEN revoked_at IS NULL AND expires_at <= NOW() THEN 1 ELSE 0 END) AS expired_count
     FROM auth_sessions
     WHERE (revoked_at IS NOT NULL OR expires_at <= NOW())
       AND COALESCE(revoked_at, expires_at) < DATE_SUB(NOW(), INTERVAL ${authSessionRetentionDays} DAY)`
  );
  const status = rows[0] || {};

  return {
    ok: true,
    retentionDays: authSessionRetentionDays,
    oldSessionCount: Number(status.old_session_count || 0),
    revokedCount: Number(status.revoked_count || 0),
    expiredCount: Number(status.expired_count || 0),
    cleanupEnabled: false
  };
}
