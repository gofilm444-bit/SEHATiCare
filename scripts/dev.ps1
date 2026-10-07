$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$api = Join-Path $root "sehaticare-api"
$web = Join-Path $root "sehaticare-web"

function Get-PortConflict {
  param([int]$Port)

  Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
    Select-Object -First 1
}

function Stop-ProcessTree {
  param([System.Diagnostics.Process]$Process)

  if (-not $Process) { return }
  try {
    $Process.Refresh()
    if (-not $Process.HasExited) {
      & taskkill.exe /PID $Process.Id /T /F *> $null
    }
  }
  catch {
    # The process may already have exited; cleanup is best-effort.
  }
}

$requiredPorts = @(
  @{ Name = "API"; Port = 3100 },
  @{ Name = "Web"; Port = 5173 }
)
$conflicts = foreach ($service in $requiredPorts) {
  $listener = Get-PortConflict -Port $service.Port
  if ($listener) {
    [pscustomobject]@{
      Name = $service.Name
      Port = $service.Port
      ProcessId = $listener.OwningProcess
    }
  }
}

if ($conflicts) {
  Write-Host "SEHATiCare tidak dijalankan karena port development masih digunakan:" -ForegroundColor Red
  foreach ($conflict in $conflicts) {
    Write-Host "- $($conflict.Name) port $($conflict.Port), PID $($conflict.ProcessId)" -ForegroundColor Yellow
  }
  Write-Host "Hentikan instance development lama, lalu jalankan kembali npm run dev."
  exit 1
}

Write-Host "Starting SEHATiCare API and Web..."
Write-Host "API: http://localhost:3100"
Write-Host "Web: https://localhost:5173"
Write-Host "Press Ctrl+C to stop both processes."

$apiProcess = $null
$webProcess = $null

try {
  $apiProcess = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory $api -NoNewWindow -PassThru
  $webProcess = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory $web -NoNewWindow -PassThru

  while (-not $apiProcess.HasExited -and -not $webProcess.HasExited) {
    Start-Sleep -Milliseconds 500
    $apiProcess.Refresh()
    $webProcess.Refresh()
  }
}
finally {
  foreach ($process in @($apiProcess, $webProcess)) {
    Stop-ProcessTree -Process $process
  }
}
