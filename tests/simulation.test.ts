/**
 * Parties complètes jouées sans écran : on bâtit un village sur une vraie île, on fait tourner la simulation
 * plusieurs années, et l'on vérifie qu'elle reste cohérente, qu'elle progresse et qu'elle est reproductible.
 */
import { describe, it, expect } from 'vitest';
import { createGame, placeBuilding, buildRoad, canPlace } from '../src/sim/construction';
import { simStep } from '../src/sim/tick';
import { nextRandom } from '../src/core/rng';
import { serialize, deserialize } from '../src/core/save';
import { MONTH, N } from '../src/core/constants';
import { X, Y, nb4, hexLine, foot, hdist } from '../src/core/hex';
import { B } from '../src/data/buildings';
import { houses } from '../src/sim/query';
import { resetFields } from '../src/sim/defense';
import type { SimCtx } from '../src/sim/context';
import type { GameState } from '../src/core/state';

function ctxFor(s: GameState, journal: string[] = []): SimCtx {
  return {
    rand: () => { const [v, n] = nextRandom(s.rs | 0); s.rs = n; return v; },
    log: m => journal.push(m),
    toast: () => {},
    fx: () => {},
    removeBuilding: () => {},
  };
}

/** Bâtit un village simple le long de la route du port, comme le ferait un joueur prudent. */
function buildVillage(s: GameState): void {
  const ctx = ctxFor(s);
  const silent = { log: () => {}, toast: () => {} };
  const entry = s.entry!;
  // prolonge la route vers l'intérieur
  let end = entry;
  for (let i = 0; i < N * N; i++) if (s.road[i] && hdist(i, entry) > hdist(end, entry)) end = i;
  const cx = N / 2, cy = N / 2;
  buildRoad(s, hexLine(end, cy * N + cx), ctx);
  const roads = () => Array.from(s.road).map((v, i) => (v ? i : -1)).filter(i => i >= 0);
  const touches = (type: string, i: number) => { const ft = foot(B[type].s ?? 1, X(i), Y(i)); return !!ft && ft.some(t => nb4(t).some(j => s.road[j])); };
  const put = (type: string, n = 1) => {
    let placed = 0;
    for (const r of roads()) for (const j of [r, ...nb4(r)].flatMap(k => nb4(k))) {
      if (placed >= n) return;
      if (touches(type, j) && !canPlace(s, type, X(j), Y(j)) && placeBuilding(s, type, X(j), Y(j), silent)) placed++;
    }
  };
  put('well', 2); put('farm', 2); put('granary'); put('market'); put('chief'); put('hut', 10);
}

function play(s: GameState, months: number, journal?: string[]) {
  const ctx = ctxFor(s, journal);
  for (let k = 0; k < months * MONTH; k++) simStep(s, ctx);
}

const SEEDS = [20260, 7, 31337];

describe.each(SEEDS)('partie complète, graine %i', seed => {
  resetFields();
  const s = createGame(seed);
  buildVillage(s);
  const journal: string[] = [];
  play(s, 36, journal);

  it('fait vivre le village plusieurs années', () => {
    expect(s.mi).toBe(36);
    expect(s.pop).toBeGreaterThan(20);
    expect(houses(s).some(h => h.lvl >= 2)).toBe(true);
  });

  it('garde un état cohérent', () => {
    expect(Number.isFinite(s.money)).toBe(true);
    expect(s.money).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(s.lastBal as number)).toBe(true);
    for (const h of houses(s)) {
      expect(h.pop).toBeGreaterThanOrEqual(0);
      expect(h.inc).toBeGreaterThanOrEqual(0);
    }
    for (const b of Object.values(s.b)) for (const v of Object.values(b.stock)) expect(v).toBeGreaterThanOrEqual(0);
    for (const b of Object.values(s.b)) expect(b.wk ?? 0).toBeLessThanOrEqual(B[b.type].jobs ?? 0);
    expect(s.emp).toBeLessThanOrEqual(s.labor!);
  });

  it('tient sa chronique', () => {
    expect(journal.some(m => m.includes('nouvelle année'))).toBe(true);
  });
});

describe('reproductibilité', () => {
  it('deux parties jouées à l’identique finissent à l’identique', () => {
    resetFields();
    const a = createGame(20260); buildVillage(a); play(a, 18);
    resetFields();
    const b = createGame(20260); buildVillage(b); play(b, 18);
    expect(serialize(b).replace(/"savedAt":"[^"]*"/, '')).toBe(serialize(a).replace(/"savedAt":"[^"]*"/, ''));
  });

  it('une partie sauvegardée puis reprise continue exactement comme l’originale', () => {
    resetFields();
    const a = createGame(7); buildVillage(a); play(a, 12);
    const r = deserialize(serialize(a));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const b = r.state;
    play(a, 12);
    resetFields();
    play(b, 12);
    const strip = (x: GameState) => serialize(x).replace(/"savedAt":"[^"]*"/, '');
    expect(strip(b)).toBe(strip(a));
  });
});
