/**
 * Boîte à outils du dessin : nuances de couleur, sprites mis en cache, polygones, traits, hachures.
 * Tout se dessine dans A.g, qui est l'écran ou le canevas d'un sprite en cours de préparation.
 */
import { hashS, rng } from '../core/rng';
import { A } from '../app/state';
import type { Pt, Rand, Sprite } from './types';

const shc: Record<string, string> = {};
/** Couleur assombrie (f < 1) ou éclaircie (f > 1), en hexadécimal ou rgb(). */
function sh(col: string, f: number): string {
  const k = col + f;
  if (shc[k]) return shc[k];
  let r: number, gg: number, bb: number;
  if (col[0] === '#') {
    const n = parseInt(col.slice(1), 16);
    r = n >> 16;
    gg = (n >> 8) & 255;
    bb = n & 255;
  } else {
    const m = col.match(/[\d.]+/g)!;
    r = +m[0];
    gg = +m[1];
    bb = +m[2];
  }
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return (shc[k] = `rgb(${c(r)},${c(gg)},${c(bb)})`);
}
/** Suréchantillonnage des sprites, pour qu'ils restent nets au zoom. */
const SK = (window.devicePixelRatio || 1) > 1 ? 3 : 2;
const SPR: Record<string, Sprite> = {};
/** Contour sombre des petits objets. */
const OUT = 'rgba(30,18,8,.55)';

/** Nouveau canevas 2D de la taille donnée. */
function canvas2d(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/**
 * Sprite dessiné une seule fois puis réutilisé. fn dessine dans le cadre (x0, y0)-(x1, y1) autour du point
 * d'ancrage, avec un tirage dont la graine dépend de la clé : le même sprite est toujours identique.
 * halo ajoute le contour au crayon.
 */
function sprite(key: string, x0: number, y0: number, x1: number, y1: number, fn: (rnd: Rand) => void, halo?: boolean): Sprite {
  const o = SPR[key];
  if (o) return o;
  const w = x1 - x0,
    h = y1 - y0;
  let [c, g] = canvas2d(Math.ceil(w * SK), Math.ceil(h * SK));
  const prev = A.g;
  A.g = g;
  A.g.setTransform(SK, 0, 0, SK, -x0 * SK, -y0 * SK);
  A.g.lineJoin = 'round';
  A.g.lineCap = 'round';
  try {
    fn(rng(hashS(key)));
  } finally {
    A.g = prev;
  }
  if (halo) c = crayon(c, hashS(key));
  return (SPR[key] = { c, x0, y0, w, h });
}
/* contour au crayon : une silhouette sombre, décalée en couronne et grainée, posée sous le dessin */
function crayon(c: HTMLCanvasElement, seed: number): HTMLCanvasElement {
  const W2 = c.width,
    H2 = c.height;
  const [sil, s2] = canvas2d(W2, H2);
  s2.drawImage(c, 0, 0);
  s2.globalCompositeOperation = 'source-in';
  s2.fillStyle = '#221e18';
  s2.fillRect(0, 0, W2, H2);
  const [grain, gr] = canvas2d(W2, H2);
  const rr = rng(seed);
  for (const [rad, a] of [
    [2.4 * SK, 0.09],
    [1.5 * SK, 0.16],
    [0.8 * SK, 0.2],
  ]) {
    gr.globalAlpha = a;
    for (let k = 0; k < 10; k++) {
      const an = (k / 10) * Math.PI * 2 + rr() * 0.3,
        d = rad * (0.75 + rr() * 0.5);
      gr.drawImage(sil, Math.cos(an) * d, Math.sin(an) * d);
    }
  }
  gr.globalAlpha = 1;
  gr.globalCompositeOperation = 'destination-out';
  for (let k = 0; k < (W2 * H2) / 90; k++) {
    gr.fillStyle = `rgba(0,0,0,${0.25 + rr() * 0.5})`;
    gr.fillRect(rr() * W2, rr() * H2, 1 + rr() * 1.5, 1 + rr() * 1.5);
  }
  const [out, o] = canvas2d(W2, H2);
  o.drawImage(grain, 0, 0);
  o.drawImage(c, 0, 0);
  return out;
}
/** Pose un sprite à son point d'ancrage. */
function blit(s: Sprite, ax: number, ay: number): void {
  A.g.drawImage(s.c, ax + s.x0, ay + s.y0, s.w, s.h);
}
/** Polygone rempli et/ou entouré. */
function P(pts: Pt[], fill?: string | null, stroke?: string | null, lw?: number): void {
  A.g.beginPath();
  A.g.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k < pts.length; k++) A.g.lineTo(pts[k][0], pts[k][1]);
  A.g.closePath();
  if (fill) {
    A.g.fillStyle = fill;
    A.g.fill();
  }
  if (stroke) {
    A.g.strokeStyle = stroke;
    A.g.lineWidth = lw || 1;
    A.g.stroke();
  }
}
/** Segment. */
function ln(a: Pt, b: Pt, c: string, w: number): void {
  A.g.strokeStyle = c;
  A.g.lineWidth = w;
  A.g.beginPath();
  A.g.moveTo(a[0], a[1]);
  A.g.lineTo(b[0], b[1]);
  A.g.stroke();
}
/** Cadre englobant : [xmin, ymin, xmax, ymax]. */
function bbox(pts: Pt[]): [number, number, number, number] {
  let a = 1e9,
    b = 1e9,
    c = -1e9,
    d = -1e9;
  for (const p of pts) {
    a = Math.min(a, p[0]);
    b = Math.min(b, p[1]);
    c = Math.max(c, p[0]);
    d = Math.max(d, p[1]);
  }
  return [a, b, c, d];
}
/** Élément tiré au hasard. */
function pick3<T>(rnd: Rand, a: readonly T[]): T {
  return a[(rnd() * a.length) | 0];
}
/** Flou doux pour les ombres portées, ignoré par les navigateurs qui ne le gèrent pas. */
function blur(on: boolean | number): void {
  try {
    A.g.filter = on ? 'blur(3.5px)' : 'none';
  } catch (e) {}
}

export { OUT, P, bbox, blit, blur, ln, pick3, sh, sprite };
