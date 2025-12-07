# 🔧 Solution au problème de hauteur d'image (0.99px)

## Problème identifié

D'après le diagnostic JavaScript :
- ✅ Largeur calculée : **1472.39px** (correct)
- ❌ Hauteur calculée : **0.99px** (PROBLÈME !)

L'image est écrasée verticalement, rendant l'image invisible.

## Cause racine

Le problème vient de `object-contain` avec `absolute inset-0` dans un conteneur qui n'a pas de hauteur définie.

**Chaîne de conteneurs :**
1. BackgroundView/MapView → `div` avec `h-full flex flex-col`
2. containerRef → `div` avec `flex-1` (nécessite un parent avec hauteur)
3. imageContainerRef → `div` avec `h-full` (nécessite un parent avec hauteur)
4. img → `absolute inset-0` avec `object-contain`

Le problème : `flex-1` ne fonctionne que si le parent a une hauteur définie, et en mode readOnly, la hauteur peut être 0.

## Solution

Il faut utiliser une hauteur explicite basée sur la taille du viewport ou du conteneur parent au lieu de `flex-1` en mode readOnly.

### Approche 1 : Utiliser `calc()` avec la hauteur du viewport

### Approche 2 : Utiliser `position: absolute` sur le conteneur principal

### Approche 3 : Forcer une hauteur minimale basée sur le viewport

Je vais implémenter l'approche 3 qui est la plus fiable.

