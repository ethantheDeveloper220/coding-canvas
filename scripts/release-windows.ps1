# Windows Release Script
# Stops all Electron processes and runs the release build

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  1Code - Windows Release Build" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Stop Electron processes
Write-Host "[1/5] Stopping Electron processes..." -ForegroundColor Yellow
$electronProcesses = Get-Process -Name "electron" -ErrorAction SilentlyContinue
if ($electronProcesses) {
    Write-Host "      Found $($electronProcesses.Count) process(es). Stopping..." -ForegroundColor Gray
    $electronProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "      [OK] Processes stopped" -ForegroundColor Green
}
else {
    Write-Host "      [OK] No Electron processes running" -ForegroundColor Green
}

# Step 2: Clean release folder
Write-Host ""
Write-Host "[2/5] Cleaning release folder..." -ForegroundColor Yellow
if (Test-Path "release") {
    try {
        Remove-Item -Path "release" -Recurse -Force -ErrorAction Stop
        Write-Host "      [OK] Release folder removed" -ForegroundColor Green
    }
    catch {
        Write-Host "      [WARNING] Could not remove release folder: $_" -ForegroundColor Yellow
        Write-Host "      Continuing anyway..." -ForegroundColor Gray
    }
}
else {
    Write-Host "      [OK] No release folder to clean" -ForegroundColor Green
}

# Step 3: Download Claude binary
Write-Host ""
Write-Host "[3/5] Downloading Claude binary..." -ForegroundColor Yellow
npm run claude:download
if ($LASTEXITCODE -eq 0) {
    Write-Host "      [OK] Claude binary downloaded" -ForegroundColor Green
}
else {
    Write-Host "      [WARNING] Claude binary download failed" -ForegroundColor Yellow
    Write-Host "      Continuing anyway..." -ForegroundColor Gray
}

# Step 4: Build the app
Write-Host ""
Write-Host "[4/5] Building application..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "      [ERROR] Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "      [OK] Build completed" -ForegroundColor Green

# Step 5: Package for Windows
Write-Host ""
Write-Host "[5/5] Packaging for Windows..." -ForegroundColor Yellow
npm run package:win
if ($LASTEXITCODE -ne 0) {
    Write-Host "      [ERROR] Packaging failed!" -ForegroundColor Red
    exit 1
}
Write-Host "      [OK] Packaging completed" -ForegroundColor Green

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Release Build Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Output location: .\release\" -ForegroundColor Green
Write-Host ""

# List release contents
if (Test-Path "release") {
    Write-Host "Release contents:" -ForegroundColor Cyan
    Get-ChildItem "release" | ForEach-Object {
        Write-Host "  - $($_.Name)" -ForegroundColor White
    }
}
