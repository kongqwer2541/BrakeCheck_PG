@echo off
setlocal

set "PROJECT_ROOT=%~dp0.."
set "SERVER_DIR=%PROJECT_ROOT%\server"
set "ENV_FILE=%PROJECT_ROOT%\.env"

echo ========================================
echo BrakeCheck - Check System
echo ========================================
echo.

echo [1] Node.js
where node >nul 2>nul
if errorlevel 1 (
  echo   ERROR: Node.js not found.
  echo   Fix: Install Node.js, then open a new Terminal.
) else (
  for /f "tokens=*" %%V in ('node --version') do echo   OK: %%V
)
echo.

echo [2] npm
where npm >nul 2>nul
if errorlevel 1 (
  echo   ERROR: npm not found.
  echo   Fix: Install Node.js with npm.
) else (
  for /f "tokens=*" %%V in ('npm --version') do echo   OK: %%V
)
echo.

echo [3] Project folders
if exist "%SERVER_DIR%" (
  echo   OK: server folder found.
) else (
  echo   ERROR: server folder not found.
  echo   Fix: Check that this file is inside BrakeCheck\scripts.
)

if exist "%SERVER_DIR%\package.json" (
  echo   OK: server\package.json found.
) else (
  echo   ERROR: server\package.json not found.
  echo   Fix: Check project files or restore from GitHub.
)
echo.

echo [4] Environment file
if exist "%ENV_FILE%" (
  echo   OK: .env found.
) else (
  echo   WARNING: .env not found.
  echo   Fix: Copy .env.example to .env, then fill database settings.
)
echo.

echo [5] Next steps
echo   - If Node/npm is missing, install Node.js.
echo   - If .env is missing, create it from .env.example.
echo   - If database health fails, check MySQL and .env values.
echo.
pause
