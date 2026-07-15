@echo off
setlocal

if /i "%~1"=="--opened-by-wrapper" (
  shift
) else if "%~1"=="" (
  start "BrakeCheck - Uninstall Auto Start" cmd /c ""%~f0" --opened-by-wrapper"
  exit /b
)

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%.") do set "SCRIPT_DIR=%%~fI"
if exist "%SCRIPT_DIR%\server\package.json" (
  set "PROJECT_ROOT=%SCRIPT_DIR%"
) else (
  for %%I in ("%SCRIPT_DIR%\..") do set "PROJECT_ROOT=%%~fI"
)
set "SERVER_DIR=%PROJECT_ROOT%\server"
set "TASK_NAME=BrakeCheck Auto Start"
set "INSTALL_LOG=%SERVER_DIR%\auto-start-install.log"
set "DRY_RUN="

if /i "%~1"=="--dry-run" set "DRY_RUN=1"

if exist "%SERVER_DIR%" (
  echo [%DATE% %TIME%] Uninstall Auto Start opened.>> "%INSTALL_LOG%"
)

echo ========================================
echo BrakeCheck - Uninstall Auto Start
echo ========================================
echo.
echo This removes the Windows Scheduled Task for BrakeCheck Auto Start.
echo.

where schtasks >nul 2>nul
if errorlevel 1 (
  echo ERROR: Windows schtasks command is not available.
  echo Fix: Ask IT to check Windows Task Scheduler.
  echo.
  pause
  exit /b 1
)

schtasks /Query /TN "%TASK_NAME%" >nul 2>nul
if errorlevel 1 (
  if exist "%SERVER_DIR%" echo [%DATE% %TIME%] Uninstall skipped because task was not found.>> "%INSTALL_LOG%"
  echo Auto Start task was not found:
  echo   %TASK_NAME%
  echo.
  pause
  exit /b 0
)

if "%DRY_RUN%"=="1" (
  echo DRY RUN only. No task will be deleted.
  echo.
  echo Command that would run:
  echo schtasks /Delete /TN "%TASK_NAME%" /F
  echo.
  pause
  exit /b 0
)

schtasks /Delete /TN "%TASK_NAME%" /F
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%EXIT_CODE%"=="0" (
  if exist "%SERVER_DIR%" echo [%DATE% %TIME%] Uninstall failed with code %EXIT_CODE%.>> "%INSTALL_LOG%"
  echo Auto Start uninstall failed with error code %EXIT_CODE%.
  echo Fix: Ask IT to check Task Scheduler permissions.
  echo.
  pause
  exit /b %EXIT_CODE%
)

if exist "%SERVER_DIR%" echo [%DATE% %TIME%] Uninstall completed successfully.>> "%INSTALL_LOG%"

echo Auto Start removed successfully.
echo BrakeCheck will no longer start automatically from this task.
echo.
pause
exit /b 0
