# Workflow de versioning et push automatique

## 📋 Principe

Ce projet utilise un système automatisé de versioning :
- **Push à chaque changement** : Tous les commits sont automatiquement poussés vers GitHub
- **Version tous les 10 changements** : Tous les 10 commits, une nouvelle version est créée avec un numéro incrémental

## 🚀 Utilisation

### Sur Windows (PowerShell)

```powershell
npm run push "Votre message de commit"
```

Ou directement :
```powershell
.\scripts\version-and-push.ps1 "Votre message de commit"
```

### Sur Linux/Mac (Bash)

```bash
npm run push:unix "Votre message de commit"
```

Ou directement :
```bash
chmod +x scripts/version-and-push.sh
./scripts/version-and-push.sh "Votre message de commit"
```

## 📊 Fonctionnement

1. **Ajout automatique** : Tous les fichiers modifiés sont ajoutés
2. **Commit** : Les changements sont commités avec votre message
3. **Comptage** : Le compteur de changements est incrémenté
4. **Création de version** (tous les 10 changements) :
   - Création d'un tag Git (ex: `v1.0.1`, `v1.0.2`, etc.)
   - Mise à jour de `package.json` avec la nouvelle version
   - Push du tag vers GitHub
5. **Push automatique** : Les commits sont poussés vers GitHub

## 📁 Fichiers de suivi

- `.git-version-tracker.json` : Suivi du nombre de changements et des versions
  - `changeCount` : Nombre de changements depuis la dernière version
  - `lastVersion` : Dernière version créée
  - `nextVersion` : Prochaine version à créer

## 🏷️ Format des versions

Les versions suivent le format **Semantic Versioning** (SemVer) :
- Format : `vMAJOR.MINOR.PATCH` (ex: `v1.0.1`, `v1.0.2`, `v1.1.0`)
- Le numéro de **patch** est incrémenté automatiquement
- La version de départ est : **v1.0.0**

## 📝 Exemple d'utilisation

```powershell
# Premier changement
npm run push "Correction bug affichage images"

# ... 9 autres changements ...

# 10ème changement - Création automatique de la version v1.0.1
npm run push "Ajout fonctionnalité clustering"
```

## 🔍 Vérifier le statut

Pour voir combien de changements avant la prochaine version :

```powershell
Get-Content .git-version-tracker.json | ConvertFrom-Json
```

## ⚙️ Configuration

Pour modifier le seuil de 10 changements, éditez :
- `scripts/version-and-push.ps1` : Ligne `$changeThreshold = 10`
- `scripts/version-and-push.sh` : Ligne `CHANGE_THRESHOLD=10`

## 📌 Notes importantes

- Le fichier `.git-version-tracker.json` doit être commité dans le dépôt
- Les tags Git sont créés automatiquement et poussés vers GitHub
- La version dans `package.json` est automatiquement mise à jour








