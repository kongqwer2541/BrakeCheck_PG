@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%.") do set "SCRIPT_DIR=%%~fI"
if exist "%SCRIPT_DIR%\server\package.json" (
  set "PROJECT_ROOT=%SCRIPT_DIR%"
) else (
  for %%I in ("%SCRIPT_DIR%\..") do set "PROJECT_ROOT=%%~fI"
)
set "SERVER_DIR=%PROJECT_ROOT%\server"
set "LOG_FILE=%SERVER_DIR%\auto-start-server.log"

echo ========================================>> "%LOG_FILE%"
echo [%DATE% %TIME%] BrakeCheck auto start requested.>> "%LOG_FILE%"

if not exist "%SERVER_DIR%\package.json" (
  echo [%DATE% %TIME%] ERROR: Cannot find server\package.json.>> "%LOG_FILE%"
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [%DATE% %TIME%] ERROR: Node.js is not available.>> "%LOG_FILE%"
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [%DATE% %TIME%] ERROR: npm is not available.>> "%LOG_FILE%"
  exit /b 1
)

pushd "%SERVER_DIR%"
call npm start >> "%LOG_FILE%" 2>&1
set "EXIT_CODE=%ERRORLEVEL%"
popd

echo [%DATE% %TIME%] BrakeCheck auto start stopped with code %EXIT_CODE%.>> "%LOG_FILE%"
exit /b %EXIT_CODE%
