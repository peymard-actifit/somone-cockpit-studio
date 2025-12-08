# ⚡ Étapes rapides : Configuration DeepL

## 🎯 Ce que vous devez faire

### 1. Obtenir votre clé API DeepL

1. Allez sur https://www.deepl.com/fr/pro-api
2. Connectez-vous avec :
   - Email : `patrick.eymard@actifit.pro`
   - Mot de passe : `Pat26rick_`
3. Allez dans votre compte → Section API
4. Créez/générez une clé API
5. **Copiez cette clé API** (elle ressemble à `fx-xxxxx-xxxxx-xxxxx`)

### 2. Configurer dans Vercel

1. Allez sur https://vercel.com
2. Sélectionnez le projet `somone-cockpit-studio`
3. **Settings** → **Environment Variables**
4. Ajoutez :
   - Name : `DEEPL_API_KEY`
   - Value : Collez votre clé API
   - Cochez toutes les environnements (Production, Preview, Development)
5. **Save**
6. **Redéployez** le projet (très important !)

### 3. Test

Une fois configuré, essayez de traduire un cockpit. Ça devrait fonctionner !

---

## ⚠️ Important

- **Ne confondez pas** : L'email/mot de passe sert à se connecter au compte DeepL, mais pour l'API, il faut la **clé API**
- La clé API est un token unique qui ressemble à : `fx-1234-5678-90ab-cdef`
- Sans cette clé API, la traduction ne fonctionnera pas

## ❓ Besoin d'aide ?

Consultez `GUIDE_CONFIGURATION_DEEPL.md` pour plus de détails.






