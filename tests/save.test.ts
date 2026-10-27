import { describe, it, expect } from 'vitest';
import { serialize, deserialize, SAVE_VERSION } from '../src/core/save';
import { emptyGrids, GRID_NAMES, type GameState } from '../src/core/state';
import { memoryStore } from '../src/core/storage';
import { nextRandom } from '../src/core/rng';
import { N } from '../src/core/constants';

function sampleState(): GameState {
  const g = emptyGrids();
  for (let i = 0; i < N * N; i++) {
    g.ter[i] = i % 4;
    g.vr[i] = (i % 97) / 97;
    g.hgt[i] = i % 8;
    g.occ[i] = i % 13 === 0 ? 70000 + i : 0;
    g.whp[i] = (i % 3) * 33.5;
  }
  return {
    ...g,
    seed: 20260,
    rs: 12345,
    tick: 900,
    mi: 15,
    money: 1234.5,
    nid: 3,
    b: { 1: { id: 1, type: 'port', x: 10, y: 20, s: 2, hp: 160, maxhp: 160, stock: {} } },
    w: [],
    u: [],
    logs: [{ m: 'Samonios, an 80 av. J.-C.', t: 'Le clan débarque.' }],
    flags: { g1: 1 },
    favor: 50,
    gf: { taranis: 35, belenos: 35, epona: 35 },
    sell: { bois: true },
    entry: 1000,
    dock: 1100,
    won: false,
    taxLvl: 1,
  };
}

describe('sauvegarde versionnée', () => {
  it('relit à l’identique ce qu’elle a écrit, grilles comprises', () => {
    const st = sampleState();
    const r = deserialize(serialize(st, { x: 1, y: 2, z: 1.1 }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const name of GRID_NAMES) {
      expect(r.state[name].constructor).toBe(st[name].constructor);
      expect(Array.from(r.state[name] as ArrayLike<number>)).toEqual(Array.from(st[name] as ArrayLike<number>));
    }
    expect(r.state.money).toBe(1234.5);
    expect(r.state.b[1].type).toBe('port');
    expect(r.state.taxLvl).toBe(1);
    expect(r.cam).toEqual({ x: 1, y: 2, z: 1.1 });
    expect(r.migratedFrom).toBeUndefined();
    expect(r.missing).toEqual([]);
  });

  it('écrit la version courante dans l’enveloppe', () => {
    const env = JSON.parse(serialize(sampleState()));
    expect(env.format).toBe('oppidum');
    expect(env.version).toBe(SAVE_VERSION);
    expect(typeof env.state.ter.data).toBe('string');
  });

  it('est nettement plus compacte que des tableaux JSON', () => {
    const st = sampleState();
    const plain = JSON.stringify({ ...st, ter: Array.from(st.ter), vr: Array.from(st.vr), occ: Array.from(st.occ) });
    expect(serialize(st).length).toBeLessThan(plain.length);
  });

  it('reprend une sauvegarde de l’ancien format (version 2)', () => {
    const st = sampleState();
    const old: Record<string, unknown> = { v: 2 };
    for (const [k, v] of Object.entries(st)) {
      if (k === 'rs') continue;
      old[k] = ArrayBuffer.isView(v) ? Array.from(v as unknown as ArrayLike<number>) : v;
    }
    delete old.hgt;
    const r = deserialize(JSON.stringify({ S: old, cam: { x: 0, y: 0, z: 1 } }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.migratedFrom).toBe(2);
    expect(r.missing).toEqual(['hgt']);
    expect(r.state.ter).toBeInstanceOf(Uint8Array);
    expect(Array.from(r.state.ter)).toEqual(Array.from(st.ter));
    expect(typeof r.state.rs).toBe('number');
  });

  it('refuse proprement ce qu’elle ne sait pas lire', () => {
    expect(deserialize('pas du json').ok).toBe(false);
    expect(deserialize('{"hello":1}').ok).toBe(false);
    expect(deserialize(JSON.stringify({ format: 'oppidum', version: SAVE_VERSION + 1, state: {} })).ok).toBe(false);
    expect(deserialize(JSON.stringify({ S: { v: 1 } })).ok).toBe(false);
    const broken = JSON.parse(serialize(sampleState()));
    broken.state.ter = { enc: 'b64', data: 'AAAA' };
    expect(deserialize(JSON.stringify(broken)).ok).toBe(false);
  });

  it('passe par un stockage interchangeable', () => {
    const store = memoryStore();
    expect(store.read()).toBeNull();
    store.write(serialize(sampleState()));
    const r = deserialize(store.read()!);
    expect(r.ok && r.state.seed).toBe(20260);
  });
});

describe('hasard de la simulation', () => {
  it('donne la même suite pour un même état de départ', () => {
    const draw = (s0: number, n: number) => {
      const out: number[] = [];
      let s = s0;
      for (let k = 0; k < n; k++) {
        const [v, next] = nextRandom(s);
        out.push(v);
        s = next;
      }
      return out;
    };
    expect(draw(42, 50)).toEqual(draw(42, 50));
    expect(draw(42, 50)).not.toEqual(draw(43, 50));
    for (const v of draw(7, 1000)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
