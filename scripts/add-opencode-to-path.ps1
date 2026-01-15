# Add OpenCode to PATH
# This script adds the OpenCode CLI to your system PATH

$opencodeDir = "C:\Users\EthFR\Downloads\1code-main\1code-main\opencode\packages\opencode"

Write-Host "Adding OpenCode to PATH..." -ForegroundColor Cyan

# Get current user PATH
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")

# Check if already in PATH
if ($currentPath.Contains($opencodeDir)) {
    Write-Host "✓ OpenCode is already in your PATH!" -ForegroundColor Green
    exit 0
}

# Add to PATH
$newPath = "$currentPath;$opencodeDir"
[Environment]::SetEnvironmentVariable("Path", $newPath, "User")

Write-Host "✓ OpenCode added to PATH successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT: You need to restart your terminal for changes to take effect." -ForegroundColor Yellow
Write-Host ""
Write-Host "After restarting, you can run:" -ForegroundColor Cyan
Write-Host "  opencode auth list" -ForegroundColor White
Write-Host "  opencode auth add openai" -ForegroundColor White
Write-Host "  opencode serve" -ForegroundColor White
