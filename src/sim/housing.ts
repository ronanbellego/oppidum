/**
 * Maisons : chaque mois, une maison regarde ce qu'elle a reçu (eau, vivres, culte, cervoise,
 * chants, torques), monte d'un niveau si tout y est, redescend après deux mois de manque,
 * mange ses rations et paie sa part du tribut.
 */
import { idx, hdist } from '../core/hex';
import type { GameState, House } from '../core/state';
import { LV } from '../data/houses';
import { buildings, houses } from './query';
import { rations } from './labor';
import { accrueTax } from './tax';

/** Portée d'un puits et de l'alignement de menhirs, en hexagones. */
export const WELL_RANGE = 3;
export const MENHIR_RANGE = 7;
/** Une visite de druide ou de barde compte pendant ce nombre de mois. */
export const VISIT_MONTHS = 4;
/** Mois de manque avant de perdre un niveau, et mois de faim avant de perdre des habitants. */
export const DECLINE_MONTHS = 2;
export const STARVE_MONTHS = 4;

export interface HouseNeeds {
  water: boolean;
  /** Au moins une sorte de vivres en réserve. */
  food: boolean;
  /** Blé et porc à la fois. */
  types2: boolean;
  /** Culte : visite récente d'un druide ou d'un prêtre, ou alignement de menhirs proche. */
  relig: boolean;
  cerv: boolean;
  /** Chants d'un barde récents. */
  ent: boolean;
  torq: boolean;
}

/** Les champs propres aux maisons que la simulation fait évoluer. */
export interface HouseStock extends House {
  food: { ble: number; porc: number };
  cerv: number;
  torq: number;
  /** Mois des dernières visites du culte et d'un barde. */
  relig: number;
  ent: number;
  /** Mois consécutifs de manque et de faim. */
  bad: number;
  hungry: number;
  has?: HouseNeeds;
}

const near = (s: GameState, h: House, type: string, range: number, done = false) =>
  buildings(s).some(b => b.type === type && (!done || b.done) && hdist(idx(b.x, b.y), idx(h.x, h.y)) <= range);

export function needsOf(s: GameState, h: HouseStock): HouseNeeds {
  return {
    water: near(s, h, 'well', WELL_RANGE),
    food: h.food.ble + h.food.porc > 0,
    types2: h.food.ble > 0 && h.food.porc > 0,
    relig: s.mi - h.relig <= VISIT_MONTHS || near(s, h, 'menhirs', MENHIR_RANGE, true),
    cerv: h.cerv > 0,
    ent: s.mi - h.ent <= VISIT_MONTHS,
    torq: h.torq > 0,
  };
}

/** Niveau que permettent les besoins satisfaits. */
export function levelFor(a: HouseNeeds): 1 | 2 | 3 | 4 {
  if (!(a.water && a.food)) return 1;
  if (!(a.relig && a.cerv)) return 2;
  if (!(a.types2 && a.ent && a.torq)) return 3;
  return 4;
}

export type HouseEvent = { kind: 'firstLevel'; level: 3 | 4 };

export interface HousingReport {
  /** Maisons habitées, affamées, et touchées par le culte. */
  occupied: number;
  hungry: number;
  covered: number;
  events: HouseEvent[];
}

/** Un mois dans la vie d'une maison. */
export function houseMonth(s: GameState, h: HouseStock, rand: () => number, report: HousingReport): void {
  if (h.pop <= 0) return;
  report.occupied++;
  const a = needsOf(s, h);
  h.has = a;
  if (a.relig) report.covered++;

  const target = levelFor(a);
  if (target > h.lvl) {
    h.lvl = (h.lvl + 1) as House['lvl'];
    h.bad = 0;
    if (h.lvl >= 3 && !s.flags['l' + h.lvl]) {
      s.flags['l' + h.lvl] = 1;
      report.events.push({ kind: 'firstLevel', level: h.lvl as 3 | 4 });
    }
  } else if (target < h.lvl) {
    if (++h.bad >= DECLINE_MONTHS) {
      h.lvl = (h.lvl - 1) as House['lvl'];
      h.bad = 0;
    }
  } else h.bad = 0;

  h.pop = Math.min(h.pop, LV[h.lvl]!.cap);
  accrueTax(s, h);

  let need = rations(h.pop);
  for (const f of ['porc', 'ble'] as const) {
    const t = Math.min(need, h.food[f]);
    h.food[f] -= t;
    need -= t;
  }
  if (need > 0) {
    report.hungry++;
    h.hungry++;
    if (h.hungry > STARVE_MONTHS && h.pop > 1 && rand() < 0.4) h.pop--;
  } else h.hungry = 0;

  if (h.lvl >= 3) h.cerv = Math.max(0, h.cerv - 1);
  if (h.lvl >= 4) h.torq = Math.max(0, h.torq - 0.25);
}

/** Un mois pour toutes les maisons du village. */
export function housingMonth(s: GameState, rand: () => number): HousingReport {
  const report: HousingReport = { occupied: 0, hungry: 0, covered: 0, events: [] };
  for (const h of houses(s)) houseMonth(s, h as HouseStock, rand, report);
  return report;
}
