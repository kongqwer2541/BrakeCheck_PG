@echo off
setlocal

set "PROJECT_ROOT=%~dp0.."
set "BACKUP_DIR=%PROJECT_ROOT%\backups"
set "ATTACHMENTS_DIR=%PROJECT_ROOT%\storage\attachments"

echo ========================================
echo BrakeCheck - Backup System
echo ========================================
echo.
echo This will backup:
echo   1. MySQL database
echo   2. storage\attachments files
echo.
echo Backup files will be created in:
echo   %BACKUP_DIR%
echo.
echo Do not commit backup files to GitHub.
echo.

call "%PROJECT_ROOT%\scripts\backup-database.bat" --no-pause
set "DB_EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%DB_EXIT_CODE%"=="0" (
  echo System backup stopped because database backup failed.
  echo.
  pause
  exit /b %DB_EXIT_CODE%
)

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "TIMESTAMP=%%I"
set "ATTACHMENTS_BACKUP_FILE=%BACKUP_DIR%\attachments_backup_%TIMESTAMP%.zip"

echo ========================================
echo BrakeCheck - Backup Attachments
echo ========================================
echo.

if not exist "%ATTACHMENTS_DIR%" (
  echo WARNING: storage\attachments folder not found.
  echo Attachment backup was skipped.
  echo.
  echo Database backup was completed, but attachments were not backed up.
  echo Fix: Check that the project has storage\attachments.
  echo.
  pause
  exit /b 1
)

echo Attachments folder:
echo   %ATTACHMENTS_DIR%
echo Backup file:
echo   %ATTACHMENTS_BACKUP_FILE%
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -LiteralPath '%ATTACHMENTS_DIR%' -DestinationPath '%ATTACHMENTS_BACKUP_FILE%' -Force"
set "ATTACHMENTS_EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%ATTACHMENTS_EXIT_CODE%"=="0" (
  echo Attachment backup failed with error code %ATTACHMENTS_EXIT_CODE%.
  echo Fix: Check that PowerShell can write to the backups folder.
  if exist "%ATTACHMENTS_BACKUP_FILE%" del "%ATTACHMENTS_BACKUP_FILE%"
  echo.
  pause
  exit /b %ATTACHMENTS_EXIT_CODE%
)

echo System backup completed successfully.
echo.
echo Created files:
echo   Database backup: see the database backup message above
echo   Attachments backup:
echo     %ATTACHMENTS_BACKUP_FILE%
echo.
echo For long-term storage, copy these backup files outside the repo
echo or to the company-approved storage location.
echo.
pause
