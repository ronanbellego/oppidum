import { describe, it, expect } from 'vitest';
import { toutatisMonth, templesMonth, festival, BASE_FAVOR, PER_TEMPLE, MENHIR_BONUS, FAVOR_RATE, FESTIVAL_BOOST, HARVEST } from '../src/sim/gods';
import { tradeMonth, harbourLinked, KEEP, EPONA_PRICE } from '../src/sim/trade';
import { stockOf } from '../src/sim/stock';
import { RES } from '../src/data/resources';
import { BAL } from '../src/core/constants';
import { idx, nb4 } from '../src/core/hex';
import { tilesOf } from '../src/sim/query';
import { blankState, addBuilding } from './helpers';

const always = () => 0;
const never = () => 0.99;

describe('Toutatis', () => {
  it('rejoint peu à peu la part des maisons touchées par le culte', () => {
    const s = blankState({ favor: 50 });
    toutatisMonth(s, 10, 10, never);
    expect(s.favor).toBeCloseTo(50 + 50 * FAVOR_RATE);
    toutatisMonth(s, 0, 10, never);
    expect(s.favor).toBeLessThan(60);
  });

  it('gagne un bonus avec l’alignement de menhirs achevé', () => {
    const s = blankState({ favor: 0 });
    addBuilding(s, 'menhirs', { done: true });
    toutatisMonth(s, 0, 10, never);
    expect(s.favor).toBeCloseTo(MENHIR_BONUS * FAVOR_RATE);
  });

  it('laisse Taranis foudroyer un bâtiment quand il est négligé, jamais le port ni une maison', () => {
    const s = blankState({ favor: 0 });
    addBuilding(s, 'port');
    addBuilding(s, 'hut', { pop: 5, lvl: 1 });
    const farm = addBuilding(s, 'farm');
    expect(toutatisMonth(s, 0, 10, always)).toBe(farm.id);
  });

  it('épargne le village si la foudre est désactivée ou s’il est trop petit', () => {
    const s = blankState({ favor: 0, wrath: false });
    addBuilding(s, 'farm');
    expect(toutatisMonth(s, 0, 10, always)).toBeNull();
    s.wrath = true;
    expect(toutatisMonth(s, 0, 3, always)).toBeNull();
  });
});

describe('dieux à temple', () => {
  it('nourrissent leur faveur avec chaque temple en activité', () => {
    const s = blankState();
    s.gf.taranis = BASE_FAVOR;
    addBuilding(s, 't_taranis', { wk: 3 });
    addBuilding(s, 't_taranis', { wk: 0 });
    templesMonth(s, never);
    expect(s.gf.taranis).toBeCloseTo(BASE_FAVOR + PER_TEMPLE * FAVOR_RATE);
  });

  it('Bélénos satisfait offre parfois une moisson, s’il y a un grenier', () => {
    const s = blankState();
    s.gf.belenos = 90;
    expect(templesMonth(s, always)).toBe(false);
    addBuilding(s, 'granary');
    s.gf.belenos = 90;
    expect(templesMonth(s, always)).toBe(true);
    expect(stockOf(s, 'ble')).toBe(HARVEST.wheat);
  });

  it('une fête coûte son prix et élève toutes les faveurs', () => {
    const s = blankState({ money: BAL.festival, favor: 40 });
    expect(festival(s)).toBe(true);
    expect(s.money).toBe(0);
    expect(s.favor).toBe(40 + FESTIVAL_BOOST);
    expect(s.gf.epona).toBe(35 + FESTIVAL_BOOST);
    expect(festival(s)).toBe(false);
  });
});

describe('commerce maritime', () => {
  function harbour(wk = 3) {
    const s = blankState();
    const port = addBuilding(s, 'port', { x: 10, y: 20, road: false, wk });
    const ft = tilesOf(port);
    const start = ft.flatMap(t => nb4(t)).find(j => !ft.includes(j))!;
    s.road[start] = 1;
    s.entry = start;
    const g = addBuilding(s, 'granary', { stock: { ble: 100, porc: 10 } });
    return { s, port, g };
  }

  it('vend ce qui est coché au-delà de la réserve', () => {
    const { s, g } = harbour();
    s.sell = { ble: true, porc: true };
    const money = s.money;
    const gain = tradeMonth(s);
    expect(s.tradeOK).toBe(true);
    expect(gain).toBe((100 - KEEP) * RES.ble.p);
    expect(g.stock.ble).toBe(KEEP);
    expect(g.stock.porc).toBe(10);
    expect(s.money).toBe(money + gain);
  });

  it('paie mieux quand Épona est satisfaite', () => {
    const { s } = harbour();
    s.sell = { ble: true };
    s.gf.epona = 90;
    expect(tradeMonth(s)).toBeCloseTo((100 - KEEP) * RES.ble.p * EPONA_PRICE);
  });

  it('ne commerce pas sans bras au port ni sans liaison', () => {
    const { s } = harbour(0);
    s.sell = { ble: true };
    expect(tradeMonth(s)).toBe(0);
    const other = blankState();
    addBuilding(other, 'port', { wk: 3 });
    other.entry = idx(40, 40);
    expect(harbourLinked(other)).toBe(false);
  });
});
