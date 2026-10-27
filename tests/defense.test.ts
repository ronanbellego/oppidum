import { describe, it, expect, beforeEach } from 'vitest';
import { resetFields, distanceField, passE, passW, spawnUnit, stepUnits, buildWall, repairWalls, raidMonth, startRaid, defenseStep, warriorDamage, sideOf, ENEMY, WARRIOR, WALL_PRICE } from '../src/sim/defense';
import { monumentStep, progress, MONUMENT_HP } from '../src/sim/monuments';
import { quietCtx } from '../src/sim/context';
import { BAL, N } from '../src/core/constants';
import { idx, nb4 } from '../src/core/hex';
import { TER } from '../src/world/terrain';
import { B } from '../src/data/buildings';
import { access } from '../src/sim/query';
import { stockOf } from '../src/sim/stock';
import { blankState, addBuilding, addHouse } from './helpers';

/** Île carrée de prairie au milieu de la mer. */
function island() {
  const s = blankState();
  for (let i = 0; i < N * N; i++) s.ter[i] = TER.sea;
  for (let y = 8; y < 40; y++) for (let x = 8; x < 40; x++) s.ter[idx(x, y)] = TER.prairie;
  return s;
}
beforeEach(resetFields);

describe('passages et distances', () => {
  it('ni pillard ni guerrier ne traversent la mer ou les rochers ; le guerrier ne passe pas un mur', () => {
    const s = island();
    expect(passE(s, idx(2, 2))).toBe(false);
    s.ter[idx(20, 20)] = TER.rocks;
    expect(passE(s, idx(20, 20))).toBe(false);
    s.wall[idx(21, 21)] = 1;
    expect(passE(s, idx(21, 21))).toBe(true);
    expect(passW(s, idx(21, 21))).toBe(false);
    s.wall[idx(22, 22)] = 2;
    expect(passW(s, idx(22, 22))).toBe(true);
  });

  it('calcule des distances croissantes depuis une source', () => {
    const D = distanceField([idx(20, 20)], () => 1);
    expect(D[idx(20, 20)]).toBe(0);
    for (const j of nb4(idx(20, 20))) expect(D[j]).toBe(1);
    const walled = distanceField([idx(20, 20)], j => (j === idx(21, 20) ? -1 : 1));
    expect(walled[idx(21, 20)]).toBe(1e9);
  });
});

describe('remparts', () => {
  it('coûte un prix par case, devient une porte sur un chemin, et refuse les rochers', () => {
    const s = island();
    s.money = 100;
    s.road[idx(12, 20)] = 1;
    s.ter[idx(13, 20)] = TER.rocks;
    buildWall(s, [idx(10, 20), idx(11, 20), idx(12, 20), idx(13, 20)], quietCtx());
    expect([s.wall[idx(10, 20)], s.wall[idx(12, 20)], s.wall[idx(13, 20)]]).toEqual([1, 2, 0]);
    expect(s.money).toBe(100 - 2 * WALL_PRICE.wall - WALL_PRICE.gate);
    expect(s.whp[idx(10, 20)]).toBe(100);
  });

  it('se répare hors des raids', () => {
    const s = island();
    s.wall[idx(10, 10)] = 1;
    s.whp[idx(10, 10)] = 50;
    s.raid = 1;
    repairWalls(s);
    expect(s.whp[idx(10, 10)]).toBe(50);
    s.raid = 0;
    repairWalls(s);
    expect(s.whp[idx(10, 10)]).toBe(55);
  });
});

