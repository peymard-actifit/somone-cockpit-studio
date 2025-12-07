# Diagnostic et corrections pour l'affichage des images de fond dans BackgroundView

## Problème identifié
L'image de fond n'apparaît pas dans BackgroundView lors de la publication du cockpit, ni sur navigateur ni sur mobile.

## Vérifications effectuées

### 1. Route API publique (`GET /public/cockpit/:publicId`)
✅ **Vérifié** : La route retourne bien tous les domaines avec leurs propriétés, incluant `backgroundImage`
- Utilise `...domain` pour préserver toutes les propriétés
- Logs détaillés ajoutés pour vérifier la présence et la validité des images
- Vérifie que `backgroundImage` est une string non vide
- Vérifie que l'image commence par `data:image/`
- Vérifie la validité du base64

### 2. Fonction de validation (`isValidBase64Image`)
✅ **Ajoutée** : Validation stricte des images base64
- Vérifie que c'est une string
- Vérifie que ça commence par `data:image/`
- Vérifie que la partie base64 existe et fait au moins 50 caractères
- Vérifie que la partie base64 respecte le format base64 valide

### 3. BackgroundView en mode readOnly
✅ **Corrigé** : La condition d'affichage inclut maintenant la validation
- Avant : `imageUrl && imageUrl.trim().length > 0 && imageUrl.startsWith('data:image/')`
- Après : `imageUrl && imageUrl.trim().length > 0 && imageUrl.startsWith('data:image/') && isValidBase64Image(imageUrl)`

### 4. Logs de diagnostic
✅ **Ajoutés** : Logs complets à tous les niveaux
- Dans la route API publique : vérifie présence, type, longueur, validité
- Dans BackgroundView useEffect : vérifie la réception et le traitement
- Dans BackgroundView readOnly : vérifie l'état final avant affichage
- Messages d'erreur détaillés si l'image est invalide

### 5. Merge dans PUT /cockpits/:id
✅ **Vérifié** : Le merge préserve bien `backgroundImage`
- Si `backgroundImage` existe dans le domaine existant et n'est pas dans la nouvelle requête (ou est vide), elle est préservée
- Logs détaillés avant et après sauvegarde

### 6. Publication (POST /cockpits/:id/publish)
✅ **Vérifié** : Les logs montrent les images avant et après publication
- Vérifie que tous les domaines ont bien leurs images avant publication
- Vérifie après sauvegarde que les images sont toujours présentes

## Corrections apportées

### 1. Validation de l'image dans la condition d'affichage
```tsx
// Avant
{imageUrl && imageUrl.trim().length > 0 && imageUrl.startsWith('data:image/') ? (

// Après
{imageUrl && imageUrl.trim().length > 0 && imageUrl.startsWith('data:image/') && isValidBase64Image(imageUrl) ? (
```

### 2. Logs améliorés dans l'API publique
- Vérifie la validité base64 de chaque image avant envoi
- Log si l'image est valide ou invalide
- Log de la longueur de la partie base64

### 3. Logs améliorés dans BackgroundView readOnly
- Vérifie si l'image passe la validation `isValidBase64Image`
- Log si l'image sera affichée ou non (`willRender`)
- Messages d'erreur détaillés si l'image est invalide

## Points de diagnostic

Pour vérifier si le problème persiste, consulter les logs suivants :

1. **Console du navigateur (F12) lors de l'accès au cockpit publié** :
   - Chercher `[PublicCockpitPage]` : vérifie la réception des données
   - Chercher `[BackgroundView READ-ONLY]` : vérifie le traitement de l'image
   - Chercher `willRender: true/false` : indique si l'image sera affichée

2. **Logs serveur (Vercel)** :
   - Chercher `[Public API]` : vérifie ce qui est envoyé par l'API
   - Chercher `bg=✅` ou `bg=❌` : indique si l'image est présente
   - Chercher `valid=✅` ou `valid=❌` : indique si l'image est valide

3. **Logs lors de la publication** :
   - Chercher `[PUBLISH]` : vérifie les images avant publication
   - Chercher `bg=✅` : confirme que les images sont présentes

## Causes possibles si le problème persiste

1. **Image corrompue dans la base de données**
   - L'image peut être tronquée ou corrompue lors du stockage
   - Vérifier la longueur dans les logs : doit être > 100 caractères minimum

2. **Image trop grande**
   - Redis peut avoir des problèmes avec de très grandes images (> 5 MB)
   - Vérifier la taille dans les logs (longueur / 1024 / 1024)

3. **Format base64 invalide**
   - Caractères spéciaux ou corruption
   - Vérifier `valid=❌` dans les logs de l'API publique

4. **Problème de timing**
   - L'auto-save n'a pas terminé avant la publication
   - Vérifier les logs `[Auto-save]` et `[PUBLISH]`

## Prochaines étapes si le problème persiste

1. Vérifier les logs dans la console du navigateur lors de l'accès au cockpit publié
2. Vérifier les logs serveur Vercel pour voir ce qui est envoyé par l'API
3. Comparer la longueur de `backgroundImage` avant et après publication
4. Tester avec une petite image (< 100 KB) pour éliminer les problèmes de taille

