import { describe, it, expect } from 'vitest';
import { spawnWalker, stepWalker, killWalker, serve, deliver, MARKET_GIVE, TOUR_COOLDOWN, type WalkerCtx } from '../src/sim/walkers';
import { immigrate, MAX_GROUPS } from '../src/sim/migration';
import type { HouseStock } from '../src/sim/housing';
import { rations } from '../src/sim/labor';
import { WS, MAXSTEP } from '../src/core/constants';
import { idx } from '../src/core/hex';
import type { Walker } from '../src/core/state';
import { blankState, addBuilding, addHouse } from './helpers';

const ctx = (r = 0.3): WalkerCtx => ({ rand: () => r });
const steps = (n: number) => Math.ceil(n / WS);
function house(s: ReturnType<typeof blankState>, x: number, y: number, extra: Partial<HouseStock> = {}): HouseStock {
  return addHouse(s, 5, 1, { x, y, food: { ble: 0, porc: 0 }, cerv: 0, torq: 0, relig: -99, ent: -99, bad: 0, hungry: 0, ...extra } as Partial<HouseStock>) as HouseStock;
}
const walker = (w: Partial<Walker>): Walker => ({ cur: 0, nxt: 0, t: 0, home: 0, ...w } as Walker);

describe('marcheurs en tournée', () => {
  it('servent les maisons à portée de leur chemin, une fois par tournée', () => {
    const s = blankState({ mi: 9 });
    for (let x = 5; x <= 25; x++) s.road[idx(x, 20)] = 1;
    const near = house(s, 10, 21), far = house(s, 10, 25);
    const w = walker({ k: 'druid', start: idx(10, 20) });
    spawnWalker(s, w, ctx());
    expect(near.relig).toBe(9);
    expect(far.relig).toBe(-99);
    near.relig = 0;
    serve(s, w);
    expect(near.relig).toBe(0);
  });

  it('avancent d’une case à chaque fois que leur progression atteint 1', () => {
    const s = blankState();
    for (let x = 5; x <= 25; x++) s.road[idx(x, 20)] = 1;
    const w = spawnWalker(s, walker({ k: 'bard', start: idx(10, 20) }), ctx());
    const first = w.cur;
    for (let k = 0; k < steps(1); k++) stepWalker(s, w, ctx());
    expect(w.cur).not.toBe(first);
  });

  it('rentrent au bâtiment après une tournée complète', () => {
    const s = blankState();
    const bard = addBuilding(s, 'bard', { x: 10, y: 18, road: false, out: true });
    for (let x = 5; x <= 30; x++) s.road[idx(x, 20)] = 1;
    for (const y of [19]) s.road[idx(10, y)] = 1;
    const w = spawnWalker(s, walker({ k: 'bard', home: bard.id, start: idx(10, 19) }), ctx(0.9));
    for (let k = 0; k < steps(MAXSTEP * 3) && !w.dead; k++) stepWalker(s, w, ctx(0.9));
    expect(w.dead).toBe(true);
    expect(bard.out).toBe(false);
    expect(bard.cool).toBe(TOUR_COOLDOWN);
  });

  it('disparaissent si le chemin sous leurs pieds est démoli', () => {
    const s = blankState();
    for (let x = 5; x <= 25; x++) s.road[idx(x, 20)] = 1;
    const w = spawnWalker(s, walker({ k: 'bard', start: idx(10, 20) }), ctx());
    for (let x = 5; x <= 25; x++) s.road[idx(x, 20)] = 0;
    for (let k = 0; k < steps(1); k++) stepWalker(s, w, ctx());
    expect(w.dead).toBe(true);
  });
});

describe('marchande', () => {
  it('complète les réserves selon les rations et le niveau', () => {
    const s = blankState();
    const h = house(s, 10, 10, { lvl: 3, pop: 8, food: { ble: 2, porc: 0 }, cerv: 1 });
    const carry = { ble: 100, porc: 3, cervoise: 10, torques: 10 };
    deliver(h, carry);
    const per = rations(8) * MARKET_GIVE.perRation;
    expect(h.food.ble).toBe(per);
    expect(h.food.porc).toBe(3);
    expect(carry.porc).toBe(0);
    expect(h.cerv).toBe(MARKET_GIVE.cervoise);
    expect(h.torq).toBe(MARKET_GIVE.torques);
  });

  it('ne donne ni cervoise à une hutte ni torques à une maison de torchis', () => {
    const s = blankState();
    const hut = house(s, 10, 10), mid = house(s, 14, 10, { lvl: 2 });
    const carry = { ble: 0, porc: 0, cervoise: 10, torques: 10 };
    deliver(hut, carry);
    deliver(mid, carry);
    expect(hut.cerv).toBe(0);
    expect(mid.cerv).toBe(MARKET_GIVE.cervoise);
    expect(mid.torq).toBe(0);
  });

  it('rapporte au dépôt ce qu’elle n’a pas distribué', () => {
    const s = blankState();
    const g = addBuilding(s, 'granary');
    const w = walker({ k: 'market', carry: { ble: 30, porc: 0 } });
    killWalker(s, w);
    expect(g.stock.ble).toBe(30);
  });
});

describe('porteurs', () => {
  it('livrent leur lot au dépôt visé', () => {
    const s = blankState();
    const farm = addBuilding(s, 'farm', { cartOut: true });
    const g = addBuilding(s, 'granary');
    const path = [idx(5, 30), idx(6, 30), idx(7, 30)];
    for (const i of path) s.road[i] = 1;
    const w = spawnWalker(s, walker({ k: 'cart', home: farm.id, target: g.id, res: 'ble', amt: 10, path }), ctx());
    for (let k = 0; k < steps(3) && !w.dead; k++) stepWalker(s, w, ctx());
    expect(g.stock.ble).toBe(10);
    expect(farm.cartOut).toBe(false);
  });
});

describe('arrivée des familles', () => {
  function village() {
    const s = blankState({ entry: idx(5, 20) });
    for (let x = 5; x <= 20; x++) s.road[idx(x, 20)] = 1;
    const h = house(s, 12, 21, { pop: 0 });
    return { s, h };
  }

  it('envoie un groupe depuis le port vers une maison qui a de la place', () => {
    const { s, h } = village();
    immigrate(s, ctx());
    expect(s.w).toHaveLength(1);
    expect(h.inc).toBe(4);
    const w = s.w[0];
    for (let k = 0; k < steps(20) && !w.dead; k++) stepWalker(s, w, ctx());
    expect(h.pop).toBe(4);
    expect(h.inc).toBe(0);
  });

  it('agrandit les groupes avec un tribut léger et Épona satisfaite', () => {
    const { s, h } = village();
    s.taxLvl = 0;
    s.gf.epona = 80;
    immigrate(s, ctx());
    expect(h.inc).toBe(5);
  });

  it('freine les arrivées en cas de chômage, sauf avec le tumulus', () => {
    const { s } = village();
    Object.assign(s, { labor: 20, unemp: 12 });
    expect(immigrate(s, ctx())).toBe('trop de bras sans travail');
    addBuilding(s, 'tumulus', { done: true });
    expect(immigrate(s, ctx())).toBe('');
    expect(s.w).toHaveLength(1);
  });

  it('limite le nombre de groupes en route', () => {
    const { s } = village();
    for (let k = 0; k < MAX_GROUPS; k++) s.w.push(walker({ k: 'immigrant' }));
    immigrate(s, ctx());
    expect(s.w).toHaveLength(MAX_GROUPS);
  });
});
