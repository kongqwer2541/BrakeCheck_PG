@echo off
setlocal EnableExtensions EnableDelayedExpansion
title BrakeCheck Server

set "PROJECT_ROOT=%~dp0.."
set "SERVER_DIR=%PROJECT_ROOT%\server"
set "SERVER_ENTRY=%SERVER_DIR%\src\index.js"
set "ENV_FILE=%PROJECT_ROOT%\.env"
set "PID_FILE=%SERVER_DIR%\.brakecheck-server.pid"

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

if not exist "%ENV_FILE%" (
  echo ERROR: Local settings file .env was not found.
  echo Run scripts\setup-local-env.bat once, then try again.
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

if not exist "%SERVER_DIR%\node_modules\express\package.json" (
  echo ERROR: Server packages are not installed.
  echo Open a terminal in the server folder and run: npm install
  echo.
  pause
  exit /b 1
)

if exist "%PID_FILE%" (
  set "SERVER_PID="
  set /p SERVER_PID=<"%PID_FILE%"
  echo(!SERVER_PID!| findstr /r "^[1-9][0-9]*$" >nul
  if not errorlevel 1 (
    set "BRAKECHECK_PID=!SERVER_PID!"
    set "BRAKECHECK_ENTRY=%SERVER_ENTRY%"
    powershell -NoProfile -Command "$p = Get-CimInstance Win32_Process -Filter ('ProcessId = ' + $env:BRAKECHECK_PID) -ErrorAction SilentlyContinue; if ($p -and $p.Name -ieq 'node.exe' -and $p.CommandLine -like ('*' + $env:BRAKECHECK_ENTRY + '*')) { exit 0 } else { exit 1 }" >nul 2>nul
    if not errorlevel 1 (
      echo Server is already running with PID !SERVER_PID!.
      echo App URL: http://localhost:3000/
      echo.
      pause
      exit /b 0
    )
  )

  del /q "%PID_FILE%" >nul 2>nul
  if exist "%PID_FILE%" (
    echo ERROR: A stale PID file could not be removed.
    echo.
    pause
    exit /b 1
  )
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

node "%SERVER_ENTRY%"
set "EXIT_CODE=!ERRORLEVEL!"

echo.
if not "!EXIT_CODE!"=="0" (
  echo Server stopped with error code !EXIT_CODE!.
) else (
  echo Server stopped.
)
echo.
pause
exit /b !EXIT_CODE!
