// @ts-nocheck — extrait tel quel de la version mono-fichier ; à typer progressivement.

const WALK = {
  priest: '#ddd',
  market: '#d9a24a',
  druid: '#efeee6',
  bard: '#c0583f',
  tax: '#6a8cc4',
  immigrant: '#a59a88',
  cart: '#7b5a38',
};

/*
 * Couleurs du terrain : prairie lumineuse, lande d'ajoncs jaune-orangé, sous-bois de chênes, granit gris,
 * plages blondes. Chaque facette en dérive par un léger écart de ton, calculé d'après le soleil.
 */
const TCOL = {
  g: '#86b24f', // prairie
  l: '#c9a650', // lande : terre chaude sous les ajoncs
  f: '#4c7f38', // sous-bois des forêts de chênes
  r: '#9c9f9d', // sol rocheux, granit
  b: '#e8c27c', // plage
  cliff: '#a19c96', // falaises de granit
};

/* La mer, des hauts-fonds turquoise au grand large. L'indice suit la distance à la côte (1 à 9). */
const SEA = ['#4cb3c6', '#3d9ec0', '#2e86b5', '#2470a8', '#1e5f9b', '#1a528e', '#174886', '#15417f', '#143d79', '#133a75'];
/* Couleur du large, qui prolonge la mer au-delà de la carte. */
const DEEP = SEA[9];

/* Végétation et rochers posés sur le terrain. */
const VEG = {
  oak: ['#4f8f3a', '#5a9b40', '#468638', '#3f7a34', '#62a344'],
  trunk: '#6b5440',
  pine: ['#2f6a45', '#377552'],
  gorse: ['#f2c230', '#f0b02c', '#e8952e'],
  heather: ['#b46aa8', '#9d5c99'],
  grass: ['#77a845', '#93bd55', '#6c9c3f'],
  flower: ['#f4e9c8', '#f2d35c'],
  rock: ['#b4b8b5', '#a5aaa8', '#c2c4c0'],
  rockDark: '#878c8c',
  floor: ['#4c7f38', '#5a8c3e', '#426f33'],
};

/* Le trait de crayon et les hachures de l'ancien style illustré : désactivés dans le style en facettes. */
const OUTLINE = false;
const INK = '#2a241c';

const AC = {
  chaux: '#f6f1e6',
  granit: '#cfc6be',
  granitD: '#aca39b',
  ardoise: '#5f7896',
  chaume: '#e2b65c',
  bois: '#8e6847',
  boisC: '#b88c5a',
  guede: '#3d78c2',
  ajonc: '#f2c230',
  bruyere: '#b46aa8',
  ocre: '#d65a36',
  mousse: '#6ea56f',
  terre: '#c2a46c',
  pave: '#d8cdb8',
  fer: '#7d8896',
  mer: '#4f9aa0',
};

export { WALK, TCOL, SEA, DEEP, VEG, OUTLINE, INK, AC };
