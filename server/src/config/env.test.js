import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import assert from 'node:assert/strict';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '../..');

async function loadEnvWithSessionSecret(sessionSecret) {
  return execFileAsync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      "import './src/config/env.js';"
    ],
    {
      cwd: serverRoot,
      env: {
        ...process.env,
        SESSION_SECRET: sessionSecret
      }
    }
  );
}

async function readEnvJson({ corsOrigins = '' } = {}) {
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      "import { env } from './src/config/env.js'; console.log(JSON.stringify({ corsOrigins: env.corsOrigins }));"
    ],
    {
      cwd: serverRoot,
      env: {
        ...process.env,
        APP_PORT: '3000',
        CORS_ORIGINS: corsOrigins,
        SESSION_SECRET: 'brakecheck-test-session-secret-32-characters'
      }
    }
  );

  return JSON.parse(stdout);
}

async function readDatabaseEnvJson(overrides = {}) {
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      "import { env } from './src/config/env.js'; console.log(JSON.stringify({ host: env.db.host, port: env.db.port, name: env.db.name, user: env.db.user }));"
    ],
    {
      cwd: serverRoot,
      env: {
        ...process.env,
        DB_HOST: '',
        DB_PORT: '',
        DB_NAME: '',
        DB_USER: '',
        DB_PASSWORD: '',
        SESSION_SECRET: 'brakecheck-test-session-secret-32-characters',
        ...overrides
      }
    }
  );

  return JSON.parse(stdout);
}

async function loadEnvWithOverrides(overrides) {
  return execFileAsync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      "import './src/config/env.js';"
    ],
    {
      cwd: serverRoot,
      env: {
        ...process.env,
        SESSION_SECRET: 'brakecheck-test-session-secret-32-characters',
        ...overrides
      }
    }
  );
}

test('env config rejects weak SESSION_SECRET values', async () => {
  const weakSecrets = [
    '',
    'short-secret',
    'change_this_before_production',
    'change_me_to_a_long_random_text',
    'replace_with_random_text_at_least_32_chars'
  ];

  for (const secret of weakSecrets) {
    await assert.rejects(
      loadEnvWithSessionSecret(secret),
      /SESSION_SECRET/
    );
  }
});

test('env config accepts strong SESSION_SECRET values', async () => {
  await assert.doesNotReject(
    loadEnvWithSessionSecret('brakecheck-test-session-secret-32-characters')
  );
});

test('env config keeps localhost cors origins by default', async () => {
  const data = await readEnvJson();

  assert.deepEqual(data.corsOrigins, [
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ]);
});

test('env config adds configured cors origins', async () => {
  const data = await readEnvJson({
    corsOrigins: ' http://192.168.1.25:3000, http://192.168.10.50:3000 '
  });

  assert.deepEqual(data.corsOrigins, [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://192.168.1.25:3000',
    'http://192.168.10.50:3000'
  ]);
});

test('env config defaults to the local PostgreSQL database', async () => {
  const data = await readDatabaseEnvJson();

  assert.deepEqual(data, {
    host: 'localhost',
    port: 5432,
    name: 'brakecheck_pg',
    user: 'brakecheck_app'
  });
});

test('env config rejects invalid database ports', async () => {
  for (const dbPort of ['not-a-number', '0', '65536', '5432.5']) {
    await assert.rejects(
      loadEnvWithOverrides({ DB_PORT: dbPort }),
      /DB_PORT/
    );
  }
});
