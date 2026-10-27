/** Codes de terrain et petites mesures sur la carte. */
import { N } from '../core/constants';
import { nb4, type Cell } from '../core/hex';

export const TER = { prairie: 0, forest: 1, sea: 2, rocks: 3 } as const;

/** Centre de l'île dans le plan. */
export const CENTER_X = N / 2;
export const CENTER_Y = (N * 0.866) / 2;

/**
 * Profondeur de la mer : 1 pour l'eau qui touche la terre, puis +1 par case vers le large.
 * Les cases de terre valent 0.
 */
export function seaDepth(ter: Uint8Array): Uint8Array {
  const dep = new Uint8Array(N * N);
  const q: Cell[] = [];
  for (let i = 0; i < N * N; i++)
    if (ter[i] === TER.sea && nb4(i).some(j => ter[j] !== TER.sea)) {
      dep[i] = 1;
      q.push(i);
    }
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    for (const j of nb4(i))
      if (ter[j] === TER.sea && !dep[j]) {
        dep[j] = Math.min(9, dep[i] + 1);
        q.push(j);
      }
  }
  for (let i = 0; i < N * N; i++) if (ter[i] === TER.sea && !dep[i]) dep[i] = 9;
  return dep;
}

/** Distance de chaque case à la mer, en hexagones (0 pour la mer, plafonnée à 98). */
export function landDistance(ter: Uint8Array): Uint8Array {
  const ld = new Uint8Array(N * N).fill(99);
  const q: Cell[] = [];
  for (let i = 0; i < N * N; i++)
    if (ter[i] === TER.sea) {
      ld[i] = 0;
      q.push(i);
    }
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    for (const j of nb4(i))
      if (ld[j] === 99) {
        ld[j] = Math.min(98, ld[i] + 1);
        q.push(j);
      }
  }
  return ld;
}
