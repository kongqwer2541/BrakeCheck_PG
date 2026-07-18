@echo off
setlocal EnableExtensions EnableDelayedExpansion
title BrakeCheck - Stop Server

set "PROJECT_ROOT=%~dp0.."
set "SERVER_DIR=%PROJECT_ROOT%\server"
set "SERVER_ENTRY=%SERVER_DIR%\src\index.js"
set "PID_FILE=%SERVER_DIR%\.brakecheck-server.pid"

echo ========================================
echo BrakeCheck - Stop Server
echo ========================================
echo.

if not exist "%PID_FILE%" (
  echo BrakeCheck Server is not running, or it was started without the helper.
  echo.
  pause
  exit /b 0
)

set "SERVER_PID="
set /p SERVER_PID=<"%PID_FILE%"
echo(!SERVER_PID!| findstr /r "^[1-9][0-9]*$" >nul
if errorlevel 1 goto stale_pid

set "BRAKECHECK_PID=!SERVER_PID!"
set "BRAKECHECK_ENTRY=%SERVER_ENTRY%"
powershell -NoProfile -Command "$p = Get-CimInstance Win32_Process -Filter ('ProcessId = ' + $env:BRAKECHECK_PID) -ErrorAction SilentlyContinue; if ($p -and $p.Name -ieq 'node.exe' -and $p.CommandLine -like ('*' + $env:BRAKECHECK_ENTRY + '*')) { exit 0 } else { exit 1 }" >nul 2>nul
if errorlevel 1 goto stale_pid

echo Server PID: !SERVER_PID!
echo IMPORTANT: Do not stop while a user is saving or importing data.
set "CONFIRM="
set /p "CONFIRM=Type Y to stop the server: "
if /I not "!CONFIRM!"=="Y" (
  echo Cancelled. The server is still running.
  echo.
  pause
  exit /b 0
)

taskkill /PID !SERVER_PID! /T >nul 2>nul
if errorlevel 1 (
  echo ERROR: The server could not be stopped.
  echo Close it with Ctrl+C in the BrakeCheck Server window.
  echo.
  pause
  exit /b 1
)

del /q "%PID_FILE%" >nul 2>nul
echo Server stopped.
echo.
pause
exit /b 0

:stale_pid
del /q "%PID_FILE%" >nul 2>nul
if exist "%PID_FILE%" (
  echo ERROR: The stale PID file could not be removed.
  echo.
  pause
  exit /b 1
)
echo No matching BrakeCheck Server process was found.
echo The stale PID file was removed safely.
echo.
pause
exit /b 0
