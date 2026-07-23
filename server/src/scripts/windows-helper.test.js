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

  const serverStartIndex = script.search(/node "%SERVER_ENTRY%"/i);
  assert.ok(serverStartIndex >= 0);
  for (const name of ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']) {
    const clearIndex = script.search(new RegExp(`set "${name}="`, 'i'));
    assert.ok(clearIndex >= 0 && clearIndex < serverStartIndex, `${name} must be cleared before Node starts`);
  }
});

test('stop helper targets only the verified BrakeCheck process id', async () => {
  const script = await readScript('stop-server.bat');

  assert.match(script, /\.brakecheck-server\.pid/i);
  assert.match(script, /Win32_Process/i);
  assert.match(script, /taskkill\s+\/PID/i);
  assert.doesNotMatch(script, /taskkill[^\r\n]+\/IM\s+node/i);
});

test('system check accepts PostgreSQL 17 tools outside PATH', async () => {
  const script = await readScript('check-system.bat');

  assert.match(script, /where psql/i);
  assert.match(script, /where pg_dump/i);
  assert.match(script, /POSTGRES17_BIN=%ProgramFiles%\\PostgreSQL\\17\\bin/i);
  assert.match(script, /if exist "%POSTGRES17_BIN%\\psql\.exe"/i);
  assert.match(script, /if exist "%POSTGRES17_BIN%\\pg_dump\.exe"/i);
});

test('database backup helpers create PostgreSQL custom backups without restore commands', async () => {
  const scripts = await Promise.all([
    readScript('backup-database.bat'),
    readScript('auto-backup-database.bat')
  ]);

  for (const script of scripts) {
    assert.match(script, /DB_PORT=5432/i);
    assert.match(script, /pg_dump/i);
    assert.match(script, /--format=custom/i);
    assert.match(script, /--file=/i);
    assert.match(script, /BRAKECHECK_BACKUP_FILE/i);
    assert.match(script, /--output-file/i);
    assert.match(script, /\.backup/i);
    assert.match(script, /PGPASSWORD/i);
    assert.match(script, /\$env:PGPASSWORD\s*=\s*\$value/i);
    assert.match(script, /set "DB_PASSWORD="/i);
    assert.match(script, /--dry-run/i);
    assert.doesNotMatch(script, /mysqldump|MYSQL_PWD|\.sql/i);
    assert.doesNotMatch(script, /pg_restore|\bpsql\b|DROP\s+DATABASE|TRUNCATE\s+TABLE/i);
    assert.doesNotMatch(script, /(?:del|Remove-Item)[^\r\n]*\*\.backup/i);
  }
});

test('database backup helpers check mkdir errors only when folder creation runs', async () => {
  const scripts = await Promise.all([
    readScript('backup-database.bat'),
    readScript('backup-system.bat'),
    readScript('auto-backup-database.bat')
  ]);

  for (const script of scripts) {
    assert.match(
      script,
      /if not exist "%BACKUP_DIR%" \(\r?\n\s+mkdir "%BACKUP_DIR%"\r?\n\s+if errorlevel 1 \(/i
    );
  }
});

test('database backup helpers remove only matching outer password quotes', async () => {
  const scripts = await Promise.all([
    readScript('backup-database.bat'),
    readScript('auto-backup-database.bat')
  ]);

  for (const script of scripts) {
    assert.match(script, /\$value\s*=\s*\$env:DB_PASSWORD/i);
    assert.match(script, /\$first\s*=\s*\[int\]\$value\[0\]/i);
    assert.match(script, /\$last\s*=\s*\[int\]\$value\[\$value\.Length\s*-\s*1\]/i);
    assert.match(script, /\$first\s*-eq\s*39/i);
    assert.match(script, /\$first\s*-eq\s*34/i);
    assert.match(script, /Substring\(1,\s*\$value\.Length\s*-\s*2\)/i);
    assert.doesNotMatch(script, /set "DB_PASSWORD=%DB_PASSWORD:"=%"/i);
    assert.doesNotMatch(script, /set "DB_PASSWORD=%DB_PASSWORD:'=%"/i);
  }
});

test('database backup helpers keep output files inside backups and refuse overwrite', async () => {
  const scripts = await Promise.all([
    readScript('backup-database.bat'),
    readScript('auto-backup-database.bat')
  ]);

  for (const script of scripts) {
    assert.match(script, /call :ValidateOutputFile/i);
    assert.match(script, /GetFullPath/i);
    assert.match(script, /StartsWith/i);
    assert.match(script, /OrdinalIgnoreCase/i);
    assert.match(script, /GetExtension/i);
    assert.match(script, /if exist "%BACKUP_FILE%"/i);
  }
});

test('database backup filenames include the runtime timestamp', async () => {
  const scripts = await Promise.all([
    readScript('backup-database.bat'),
    readScript('auto-backup-database.bat')
  ]);

  for (const script of scripts) {
    assert.match(script, /do set "BACKUP_FILE=[^"\r\n]*%%I\.backup"/i);
    assert.doesNotMatch(script, /set "BACKUP_FILE=[^"\r\n]*%TIMESTAMP%/i);
  }
});

test('auto database backup uses a precise timestamp when the minute filename already exists', async () => {
  const script = await readScript('auto-backup-database.bat');

  assert.match(
    script,
    /if "%OUTPUT_FILE%"=="" if exist "%BACKUP_FILE%" for \/f %%I in \('[^']*yyyy-MM-dd_HHmmssfff[^']*'\) do set "BACKUP_FILE=[^"\r\n]*%%I\.backup"/i
  );
});

test('full system backups handle folder collisions without stale timestamps', async () => {
  const scripts = await Promise.all([
    readScript('backup-system.bat'),
    readScript('auto-backup-system.bat')
  ]);

  for (const script of scripts) {
    assert.match(script, /yyyy-MM-dd_HHmmssfff/i);
    assert.match(script, /do set "BACKUP_SET_DIR=[^"\r\n]*%%I"/i);
    assert.doesNotMatch(script, /set "BACKUP_SET_DIR=[^"\r\n]*%TIMESTAMP%/i);
  }
});

