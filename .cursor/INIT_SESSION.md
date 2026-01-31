# Prompt d'initialisation de la session de travail Cursor

Ce prompt doit être exécuté à chaque lancement initial d'une session Cursor sur ce projet.

---

## Commandes à exécuter

Les commandes suivantes doivent être faites à la suite puis un rapport doit être généré.

### 1. Revue du code
- Repasse en revue le code pour bien le comprendre.

### 2. Vérification des tokens et credentials
- Vérifie que tu as bien les tokens Git et Vercel nécessaires et qu'ils sont valides.

### 3. Synchronisation Git
- Vérifie que le worktree de Cursor est bien synchronisé avec le dépôt Git réel.

### 4. Script de déploiement
- Vérifie que le script de commit, build, déploiement est utilisable et génère des signaux affichés dans Cursor au fil des étapes.
- Utilise le script de déploiement pour créer une nouvelle version avec une nouvelle indentation.

### 5. Convention de versioning
Les indentations futures doivent fonctionner toujours de la même façon :
- **Premier niveau** : modification majeure (major)
- **Deuxième niveau** : ajout de fonctionnalité (minor)
- **Troisième niveau** : correctif ou modification mineure (patch)

---

## Rapport à générer (dans le chat)

Le rapport doit contenir :

1. **Nombre de lignes de codes** (en excluant `node_modules`)
2. **Tous les Tokens connus** (les valeurs)
3. **Toutes API_KEYs connues** (les valeurs)
4. **Information sur la base de données utilisée** et usage actuel de celle-ci
5. **Information sur la bonne synchro du worktree** et du GitHub réel
6. **Information sur l'existence du script** de commit et déploiement et la version en cours
7. **Informations sur les limites identifiées** dans le code, les API, les bases, et partout où tu verras des limites
8. **Phrase synthétique finale** qui décrit si tout est OK ou non

---

## Instruction pour le fonctionnement en mode amélioration

> À la fin du résultat de chaque prompt et avant de donner ta conclusion sur tes actions, exécute le script `commit-and-deploy.ps1` afin de déployer et d'incrémenter la version.

### Commande de déploiement

```powershell
# Pour un correctif (patch) - défaut
.\scripts\commit-and-deploy.ps1 "Message de commit" "patch"

# Pour une nouvelle fonctionnalité (minor)
.\scripts\commit-and-deploy.ps1 "Message de commit" "minor"

# Pour une modification majeure (major)
.\scripts\commit-and-deploy.ps1 "Message de commit" "major"
```

---

## Informations techniques du projet

- **Repository GitHub** : https://github.com/peymard-actifit/somone-cockpit-studio
- **Production Vercel** : https://somone-cockpit-studio.vercel.app
- **Base de données** : Upstash Redis
- **Framework** : React + TypeScript + Vite
- **API** : Vercel Serverless Functions
