# Déploiement sur Vercel

Ce guide vous explique comment déployer SOMONE Cockpit Studio sur Vercel pour avoir des URLs publiques accessibles de partout.

## Prérequis

1. Un compte GitHub (pour héberger le code)
2. Un compte Vercel gratuit (https://vercel.com)

## Étapes de déploiement

### 1. Pousser le code sur GitHub

```bash
# Initialisez Git si ce n'est pas déjà fait
git init
git add .
git commit -m "Initial commit"

# Créez un nouveau repo sur GitHub puis :
git remote add origin https://github.com/votre-username/somone-cockpit.git
git push -u origin main
```

### 2. Importer dans Vercel

1. Allez sur https://vercel.com et connectez-vous avec GitHub
2. Cliquez sur "Add New Project"
3. Importez votre repo GitHub
4. Vercel détectera automatiquement la configuration

### 3. Configurer Vercel KV (Base de données)

⚠️ **Important** : Vercel KV est nécessaire pour stocker les données.

1. Dans votre projet Vercel, allez dans "Storage"
2. Cliquez sur "Create Database" → "KV"
3. Nommez-la "somone-db" et créez-la
4. Les variables d'environnement seront automatiquement ajoutées

### 4. Configurer les variables d'environnement

Dans Vercel, allez dans Settings → Environment Variables et ajoutez :

| Variable | Valeur |
|----------|--------|
| `JWT_SECRET` | Une clé secrète longue et aléatoire |
| `ADMIN_CODE` | Le code pour activer le mode admin (ex: SOMONE2024) |

### 5. Déployer

Cliquez sur "Deploy" ou poussez un nouveau commit sur GitHub.

## URLs

Une fois déployé, vos URLs seront :

- **Application principale** : `https://votre-projet.vercel.app`
- **URLs publiques des cockpits** : `https://votre-projet.vercel.app/public/{publicId}`

## Déploiement en ligne de commande (Alternative)

```bash
# Installer Vercel CLI
npm i -g vercel

# Se connecter
vercel login

# Déployer
vercel

# Pour la production
vercel --prod
```

## Notes importantes

- Le plan gratuit Vercel inclut :
  - 100 GB de bande passante/mois
  - Vercel KV : 30 000 requêtes/jour, 256 MB de stockage
  - Fonctions serverless illimitées

- Les données sont persistées dans Vercel KV (Redis)
- Les images uploadées sont encodées en base64 et stockées dans la DB

## Dépannage

### "KV not configured"
Assurez-vous d'avoir créé une base Vercel KV et qu'elle est liée au projet.

### "Token invalid"
Vérifiez que JWT_SECRET est bien configuré dans les variables d'environnement.

### Les données disparaissent
Vérifiez que Vercel KV est bien connecté. Les données en développement local ne sont pas synchronisées avec Vercel.

