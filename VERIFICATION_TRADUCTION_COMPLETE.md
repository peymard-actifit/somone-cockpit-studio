# Vérification complète de la traduction

## Champs actuellement traduits

D'après la fonction `translateDataRecursively` dans `api/index.ts` :

### Liste des champs traduits :
- `name` : Nom des domaines, catégories, éléments, sous-catégories, sous-éléments, mapElements, zones
- `description` : Description des alertes
- `actions` : Actions des alertes
- `scrollingBanner` : Bannière défilante du cockpit
- `unit` : Unité des éléments et sous-éléments
- `duration` : Durée des alertes
- `ticketNumber` : Numéro de ticket (peut contenir du texte)
- `zone` : Nom de zone
- `address` : Adresse des mapElements
- `value` : Valeurs textuelles (pas les nombres)

## Structure complète des données à vérifier

### Cockpit
- ✅ `name` : Nom du cockpit
- ✅ `scrollingBanner` : Bannière défilante

### Domain
- ✅ `name` : Nom du domaine
- ❓ `templateName` : Nom du template (optionnel, peut être technique)

### Category
- ✅ `name` : Nom de la catégorie

### Element (Tuile principale)
- ✅ `name` : Titre de la tuile
- ✅ `value` : Valeur (texte ou nombre)
- ✅ `unit` : Unité
- ✅ `zone` : Nom de zone

### SubCategory
- ✅ `name` : Nom de la sous-catégorie

### SubElement
- ✅ `name` : Nom du sous-élément
- ✅ `value` : Valeur (texte ou nombre)
- ✅ `unit` : Unité

### Alert
- ✅ `description` : Description de l'alerte
- ✅ `duration` : Durée
- ✅ `ticketNumber` : Numéro de ticket
- ✅ `actions` : Actions à entreprendre

### MapElement
- ✅ `name` : Nom du point sur la carte
- ✅ `address` : Adresse (mentionné dans la liste mais pas dans le type TypeScript actuel)

### Zone
- ✅ `name` : Nom de la zone

## Champs potentiellement manquants

### À vérifier :
1. **MapElement `description`** : Le formulaire dans MapView.tsx utilise `description` mais ce champ n'existe pas dans le type TypeScript. À vérifier si ce champ est réellement sauvegardé.
2. **Domain `templateName`** : Si ce champ contient du texte utilisateur, il devrait être traduit. Actuellement, il n'est pas dans la liste.
3. **Commentaires/Notes** : L'utilisateur mentionne les "commentaires". Il faudrait vérifier s'il existe des champs de type commentaire ou note qui ne sont pas encore identifiés.

## Action à prendre

1. Vérifier si `MapElement` a réellement un champ `description` ou `address` qui est sauvegardé
2. Vérifier si `templateName` dans Domain contient du texte utilisateur à traduire
3. Chercher s'il existe des champs "commentaire" ou "note" dans la structure

## Conclusion

La traduction couvre actuellement tous les champs texte identifiés dans la structure TypeScript. Il faut vérifier s'il n'y a pas de champs supplémentaires qui ne sont pas dans les types mais qui sont utilisés dans le code.

