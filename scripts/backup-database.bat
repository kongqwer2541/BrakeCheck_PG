@echo off
setlocal

set "PROJECT_ROOT=%~dp0.."
set "ROOT_ENV_FILE=%PROJECT_ROOT%\.env"
set "SERVER_ENV_FILE=%PROJECT_ROOT%\server\.env"
set "BACKUP_DIR=%PROJECT_ROOT%\backups"
set "NO_PAUSE="
set "DRY_RUN="
set "OUTPUT_FILE="
set "ARGUMENT_ERROR="

:parse_args
if "%~1"=="" goto args_done
if /i "%~1"=="--no-pause" set "NO_PAUSE=1"
if /i "%~1"=="--dry-run" set "DRY_RUN=1"
if /i "%~1"=="--output-file" (
  if "%~2"=="" set "ARGUMENT_ERROR=--output-file requires a path."
  if /i "%~2"=="--no-pause" set "ARGUMENT_ERROR=--output-file requires a path."
  if /i "%~2"=="--dry-run" set "ARGUMENT_ERROR=--output-file requires a path."
  set "OUTPUT_FILE=%~2"
  shift
)
shift
goto parse_args
:args_done

if not "%ARGUMENT_ERROR%"=="" (
  echo ERROR: %ARGUMENT_ERROR%
  echo.
  if not "%NO_PAUSE%"=="1" pause
  exit /b 1
)

echo ========================================
echo BrakeCheck - Backup PostgreSQL Database
echo ========================================
echo.

if exist "%ROOT_ENV_FILE%" (
  set "ENV_FILE=%ROOT_ENV_FILE%"
) else if exist "%SERVER_ENV_FILE%" (
  set "ENV_FILE=%SERVER_ENV_FILE%"
) else (
  echo ERROR: .env file not found.
  echo Fix: Copy .env.example to .env and fill database settings.
  echo.
  if not "%NO_PAUSE%"=="1" pause
  exit /b 1
)

for /f "usebackq tokens=1,* delims==" %%A in ("%ENV_FILE%") do (
  if /i "%%A"=="DB_HOST" set "DB_HOST=%%B"
  if /i "%%A"=="DB_PORT" set "DB_PORT=%%B"
  if /i "%%A"=="DB_NAME" set "DB_NAME=%%B"
  if /i "%%A"=="DB_USER" set "DB_USER=%%B"
  if /i "%%A"=="DB_PASSWORD" set "DB_PASSWORD=%%B"
)

if "%DB_HOST%"=="" set "DB_HOST=localhost"
if "%DB_PORT%"=="" set "DB_PORT=5432"

if "%DB_NAME%"=="" (
  echo ERROR: DB_NAME is missing in .env.
  echo.
  if not "%NO_PAUSE%"=="1" pause
  exit /b 1
)

if "%DB_USER%"=="" (
  echo ERROR: DB_USER is missing in .env.
  echo.
  if not "%NO_PAUSE%"=="1" pause
  exit /b 1
)

set "PG_DUMP=pg_dump"
where pg_dump >nul 2>nul
if errorlevel 1 (
  if exist "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" (
    set "PG_DUMP=C:\Program Files\PostgreSQL\17\bin\pg_dump.exe"
  ) else (
    echo ERROR: pg_dump is not available.
    echo Fix: Install PostgreSQL 17 tools or add its bin folder to PATH.
    echo Checked path:
    echo   C:\Program Files\PostgreSQL\17\bin\pg_dump.exe
    echo.
    if not "%NO_PAUSE%"=="1" pause
    exit /b 1
  )
)

if "%OUTPUT_FILE%"=="" (
  for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "BACKUP_FILE=%BACKUP_DIR%\%DB_NAME%_backup_%%I.backup"
) else (
  set "BACKUP_FILE=%OUTPUT_FILE%"
)

call :ValidateOutputFile "%BACKUP_FILE%"
if errorlevel 1 (
  echo ERROR: Backup file must be a new .backup file inside the backups folder.
  echo   %BACKUP_DIR%
  echo.
  if not "%NO_PAUSE%"=="1" pause
  exit /b 1
)

if exist "%BACKUP_FILE%" (
  echo ERROR: Backup file already exists. Existing backups are never overwritten.
  echo   %BACKUP_FILE%
  echo.
  if not "%NO_PAUSE%"=="1" pause
  exit /b 1
)

echo Environment file:
echo   %ENV_FILE%
echo Database: %DB_NAME%
echo Host: %DB_HOST%
echo User: %DB_USER%
echo Backup file:
echo   %BACKUP_FILE%
echo.
echo The password is read from .env when DB_PASSWORD is set.
echo The password is not printed or stored in this script.
echo.

