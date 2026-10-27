import { describe, it, expect } from 'vitest';
import { accrueTax, collectTax, monthlyTaxDue, taxPending, taxRate, TAX_RATES, TUMULUS_BONUS } from '../src/sim/tax';
import { BAL } from '../src/core/constants';
import { LV } from '../src/data/houses';
import { blankState, addBuilding, addHouse } from './helpers';

describe('tribut', () => {
  it('applique le barème du niveau de maison', () => {
    const s = blankState();
    const h = addHouse(s, 10, 2);
    accrueTax(s, h);
    expect(h.owed).toBeCloseTo(10 * LV[2]!.tax);
  });

  it('suit le taux choisi par le joueur', () => {
    const s = blankState({ taxLvl: 2 });
    expect(taxRate(s)).toBe(TAX_RATES[2]);
    const h = addHouse(s, 10, 1);
    accrueTax(s, h);
    expect(h.owed).toBeCloseTo(10 * LV[1]!.tax * TAX_RATES[2]);
    expect(taxRate(blankState())).toBe(1);
  });

  it('s’accumule de mois en mois jusqu’au plafond', () => {
    const s = blankState();
    const h = addHouse(s, 5, 1);
    const month = 5 * LV[1]!.tax;
    for (let k = 0; k < 3; k++) accrueTax(s, h);
    expect(h.owed).toBeCloseTo(3 * month);
    for (let k = 0; k < 30; k++) accrueTax(s, h);
    expect(h.owed).toBeCloseTo(month * BAL.taxCapMonths);
  });

  it('est encaissé en entier au passage du collecteur', () => {
    const s = blankState({ money: 100, mi: 7 });
    const h = addHouse(s, 10, 3);
    accrueTax(s, h);
    accrueTax(s, h);
    const got = collectTax(s, h);
    expect(got).toBeCloseTo(2 * 10 * LV[3]!.tax);
    expect(s.money).toBeCloseTo(100 + got);
    expect(s.taxM).toBeCloseTo(got);
    expect(h.owed).toBe(0);
    expect(h.lastTax).toBe(7);
    expect(collectTax(s, h)).toBe(0);
  });

  it('rapporte un quart de plus avec le tumulus royal achevé', () => {
    const s = blankState();
    const h = addHouse(s, 10, 1);
    addBuilding(s, 'tumulus', { done: true });
    accrueTax(s, h);
    expect(collectTax(s, h)).toBeCloseTo(10 * LV[1]!.tax * TUMULUS_BONUS);
  });

  it('donne le dû mensuel et le total en attente du village', () => {
    const s = blankState();
    const a = addHouse(s, 5, 1), b = addHouse(s, 10, 4);
    addHouse(s, 0, 1);
    expect(monthlyTaxDue(s)).toBeCloseTo(5 * LV[1]!.tax + 10 * LV[4]!.tax);
    accrueTax(s, a);
    accrueTax(s, b);
    expect(taxPending(s)).toBeCloseTo(monthlyTaxDue(s));
  });
});
