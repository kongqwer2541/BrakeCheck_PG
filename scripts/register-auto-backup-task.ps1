param(
  [ValidateSet('Daily', 'Weekly')]
  [string]$Schedule = 'Daily',

  [string]$Time = '17:00',

  [ValidateSet('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN')]
  [string]$Day = 'FRI',

  [string]$TaskName = 'BrakeCheck Auto Backup',

  [switch]$DryRun,

  [switch]$Delete
)

$ErrorActionPreference = 'Stop'

function Write-Info {
  param([string]$Message)
  Write-Host $Message
}

function Test-TimeText {
  param([string]$Value)

  $parsed = [datetime]::MinValue
  return [datetime]::TryParseExact(
    $Value,
    'HH:mm',
    [Globalization.CultureInfo]::InvariantCulture,
    [Globalization.DateTimeStyles]::None,
    [ref]$parsed
  )
}

function Test-Administrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-TimeText -Value $Time)) {
  Write-Error "Time must use 24-hour HH:mm format, for example 17:00."
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$backupScript = Join-Path $scriptDir 'auto-backup-system.bat'

Write-Info '========================================'
Write-Info 'BrakeCheck - Register Auto Backup Task'
Write-Info '========================================'
Write-Info ''

if (-not (Test-Path -LiteralPath $backupScript)) {
  Write-Error "Cannot find auto-backup script: $backupScript"
}

if (-not (Get-Command schtasks.exe -ErrorAction SilentlyContinue)) {
  Write-Error 'Windows schtasks.exe is not available. Ask IT to check Windows Task Scheduler.'
}

if ($Delete) {
  $deleteArgs = @('/Delete', '/TN', $TaskName, '/F')

  Write-Info "Task name: $TaskName"
  Write-Info 'Action: delete auto backup task'
  Write-Info ''

  if ($DryRun) {
    Write-Info 'DRY RUN only. No task will be deleted.'
    Write-Info "Command: schtasks $($deleteArgs -join ' ')"
    exit 0
  }

  & schtasks.exe @deleteArgs
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Delete failed with exit code $LASTEXITCODE. If this says Access is denied, run PowerShell as Administrator or ask IT."
  }

  Write-Info ''
  Write-Info 'Auto Backup task deleted successfully.'
  exit 0
}

$taskRun = "`"$backupScript`" --no-pause"
$createArgs = @(
  '/Create',
  '/TN', $TaskName,
  '/TR', $taskRun,
  '/SC', $Schedule.ToUpperInvariant(),
  '/ST', $Time,
  '/F'
)

if ($Schedule -eq 'Weekly') {
  $createArgs += @('/D', $Day)
}

Write-Info "Project: $projectRoot"
Write-Info "Task name: $TaskName"
Write-Info "Backup script: $backupScript"
Write-Info "Schedule: $Schedule"
Write-Info "Time: $Time"
if ($Schedule -eq 'Weekly') {
  Write-Info "Day: $Day"
}
Write-Info ''
Write-Info 'This task stores no database password.'
Write-Info 'The backup script reads database settings from .env when it runs.'
Write-Info 'The default backup includes the MySQL database and storage\attachments.'
Write-Info ''

if (-not (Test-Administrator)) {
  Write-Info 'Note: If Windows reports Access is denied, open PowerShell as Administrator or ask IT.'
  Write-Info ''
}

if ($DryRun) {
  Write-Info 'DRY RUN only. No task will be created.'
  Write-Info "Command: schtasks $($createArgs -join ' ')"
  exit 0
}

& schtasks.exe @createArgs
if ($LASTEXITCODE -ne 0) {
  Write-Error "Create failed with exit code $LASTEXITCODE. If this says Access is denied, run PowerShell as Administrator or ask IT."
}

Write-Info ''
Write-Info 'Auto Backup task created successfully.'
Write-Info 'To change the time, run this script again with a new -Time value.'
Write-Info 'To delete it, run this script with -Delete.'
