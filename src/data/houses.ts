import type { HouseLevel } from './types';

/** Niveaux de maison, de 1 (hutte) à 4 (demeure noble). L'indice 0 est inutilisé. */
export const LV: [null, ...HouseLevel[]] = [
  null,
  { n: 'Hutte', cap: 5, tax: 0.6 },
  { n: 'Maison de torchis', cap: 10, tax: 1 },
  { n: 'Longue maison', cap: 16, tax: 1.5 },
  { n: 'Demeure noble', cap: 24, tax: 2.4 },
];
