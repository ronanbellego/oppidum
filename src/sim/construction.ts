/** Construction : poser un bâtiment, tracer un chemin, démolir, et créer une nouvelle partie. */
import { N } from '../core/constants';
import { X, Y, foot, idx, type Cell } from '../core/hex';
import type { Building, GameState } from '../core/state';
import { B } from '../data/buildings';
import { generateWorld, type World } from '../world/generate';
import { TER } from '../world/terrain';
import type { SimCtx } from './context';
import { fields } from './defense';
import { assignLabor } from './labor';
import { entryOf } from './migration';
import { nearTerrain, tilesOf } from './query';
import { killWalker } from './walkers';
import { NEAR_RANGE } from './production';

/** Solidité d'un bâtiment par case d'emprise, et provisions déposées dans le premier grenier. */
export const HP_PER_TILE = 40;
export const FIRST_GRANARY_WHEAT = 80;
export const START_MONEY = 1500;

/** Raison pour laquelle on ne peut pas bâtir ici, ou chaîne vide si c'est possible. */
export function canPlace(s: GameState, type: string, x: number, y: number): string {
  const d = B[type];
  const ft = foot(d.s ?? 1, x, y);
  if (!ft) return 'Hors de la carte';
  for (const k of ft) {
    if (s.occ[k] || s.road[k] || s.wall[k]) return 'Emplacement occupé';
    if (s.deco[k]) return 'Un monument des anciens occupe cette case';
    if (s.ter[k] !== TER.prairie)
      return s.ter[k] === TER.sea ? "On ne bâtit pas sur l'eau" : s.ter[k] === TER.forest ? "Il faut d'abord défricher (un chemin coupe la forêt)" : 'Rochers impraticables';
  }
  const at = { x, y, s: (d.s ?? 1) as 1 | 2 | 3 };
  if (d.near === 'forest' && !nearTerrain(s, at, TER.forest, NEAR_RANGE.forest)) return 'Il faut une forêt à 2 cases';
  if (d.near === 'rock' && !nearTerrain(s, at, TER.rocks, NEAR_RANGE.rock)) return 'La mine doit toucher des rochers';
  if (s.money < (d.cost ?? 0)) return 'Pas assez de statères';
  return '';
}

/** Pose un bâtiment s'il le peut. Le terrain est aplani sous l'emprise. */
export function placeBuilding(s: GameState, type: string, x: number, y: number, ctx: Pick<SimCtx, 'log' | 'toast'>): Building | null {
  const why = canPlace(s, type, x, y);
  if (why) {
    ctx.toast(why);
    return null;
  }
  const d = B[type], size = (d.s ?? 1) as 1 | 2 | 3;
  s.money -= d.cost ?? 0;
  const b: Building = { id: s.nid++, type, x, y, s: size, prog: 0, hold: 0, cartOut: false, out: false, cool: 8, loaded: false, status: '', stock: {}, hp: 0, maxhp: 0 };
  if (type === 'hut') Object.assign(b, { pop: 0, inc: 0, lvl: 1, food: { ble: 0, porc: 0 }, cerv: 0, torq: 0, relig: -99, ent: -99, lastTax: -1, bad: 0, hungry: 0, has: {} });
  b.maxhp = b.hp = HP_PER_TILE * size * size;
  if (d.mon) Object.assign(b, { got: {}, done: false, cool: 5 });
  fields.fe = null;
  s.b[b.id] = b;
  const h0 = s.hgt[idx(x, y)];
  for (const t of tilesOf(b)) {
    s.occ[t] = b.id;
    s.hgt[t] = h0;
  }
  s.hver = (s.hver ?? 0) + 1;
  if (type === 'granary' && !s.flags.g1) {
    s.flags.g1 = 1;
    b.stock.ble = FIRST_GRANARY_WHEAT;
    ctx.log(`Le clan dépose ses provisions au premier grenier : ${FIRST_GRANARY_WHEAT} blé.`);
  }
  assignLabor(s);
  return b;
}

