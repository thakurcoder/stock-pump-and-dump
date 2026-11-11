<#
.SYNOPSIS
    Starts both the FastAPI backend and Next.js frontend concurrently.
.DESCRIPTION
    Uses the shared virtual environment (pumpwatch\venv) to launch FastAPI on port 8000
    and launches Next.js on port 3000.
#>

$ErrorActionPreference = "Stop"

$ProjectRoot = $PSScriptRoot
$PythonExe = Join-Path $ProjectRoot "pumpwatch\venv\Scripts\python.exe"

if (-not (Test-Path $PythonExe)) {
    Write-Error "Shared Python venv not found at $PythonExe. Run setup first."
    exit 1
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Starting SentinelMarket / PumpWatch Platform" -ForegroundColor Cyan
Write-Host "  Backend:  http://localhost:8000" -ForegroundColor Green
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

# Start Backend Process
$BackendProcess = Start-Process -FilePath $PythonExe `
    -ArgumentList "-m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload" `
    -WorkingDirectory $ProjectRoot `
    -PassThru

# Start Frontend Process
$FrontendProcess = Start-Process -FilePath "npm" `
    -ArgumentList "run dev" `
    -WorkingDirectory (Join-Path $ProjectRoot "frontend") `
    -PassThru

Write-Host "Servers started. Press Ctrl+C in this window or close it to stop." -ForegroundColor Yellow

try {
    while (-not $BackendProcess.HasExited -and -not $FrontendProcess.HasExited) {
        Start-Sleep -Seconds 1
    }
}
finally {
    Write-Host "Shutting down servers..." -ForegroundColor Red
    if (-not $BackendProcess.HasExited) { Stop-Process -Id $BackendProcess.Id -Force }
    if (-not $FrontendProcess.HasExited) { Stop-Process -Id $FrontendProcess.Id -Force }
}
