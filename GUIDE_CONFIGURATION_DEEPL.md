# Guide : Configuration de la clé API DeepL

## ⚠️ Important : DeepL utilise une clé API, pas un email/mot de passe

L'API DeepL **ne fonctionne pas avec email/mot de passe**. Elle nécessite une **clé API** (token) que vous devez générer depuis votre compte DeepL.

## 🔑 Comment obtenir votre clé API DeepL

### Étape 1 : Se connecter à votre compte DeepL
1. Allez sur https://www.deepl.com/fr/pro-api
2. Connectez-vous avec :
   - **Email** : `patrick.eymard@actifit.pro`
   - **Mot de passe** : `Pat26rick_`

### Étape 2 : Générer une clé API
1. Une fois connecté, allez dans la section **"Account"** ou **"API"**
2. Créez une nouvelle clé API (API Key)
3. Copiez la clé API générée (elle ressemblera à quelque chose comme `fx-xxxxx-xxxxx-xxxxx` ou `xxxxx:fx`)

### Format de la clé API
- **API gratuite** : commence par `fx-` ou `free-` (exemple : `fx-1234-5678-90ab-cdef`)
- **API payante** : format différent, peut contenir `:` (exemple : `12345678-abcdef:fx`)

## 🔧 Configuration dans Vercel

### Option 1 : Via l'interface Vercel (recommandé)

1. Allez sur https://vercel.com
2. Sélectionnez votre projet `somone-cockpit-studio`
3. Allez dans **Settings** → **Environment Variables**
4. Ajoutez une nouvelle variable :
   - **Name** : `DEEPL_API_KEY`
   - **Value** : Votre clé API DeepL (copiée à l'étape 2)
   - **Environments** : Cochez **Production**, **Preview**, et **Development**
5. Cliquez sur **Save**
6. **Important** : Redéployez votre projet pour que la variable soit disponible

### Option 2 : Via la ligne de commande Vercel

```bash
# Installer Vercel CLI si nécessaire
npm i -g vercel

# Ajouter la variable d'environnement
vercel env add DEEPL_API_KEY production
# Puis entrez votre clé API quand demandé
```

## ✅ Vérification

Après configuration, la traduction devrait fonctionner. Si vous voyez encore des erreurs :
1. Vérifiez que la clé API est bien configurée dans Vercel
2. Vérifiez que le projet a été redéployé après l'ajout de la variable
3. Consultez les logs Vercel pour voir les erreurs détaillées

## 🔍 Test de la clé API

Pour tester si votre clé API fonctionne, vous pouvez utiliser cette commande curl :

```bash
curl -X POST "https://api-free.deepl.com/v2/translate" \
  -H "Authorization: DeepL-Auth-Key VOTRE_CLE_API" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "text=Hello" \
  -d "source_lang=EN" \
  -d "target_lang=FR"
```

Remplacez `VOTRE_CLE_API` par votre vraie clé API.

## 📝 Notes importantes

- **Ne partagez jamais votre clé API** publiquement
- La clé API est stockée de manière sécurisée dans Vercel
- Si vous utilisez l'API gratuite, elle a des limites (500 000 caractères/mois)
- L'API payante offre plus de caractères et de fonctionnalités

## ❓ Problèmes courants

### "DeepL API key not configured"
→ La variable d'environnement `DEEPL_API_KEY` n'est pas définie dans Vercel

### "Clé API DeepL invalide ou expirée"
→ La clé API est incorrecte ou a expiré. Générez une nouvelle clé depuis votre compte DeepL

### "Non authentifié"
→ Ce n'est pas un problème avec DeepL, mais avec l'authentification utilisateur JWT. Assurez-vous d'être connecté au studio.















