/**
 * Projection de la carte à l'écran. Grille hexagonale à pointe en haut, lignes impaires décalées,
 * vue tournée de 20° (orientée N-NE) et inclinée. Les coordonnées du plan sont en hexagones,
 * l'altitude z en pixels.
 */
import { HR, HX, HY, corner, nb4, type Cell } from '../core/hex';
import type { Building } from '../core/state';
import { tilesOf } from '../sim/query';
import { TER } from '../world/terrain';
import { A } from '../app/state';
import { P } from './kit';
import { geo } from './terrain';
import type { Pt } from './types';

/** Largeur d'un hexagone en pixels, écrasement vertical de la vue, niveau de la mer. */
export const HW = 56;
export const TILT = 0.62;
export const ZW = -10;
/** Rotation de la vue. */
export const ROT = (-20 * Math.PI) / 180;
export const CR = Math.cos(ROT);
export const SR = Math.sin(ROT);
/** Hauteur d'un niveau de relief, en pixels. */
export const STEP = 9;

/** Point du plan (x, y en hexagones, z en pixels) vers l'écran, dans le repère local s'il y en a un. */
export function W(x: number, y: number, z = 0): Pt {
  if (A.LOC) {
    x = (x - A.LOC.c) * A.LOC.k + A.LOC.ox;
    y = (y - A.LOC.c) * A.LOC.k + A.LOC.oy;
    z += A.LOC.z || 0;
  }
  return [(x * CR - y * SR) * HW, (x * SR + y * CR) * HW * TILT - z];
}

/** Profondeur d'un point du plan : ce qui est plus profond se dessine après. */
export const DP2 = (x: number, y: number): number => x * SR + y * CR;
export const DPi = (i: Cell): number => DP2(HX(i), HY(i));

/** Une face de normale (nx, ny) dans le plan est-elle tournée vers nous ? */
export const vis = (nx: number, ny: number): boolean => nx * SR + ny * CR > 0.03;

/** Éclairage d'une face verticale selon sa normale. */
export const fshade = (nx: number, ny: number): number => 0.78 - 0.18 * (nx * CR - ny * SR);

/** Côtés d'un hexagone visibles depuis la caméra. */
export const VISK = [0, 1, 2, 3, 4, 5].filter(k => {
  const a = ((60 * k - 60) * Math.PI) / 180;
  return vis(Math.cos(a), Math.sin(a));
});

/** Les six coins d'un hexagone de centre (cx, cy) et de rayon r, à l'altitude z. */
export function hexPts(cx: number, cy: number, r: number, z?: number): Pt[] {
  const o: Pt[] = [];
  for (let k = 0; k < 6; k++) {
    const [x, y] = corner(cx, cy, k, r);
    o.push(W(x, y, z));
  }
  return o;
}

/** Altitude d'une case en pixels. Un pont prend la hauteur de la rive la plus basse. */
export function ZH(i: Cell): number {
  const S = A.S;
  if (S.ter[i] === TER.sea) {
    if (!S.road[i]) return ZW;
    let m = 99;
    for (const j of nb4(i)) if (S.ter[j] !== TER.sea) m = Math.min(m, S.hgt ? S.hgt[j] * STEP : 0);
    return m === 99 ? 0 : m;
  }
  return S.hgt ? S.hgt[i] * STEP : 0;
}

/**
 * Remplit ou entoure une case en suivant son relief : sert aux surbrillances (survol, vues, sélection).
 * ins réduit l'hexagone (1 : pleine taille) ; z impose une altitude plate.
 */
export function hexI(i: Cell, fill: string | null, stroke: string | null, lw: number, ins = 1, z?: number): void {
  if (z != null || (A.S.ter[i] === TER.sea && !A.S.road[i])) {
    P(hexPts(HX(i), HY(i), HR * ins, z == null ? ZH(i) : z), fill, stroke, lw);
    return;
  }
  const G = geo(i),
    cx = HX(i),
    cy = HY(i),
    o: Pt[] = [];
  for (let k = 0; k < 6; k++) {
    const [x, y] = corner(cx, cy, k, HR * ins);
    o.push(W(x, y, G.zc + (G.zs[k] - G.zc) * ins + 0.5));
  }
  P(o, fill, stroke, lw);
}

/** Centre d'un bâtiment dans le plan : moyenne des cases qu'il occupe. */
export function bc(b: Building): [number, number] {
  const t = tilesOf(b);
  let x = 0,
    y = 0;
  for (const i of t) {
    x += HX(i);
    y += HY(i);
  }
  return [x / t.length, y / t.length];
}
