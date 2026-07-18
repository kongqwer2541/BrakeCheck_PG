import { postgresDb } from '../config/database.js';

export const authSessionRetentionDays = 180;

function sessionExpiredError() {
  const error = new Error('Session หมดอายุหรือออกจากระบบแล้ว กรุณาเข้าสู่ระบบใหม่');
  error.statusCode = 401;
  return error;
}

export async function createAuthSession({ userId, tokenId, expiresAt }) {
  await postgresDb.query(
    `INSERT INTO auth_sessions (token_id, user_id, expires_at)
     VALUES ($1, $2, $3)`,
    [tokenId, userId, expiresAt]
  );
}

export async function assertActiveAuthSession({ userId, tokenId }) {
  if (!tokenId) {
    throw sessionExpiredError();
  }

  const { rows } = await postgresDb.query(
    `SELECT id
     FROM auth_sessions
     WHERE token_id = $1
       AND user_id = $2
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
  await postgresDb.query(
    `UPDATE auth_sessions
     SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP),
         revoke_reason = COALESCE(revoke_reason, $1)
     WHERE token_id = $2
       AND user_id = $3`,
    [reason, tokenId, userId]
  );
}

export async function revokeAllUserAuthSessions(userId, reason, executor = postgresDb) {
  await executor.query(
    `UPDATE auth_sessions
     SET revoked_at = CURRENT_TIMESTAMP,
         revoke_reason = $1
     WHERE user_id = $2
       AND revoked_at IS NULL`,
    [reason, userId]
  );
}

export async function getAuthSessionRetentionStatus() {
  const { rows } = await postgresDb.query(
    `SELECT
       COUNT(*) AS old_session_count,
       COUNT(*) FILTER (WHERE revoked_at IS NOT NULL) AS revoked_count,
       COUNT(*) FILTER (
         WHERE revoked_at IS NULL AND expires_at <= CURRENT_TIMESTAMP
       ) AS expired_count
     FROM auth_sessions
     WHERE (revoked_at IS NOT NULL OR expires_at <= CURRENT_TIMESTAMP)
       AND COALESCE(revoked_at, expires_at) <
         CURRENT_TIMESTAMP - ($1::integer * INTERVAL '1 day')`,
    [authSessionRetentionDays]
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
