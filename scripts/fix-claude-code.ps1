# Claude Code Connection - Automated Fix Script
# This script executes all the fixes mentioned in CLAUDE_CODE_FIX.md

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Claude Code Connection - Auto Fix" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Stop any running Electron processes
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

# Step 2: Delete old database
Write-Host ""
Write-Host "[2/5] Resetting database..." -ForegroundColor Yellow
$dbPath = Join-Path $env:APPDATA "Agents Dev\data\agents.db"
$dbWalPath = $dbPath + "-wal"
$dbShmPath = $dbPath + "-shm"

if (Test-Path $dbPath) {
    try {
        Remove-Item -Path $dbPath -Force -ErrorAction Stop
        Write-Host "      [OK] Deleted: agents.db" -ForegroundColor Green
        
        if (Test-Path $dbWalPath) {
            Remove-Item -Path $dbWalPath -Force -ErrorAction Stop
            Write-Host "      [OK] Deleted: agents.db-wal" -ForegroundColor Green
        }
        
        if (Test-Path $dbShmPath) {
            Remove-Item -Path $dbShmPath -Force -ErrorAction Stop
            Write-Host "      [OK] Deleted: agents.db-shm" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "      [ERROR] Could not delete database: $_" -ForegroundColor Red
        Write-Host "      Please close all apps and try again" -ForegroundColor Yellow
        exit 1
    }
}
else {
    Write-Host "      [OK] No old database found" -ForegroundColor Green
}

# Step 3: Verify schema files are SQLite
Write-Host ""
Write-Host "[3/5] Verifying schema configuration..." -ForegroundColor Yellow
$schemaFile = "src\main\lib\db\schema\index.ts"
$drizzleConfig = "drizzle.config.ts"

if (Test-Path $schemaFile) {
    $schemaContent = Get-Content $schemaFile -Raw
    if ($schemaContent -match "sqliteTable") {
        Write-Host "      [OK] Schema is configured for SQLite" -ForegroundColor Green
    }
    else {
        Write-Host "      [WARNING] Schema might not be SQLite" -ForegroundColor Yellow
    }
}
else {
    Write-Host "      [ERROR] Schema file not found" -ForegroundColor Red
}

if (Test-Path $drizzleConfig) {
    $configContent = Get-Content $drizzleConfig -Raw
    if ($configContent -match 'dialect:\s*"sqlite"') {
        Write-Host "      [OK] Drizzle config is set to SQLite" -ForegroundColor Green
    }
    else {
        Write-Host "      [WARNING] Drizzle config might not be SQLite" -ForegroundColor Yellow
    }
}
else {
    Write-Host "      [ERROR] Drizzle config not found" -ForegroundColor Red
}

# Step 4: Generate migrations
Write-Host ""
Write-Host "[4/5] Generating database migrations..." -ForegroundColor Yellow
try {
    $output = npm run db:generate 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "      [OK] Migrations generated successfully" -ForegroundColor Green
    }
    else {
        Write-Host "      [WARNING] Migration generation had issues" -ForegroundColor Yellow
        Write-Host "      Output: $output" -ForegroundColor Gray
    }
}
catch {
    Write-Host "      [ERROR] Failed to generate migrations: $_" -ForegroundColor Red
}

# Step 5: Verify migration files exist
Write-Host ""
Write-Host "[5/5] Verifying migration files..." -ForegroundColor Yellow
if (Test-Path "drizzle\meta\_journal.json") {
    Write-Host "      [OK] Migration journal found" -ForegroundColor Green
}
else {
    Write-Host "      [ERROR] Migration journal not found" -ForegroundColor Red
}

if (Test-Path "drizzle\*.sql") {
    $sqlFiles = Get-ChildItem "drizzle\*.sql"
    Write-Host "      [OK] Found $($sqlFiles.Count) SQL migration file(s)" -ForegroundColor Green
}
else {
    Write-Host "      [ERROR] No SQL migration files found" -ForegroundColor Red
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Fix Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Run: npm run dev" -ForegroundColor White
Write-Host "2. Check console for: [DB] Migrations completed" -ForegroundColor White
Write-Host "3. Try connecting Claude Code in the app" -ForegroundColor White
Write-Host ""
Write-Host "Note: You'll need a backend server running to complete" -ForegroundColor Gray
Write-Host "the Claude Code OAuth flow." -ForegroundColor Gray
Write-Host ""
