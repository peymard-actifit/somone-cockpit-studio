# 🔧 Dépannage : Assistant IA non configuré

Si l'assistant IA affiche "non configuré" malgré vos vérifications, voici un guide étape par étape :

## ✅ Checklist rapide

1. [ ] La clé API OpenAI est bien créée sur https://platform.openai.com/api-keys
2. [ ] La variable `OPENAI_API_KEY` existe dans Vercel (Settings → Environment Variables)
3. [ ] Le nom de la variable est **exactement** `OPENAI_API_KEY` (sensible à la casse)
4. [ ] La valeur commence par `sk-proj-...` ou `sk-...`
5. [ ] L'environnement **Production** est coché
6. [ ] **Un redéploiement a été fait APRÈS l'ajout de la variable**

## 🚨 Problème le plus courant : Pas de redéploiement

**La variable d'environnement n'est active qu'après un redéploiement !**

### Solution rapide :

```bash
# Redéployer en production
vercel --prod --token=S9nvVp6fjX4hnLW35PuN8eED
```

Ou via l'interface Vercel :
1. Deployments → Cliquez sur les 3 points (⋮) → Redeploy

## 🔍 Vérification étape par étape

### Étape 1 : Vérifier la variable dans Vercel

1. Allez sur https://vercel.com/dashboard
2. Projet : `somone-cockpit-studio` (URL : https://somone-cockpit-studio.vercel.app)
3. **Settings** → **Environment Variables**
4. Vérifiez :
   - ✅ Nom : `OPENAI_API_KEY` (exact, sans espaces)
   - ✅ Valeur : Votre clé (commence par `sk-`)
   - ✅ Production : Cochez cette case

**Si la variable n'existe pas ou est mal nommée, ajoutez-la :**
- Cliquez sur "Add New"
- Name : `OPENAI_API_KEY`
- Value : Votre clé API
- Environments : Cochez **Production** au minimum

### Étape 2 : Redéployer (CRUCIAL)

**⚠️ IMPORTANT : Après chaque modification de variable d'environnement, il faut redéployer !**

#### Option A : Ligne de commande
```bash
vercel --prod --token=S9nvVp6fjX4hnLW35PuN8eED
```

#### Option B : Interface Vercel
1. Allez dans **Deployments**
2. Trouvez le dernier déploiement
3. Cliquez sur les **3 points** (⋮)
4. **Redeploy**
5. Attendez que ça se termine (1-2 minutes)

### Étape 3 : Vérifier les logs

1. Dans Vercel : **Deployments** → Cliquez sur le dernier déploiement
2. Onglet **Logs**
3. Cherchez ces messages au démarrage :

**✅ Si ça fonctionne :**
```
✅ Assistant IA OpenAI activé (clé de XXX caractères, préfixe: sk-proj...)
```

**❌ Si ça ne fonctionne pas :**
```
⚠️ Assistant IA désactivé - OPENAI_API_KEY non configurée
⚠️ Variable d'environnement process.env.OPENAI_API_KEY NON détectée
```

### Étape 4 : Tester dans l'application

1. Ouvrez un cockpit publié
2. Le bouton IA doit être en haut à droite
3. Cliquez dessus
4. Si vous voyez "IA non configurée", la variable n'est pas chargée

## 🐛 Problèmes courants

### Problème 1 : "La variable existe mais n'est pas détectée"

**Causes possibles :**
- La variable n'a pas été redéployée après ajout
- La variable est dans le mauvais environnement (ex: seulement Preview au lieu de Production)

**Solution :**
1. Supprimez la variable
2. Redéployez
3. Recréez la variable avec **Production** coché
4. Redéployez encore

### Problème 2 : "Le nom est différent"

**Vérifiez :**
- Le nom doit être **exactement** `OPENAI_API_KEY`
- Pas d'espaces avant/après
- Pas de différence de casse (tout en majuscules)

### Problème 3 : "La clé est invalide"

**Vérifiez :**
1. Allez sur https://platform.openai.com/api-keys
2. Vérifiez que votre clé est toujours active
3. Vérifiez vos crédits sur https://platform.openai.com/account/billing

### Problème 4 : "Ça fonctionnait avant mais plus maintenant"

**Causes possibles :**
- La clé API a été révoquée
- Les crédits sont épuisés
- Un redéploiement a écrasé les variables

**Solution :**
1. Vérifiez la clé sur OpenAI
2. Vérifiez les variables dans Vercel
3. Redéployez

## 🧪 Test direct de l'API

Pour tester si la clé est bien chargée, vous pouvez tester l'endpoint directement :

Remplacez `VOTRE_PUBLIC_ID` par l'ID public d'un cockpit publié :

```
https://somone-cockpit-studio.vercel.app/api/public/ai/status/VOTRE_PUBLIC_ID
```

**Réponse si configuré :**
```json
{
  "configured": true,
  "model": "gpt-4o-mini"
}
```

**Réponse si non configuré :**
```json
{
  "configured": false,
  "model": "gpt-4o-mini"
}
```

## 📝 Résumé des actions

1. ✅ Vérifier que `OPENAI_API_KEY` existe dans Vercel
2. ✅ Vérifier que Production est coché
3. ✅ **Redéployer l'application**
4. ✅ Vérifier les logs Vercel
5. ✅ Tester dans l'application

## 💡 Astuce

Si vous modifiez souvent les variables d'environnement, vous pouvez utiliser un fichier `.env.local` en développement, mais sur Vercel, elles doivent être ajoutées via l'interface ou la CLI.

## 🆘 En cas de problème persistant

1. Consultez les **logs Vercel** (Deployments → Logs)
2. Vérifiez la **console du navigateur** (F12) pour les erreurs côté client
3. Vérifiez que la clé API fonctionne sur https://platform.openai.com/api-keys

---

**Rappel important** : Après chaque ajout/modification de variable d'environnement dans Vercel, **vous DEVEZ redéployer l'application** pour que les changements soient pris en compte !

