# Wrapper pour forcer l'encodage UTF-8 avant d'exécuter le script principal
# Ce wrapper configure l'encodage au niveau du terminal avant d'exécuter commit-and-deploy.ps1

# Forcer l'encodage UTF-8 à tous les niveaux
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Changer la page de code du terminal Windows (65001 = UTF-8)
chcp 65001 | Out-Null

# Paramètres par défaut pour les cmdlets
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
if ($PSVersionTable.PSVersion.Major -ge 6) {
    $PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
    $PSDefaultParameterValues['Set-Content:Encoding'] = 'utf8'
}

# Exécuter le script principal avec tous les paramètres passés
$scriptPath = Join-Path $PSScriptRoot "commit-and-deploy.ps1"
& $scriptPath @args






