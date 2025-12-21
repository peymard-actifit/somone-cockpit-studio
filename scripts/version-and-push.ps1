# Script PowerShell pour gérer le versioning et le push automatique
# Usage: .\scripts\version-and-push.ps1 "Message de commit"

param(
    [Parameter(Mandatory=$true)]
    [string]$CommitMessage
)

$trackerFile = ".git-version-tracker.json"
$changeThreshold = 10

# Charger le fichier de suivi
if (Test-Path $trackerFile) {
    $tracker = Get-Content $trackerFile | ConvertFrom-Json
} else {
    # Initialiser si le fichier n'existe pas
    $tracker = @{
        changeCount = 0
        lastVersion = "v1.0.0"
        nextVersion = "v1.0.1"
    } | ConvertTo-Json -Depth 10 | ConvertFrom-Json
}

# Vérifier s'il y a des changements à committer
$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "Aucun changement à committer." -ForegroundColor Yellow
    exit 0
}

# Ajouter tous les fichiers
Write-Host "Ajout des fichiers..." -ForegroundColor Cyan
git add .

# Committer les changements
Write-Host "Création du commit..." -ForegroundColor Cyan
git commit -m $CommitMessage

# Incrémenter le compteur
$tracker.changeCount = [int]$tracker.changeCount + 1

# Vérifier si on doit créer une version
if ([int]$tracker.changeCount -ge $changeThreshold) {
    Write-Host "`n=== Création d'une nouvelle version ===" -ForegroundColor Green
    
    # Créer le tag Git
    $version = $tracker.nextVersion
    Write-Host "Création du tag: $version" -ForegroundColor Green
    git tag -a $version -m "Version $version - $CommitMessage"
    
    # Mettre à jour package.json avec la nouvelle version
    $versionNumber = $version.TrimStart('v')
    $packageJson = Get-Content "package.json" | ConvertFrom-Json
    $packageJson.version = $versionNumber
    $packageJson | ConvertTo-Json -Depth 10 | Set-Content "package.json" -Encoding UTF8
    
    # Committer la mise à jour de package.json
    git add package.json
    git commit -m "Bump version to $version"
    
    # Mettre à jour le tracker
    $tracker.lastVersion = $version
    
    # Calculer la prochaine version (incrémenter le patch)
    $versionParts = $versionNumber.Split('.')
    $major = [int]$versionParts[0]
    $minor = [int]$versionParts[1]
    $patch = [int]$versionParts[2] + 1
    $tracker.nextVersion = "v$major.$minor.$patch"
    
    # Réinitialiser le compteur
    $tracker.changeCount = 0
    
    Write-Host "Version $version créée avec succès!" -ForegroundColor Green
}

# Sauvegarder le tracker
$tracker | ConvertTo-Json -Depth 10 | Set-Content $trackerFile -Encoding UTF8

# Pousser vers GitHub
Write-Host "`nPoussage vers GitHub..." -ForegroundColor Cyan
git push origin main

# Pousser les tags si une version a été créée
if ($tracker.changeCount -eq 0 -and $tracker.lastVersion) {
    Write-Host "Poussage des tags..." -ForegroundColor Cyan
    git push origin $tracker.lastVersion
}

Write-Host "`nTermine! Changements: $($tracker.changeCount)/$changeThreshold" -ForegroundColor Green

