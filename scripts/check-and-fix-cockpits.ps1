# Script pour vérifier et corriger les maquettes manquantes
# Usage: .\scripts\check-and-fix-cockpits.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== Verification et Correction des Maquettes ===" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier la base de données locale
Write-Host "Etape 1/4 : Verification base de donnees locale..." -ForegroundColor Yellow
$dbPath = "data/db.json"
if (Test-Path $dbPath) {
    $localDb = Get-Content $dbPath -Raw | ConvertFrom-Json
    $localCockpits = $localDb.cockpits
    $localUsers = $localDb.users
    
    Write-Host "Base locale trouvee:" -ForegroundColor Green
    Write-Host "  - Utilisateurs: $($localUsers.Count)"
    Write-Host "  - Cockpits: $($localCockpits.Count)"
    
    if ($localCockpits.Count -gt 0) {
        Write-Host "  Cockpits locaux:" -ForegroundColor Cyan
        $localCockpits | ForEach-Object {
            Write-Host "    - $($_.name) (ID: $($_.id))" -ForegroundColor White
        }
    }
} else {
    Write-Host "Base locale non trouvee: $dbPath" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 2. Vérifier si on est en mode développement ou production
Write-Host "Etape 2/4 : Verification environnement..." -ForegroundColor Yellow
$isProduction = $env:VERCEL_ENV -eq "production" -or $env:NODE_ENV -eq "production"

if ($isProduction) {
    Write-Host "Mode: PRODUCTION (Vercel/Redis)" -ForegroundColor Yellow
    Write-Host "Les donnees doivent etre dans Upstash Redis" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Pour migrer les donnees vers Redis, executez:" -ForegroundColor Cyan
    Write-Host "  node scripts/migrate-to-redis.js" -ForegroundColor White
    Write-Host ""
    Write-Host "Assurez-vous d'avoir configure:" -ForegroundColor Yellow
    Write-Host "  - UPSTASH_REDIS_REST_URL" -ForegroundColor White
    Write-Host "  - UPSTASH_REDIS_REST_TOKEN" -ForegroundColor White
} else {
    Write-Host "Mode: DEVELOPPEMENT (local)" -ForegroundColor Green
    Write-Host "Les donnees sont dans data/db.json" -ForegroundColor Green
    Write-Host ""
    Write-Host "Verification du serveur local..." -ForegroundColor Yellow
    
    # Vérifier si le serveur local tourne
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001/api/cockpits" -Method GET -Headers @{"Authorization" = "Bearer test"} -ErrorAction SilentlyContinue -TimeoutSec 2
    } catch {
        Write-Host "Serveur local non accessible sur http://localhost:3001" -ForegroundColor Yellow
        Write-Host "Lancez le serveur avec: npm run dev:server" -ForegroundColor Cyan
    }
}

Write-Host ""

# 3. Vérifier la version déployée
Write-Host "Etape 3/4 : Verification version..." -ForegroundColor Yellow
$packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
$currentVersion = $packageJson.version
Write-Host "Version locale: $currentVersion" -ForegroundColor Green

# Vérifier la dernière version commitée
$lastCommit = git log --oneline -1
Write-Host "Dernier commit: $lastCommit" -ForegroundColor Cyan

Write-Host ""

# 4. Recommandations
Write-Host "Etape 4/4 : Recommandations..." -ForegroundColor Yellow
Write-Host ""

if ($localCockpits.Count -gt 0) {
    Write-Host "✅ Maquettes trouvees dans la base locale:" -ForegroundColor Green
    $localCockpits | ForEach-Object {
        Write-Host "   - $($_.name)" -ForegroundColor White
    }
    Write-Host ""
    
    if ($isProduction) {
        Write-Host "⚠️  ACTION REQUISE:" -ForegroundColor Yellow
        Write-Host "   Les maquettes sont en local mais pas en production (Redis)" -ForegroundColor Yellow
        Write-Host "   Executez la migration vers Redis:" -ForegroundColor Cyan
        Write-Host "   node scripts/migrate-to-redis.js" -ForegroundColor White
    } else {
        Write-Host "✅ Vous etes en mode developpement" -ForegroundColor Green
        Write-Host "   Les maquettes devraient etre visibles si le serveur tourne" -ForegroundColor Green
        Write-Host "   Verifiez que le serveur est lance: npm run dev" -ForegroundColor Cyan
    }
} else {
    Write-Host "❌ Aucune maquette trouvee dans la base locale" -ForegroundColor Red
    Write-Host "   Verifiez le fichier data/db.json" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Termine ===" -ForegroundColor Cyan