/** Retire un bâtiment ; le port ne peut pas l'être. Les marcheurs qui en dépendaient disparaissent. */
export function removeBuilding(s: GameState, id: number): boolean {
  const b = s.b[id];
  if (!b || b.type === 'port') return false;
  fields.fe = null;
  for (const t of tilesOf(b)) s.occ[t] = 0;
  delete s.b[id];
  for (const w of s.w) if (w.home === id || w.target === id) killWalker(s, w);
  return true;
}

/** Coût d'un chemin selon le terrain : prairie, forêt à défricher, pont ; -1 sur les rochers. */
export function roadCost(s: GameState, i: Cell): number {
  const t = s.ter[i];
  return t === TER.prairie ? 2 : t === TER.forest ? 4 : t === TER.sea ? 20 : -1;
}

export function buildRoad(s: GameState, cells: Cell[], ctx: Pick<SimCtx, 'toast'>): void {
  let blocked = false;
  for (const i of cells) {
    if (s.road[i] || s.occ[i] || s.wall[i] || s.deco[i]) continue;
    const c = roadCost(s, i);
    if (c < 0) {
      blocked = true;
      continue;
    }
    if (s.money < c) {
      ctx.toast('Pas assez de statères');
      break;
    }
    s.money -= c;
    if (s.ter[i] === TER.forest) s.ter[i] = TER.prairie;
    s.road[i] = 1;
  }
  s.hver = (s.hver ?? 0) + 1;
  if (blocked) ctx.toast('Les rochers bloquent le chemin');
}

/** Démolit tout dans le rectangle de a à c : bâtiments, remparts, puis chemins (sauf l'entrée). */
export function demolishArea(s: GameState, a: Cell, c: Cell, remove: (id: number) => void = id => removeBuilding(s, id)): void {
  s.hver = (s.hver ?? 0) + 1;
  const x0 = Math.min(X(a), X(c)), x1 = Math.max(X(a), X(c)), y0 = Math.min(Y(a), Y(c)), y1 = Math.max(Y(a), Y(c));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const i = idx(x, y);
      if (s.occ[i]) remove(s.occ[i]);
      else if (s.wall[i]) {
        s.wall[i] = 0;
        fields.fe = null;
      } else if (s.road[i] && i !== entryOf(s)) s.road[i] = 0;
    }
}

/** Crée une partie neuve sur l'île de la graine donnée, avec son port déjà posé. */
export function createGame(seed: number, world: World = generateWorld(seed)): GameState {
  const s: GameState = {
    seed, rs: (seed | 0) ^ 0x5bd1e995, ter: world.ter, vr: world.vr, lnd: world.lnd, hgt: world.hgt,
    road: new Uint8Array(N * N), occ: new Int32Array(N * N), wall: new Uint8Array(N * N), whp: new Float32Array(N * N), deco: new Uint8Array(N * N),
    b: {}, nid: 1, w: [], u: [], money: START_MONEY, tick: 0, mi: 0, favor: 50, logs: [],
    sell: { bois: false, fer: false, cervoise: false, torques: false, ble: false, porc: false },
    won: false, flags: {}, eff: 0, labor: 0, jobs: 0, pop: 0, unemp: 0, taxM: 0, lastTaxM: 0, hungry: 0, tradeOK: false, lastBal: 0,
    gf: { taranis: 35, belenos: 35, epona: 35 }, raidNext: 30, raid: 0,
  };
  fields.fe = fields.fw = null;
  const silent = { log: () => {}, toast: () => {} };
  if (world.port && !placeBuilding(s, 'port', world.port.x, world.port.y, silent)) throw new Error("Le port prévu n'a pas pu être posé.");
  s.road = world.road;
  s.deco = world.deco;
  s.dock = world.dock;
  if (world.entry >= 0) s.entry = world.entry;
  s.money = START_MONEY;
  s.hver = (s.hver ?? 0) + 1;
  return s;
}
