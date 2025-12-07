# Explication : Authentification pour l'API DeepL

## Les deux niveaux d'authentification

Il y a **deux types d'authentification** nécessaires pour utiliser la traduction DeepL :

### 1. Authentification Utilisateur (JWT Token)
- **Pourquoi ?** : Pour protéger l'accès aux cockpits et s'assurer que seul le propriétaire ou un admin peut traduire un cockpit
- **Où ?** : Dans le header `Authorization: Bearer <token>` de la requête HTTP
- **Quand ?** : Requis pour toutes les routes de traduction (`/cockpits/:id/translate`)

### 2. Clé API DeepL (DEEPL_API_KEY)
- **Pourquoi ?** : Pour authentifier les requêtes vers l'API DeepL externe
- **Où ?** : Variable d'environnement côté serveur (`process.env.DEEPL_API_KEY`)
- **Quand ?** : Utilisée automatiquement par le serveur lors des appels à l'API DeepL

## Pourquoi les deux sont nécessaires ?

1. **Sécurité** : L'authentification utilisateur empêche n'importe qui de traduire n'importe quel cockpit
2. **Accès contrôlé** : Seuls les propriétaires de cockpits ou les admins peuvent traduire
3. **API DeepL** : La clé API DeepL est nécessaire pour que le serveur puisse communiquer avec l'API DeepL

## Configuration requise

### Côté serveur (variables d'environnement)
```bash
DEEPL_API_KEY=votre_cle_api_deepl
```

### Côté client
L'utilisateur doit être connecté (avoir un token JWT valide) pour utiliser la fonctionnalité de traduction.

## Flow d'authentification

```
Client (connecté avec JWT)
    ↓
Route API /cockpits/:id/translate
    ↓
1. Vérifie l'authentification utilisateur (JWT)
    ↓
2. Vérifie que l'utilisateur est propriétaire/admin
    ↓
3. Vérifie que DEEPL_API_KEY est configurée
    ↓
4. Appelle l'API DeepL avec DEEPL_API_KEY
    ↓
Retourne les données traduites
```

## Message d'erreur "Non authentifié"

Si vous voyez ce message, cela signifie que :
- Le token JWT est manquant ou invalide
- L'utilisateur n'est pas connecté
- Le header `Authorization: Bearer <token>` n'est pas envoyé

**Solution** : S'assurer que l'utilisateur est bien connecté avant d'utiliser la fonctionnalité de traduction.