if "%DRY_RUN%"=="1" (
  echo DRY RUN only. No backup folder or file was created.
  echo.
  if not "%NO_PAUSE%"=="1" pause
  exit /b 0
)

if not exist "%BACKUP_DIR%" (
  mkdir "%BACKUP_DIR%"
  if errorlevel 1 (
    echo ERROR: Cannot create the backup folder.
    echo Fix: Check folder permission and free space.
    echo.
    if not "%NO_PAUSE%"=="1" pause
    exit /b 1
  )
)

set "BRAKECHECK_PG_DUMP=%PG_DUMP%"
set "BRAKECHECK_DB_HOST=%DB_HOST%"
set "BRAKECHECK_DB_PORT=%DB_PORT%"
set "BRAKECHECK_DB_USER=%DB_USER%"
set "BRAKECHECK_DB_NAME=%DB_NAME%"
set "BRAKECHECK_BACKUP_FILE=%BACKUP_FILE%"
set "BRAKECHECK_NO_PASSWORD="
call :RunPgDump
set "EXIT_CODE=%ERRORLEVEL%"
set "DB_PASSWORD="
set "BRAKECHECK_PG_DUMP="
set "BRAKECHECK_DB_HOST="
set "BRAKECHECK_DB_PORT="
set "BRAKECHECK_DB_USER="
set "BRAKECHECK_DB_NAME="
set "BRAKECHECK_BACKUP_FILE="
set "BRAKECHECK_NO_PASSWORD="

echo.
if not "%EXIT_CODE%"=="0" (
  echo Backup failed with error code %EXIT_CODE%.
  echo Fix: Check PostgreSQL, .env values, password, permission, and free space.
  if exist "%BACKUP_FILE%" del "%BACKUP_FILE%"
  echo.
  if not "%NO_PAUSE%"=="1" pause
  exit /b %EXIT_CODE%
)

if not exist "%BACKUP_FILE%" (
  echo ERROR: pg_dump finished but the backup file was not created.
  echo.
  if not "%NO_PAUSE%"=="1" pause
  exit /b 1
)

for %%F in ("%BACKUP_FILE%") do if %%~zF LEQ 0 (
  echo ERROR: The backup file is empty.
  del "%BACKUP_FILE%"
  echo.
  if not "%NO_PAUSE%"=="1" pause
  exit /b 1
)

echo Backup completed successfully.
echo File:
echo   %BACKUP_FILE%
echo.
echo Do not commit backup files to GitHub.
echo.
if not "%NO_PAUSE%"=="1" pause
exit /b 0

:ValidateOutputFile
set "BRAKECHECK_BACKUP_ROOT=%BACKUP_DIR%"
set "BRAKECHECK_OUTPUT_TARGET=%~1"
powershell -NoProfile -Command "try { $root = [IO.Path]::GetFullPath($env:BRAKECHECK_BACKUP_ROOT).TrimEnd([char[]]'\/') + [IO.Path]::DirectorySeparatorChar; $target = [IO.Path]::GetFullPath($env:BRAKECHECK_OUTPUT_TARGET); if (-not $target.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) { exit 1 }; if ([IO.Path]::GetExtension($target) -ine '.backup') { exit 2 } } catch { exit 3 }" >nul 2>nul
set "VALIDATION_EXIT_CODE=%ERRORLEVEL%"
set "BRAKECHECK_BACKUP_ROOT="
set "BRAKECHECK_OUTPUT_TARGET="
exit /b %VALIDATION_EXIT_CODE%

:RunPgDump
powershell -NoProfile -Command "$value = $env:DB_PASSWORD; if ($null -ne $value -and $value.Length -ge 2) { $first = [int]$value[0]; $last = [int]$value[$value.Length - 1]; if (($first -eq 39 -and $last -eq 39) -or ($first -eq 34 -and $last -eq 34)) { $value = $value.Substring(1, $value.Length - 2) } }; $env:PGPASSWORD = $null; if (-not [string]::IsNullOrEmpty($value)) { $env:PGPASSWORD = $value }; $arguments = @(('--host=' + $env:BRAKECHECK_DB_HOST), ('--port=' + $env:BRAKECHECK_DB_PORT), ('--username=' + $env:BRAKECHECK_DB_USER), ('--dbname=' + $env:BRAKECHECK_DB_NAME), '--format=custom', ('--file=' + $env:BRAKECHECK_BACKUP_FILE)); if ($env:BRAKECHECK_NO_PASSWORD -eq '1') { $arguments += '--no-password' }; & $env:BRAKECHECK_PG_DUMP $arguments; exit $LASTEXITCODE"
exit /b %ERRORLEVEL%