test('full system auto backup uses the PostgreSQL database backup file', async () => {
  const script = await readScript('auto-backup-system.bat');

  assert.match(script, /PostgreSQL database/i);
  assert.match(script, /database\.backup/i);
  assert.match(script, /--output-file "%DATABASE_TARGET%"/i);
  assert.doesNotMatch(script, /MySQL|mysqldump|database\.sql|LATEST_DB_BACKUP|Get-ChildItem[^\r\n]+-Filter/i);
});

test('full system backup bundles database, attachments, and backup info safely', async () => {
  const scripts = await Promise.all([
    readScript('backup-system.bat'),
    readScript('auto-backup-system.bat')
  ]);

  for (const script of scripts) {
    assert.match(script, /database\.backup/i);
    assert.match(script, /attachments\.zip/i);
    assert.match(script, /backup-info\.txt/i);
    assert.match(script, /Compress-Archive/i);
    assert.match(script, /--dry-run/i);
    assert.match(script, /%%~zF LEQ 0/i);
    assert.match(script, /--output-file "%DATABASE_TARGET%"/i);
    assert.match(script, /set "BACKUP_WORK_DIR=%BACKUP_SET_DIR%\.incomplete"/i);
    assert.match(script, /move "%BACKUP_WORK_DIR%" "%BACKUP_SET_DIR%"/i);

    const finalizeIndex = script.search(/move "%BACKUP_WORK_DIR%" "%BACKUP_SET_DIR%"/i);
    const successIndex = script.search(/(?:Full system backup|System backup) completed successfully/i);
    assert.ok(finalizeIndex >= 0 && successIndex > finalizeIndex);

    assert.doesNotMatch(script, /LATEST_DB_BACKUP|Get-ChildItem[^\r\n]+-Filter '\*\.backup'/i);
    assert.doesNotMatch(script, /pg_restore|\bpsql\b|DROP\s+DATABASE|TRUNCATE\s+TABLE/i);
    assert.doesNotMatch(script, /database\.sql|mysqldump|MySQL database/i);
  }
});

test('auto backup logs only success or failure without secrets or retention deletion', async () => {
  const scripts = await Promise.all([
    readScript('auto-backup-database.bat'),
    readScript('auto-backup-system.bat')
  ]);

  for (const script of scripts) {
    assert.match(script, /SUCCESS/i);
    assert.match(script, /FAILED/i);
    assert.doesNotMatch(script, /call :Log\s+"START/i);
    assert.doesNotMatch(script, /(?:call :Log|>>)[^\r\n]*(?:DB_PASSWORD|PGPASSWORD)/i);
    assert.doesNotMatch(script, /Remove-Item|del[^\r\n]*backups/i);
  }
});

test('auto backup task runs the batch script through cmd without storing passwords', async () => {
  const script = await readScript('register-auto-backup-task.ps1');

  assert.match(script, /cmd\.exe \/d \/c/i);
  assert.match(script, /auto-backup-system\.bat/i);
  assert.match(script, /--no-pause/i);
  assert.match(script, /DryRun/i);
  assert.match(script, /PostgreSQL database/i);
  assert.doesNotMatch(script, /DB_PASSWORD|PGPASSWORD|Remove-Item[^\r\n]*backups|del[^\r\n]*backups/i);
});
