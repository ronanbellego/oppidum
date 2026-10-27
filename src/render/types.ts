/** Types communs au dessin. */

/** Point à l'écran (avant zoom de la caméra). */
export type Pt = [number, number];

/** Point du plan de la carte avec une altitude : x, y en hexagones, z en pixels. */
export type Pt3 = [number, number, number];

/** Tirage pseudo-aléatoire entre 0 et 1, issu d'une graine (dessin reproductible). */
export type Rand = () => number;

/** Image mise en cache et son cadre, relatif au point d'ancrage. */
export interface Sprite {
  c: HTMLCanvasElement;
  x0: number;
  y0: number;
  w: number;
  h: number;
}

/**
 * Repère local : quand il est posé, les coordonnées passées à W sont relatives à un point de la carte
 * (centre c, échelle k, origine ox, oy, altitude z). Sert à dessiner un bâtiment autour de son centre.
 */
export interface LocalFrame {
  c: number;
  k: number;
  ox: number;
  oy: number;
  z?: number;
}
