/** Stocks : greniers et entrepôts, et ce qu'on y prend ou dépose. */
import { nb4, type Cell } from '../core/hex';
import type { Building, GameState } from '../core/state';
import { B } from '../data/buildings';
import { buildings } from './query';
import { roadSearch } from './paths';

/** Quantité totale rangée dans un bâtiment. */
export const used = (b: Building): number => Object.values(b.stock).reduce((a, n) => a + n, 0);

/** Place libre pour une ressource dans un dépôt qui l'accepte. */
export function freeFor(b: Building, res: string): number {
  const d = B[b.type];
  return d.store && d.store.includes(res) ? Math.max(0, (d.cap ?? 0) - used(b)) : 0;
}

/** Quantité d'une ressource dans tous les dépôts du village. */
export function stockOf(s: GameState, res: string): number {
  let n = 0;
  for (const b of buildings(s)) if (B[b.type].store && b.stock[res]) n += b.stock[res];
  return n;
}

/** Retire n unités des dépôts, dans l'ordre de construction. Renvoie vrai si tout a été trouvé. */
export function take(s: GameState, res: string, n: number): boolean {
  for (const b of buildings(s)) {
    if (n <= 0) break;
    if (!B[b.type].store || !b.stock[res]) continue;
    const t = Math.min(n, b.stock[res]);
    b.stock[res] -= t;
    n -= t;
  }
  return n <= 0;
}

/** Range n unités là où il reste de la place. Renvoie ce qui n'a pas pu être rangé. */
export function putAny(s: GameState, res: string, n: number): number {
  for (const b of buildings(s)) {
    const t = Math.min(n, freeFor(b, res));
    if (t > 0) {
      b.stock[res] = (b.stock[res] ?? 0) + t;
      n -= t;
    }
    if (n <= 0) break;
  }
  return Math.max(0, n);
}

/**
 * Dépôt le plus proche par les chemins qui a encore de la place pour res, à partir des cases de chemin
 * qui desservent un atelier. Renvoie l'identifiant du dépôt et le trajet du porteur, ou null.
 */
export function findDepot(s: GameState, from: Cell[], res: string): { path: Cell[]; val: number } | null {
  let best: { path: Cell[]; val: number } | null = null;
  for (const a of from) {
    const f = roadSearch(s, a, i => {
      for (const j of nb4(i)) {
        const id = s.occ[j];
        if (id && s.b[id] && freeFor(s.b[id], res) > 0) return id;
      }
      return 0;
    });
    if (f && (!best || f.path.length < best.path.length)) best = f;
  }
  return best;
}

/** Ce qu'une marchande emporte en tournée. */
export const MARKET_LOAD = { food: 70, cervoise: 20, torques: 8 } as const;

/** Remplit le panier d'une marchande à partir des dépôts ; null si rien n'est à vendre. */
export function fillMarketBasket(s: GameState): Record<string, number> | null {
  const food = stockOf(s, 'ble') + stockOf(s, 'porc');
  if (food <= 0 && stockOf(s, 'cervoise') <= 0 && stockOf(s, 'torques') <= 0) return null;
  const c: Record<string, number> = {};
  for (const f of ['ble', 'porc']) {
    const n = Math.min(MARKET_LOAD.food, stockOf(s, f));
    take(s, f, n);
    c[f] = n;
  }
  for (const [r, m] of [['cervoise', MARKET_LOAD.cervoise], ['torques', MARKET_LOAD.torques]] as const) {
    const n = Math.min(m, stockOf(s, r));
    take(s, r, n);
    c[r] = n;
  }
  return c;
}
