import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const projectRoot = path.resolve(serverRoot, '..');

async function readScript(name) {
  return readFile(path.join(projectRoot, 'scripts', name), 'utf8');
}

test('local environment setup protects secrets and refuses overwrite', async () => {
  const script = await readScript('setup-local-env.bat');

  assert.match(script, /if exist "%ENV_FILE%"/i);
  assert.match(script, /Read-Host[^\r\n]+-AsSecureString/i);
  assert.match(script, /NewGuid/i);
  assert.match(script, /File\]::Move/i);
  assert.match(script, /--dry-run/i);
  assert.doesNotMatch(script, /set\s+"?DB_PASSWORD=/i);
  assert.doesNotMatch(script, /del\s+\/q\s+"%ENV_FILE%"/i);
});

test('start helper requires local configuration and uses the project entry file', async () => {
  const script = await readScript('start-server.bat');

  assert.match(script, /if not exist "%ENV_FILE%"/i);
  assert.match(script, /src\\index\.js/i);
  assert.match(script, /\.brakecheck-server\.pid/i);
  assert.match(script, /Press Ctrl\+C/i);
});

test('stop helper targets only the verified BrakeCheck process id', async () => {
  const script = await readScript('stop-server.bat');

  assert.match(script, /\.brakecheck-server\.pid/i);
  assert.match(script, /Win32_Process/i);
  assert.match(script, /taskkill\s+\/PID/i);
  assert.doesNotMatch(script, /taskkill[^\r\n]+\/IM\s+node/i);
});
