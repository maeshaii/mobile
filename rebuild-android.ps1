# 🔧 Quick Rebuild Script for Android
# This script will clean and rebuild your Android app with new permissions

Write-Host "🧹 Step 1: Cleaning old build artifacts..." -ForegroundColor Cyan

# Stop any running Metro bundler
Write-Host "Stopping Metro bundler (if running)..." -ForegroundColor Yellow
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue

# Remove old Android folder
if (Test-Path "android") {
    Write-Host "Removing old android folder..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force android -ErrorAction SilentlyContinue
}

# Remove caches
if (Test-Path ".expo") {
    Write-Host "Removing .expo cache..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force .expo -ErrorAction SilentlyContinue
}

if (Test-Path "node_modules\.cache") {
    Write-Host "Removing node_modules cache..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "✅ Cleanup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "🏗️  Step 2: Regenerating Android with new permissions..." -ForegroundColor Cyan
Write-Host ""

# Prebuild Android
Write-Host "Running: npx expo prebuild --platform android --clean" -ForegroundColor Yellow
npx expo prebuild --platform android --clean

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Rebuild successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📱 Now run:" -ForegroundColor Cyan
    Write-Host "   npx expo start -c" -ForegroundColor White
    Write-Host ""
    Write-Host "Then scan the QR code or press 'a' to run on Android" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "❌ Prebuild failed. Try running manually:" -ForegroundColor Red
    Write-Host "   npx expo run:android" -ForegroundColor White
}

