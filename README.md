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

## Rendu visuel

### Comment il est fait

Tout est dessiné par le code, en Canvas 2D, sans aucun fichier image. Les volumes sont simples et l'ombrage est lissé, sans arête vive, sous un soleil unique venant du nord-ouest ; les couleurs sont les gris-verts et gris-bleus d'une Armorique sous un ciel changeant.

- **Le sol et la mer** (`render/terrain.ts`) forment un maillage continu : chaque case est un anneau de sommets (coins et milieux d'arêtes) relié à un centre, et deux cases voisines partagent exactement la position, la hauteur et la couleur de leurs sommets communs. Il n'y a donc aucun joint entre les cases, et les couleurs se fondent d'un terrain à l'autre. La mer s'assombrit des hauts-fonds au large selon la distance à la côte. Chaque sommet reçoit l'éclairage moyen des triangles qui le touchent, et la couleur se fond d'un sommet à l'autre ; le sol est ensuite légèrement flouté, ce qui efface les dernières arêtes. Ce tapis est peint par blocs de 8 × 8 cases (avec deux rangs de voisines pour que le flou se raccorde sans couture), recopiés à chaque image et repeints seulement quand un chemin, un bâtiment ou un rempart change dans le bloc.
- **La netteté** suit le zoom : blocs et petites images sont peints à la densité de pixels réellement affichée (zoom × densité de l'écran), par paliers. Au changement de palier, l'ancienne version reste à l'écran le temps de repeindre, dans la limite de quelques millisecondes par image, et les blocs gardés en mémoire sont plafonnés.
- **Les bâtiments** (`render/buildings.ts`) passent en trois couches : le sol (terre battue, champs) d'abord, puis l'ombre portée, calculée en rabattant chaque point du volume au sol à l'opposé du soleil (`A.SHADOW` dans `projection.ts`), enfin le volume lui-même.
- **Arbres, rochers, ajoncs** (`render/decor.ts`) sont des volumes arrondis éclairés en dégradé (`gem` dans `render/kit.ts`) ; les toits coniques et les murs ronds sont lissés de la même façon. Les trois sites des anciens (grand menhir, dolmen, chêne des anciens) gardent une taille hors d'échelle pour se repérer de loin ; on ne peut rien y bâtir.
- **La grille** n'est plus visible par défaut. Le bouton « Grille » de la barre des vues, ou la touche G, l'affiche ou la masque ; le choix est gardé dans le navigateur.
- **Les couleurs** sont réunies dans `data/palette.ts` : celles de la première version, avec un sable plus clair et plus chaud, et le voile gris-bleu du ciel couvert. L'ancien trait de crayon et ses hachures restent dans le code, désactivés par `OUTLINE = false`.

### Défauts relevés en octobre 2026, et ce qui a été fait

Les captures « avant » et « après » sont dans `docs/rendu/`. Les huit défauts ci-dessous ont été traités dans la branche `rendu-facettes` : sol continu et grille à la demande (1), style unifié, sans trait de crayon, à l'ombrage lissé (2), personnages, arbres et rochers ramenés à l'échelle des maisons (3), palette d'origine conservée, plages éclaircies (4), ombres portées et sols de bâtiments plus discrets (5), variantes plus nombreuses, forêts aérées et champs d'un seul tenant (6), chemins en courbes de terre battue (7), netteté à tous les zooms (8).

1. **La grille domine l'image.** Chaque case est un hexagone arrondi, rentré de 4,5 % (`INS`) sur une sous-couche sombre, si bien qu'un joint apparaît même entre deux cases de prairie. Le sol ressemble à un dallage plutôt qu'à un paysage. Les facettes partent toutes du centre de la case : chaque hexagone forme une petite pyramide, ce qui se voit surtout sur les plages et en mer.
2. **Deux styles cohabitent.** Le terrain est en facettes sans contour, alors que les arbres, les rochers, les bâtiments et les personnages ont un trait sombre et un dessin d'illustration. L'œil lit deux jeux posés l'un sur l'autre.
3. **Les échelles ne s'accordent pas.** Un habitant fait la moitié de la hauteur d'une hutte, un arbre de forêt dépasse une maison, le grand menhir est plus haut que les tours de guet et les rochers ont la taille des huttes.
4. **Les couleurs sont ternes.** La palette du terrain (`data/palette.ts`) est grise et peu saturée, la lande gris-brun est semée de points violets et jaunes qui font l'effet de confettis, et un calque bleuté appliqué en multiplication sur toute la scène refroidit encore l'ensemble.
5. **Les bâtiments ne projettent pas d'ombre au sol** (seuls les arbres, les rochers et le menhir en ont une) et reposent sur des aplats beiges qui reprennent exactement le contour des cases.
6. **Le décor se répète.** Trois ou quatre variantes par élément, des forêts faites de bosquets identiques en masse compacte, des champs de blé qui épousent chaque hexagone.
7. **Les chemins paraissent plaqués** : bandes grises uniformes tracées de centre à centre, avec un nœud hexagonal à chaque case, des tracés en zigzag et une couleur proche de celle de la pierre.
8. **Le terrain devient flou quand on zoome.** Les blocs sont peints à 1,3 fois la résolution (1,6 sur écran haute densité) et les petites images à 2 ou 3 fois, alors que le zoom monte jusqu'à 2,4. Au-delà d'un zoom de 1,3 environ, le sol perd sa netteté, et plus encore sur un écran Retina.

### Démarche d'amélioration

1. **Constituer un moodboard** : jeux de référence (Townscaper, Islanders, Bad North, Dorfromantik pour la grille hexagonale, Northgard pour l'ambiance), photos de la côte morbihannaise, reconstitutions archéologiques de maisons gauloises, couleurs des landes et des marais.
2. **Rédiger une courte bible visuelle** : palette limitée (une douzaine de couleurs), direction du soleil, angle de vue, échelle d'un habitant par rapport à une maison, présence ou non d'un contour, niveau de détail admis. Elle se traduit directement en constantes dans `data/palette.ts` et `render/projection.ts`.
3. **Faire un test comparatif sur une seule scène** : une tuile de terrain, une maison, un bout de côte, réalisés selon deux voies, puis comparés côte à côte en situation de jeu, à partir des captures de `docs/rendu/`.
4. **Choisir la voie et produire en série** à partir de la bible, en vérifiant la cohérence sur une vue d'ensemble de la cité plutôt que bâtiment par bâtiment.
5. **Finir par l'ambiance** : post-traitement, brume, goélands, animation de l'eau. Cette dernière couche donne beaucoup de vie, mais elle ne rattrape pas une base incohérente.

Les voies possibles, de la moins à la plus coûteuse :

- **A. Améliorer le dessin par code** : terrain continu sans joint entre cases identiques, éclairage calculé à partir d'un soleil unique pour toutes les faces, palette resserrée, ombres portées, variations de taille et de teinte, peinture des blocs à la résolution réelle de l'écran. Passer à PixiJS (WebGL) apporterait l'anticrénelage et des filtres de post-traitement.
- **B. Passer à une vraie 3D low-poly avec Three.js** : caméra orthographique en vue isométrique, ombrage plat, lumière, ombres et cycle jour-nuit gérés par le moteur. C'est la voie la plus naturelle pour un style en facettes.
- **C. Pré-rendre des modèles 3D en images** : modélisation et éclairage dans Blender (éventuellement à partir de modèles générés par Meshy, Tripo ou Hunyuan3D), export en atlas PNG. Le jeu reste en 2D, avec une cohérence visuelle excellente.
- **D. Générer des images 2D par IA** : rapide pour l'exploration, difficile à rendre cohérent sans un modèle entraîné sur le style du jeu (Scenario, par exemple). Vérifier les droits d'usage commercial de chaque outil.

Premières corrections, faisables dans la voie A sans rien jeter : supprimer les joints entre cases de même terrain, peindre les blocs à la résolution `zoom × devicePixelRatio`, donner une ombre portée aux bâtiments, choisir entre contour et absence de contour pour tout le monde, corriger les échelles, puis retravailler la palette.
