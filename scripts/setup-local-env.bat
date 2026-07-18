@echo off
setlocal EnableExtensions
title BrakeCheck Local Setup

set "PROJECT_ROOT=%~dp0.."
set "ENV_FILE=%PROJECT_ROOT%\.env"

echo ========================================
echo BrakeCheck - One-Time Local Setup
echo ========================================
echo.

where powershell >nul 2>nul
if errorlevel 1 (
  echo ERROR: Windows PowerShell is not available.
  echo.
  pause
  exit /b 1
)

if /I "%~1"=="--dry-run" (
  echo DRY RUN: No password will be requested and no file will be written.
  echo Target: %ENV_FILE%
  if exist "%ENV_FILE%" (
    echo Existing .env is protected and would not be overwritten.
  ) else (
    echo The setup is ready to create a new .env file.
  )
  exit /b 0
)

if exist "%ENV_FILE%" (
  echo STOPPED: .env already exists.
  echo This helper will not read or overwrite your current settings.
  echo.
  pause
  exit /b 1
)

set "BRAKECHECK_ENV_FILE=%ENV_FILE%"
powershell -NoProfile -Command ^
  "$securePassword = Read-Host 'PostgreSQL password for brakecheck_app' -AsSecureString;" ^
  "$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword);" ^
  "$temporaryFile = [IO.Path]::GetTempFileName();" ^
  "try {" ^
  "  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer);" ^
  "  if ([string]::IsNullOrWhiteSpace($plainPassword)) { throw 'Password cannot be empty.' }" ^
  "  $sessionSecret = ([guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N'));" ^
  "  $lines = @('APP_NAME=BrakeCheck', 'APP_PORT=3000', 'DB_HOST=localhost', 'DB_PORT=5432', 'DB_NAME=brakecheck_pg', 'DB_USER=brakecheck_app', ('DB_PASSWORD=''' + $plainPassword + ''''), ('SESSION_SECRET=' + $sessionSecret));" ^
  "  [IO.File]::WriteAllLines($temporaryFile, $lines, [Text.UTF8Encoding]::new($false));" ^
  "  [IO.File]::Move($temporaryFile, $env:BRAKECHECK_ENV_FILE);" ^
  "} finally {" ^
  "  if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }" ^
  "  if (Test-Path -LiteralPath $temporaryFile) { Remove-Item -LiteralPath $temporaryFile -Force }" ^
  "}"

if errorlevel 1 (
  echo.
  echo ERROR: Local settings were not created.
  echo.
  pause
  exit /b 1
)

echo.
echo Local settings were created successfully.
echo Next: Double-click scripts\start-server.bat
echo.
pause
exit /b 0
