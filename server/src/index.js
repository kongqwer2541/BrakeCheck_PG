import { app } from './app.js';
import { env } from './config/env.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { removeServerPid, writeServerPid } from './utils/server-pid.js';

const serverDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pidFilePath = path.join(serverDirectory, '.brakecheck-server.pid');
let isShuttingDown = false;

const server = app.listen(env.appPort, async () => {
  try {
    await writeServerPid(pidFilePath);
    console.log(`${env.appName} server is running on http://localhost:${env.appPort}`);
  } catch {
    console.error('Unable to create the server PID file.');
    server.close(() => {
      process.exitCode = 1;
    });
  }
});

async function finishShutdown(exitCode) {
  try {
    await removeServerPid(pidFilePath);
  } catch {
    console.error('Unable to remove the server PID file.');
    exitCode = 1;
  }

  process.exit(exitCode);
}

function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`${signal} received. Closing server...`);

  const forceExitTimer = setTimeout(() => {
    console.error('Server shutdown timed out.');
    void finishShutdown(1);
  }, 10000);
  forceExitTimer.unref();

  server.close((error) => {
    clearTimeout(forceExitTimer);
    if (error) {
      console.error('Server could not close cleanly.');
    }
    void finishShutdown(error ? 1 : 0);
  });
}

server.on('error', () => {
  console.error('Server could not start or encountered a connection error.');
  process.exitCode = 1;
});

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
