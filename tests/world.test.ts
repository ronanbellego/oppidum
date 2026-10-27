import { describe, it, expect } from 'vitest';
import { generateWorld } from '../src/world/generate';
import { TER, seaDepth } from '../src/world/terrain';
import { SEA_MARGIN } from '../src/world/island';
import { LANDMARK, LANDMARK_FROM_PORT, LANDMARK_SPACING } from '../src/world/landmarks';
import { N } from '../src/core/constants';
import { X, Y, nb4, hdist } from '../src/core/hex';

const SEEDS = [20260, 7, 99, 123456, 424242, 31337, 1, 2, 3, 555, 8080, 99999];

/** Cases de terre reliées à i sans passer par la mer. */
function landRegion(ter: Uint8Array, from: number): Set<number> {
  const seen = new Set([from]), q = [from];
  for (let h = 0; h < q.length; h++) for (const j of nb4(q[h])) if (ter[j] !== TER.sea && !seen.has(j)) { seen.add(j); q.push(j); }
  return seen;
}

describe('génération de l’île', () => {
  it('donne toujours la même île pour une même graine', () => {
    const a = generateWorld(20260), b = generateWorld(20260);
    expect(Array.from(a.ter)).toEqual(Array.from(b.ter));
    expect(Array.from(a.hgt)).toEqual(Array.from(b.hgt));
    expect([a.entry, a.dock, a.port?.x, a.port?.y]).toEqual([b.entry, b.dock, b.port?.x, b.port?.y]);
  });

  it('donne des îles différentes pour des graines différentes', () => {
    expect(Array.from(generateWorld(1).ter)).not.toEqual(Array.from(generateWorld(2).ter));
  });

  describe.each(SEEDS)('graine %i', seed => {
    const w = generateWorld(seed);

    it('est entourée de mer sur tout son pourtour', () => {
      for (let i = 0; i < N * N; i++) if (Math.min(X(i), Y(i), N - 1 - X(i), N - 1 - Y(i)) < SEA_MARGIN) expect(w.ter[i]).toBe(TER.sea);
    });

    it('a une île principale de taille raisonnable', () => {
      const land = Array.from(w.ter).filter(t => t !== TER.sea).length;
      expect(land).toBeGreaterThan(N * N * 0.15);
      expect(land).toBeLessThan(N * N * 0.75);
    });

    it('a un port posé sur la terre, au bord de la mer', () => {
      expect(w.port).not.toBeNull();
      for (const t of w.port!.tiles) expect(w.ter[t]).toBe(TER.prairie);
      expect(w.port!.tiles.some(t => nb4(t).some(j => w.ter[j] === TER.sea))).toBe(true);
    });

    it('a un quai dans l’eau, au contact du port', () => {
      expect(w.ter[w.dock]).toBe(TER.sea);
      expect(w.port!.tiles.some(t => nb4(t).includes(w.dock))).toBe(true);
    });

    it('a une route qui part du port vers l’intérieur', () => {
      expect(w.entry).toBeGreaterThanOrEqual(0);
      expect(w.road[w.entry]).toBe(1);
      expect(w.port!.tiles.some(t => nb4(t).includes(w.entry))).toBe(true);
      const roads = Array.from(w.road).filter(Boolean).length;
      expect(roads).toBeGreaterThanOrEqual(3);
      for (let i = 0; i < N * N; i++) if (w.road[i]) expect(w.ter[i]).not.toBe(TER.sea);
    });

    it('relie la route au cœur de l’île par la terre', () => {
      const region = landRegion(w.ter, w.entry);
      expect(region.size).toBeGreaterThan(N * N * 0.15);
    });

    it('a un relief aux pentes douces, aplani sous le port', () => {
      for (let i = 0; i < N * N; i++) {
        if (w.ter[i] === TER.sea) { expect(w.hgt[i]).toBe(0); continue; }
        expect(w.hgt[i]).toBeLessThanOrEqual(7);
        const land = nb4(i).filter(j => w.ter[j] !== TER.sea);
        if (land.length) expect(w.hgt[i]).toBeLessThanOrEqual(Math.min(...land.map(j => w.hgt[j])) + 1);
      }
      const h0 = w.hgt[w.port!.tiles[0]];
      for (const t of w.port!.tiles) expect(w.hgt[t]).toBe(h0);
    });

    it('place les sites anciens loin du port et les uns des autres', () => {
      expect(w.landmarks.length).toBe(3);
      expect(w.landmarks.map(i => w.deco[i])).toEqual([LANDMARK.menhir, LANDMARK.dolmen, LANDMARK.oak]);
      for (const i of w.landmarks) {
        expect(w.ter[i]).toBe(TER.prairie);
        expect(w.road[i]).toBe(0);
        expect(hdist(i, w.focus)).toBeGreaterThanOrEqual(LANDMARK_FROM_PORT);
      }
      for (const a of w.landmarks) for (const b of w.landmarks) if (a !== b) expect(hdist(a, b)).toBeGreaterThanOrEqual(LANDMARK_SPACING);
    });
  });

  it('calcule une profondeur de mer croissante vers le large', () => {
    const w = generateWorld(20260), dep = seaDepth(w.ter);
    for (let i = 0; i < N * N; i++) {
      if (w.ter[i] !== TER.sea) { expect(dep[i]).toBe(0); continue; }
      expect(dep[i]).toBeGreaterThanOrEqual(1);
      if (nb4(i).some(j => w.ter[j] !== TER.sea)) expect(dep[i]).toBe(1);
    }
  });
});
