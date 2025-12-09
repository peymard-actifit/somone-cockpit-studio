# Script automatique : incrément version, commit, push et déploiement
# Usage: .\scripts\commit-and-deploy.ps1 "Message de commit"

param(
    [Parameter(Mandatory=$false)]
    [string]$CommitMessage = "Mise à jour automatique"
)

$ErrorActionPreference = "Stop"

Write-Host "=== Commit et Déploiement Automatique ===" -ForegroundColor Cyan
Write-Host ""

# Token Vercel
$VERCEL_TOKEN = $env:VERCEL_TOKEN
if (-not $VERCEL_TOKEN) {
    $VERCEL_TOKEN = "GLe0CsmnKQKOs1PV7o2eHsH7"
}

# 1. Vérifier s'il y a des changements
Write-Host "Étape 1/5 : Vérification des changements..." -ForegroundColor Yellow
$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "Aucun changement à committer." -ForegroundColor Yellow
    exit 0
}

# 2. Incrémenter la version dans package.json
Write-Host "Étape 2/5 : Incrément de la version..." -ForegroundColor Yellow
$packageJsonPath = "package.json"
$packageJsonContent = Get-Content $packageJsonPath -Raw -Encoding UTF8
$packageJson = $packageJsonContent | ConvertFrom-Json
if (-not $packageJson -or -not $packageJson.version) {
    Write-Host "Erreur : Impossible de lire la version depuis package.json" -ForegroundColor Red
    exit 1
}
$currentVersion = $packageJson.version
$versionParts = $currentVersion.Split('.')
$major = [int]$versionParts[0]
$minor = [int]$versionParts[1]
$patch = [int]$versionParts[2] + 1
$newVersion = "$major.$minor.$patch"
$packageJson.version = $newVersion
$jsonContent = $packageJson | ConvertTo-Json -Depth 10
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText((Resolve-Path $packageJsonPath), $jsonContent, $utf8NoBom)
Write-Host "Version incrémentée : $currentVersion -> $newVersion" -ForegroundColor Green

# 3. Build
Write-Host "Étape 3/5 : Compilation du projet..." -ForegroundColor Yellow
$ErrorActionPreference = "Continue"
npm run build 2>&1 | ForEach-Object { Write-Host $_ }
$buildExitCode = $LASTEXITCODE
$ErrorActionPreference = "Stop"

if ($buildExitCode -ne 0) {
    Write-Host "Erreur lors de la compilation" -ForegroundColor Red
    exit 1
}
Write-Host "Compilation réussie" -ForegroundColor Green

# 4. Commit et Push
Write-Host "Étape 4/5 : Commit et Push..." -ForegroundColor Yellow
git add .
$fullCommitMessage = "$CommitMessage (v$newVersion)"
git commit -m $fullCommitMessage
# Pull avant push pour éviter les conflits
git pull origin main --rebase
git push origin main
Write-Host "Commit et push réussis" -ForegroundColor Green

# 5. Déploiement Vercel
Write-Host "Étape 5/5 : Déploiement sur Vercel..." -ForegroundColor Yellow
$ErrorActionPreference = "Continue"
npx vercel --prod --yes --token=$VERCEL_TOKEN 2>&1 | Select-Object -Last 10
$vercelExitCode = $LASTEXITCODE
$ErrorActionPreference = "Stop"

if ($vercelExitCode -ne 0) {
    Write-Host "Erreur lors du déploiement Vercel" -ForegroundColor Red
    exit 1
}
Write-Host "Déploiement Vercel réussi" -ForegroundColor Green

Write-Host ""
Write-Host "=== Terminé avec succès ! Version $newVersion ===" -ForegroundColor Green
Write-Host ""

