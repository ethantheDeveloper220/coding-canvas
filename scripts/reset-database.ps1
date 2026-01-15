# Database Reset Script
# This script deletes the old database to allow fresh migrations

Write-Host "Stopping any running Electron processes..." -ForegroundColor Yellow

# Try to stop the app gracefully
$electronProcesses = Get-Process -Name "electron" -ErrorAction SilentlyContinue
if ($electronProcesses) {
    Write-Host "Found" $electronProcesses.Count "Electron process(es). Stopping..." -ForegroundColor Yellow
    $electronProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# Database path
$dbPath = Join-Path $env:APPDATA "Agents Dev\data\agents.db"
$dbWalPath = $dbPath + "-wal"
$dbShmPath = $dbPath + "-shm"

Write-Host ""
Write-Host "Database location: $dbPath" -ForegroundColor Cyan
Write-Host ""

# Check if database exists
if (Test-Path $dbPath) {
    Write-Host "Database file found. Deleting..." -ForegroundColor Yellow
    
    try {
        # Delete main database file
        Remove-Item -Path $dbPath -Force -ErrorAction Stop
        Write-Host "[OK] Deleted: agents.db" -ForegroundColor Green
        
        # Delete WAL file if exists
        if (Test-Path $dbWalPath) {
            Remove-Item -Path $dbWalPath -Force -ErrorAction Stop
            Write-Host "[OK] Deleted: agents.db-wal" -ForegroundColor Green
        }
        
        # Delete SHM file if exists
        if (Test-Path $dbShmPath) {
            Remove-Item -Path $dbShmPath -Force -ErrorAction Stop
            Write-Host "[OK] Deleted: agents.db-shm" -ForegroundColor Green
        }
        
        Write-Host ""
        Write-Host "[SUCCESS] Database reset complete!" -ForegroundColor Green
        Write-Host "You can now run 'npm run dev' to start with a fresh database." -ForegroundColor Cyan
        
    }
    catch {
        Write-Host ""
        Write-Host "[ERROR] Error deleting database: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "The database file might be locked. Please:" -ForegroundColor Yellow
        Write-Host "1. Close the Electron app completely" -ForegroundColor Yellow
        Write-Host "2. Run this script again" -ForegroundColor Yellow
        exit 1
    }
}
else {
    Write-Host "No database file found. Nothing to delete." -ForegroundColor Green
    Write-Host "Run 'npm run dev' to create a fresh database." -ForegroundColor Cyan
}
