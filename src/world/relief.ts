/** Relief : huit niveaux, plus hauts au cœur de l'île et sur les rochers, pentes d'un niveau au plus entre voisins. */
import { N } from '../core/constants';
import { X, Y, nb4, hdist, type Cell } from '../core/hex';
import { noiseField, sample } from './noise';
import { TER } from './terrain';

export const MAX_HEIGHT = 7;

export function raiseRelief(ter: Uint8Array, mass: Float32Array, port: Cell, rand: () => number): Uint8Array {
  const n5 = noiseField(4, rand), hgt = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) {
    if (ter[i] === TER.sea) continue;
    let h = sample(n5, X(i), Y(i)) * 4.5 + (mass[i] - 0.2) * 7 + (ter[i] === TER.rocks ? 2.5 : 0) + (ter[i] === TER.forest ? 0.8 : 0) - 1.4;
    if (nb4(i).some(j => ter[j] === TER.sea) && rand() < 0.4) h = Math.max(h, 3);
    if (port >= 0 && hdist(i, port) <= 6) h = Math.min(h, 1 + hdist(i, port) * 0.35);
    hgt[i] = Math.max(0, Math.min(MAX_HEIGHT, Math.round(h)));
  }
  smoothSlopes(ter, hgt);
  return hgt;
}

/** Abaisse les cases qui dominent tous leurs voisins de plus d'un niveau. */
export function smoothSlopes(ter: Uint8Array, hgt: Uint8Array): void {
  for (let it = 0; it < 8; it++)
    for (let i = 0; i < N * N; i++) {
      if (ter[i] === TER.sea) continue;
      let m = 9;
      for (const j of nb4(i)) if (ter[j] !== TER.sea) m = Math.min(m, hgt[j]);
      if (hgt[i] > m + 1) hgt[i] = m + 1;
    }
}
