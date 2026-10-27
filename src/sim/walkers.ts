/**
 * Marcheurs. Ceux qui partent en tournée (marchande, druide, prêtre, barde, collecteur) errent sur les chemins
 * en préférant les cases qu'ils n'ont pas encore vues, servent les maisons à deux hexagones, puis rentrent
 * par le plus court chemin. Porteurs et migrants suivent un trajet fixé à l'avance.
 */
import { MAXSTEP, WS } from '../core/constants';
import { X, Y, idx, inb, hdist } from '../core/hex';
import type { GameState, Walker } from '../core/state';
import { B } from '../data/buildings';
import { LV } from '../data/houses';
import type { HouseStock } from './housing';
import { rations } from './labor';
import { roadNb, roadSearch } from './paths';
import { access, isHouse } from './query';
import { freeFor, putAny } from './stock';
import { collectTax } from './tax';

export interface WalkerCtx {
  rand: () => number;
  /** Appelé à chaque case atteinte ; l'affichage s'en sert pour les vues de couverture. */
  onVisit?: (w: Walker) => void;
}

/** Marcheurs qui servent les maisons sur leur passage. */
export const SERVICE: ReadonlySet<Walker['k']> = new Set(['market', 'druid', 'bard', 'tax', 'priest']);
/** Portée du service, en hexagones. */
export const SERVE_RANGE = 2;
/** Pas d'attente d'un bâtiment après le retour de son marcheur. */
export const TOUR_COOLDOWN = 30;
/** Ce qu'une marchande donne au plus : vivres par ration, cervoise et torques. */
export const MARKET_GIVE = { perRation: 6, cervoise: 3, torques: 2 } as const;

export function spawnWalker(s: GameState, w: Walker, ctx: WalkerCtx): Walker {
  w.t = 0;
  w.prev = -1;
  w.steps = 0;
  w.seen = {};
  s.w.push(w);
  if (w.path) {
    w.pi = 0;
    w.cur = w.path[0];
    if (w.path.length === 1) {
      w.nxt = w.cur;
      arrive(s, w);
    } else w.nxt = w.path[1];
  } else {
    w.cur = w.nxt = w.start!;
    serve(s, w);
    ctx.onVisit?.(w);
    decide(s, w, ctx);
  }
  return w;
}

/** Fait disparaître un marcheur et remet en ordre ce qui dépendait de lui. */
export function killWalker(s: GameState, w: Walker): void {
  if (w.dead) return;
  w.dead = true;
  const h = s.b[w.home];
  if (w.k === 'cart' && h) h.cartOut = false;
  if (w.k === 'immigrant') {
    const t = s.b[w.target!] as HouseStock | undefined;
    if (t) t.inc = Math.max(0, t.inc - w.amt!);
  }
  if (SERVICE.has(w.k) && h) {
    h.out = false;
    h.cool = TOUR_COOLDOWN;
  }
  if (w.k === 'market' && w.carry) for (const r in w.carry) if (w.carry[r] > 0) putAny(s, r, w.carry[r]);
}

function arrive(s: GameState, w: Walker): void {
  if (w.k === 'cart') {
    const t = s.b[w.target!];
    if (t && B[t.type].store) {
      const n = Math.min(w.amt!, freeFor(t, w.res!));
      t.stock[w.res!] = (t.stock[w.res!] ?? 0) + n;
      if (n < w.amt!) putAny(s, w.res!, w.amt! - n);
    }
  }
  if (w.k === 'immigrant') {
    const t = s.b[w.target!] as HouseStock | undefined;
    if (t) {
      t.inc = Math.max(0, t.inc - w.amt!);
      t.pop = Math.min(LV[t.lvl]!.cap, t.pop + w.amt!);
    }
    w.dead = true;
    return;
  }
  killWalker(s, w);
}

export function stepWalker(s: GameState, w: Walker, ctx: WalkerCtx): void {
  w.t += WS;
  if (w.t < 1) return;
  w.t = 0;
  w.prev = w.cur;
  w.cur = w.nxt;
  if (w.path) w.pi!++;
  if (!s.road[w.cur]) {
    killWalker(s, w);
    return;
  }
  serve(s, w);
  ctx.onVisit?.(w);
  decide(s, w, ctx);
}

function decide(s: GameState, w: Walker, ctx: WalkerCtx): void {
  if (w.path) {
    if (w.pi! >= w.path.length - 1) {
      arrive(s, w);
      return;
    }
    w.nxt = w.path[w.pi! + 1];
    return;
  }
  w.steps = (w.steps ?? 0) + 1;
  if (w.steps >= MAXSTEP) {
    const h = s.b[w.home];
    if (!h) return killWalker(s, w);
    const set = access(s, h);
    const r = roadSearch(s, w.cur, i => set.includes(i));
    if (!r) return killWalker(s, w);
    w.path = r.path;
    w.pi = 0;
    w.back = true;
    if (r.path.length === 1) {
      arrive(s, w);
      return;
    }
    w.nxt = r.path[1];
    return;
  }
  let o = roadNb(s, w.cur).filter(j => j !== w.prev);
  if (o.length > 1) {
    const fresh = o.filter(j => !w.seen!['t' + j]);
    if (fresh.length) o = fresh;
  }
  w.seen!['t' + w.cur] = 1;
  w.nxt = o.length ? o[(ctx.rand() * o.length) | 0] : w.prev! >= 0 ? w.prev! : w.cur;
}

/** Sert chaque maison habitée à portée, une seule fois par tournée. */
export function serve(s: GameState, w: Walker): void {
  if (!SERVICE.has(w.k)) return;
  const cx = X(w.cur), cy = Y(w.cur);
  for (let y = cy - SERVE_RANGE; y <= cy + SERVE_RANGE; y++)
    for (let x = cx - SERVE_RANGE - 1; x <= cx + SERVE_RANGE + 1; x++) {
      if (!inb(x, y) || hdist(w.cur, idx(x, y)) > SERVE_RANGE) continue;
      const id = s.occ[idx(x, y)];
      if (!id) continue;
      const b = s.b[id];
      if (!b || !isHouse(b) || b.pop <= 0 || w.seen![id]) continue;
      const h = b as HouseStock;
      w.seen![id] = 1;
      if (w.k === 'druid' || w.k === 'priest') h.relig = s.mi;
      else if (w.k === 'bard') h.ent = s.mi;
      else if (w.k === 'tax') collectTax(s, h);
      else if (w.k === 'market') deliver(h, w.carry!);
    }
}

/** La marchande complète les réserves d'une maison selon son niveau. */
export function deliver(h: HouseStock, carry: Record<string, number>): void {
  const per = rations(h.pop) * MARKET_GIVE.perRation;
  for (const f of ['ble', 'porc'] as const) {
    const g = Math.min(Math.max(0, per - h.food[f]), carry[f] ?? 0);
    h.food[f] += g;
    carry[f] -= g;
  }
  if (h.lvl >= 2) {
    const g = Math.min(Math.max(0, MARKET_GIVE.cervoise - h.cerv), carry.cervoise ?? 0);
    h.cerv += g;
    carry.cervoise -= g;
  }
  if (h.lvl >= 3) {
    const g = Math.min(Math.max(0, MARKET_GIVE.torques - h.torq), carry.torques ?? 0);
    h.torq += g;
    carry.torques -= g;
  }
}
