<#
.SYNOPSIS
Setup script to run OpenAgri backend (Python/FastAPI) and Frontend (Expo) natively.
Backend is exposed via Localtunnel with a fixed URL.
#>

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "    Starting OpenAgri Native Dev Env      " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Check Node.js
Write-Host "Checking Node.js..." -ForegroundColor Yellow

$npmCmd = ""
if (Get-Command "npm.cmd" -ErrorAction SilentlyContinue) {
    $npmCmd = "npm.cmd"
} elseif (Get-Command "npm" -ErrorAction SilentlyContinue) {
    $npmCmd = "npm"
}

$npxCmd = ""
if (Get-Command "npx.cmd" -ErrorAction SilentlyContinue) {
    $npxCmd = "npx.cmd"
} elseif (Get-Command "npx" -ErrorAction SilentlyContinue) {
    $npxCmd = "npx"
}

if ($npmCmd -eq "" -or $npxCmd -eq "") {
    Write-Host "ERROR: npm/npx is not installed or not in PATH. Please install Node.js." -ForegroundColor Red
    exit 1
}

# 2. Check for Python 3.12
Write-Host "Checking for Python 3.12..." -ForegroundColor Yellow
$pythonCmd = ""
$possibleCmds = @("py -3.12", "python", "python3", "python3.12", "C:\Python312\python.exe")

foreach ($cmd in $possibleCmds) {
    try {
        $version = Invoke-Expression "$cmd --version 2>&1"
        if ($version -match "Python 3\.12") {
            $pythonCmd = $cmd
            break
        }
    } catch {}
}

if ($pythonCmd -eq "") {
    Write-Host "Python 3.12 is strictly required but not found!" -ForegroundColor Yellow
    $installChoice = Read-Host "Do you want to automatically install Python 3.12? (Y/N)"
    if ($installChoice -match "^[Yy]$") {
        Write-Host "Installing Python 3.12... This may take a minute." -ForegroundColor Cyan
        winget install -e --id Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements
        Write-Host "`nInstallation complete!" -ForegroundColor Green
        Write-Host "IMPORTANT: You MUST close this Terminal and open a new one for the changes to take effect." -ForegroundColor Yellow
        Write-Host "After opening a new Terminal, run .\setup.ps1 again." -ForegroundColor Cyan
        exit 0
    } else {
        Write-Host "ERROR: Please install Python 3.12 manually." -ForegroundColor Red
        exit 1
    }
}
Write-Host "Found Python 3.12: $pythonCmd" -ForegroundColor Green

# 3. Setup and Start Backend
Write-Host "`n[1/4] Setting up Backend (FastAPI)..." -ForegroundColor Yellow
Push-Location -Path "backend"

if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
    Write-Host "Creating backend .env file from .env.example..." -ForegroundColor Cyan
    Copy-Item ".env.example" -Destination ".env"
}

if (-not (Test-Path "venv")) {
    Write-Host "Creating virtual environment..." -ForegroundColor Cyan
    Invoke-Expression "$pythonCmd -m venv venv"
}

Write-Host "Activating venv and installing requirements... This might take a few minutes." -ForegroundColor Cyan
& .\venv\Scripts\python.exe -m pip install -r requirements.txt

Write-Host "Starting FastAPI in the background..." -ForegroundColor Cyan
$activateCmd = ".\venv\Scripts\activate"
$startBackendCmd = "uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --env-file .env"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "$activateCmd; Write-Host 'Running FastAPI...'; $startBackendCmd" -WorkingDirectory $PWD.Path -WindowStyle Normal

Write-Host "Waiting for Backend to start on port 8000..." -ForegroundColor Yellow
$maxRetries = 60
$retryCount = 0
$backendStarted = $false
while (-not $backendStarted -and $retryCount -lt $maxRetries) {
    if (Test-NetConnection -ComputerName "localhost" -Port 8000 -WarningAction SilentlyContinue | Where-Object { $_.TcpTestSucceeded }) {
        $backendStarted = $true
        Write-Host "Backend is up and running!" -ForegroundColor Green
    } else {
        Start-Sleep -Seconds 2
        $retryCount++
    }
}

if (-not $backendStarted) {
    Write-Host "WARNING: Backend did not start within the expected time. Continuing anyway..." -ForegroundColor Red
}

Pop-Location

# 4. Use Local IP instead of LocalTunnel
Write-Host "`n[2/4] Getting Local IP address..." -ForegroundColor Yellow
$localIp = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Wi-Fi' -ErrorAction SilentlyContinue).IPAddress
if (-not $localIp) {
    $localIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback|vEthernet|Virtual|VPN|Nord' -and $_.IPAddress -notmatch '169.254' } | Select-Object -First 1).IPAddress
}
if (-not $localIp) { $localIp = "127.0.0.1" }
$apiUrl = "http://$($localIp):8000"
Write-Host "Using API URL: $apiUrl" -ForegroundColor Green

# 5. Update frontend/.env
Write-Host "`n[3/4] Configuring Expo environment variables..." -ForegroundColor Yellow
$envPath = "frontend/.env"
$envContent = "EXPO_PUBLIC_API_URL=$apiUrl/api/v1"
Set-Content -Path $envPath -Value $envContent
Write-Host "Saved EXPO_PUBLIC_API_URL=$apiUrl/api/v1 to $envPath" -ForegroundColor Green

# 6. Install frontend dependencies and Start Expo
Write-Host "`n[4/4] Installing Frontend Dependencies & Starting Expo..." -ForegroundColor Yellow
Push-Location -Path "frontend"

if (-not (Test-Path "node_modules")) {
    Write-Host "node_modules not found, running npm install..." -ForegroundColor Cyan
    & $npmCmd install
} else {
    Write-Host "node_modules exists, skipping npm install to save time." -ForegroundColor Cyan
}

Write-Host "`nStarting Mobile UI (Expo Go)..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the development server when done." -ForegroundColor Cyan
$env:REACT_NATIVE_PACKAGER_HOSTNAME = $localIp

# Start Expo Go via LAN and clear cache to prevent bundle freeze
& $npxCmd expo start -c

Pop-Location
