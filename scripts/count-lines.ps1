# Script pour compter les lignes de code
$total = 0
Get-ChildItem -Path src,server,api,scripts -Include *.ts,*.tsx,*.js,*.jsx -Recurse -File | ForEach-Object {
    $lines = (Get-Content $_.FullName -ErrorAction SilentlyContinue | Measure-Object -Line).Lines
    $total += $lines
}
Write-Host $total

