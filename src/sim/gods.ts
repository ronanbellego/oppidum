/**
 * Les dieux. Toutatis suit la part des maisons touchées par le culte ; trop négligé, Taranis peut foudroyer
 * un bâtiment. Taranis, Bélénos et Épona ont chacun leur faveur, nourrie par leurs temples en activité,
 * et leur bienfait au-dessus d'un seuil.
 */
import type { GameState } from '../core/state';
import { BAL } from '../core/constants';
import { buildings, monumentDone } from './query';
import { putAny } from './stock';

export const GOD_NAMES = ['taranis', 'belenos', 'epona'] as const;
export type God = (typeof GOD_NAMES)[number];

/** Rythme auquel une faveur rejoint sa cible chaque mois. */
export const FAVOR_RATE = 0.2;
/** Faveur de base d'un dieu sans temple, gain par temple actif, bonus de l'alignement de menhirs. */
export const BASE_FAVOR = 35;
export const PER_TEMPLE = 30;
export const MENHIR_BONUS = 15;
/** Foudre : faveur de Toutatis en dessous de laquelle elle menace, maisons minimum, chance par mois. */
export const WRATH_BELOW = 15;
export const WRATH_MIN_HOUSES = 5;
export const WRATH_CHANCE = 0.12;
/** Bienfaits : seuils et effets. */
export const BLESSING = { belenos: 70, epona: 70, taranisStrikes: 60 } as const;
export const HARVEST = { chance: 0.12, wheat: 40 } as const;
/** Une fête élève toutes les faveurs de ce nombre de points. */
export const FESTIVAL_BOOST = 15;

const clamp = (v: number) => Math.max(0, Math.min(100, v));

/**
 * Faveur de Toutatis pour le mois. covered et occupied viennent du bilan des maisons.
 * Renvoie l'identifiant du bâtiment foudroyé, le cas échéant (l'appelant le retire).
 */
export function toutatisMonth(s: GameState, covered: number, occupied: number, rand: () => number): number | null {
  const target = Math.min(100, (occupied ? (covered / occupied) * 100 : 50) + (monumentDone(s, 'menhirs') ? MENHIR_BONUS : 0));
  s.favor = clamp(s.favor + (target - s.favor) * FAVOR_RATE);
  if (s.wrath !== false && occupied > WRATH_MIN_HOUSES && s.favor < WRATH_BELOW && rand() < WRATH_CHANCE) {
    const targets = buildings(s).filter(b => b.type !== 'hut' && b.type !== 'port');
    if (targets.length) return targets[(rand() * targets.length) | 0].id;
  }
  return null;
}

/** Faveurs des trois dieux à temple. Renvoie vrai si Bélénos a offert une moisson. */
export function templesMonth(s: GameState, rand: () => number): boolean {
  const bonus = monumentDone(s, 'menhirs') ? MENHIR_BONUS : 0;
  for (const god of GOD_NAMES) {
    const n = buildings(s).filter(b => b.type === 't_' + god && (b.wk ?? 0) > 0).length;
    const target = Math.min(100, BASE_FAVOR + PER_TEMPLE * n + bonus);
    s.gf[god] += (target - s.gf[god]) * FAVOR_RATE;
  }
  if (s.gf.belenos > BLESSING.belenos && rand() < HARVEST.chance && buildings(s).some(b => b.type === 'granary')) {
    putAny(s, 'ble', HARVEST.wheat);
    return true;
  }
  return false;
}

/** Grande fête : coûte BAL.festival statères et élève toutes les faveurs. */
export function festival(s: GameState): boolean {
  if (s.money < BAL.festival) return false;
  s.money -= BAL.festival;
  s.favor = Math.min(100, s.favor + FESTIVAL_BOOST);
  for (const god of GOD_NAMES) s.gf[god] = Math.min(100, s.gf[god] + FESTIVAL_BOOST);
  return true;
}
