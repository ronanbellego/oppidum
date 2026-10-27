/**
 * Tribut : chaque maison accumule chaque mois sa part (habitants × barème du niveau × taux choisi),
 * jusqu'à un plafond, et le collecteur de la maison du chef ramasse tout à son passage.
 */
import { BAL } from '../core/constants';
import type { GameState, House } from '../core/state';
import { LV } from '../data/houses';
import { houses, monumentDone } from './query';

/** Multiplicateurs des taux léger, normal et lourd. */
export const TAX_RATES = [0.6, 1, 1.5] as const;
/** Bonus du tumulus royal achevé. */
export const TUMULUS_BONUS = 1.25;

export const taxRate = (s: GameState): number => TAX_RATES[s.taxLvl ?? 1];

const bonus = (s: GameState): number => (monumentDone(s, 'tumulus') ? TUMULUS_BONUS : 1);

/** Part mensuelle d'une maison, hors bonus. */
export const houseShare = (s: GameState, h: House): number => h.pop * LV[h.lvl]!.tax * taxRate(s);

/** Ajoute la part du mois au tribut en attente, sans dépasser le plafond. */
export function accrueTax(s: GameState, h: House): void {
  const m = houseShare(s, h);
  h.owed = Math.min((h.owed ?? 0) + m, m * BAL.taxCapMonths);
}

/** Le collecteur passe : il ramasse le tribut en attente et renvoie la somme encaissée. */
export function collectTax(s: GameState, h: House): number {
  const v = (h.owed ?? 0) * bonus(s);
  if (v > 0) {
    s.money += v;
    s.taxM = (s.taxM ?? 0) + v;
    h.owed = 0;
  }
  h.lastTax = s.mi;
  return v;
}

/** Tribut que le village doit chaque mois, bonus compris. */
export function monthlyTaxDue(s: GameState): number {
  let t = 0;
  for (const h of houses(s)) if (h.pop > 0) t += h.pop * LV[h.lvl]!.tax;
  return t * taxRate(s) * bonus(s);
}

/** Tribut en attente dans toutes les maisons. */
export const taxPending = (s: GameState): number => houses(s).reduce((a, h) => a + (h.owed ?? 0), 0);
