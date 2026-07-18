import { unlink, writeFile } from 'node:fs/promises';

export async function writeServerPid(pidFilePath, pid = process.pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    throw new TypeError('Server process id must be a positive integer.');
  }

  await writeFile(pidFilePath, String(pid), { encoding: 'utf8', flag: 'w' });
}

export async function removeServerPid(pidFilePath) {
  try {
    await unlink(pidFilePath);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
}
