import { describe, it, expect } from 'vitest';
import { needsOf, levelFor, houseMonth, housingMonth, type HouseStock, type HousingReport, WELL_RANGE, VISIT_MONTHS, STARVE_MONTHS } from '../src/sim/housing';
import { LV } from '../src/data/houses';
import { blankState, addBuilding, addHouse } from './helpers';
import type { GameState } from '../src/core/state';

const ALL = { water: true, food: true, types2: true, relig: true, cerv: true, ent: true, torq: true };

function house(s: GameState, pop: number, lvl: 1 | 2 | 3 | 4, extra: Partial<HouseStock> = {}): HouseStock {
  return addHouse(s, pop, lvl, { food: { ble: 0, porc: 0 }, cerv: 0, torq: 0, relig: -99, ent: -99, bad: 0, hungry: 0, ...extra } as Partial<HouseStock>) as HouseStock;
}
const report = (): HousingReport => ({ occupied: 0, hungry: 0, covered: 0, events: [] });
const never = () => 0.99;

describe('besoins d’une maison', () => {
  it('donne le niveau permis par les besoins satisfaits', () => {
    expect(levelFor({ ...ALL, water: false })).toBe(1);
    expect(levelFor({ ...ALL, cerv: false })).toBe(2);
    expect(levelFor({ ...ALL, torq: false })).toBe(3);
    expect(levelFor(ALL)).toBe(4);
  });

  it('reconnaît l’eau d’un puits à portée seulement', () => {
    const s = blankState();
    const h = house(s, 5, 1, { x: 10, y: 20 });
    addBuilding(s, 'well', { x: 10 + WELL_RANGE, y: 20 });
    expect(needsOf(s, h).water).toBe(true);
    const far = house(s, 5, 1, { x: 30, y: 30 });
    expect(needsOf(s, far).water).toBe(false);
  });

  it('compte une visite de druide pendant quelques mois', () => {
    const s = blankState({ mi: 10 });
    const h = house(s, 5, 1, { relig: 10 - VISIT_MONTHS });
    expect(needsOf(s, h).relig).toBe(true);
    s.mi++;
    expect(needsOf(s, h).relig).toBe(false);
  });

  it('assure le culte près d’un alignement de menhirs achevé', () => {
    const s = blankState({ mi: 50 });
    const h = house(s, 5, 1, { x: 20, y: 20 });
    const m = addBuilding(s, 'menhirs', { x: 24, y: 20, done: false });
    expect(needsOf(s, h).relig).toBe(false);
    m.done = true;
    expect(needsOf(s, h).relig).toBe(true);
  });
});

describe('vie d’une maison au fil des mois', () => {
  it('monte d’un seul niveau par mois et signale la première longue maison', () => {
    const s = blankState({ mi: 5 });
    addBuilding(s, 'well', { x: 21, y: 20 });
    const h = house(s, 8, 1, { x: 20, y: 20, food: { ble: 50, porc: 50 }, relig: 5, cerv: 5 });
    const r = report();
    houseMonth(s, h, never, r);
    expect(h.lvl).toBe(2);
    houseMonth(s, h, never, r);
    expect(h.lvl).toBe(3);
    expect(r.events).toEqual([{ kind: 'firstLevel', level: 3 }]);
    const r2 = report();
    const other = house(s, 8, 2, { x: 22, y: 21, food: { ble: 50, porc: 50 }, relig: 5, cerv: 5 });
    houseMonth(s, other, never, r2);
    expect(other.lvl).toBe(3);
    expect(r2.events).toEqual([]);
  });

  it('ne redescend qu’après deux mois de manque', () => {
    const s = blankState();
    const h = house(s, 8, 2, { food: { ble: 50, porc: 0 } });
    houseMonth(s, h, never, report());
    expect(h.lvl).toBe(2);
    houseMonth(s, h, never, report());
    expect(h.lvl).toBe(1);
    expect(h.pop).toBe(LV[1]!.cap);
  });

  it('mange le porc avant le blé et compte la faim', () => {
    const s = blankState();
    const h = house(s, 8, 1, { food: { ble: 10, porc: 1 } });
    const r = report();
    houseMonth(s, h, never, r);
    expect(h.food).toEqual({ ble: 9, porc: 0 });
    expect(r.hungry).toBe(0);
    const empty = house(s, 4, 1);
    houseMonth(s, empty, never, r);
    expect(r.hungry).toBe(1);
    expect(empty.hungry).toBe(1);
  });

  it('perd des habitants après une longue famine', () => {
    const s = blankState();
    const h = house(s, 5, 1, { hungry: STARVE_MONTHS });
    houseMonth(s, h, () => 0.1, report());
    expect(h.pop).toBe(4);
    const lucky = house(s, 5, 1, { hungry: STARVE_MONTHS });
    houseMonth(s, lucky, never, report());
    expect(lucky.pop).toBe(5);
  });

  it('accumule le tribut et consomme cervoise et torques aux niveaux élevés', () => {
    const s = blankState({ mi: 0 });
    const h = house(s, 10, 4, { food: { ble: 20, porc: 20 }, cerv: 3, torq: 1, relig: 0, ent: 0 });
    houseMonth(s, h, never, report());
    expect(h.owed).toBeGreaterThan(0);
    expect(h.cerv).toBe(2);
    expect(h.torq).toBeCloseTo(0.75);
  });

  it('ignore les maisons vides et résume le village', () => {
    const s = blankState({ mi: 3 });
    house(s, 0, 1);
    house(s, 5, 1, { relig: 3, food: { ble: 9, porc: 0 } });
    house(s, 5, 1);
    const r = housingMonth(s, never);
    expect(r.occupied).toBe(2);
    expect(r.covered).toBe(1);
    expect(r.hungry).toBe(1);
  });
});
