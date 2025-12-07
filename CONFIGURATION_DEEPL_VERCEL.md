# Configuration de la clé API DeepL dans Vercel

## Clé API DeepL à configurer

```
e9da4de5-6d8b-47bc-92bc-b20bac5c7119
```

## Instructions étape par étape

### 1. Aller dans Vercel

1. Ouvrez votre navigateur
2. Allez sur https://vercel.com
3. Connectez-vous à votre compte
4. Sélectionnez le projet **`somone-cockpit-studio`**

### 2. Ajouter la variable d'environnement

1. Cliquez sur **Settings** (Paramètres) dans le menu de navigation
2. Cliquez sur **Environment Variables** (Variables d'environnement) dans le menu latéral
3. Cliquez sur **Add New** (Ajouter nouveau)

### 3. Remplir les informations

Dans le formulaire qui s'ouvre :

- **Key** (Nom) : `DEEPL_API_KEY`
- **Value** (Valeur) : `e9da4de5-6d8b-47bc-92bc-b20bac5c7119`
- **Environments** : Cochez TOUTES les cases :
  - ✅ Production
  - ✅ Preview
  - ✅ Development

### 4. Sauvegarder

1. Cliquez sur **Save**
2. La variable apparaîtra dans la liste

### 5. Redéployer (TRÈS IMPORTANT !)

⚠️ **Important** : Après avoir ajouté une variable d'environnement, vous DEVEZ redéployer le projet pour qu'elle soit disponible.

1. Allez dans l'onglet **Deployments**
2. Trouvez le dernier déploiement
3. Cliquez sur les **3 points** (⋯) à droite
4. Cliquez sur **Redeploy**
5. Confirmez le redéploiement

**OU** faites un nouveau commit et push pour déclencher un nouveau déploiement automatique.

## Vérification

Une fois configuré et redéployé, la traduction DeepL devrait fonctionner dans votre application.

## Note sur le format de la clé

Cette clé a le format d'un UUID. Le code détectera automatiquement s'il s'agit de l'API gratuite ou payante et utilisera l'URL appropriée.

## Problèmes ?

Si la traduction ne fonctionne toujours pas après configuration :

1. Vérifiez que la variable est bien dans Vercel
2. Vérifiez que vous avez bien redéployé
3. Consultez les logs Vercel pour voir les erreurs
4. Vérifiez que la clé API est valide sur le site DeepL

