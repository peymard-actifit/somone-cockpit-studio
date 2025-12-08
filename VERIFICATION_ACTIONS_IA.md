# Vérification des Actions IA vs Store

## Actions disponibles dans le store

### Cockpit (gestion globale)
- ✅ `updateCockpit` - Modifier le cockpit (nom, logo, scrollingBanner)
- ❌ `createCockpit` - Créer un nouveau cockpit
- ❌ `duplicateCockpit` - Dupliquer un cockpit
- ❌ `deleteCockpit` - Supprimer un cockpit

### Domaines
- ✅ `addDomain` - Ajouter un domaine
- ✅ `updateDomain` - Modifier un domaine
- ✅ `deleteDomain` - Supprimer un domaine
- ❌ `reorderDomains` - Réorganiser l'ordre des domaines

### Catégories
- ✅ `addCategory` - Ajouter une catégorie
- ✅ `updateCategory` - Modifier une catégorie
- ✅ `deleteCategory` - Supprimer une catégorie

### Éléments
- ✅ `addElement` - Ajouter un élément
- ✅ `addElements` - Ajouter plusieurs éléments
- ✅ `updateElement` - Modifier un élément
- ✅ `deleteElement` - Supprimer un élément
- ✅ `cloneElement` - Cloner un élément
- ❌ `moveElement` - Déplacer un élément d'une catégorie à une autre
- ❌ `reorderElement` - Réorganiser l'ordre des éléments

### Sous-catégories
- ✅ `addSubCategory` - Ajouter une sous-catégorie
- ✅ `updateSubCategory` - Modifier une sous-catégorie
- ✅ `deleteSubCategory` - Supprimer une sous-catégorie

### Sous-éléments
- ✅ `addSubElement` - Ajouter un sous-élément
- ✅ `addSubElements` - Ajouter plusieurs sous-éléments
- ✅ `updateSubElement` - Modifier un sous-élément
- ✅ `deleteSubElement` - Supprimer un sous-élément
- ❌ `moveSubElement` - Déplacer un sous-élément
- ❌ `reorderSubElement` - Réorganiser l'ordre des sous-éléments

### Zones
- ✅ `addZone` - Ajouter une zone
- ✅ `deleteZone` - Supprimer une zone

### Points GPS / Carte
- ✅ `addMapElement` - Ajouter un point GPS
- ✅ `updateMapElement` - Modifier un point GPS
- ✅ `deleteMapElement` - Supprimer un point GPS
- ✅ `cloneMapElement` - Cloner un point GPS
- ✅ `updateMapBounds` - Modifier les coordonnées GPS de la carte

### Navigation
- ✅ `selectDomain` - Sélectionner un domaine
- ✅ `selectElement` - Sélectionner un élément

### Statuts
- ✅ `updateStatus` - Modifier le statut d'un élément ou sous-élément

## Actions manquantes à ajouter

### Actions importantes manquantes :
1. ❌ `updateCockpit` - Modifier le nom, logo, scrollingBanner du cockpit
2. ❌ `reorderDomains` - Réorganiser l'ordre des domaines
3. ❌ `moveElement` - Déplacer un élément entre catégories
4. ❌ `reorderElement` - Réorganiser l'ordre des éléments
5. ❌ `moveSubElement` - Déplacer un sous-élément entre sous-catégories
6. ❌ `reorderSubElement` - Réorganiser l'ordre des sous-éléments

### Actions optionnelles (gestion des cockpits) :
7. ❌ `createCockpit` - Créer un nouveau cockpit (peut être fait manuellement)
8. ❌ `duplicateCockpit` - Dupliquer un cockpit (peut être fait manuellement)
9. ❌ `deleteCockpit` - Supprimer un cockpit (peut être fait manuellement)





