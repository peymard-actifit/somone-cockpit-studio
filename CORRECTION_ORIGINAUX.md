# Correction de la sauvegarde des originaux

## Problème identifié

L'utilisateur signale que les textes originaux en français ne sont pas correctement sauvegardés et qu'on ne peut plus y revenir. Les textes concernés sont :
- Noms des domaines dans le bandeau
- Noms des tuiles
- Unités
- Tous les autres textes

## Analyse du code actuel

1. Les originaux sont sauvegardés seulement si `preserveOriginals` est true ET si les originaux n'existent pas déjà
2. Si les originaux n'existent pas lors de la restauration en français, on retourne simplement les données actuelles (qui peuvent être déjà traduites)
3. Les originaux sont supprimés après restauration (dans l'ancienne version du code)

## Corrections nécessaires

1. **TOUJOURS sauvegarder les originaux avant la première traduction**, même si les données actuelles sont déjà traduites
2. **NE JAMAIS supprimer les originaux** après restauration pour pouvoir restaurer plusieurs fois
3. **Sauvegarder TOUS les textes** : domaines, catégories, éléments, sous-catégories, sous-éléments, unités, alertes, zones, etc.
4. **Conserver les originaux même après restauration** dans `cockpit.data.originals`

## Solution implémentée

### 1. Sauvegarde des originaux avant traduction
- Si les originaux n'existent pas, sauvegarder les données actuelles comme originaux AVANT de traduire
- Cela garantit qu'on peut toujours revenir aux textes originaux

### 2. Restauration des originaux
- Restaurer les originaux depuis `cockpit.data.originals`
- Conserver les originaux dans `cockpit.data.originals` pour pouvoir restaurer à nouveau plus tard
- Ne pas supprimer les originaux après restauration

### 3. Cas où les originaux n'existent pas
- Si on demande la restauration mais qu'il n'y a pas d'originaux, sauvegarder les données actuelles comme originaux
- Cela permet de créer un "point de retour" même si on a déjà traduit

## Prochaines étapes

1. Tester la sauvegarde des originaux avant traduction
2. Tester la restauration en français
3. Vérifier que tous les textes sont bien sauvegardés et restaurés

















