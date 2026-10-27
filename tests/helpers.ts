/** Petit village de test : une carte vide, des bâtiments posés à la main, desservis ou non par un chemin. */
import { emptyGrids, type Building, type GameState, type House } from '../src/core/state';
import { foot, nb4, idx } from '../src/core/hex';
import { B } from '../src/data/buildings';

export function blankState(extra: Partial<GameState> = {}): GameState {
  return {
    ...emptyGrids(), seed: 1, rs: 1, tick: 0, mi: 0, money: 1000, nid: 1, b: {}, w: [], u: [], logs: [], flags: {},
    favor: 50, gf: { taranis: 35, belenos: 35, epona: 35 }, sell: {}, won: false, ...extra,
  };
}

let nextX = 4;
/** Pose un bâtiment sur une rangée libre ; road = true lui ajoute un chemin au contact. */
export function addBuilding<T extends Building = Building>(s: GameState, type: string, opts: Partial<T> & { road?: boolean } = {}): T {
  const size = (B[type].s ?? 1) as 1 | 2 | 3;
  const x = opts.x ?? nextX, y = opts.y ?? 10;
  nextX = x + 5;
  if (nextX > 40) nextX = 4;
  const { road = true, ...rest } = opts;
  const b = { id: s.nid++, type, x, y, s: size, hp: 40, maxhp: 40, stock: {}, ...rest } as unknown as T;
  s.b[b.id] = b;
  const tiles = foot(size, x, y)!;
  for (const t of tiles) s.occ[t] = b.id;
  if (road) {
    const r = tiles.flatMap(t => nb4(t)).find(j => !tiles.includes(j) && !s.occ[j])!;
    s.road[r] = 1;
  }
  return b;
}

export function addHouse(s: GameState, pop: number, lvl: 1 | 2 | 3 | 4 = 1, extra: Partial<House> = {}): House {
  return addBuilding<House>(s, 'hut', { pop, lvl, inc: 0, lastTax: -1, road: false, ...extra } as Partial<House>);
}

export const at = idx;
