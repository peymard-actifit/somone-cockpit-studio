# Guide : Où trouver les logs pour diagnostiquer l'affichage des images

## 📍 Où trouver les logs

### 1. Logs du navigateur (F12)

**Pour voir les logs dans le cockpit publié :**

1. Ouvrez le cockpit publié dans votre navigateur
2. Appuyez sur **F12** pour ouvrir les outils de développement
3. Cliquez sur l'onglet **Console**
4. Cherchez les logs qui commencent par :
   - `[PublicCockpitPage]` : Logs de réception des données
   - `[BackgroundView READ-ONLY]` : Logs du composant BackgroundView
   - `[MapView READ-ONLY]` : Logs du composant MapView

**Ce que vous devriez voir :**
```
[BackgroundView READ-ONLY] Domain "Domaine 04 Background" (templateType: background)
[BackgroundView READ-ONLY] backgroundImage type: string
[BackgroundView READ-ONLY] ✅ Domain "Domaine 04 Background": backgroundImage présente (190894 caractères)
[BackgroundView READ-ONLY] imageUrl après traitement: { hasImageUrl: true, imageUrlLength: 190894, isValid: true, willRender: true }
```

### 2. Logs Vercel (Serveur)

**Pour voir les logs serveur lors de la publication :**

1. Allez sur https://vercel.com
2. Connectez-vous à votre compte
3. Sélectionnez le projet **somone-cockpit-studio**
4. Cliquez sur l'onglet **Logs** dans le menu de gauche
5. Cherchez les logs qui commencent par :
   - `[PUBLISH]` : Logs lors de la publication
   - `[Public API]` : Logs de l'API publique
   - `[PUT /cockpits/:id]` : Logs lors de la sauvegarde

**Ce que vous devriez voir :**
```
[PUBLISH] 🚀 Publication du cockpit "Mon Cockpit" (abc123)
[PUBLISH] Domain[0] "Domaine 04 Background": bg=✅(190894)
[PUBLISH] ✅ Après sauvegarde - Cockpit publié avec 4 domaines
[Public API] Domain "Domaine 04 Background": bg=✅(190894), valid=✅
```

### 3. Logs lors de la publication dans le studio

**Dans la console du navigateur (F12) pendant que vous publiez :**

1. Ouvrez le studio dans votre navigateur
2. Appuyez sur **F12** pour ouvrir les outils de développement
3. Cliquez sur l'onglet **Console**
4. Cliquez sur "Publier" dans le studio
5. Cherchez les logs qui commencent par :
   - `[Publish]` : Logs du store Zustand
   - `[Auto-save]` : Logs de l'auto-save

**Ce que vous devriez voir :**
```
[Publish] 💾 Sauvegarde forcée avant publication...
[Auto-save] Envoi des données: { domainsCount: 4, domainsWithImages: 2 }
[Auto-save] Domain[0] "Domaine 04 Background": backgroundImage=PRESENTE (190894 chars)
```

## 🔍 Diagnostic étape par étape

### Étape 1 : Vérifier que l'image est bien reçue

**Dans la console du cockpit publié, cherchez :**
```
[PublicCockpitPage] ✅ Domain "Domaine 04 Background": image présente (190894 caractères)
```

✅ **Si vous voyez cela** : L'image est bien reçue depuis l'API
❌ **Si vous ne voyez pas cela** : L'image n'est pas dans les données reçues

### Étape 2 : Vérifier que l'image est valide

**Dans la console du cockpit publié, cherchez :**
```
[BackgroundView READ-ONLY] Is valid base64 image: true
```

✅ **Si vous voyez `true`** : L'image est valide
❌ **Si vous voyez `false`** : L'image est corrompue ou invalide

### Étape 3 : Vérifier si l'image sera affichée

**Dans la console du cockpit publié, cherchez :**
```
[BackgroundView READ-ONLY] imageUrl après traitement: { willRender: true }
```

