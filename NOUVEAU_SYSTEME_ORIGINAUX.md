# Nouveau système de sauvegarde explicite des originaux

## Fonctionnalités demandées

1. **Bouton pour figer la version actuelle** : Un bouton dans le menu de traduction permet de sauvegarder explicitement la version actuelle comme originaux
2. **Remplacement de la version sauvegardée** : Si on clique à nouveau sur ce bouton après des traductions, on peut remplacer la version sauvegardée par les données actuelles
3. **Français toujours disponible** : Le français doit apparaître dans la liste des langues indépendamment de la version sauvegardée
4. **Sauvegarde automatique** : Si on clique directement sur une langue sans avoir jamais sauvegardé, il prend la version en cours pour la sauvegarder automatiquement

## Implémentation

### 1. Route API pour sauvegarder explicitement les originaux

**Route**: `POST /api/cockpits/:id/save-originals`

Cette route permet de sauvegarder explicitement les données actuelles comme originaux.

### 2. Modifications de TranslationButton

- Ajout d'un bouton "Figer la version actuelle" dans le menu
- Le français est toujours disponible dans la liste, indépendamment de la version sauvegardée
- Sauvegarde automatique seulement si on traduit sans avoir jamais sauvegardé

### 3. Logique de traduction

- Si on traduit sans avoir jamais sauvegardé d'originaux, sauvegarder automatiquement la version en cours
- Le français permet toujours de restaurer la dernière version sauvegardée
- Le bouton "Figer" permet de remplacer la version sauvegardée par la version actuelle



