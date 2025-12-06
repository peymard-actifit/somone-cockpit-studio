# Script de réinitialisation du mot de passe
$username = "peymard"
$newPassword = "Pat26rick_0637549759"
$apiUrl = "https://somone-cockpit-studio.vercel.app/api/debug/fix-user"

Write-Host "Réinitialisation du mot de passe pour: $username" -ForegroundColor Yellow

$body = @{
    username = $username
    newPassword = $newPassword
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Method POST -Uri $apiUrl -ContentType "application/json" -Body $body
    
    Write-Host "✅ SUCCÈS!" -ForegroundColor Green
    Write-Host "Message: $($response.message)" -ForegroundColor Green
    Write-Host ""
    Write-Host "Vous pouvez maintenant vous connecter avec:" -ForegroundColor Cyan
    Write-Host "  Username: $username" -ForegroundColor White
    Write-Host "  Password: $newPassword" -ForegroundColor White
} catch {
    Write-Host "❌ ERREUR:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Détails: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

