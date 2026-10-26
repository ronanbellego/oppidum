import { describe, it, expect } from 'vitest';
import { idx, X, Y, inb, nb4, hdist, foot, nbDir, hexRound, fromCube, cube } from '../src/core/hex';
import { N } from '../src/core/constants';

describe('grille hexagonale', () => {
  it('convertit index et coordonnées dans les deux sens', () => {
    for (const [x, y] of [[0, 0], [5, 7], [N - 1, N - 1]]) {
      const i = idx(x, y);
      expect([X(i), Y(i)]).toEqual([x, y]);
    }
  });

  it('donne six voisins à distance 1 au milieu de la carte', () => {
    const c = idx(20, 21);
    const v = nb4(c);
    expect(v).toHaveLength(6);
    for (const j of v) expect(hdist(c, j)).toBe(1);
  });

  it('donne moins de voisins sur les bords', () => {
    expect(nb4(idx(0, 0)).length).toBeLessThan(6);
  });

  it('retrouve une case depuis ses coordonnées cubiques', () => {
    const i = idx(13, 9);
    const [q, r] = cube(i);
    expect(fromCube(q, r)).toBe(i);
    expect(hexRound(q + 0.2, r - 0.1)).toEqual([q, r]);
  });

  it('calcule les emprises de 1, 3 et 7 cases', () => {
    expect(foot(1, 10, 10)).toHaveLength(1);
    const tri = foot(2, 10, 10)!;
    expect(tri).toHaveLength(3);
    for (const a of tri) for (const b of tri) expect(hdist(a, b)).toBeLessThanOrEqual(1);
    const fleur = foot(3, 10, 10)!;
    expect(fleur).toHaveLength(7);
    for (const t of fleur) expect(hdist(fleur[0], t)).toBeLessThanOrEqual(1);
  });

  it('refuse une emprise qui sort de la carte', () => {
    expect(foot(3, 0, 0)).toBeNull();
    expect(inb(-1, 3)).toBe(false);
  });

  it('va d’une case à son voisin et revient', () => {
    const i = idx(15, 15);
    for (let d = 0; d < 6; d++) expect(nbDir(nbDir(i, d), (d + 3) % 6)).toBe(i);
  });
});
