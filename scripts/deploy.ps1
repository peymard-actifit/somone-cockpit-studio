# Script de déploiement automatique en un clic
# Fait : build, commit, push, et déploiement Vercel

$ErrorActionPreference = "Stop"

Write-Host "🚀 Déploiement automatique SOMONE Cockpit Studio" -ForegroundColor Cyan
Write-Host ""

# Token Vercel
$VERCEL_TOKEN = "wkGtxH23SiUdqfIVIRMT7fSI"

# 1. Build
Write-Host "📦 Étape 1/4 : Compilation du projet..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors de la compilation" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Compilation réussie" -ForegroundColor Green
Write-Host ""

# 2. Vérifier s'il y a des changements
Write-Host "📝 Étape 2/4 : Vérification des changements..." -ForegroundColor Yellow
$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "⚠️  Aucun changement à committer" -ForegroundColor Yellow
    Write-Host ""
} else {
    # Ajouter tous les fichiers modifiés
    Write-Host "📋 Ajout des fichiers modifiés..." -ForegroundColor Yellow
    git add -A
    
    # Créer un message de commit avec timestamp
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $commitMessage = "Déploiement automatique - $timestamp"
    
    # Commit
    Write-Host "💾 Création du commit..." -ForegroundColor Yellow
    git commit -m $commitMessage
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erreur lors du commit" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Commit créé" -ForegroundColor Green
    Write-Host ""
}

# 3. Push vers GitHub
Write-Host "📤 Étape 3/4 : Push vers GitHub..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors du push" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Push réussi" -ForegroundColor Green
Write-Host ""

# 4. Déploiement Vercel
Write-Host "🌐 Étape 4/4 : Déploiement sur Vercel..." -ForegroundColor Yellow
npx vercel --prod --yes --token=$VERCEL_TOKEN
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors du déploiement Vercel" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Déploiement Vercel réussi" -ForegroundColor Green
Write-Host ""

Write-Host "🎉 Déploiement terminé avec succès !" -ForegroundColor Green
Write-Host ""

