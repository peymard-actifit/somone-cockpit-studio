# Script pour pousser commits et tags vers GitHub
# Usage: .\scripts\push-all.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== Push vers GitHub ===" -ForegroundColor Cyan
Write-Host ""

# Désactiver le pager Git pour éviter les blocages
$env:GIT_PAGER = "cat"
git config --global core.pager cat 2>$null

# Vérifier qu'on est sur main
$currentBranch = git branch --show-current 2>&1
if ($currentBranch -ne "main") {
    Write-Host "Avertissement : Vous n'êtes pas sur la branche main (actuellement sur $currentBranch)" -ForegroundColor Yellow
    Write-Host "Continuation automatique..." -ForegroundColor Gray
    # Plus de Read-Host qui bloque
}

# Push des commits
Write-Host "Push des commits..." -ForegroundColor Yellow
$ErrorActionPreference = "Continue"
$pushOutput = git push origin main 2>&1 | Out-String
if ($pushOutput) {
    Write-Host $pushOutput
}
$pushExitCode = $LASTEXITCODE
$ErrorActionPreference = "Stop"

if ($pushExitCode -ne 0) {
    Write-Host "Erreur lors du push des commits" -ForegroundColor Red
    exit 1
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "Erreur lors du push des commits" -ForegroundColor Red
    exit 1
}

Write-Host "Commits pushes avec succes" -ForegroundColor Green
Write-Host ""

# Récupérer les nouveaux tags locaux
$localTags = git tag -l
$remoteTags = git ls-remote --tags origin 2>&1 | ForEach-Object { if ($_ -match "refs/tags/(.+)$") { $matches[1] } }

$newTags = @()
foreach ($tag in $localTags) {
    if ($remoteTags -notcontains $tag) {
        $newTags += $tag
    }
}

# Push des tags si nécessaire
if ($newTags.Count -gt 0) {
    Write-Host "Push des tags..." -ForegroundColor Yellow
    foreach ($tag in $newTags) {
        Write-Host "  - $tag" -ForegroundColor Gray
        git push origin $tag
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Erreur lors du push du tag $tag" -ForegroundColor Red
        }
    }
    Write-Host "Tags pushes avec succes" -ForegroundColor Green
} else {
    Write-Host "Aucun nouveau tag a pousser" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Push termine avec succes ! ===" -ForegroundColor Green
Write-Host ""

