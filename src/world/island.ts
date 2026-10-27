/** Forme de l'île, forêts, rochers et landes. */
import { N } from '../core/constants';
import { idx, X, Y, HX, HY, nb4 } from '../core/hex';
import { noiseField, sample } from './noise';
import { TER, CENTER_X, CENTER_Y } from './terrain';

export interface IslandShape {
  ter: Uint8Array;
  vr: Float32Array;
  lnd: Uint8Array;
  /** « Masse » de l'île en chaque case : plus elle est forte, plus on est au cœur des terres. */
  mass: Float32Array;
}

/** Bande de mer garantie sur le pourtour de la carte, en hexagones. */
export const SEA_MARGIN = 4;

export function shapeIsland(rand: () => number): Omit<IslandShape, 'lnd'> {
  const n1 = noiseField(6, rand), n2 = noiseField(5, rand), n6 = noiseField(5, rand), n7 = noiseField(9, rand);
  const ter = new Uint8Array(N * N), vr = new Float32Array(N * N), mass = new Float32Array(N * N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const i = idx(x, y);
      const dx = (HX(i) - CENTER_X) / (N * 0.5), dy = (HY(i) - CENTER_Y) / (N * 0.866 * 0.5);
      const m = 1.05 - Math.hypot(dx, dy) * 1.12 + (sample(n6, x, y) - 0.5) * 0.62 + (sample(n7, x, y) - 0.5) * 0.22;
      mass[i] = m;
      const f = sample(n1, x, y) + (rand() - 0.5) * 0.1, k = sample(n2, x, y);
      const edge = Math.min(x, y, N - 1 - x, N - 1 - y);
      ter[i] = m < 0.18 || edge < SEA_MARGIN ? TER.sea : f > 0.63 ? TER.forest : k > 0.84 ? TER.rocks : TER.prairie;
      vr[i] = rand();
    }
  return { ter, vr, mass };
}

/** Ne garde que la plus grande terre : les autres deviennent des îlots rocheux ou boisés, ou disparaissent. */
export function keepMainIsland(ter: Uint8Array, rand: () => number): void {
  const seen = new Int32Array(N * N).fill(-1);
  let best = -1, size = 0;
  for (let i = 0; i < N * N; i++) {
    if (ter[i] === TER.sea || seen[i] >= 0) continue;
    const q = [i];
    seen[i] = i;
    for (let h = 0; h < q.length; h++)
      for (const j of nb4(q[h]))
        if (ter[j] !== TER.sea && seen[j] < 0) {
          seen[j] = i;
          q.push(j);
        }
    if (q.length > size) {
      size = q.length;
      best = i;
    }
  }
  for (let i = 0; i < N * N; i++) if (ter[i] !== TER.sea && seen[i] !== best && rand() < 0.5) ter[i] = rand() < 0.5 ? TER.rocks : TER.forest;
}

/** Landes de bruyère et d'ajonc : par plaques à l'intérieur, plus fréquentes près des côtes. */
export function spreadHeath(ter: Uint8Array, mass: Float32Array, rand: () => number): Uint8Array {
  const lnd = new Uint8Array(N * N), n4 = noiseField(5, rand);
  for (let i = 0; i < N * N; i++) {
    if (ter[i] !== TER.prairie) continue;
    if (sample(n4, X(i), Y(i)) > 0.66 || (mass[i] < 0.42 && rand() < 0.6)) lnd[i] = 1;
  }
  return lnd;
}
