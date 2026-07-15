import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';

export const tokenExpiresIn = '8h';

export function createAuthToken(user) {
  const tokenId = randomUUID();
  const token = jwt.sign(
    {
      employeeCode: user.employee_code,
      role: user.role
    },
    env.sessionSecret,
    {
      subject: String(user.id),
      expiresIn: tokenExpiresIn,
      jwtid: tokenId
    }
  );

  const payload = jwt.decode(token);

  return {
    token,
    tokenId,
    expiresAt: new Date(payload.exp * 1000)
  };
}

export function verifyAuthToken(token) {
  return jwt.verify(token, env.sessionSecret);
}
