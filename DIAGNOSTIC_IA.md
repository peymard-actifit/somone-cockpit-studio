# Diagnostic de l'Assistant IA

Si l'assistant IA indique qu'il n'est pas configuré malgré l'ajout de la clé dans Vercel, suivez ces étapes de diagnostic :

## 1. Vérifier la variable dans Vercel

1. Allez sur https://vercel.com/dashboard
2. Sélectionnez votre projet `somone-cockpit-studio` (URL : https://somone-cockpit-studio.vercel.app)
3. Allez dans **Settings** → **Environment Variables**
4. Vérifiez que `OPENAI_API_KEY` est bien présente :
   - **Nom exact** : `OPENAI_API_KEY` (sensible à la casse)
   - **Valeur** : Commence par `sk-proj-...` ou `sk-...`
   - **Environments** : Au minimum **Production** doit être coché

## 2. Vérifier que le redéploiement a été fait

**IMPORTANT** : Après avoir ajouté/modifié une variable d'environnement, vous DEVEZ redéployer l'application !

### Via l'interface Vercel :
1. Allez dans l'onglet **Deployments**
2. Cliquez sur les **3 points** (⋮) du dernier déploiement
3. Sélectionnez **Redeploy**
4. Attendez que le déploiement se termine

### Via la ligne de commande :
```bash
vercel --prod --token=S9nvVp6fjX4hnLW35PuN8eED
```

## 3. Vérifier les logs Vercel

1. Allez sur https://vercel.com/dashboard
2. Sélectionnez votre projet
3. Allez dans **Deployments**
4. Cliquez sur le dernier déploiement
5. Allez dans l'onglet **Logs**

Cherchez ces messages au démarrage du serveur :
- ✅ **Bon signe** : `✅ Assistant IA OpenAI activé (clé de XXX caractères, préfixe: sk-proj...)`
- ❌ **Mauvais signe** : `⚠️ Assistant IA désactivé - OPENAI_API_KEY non configurée`

## 4. Tester l'endpoint directement

Vous pouvez tester l'endpoint de statut directement dans votre navigateur ou avec curl :

```
https://somone-cockpit-studio.vercel.app/api/public/ai/status/VOTRE_PUBLIC_ID
```

Remplacez `VOTRE_PUBLIC_ID` par l'ID public d'un cockpit publié.

Réponse attendue si configuré :
```json
{
  "configured": true,
  "model": "gpt-4o-mini"
}
```

Réponse si non configuré :
```json
{
  "configured": false,
  "model": "gpt-4o-mini"
}
```

## 5. Vérifier la clé API OpenAI

1. Allez sur https://platform.openai.com/api-keys
2. Vérifiez que votre clé API est toujours active
3. Vérifiez vos crédits sur https://platform.openai.com/account/billing

## 6. Problèmes courants

### La variable existe mais n'est pas détectée

**Cause** : La variable n'a peut-être pas été redéployée ou n'est pas dans le bon environnement.

**Solution** :
1. Supprimez la variable dans Vercel
2. Redéployez
3. Ajoutez la variable à nouveau avec l'environnement **Production** coché
4. Redéployez encore

### La variable est vide

**Cause** : La valeur n'a pas été correctement copiée/collée.

**Solution** :
1. Vérifiez que la valeur de la clé est complète (commence par `sk-`)
2. Supprimez les espaces avant/après
3. Recréez la variable

### Le redéploiement ne prend pas en compte la variable

**Cause** : Parfois Vercel a besoin d'un redéploiement complet.

**Solution** :
1. Faites un commit et poussez sur votre repo Git
2. Cela déclenchera un nouveau déploiement avec toutes les variables
3. Ou utilisez `vercel --prod --force`

## 7. Contact et support

Si après avoir suivi toutes ces étapes, l'IA ne fonctionne toujours pas :

1. **Consultez les logs Vercel** (étape 3)
2. **Vérifiez la console du navigateur** (F12) pour voir les erreurs côté client
3. **Vérifiez les logs serveur** dans Vercel pour voir les erreurs côté serveur

## Commandes utiles

```bash
# Redéployer en production
vercel --prod --token=S9nvVp6fjX4hnLW35PuN8eED

# Redéployer avec force (ignore le cache)
vercel --prod --force --token=S9nvVp6fjX4hnLW35PuN8eED

# Voir les variables d'environnement
vercel env ls --token=S9nvVp6fjX4hnLW35PuN8eED
```

