/**
 * Commerce maritime : chaque mois, si le port est relié à l'entrée et a des bras, les marchands de
 * l'île de Bretagne achètent tout ce que le joueur a coché, au-delà d'une réserve.
 */
import type { GameState } from '../core/state';
import { RES } from '../data/resources';
import { roadSearch } from './paths';
import { access, buildings } from './query';
import { stockOf, take } from './stock';
import { entryOf } from './migration';
import { BLESSING } from './gods';

/** Unités gardées en réserve pour chaque marchandise vendue. */
export const KEEP = 30;
/** Bonus de prix quand Épona est satisfaite. */
export const EPONA_PRICE = 1.25;

const isHarbour = (type: string) => type === 'port' || type === 'trade';

/** Le port est-il relié à l'entrée par les chemins ? */
export function harbourLinked(s: GameState): boolean {
  return buildings(s)
    .filter(b => isHarbour(b.type))
    .some(t => {
      const set = access(s, t);
      return set.length > 0 && !!roadSearch(s, entryOf(s), i => set.includes(i));
    });
}

/** Vend les marchandises cochées. Renvoie la recette du mois. */
export function tradeMonth(s: GameState): number {
  s.tradeOK = harbourLinked(s);
  if (!s.tradeOK || !buildings(s).some(b => isHarbour(b.type) && (b.wk ?? 0) > 0)) return 0;
  const price = s.gf.epona > BLESSING.epona ? EPONA_PRICE : 1;
  let gain = 0;
  for (const r in s.sell) {
    if (!s.sell[r]) continue;
    const n = Math.floor(stockOf(s, r) - KEEP);
    if (n > 0) {
      take(s, r, n);
      gain += n * RES[r].p * price;
    }
  }
  s.money += gain;
  return gain;
}
