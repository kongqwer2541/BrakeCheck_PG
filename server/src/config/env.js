import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');

dotenv.config({
  path: path.join(projectRoot, '.env')
});

const weakSessionSecrets = new Set([
  'change_this_before_production',
  'change_me_to_a_long_random_text',
  'replace_with_random_text_at_least_32_chars'
]);

function readSessionSecret() {
  const sessionSecret = String(process.env.SESSION_SECRET || '').trim();

  if (!sessionSecret || sessionSecret.length < 32 || weakSessionSecrets.has(sessionSecret)) {
    throw new Error('SESSION_SECRET must be set to a strong random text with at least 32 characters.');
  }

  return sessionSecret;
}

function readCorsOrigins() {
  const appPort = String(process.env.APP_PORT || 3000).trim();
  const defaultOrigins = [
    `http://localhost:${appPort}`,
    `http://127.0.0.1:${appPort}`
  ];

  const configuredOrigins = String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return [...new Set([...defaultOrigins, ...configuredOrigins])];
}

function readDatabasePort() {
  const port = Number(String(process.env.DB_PORT || '5432').trim());

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DB_PORT must be an integer between 1 and 65535.');
  }

  return port;
}

export const env = {
  appName: process.env.APP_NAME || 'BrakeCheck',
  appPort: Number(process.env.APP_PORT || 3000),
  corsOrigins: readCorsOrigins(),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: readDatabasePort(),
    name: process.env.DB_NAME || 'brakecheck_pg',
    user: process.env.DB_USER || 'brakecheck_app',
    password: process.env.DB_PASSWORD || ''
  },
  sessionSecret: readSessionSecret()
};
