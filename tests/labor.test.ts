import { describe, it, expect } from 'vitest';
import { assignLabor, payWages, rations } from '../src/sim/labor';
import { BAL } from '../src/core/constants';
import { blankState, addBuilding, addHouse } from './helpers';

describe('main-d’œuvre', () => {
  it('fait travailler une part fixe des habitants', () => {
    const s = blankState();
    addHouse(s, 5);
    addHouse(s, 6);
    assignLabor(s);
    expect(s.pop).toBe(11);
    expect(s.labor).toBe(Math.floor(11 * BAL.laborShare));
  });

  it('compte les rations du mois', () => {
    const s = blankState();
    addHouse(s, 5);
    addHouse(s, 8);
    assignLabor(s);
    expect(s.cons).toBe(rations(5) + rations(8));
    expect(rations(0)).toBe(0);
    expect(rations(4)).toBe(1);
    expect(rations(5)).toBe(2);
  });

  it('pourvoit la maison du chef avant tout le reste', () => {
    const s = blankState();
    addHouse(s, 6); // 3 travailleurs
    const bard = addBuilding(s, 'bard');
    const farm = addBuilding(s, 'farm');
    const chief = addBuilding(s, 'chief');
    assignLabor(s);
    expect(chief.wk).toBe(3);
    expect(farm.wk).toBe(0);
    expect(bard.wk).toBe(0);
  });

  it('sert le marché et le grenier avant les champs', () => {
    const s = blankState();
    addHouse(s, 8); // 4 travailleurs
    const farm = addBuilding(s, 'farm');
    const granary = addBuilding(s, 'granary');
    const market = addBuilding(s, 'market');
    assignLabor(s);
    expect(market.wk).toBe(2);
    expect(granary.wk).toBe(2);
    expect(farm.wk).toBe(0);
  });

  it('suit l’ordre des secteurs : vivres, artisanat, défense, vie du clan', () => {
    const s = blankState();
    addHouse(s, 20, 3); // 10 travailleurs
    const grove = addBuilding(s, 'grove');
    const tower = addBuilding(s, 'tower');
    const wood = addBuilding(s, 'wood');
    const farm = addBuilding(s, 'farm');
    assignLabor(s);
    expect(farm.wk).toBe(4);
    expect(wood.wk).toBe(3);
    expect(tower.wk).toBe(2);
    expect(grove.wk).toBe(1);
    expect(s.sect![1]).toEqual([4, 4]);
    expect(s.sect![4]).toEqual([1, 2]);
  });

  it('n’ouvre aucun poste sans chemin, ni dans un atelier bloqué', () => {
    const s = blankState();
    addHouse(s, 20, 3);
    const isolated = addBuilding(s, 'farm', { road: false });
    const stuck = addBuilding(s, 'pigs', { stuck: true });
    const ok = addBuilding(s, 'wood');
    assignLabor(s);
    expect(isolated.wk).toBe(0);
    expect(stuck.wk).toBe(0);
    expect(ok.wk).toBe(3);
    expect(s.jobs).toBe(3);
  });

  it('n’emploie plus personne sur un monument achevé', () => {
    const s = blankState();
    addHouse(s, 20, 3);
    const m = addBuilding(s, 'menhirs', { done: false });
    assignLabor(s);
    expect(m.wk).toBe(8);
    m.done = true;
    assignLabor(s);
    expect(m.wk).toBe(0);
    expect(s.jobs).toBe(0);
  });

  it('compte les sans-emploi et le taux de postes pourvus', () => {
    const s = blankState();
    addHouse(s, 20, 3); // 10 travailleurs
    addBuilding(s, 'farm'); // 4 postes
    assignLabor(s);
    expect(s.emp).toBe(4);
    expect(s.unemp).toBe(6);
    expect(s.eff).toBe(1);
  });
});

describe('salaires', () => {
  it('paie chaque employé', () => {
    const s = blankState({ money: 100 });
    addHouse(s, 8);
    addBuilding(s, 'farm');
    assignLabor(s);
    const r = payWages(s);
    expect(r.paid).toBeCloseTo(4 * BAL.wage);
    expect(s.money).toBeCloseTo(100 - 4 * BAL.wage);
  });

  it('ne fait jamais passer le trésor sous zéro', () => {
    const s = blankState({ money: 0.3 });
    addHouse(s, 20, 3);
    addBuilding(s, 'farm');
    addBuilding(s, 'wood');
    assignLabor(s);
    const r = payWages(s);
    expect(r.due).toBeGreaterThan(r.paid);
    expect(s.money).toBe(0);
    const again = payWages(s);
    expect(again.paid).toBe(0);
    expect(s.money).toBe(0);
  });
});
