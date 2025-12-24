# Script automatique : increment version, commit, push et deploiement
# Usage: .\scripts\commit-and-deploy.ps1 "Message de commit" [versionType]
# versionType: "patch" (defaut, correctif), "minor" (fonctionnalite), "major" (modification majeure)

param(
    [Parameter(Mandatory = $false)]
    [string]$CommitMessage = "Mise a jour automatique",
    [Parameter(Mandatory = $false)]
    [ValidateSet("patch", "minor", "major")]
    [string]$VersionType = "patch"
)

$ErrorActionPreference = "Stop"

Write-Host "=== Commit et Deploiement Automatique ===" -ForegroundColor Cyan
Write-Host "Type de version: $VersionType" -ForegroundColor Cyan
Write-Host ""

# Token Vercel
$VERCEL_TOKEN = $env:VERCEL_TOKEN
if (-not $VERCEL_TOKEN) {
    $VERCEL_TOKEN = "mgaJN94rRN8spxv4ATJ2t670"
}

# Token GitHub configure dans le remote Git (mis a jour le 2025-12-21)
# Ne pas stocker le token en clair dans le script

# 1. Verifier s'il y a des changements
Write-Host "Etape 1/5 : Verification des changements..." -ForegroundColor Yellow
$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "Aucun changement a committer." -ForegroundColor Yellow
    exit 0
}

# 2. Incrementer la version dans package.json
Write-Host "Etape 2/5 : Increment de la version ($VersionType)..." -ForegroundColor Yellow
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
$patch = [int]$versionParts[2]

# Systeme de versioning :
# - major : modification majeure
# - minor : ajout de fonctionnalite
# - patch : correctif ou modification mineure (defaut)
switch ($VersionType) {
    "major" {
        $major = $major + 1
        $minor = 0
        $patch = 0
    }
    "minor" {
        $minor = $minor + 1
        $patch = 0
    }
    "patch" {
        $patch = $patch + 1
    }
}

$newVersion = "$major.$minor.$patch"
$packageJson.version = $newVersion
$jsonContent = $packageJson | ConvertTo-Json -Depth 10
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText((Resolve-Path $packageJsonPath), $jsonContent, $utf8NoBom)

# Mettre a jour le fichier VERSION a la racine (visible sur GitHub)
$versionFilePath = "VERSION"
$versionDate = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$versionContent = "v$newVersion`nDeploye le: $versionDate"
[System.IO.File]::WriteAllText($versionFilePath, $versionContent, $utf8NoBom)

# Mettre a jour la constante APP_VERSION dans api/index.ts
$apiIndexPath = "api/index.ts"
if (Test-Path $apiIndexPath) {
    $apiContent = Get-Content $apiIndexPath -Raw -Encoding UTF8
    $apiContent = $apiContent -replace "const APP_VERSION = '[^']*';", "const APP_VERSION = '$newVersion';"
    [System.IO.File]::WriteAllText((Resolve-Path $apiIndexPath), $apiContent, $utf8NoBom)
    Write-Host "APP_VERSION mise a jour dans api/index.ts" -ForegroundColor Green
}

Write-Host "Version incrementee : $currentVersion -> $newVersion" -ForegroundColor Green

# 3. Commit et Push (GitHub = source de verite, AVANT le build)
Write-Host "Etape 3/5 : Commit et Push sur GitHub..." -ForegroundColor Yellow
git add .
$fullCommitMessage = "$CommitMessage (v$newVersion)"
git commit -m $fullCommitMessage
# Pull avant push pour eviter les conflits
git pull origin main --rebase
git push origin main
Write-Host "Commit et push reussis - GitHub est a jour" -ForegroundColor Green

# 4. Build
Write-Host "Etape 4/5 : Compilation du projet..." -ForegroundColor Yellow
$ErrorActionPreference = "Continue"
npm run build 2>&1 | ForEach-Object { Write-Host $_ }
$buildExitCode = $LASTEXITCODE
$ErrorActionPreference = "Stop"

if ($buildExitCode -ne 0) {
    Write-Host "Erreur lors de la compilation (le code est deja sur GitHub)" -ForegroundColor Red
    exit 1
}
Write-Host "Compilation reussie" -ForegroundColor Green

# 5. Deploiement Vercel
Write-Host "Etape 5/5 : Deploiement sur Vercel..." -ForegroundColor Yellow
$ErrorActionPreference = "Continue"
npx vercel --prod --yes --token mgaJN94rRN8spxv4ATJ2t670 2>&1 | Select-Object -Last 10
$vercelExitCode = $LASTEXITCODE
$ErrorActionPreference = "Stop"

if ($vercelExitCode -ne 0) {
    Write-Host "Erreur lors du deploiement Vercel" -ForegroundColor Red
    exit 1
}
Write-Host "Deploiement Vercel reussi" -ForegroundColor Green

Write-Host ""
Write-Host "=== Termine avec succes ! Version $newVersion ===" -ForegroundColor Green
Write-Host ""