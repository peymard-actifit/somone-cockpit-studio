# Guide d'utilisation - Système de Versioning Dev/Prod

## ✅ Ce qui a été implémenté

### 1. Bouton de Promotion vers Production

**Localisation** : Le bouton apparaît dans le header de la page d'accueil, à côté du sélecteur de version.

**Conditions d'affichage** :
- Visible uniquement pour les **administrateurs**
- Visible uniquement en **version développement**

**Fonctionnement** :

1. **Cliquez sur "Promouvoir vers Production"**
   - Le système vérifie automatiquement la compatibilité entre dev et prod
   - Affiche un modal avec les informations de compatibilité

2. **Le modal affiche** :
   - État de compatibilité (Compatible / Incompatibilités détectées)
   - Nombre de cockpits en dev et prod
   - Nombre de templates en dev et prod
   - Liste des problèmes détectés (si incompatibilités)

3. **Confirmez la promotion** :
   - Si des incompatibilités sont détectées, les cockpits de production seront automatiquement adaptés
   - Le code (cockpits + templates) est copié de dev vers prod
   - La page se recharge automatiquement après succès

### 2. Sélecteur de Version

**Localisation** : Header de la page d'accueil

**Fonction** : Permet de basculer entre :
- **Développement** : Version où vous développez et testez
- **Production** : Version stable qui n'est pas affectée par les évolutions légères

### 3. Routes Backend

Les routes de transition sont déjà en place :
- `/api/admin/compatibility-check` : Vérifie la compatibilité
- `/api/admin/promote-to-prod` : Lance la promotion
- `/api/version` : Retourne la version actuelle

**Note** : Certaines routes de cockpits doivent encore être finalisées pour utiliser complètement le système de versioning. La route principale GET `/api/cockpits` fonctionne déjà.

## 🚀 Utilisation pratique

### Scénario : Développer une nouvelle fonctionnalité

1. **Travaillez en version développement**
   - Le sélecteur doit indiquer "Développement"
   - Créez/modifiez vos cockpits dans cette version

2. **Testez vos modifications**
   - Les cockpits de dev sont isolés de la production
   - Vous pouvez tester sans risquer d'affecter la production

3. **Quand vous êtes prêt à déployer**
   - Cliquez sur "Promouvoir vers Production"
   - Vérifiez les incompatibilités détectées
   - Confirmez la promotion
   - Le code est transféré vers la production

### Scénario : Publier un cockpit

Les cockpits peuvent être publiés depuis n'importe quelle version (dev ou prod). Les cockpits publiés sont accessibles via l'URL publique.

## 📋 Checklist avant promotion

Avant de promouvoir vers production :

- [ ] Tous les tests sont passés en développement
- [ ] Les cockpits de production existants sont sauvegardés
- [ ] Vous avez vérifié les incompatibilités affichées
- [ ] Vous êtes sûr que les modifications sont prêtes

## 🔧 Migration des données existantes

Si vous avez déjà un fichier `data/db.json` avec des données :

1. Copiez `data/db.json` vers `data/db-dev.json`
2. Créez `data/db-prod.json` (vide ou copie de dev pour commencer)
3. Extrayez les utilisateurs dans `data/db-users.json`

## ⚠️ Important

- Les utilisateurs sont **partagés** entre dev et prod
- Les cockpits et templates sont **séparés** par version
- La promotion **écrase** les données existantes en production (pour les mêmes IDs)
- Les cockpits publiés en production restent accessibles même après promotion

## 🆘 En cas de problème

Si une promotion échoue :
1. Vérifiez les logs du serveur
2. Vérifiez que vous êtes bien admin
3. Vérifiez que la version est bien "dev"
4. Les données de prod ne sont pas supprimées en cas d'échec

## 📝 Prochaines étapes techniques

Pour finaliser complètement le système :
1. Finaliser toutes les routes backend pour utiliser le système de version
2. Mettre à jour le cockpitStore pour inclure les headers de version dans toutes les requêtes
3. Tester le système complet avec des données réelles

Le bouton de promotion et le système de base sont **opérationnels** !















