# Résumé des corrections de sauvegarde des originaux

## Problème identifié

L'utilisateur ne peut plus revenir aux textes originaux en français après traduction. Les textes concernés incluent :
- Noms des domaines dans le bandeau
- Noms des tuiles (éléments)
- Unités
- Tous les autres textes

## Corrections apportées

### 1. Sauvegarde automatique des originaux avant traduction

**Avant** : Les originaux n'étaient sauvegardés que si `preserveOriginals` était true et si les originaux n'existaient pas déjà.

**Maintenant** : Les originaux sont **TOUJOURS** sauvegardés avant la première traduction, même si les données actuelles sont déjà traduites. Cela garantit qu'on peut toujours revenir aux textes originaux.

### 2. Conservation des originaux après restauration

**Avant** : Les originaux étaient supprimés après restauration, empêchant de restaurer à nouveau.

**Maintenant** : Les originaux sont **JAMAIS** supprimés après restauration. Ils sont conservés dans `cockpit.data.originals` pour permettre plusieurs restaurations.

### 3. Sauvegarde complète de tous les textes

Les originaux sauvegardés incluent **TOUS** les textes :
- ✅ Noms des domaines (`name`, `templateName`)
- ✅ Noms des catégories (`name`)
- ✅ **Titres des tuiles** (`name` des éléments)
- ✅ **Unités** (`unit` des éléments et sous-éléments)
- ✅ Valeurs textuelles (`value` si c'est du texte)
- ✅ Noms des sous-catégories (`name`)
- ✅ Noms des sous-éléments (`name`)
- ✅ Descriptions, actions, durées, tickets des alertes
- ✅ Noms et adresses des points sur la carte
- ✅ Noms des zones
- ✅ Bannière défilante

### 4. Cas où les originaux n'existent pas

Si l'utilisateur demande la restauration en français mais qu'aucun original n'est sauvegardé :
- Les données actuelles sont sauvegardées comme originaux
- Cela permet de créer un "point de retour" même si les données actuelles sont déjà traduites

## Code modifié

### Sauvegarde avant traduction (`api/index.ts`)
```typescript
// IMPORTANT: Toujours sauvegarder les originaux avant la première traduction
if (!cockpit.data.originals) {
  // Sauvegarder une copie complète et profonde des données actuelles
  cockpit.data.originals = JSON.parse(JSON.stringify(data));
  await saveDb(db);
}
```

### Restauration (`api/index.ts`)
```typescript
// Restaurer les originaux MAIS conserver les originaux pour restaurations futures
const originalsCopy = JSON.parse(JSON.stringify(cockpit.data.originals));
cockpit.data = { ...originalsCopy, originals: cockpit.data.originals };
// Les originaux sont conservés dans cockpit.data.originals
```

## Prochaines étapes

1. Tester la sauvegarde des originaux avant traduction
2. Tester la restauration en français
3. Vérifier que tous les textes sont correctement restaurés

## Notes importantes

- Les originaux sont sauvegardés **automatiquement** avant la première traduction
- Les originaux sont **jamais supprimés**, permettant plusieurs restaurations
- Si les originaux n'existent pas lors de la restauration, les données actuelles sont sauvegardées comme originaux





