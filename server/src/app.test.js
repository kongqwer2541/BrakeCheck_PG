import assert from 'node:assert/strict';
import http from 'node:http';
import { describe, test } from 'node:test';

import { app } from './app.js';

function postJson(server, path, body) {
  const { port } = server.address();

  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
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
    request.end(body);
  });
}

function getJson(server, path) {
  const { port } = server.address();

  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method: 'GET'
    }, (response) => {
      let responseBody = '';

      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        responseBody += chunk;
      });
      response.on('end', () => {
        resolve({
          statusCode: response.statusCode,
          headers: response.headers,
          body: responseBody ? JSON.parse(responseBody) : null
        });
      });
    });

    request.on('error', reject);
    request.end();
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

describe('app JSON body limit', () => {
  test('allows normal JSON payloads used by API requests', async () => {
    const normalBody = JSON.stringify({ note: 'x'.repeat(200 * 1024) });

    await withServer(async (server) => {
      const response = await postJson(server, '/api/step-8-json-limit-test', normalBody);

      assert.equal(response.statusCode, 404);
      assert.equal(response.body.message, 'ไม่พบ API ที่เรียกใช้งาน');
    });
  });

  test('returns Thai 413 error when JSON payload is too large', async () => {
    const oversizedBody = JSON.stringify({ note: 'x'.repeat(2 * 1024 * 1024) });

    await withServer(async (server) => {
      const response = await postJson(server, '/api/step-8-json-limit-test', oversizedBody);

      assert.equal(response.statusCode, 413);
      assert.equal(response.body.ok, false);
      assert.equal(response.body.message, 'ข้อมูลที่ส่งมีขนาดใหญ่เกินไป กรุณาลดขนาดข้อมูลแล้วลองใหม่');
      assert.equal(response.body.stack, undefined);
      assert.equal(response.body.details, undefined);
    });
  });
});

describe('app security headers', () => {
  test('sets basic security headers on API responses', async () => {
    await withServer(async (server) => {
      const response = await getJson(server, '/api/health');

      assert.equal(response.statusCode, 200);
      assert.equal(response.headers['x-content-type-options'], 'nosniff');
      assert.equal(response.headers['x-frame-options'], 'SAMEORIGIN');
      assert.equal(response.headers['referrer-policy'], 'no-referrer');
      assert.equal(response.headers['permissions-policy'], 'camera=(), microphone=(), geolocation=()');
    });
  });
});
