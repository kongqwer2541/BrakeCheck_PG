@echo off
setlocal

set "PROJECT_ROOT=%~dp0.."
set "SERVER_DIR=%PROJECT_ROOT%\server"

echo ========================================
echo BrakeCheck - Start Server
echo ========================================
echo.

if not exist "%SERVER_DIR%\package.json" (
  echo ERROR: Cannot find server\package.json
  echo Please run this file from the BrakeCheck project folder.
  echo.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not available.
  echo Please install Node.js and try again.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm is not available.
  echo Please install Node.js with npm and try again.
  echo.
  pause
  exit /b 1
)

echo App URL:
echo   http://localhost:3000/
echo API health:
echo   http://localhost:3000/api/health
echo Database health:
echo   http://localhost:3000/api/database/health
echo.
echo Starting server...
echo Press Ctrl+C in this window to stop the server.
echo.

pushd "%SERVER_DIR%"
call npm start
set "EXIT_CODE=%ERRORLEVEL%"
popd

echo.
if not "%EXIT_CODE%"=="0" (
  echo Server stopped with error code %EXIT_CODE%.
) else (
  echo Server stopped.
)
echo.
pause
exit /b %EXIT_CODE%
