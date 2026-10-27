/**
 * Grille hexagonale « pointe en haut », lignes impaires décalées d'une demi-case vers la droite.
 * Une case est désignée par son index i = y × N + x. Les calculs de distance et de voisinage
 * passent par les coordonnées cubiques (q, r, s), avec q + r + s = 0.
 */
import { N } from './constants';

export type Cell = number;
export type Cube = [q: number, r: number, s: number];

export const idx = (x: number, y: number): Cell => y * N + x;
export const X = (i: Cell): number => i % N;
export const Y = (i: Cell): number => (i / N) | 0;
export const inb = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < N && y < N;

export const SQ3 = Math.sqrt(3);
/** Rayon d'un hexagone dont la largeur vaut 1. */
export const HR = 1 / SQ3;

/** Position du centre d'une case dans le plan, en largeurs d'hexagone. */
export const HX = (i: Cell): number => X(i) + (Y(i) & 1 ? 0.5 : 0);
export const HY = (i: Cell): number => Y(i) * 0.866;

export function cube(i: Cell): Cube {
  const c = X(i), r = Y(i);
  const q = c - ((r - (r & 1)) >> 1);
  return [q, r, -q - r];
}

/** Case correspondant à des coordonnées cubiques, ou -1 hors de la carte. */
export function fromCube(q: number, r: number): Cell {
  const c = q + ((r - (r & 1)) >> 1);
  return inb(c, r) ? idx(c, r) : -1;
}

export function hdist(a: Cell, b: Cell): number {
  const A = cube(a), C = cube(b);
  return Math.max(Math.abs(A[0] - C[0]), Math.abs(A[1] - C[1]), Math.abs(A[2] - C[2]));
}

/** Les six directions : est, nord-est, nord-ouest, ouest, sud-ouest, sud-est. */
export const DIRS: readonly [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

export function nbDir(i: Cell, d: number): Cell {
  const [q, r] = cube(i);
  return fromCube(q + DIRS[d][0], r + DIRS[d][1]);
}

export const NBC: Cell[][] = [];
/** Voisins d'une case (six au plus), mis en cache. */
export function nb4(i: Cell): Cell[] {
  let o = NBC[i];
  if (o) return o;
  o = [];
  for (let d = 0; d < 6; d++) {
    const j = nbDir(i, d);
    if (j >= 0) o.push(j);
  }
  return (NBC[i] = o);
}

/** Pour le coin k d'un hexagone, direction du voisin qui partage l'arête suivante. */
export const EDGE_DIR = [1, 0, 5, 4, 3, 2] as const;

export function corner(cx: number, cy: number, k: number, r: number): [number, number] {
  const a = ((60 * k - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

/**
 * Emprise d'un bâtiment posé en (x, y) : 1 case, 3 cases en triangle (taille 2)
 * ou 7 cases en fleur (taille 3). Renvoie null si elle sort de la carte.
 */
export function foot(s: number, x: number, y: number): Cell[] | null {
  if (!inb(x, y)) return null;
  const a = idx(x, y);
  if (s === 1) return [a];
  if (s === 2) {
    const e = nbDir(a, 0), se = nbDir(a, 5);
    return e < 0 || se < 0 ? null : [a, e, se];
  }
  const o = [a];
  for (let d = 0; d < 6; d++) {
    const j = nbDir(a, d);
    if (j < 0) return null;
    o.push(j);
  }
  return o;
}

/** Arrondit des coordonnées cubiques fractionnaires à la case la plus proche. */
export function hexRound(qf: number, rf: number): [number, number] {
  const sf = -qf - rf;
  let q = Math.round(qf), r = Math.round(rf);
  const s = Math.round(sf);
  const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return [q, r];
}

/** Appelle fn pour chaque case à une distance au plus rad de i. */
export function within(i: Cell, rad: number, fn: (j: Cell) => void): void {
  const x0 = X(i), y0 = Y(i);
  for (let y = y0 - rad; y <= y0 + rad; y++)
    for (let x = x0 - rad - 1; x <= x0 + rad + 1; x++) {
      if (!inb(x, y)) continue;
      const j = idx(x, y);
      if (hdist(i, j) <= rad) fn(j);
    }
}

/** Cases traversées par une ligne droite de a à b, extrémités comprises. */
export function hexLine(a: Cell, b: Cell): Cell[] {
  const A = cube(a), C = cube(b), n = hdist(a, b), out: Cell[] = [];
  for (let k = 0; k <= n; k++) {
    const t = n ? k / n : 0;
    const [q, r] = hexRound(A[0] + (C[0] - A[0]) * t + 1e-6, A[1] + (C[1] - A[1]) * t + 1e-6);
    const j = fromCube(q, r);
    if (j >= 0 && !out.includes(j)) out.push(j);
  }
  return out;
}
