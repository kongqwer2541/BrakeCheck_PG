@echo off
setlocal

set "PROJECT_ROOT=%~dp0.."
set "ROOT_ENV_FILE=%PROJECT_ROOT%\.env"
set "SERVER_ENV_FILE=%PROJECT_ROOT%\server\.env"
set "BACKUP_DIR=%PROJECT_ROOT%\backups"
set "NO_PAUSE="
set "DRY_RUN="

:parse_args
if "%~1"=="" goto args_done
if /i "%~1"=="--no-pause" set "NO_PAUSE=1"
if /i "%~1"=="--dry-run" set "DRY_RUN=1"
shift
goto parse_args
:args_done

echo ========================================
echo BrakeCheck - Auto Backup Database
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
if "%DB_PORT%"=="" set "DB_PORT=3306"

if "%DB_NAME%"=="" (
  echo ERROR: DB_NAME is missing in .env.
  echo Fix: Check the database name in the environment file.
  echo.
  if not "%NO_PAUSE%"=="1" pause
  exit /b 1
)

if "%DB_USER%"=="" (
  echo ERROR: DB_USER is missing in .env.
  echo Fix: Check the database user in the environment file.
  echo.
  if not "%NO_PAUSE%"=="1" pause
  exit /b 1
)

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
set "LOG_FILE=%BACKUP_DIR%\backup-log.txt"

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
    call :Log "FAILED: mysqldump not found."
    echo ERROR: mysqldump is not available.
    echo Fix: Install MySQL tools or add the MySQL bin folder to PATH.
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

for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmm"') do set "TIMESTAMP=%%I"
set "BACKUP_FILE=%BACKUP_DIR%\%DB_NAME%_%TIMESTAMP%.sql"

if exist "%BACKUP_FILE%" (
  for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmmss"') do set "TIMESTAMP=%%I"
  set "BACKUP_FILE=%BACKUP_DIR%\%DB_NAME%_%TIMESTAMP%.sql"
)

echo Environment file:
echo   %ENV_FILE%
echo Database:
echo   %DB_NAME%
echo Backup file:
echo   %BACKUP_FILE%
echo.
echo Password is read from .env only if DB_PASSWORD is set.
echo This script does not print or store the password in the script file.
echo.

if "%DRY_RUN%"=="1" (
  call :Log "DRY RUN: %DB_NAME% would backup to %BACKUP_FILE%"
  echo DRY RUN only. No backup file was created.
  echo.
  if not "%NO_PAUSE%"=="1" pause
  exit /b 0
)

if not "%DB_PASSWORD%"=="" set "MYSQL_PWD=%DB_PASSWORD%"

call :Log "START: %DB_NAME% backup to %BACKUP_FILE%"
"%MYSQLDUMP%" -h "%DB_HOST%" -P "%DB_PORT%" -u "%DB_USER%" "%DB_NAME%" > "%BACKUP_FILE%"
set "EXIT_CODE=%ERRORLEVEL%"
set "MYSQL_PWD="

echo.
if not "%EXIT_CODE%"=="0" (
  call :Log "FAILED: %DB_NAME% backup failed with code %EXIT_CODE%"
  echo Backup failed with error code %EXIT_CODE%.
  echo Fix: Check that MySQL is running, .env values are correct, and DB_PASSWORD is correct.
  echo If mysqldump is missing, install MySQL tools or add MySQL bin folder to PATH.
  if exist "%BACKUP_FILE%" del "%BACKUP_FILE%"
  echo.
  if not "%NO_PAUSE%"=="1" pause
  exit /b %EXIT_CODE%
)

call :Log "SUCCESS: %DB_NAME% backup created at %BACKUP_FILE%"
echo Backup completed successfully.
echo File:
echo   %BACKUP_FILE%
echo.
echo Log:
echo   %LOG_FILE%
echo.
echo Do not commit backup files to GitHub.
echo.
if not "%NO_PAUSE%"=="1" pause
exit /b 0

:Log
echo [%DATE% %TIME%] %~1>> "%LOG_FILE%"
exit /b 0
