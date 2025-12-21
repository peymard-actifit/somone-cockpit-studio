# Guide de Configuration de l'Assistant IA

Ce guide vous explique comment configurer l'assistant IA pour qu'il fonctionne dans les cockpits publiés et dans le studio.

## Prérequis

- Un compte OpenAI avec accès à l'API
- Votre projet déployé sur Vercel

## Étape 1 : Obtenir une clé API OpenAI

1. **Créez un compte OpenAI** (si vous n'en avez pas)
   - Allez sur https://platform.openai.com/signup
   - Créez un compte ou connectez-vous

2. **Créez une clé API**
   - Allez sur https://platform.openai.com/api-keys
   - Cliquez sur **"Create new secret key"**
   - Donnez-lui un nom (ex: "SOMONE Studio")
   - **Copiez la clé immédiatement** (elle ne sera plus visible après)
   - Exemple de clé : `sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

⚠️ **Important** : Gardez cette clé secrète ! Ne la partagez jamais publiquement.

## Étape 2 : Ajouter la clé dans Vercel

### Option A : Via l'interface web Vercel

1. **Allez sur le tableau de bord Vercel**
   - Ouvrez https://vercel.com/dashboard
   - Connectez-vous si nécessaire

2. **Sélectionnez votre projet**
   - Cliquez sur le projet `somone-cockpit-studio` (URL : https://somone-cockpit-studio.vercel.app)

3. **Accédez aux variables d'environnement**
   - Allez dans **Settings** (Paramètres)
   - Dans le menu de gauche, cliquez sur **Environment Variables**

4. **Ajoutez la variable**
   - Cliquez sur **"Add New"** ou **"Add"**
   - Remplissez les champs :
     - **Name** : `OPENAI_API_KEY`
     - **Value** : Collez votre clé API OpenAI (commence par `sk-...`)
     - **Environments** : Cochez au minimum **Production**
       - Vous pouvez aussi cocher **Preview** et **Development** si vous voulez l'utiliser partout
   - Cliquez sur **Save**

### Option B : Via la ligne de commande Vercel

```bash
vercel env add OPENAI_API_KEY production
```

Vous serez invité à entrer la valeur de la clé.

## Étape 3 : Redéployer l'application

Une fois la variable d'environnement ajoutée, vous devez redéployer l'application pour qu'elle soit prise en compte.

### Via l'interface Vercel

1. Allez dans l'onglet **Deployments**
2. Trouvez le dernier déploiement
3. Cliquez sur les **3 points** (⋮) à droite
4. Sélectionnez **Redeploy**
5. Confirmez

### Via la ligne de commande

```bash
vercel --prod --token=wkGtxH23SiUdqfIVIRMT7fSI
```

## Étape 4 : Vérifier que ça fonctionne

### Dans le Studio

1. Ouvrez votre cockpit dans le studio
2. Regardez en haut à droite : vous devriez voir un bouton **"IA"** avec un dégradé violet/pourpre
3. Cliquez dessus
4. Le panneau IA devrait s'ouvrir
5. Essayez une commande comme : *"Crée un domaine TEST"*
6. Si l'IA répond, c'est que tout fonctionne ! ✅

### Dans les Cockpits Publiés

1. Publiez un cockpit (ou utilisez-en un déjà publié)
2. Ouvrez l'URL publique du cockpit
3. Regardez en haut à droite dans le header : vous devriez voir le bouton **"IA"**
4. Cliquez dessus
5. Posez une question comme : *"Combien d'éléments sont en statut critique ?"*
6. Si l'IA répond, c'est que tout fonctionne ! ✅

## Dépannage

### Le bouton IA s'affiche mais avec un message "IA non configurée"

- **Problème** : La variable d'environnement n'est pas configurée ou le déploiement n'a pas été fait après l'ajout
- **Solution** :
  1. Vérifiez que `OPENAI_API_KEY` est bien présente dans Vercel (Settings → Environment Variables)
  2. Redéployez l'application
  3. Attendez quelques minutes que le redéploiement se termine

### Le bouton IA ne s'affiche pas du tout

- **Problème** : Problème de chargement ou erreur JavaScript
- **Solution** :
  1. Ouvrez la console du navigateur (F12)
  2. Regardez s'il y a des erreurs
  3. Vérifiez que le composant est bien présent dans le code

### L'IA ne répond pas ou donne des erreurs

- **Problème** : Clé API invalide ou quota dépassé
- **Solution** :
  1. Vérifiez que votre clé API est valide sur https://platform.openai.com/api-keys
  2. Vérifiez vos crédits OpenAI sur https://platform.openai.com/account/billing
  3. Vérifiez les logs Vercel pour voir l'erreur exacte

### Comment voir les logs Vercel

1. Allez sur https://vercel.com/dashboard
2. Sélectionnez votre projet
3. Allez dans l'onglet **Deployments**
4. Cliquez sur un déploiement
5. Allez dans l'onglet **Logs** pour voir les erreurs du serveur

## Coûts

L'IA utilise le modèle **GPT-4o-mini** qui est le modèle le plus économique d'OpenAI :

- **Coût** : Environ $0.15 par 1 million de tokens d'entrée
- **Gratuit** : OpenAI offre généralement des crédits gratuits au démarrage
- **Vérification** : Consultez vos coûts sur https://platform.openai.com/account/billing

## Modèle utilisé

- **Studio** : GPT-4o-mini (pour les actions de création/modification)
- **Cockpits publiés** : GPT-4o-mini (pour les questions et analyses en mode consultation)

## Support

Si vous rencontrez des problèmes :

1. Vérifiez les logs Vercel (voir section "Comment voir les logs Vercel")
2. Vérifiez que la clé API est bien configurée
3. Vérifiez que vous avez des crédits OpenAI disponibles
4. Consultez la documentation OpenAI : https://platform.openai.com/docs

## Résumé rapide

1. ✅ Obtenez une clé API sur https://platform.openai.com/api-keys
2. ✅ Ajoutez-la dans Vercel : Settings → Environment Variables → `OPENAI_API_KEY`
3. ✅ Redéployez l'application
4. ✅ Testez dans le studio ou un cockpit publié

C'est tout ! 🎉