✅ **Si vous voyez `willRender: true`** : L'image devrait s'afficher
❌ **Si vous voyez `willRender: false`** : L'image ne s'affichera pas (vérifier pourquoi)

### Étape 4 : Vérifier le chargement de l'image

**Dans la console du cockpit publié, cherchez :**
```
[BackgroundView] ✅ Image chargée avec succès pour "Domaine 04 Background" - dimensions: 384x387
```

✅ **Si vous voyez cela** : L'image est chargée par le navigateur
❌ **Si vous voyez une erreur** : L'image ne peut pas être chargée (format invalide, etc.)

## 🚨 Messages d'erreur courants

### Erreur : "Image INVALIDE"
```
[BackgroundView READ-ONLY] ❌ Image INVALIDE pour "Domaine 04 Background"
```
**Cause** : L'image base64 est corrompue ou invalide
**Solution** : Recharger l'image dans le studio

### Erreur : "backgroundImage est ABSENTE"
```
[BackgroundView READ-ONLY] ❌ Domain "Domaine 04 Background": backgroundImage est ABSENTE
```
**Cause** : L'image n'est pas dans les données reçues
**Solution** : Vérifier les logs Vercel pour voir si l'image est bien envoyée

### Erreur : "willRender: false"
```
[BackgroundView READ-ONLY] imageUrl après traitement: { willRender: false }
```
**Cause** : L'image ne passe pas la validation
**Solution** : Vérifier les détails dans les logs précédents

## 📸 Exemple de logs complets (ce que vous devriez voir)

### Console du cockpit publié :
```
[PublicCockpitPage] Réponse API reçue: { domainsCount: 4 }
[PublicCockpitPage] ✅ Domain "Domaine 04 Background": image présente (190894 caractères)
[PublicCockpitPage] - Starts with data:image: true
[BackgroundView READ-ONLY] ====================
[BackgroundView READ-ONLY] Domain "Domaine 04 Background" (templateType: background)
[BackgroundView READ-ONLY] backgroundImage type: string
[BackgroundView READ-ONLY] ✅ Domain "Domaine 04 Background": backgroundImage présente (190894 caractères)
[BackgroundView READ-ONLY] Starts with 'data:image/': true
[BackgroundView READ-ONLY] Is valid base64 image: true
[BackgroundView READ-ONLY] imageUrl après traitement: { hasImageUrl: true, imageUrlLength: 190894, isValid: true, willRender: true }
[BackgroundView] ✅ Image chargée avec succès pour "Domaine 04 Background" - dimensions: 384x387
[BackgroundView READ-ONLY] ✅ Image chargée avec succès pour le domaine "Domaine 04 Background"
```

### Logs Vercel :
```
[PUBLISH] 🚀 Publication du cockpit "Mon Cockpit"
[PUBLISH] Domain[0] "Domaine 04 Background": bg=✅(190894)
[PUBLISH] ✅ Après sauvegarde - Cockpit publié avec 4 domaines
[Public API] Domain "Domaine 04 Background": bg=✅(190894), valid=✅
[Public API] ✅ Envoi réponse avec 4 domaines
```

## 🛠️ Comment copier les logs

1. **Dans la console du navigateur (F12)** :
   - Clic droit dans la console → "Save as..." pour sauvegarder
   - Ou sélectionner le texte et copier (Ctrl+C)

2. **Dans Vercel** :
   - Cliquez sur une ligne de log pour voir les détails
   - Copiez le texte ou faites une capture d'écran

## 📞 Si le problème persiste

Envoyez-moi :
1. Les logs de la console du cockpit publié (tous les logs qui commencent par `[BackgroundView READ-ONLY]`)
2. Les logs Vercel lors de la publication (tous les logs qui commencent par `[PUBLISH]`)
3. Une capture d'écran de ce que vous voyez (ou ne voyez pas) dans le cockpit publié

