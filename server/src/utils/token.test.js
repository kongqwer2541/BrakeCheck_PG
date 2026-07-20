import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import test from 'node:test';

process.env.SESSION_SECRET = 'test_session_secret_at_least_32_chars';

test('auth token includes a unique session id and expiry', async () => {
  const {
    createAuthToken,
    tokenExpiresIn,
    verifyAuthToken
  } = await import('./token.js');

  const result = createAuthToken({
    id: 7,
    employee_code: 'TEST007',
    role: 'officer'
  });
  const payload = verifyAuthToken(result.token);

  assert.equal(payload.sub, '7');
  assert.equal(payload.jti, result.tokenId);
  assert.equal(tokenExpiresIn, '8h');
  assert.ok(result.expiresAt.getTime() > Date.now());
});

test('rejects a token whose payload was changed', async () => {
  const { createAuthToken, verifyAuthToken } = await import('./token.js');
  const result = createAuthToken({
    id: 7,
    employee_code: 'TEST007',
    role: 'officer'
  });
  const parts = result.token.split('.');
  const finalCharacter = parts[1].at(-1);
  parts[1] = `${parts[1].slice(0, -1)}${finalCharacter === 'a' ? 'b' : 'a'}`;

  assert.throws(() => verifyAuthToken(parts.join('.')));
});

test('rejects an expired token', async () => {
  const { verifyAuthToken } = await import('./token.js');
  const expiredToken = jwt.sign(
    {
      employeeCode: 'TEST007',
      role: 'officer'
    },
    process.env.SESSION_SECRET,
    {
      subject: '7',
      jwtid: 'expired-session-id',
      expiresIn: -1
    }
  );

  assert.throws(
    () => verifyAuthToken(expiredToken),
    (error) => error.name === 'TokenExpiredError'
  );
});
