# Tests Visuels à Effectuer

## Test 1 : Slider d'Opacité

1. Ouvrir un cockpit
2. Aller dans un domaine
3. Cliquer sur le bouton "Fond" (en bas à droite)
4. Vérifier :
   - Le modal s'ouvre
   - Il y a une section "Mode d'affichage"
   - Il y a une section avec bordure bleue contenant le slider
   - Le slider est visible et cliquable

**Capture d'écran attendue :**
- Modal ouvert
- Section "Mode d'affichage" visible
- Section slider avec bordure bleue visible

## Test 2 : Changement d'Opacité

1. Ouvrir le modal de configuration
2. Bouger le slider
3. Cliquer sur "Enregistrer"
4. Vérifier :
   - L'image de fond change d'opacité visuellement
   - Le changement persiste après rechargement

**Résultat attendu :**
- L'image devient plus ou moins visible selon la valeur du slider

## Test 3 : Augmentation de 15%

1. Créer ou modifier un élément avec statut "mineur", "critique" ou "fatal"
2. Aller dans MapView ou BackgroundView
3. Vérifier :
   - L'élément est visiblement plus grand que les autres
   - La différence de taille est perceptible à l'œil nu

**Résultat attendu :**
- Les éléments critiques sont environ 15% plus grands

## Questions de Diagnostic

Si quelque chose ne fonctionne pas, noter :
1. **Quel est le comportement exact observé ?**
2. **Y a-t-il des erreurs dans la console ?**
3. **Le code source contient bien les modifications ?**
4. **Le cache du navigateur a-t-il été vidé ? (Ctrl+F5)**

