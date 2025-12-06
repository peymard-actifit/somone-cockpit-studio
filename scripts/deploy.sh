#!/bin/bash
# Script de déploiement automatique en un clic
# Fait : build, commit, push, et déploiement Vercel

set -e

echo "🚀 Déploiement automatique SOMONE Cockpit Studio"
echo ""

# Token Vercel
VERCEL_TOKEN="wkGtxH23SiUdqfIVIRMT7fSI"

# 1. Build
echo "📦 Étape 1/4 : Compilation du projet..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Erreur lors de la compilation"
    exit 1
fi
echo "✅ Compilation réussie"
echo ""

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

