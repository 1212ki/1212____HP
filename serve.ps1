param(
  [ValidateSet("start", "stop", "status")]
  [string]$Action = "start",
  [int]$Port = 8888,
  [string]$Bind = "127.0.0.1"
)

$ErrorActionPreference = "Stop"

$PidFile = Join-Path $env:TEMP ("1212____HP-httpserver-{0}.pid" -f $Port)
$OutLogFile = Join-Path $env:TEMP ("1212____HP-httpserver-{0}.out.log" -f $Port)
$ErrLogFile = Join-Path $env:TEMP ("1212____HP-httpserver-{0}.err.log" -f $Port)

function Get-RunningProcess([int]$ProcessId) {
  try {
    return Get-Process -Id $ProcessId -ErrorAction Stop
  } catch {
    return $null
  }
}

function Read-PidFile() {
  if (!(Test-Path $PidFile)) { return $null }
  $raw = (Get-Content -Raw $PidFile).Trim()
  if ($raw -match "^\d+$") { return [int]$raw }
  return $null
}

if ($Action -eq "status") {
  $serverPid = Read-PidFile
  if (!$serverPid) {
    Write-Output "stopped (no pid file)"
    exit 0
  }
  $proc = Get-RunningProcess $serverPid
  if ($proc) {
    Write-Output ("running pid={0} url=http://{1}:{2}/ out={3} err={4}" -f $serverPid, $Bind, $Port, $OutLogFile, $ErrLogFile)
    exit 0
  }
  Write-Output "stopped (stale pid file)"
  exit 0
}

if ($Action -eq "stop") {
  $serverPid = Read-PidFile
  if (!$serverPid) {
    Write-Output "already stopped"
    exit 0
  }
  $proc = Get-RunningProcess $serverPid
  if ($proc) {
    Stop-Process -Id $serverPid -Force
    Write-Output ("stopped pid={0}" -f $serverPid)
  } else {
    Write-Output "stopped (process not found)"
  }
  Remove-Item -Force $PidFile -ErrorAction SilentlyContinue
  exit 0
}

# start
$existingPid = Read-PidFile
if ($existingPid) {
  $proc = Get-RunningProcess $existingPid
  if ($proc) {
    Write-Output ("already running pid={0} url=http://{1}:{2}/" -f $existingPid, $Bind, $Port)
    exit 0
  }
  Remove-Item -Force $PidFile -ErrorAction SilentlyContinue
}

if (!(Get-Command python -ErrorAction SilentlyContinue)) {
  throw "python not found in PATH"
}

# Keep it simple: spawn python http.server detached, capture output to a log file.
$args = @("-m", "http.server", "$Port", "--bind", "$Bind")
$proc = Start-Process `
  -FilePath "python" `
  -ArgumentList $args `
  -WorkingDirectory $PSScriptRoot `
  -PassThru `
  -RedirectStandardOutput $OutLogFile `
  -RedirectStandardError $ErrLogFile `
  -WindowStyle Hidden

Set-Content -NoNewline -Path $PidFile -Value $proc.Id
Write-Output ("started pid={0} url=http://{1}:{2}/ out={3} err={4}" -f $proc.Id, $Bind, $Port, $OutLogFile, $ErrLogFile)
