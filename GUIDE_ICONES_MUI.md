# Guide : Enrichissement des icônes Material UI

## Objectif
Enrichir la collection d'icônes du cockpit avec toutes les icônes Material UI et permettre leur sélection par nom.

## Fonctionnalités ajoutées

### 1. Sélection par nom d'icône
- **Nouveau mode "Saisir par nom"** dans le sélecteur d'icônes
- Permet de saisir directement le nom exact de l'icône (ex: "Home", "Settings", "Person")
- Validation en temps réel avec aperçu de l'icône
- Support de la touche Entrée pour validation rapide

### 2. Script de téléchargement
- Script `download-mui-icons.js` pour télécharger automatiquement toutes les icônes Material UI
- Préservation des icônes existantes
- Génération automatique du fichier `icons.ts`

## Utilisation

### Étape 1 : Télécharger les icônes

Exécutez la commande suivante pour télécharger toutes les icônes Material UI :

```bash
npm run download:icons
```

**Note importante** : Cette commande nécessite une connexion internet. Elle télécharge les SVG des icônes depuis les sources officielles Material UI et les intègre localement dans votre projet. Une fois téléchargées, les icônes sont disponibles hors ligne.

### Étape 2 : Utiliser le sélecteur d'icônes

#### Mode recherche (par défaut)
1. Ouvrez le sélecteur d'icônes
2. Utilisez le champ de recherche pour filtrer les icônes
3. Cliquez sur une icône pour la sélectionner

#### Mode saisie directe par nom
1. Cliquez sur le bouton **"Saisir par nom"**
2. Tapez le nom exact de l'icône Material UI
3. Si l'icône existe, un aperçu s'affiche
4. Appuyez sur **Entrée** ou cliquez sur **Valider** pour sélectionner

### Exemples de noms d'icônes

- Navigation : `Home`, `Menu`, `ArrowBack`, `ChevronLeft`
- Actions : `Add`, `Delete`, `Edit`, `Save`, `Download`
- Alertes : `Warning`, `Error`, `Info`, `CheckCircle`
- Transport : `Flight`, `DirectionsCar`, `Train`, `DirectionsBoat`
- Technique : `Build`, `Engineering`, `Bolt`, `Speed`
- Réseau : `Wifi`, `Cloud`, `Router`, `Storage`
- Sécurité : `Security`, `Shield`, `Lock`, `Fingerprint`

## Liste complète des icônes

Le script télécharge plus de 200 icônes Material UI de la première page, incluant :
- Navigation & Actions
- Communication & Media
- Content & Files
- Social & People
- Places & Location
- Transportation
- Technology & Devices
- Tools & Engineering
- Alerts & Feedback
- Time & Date
- Weather & Nature
- Finance & Business
- Health & Medical
- Security & Privacy
- Charts & Analytics
- Et bien plus...

## Fichiers modifiés

- `scripts/download-mui-icons.js` : Script de téléchargement des icônes
- `src/components/IconPicker.tsx` : Amélioration avec mode saisie directe
- `src/components/icons.ts` : Fichier généré automatiquement avec toutes les icônes
- `package.json` : Ajout du script `download:icons`

## Notes techniques

- Les icônes sont stockées localement en format SVG (chemins `d` uniquement)
- Aucune dépendance externe après le téléchargement
- Format compatible avec le composant `MuiIcon` existant
- Les icônes existantes sont préservées lors du téléchargement














