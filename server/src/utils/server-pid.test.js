import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { removeServerPid, writeServerPid } from './server-pid.js';

test('writeServerPid stores only the numeric process id', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'brakecheck-pid-'));
  const pidFile = path.join(directory, 'server.pid');

  try {
    await writeServerPid(pidFile, 12345);
    assert.equal(await readFile(pidFile, 'utf8'), '12345');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('removeServerPid removes an existing file and accepts a missing file', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'brakecheck-pid-'));
  const pidFile = path.join(directory, 'server.pid');

  try {
    await writeServerPid(pidFile, 12345);
    await removeServerPid(pidFile);
    await removeServerPid(pidFile);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('writeServerPid rejects an invalid process id', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'brakecheck-pid-'));
  const pidFile = path.join(directory, 'server.pid');

  try {
    await assert.rejects(() => writeServerPid(pidFile, 0), /positive integer/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('a startup error does not remove the PID file of an existing server', async () => {
  const source = await readFile(new URL('../index.js', import.meta.url), 'utf8');
  const errorHandler = source.match(/server\.on\('error', \(\) => \{([\s\S]*?)\n\}\);/);

  assert.ok(errorHandler, 'Expected a server error handler.');
  assert.match(errorHandler[1], /process\.exitCode\s*=\s*1/);
  assert.doesNotMatch(errorHandler[1], /removeServerPid/);
});
