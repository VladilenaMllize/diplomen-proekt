# Test script for Backend API (PowerShell)
# Run: cd backend; .\test-api.ps1
# Ensure backend is running: npm run backend

$base = "http://localhost:3000"

Write-Host "`n=== GET /sensors ===" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$base/sensors" -Method Get | ConvertTo-Json

Write-Host "`n=== GET /config ===" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$base/config" -Method Get | ConvertTo-Json

Write-Host "`n=== POST /sensors (new sensor) ===" -ForegroundColor Cyan
$body = '{"id":"light1","value":450,"unit":"lux"}'
Invoke-RestMethod -Uri "$base/sensors" -Method Post -Body $body -ContentType "application/json" | ConvertTo-Json

Write-Host "`n=== PUT /config (update) ===" -ForegroundColor Cyan
$config = '{"name":"My Hub","version":"2.0"}'
Invoke-RestMethod -Uri "$base/config" -Method Put -Body $config -ContentType "application/json" | ConvertTo-Json

Write-Host "`n=== GET /sensors (verify light1) ===" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$base/sensors" -Method Get | ConvertTo-Json

Write-Host "`n=== GET /config (verify update) ===" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$base/config" -Method Get | ConvertTo-Json

Write-Host "`nDone." -ForegroundColor Green
