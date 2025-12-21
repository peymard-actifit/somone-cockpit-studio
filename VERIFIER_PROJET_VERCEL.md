# Guide : Identifier le projet Vercel actif

Vous avez deux projets Vercel :
1. `somone-cockpit-studio` (avec "-studio")
2. `somone-cockpit` (sans "-studio")

## 🔍 Méthode 1 : Vérifier les déploiements récents

1. Allez sur https://vercel.com/dashboard
2. Ouvrez le projet **`somone-cockpit-studio`**
   - Allez dans l'onglet **"Deployments"**
   - Notez la date du dernier déploiement
3. Ouvrez le projet **`somone-cockpit`**
   - Allez dans l'onglet **"Deployments"**
   - Notez la date du dernier déploiement

**Le projet avec le déploiement le plus récent est probablement l'actif.**

## 🔍 Méthode 2 : Tester les URLs

Testez ces deux URLs dans votre navigateur :

1. **`https://somone-cockpit-studio.vercel.app`**
   - ✅ Fonctionne = C'est le projet actif
   - ❌ Erreur 404 = Ce n'est pas le projet actif

2. **`https://somone-cockpit.vercel.app`** (ancien projet, à supprimer)
   - ✅ Fonctionne = Ancien projet (peut être supprimé)
   - ❌ Erreur 404 = Déjà supprimé ou inactif

**L'URL qui fonctionne correspond au projet actif.**

## 🔍 Méthode 3 : Vérifier les variables d'environnement

1. Dans chaque projet Vercel, allez dans **Settings** → **Environment Variables**
2. Vérifiez où se trouve `OPENAI_API_KEY` (si vous l'avez configurée)
3. Vérifiez aussi `JWT_SECRET` et autres variables

**Le projet avec les variables d'environnement configurées est probablement l'actif.**

## 🔍 Méthode 4 : Vérifier le dernier déploiement avec le token

**✅ PROJET ACTIF CONFIRMÉ : `somone-cockpit-studio`**

Le code utilise maintenant l'URL : `https://somone-cockpit-studio.vercel.app`

## ✅ Conclusion

Après vérification, vous devriez garder :
- **Le projet qui fonctionne** (URL accessible)
- **Le projet avec les déploiements récents**
- **Le projet avec les variables d'environnement configurées**

Vous pouvez supprimer l'autre projet s'il :
- N'a pas de déploiements récents
- N'a pas de variables d'environnement importantes
- Affiche une erreur 404

## 📝 Après identification

Une fois que vous savez quel projet est actif, je pourrai :
1. Mettre à jour le code pour être cohérent
2. Mettre à jour les guides de documentation
3. Vous confirmer quel projet supprimer

