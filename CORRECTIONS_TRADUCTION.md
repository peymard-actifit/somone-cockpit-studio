# Corrections de la traduction et restauration

## Problèmes identifiés

1. **Traduction incomplète** : La traduction ne traduisait pas tous les textes (domaines, catégories, éléments, sous-catégories, sous-éléments, unités, etc.)
2. **Restauration en français** : La restauration ne fonctionnait pas correctement

## Corrections apportées

### 1. Amélioration de la traduction récursive

La fonction `translateDataRecursively` dans `api/index.ts` traduit maintenant **tous** les champs texte :
- `name` : domaines, catégories, éléments, sous-catégories, sous-éléments, mapElements
- `description` : alertes
- `actions` : alertes
- `scrollingBanner` : cockpit
- `unit` : unités
- `value` : valeurs textuelles (pas les nombres)
- `duration`, `ticketNumber` : alertes
- `zone`, `address` : zones et adresses

### 2. Correction de la restauration en français

- Utilisation de la même route `/translate` pour la traduction et la restauration
- Amélioration de la restauration des originaux sauvegardés
- Meilleure gestion des erreurs avec logs détaillés
- Messages d'erreur plus informatifs

### 3. Amélioration de la gestion des erreurs

- Ajout de logs détaillés dans la console serveur
- Messages d'erreur plus explicites
- Gestion des cas où les originaux n'existent pas encore

## Prochaines étapes pour déboguer

Si la restauration échoue encore, vérifier dans la console du navigateur (F12) :

1. **Onglet Console** : Vérifier les erreurs JavaScript
2. **Onglet Network** : 
   - Vérifier la requête vers `/api/cockpits/{id}/translate`
   - Regarder la réponse HTTP (status code, body)
   - Vérifier que le token d'authentification est bien envoyé dans les headers

## Messages d'erreur possibles

- **"Non authentifié"** : Le token JWT n'est pas valide ou manquant
- **"Maquette non trouvée"** : L'ID du cockpit est incorrect
- **"Accès non autorisé"** : L'utilisateur n'a pas le droit d'accéder à ce cockpit
- **"Erreur lors de la restauration des originaux"** : Erreur lors de la copie/restauration des données
- **"Aucun texte original sauvegardé"** : Les originaux n'ont pas été sauvegardés lors de la première traduction

## Comment vérifier que tout fonctionne

1. **Première traduction** :
   - Ouvrir un cockpit
   - Cliquer sur "Traduction"
   - Sélectionner une langue (ex: "English")
   - Cliquer sur "Traduire"
   - Vérifier que les textes sont traduits
   - Les originaux devraient être sauvegardés automatiquement

2. **Restauration** :
   - Cliquer sur "Traduction"
   - Sélectionner "Français (Originale)"
   - Cliquer sur "Restaurer"
   - Vérifier que les textes reviennent en français

## Notes importantes

- Les originaux ne sont sauvegardés qu'après la **première traduction**
- Si vous n'avez jamais traduit un cockpit, il n'y aura pas d'originaux à restaurer
- Dans ce cas, la restauration retournera simplement les données actuelles (qui sont déjà en français)

