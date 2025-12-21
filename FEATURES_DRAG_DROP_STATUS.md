# Nouvelles fonctionnalités - Drag & Drop et indicateurs de statut

## 🎉 Fonctionnalités ajoutées

### 1. Drag and Drop des domaines

Les onglets de domaines peuvent maintenant être réorganisés par glisser-déposer :

- **Icône de grip** : Une icône de grip vertical apparaît au survol de chaque onglet
- **Glisser-déposer** : Il suffit de cliquer et maintenir sur l'icône de grip pour déplacer un domaine
- **Sauvegarde automatique** : L'ordre est automatiquement sauvegardé après réorganisation
- **Animation fluide** : Feedback visuel pendant le drag (opacité réduite)

### 2. Indicateur de statut le plus critique

Chaque onglet affiche maintenant un point de couleur indiquant le statut le plus critique parmi tous les éléments du domaine :

- **Point de couleur** : Affiche la couleur du statut le plus critique
  - **Violet** : Fatal
  - **Rouge** : Critique
  - **Orange** : Mineur
  - **Bleu** : Information
  - **Vert** : OK (pas de point affiché)
  - **Gris** : Déconnecté

- **Calcul intelligent** : 
  - Parcourt tous les éléments de toutes les catégories
  - Prend en compte les sous-éléments
  - Prend en compte les éléments de carte (mapElements)
  - Gère correctement les statuts hérités

- **Positionnement** : Le point est positionné en haut à droite de l'onglet, en tenant compte de l'espace nécessaire pour le bouton de suppression

## 📝 Modifications techniques

### Fichiers modifiés

1. **`src/components/Navbar.tsx`**
   - Ajout de `@dnd-kit` pour le drag and drop
   - Création du composant `SortableDomainTab`
   - Calcul et affichage du statut le plus critique
   - Icône de grip pour le drag

2. **`src/types/index.ts`**
   - Ajout de la fonction `getDomainWorstStatus()` pour calculer le statut le plus critique

3. **`src/store/cockpitStore.ts`**
   - Ajout de la fonction `reorderDomains()` pour réorganiser les domaines
   - Mise à jour automatique des champs `order` de chaque domaine

4. **`src/components/icons.ts`**
   - Ajout de l'icône `GripVertical` pour le drag and drop

## 🎯 Utilisation

### Réorganiser les domaines

1. Survoler un onglet de domaine
2. Cliquer et maintenir sur l'icône de grip (⋮⋮) qui apparaît à gauche
3. Glisser l'onglet vers la nouvelle position
4. Relâcher pour confirmer

### Comprendre les indicateurs

- **Point violet** : Au moins un élément a un statut "Fatal"
- **Point rouge** : Au moins un élément a un statut "Critique"
- **Point orange** : Au moins un élément a un statut "Mineur"
- **Point bleu** : Au moins un élément a un statut "Information"
- **Aucun point** : Tous les éléments sont "OK" ou "Déconnecté"

## ✨ Avantages

- **Visibilité immédiate** : Voir d'un coup d'œil quels domaines nécessitent attention
- **Organisation flexible** : Réorganiser les domaines selon vos priorités
- **Intuitif** : Interface de drag and drop standard et familière

















