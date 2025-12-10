# SOMONE Cockpit Studio

Studio de création de maquettes de cockpit pour la supervision d'indicateurs métier.

## 🚀 Fonctionnalités

### Authentification
- Création de compte avec identifiant et mot de passe
- Mode administrateur (accès à toutes les maquettes)
- Gestion du mot de passe

### Gestion des maquettes
- Création de maquettes de cockpit
- Duplication avec renommage
- Sauvegarde automatique en temps réel
- Export Excel multi-onglets

### Structure du cockpit (3 niveaux)

1. **Vue Domaines** (max 6)
   - Bandeau de navigation
   - Catégories horizontales/verticales
   - Éléments avec statut coloré

2. **Vue Éléments**
   - Sous-catégories
   - Sous-éléments avec statut

3. **Vue Alertes**
   - Pop-up détaillé pour les statuts Fatal/Critique/Mineur
   - Chemin complet (breadcrumb)

### Vues spéciales
- **Carte dynamique** : positionnement géographique des éléments
- **Image de fond** : positionnement libre par drag & drop

### Personnalisation
- 5 statuts colorés : Fatal (violet), Critique (rouge), Mineur (orange), OK (vert), Déconnecté (gris)
- Icônes personnalisables
- Images de fond
- Bandeau défilant
- Logo personnalisé

## 📦 Installation

```bash
# Installer les dépendances
npm install

# Lancer en développement
npm run dev
```

L'application sera disponible sur :
- Frontend : http://localhost:5173
- Backend : http://localhost:3001

## 🛠 Technologies

| Composant | Technologie |
|-----------|-------------|
| Frontend | React + TypeScript + Vite |
| Style | Tailwind CSS |
| État | Zustand |
| Backend | Express + TypeScript |
| Base de données | SQLite (better-sqlite3) |
| Auth | JWT + bcrypt |
| Export | SheetJS (xlsx) |

## 📁 Structure du projet

```
├── src/
│   ├── components/     # Composants React
│   ├── pages/          # Pages de l'application
│   ├── store/          # Stores Zustand
│   ├── types/          # Types TypeScript
│   └── main.tsx        # Point d'entrée
├── server/
│   └── index.ts        # Serveur Express
├── data/               # Base de données SQLite
└── public/             # Assets statiques
```

## 🔐 Codes par défaut

- **Code administrateur** : `SOMONE2024` (modifiable via variable d'environnement `ADMIN_CODE`)

## 📊 Export Excel

L'export génère un fichier avec les onglets suivants :
- **Domaines** : Liste des domaines
- **Catégories** : Catégories par domaine
- **Éléments** : Tous les éléments avec leurs propriétés
- **Sous-catégories** : Sous-catégories par élément
- **Sous-éléments** : Sous-éléments avec statuts
- **Alertes** : Détail des alertes configurées
- **Zones** : Liste des zones définies

## 🎨 Design

Le design suit les maquettes PDF SOMONE avec :
- Thème sombre professionnel
- Couleurs cohérentes pour les statuts
- Interface responsive
- Animations fluides

---

© 2024 SOMONE Studio






































