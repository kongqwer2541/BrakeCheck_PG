import { getCurrentUser } from '../services/auth.service.js';
import { assertActiveAuthSession } from '../services/auth-session.service.js';
import { verifyAuthToken } from '../utils/token.js';

function getBearerToken(req) {
  const authorization = req.headers?.authorization;

  if (typeof authorization !== 'string') {
    return null;
  }

  const match = authorization.match(/^Bearer +(\S+)$/);

  return match?.[1] || null;
}

function invalidSessionError() {
  const error = new Error('Session หมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่');
  error.statusCode = 401;
  return error;
}

export async function requireAuth(req, res, next) {
  try {
    const token = getBearerToken(req);

    if (!token) {
      const error = new Error('กรุณาเข้าสู่ระบบ');
      error.statusCode = 401;
      throw error;
    }

    let payload;

    try {
      payload = verifyAuthToken(token);
    } catch {
      throw invalidSessionError();
    }

    await assertActiveAuthSession({
      userId: payload.sub,
      tokenId: payload.jti
    });

    const currentUser = await getCurrentUser(payload.sub);

    req.user = currentUser.user;
    req.auth = { tokenId: payload.jti };
    next();
  } catch (error) {
    next(error);
  }
}
