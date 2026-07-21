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
  for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "TIMESTAMP=%%I"
  set "BACKUP_FILE=%BACKUP_DIR%\%DB_NAME%_backup_%TIMESTAMP%.backup"
) else (
  set "BACKUP_FILE=%OUTPUT_FILE%"
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

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
if errorlevel 1 (
  echo ERROR: Cannot create the backup folder.
  echo Fix: Check folder permission and free space.
  echo.
  if not "%NO_PAUSE%"=="1" pause
  exit /b 1
)

if not "%DB_PASSWORD%"=="" set "PGPASSWORD=%DB_PASSWORD%"

"%PG_DUMP%" --host="%DB_HOST%" --port="%DB_PORT%" --username="%DB_USER%" --dbname="%DB_NAME%" --format=custom --file="%BACKUP_FILE%"
set "EXIT_CODE=%ERRORLEVEL%"
set "PGPASSWORD="
set "DB_PASSWORD="

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
