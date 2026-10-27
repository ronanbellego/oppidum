# Oppidum

Jeu de gestion de cité vénète en Armorique, dans l'esprit de *Caesar*, *Zeus* et *Emperor* : une île hexagonale, un port, des huttes qui deviennent des demeures nobles, des chaînes de production, des dieux et des raids venus de la mer.

## Commandes

```bash
npm install        # une fois
npm run dev        # serveur de développement avec rechargement instantané
npm run build      # produit dist/index.html, un fichier unique autonome
npm test           # tests de la simulation et de la grille
npm run typecheck  # vérification TypeScript
npm run artifact   # produit dist/artifact.html, la version publiée en artefact Claude
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
    rng.ts            hasard décoratif à graine et hasard reproductible de la simulation
    state.ts          type de l'état d'une partie (GameState) et de ses grilles
    save.ts           sauvegarde versionnée, encodage compact, migrations
    storage.ts        où la sauvegarde est rangée (navigateur, mémoire pour les tests)
  world/              génération de l'île, fonction pure de la graine
    generate.ts       enchaîne les étapes et renvoie l'île complète (World)
    island.ts         forme de l'île, forêts, rochers, landes
    relief.ts         altitude et adoucissement des pentes
    port.ts           emplacement du port, quai, route de départ
    landmarks.ts      grand menhir, dolmen, chêne des anciens
    terrain.ts        codes de terrain, profondeur de la mer, distance à la côte
    noise.ts          bruit de valeur lissé
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
tools/artifact.mjs    prépare la version construite pour la publication en artefact
```

## Règles d'architecture

1. Les dépendances vont dans un seul sens : `data` et `core` → `world` et `sim` → `render` → `ui`.
2. La simulation ne dessine rien, et l'affichage ne modifie jamais l'état du jeu.
3. Tout l'état d'une partie vit dans un objet unique, sérialisable ; les caches graphiques n'en font pas partie.
4. Le hasard du jeu passe par un générateur à graine, pour que les parties soient reproductibles et testables.
5. Les sauvegardes sont versionnées et migrées plutôt que cassées.

## Sauvegardes

Une sauvegarde est une enveloppe JSON `{ format, version, savedAt, state, cam }`. Les grilles de la carte y sont encodées en base64.
Quand le format change, on incrémente `SAVE_VERSION` dans `src/core/save.ts` et on ajoute une migration de l'ancienne version vers la nouvelle,
plutôt que de rendre les parties existantes illisibles. Les sauvegardes de l'ancienne version mono-fichier (format 2) sont reprises automatiquement.

Le hasard de la simulation est tiré d'un état (`rs`) stocké dans la partie : une partie rechargée se poursuit exactement comme elle l'aurait fait.

## Où en est le découpage

Fait :
- données et réglages extraits dans `src/data` et `src/core/constants.ts` ;
- grille hexagonale et hasard extraits dans `src/core`, avec leurs premiers tests ;
- styles séparés de la page, construction en fichier unique avec Vite ;
- état typé, sauvegarde versionnée avec migrations, stockage interchangeable, hasard reproductible (`core/state.ts`, `save.ts`, `storage.ts`) ;
- génération de l'île typée et testée dans `world/` ; la grille hexagonale `core/hex.ts` est typée.

L'ordre des tirages au hasard dans `world/generate.ts` fixe la forme des îles : le modifier change l'île obtenue pour une graine donnée.

À venir, dans cet ordre, chaque étape gardant le jeu jouable :
1. `sim/` : emplois, production, marcheurs, maisons, tribut, commerce, dieux, défense ;
2. `render/` : projection, caches, kit de dessin, terrain, décors, bâtiments, effets ;
3. `ui/` : panneaux, barre d'outils, entrées ;
4. retrait des `@ts-nocheck` et passage progressif en TypeScript strict.
