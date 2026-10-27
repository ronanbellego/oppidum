# Oppidum

Jeu de gestion de cité vénète en Armorique, dans l'esprit de *Caesar*, *Zeus* et *Emperor* : une île hexagonale, un port, des huttes qui deviennent des demeures nobles, des chaînes de production, des dieux et des raids venus de la mer.

## Commandes

```bash
npm install        # une fois
npm run dev        # serveur de développement avec rechargement instantané
npm run build      # produit dist/index.html, un fichier unique autonome
npm test           # tests de la simulation et de la grille
npm run typecheck  # vérification TypeScript
npm run check      # typage, tests et construction, à lancer avant chaque commit
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
  sim/                systèmes de la simulation, fonctions de l'état sans dessin
    query.ts          requêtes partagées : bâtiments, maisons, emprise, desserte, postes
    labor.ts          main-d'œuvre par priorité, rations, salaires
    tax.ts            tribut : barème, taux, accumulation, collecte, bonus du tumulus
    housing.ts        besoins des maisons, montée et descente de niveau, rations, faim
    stock.ts          greniers et entrepôts, dépôt le plus proche, panier de la marchande
    production.ts     ateliers : rythme selon les ouvriers, matières premières, lots à livrer
    paths.ts          recherche de trajet sur les chemins
    walkers.ts        marcheurs : tournées, service des maisons, marchande, porteurs
    migration.ts      arrivée des familles par le port, et ce qui la freine
    gods.ts           Toutatis et la foudre de Taranis, faveurs des temples, bienfaits, fête
    trade.ts          commerce maritime : liaison du port, ventes au-delà de la réserve
    defense.ts        pillards, guerriers, tours, remparts, calendrier des raids
    monuments.ts      chantiers des monuments et leur achèvement
    context.ts        ce que la simulation demande au jeu (hasard, chronique, effets)
    buildings.ts      un pas pour un bâtiment selon sa nature, envoi des porteurs
    construction.ts   poser, tracer, démolir, créer une partie
    objectives.ts     objectifs et victoire
    tick.ts           la boucle : un pas, la fin du mois, l'ordre des systèmes
  data/               ce qui se règle sans toucher à la logique
    buildings.ts      définition des bâtiments et de la barre d'outils
    resources.ts      ressources et prix
    houses.ts         niveaux de maison et tribut
    labor.ts          priorités d'emploi par secteur
    types.ts          types des définitions (bâtiments, niveaux de maison, ressources)
    calendar.ts       mois du calendrier de Coligny
    palette.ts        couleurs d'Armorique
  app/                ce qui relie la simulation à l'écran
    dom.ts            canevas et accès aux éléments de la page
    state.ts          état de l'affichage (caméra, outil, sélection, caches), partagé entre modules
    game.ts           partie en cours, journal, messages, sauvegarde et chargement
  render/             dessin : ne modifie jamais la partie
    projection.ts     projection de la grille hexagonale à l'écran, profondeur
    kit.ts            facettes, ombrage, trait de crayon, caches de sprites
    terrain.ts        relief continu, mer, littoral, blocs de terrain en cache
    decor.ts          forêts, rochers, lande, sites anciens
    buildings.ts      bâtiments en facettes
    units.ts          marcheurs, pillards, guerriers, navires, remparts
    fx.ts             effets passagers (foudre, flammes, fumée)
    overlays.ts       vues de couverture (eau, marché, culte, bardes, tribut)
    renderer.ts       assemblage d'une image
  ui/                 interface
    panels.ts         barre du haut, fiches, panneau de droite, barre d'outils
    input.ts          souris, tactile, clavier, caméra
    loop.ts           boucle d'animation et démarrage
tests/                tests Vitest
tools/split.mjs       script qui a produit le premier découpage à partir de la version mono-fichier
tools/split-render.mjs script qui a découpé l'affichage et l'interface
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
- génération de l'île typée et testée dans `world/` ; la grille hexagonale `core/hex.ts` est typée ;
- `sim/` complet : toute la simulation (emplois, tribut, maisons, stocks, production, marcheurs, migrants, dieux, commerce, défense, monuments, construction, boucle) est typée, testée et tourne sans écran ; des parties de plusieurs années sont jouées dans les tests et vérifiées reproductibles, y compris après une sauvegarde ; définitions des bâtiments, maisons, ressources et priorités typées ;
- affichage et interface découpés en modules (`app/`, `render/`, `ui/`) ; le fichier mono-bloc a disparu.

L'ordre des tirages au hasard dans `world/generate.ts` fixe la forme des îles : le modifier change l'île obtenue pour une graine donnée.

À venir, dans cet ordre, chaque étape gardant le jeu jouable :
1. typer `render/` et `ui/` module par module, en retirant les `@ts-nocheck` ;
2. réduire l'objet partagé `app/state.ts` : chaque cache rejoint le module qui l'utilise ;
3. passer progressivement en TypeScript strict.
