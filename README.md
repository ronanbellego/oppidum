# Oppidum

Jeu de gestion de cité vénète en Armorique, dans l'esprit de *Caesar*, *Zeus* et *Emperor* : une île hexagonale, un port, des huttes qui deviennent des demeures nobles, des chaînes de production, des dieux et des raids venus de la mer.

## Commandes

```bash
npm install        # une fois
npm run dev        # serveur de développement avec rechargement instantané
npm run build      # produit dist/index.html, un fichier unique autonome
npm test           # tests de la simulation et de la grille
npm run typecheck  # vérification TypeScript
```

## Organisation

```
index.html            structure de la page (bandeau, panneaux, barre d'outils)
src/
  main.ts             point d'entrée : styles + jeu
  styles/app.css      apparence de l'interface
  core/               fondations sans dépendance vers le reste
    constants.ts      taille de la carte, durée d'un mois, réglages d'équilibrage (BAL)
    hex.ts            grille hexagonale : coordonnées, voisins, distances, emprises
    rng.ts            hasard à graine
  data/               ce qui se règle sans toucher à la logique
    buildings.ts      définition des bâtiments et de la barre d'outils
    resources.ts      ressources et prix
    houses.ts         niveaux de maison et tribut
    labor.ts          priorités d'emploi par secteur
    calendar.ts       mois du calendrier de Coligny
    palette.ts        couleurs d'Armorique
  legacy/game.ts      tout le reste, en attente de découpage (voir ci-dessous)
tests/                tests Vitest
tools/split.mjs       script qui a produit ce découpage à partir de la version mono-fichier
```

## Règles d'architecture

1. Les dépendances vont dans un seul sens : `data` et `core` → `world` et `sim` → `render` → `ui`.
2. La simulation ne dessine rien, et l'affichage ne modifie jamais l'état du jeu.
3. Tout l'état d'une partie vit dans un objet unique, sérialisable ; les caches graphiques n'en font pas partie.
4. Le hasard du jeu passe par un générateur à graine, pour que les parties soient reproductibles et testables.
5. Les sauvegardes sont versionnées et migrées plutôt que cassées.

## Où en est le découpage

Fait :
- données et réglages extraits dans `src/data` et `src/core/constants.ts` ;
- grille hexagonale et hasard extraits dans `src/core`, avec leurs premiers tests ;
- styles séparés de la page, construction en fichier unique avec Vite.

À venir, dans cet ordre, chaque étape gardant le jeu jouable :
1. `core/state.ts` : type de l'état, création, sauvegarde versionnée ;
2. `world/` : génération de l'île, du relief, du port et des sites anciens ;
3. `sim/` : emplois, production, marcheurs, maisons, tribut, commerce, dieux, défense ;
4. `render/` : projection, caches, kit de dessin, terrain, décors, bâtiments, effets ;
5. `ui/` : panneaux, barre d'outils, entrées ;
6. retrait des `@ts-nocheck` et passage progressif en TypeScript strict.
