# Vérification de la connexion et du token JWT

## Comment vérifier si vous êtes connecté

### 1. Dans la console du navigateur (F12)

Ouvrez la console (F12) et tapez :

```javascript
// Vérifier le token dans le store Zustand
JSON.parse(localStorage.getItem('cockpit-auth') || '{}')
```

Cela affichera :
- `user` : Les informations de l'utilisateur (id, username, isAdmin)
- `token` : Le token JWT

### 2. Vérifier directement le token

```javascript
const authData = JSON.parse(localStorage.getItem('cockpit-auth') || '{}');
console.log('User:', authData.state?.user);
console.log('Token:', authData.state?.token ? 'Présent' : 'Absent');
```

### 3. Vérifier l'état de connexion

Dans la console, vous pouvez vérifier :
- Si `user` n'est pas `null`, vous êtes connecté
- Si `token` n'est pas `null`, vous avez un token valide

## Problème identifié et corrigé

### Problème
Le composant `TranslationButton.tsx` utilisait `localStorage.getItem('token')` au lieu d'utiliser le store Zustand (`useAuthStore()`).

### Solution
Le composant utilise maintenant `const { token, user } = useAuthStore()` pour récupérer le token, comme tous les autres composants.

## Après la correction

Le token est maintenant récupéré correctement depuis le store Zustand, qui stocke les données dans `localStorage` sous la clé `cockpit-auth`.

## Test

1. Vérifiez que vous êtes connecté (voir ci-dessus)
2. Essayez de traduire un cockpit
3. Si ça ne fonctionne toujours pas, vérifiez :
   - Que la clé API DeepL est bien configurée dans Vercel
   - Que le projet a été redéployé après l'ajout de la clé
   - Les logs du navigateur (F12) pour voir les erreurs détaillées



