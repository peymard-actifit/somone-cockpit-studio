#!/bin/bash
# Script automatique : incrément version, commit, push et déploiement
# Usage: ./scripts/commit-and-deploy.sh "Message de commit"

COMMIT_MESSAGE="${1:-Mise à jour automatique}"

echo "=== Commit et Déploiement Automatique ==="
echo ""

# Token Vercel
VERCEL_TOKEN="${VERCEL_TOKEN:-YiP93dsRt11543wEH5zb2r9K}"

# 1. Vérifier s'il y a des changements
echo "Étape 1/5 : Vérification des changements..."
if [ -z "$(git status --porcelain)" ]; then
    echo "Aucun changement à committer."
    exit 0
fi

# 2. Incrémenter la version dans package.json
echo "Étape 2/5 : Incrément de la version..."
CURRENT_VERSION=$(node -p "require('./package.json').version")
VERSION_PARTS=($(echo $CURRENT_VERSION | tr '.' ' '))
MAJOR=${VERSION_PARTS[0]}
MINOR=${VERSION_PARTS[1]}
PATCH=$((${VERSION_PARTS[2]} + 1))
NEW_VERSION="$MAJOR.$MINOR.$PATCH"
node -e "const pkg = require('./package.json'); pkg.version = '$NEW_VERSION'; require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');"
echo "Version incrémentée : $CURRENT_VERSION -> $NEW_VERSION"

# 3. Build
echo "Étape 3/5 : Compilation du projet..."
npm run build
if [ $? -ne 0 ]; then
    echo "Erreur lors de la compilation"
    exit 1
fi
echo "Compilation réussie"

# 4. Commit et Push
echo "Étape 4/5 : Commit et Push..."
git add .
FULL_COMMIT_MESSAGE="$COMMIT_MESSAGE (v$NEW_VERSION)"
git commit -m "$FULL_COMMIT_MESSAGE"
git pull origin main --rebase
git push origin main
echo "Commit et push réussis"

# 5. Déploiement Vercel
echo "Étape 5/5 : Déploiement sur Vercel..."
npx vercel --prod --yes --token=$VERCEL_TOKEN 2>&1 | tail -10
if [ $? -ne 0 ]; then
    echo "Erreur lors du déploiement Vercel"
    exit 1
fi
echo "Déploiement Vercel réussi"

echo ""
echo "=== Terminé avec succès ! Version $NEW_VERSION ==="
echo ""








