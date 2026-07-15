import assert from 'node:assert/strict';
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
