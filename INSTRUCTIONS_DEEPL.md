# Instructions : Configuration de la clé API DeepL

## ✅ Clé API reçue

La clé API DeepL suivante a été enregistrée :

```
e9da4de5-6d8b-47bc-92bc-b20bac5c7119
```

## 🔧 Configuration dans Vercel

**IMPORTANT** : Vous devez ajouter cette clé dans Vercel pour que la traduction fonctionne.

### Étapes rapides :

1. **Allez sur Vercel** : https://vercel.com
2. **Sélectionnez votre projet** : `somone-cockpit-studio`
3. **Settings** → **Environment Variables**
4. **Ajoutez** :
   - **Name** : `DEEPL_API_KEY`
   - **Value** : `e9da4de5-6d8b-47bc-92bc-b20bac5c7119`
   - Cochez **Production**, **Preview**, et **Development**
5. **Save**
6. **Redéployez** le projet (très important !)

### Détails complets

Consultez le fichier `CONFIGURATION_DEEPL_VERCEL.md` pour les instructions détaillées.

## 🔍 Format de la clé

Cette clé a le format d'un **UUID**, ce qui indique qu'il s'agit probablement de l'**API payante** de DeepL.

Le code a été mis à jour pour détecter automatiquement ce format et utiliser l'URL appropriée (`https://api.deepl.com/v2/translate`).

## ✅ Modifications apportées au code

1. ✅ Amélioration de la détection automatique API gratuite/payante
2. ✅ Support du format UUID pour l'API payante
3. ✅ Documentation complète dans `CONFIGURATION_DEEPL_VERCEL.md`

## 🚀 Prochaines étapes

1. Configurez la clé dans Vercel (voir ci-dessus)
2. Redéployez le projet
3. Testez la traduction dans l'application

Une fois configuré dans Vercel et redéployé, la traduction devrait fonctionner ! 🎉





