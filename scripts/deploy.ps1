# Script de deploiement automatique en un clic
# Fait : build, commit, push, et deploiement Vercel

$ErrorActionPreference = "Stop"

Write-Host "Deploiement automatique SOMONE Cockpit Studio" -ForegroundColor Cyan
Write-Host ""

# Token Vercel
$VERCEL_TOKEN = $env:VERCEL_TOKEN
if (-not $VERCEL_TOKEN) {
    $VERCEL_TOKEN = "EYbBHJZNW1XsDScWDXuFZzRb"
}

# 1. Build avec retry automatique en cas d'erreurs TypeScript
Write-Host "Etape 1/4 : Compilation du projet..." -ForegroundColor Yellow
$maxAttempts = 10
$attempt = 0
$buildSuccess = $false

while (-not $buildSuccess -and $attempt -lt $maxAttempts) {
    $attempt++
    if ($attempt -gt 1) {
        Write-Host ""
        Write-Host "Tentative $attempt/$maxAttempts : Nouvelle compilation..." -ForegroundColor Yellow
        Write-Host "Attente de 5 secondes pour permettre la correction des erreurs..." -ForegroundColor Cyan
        Start-Sleep -Seconds 5
    }
    
    # Exécuter la compilation avec affichage en temps réel
    $buildOutputAll = ""
    $ErrorActionPreference = "Continue"
    
    try {
        # Exécuter npm et afficher chaque ligne en temps réel tout en capturant
        $buildOutputAll = ""
        $outputLines = @()
        npm run build 2>&1 | ForEach-Object {
            # Afficher immédiatement chaque ligne
            $line = $_.ToString()
            Write-Host $line
            # Capturer pour analyse d'erreurs
            $outputLines += $line
        }
        $buildOutputAll = $outputLines -join "`n"
        $buildExitCode = $LASTEXITCODE
    } catch {
        $errorMsg = $_.Exception.Message
        Write-Host $errorMsg -ForegroundColor Red
        $buildOutputAll = $errorMsg
        $buildExitCode = 1
    }
    
    $ErrorActionPreference = "Stop"
    
    if ($buildExitCode -eq 0) {
        $buildSuccess = $true
        Write-Host "Compilation reussie" -ForegroundColor Green
        Write-Host ""
        break
    }
    
    # Vérifier s'il y a des erreurs TypeScript
    $hasTypeScriptErrors = $false
    if ($buildOutputAll -match "error TS\d{4}" -or $buildOutputAll -match "Found \d+ error") {
        $hasTypeScriptErrors = $true
    }
    
    if ($hasTypeScriptErrors) {
        Write-Host "Erreurs TypeScript detectees lors de la compilation (tentative $attempt/$maxAttempts)" -ForegroundColor Yellow
        Write-Host "Le script va relancer automatiquement la compilation..." -ForegroundColor Cyan
        
        # Afficher un résumé des erreurs
        $outputString = if ($buildOutputAll -is [string]) { $buildOutputAll } else { $buildOutputAll | Out-String }
        $errorLines = ($outputString -split "`n" | Select-String -Pattern "error TS\d{4}") | Select-Object -First 3
        if ($errorLines) {
            Write-Host "Premieres erreurs detectees:" -ForegroundColor Yellow
            $errorLines | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
        }
        
        if ($attempt -ge $maxAttempts) {
            Write-Host ""
            Write-Host "Nombre maximum de tentatives atteint ($maxAttempts)" -ForegroundColor Red
            Write-Host "Veuillez corriger les erreurs TypeScript manuellement" -ForegroundColor Red
            exit 1
        }
    } else {
        # Erreur non-TypeScript, arrêter immédiatement
        Write-Host "Erreur lors de la compilation (non-TypeScript)" -ForegroundColor Red
        exit 1
    }
}

if (-not $buildSuccess) {
    Write-Host "Echec de la compilation apres $maxAttempts tentatives" -ForegroundColor Red
    exit 1
}

# 2. Verifier s'il y a des changements
Write-Host "Etape 2/4 : Verification des changements..." -ForegroundColor Yellow
$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "Aucun changement a committer" -ForegroundColor Yellow
    Write-Host ""
} else {
    # Ajouter tous les fichiers modifies
    Write-Host "Ajout des fichiers modifies..." -ForegroundColor Yellow
    $ErrorActionPreference = "Continue"
    git add -A 2>&1 | ForEach-Object { 
        $line = $_.ToString()
        if ($line -match "warning:") {
            Write-Host $line -ForegroundColor Yellow
        } else {
            Write-Host $line
        }
    }
    $addExitCode = $LASTEXITCODE
    $ErrorActionPreference = "Stop"
    
    # Creer un message de commit avec timestamp
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $commitMessage = "Deploiement automatique - $timestamp"
    
    # Commit
    Write-Host "Creation du commit..." -ForegroundColor Yellow
    $ErrorActionPreference = "Continue"
    git commit -m $commitMessage 2>&1 | ForEach-Object { 
        $line = $_.ToString()
        Write-Host $line
    }
    $commitExitCode = $LASTEXITCODE
    $ErrorActionPreference = "Stop"
    
    if ($commitExitCode -ne 0) {
        Write-Host "Erreur lors du commit" -ForegroundColor Red
        exit 1
    }
    Write-Host "Commit cree" -ForegroundColor Green
    Write-Host ""
}

# 3. Push vers GitHub
Write-Host "Etape 3/4 : Push vers GitHub..." -ForegroundColor Yellow
$ErrorActionPreference = "Continue"
git push origin main 2>&1 | ForEach-Object { 
    $line = $_.ToString()
    Write-Host $line
}
$pushExitCode = $LASTEXITCODE
$ErrorActionPreference = "Stop"

if ($pushExitCode -ne 0) {
    Write-Host "Erreur lors du push" -ForegroundColor Red
    exit 1
}
Write-Host "Push reussi" -ForegroundColor Green
Write-Host ""

# 4. Deploiement Vercel
Write-Host "Etape 4/4 : Deploiement sur Vercel..." -ForegroundColor Yellow
$ErrorActionPreference = "Continue"
npx vercel --prod --yes --token=$VERCEL_TOKEN 2>&1 | ForEach-Object { 
    $line = $_.ToString()
    Write-Host $line
}
$vercelExitCode = $LASTEXITCODE
$ErrorActionPreference = "Stop"

if ($vercelExitCode -ne 0) {
    Write-Host "Erreur lors du deploiement Vercel" -ForegroundColor Red
    exit 1
}
Write-Host "Deploiement Vercel reussi" -ForegroundColor Green
Write-Host ""

Write-Host "Deploiement termine avec succes !" -ForegroundColor Green
Write-Host ""
