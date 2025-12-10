#!/bin/bash
# Script de déploiement automatique en un clic
# Fait : build, commit, push, et déploiement Vercel

set -e

echo "🚀 Déploiement automatique SOMONE Cockpit Studio"
echo ""

# Token Vercel
VERCEL_TOKEN="${VERCEL_TOKEN:-GLe0CsmnKQKOs1PV7o2eHsH7}"

# 1. Build avec retry automatique en cas d'erreurs TypeScript
echo "📦 Étape 1/4 : Compilation du projet..."
MAX_ATTEMPTS=10
ATTEMPT=0
BUILD_SUCCESS=0

while [ $BUILD_SUCCESS -eq 0 ] && [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    ATTEMPT=$((ATTEMPT + 1))
    if [ $ATTEMPT -gt 1 ]; then
        echo ""
        echo "🔄 Tentative $ATTEMPT/$MAX_ATTEMPTS : Nouvelle compilation..."
        echo "⏳ Attente de 5 secondes pour permettre la correction des erreurs..."
        sleep 5
    fi
    
    # Capturer la sortie pour analyser les erreurs
    BUILD_OUTPUT=$(npm run build 2>&1)
    BUILD_EXIT_CODE=$?
    
    if [ $BUILD_EXIT_CODE -eq 0 ]; then
        BUILD_SUCCESS=1
        echo "$BUILD_OUTPUT"
        echo "✅ Compilation réussie"
        echo ""
        break
    fi
    
    # Vérifier s'il y a des erreurs TypeScript
    HAS_TS_ERRORS=0
    if echo "$BUILD_OUTPUT" | grep -qE "error TS[0-9]{4}" || echo "$BUILD_OUTPUT" | grep -qE "Found [0-9]+ error"; then
        HAS_TS_ERRORS=1
    fi
    
    if [ $HAS_TS_ERRORS -eq 1 ]; then
        echo "⚠️  Erreurs TypeScript détectées lors de la compilation (tentative $ATTEMPT/$MAX_ATTEMPTS)"
        echo "🔄 Le script va relancer automatiquement la compilation..."
        
        # Afficher un résumé des erreurs
        ERRORS=$(echo "$BUILD_OUTPUT" | grep -E "error TS[0-9]{4}" | head -3)
        if [ -n "$ERRORS" ]; then
            echo "📋 Premières erreurs détectées:"
            echo "$ERRORS" | while IFS= read -r line; do
                echo "  ❌ $line"
            done
        fi
        
        if [ $ATTEMPT -ge $MAX_ATTEMPTS ]; then
            echo ""
            echo "❌ Nombre maximum de tentatives atteint ($MAX_ATTEMPTS)"
            echo "🔧 Veuillez corriger les erreurs TypeScript manuellement"
            exit 1
        fi
    else
        # Erreur non-TypeScript, arrêter immédiatement
        echo "$BUILD_OUTPUT"
        echo "❌ Erreur lors de la compilation (non-TypeScript)"
        exit 1
    fi
done

if [ $BUILD_SUCCESS -eq 0 ]; then
    echo "❌ Échec de la compilation après $MAX_ATTEMPTS tentatives"
    exit 1
fi

# 2. Vérifier s'il y a des changements
echo "📝 Étape 2/4 : Vérification des changements..."
if [ -z "$(git status --porcelain)" ]; then
    echo "⚠️  Aucun changement à committer"
    echo ""
else
    # Ajouter tous les fichiers modifiés
    echo "📋 Ajout des fichiers modifiés..."
    git add -A
    
    # Créer un message de commit avec timestamp
    TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
    COMMIT_MESSAGE="Déploiement automatique - $TIMESTAMP"
    
    # Commit
    echo "💾 Création du commit..."
    git commit -m "$COMMIT_MESSAGE"
    if [ $? -ne 0 ]; then
        echo "❌ Erreur lors du commit"
        exit 1
    fi
    echo "✅ Commit créé"
    echo ""
fi

# 3. Push vers GitHub
echo "📤 Étape 3/4 : Push vers GitHub..."
git push origin main
if [ $? -ne 0 ]; then
    echo "❌ Erreur lors du push"
    exit 1
fi
echo "✅ Push réussi"
echo ""

# 4. Déploiement Vercel
echo "🌐 Étape 4/4 : Déploiement sur Vercel..."
npx vercel --prod --yes --token=$VERCEL_TOKEN
if [ $? -ne 0 ]; then
    echo "❌ Erreur lors du déploiement Vercel"
    exit 1
fi
echo "✅ Déploiement Vercel réussi"
echo ""

echo "🎉 Déploiement terminé avec succès !"
echo ""


