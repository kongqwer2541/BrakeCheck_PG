@echo off
setlocal

set "PROJECT_ROOT=%~dp0.."
set "ENV_FILE=%PROJECT_ROOT%\.env"
set "BACKUP_DIR=%PROJECT_ROOT%\backups"
set "NO_PAUSE="

if /i "%~1"=="--no-pause" set "NO_PAUSE=1"

echo ========================================
echo BrakeCheck - Backup Database
echo ========================================
echo.

if not exist "%ENV_FILE%" (
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
)

if "%DB_HOST%"=="" set "DB_HOST=localhost"
if "%DB_PORT%"=="" set "DB_PORT=3306"

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

set "MYSQLDUMP=mysqldump"
where mysqldump >nul 2>nul
if errorlevel 1 (
  if exist "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe" (
    set "MYSQLDUMP=C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe"
  ) else if exist "C:\Program Files\MySQL\MySQL Workbench 8.0\mysqldump.exe" (
    set "MYSQLDUMP=C:\Program Files\MySQL\MySQL Workbench 8.0\mysqldump.exe"
  ) else if exist "C:\xampp\mysql\bin\mysqldump.exe" (
    set "MYSQLDUMP=C:\xampp\mysql\bin\mysqldump.exe"
  ) else if exist "C:\laragon\bin\mysql\mysql-8.0\bin\mysqldump.exe" (
    set "MYSQLDUMP=C:\laragon\bin\mysql\mysql-8.0\bin\mysqldump.exe"
  ) else (
    echo ERROR: mysqldump is not available.
    echo Fix: Install MySQL tools or add MySQL bin folder to PATH.
    echo Checked common paths:
    echo   C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe
    echo   C:\Program Files\MySQL\MySQL Workbench 8.0\mysqldump.exe
    echo   C:\xampp\mysql\bin\mysqldump.exe
    echo   C:\laragon\bin\mysql\mysql-8.0\bin\mysqldump.exe
    echo.
    if not "%NO_PAUSE%"=="1" pause
    exit /b 1
  )
)

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "TIMESTAMP=%%I"
set "BACKUP_FILE=%BACKUP_DIR%\%DB_NAME%_backup_%TIMESTAMP%.sql"

echo Database: %DB_NAME%
echo Host: %DB_HOST%
echo User: %DB_USER%
echo Backup file:
echo   %BACKUP_FILE%
echo.
echo The password is NOT stored in this file.
echo MySQL will ask for the database password after this line.
echo.

"%MYSQLDUMP%" -h "%DB_HOST%" -P "%DB_PORT%" -u "%DB_USER%" -p "%DB_NAME%" > "%BACKUP_FILE%"
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%EXIT_CODE%"=="0" (
  echo Backup failed with error code %EXIT_CODE%.
  echo Fix: Check MySQL is running, .env values are correct, and the password is correct.
  if exist "%BACKUP_FILE%" del "%BACKUP_FILE%"
  echo.
  if not "%NO_PAUSE%"=="1" pause
  exit /b %EXIT_CODE%
)

echo Backup completed successfully.
echo File:
echo   %BACKUP_FILE%
echo.
echo Do not commit backup files to GitHub.
echo.
if not "%NO_PAUSE%"=="1" pause
