#!/bin/bash
# Script bash pour gérer le versioning et le push automatique
# Usage: ./scripts/version-and-push.sh "Message de commit"

COMMIT_MESSAGE="$1"
TRACKER_FILE=".git-version-tracker.json"
CHANGE_THRESHOLD=10

# Vérifier que le message de commit est fourni
if [ -z "$COMMIT_MESSAGE" ]; then
    echo "❌ Erreur: Message de commit requis"
    echo "Usage: ./scripts/version-and-push.sh 'Message de commit'"
    exit 1
fi

# Charger le fichier de suivi
if [ -f "$TRACKER_FILE" ]; then
    CHANGE_COUNT=$(jq -r '.changeCount' "$TRACKER_FILE")
    LAST_VERSION=$(jq -r '.lastVersion' "$TRACKER_FILE")
    NEXT_VERSION=$(jq -r '.nextVersion' "$TRACKER_FILE")
else
    # Initialiser si le fichier n'existe pas
    CHANGE_COUNT=0
    LAST_VERSION="v1.0.0"
    NEXT_VERSION="v1.0.1"
fi

# Vérifier s'il y a des changements à committer
if [ -z "$(git status --porcelain)" ]; then
    echo "⚠️  Aucun changement à committer."
    exit 0
fi

# Ajouter tous les fichiers
echo "📦 Ajout des fichiers..."
git add .

# Committer les changements
echo "💾 Création du commit..."
git commit -m "$COMMIT_MESSAGE"

# Incrémenter le compteur
CHANGE_COUNT=$((CHANGE_COUNT + 1))

# Vérifier si on doit créer une version
if [ $CHANGE_COUNT -ge $CHANGE_THRESHOLD ]; then
    echo ""
    echo "🎉 === Création d'une nouvelle version ==="
    
    VERSION=$NEXT_VERSION
    echo "🏷️  Création du tag: $VERSION"
    git tag -a "$VERSION" -m "Version $VERSION - $COMMIT_MESSAGE"
    
    # Mettre à jour package.json avec la nouvelle version
    VERSION_NUMBER="${VERSION#v}"
    node -e "
        const fs = require('fs');
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        pkg.version = '$VERSION_NUMBER';
        fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
    "
    
    # Committer la mise à jour de package.json
    git add package.json
    git commit -m "Bump version to $VERSION"
    
    # Mettre à jour le tracker
    LAST_VERSION=$VERSION
    
    # Calculer la prochaine version (incrémenter le patch)
    IFS='.' read -r -a VERSION_PARTS <<< "$VERSION_NUMBER"
    MAJOR=${VERSION_PARTS[0]}
    MINOR=${VERSION_PARTS[1]}
    PATCH=$((${VERSION_PARTS[2]} + 1))
    NEXT_VERSION="v$MAJOR.$MINOR.$PATCH"
    
    # Réinitialiser le compteur
    CHANGE_COUNT=0
    
    echo "✅ Version $VERSION créée avec succès!"
fi

# Sauvegarder le tracker
node -e "
    const fs = require('fs');
    fs.writeFileSync('$TRACKER_FILE', JSON.stringify({
        changeCount: $CHANGE_COUNT,
        lastVersion: '$LAST_VERSION',
        nextVersion: '$NEXT_VERSION'
    }, null, 2) + '\n');
"

# Pousser vers GitHub
echo ""
echo "🚀 Poussage vers GitHub..."
git push origin main

# Pousser les tags si une version a été créée
if [ $CHANGE_COUNT -eq 0 ] && [ -n "$LAST_VERSION" ]; then
    echo "🏷️  Poussage des tags..."
    git push origin "$LAST_VERSION"
fi

echo ""
echo "✅ Terminé! Changements: $CHANGE_COUNT/$CHANGE_THRESHOLD"








