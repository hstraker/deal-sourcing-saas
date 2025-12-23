# PowerShell script to test creating a vendor lead via API
# Usage: pwsh scripts/test-create-lead-api.ps1

Write-Host "🧪 Testing Vendor Lead Creation API..." -ForegroundColor Cyan
Write-Host ""

$body = @{
    vendorName = "John Doe"
    vendorPhone = "+447700900789"
    vendorEmail = "john.doe@example.com"
    propertyAddress = "123 Main Street, London"
    propertyPostcode = "SW1A 1AA"
    askingPrice = 350000
    propertyType = "terraced"
    bedrooms = 3
    bathrooms = 1
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/vendor-pipeline/leads" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body

    Write-Host "✅ Lead created successfully!" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 10
    Write-Host ""
    Write-Host "🔗 View in dashboard:" -ForegroundColor Cyan
    Write-Host "   http://localhost:3000/dashboard/vendors/pipeline"
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Yellow
    }
}

