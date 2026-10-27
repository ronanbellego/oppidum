/** Les trois sites anciens : un grand menhir, un dolmen et le chêne des anciens. */
import { N } from '../core/constants';
import { nb4, hdist, type Cell } from '../core/hex';
import { TER } from './terrain';

export const LANDMARK = { menhir: 1, dolmen: 2, oak: 3 } as const;
/** Distance minimale au port et entre deux sites, en hexagones. */
export const LANDMARK_FROM_PORT = 7;
export const LANDMARK_SPACING = 6;

export interface LandmarkInput {
  ter: Uint8Array;
  lnd: Uint8Array;
  hgt: Uint8Array;
  road: Uint8Array;
  occupied: (i: Cell) => boolean;
  focus: Cell;
}

/**
 * Place chaque site sur la case libre qui lui convient le mieux, loin du port et des autres sites :
 * le menhir sur une hauteur, le dolmen dans la lande, le chêne en lisière de forêt.
 */
export function placeLandmarks(w: LandmarkInput, rand: () => number): { deco: Uint8Array; sites: Cell[] } {
  const deco = new Uint8Array(N * N), sites: Cell[] = [];
  const ok = (i: Cell) =>
    w.ter[i] === TER.prairie && !w.road[i] && !w.occupied(i) && nb4(i).length === 6 && nb4(i).every(j => w.ter[j] !== TER.sea) &&
    hdist(i, w.focus) >= LANDMARK_FROM_PORT && sites.every(o => hdist(o, i) >= LANDMARK_SPACING);
  const scores: [number, (i: Cell) => number][] = [
    [LANDMARK.menhir, i => (w.hgt[i] || 0) * 3],
    [LANDMARK.dolmen, i => (w.lnd[i] ? 4 : 0) + (w.hgt[i] || 0)],
    [LANDMARK.oak, i => nb4(i).filter(j => w.ter[j] === TER.forest).length * 2],
  ];
  for (const [type, score] of scores) {
    let best = -1, bs = -1e9;
    for (let i = 0; i < N * N; i++) {
      if (!ok(i)) continue;
      const v = score(i) + rand() * 2;
      if (v > bs) {
        bs = v;
        best = i;
      }
    }
    if (best >= 0) {
      deco[best] = type;
      sites.push(best);
    }
  }
  return { deco, sites };
}
