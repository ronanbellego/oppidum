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
 * Couleurs du terrain : les tons gris-verts et gris-bleus d'une Armorique sous un ciel changeant,
 * reprises de la première version. Seules les plages sont plus claires et plus chaudes.
 */
const TCOL = {
  g: '#7b9467', // prairie
  l: '#7f7a66', // lande
  f: '#4b5a45', // sous-bois
  r: '#8f837d', // sol rocheux
  b: '#e3cb94', // plage, sable blond
  cliff: '#9a8a84', // falaises
};

/* La mer, des hauts-fonds au large, dans les gris-bleus d'origine. L'indice suit la distance à la côte (1 à 9). */
const SEA = ['#5b7c80', '#4e7078', '#46666f', '#3d5a65', '#36525e', '#314b58', '#2e4755', '#2b4553', '#294351', '#284250'];
/* Couleur du large, qui prolonge la mer au-delà de la carte. */
const DEEP = SEA[9];

/* Végétation et rochers posés sur le terrain. */
const VEG = {
  oak: ['#3c4f37', '#435a3b', '#4b5f3a', '#506640', '#3a4a33'],
  trunk: '#5e5040',
  pine: ['#2f4134', '#3a4f3e'],
  gorse: ['#d4b23c', '#c9a33a'],
  heather: ['#8e6c8f', '#7d5f80', '#9a789c'],
  grass: ['#6a8458', '#56704a', '#5d7a4a'],
  flower: ['#e6e2d4', '#d9cf8a'],
  rock: ['#b49c95', '#a8908a', '#c2aaa2'],
  rockDark: '#8f7872',
  floor: ['#4b5a45', '#3e4c38', '#45533d'],
};

/* Le trait de crayon et les hachures de l'ancien style illustré : désactivés dans le style en facettes. */
const OUTLINE = false;
const INK = '#2a241c';

const AC = {
  chaux: '#f3ede1',
  granit: '#d9bdb1',
  granitD: '#b99d93',
  ardoise: '#687c96',
  chaume: '#d9b062',
  bois: '#8e6847',
  boisC: '#b48a5c',
  guede: '#4a7db8',
  ajonc: '#ecc63f',
  bruyere: '#a676aa',
  ocre: '#cc5b3e',
  mousse: '#6ea56f',
  terre: '#b8a07a',
  pave: '#d3c8b6',
  fer: '#7d8896',
  mer: '#4f9aa0',
};

export { WALK, TCOL, SEA, DEEP, VEG, OUTLINE, INK, AC };
