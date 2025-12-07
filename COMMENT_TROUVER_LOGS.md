# 📍 Comment trouver les logs - Guide simple

## 1️⃣ Logs lors de la publication (dans Vercel)

### Étapes :
1. Allez sur **https://vercel.com**
2. Connectez-vous
3. Cliquez sur votre projet **somone-cockpit-studio**
4. Dans le menu de gauche, cliquez sur **"Logs"**
5. Vous verrez un tableau avec toutes les requêtes

### Ce que vous devez chercher :

**Lorsque vous cliquez sur "Publier" dans le studio :**
- Cherchez une ligne avec `POST /api/cockpits/.../publish`
- Cliquez dessus pour voir les détails
- Vous devriez voir des messages commençant par `[PUBLISH]`

**Exemple de ce que vous devriez voir :**
```
[PUBLISH] 🚀 Publication du cockpit "Mon Cockpit"
[PUBLISH] Domain[0] "Domaine 04 Background": bg=✅(190894)
[PUBLISH] ✅ Après sauvegarde - Cockpit publié avec 4 domaines
```

## 2️⃣ Logs dans le cockpit publié (Console du navigateur)

### Étapes :
1. Ouvrez votre cockpit publié dans le navigateur (l'URL publique)
2. Appuyez sur **F12** (ou clic droit → "Inspecter")
3. Cliquez sur l'onglet **"Console"**
4. Filtrez les logs en tapant dans la barre de recherche : `BackgroundView`

### Ce que vous devez chercher :

**Tous les logs qui commencent par `[BackgroundView READ-ONLY]` :**

1. **Log de réception de l'image :**
   ```
   [BackgroundView READ-ONLY] ✅ Domain "Domaine 04 Background": backgroundImage présente (190894 caractères)
   ```

2. **Log de validation :**
   ```
   [BackgroundView READ-ONLY] Is valid base64 image: true
   ```

3. **Log important - willRender :**
   ```
   [BackgroundView READ-ONLY] imageUrl après traitement: { hasImageUrl: true, imageUrlLength: 190894, isValid: true, willRender: true }
   ```
   ⚠️ **C'est ce log qui vous indique si l'image sera affichée !**

4. **Log de chargement réussi :**
   ```
   [BackgroundView] ✅ Image chargée avec succès pour "Domaine 04 Background" - dimensions: 384x387
   ```

## 3️⃣ Si vous ne voyez PAS le log "willRender"

### C'est normal si :
- Le code n'a pas encore été déployé avec ce log
- Le domaine n'est pas de type "background" (c'est un domaine "map" ou "standard")
- La page n'a pas encore chargé complètement

### Solution :
Le log `willRender` est dans le code mais peut-être pas encore déployé. Regardez plutôt ces logs :

1. **L'image est-elle reçue ?**
   - Cherchez : `backgroundImage présente`
   - Si vous voyez cela avec une longueur > 0, l'image est là

2. **L'image est-elle valide ?**
   - Cherchez : `Is valid base64 image`
   - Si c'est `true`, l'image est valide

3. **L'image est-elle chargée par le navigateur ?**
   - Cherchez : `Image chargée avec succès`
   - Si vous voyez cela avec des dimensions, le navigateur a chargé l'image

## 4️⃣ Diagnostic rapide

### ✅ Tout est OK si vous voyez :
```
[BackgroundView READ-ONLY] ✅ Domain "Domaine 04 Background": backgroundImage présente (190894 caractères)
[BackgroundView] ✅ Image chargée avec succès pour "Domaine 04 Background" - dimensions: 384x387
```

### ❌ Problème si vous voyez :
```
[BackgroundView READ-ONLY] ❌ Domain "Domaine 04 Background": backgroundImage est ABSENTE
```
ou
```
[BackgroundView] ❌ ERREUR chargement image de fond
```

## 5️⃣ D'après vos captures d'écran

Je vois dans vos captures que :
- ✅ Les images sont bien présentes (190894 et 258879 caractères)
- ✅ Les images sont bien chargées (dimensions affichées : 384x387 et 1300x1247)
- ✅ Les logs Vercel montrent `bg=✅(258879)`

**Donc les images DEVRAIENT s'afficher !**

Si elles ne s'affichent pas visuellement, le problème pourrait être :
1. Un problème de CSS (l'image est cachée ou derrière un autre élément)
2. Un problème de z-index
3. Un problème de taille (l'image est trop petite ou hors écran)

## 6️⃣ Comment partager les logs avec moi

1. **Console du navigateur :**
   - F12 → Console
   - Filtrez par `BackgroundView`
   - Copiez TOUS les logs qui commencent par `[BackgroundView]`
   - Ou faites une capture d'écran

2. **Logs Vercel :**
   - Allez dans Vercel → Logs
   - Cherchez les lignes avec `[PUBLISH]` ou `[Public API]`
   - Cliquez dessus et copiez les messages
   - Ou faites une capture d'écran

## 📸 Exemple de ce que je veux voir

**Dans la console du cockpit publié :**
```
[BackgroundView READ-ONLY] ====================
[BackgroundView READ-ONLY] Domain "Domaine 04 Background" (templateType: background)
[BackgroundView READ-ONLY] backgroundImage type: string
[BackgroundView READ-ONLY] ✅ Domain "Domaine 04 Background": backgroundImage présente (190894 caractères)
[BackgroundView READ-ONLY] Is valid base64 image: true
[BackgroundView READ-ONLY] imageUrl après traitement: { willRender: true }
[BackgroundView] ✅ Image chargée avec succès pour "Domaine 04 Background" - dimensions: 384x387
```

**Dans les logs Vercel :**
```
[PUBLISH] Domain[0] "Domaine 04 Background": bg=✅(190894)
[Public API] Domain "Domaine 04 Background": bg=✅(190894), valid=✅
```




