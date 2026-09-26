# Test the permission system

# Step 1: Login as waiter
Write-Host "=== Step 1: Login as Waiter ===" -ForegroundColor Cyan
$loginBody = @{
    username = "waiter1"
    password = "pass"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-WebRequest -Uri 'http://localhost:3001/login' `
        -Method POST `
        -ContentType 'application/json' `
        -Body $loginBody `
        -UseBasicParsing

    $loginData = $loginResponse.Content | ConvertFrom-Json
    $token = $loginData.token
    
    Write-Host "✅ Login successful!" -ForegroundColor Green
    Write-Host "Token received: $($token.Substring(0, 50))..." -ForegroundColor Yellow
    
    # Step 2: Get permissions
    Write-Host "`n=== Step 2: Get Waiter Permissions ===" -ForegroundColor Cyan
    
    $headers = @{
        'Authorization' = "Bearer $token"
        'Content-Type' = 'application/json'
    }
    
    $permResponse = Invoke-WebRequest -Uri 'http://localhost:3001/api/my-permissions' `
        -Method GET `
        -Headers $headers `
        -UseBasicParsing
    
    $permData = $permResponse.Content | ConvertFrom-Json
    
    Write-Host "✅ Permissions retrieved!" -ForegroundColor Green
    Write-Host "Role: $($permData.role)" -ForegroundColor Yellow
    Write-Host "Permissions:" -ForegroundColor Yellow
    $permData.permissions | ForEach-Object { Write-Host "  - $_" -ForegroundColor Cyan }
    
    # Check for KDS permissions
    Write-Host "`n=== Step 3: Verify KDS Permissions ===" -ForegroundColor Cyan
    $kdsPerms = @('mark_order_preparing', 'mark_order_ready', 'confirm_order_delivery')
    $kdsPerms | ForEach-Object {
        if ($permData.permissions -contains $_) {
            Write-Host "✅ $_" -ForegroundColor Green
        } else {
            Write-Host "❌ $_" -ForegroundColor Red
        }
    }
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Details: $($_.Exception)" -ForegroundColor Yellow
}
