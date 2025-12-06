# Script de deploiement automatique en un clic
# Fait : build, commit, push, et deploiement Vercel

$ErrorActionPreference = "Stop"

Write-Host "Deploiement automatique SOMONE Cockpit Studio" -ForegroundColor Cyan
Write-Host ""

# Token Vercel
$VERCEL_TOKEN = "wkGtxH23SiUdqfIVIRMT7fSI"

# 1. Build
Write-Host "Etape 1/4 : Compilation du projet..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Erreur lors de la compilation" -ForegroundColor Red
    exit 1
}
Write-Host "Compilation reussie" -ForegroundColor Green
Write-Host ""

# 2. Verifier s'il y a des changements
Write-Host "Etape 2/4 : Verification des changements..." -ForegroundColor Yellow
$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "Aucun changement a committer" -ForegroundColor Yellow
    Write-Host ""
} else {
    # Ajouter tous les fichiers modifies
    Write-Host "Ajout des fichiers modifies..." -ForegroundColor Yellow
    git add -A
    
    # Creer un message de commit avec timestamp
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $commitMessage = "Deploiement automatique - $timestamp"
    
    # Commit
    Write-Host "Creation du commit..." -ForegroundColor Yellow
    git commit -m $commitMessage
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Erreur lors du commit" -ForegroundColor Red
        exit 1
    }
    Write-Host "Commit cree" -ForegroundColor Green
    Write-Host ""
}

# 3. Push vers GitHub
Write-Host "Etape 3/4 : Push vers GitHub..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "Erreur lors du push" -ForegroundColor Red
    exit 1
}
Write-Host "Push reussi" -ForegroundColor Green
Write-Host ""

# 4. Deploiement Vercel
Write-Host "Etape 4/4 : Deploiement sur Vercel..." -ForegroundColor Yellow
npx vercel --prod --yes --token=$VERCEL_TOKEN
if ($LASTEXITCODE -ne 0) {
    Write-Host "Erreur lors du deploiement Vercel" -ForegroundColor Red
    exit 1
}
Write-Host "Deploiement Vercel reussi" -ForegroundColor Green
Write-Host ""

Write-Host "Deploiement termine avec succes !" -ForegroundColor Green
Write-Host ""
