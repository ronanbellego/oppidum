/** Déplacements sur le réseau de chemins. */
import { N } from '../core/constants';
import { nb4, type Cell } from '../core/hex';
import type { GameState } from '../core/state';

export const roadNb = (s: GameState, i: Cell): Cell[] => nb4(i).filter(j => s.road[j]);

/**
 * Recherche en largeur sur les chemins depuis start. goal renvoie une valeur non nulle (par exemple
 * l'identifiant d'un bâtiment) quand la case convient. Renvoie le chemin parcouru et cette valeur.
 */
export function roadSearch<T>(s: GameState, start: Cell, goal: (i: Cell) => T | 0 | false | null | undefined): { path: Cell[]; val: T } | null {
  const prev = new Int32Array(N * N).fill(-2);
  prev[start] = -1;
  const q = [start];
  for (let h = 0; h < q.length; h++) {
    const i = q[h], g = goal(i);
    if (g) {
      const path: Cell[] = [];
      for (let k = i; k !== -1; k = prev[k]) path.push(k);
      return { path: path.reverse(), val: g };
    }
    for (const j of roadNb(s, i))
      if (prev[j] === -2) {
        prev[j] = i;
        q.push(j);
      }
  }
  return null;
}
