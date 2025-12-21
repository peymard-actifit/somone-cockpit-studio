# Script de restauration des cockpits depuis la base locale
# Usage: .\scripts\restore-cockpits.ps1

Write-Host "=== Restauration des Cockpits ===" -ForegroundColor Cyan
Write-Host ""

$dbPath = "data/db.json"
if (-not (Test-Path $dbPath)) {
    Write-Host "❌ Le fichier $dbPath n'existe pas !" -ForegroundColor Red
    exit 1
}

$db = Get-Content $dbPath | ConvertFrom-Json

Write-Host "📊 Base de données locale:" -ForegroundColor Yellow
Write-Host "   - Utilisateurs: $($db.users.Count)"
Write-Host "   - Cockpits: $($db.cockpits.Count)"
Write-Host ""

if ($db.cockpits.Count -eq 0) {
    Write-Host "⚠️  Aucun cockpit trouvé dans la base locale !" -ForegroundColor Yellow
    exit 0
}

Write-Host "📋 Cockpits trouvés:" -ForegroundColor Yellow
foreach ($cockpit in $db.cockpits) {
    Write-Host "   - $($cockpit.name) (ID: $($cockpit.id))" -ForegroundColor Green
    Write-Host "     UserID: $($cockpit.userId)" -ForegroundColor Gray
    Write-Host "     Domaines: $($cockpit.data.domains.Count)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "✅ Les cockpits sont présents dans la base locale." -ForegroundColor Green
Write-Host ""
Write-Host "💡 Si vous ne voyez pas vos maquettes:" -ForegroundColor Yellow
Write-Host "   1. Vérifiez que vous êtes connecté avec le bon utilisateur"
Write-Host "   2. Vérifiez que l'ID utilisateur correspond (User ID: $($db.users[0].id))"
Write-Host "   3. Si vous utilisez la version déployée, migrez les données vers Redis"
Write-Host "   4. Redémarrez le serveur de développement si vous êtes en local"
Write-Host ""







