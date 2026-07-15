@echo off
setlocal

if /i "%~1"=="--opened-by-wrapper" (
  shift
) else if "%~1"=="" (
  start "BrakeCheck - Install Auto Start" cmd /c ""%~f0" --opened-by-wrapper"
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
set "AUTO_START_SCRIPT=%PROJECT_ROOT%\scripts\auto-start-server.bat"
set "INSTALL_LOG=%SERVER_DIR%\auto-start-install.log"
set "DRY_RUN="

if /i "%~1"=="--dry-run" set "DRY_RUN=1"

if exist "%SERVER_DIR%" (
  echo [%DATE% %TIME%] Install Auto Start opened.>> "%INSTALL_LOG%"
)

echo ========================================
echo BrakeCheck - Install Auto Start
echo ========================================
echo.
echo This creates a Windows Scheduled Task for the current Windows user.
echo The task starts BrakeCheck when this user logs in.
echo.

if not exist "%AUTO_START_SCRIPT%" (
  echo ERROR: Cannot find auto-start script:
  echo   %AUTO_START_SCRIPT%
  echo.
  pause
  exit /b 1
)

where schtasks >nul 2>nul
if errorlevel 1 (
  echo ERROR: Windows schtasks command is not available.
  echo Fix: Ask IT to check Windows Task Scheduler.
  echo.
  pause
  exit /b 1
)

echo Task name:
echo   %TASK_NAME%
echo Script:
echo   %AUTO_START_SCRIPT%
echo.

if "%DRY_RUN%"=="1" (
  echo DRY RUN only. No task will be created.
  echo.
  echo Command that would run:
  echo schtasks /Create /TN "%TASK_NAME%" /TR "\"%AUTO_START_SCRIPT%\"" /SC ONLOGON /F
  echo.
  pause
  exit /b 0
)

schtasks /Create /TN "%TASK_NAME%" /TR "\"%AUTO_START_SCRIPT%\"" /SC ONLOGON /F
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%EXIT_CODE%"=="0" (
  if exist "%SERVER_DIR%" echo [%DATE% %TIME%] Install failed with code %EXIT_CODE%.>> "%INSTALL_LOG%"
  echo Auto Start install failed with error code %EXIT_CODE%.
  echo Fix: Ask IT to check Task Scheduler permissions.
  echo.
  pause
  exit /b %EXIT_CODE%
)

if exist "%SERVER_DIR%" echo [%DATE% %TIME%] Install completed successfully.>> "%INSTALL_LOG%"

echo Auto Start installed successfully.
echo BrakeCheck will start when this Windows user logs in.
echo.
echo Important:
echo   - MySQL must also start automatically.
echo   - If BrakeCheck does not open, check server\auto-start-server.log.
echo   - To remove Auto Start, run scripts\uninstall-auto-start.bat.
echo.
pause
exit /b 0
