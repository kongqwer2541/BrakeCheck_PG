import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';

process.env.SESSION_SECRET = 'test_session_secret_at_least_32_chars';

const [{ app }, { postgresDb }, { hashPassword }] = await Promise.all([
  import('../app.js'),
  import('../config/database.js'),
  import('../utils/password.js')
]);

function requestJson(server, { method, path, token, body }) {
  const { port } = server.address();
  const requestBody = body ? JSON.stringify(body) : '';
  const headers = {};

  if (requestBody) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(requestBody);
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers
    }, (response) => {
      let responseBody = '';

      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        responseBody += chunk;
      });
      response.on('end', () => {
        resolve({
          statusCode: response.statusCode,
          body: responseBody ? JSON.parse(responseBody) : null
        });
      });
    });

    request.on('error', reject);
    request.end(requestBody);
  });
}

async function withServer(callback) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    return await callback(server);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('logout revokes the current token', async (t) => {
  const originalQuery = postgresDb.query;
  const password = 'test-password-123';
  const passwordHash = await hashPassword(password);
  const user = {
    id: 7,
    employee_code: 'TEST007',
    password_hash: passwordHash,
    full_name: 'Test User',
    position: 'QC',
    role: 'officer',
    status: 'active',
    must_change_password: 0,
    failed_login_count: 0,
    locked_until: null
  };
  let storedTokenId = null;
  let revoked = false;

  t.after(() => {
    postgresDb.query = originalQuery;
  });

  postgresDb.query = async (sql, params = []) => {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim();

    if (normalizedSql.includes('FROM users') && normalizedSql.includes('employee_code = $1')) {
      return { rows: [user] };
    }

    if (normalizedSql.startsWith('UPDATE users')) {
      return { rows: [], rowCount: 1 };
    }

    if (normalizedSql.includes('FROM users') && normalizedSql.includes('WHERE id = $1')) {
      return { rows: [user] };
    }

    if (normalizedSql.startsWith('INSERT INTO auth_sessions')) {
      [storedTokenId] = params;
      return { rows: [], rowCount: 1 };
    }

    if (normalizedSql.includes('FROM auth_sessions')) {
      return { rows: revoked ? [] : [{ id: 1 }] };
    }

    if (normalizedSql.startsWith('UPDATE auth_sessions')) {
      revoked = true;
      return { rows: [], rowCount: 1 };
    }

    throw new Error(`Unexpected test query: ${normalizedSql}`);
  };

  await withServer(async (server) => {
    const loginResponse = await requestJson(server, {
      method: 'POST',
      path: '/api/auth/login',
      body: { employeeCode: user.employee_code, password }
    });

    assert.equal(loginResponse.statusCode, 200);
    assert.ok(loginResponse.body.token);
    assert.ok(storedTokenId);

    const retentionStatusResponse = await requestJson(server, {
      method: 'GET',
      path: '/api/auth/sessions/retention-status',
      token: loginResponse.body.token
    });

    assert.equal(retentionStatusResponse.statusCode, 403);

    const logoutResponse = await requestJson(server, {
      method: 'POST',
      path: '/api/auth/logout',
      token: loginResponse.body.token,
      body: {}
    });

    assert.equal(logoutResponse.statusCode, 200);
    assert.equal(revoked, true);

    const reusedTokenResponse = await requestJson(server, {
      method: 'GET',
      path: '/api/auth/me',
      token: loginResponse.body.token
    });

    assert.equal(reusedTokenResponse.statusCode, 401);
    assert.equal(reusedTokenResponse.body.ok, false);
  });
});

test('database errors return a generic response without internal details', async (t) => {
  const originalQuery = postgresDb.query;

  t.after(() => {
    postgresDb.query = originalQuery;
  });

  postgresDb.query = async () => {
    throw new Error('Sensitive SQL detail: SELECT password_hash FROM users');
  };

  await withServer(async (server) => {
    const response = await requestJson(server, {
      method: 'POST',
      path: '/api/auth/login',
      body: { employeeCode: 'TEST007', password: 'test-password-123' }
    });
    const responseText = JSON.stringify(response.body);

    assert.equal(response.statusCode, 500);
    assert.equal(response.body.ok, false);
    assert.doesNotMatch(responseText, /SELECT|password_hash|Sensitive SQL|stack/i);
  });
});
