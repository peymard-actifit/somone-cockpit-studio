# Guide : Vérifier votre connexion et le token JWT

## Problème identifié et corrigé

Le composant `TranslationButton.tsx` utilisait `localStorage.getItem('token')` au lieu d'utiliser le store Zustand qui stocke le token correctement.

**✅ Correction appliquée** : Le composant utilise maintenant `useAuthStore()` pour récupérer le token.

## Comment vérifier si vous êtes connecté

### Méthode 1 : Dans la console du navigateur (F12)

1. Ouvrez la console (F12)
2. Tapez cette commande :

```javascript
// Vérifier les données d'authentification
const authData = JSON.parse(localStorage.getItem('cockpit-auth') || '{}');
console.log('User:', authData.state?.user);
console.log('Token:', authData.state?.token ? 'Présent ✅' : 'Absent ❌');
console.log('Token value:', authData.state?.token?.substring(0, 20) + '...');
```

### Méthode 2 : Vérification simple

```javascript
// Vérifier rapidement
const auth = JSON.parse(localStorage.getItem('cockpit-auth') || '{}');
if (auth.state?.user && auth.state?.token) {
  console.log('✅ Connecté en tant que:', auth.state.user.username);
  console.log('✅ Token présent');
} else {
  console.log('❌ Non connecté');
}
```

### Méthode 3 : Dans l'interface

Dans l'application, vérifiez :
- En haut à droite, votre nom d'utilisateur devrait apparaître
- Si vous voyez "Se connecter", vous n'êtes pas connecté

## Vérifier la clé API DeepL dans Vercel

1. Allez sur https://vercel.com
2. Sélectionnez le projet `somone-cockpit-studio`
3. **Settings** → **Environment Variables**
4. Vérifiez que `DEEPL_API_KEY` existe avec la valeur : `e9da4de5-6d8b-47bc-92bc-b20bac5c7119`

## Test de la traduction

1. **Connectez-vous** si ce n'est pas déjà fait
2. **Ouvrez un cockpit** dans le studio
3. **Cliquez sur le bouton "Traduction"**
4. **Sélectionnez une langue** (par exemple "English")
5. **Cliquez sur "Traduire"**

## Si ça ne fonctionne toujours pas

### 1. Vérifier les erreurs dans la console (F12)

Regardez l'onglet **Console** et **Network** pour voir les erreurs détaillées.

### 2. Vérifier les logs Vercel

1. Allez sur https://vercel.com
2. Projet → **Deployments**
3. Cliquez sur le dernier déploiement
4. Regardez les **Logs** pour voir les erreurs serveur

### 3. Erreurs possibles

- **"Non authentifié"** : Vous n'êtes pas connecté → Connectez-vous
- **"DeepL API key not configured"** : La clé n'est pas dans Vercel → Ajoutez-la
- **"DeepL API error"** : La clé API est invalide ou expirée → Vérifiez la clé

## Après correction

Avec la correction appliquée :
- ✅ Le token est récupéré depuis le store Zustand (comme les autres composants)
- ✅ Un message d'avertissement s'affiche si vous n'êtes pas connecté
- ✅ Les erreurs sont plus claires et explicites

## Prochaines étapes

1. ✅ Code corrigé
2. ⏳ Déployez les changements
3. ⏳ Testez la traduction





