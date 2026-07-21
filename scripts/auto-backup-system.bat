@echo off
setlocal

set "PROJECT_ROOT=%~dp0.."
set "BACKUP_DIR=%PROJECT_ROOT%\backups"
set "ATTACHMENTS_DIR=%PROJECT_ROOT%\storage\attachments"
set "DB_BACKUP_SCRIPT=%PROJECT_ROOT%\scripts\auto-backup-database.bat"
set "NO_PAUSE="
set "DRY_RUN="
set "LOG_FILE=%BACKUP_DIR%\backup-log.txt"

:parse_args
if "%~1"=="" goto args_done
if /i "%~1"=="--no-pause" set "NO_PAUSE=1"
if /i "%~1"=="--dry-run" set "DRY_RUN=1"
shift
goto parse_args
:args_done

echo ========================================
echo BrakeCheck - Auto Backup System
echo ========================================
echo.
echo This will backup:
echo   1. PostgreSQL database
echo   2. storage\attachments files
echo.

if not "%DRY_RUN%"=="1" if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
if not "%DRY_RUN%"=="1" if errorlevel 1 (
  echo ERROR: Cannot create backup folder.
  echo Fix: Check permission and free space.
  exit /b 1
)

if not exist "%DB_BACKUP_SCRIPT%" (
  echo ERROR: Auto database backup script not found.
  echo   %DB_BACKUP_SCRIPT%
  call :Log "FAILED: auto database backup script not found"
  echo.
  if not "%NO_PAUSE%"=="1" pause
  exit /b 1
)

if not exist "%ATTACHMENTS_DIR%" (
  echo ERROR: storage\attachments folder not found.
  echo Fix: Check project files before running full system backup.
  call :Log "FAILED: storage attachments folder not found"
  echo.
  if not "%NO_PAUSE%"=="1" pause
  exit /b 1
)

for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmm"') do set "TIMESTAMP=%%I"
set "BACKUP_SET_DIR=%BACKUP_DIR%\brakecheck_auto_%TIMESTAMP%"

if exist "%BACKUP_SET_DIR%" (
  for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmmss"') do set "TIMESTAMP=%%I"
  set "BACKUP_SET_DIR=%BACKUP_DIR%\brakecheck_auto_%TIMESTAMP%"
)

set "DATABASE_TARGET=%BACKUP_SET_DIR%\database.backup"
set "ATTACHMENTS_TARGET=%BACKUP_SET_DIR%\attachments.zip"
set "INFO_FILE=%BACKUP_SET_DIR%\backup-info.txt"
set "LOG_FILE=%BACKUP_DIR%\backup-log.txt"

echo Backup set folder:
echo   %BACKUP_SET_DIR%
echo.

if "%DRY_RUN%"=="1" (
  echo DRY RUN only. No backup folder or files will be created.
  echo Would create:
  echo   %DATABASE_TARGET%
  echo   %ATTACHMENTS_TARGET%
  echo   %INFO_FILE%
  echo.
  if not "%NO_PAUSE%"=="1" pause
  exit /b 0
)

mkdir "%BACKUP_SET_DIR%"
if errorlevel 1 (
  echo ERROR: Cannot create backup folder.
  echo Fix: Check permission and free space.
  call :Log "FAILED: cannot create backup set folder"
  echo.
  if not "%NO_PAUSE%"=="1" pause
  exit /b 1
)

echo Created at: %DATE% %TIME%> "%INFO_FILE%"
echo Project root: %PROJECT_ROOT%>> "%INFO_FILE%"
echo Database backup: database.backup>> "%INFO_FILE%"
echo Attachments backup: attachments.zip>> "%INFO_FILE%"
echo Restore note: Restore database to a test database first. Do not restore automatically.>> "%INFO_FILE%"

echo [1/2] Backup database
call "%DB_BACKUP_SCRIPT%" --no-pause --output-file "%DATABASE_TARGET%"
set "DB_EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%DB_EXIT_CODE%"=="0" (
  echo System backup stopped because database backup failed.
  echo No complete backup set was created.
  call :Log "FAILED: database backup exit code %DB_EXIT_CODE%"
  echo.
  if not "%NO_PAUSE%"=="1" pause
  exit /b %DB_EXIT_CODE%
)

if not exist "%DATABASE_TARGET%" (
  echo ERROR: Database backup file is missing from the backup set.
  call :Log "FAILED: database backup file is missing"
  echo.
  if not "%NO_PAUSE%"=="1" pause
  exit /b 1
)

for %%F in ("%DATABASE_TARGET%") do if %%~zF LEQ 0 (
  echo ERROR: Database backup file is empty.
  call :Log "FAILED: database backup file is empty"
  echo.
  if not "%NO_PAUSE%"=="1" pause
  exit /b 1
)

echo [2/2] Backup attachments
powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -LiteralPath '%ATTACHMENTS_DIR%' -DestinationPath '%ATTACHMENTS_TARGET%' -Force"
set "ATTACHMENTS_EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%ATTACHMENTS_EXIT_CODE%"=="0" (
  echo Attachment backup failed with error code %ATTACHMENTS_EXIT_CODE%.
  echo No complete backup set was created.
  echo Fix: Check permission and free space.
  call :Log "FAILED: attachment backup exit code %ATTACHMENTS_EXIT_CODE%"
  if exist "%ATTACHMENTS_TARGET%" del "%ATTACHMENTS_TARGET%"
  echo.
  if not "%NO_PAUSE%"=="1" pause
  exit /b %ATTACHMENTS_EXIT_CODE%
)

if not exist "%ATTACHMENTS_TARGET%" (
  echo ERROR: Attachment backup file was not created.
  call :Log "FAILED: attachment backup file is missing"
  echo.
  if not "%NO_PAUSE%"=="1" pause
  exit /b 1
)

for %%F in ("%ATTACHMENTS_TARGET%") do if %%~zF LEQ 0 (
  echo ERROR: Attachment backup file is empty.
  call :Log "FAILED: attachment backup file is empty"
  if exist "%ATTACHMENTS_TARGET%" del "%ATTACHMENTS_TARGET%"
  echo.
  if not "%NO_PAUSE%"=="1" pause
  exit /b 1
)

call :Log "SUCCESS: system backup created at %BACKUP_SET_DIR%"
if errorlevel 1 (
  echo ERROR: Backup completed, but the success status could not be written to the log.
  echo   %LOG_FILE%
  echo Fix: Check permission and free space.
  if not "%NO_PAUSE%"=="1" pause
  exit /b 1
)
echo System backup completed successfully.
echo Folder:
echo   %BACKUP_SET_DIR%
echo.
echo Created files:
echo   database.backup
echo   attachments.zip
echo   backup-info.txt
echo.
echo Do not commit backup files to GitHub.
echo.
if not "%NO_PAUSE%"=="1" pause
exit /b 0

:Log
echo [%DATE% %TIME%] %~1>> "%LOG_FILE%"
if errorlevel 1 exit /b 1
exit /b 0
