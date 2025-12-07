# Clé API DeepL configurée

## Clé API DeepL

```
e9da4de5-6d8b-47bc-92bc-b20bac5c7119
```

## Instructions de configuration

### Pour Vercel (Production)

1. Allez sur https://vercel.com
2. Sélectionnez votre projet `somone-cockpit-studio`
3. Allez dans **Settings** → **Environment Variables**
4. Ajoutez une nouvelle variable :
   - **Name** : `DEEPL_API_KEY`
   - **Value** : `e9da4de5-6d8b-47bc-92bc-b20bac5c7119`
   - **Environments** : Cochez **Production**, **Preview**, et **Development**
5. Cliquez sur **Save**
6. **Important** : Redéployez votre projet pour que la variable soit disponible

### Pour le développement local

Créez un fichier `.env.local` à la racine du projet :

```bash
DEEPL_API_KEY=e9da4de5-6d8b-47bc-92bc-b20bac5c7119
```

## Format de la clé

Cette clé a le format d'un UUID, ce qui suggère qu'il s'agit probablement de l'**API payante** de DeepL.

Le code détectera automatiquement si c'est l'API gratuite ou payante basé sur le format de la clé.



