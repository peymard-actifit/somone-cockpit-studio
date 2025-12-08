# Changelog

## [2.0.0] - 2025-12-07

### 🎉 Version majeure - Correction critique de l'affichage des images

#### ✨ Corrections majeures

- **Fix critique : Affichage des images dans BackgroundView et MapView**
  - Correction du problème où les images ne s'affichaient pas dans les cockpits publiés
  - Les images étaient bien chargées mais avaient une hauteur de 0px
  - Solution : Utilisation de `position: absolute` avec `inset-0` pour le conteneur d'image en mode readOnly
  - Les images s'affichent maintenant correctement dans tous les cockpits publiés

- **Amélioration des logs de diagnostic**
  - Ajout de logs détaillés pour diagnostiquer les problèmes d'affichage
  - Logs des dimensions numériques (width, height) au lieu d'objets DOMRect
  - Diagnostic automatique : "Image visible: OUI/NON", "Container visible: OUI/NON"

#### 🔧 Améliorations techniques

- **BackgroundView.tsx**
  - Correction du CSS pour garantir une hauteur explicite en mode readOnly
  - Ajout de `position: absolute` et `inset-0` pour le conteneur d'image
  - Amélioration des logs de diagnostic

- **MapView.tsx**
  - Application des mêmes corrections que BackgroundView
  - Synchronisation du comportement entre les deux vues

- **PublicCockpitPage.tsx**
  - Amélioration de la structure des conteneurs pour garantir les hauteurs
  - Ajout de wrappers avec `h-full` et `minHeight: 0`

### 📝 Notes

Cette version corrige un problème critique qui empêchait l'affichage des images de fond dans les cockpits publiés. Les images étaient bien présentes dans les données et validées, mais ne s'affichaient pas visuellement à cause d'un problème de dimensionnement CSS.

---

## [1.0.0] - Version initiale

Version initiale du projet SOMONE Cockpit Studio.





