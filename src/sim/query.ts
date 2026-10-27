/** Petites requêtes sur l'état, partagées par les systèmes de la simulation. */
import { foot, nb4, within, type Cell } from '../core/hex';
import type { Building, GameState, House } from '../core/state';
import { B } from '../data/buildings';

export const buildings = (s: GameState): Building[] => Object.values(s.b);

export const isHouse = (b: Building): b is House => b.type === 'hut';

export const houses = (s: GameState): House[] => buildings(s).filter(isHouse);

export const tilesOf = (b: Pick<Building, 's' | 'x' | 'y'>): Cell[] => foot(b.s, b.x, b.y) ?? [];

/** Cases de chemin qui touchent un bâtiment : c'est par elles qu'il est desservi. */
export function access(s: GameState, b: Building): Cell[] {
  const t = tilesOf(b), out: Cell[] = [];
  for (const f of t) for (const j of nb4(f)) if (s.road[j] && !t.includes(j) && !out.includes(j)) out.push(j);
  return out;
}

export const monumentDone = (s: GameState, type: string): boolean => buildings(s).some(b => b.type === type && b.done);

/** Postes de travail ouverts par un bâtiment ; un monument achevé n'emploie plus personne. */
export function jobsOf(b: Building): number {
  const d = B[b.type];
  return d.mon && b.done ? 0 : d.jobs ?? 0;
}

/** Vrai si une case du terrain t se trouve à r hexagones au plus de l'emprise. */
export function nearTerrain(s: GameState, b: Pick<Building, 's' | 'x' | 'y'>, t: number, r: number): boolean {
  let ok = false;
  for (const f of tilesOf(b)) within(f, r, j => {
    if (s.ter[j] === t) ok = true;
  });
  return ok;
}