describe('combat', () => {
  it('un pillard marche vers le village et incendie ce qu’il atteint', () => {
    const s = island();
    const farm = addBuilding(s, 'farm', { x: 20, y: 20, road: false });
    const ctx = quietCtx();
    const removed: number[] = [];
    ctx.removeBuilding = id => { removed.push(id); delete s.b[id]; };
    spawnUnit(s, 'enemy', idx(10, 20), ctx);
    s.raid = 1;
    for (let k = 0; k < 4000 && !removed.length; k++) { s.tick++; stepUnits(s, ctx); }
    expect(removed).toEqual([farm.id]);
    expect(ctx.journal.some(m => m.includes('incendié'))).toBe(true);
  });

  it('un guerrier tue un pillard, et la victoire rapporte un butin', () => {
    const s = island();
    const ctx = quietCtx();
    spawnUnit(s, 'warrior', idx(20, 20), ctx);
    spawnUnit(s, 'enemy', idx(21, 20), ctx);
    s.raid = 1;
    const money = s.money;
    for (let k = 0; k < 2000 && s.raid; k++) { s.tick++; stepUnits(s, ctx); }
    expect(s.raid).toBe(0);
    expect(s.u.filter(u => u.k === 'enemy')).toHaveLength(0);
    expect(s.money).toBe(money + ENEMY.loot);
    expect(s.flags.raidWon).toBe(1);
  });

  it('les guerriers frappent plus fort avec le sanctuaire des héros', () => {
    const s = island();
    const base = warriorDamage(s);
    addBuilding(s, 'heroes', { done: true, road: false });
    expect(warriorDamage(s)).toBeCloseTo(base * WARRIOR.heroesMult);
  });

  it('la caserne arme un guerrier avec du fer', () => {
    const s = island();
    const bar = addBuilding(s, 'barracks', { x: 20, y: 20 });
    addBuilding(s, 'store', { x: 30, y: 20, stock: { fer: 5 } });
    const ctx = quietCtx();
    for (let k = 0; k < WARRIOR.trainTime; k++) defenseStep(s, bar, access(s, bar), 1, ctx);
    expect(s.u.filter(u => u.k === 'warrior')).toHaveLength(1);
    expect(stockOf(s, 'fer')).toBe(5 - WARRIOR.ironCost);
  });

  it('la tour tire sur un pillard à portée', () => {
    const s = island();
    const tower = addBuilding(s, 'tower', { x: 20, y: 20, cool: 0 });
    const ctx = quietCtx();
    const e = spawnUnit(s, 'enemy', idx(22, 20), ctx);
    defenseStep(s, tower, access(s, tower), 1, ctx);
    expect(e.hp).toBeLessThan(ENEMY.hp);
    expect(ctx.effects.some(f => f.k === 'arrow')).toBe(true);
  });
});

describe('raids', () => {
  function village() {
    const s = island();
    addBuilding(s, 'farm', { x: 24, y: 24, road: false });
    for (let k = 0; k < 4; k++) addHouse(s, 12, 3, { x: 14 + k * 2, y: 30 });
    s.pop = BAL.raidMinPop;
    s.entry = idx(9, 9);
    return s;
  }

  it('sont annoncés un mois à l’avance, puis débarquent', () => {
    const s = village();
    const ctx = quietCtx(() => 0.3);
    s.raidNext = 5;
    s.mi = 4;
    raidMonth(s, ctx);
    expect(s.raidWarn).toBe(1);
    expect(ctx.journal[ctx.journal.length - 1]).toMatch(/voiles pillardes/);
    s.mi = 5;
    raidMonth(s, ctx);
    expect(s.raid).toBe(1);
    expect(s.u.filter(u => u.k === 'enemy').length).toBeGreaterThanOrEqual(3);
    expect(s.raidNext as number).toBeGreaterThan(5);
  });

  it('ne touchent pas un petit village, ni une partie où ils sont désactivés', () => {
    const s = village();
    s.pop = BAL.raidMinPop - 1;
    s.raidNext = 0;
    raidMonth(s, quietCtx());
    expect(s.raid ?? 0).toBe(0);
    s.pop = 100;
    s.raids = false;
    raidMonth(s, quietCtx());
    expect(s.raid ?? 0).toBe(0);
  });

  it('débarquent au bord de l’eau, loin du port', () => {
    const s = village();
    startRaid(s, quietCtx(() => 0.1));
    for (const u of s.u) {
      expect(s.ter[u.cur]).not.toBe(TER.sea);
      expect(nb4(u.cur).some(j => s.ter[j] === TER.sea)).toBe(true);
    }
  });

  it('nomment le côté de l’île', () => {
    expect(sideOf(idx(45, 20))).toBe("l'est");
    expect(sideOf(idx(2, 20))).toBe("l'ouest");
  });
});

describe('monuments', () => {
  it('puisent leurs matériaux un par un jusqu’à l’achèvement', () => {
    const s = island();
    const need = B.menhirs.mon!;
    const store: Record<string, number> = {};
    for (const r in need) store[r] = need[r];
    addBuilding(s, 'store', { x: 30, y: 30, stock: store });
    const m = addBuilding(s, 'menhirs', { x: 20, y: 20, got: {}, done: false, cool: 0 });
    const ctx = quietCtx(() => 0.4);
    for (let k = 0; k < 5000 && !m.done; k++) monumentStep(s, m, 1, ctx);
    expect(m.done).toBe(true);
    expect(progress(m)).toBe(1);
    expect(m.maxhp).toBe(MONUMENT_HP);
    expect(ctx.journal[ctx.journal.length - 1]).toMatch(/menhirs/);
  });

  it('s’arrêtent faute de matériaux ou de bras', () => {
    const s = island();
    const m = addBuilding(s, 'tumulus', { got: {}, done: false, cool: 0 });
    monumentStep(s, m, 1, quietCtx());
    expect(m.status).toMatch(/il manque/);
    monumentStep(s, m, 0, quietCtx());
    expect(m.status).toMatch(/à l'arrêt/);
    expect(progress(m)).toBe(0);
  });
});
