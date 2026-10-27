/**
 * Primitives des bâtiments en facettes low-poly : faces aux coins adoucis découpées en triangles de tons
 * voisins, boîtes, toits à pignon ou en croupe, cylindres et cônes, accessoires (tonneaux, caisses, bûches,
 * palissades, bannières, boucliers, menhirs). Coordonnées du plan relatives au centre du bâtiment.
 */
import { HR, corner } from '../core/hex';
import { AC, INK } from '../data/palette';
import { A } from '../app/state';
import { CR, SR, W, fshade, vis } from './projection';
import { P, bbox, sh } from './kit';
import { softShadow } from './terrain';
import { irregular, pathPts, pencil, smoothPts } from './decor';
import type { Pt, Rand } from './types';

/** Motif dessiné à l'intérieur d'une face, après les facettes (veinure d'une porte, par exemple). */
export type Tex = (sp: Pt[], col: string, rnd: Rand) => void;
/** Point du plan local (x, y) et altitude. */
type P3 = [number, number, number];

/** Centres des hexagones d'une emprise de 1, 3 ou 7 cases, relatifs au centre du bâtiment. */
const FOOT: Record<1 | 2 | 3, [number, number][]> = {
  1: [[0, 0]],
  2: [
    [-0.5, -0.2887],
    [0.5, -0.2887],
    [0, 0.5774],
  ],
  3: [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0.5, 0.866],
    [-0.5, 0.866],
    [0.5, -0.866],
    [-0.5, -0.866],
  ],
};
/** Polygone aux coins adoucis (rayon r en pixels). */
function roundPts(sp: Pt[], r: number): Pt[] {
  const n = sp.length,
    o: Pt[] = [];
  for (let k = 0; k < n; k++) {
    const p = sp[(k + n - 1) % n],
      c = sp[k],
      q = sp[(k + 1) % n];
    const l1 = Math.hypot(p[0] - c[0], p[1] - c[1]) || 1,
      l2 = Math.hypot(q[0] - c[0], q[1] - c[1]) || 1,
      f1 = Math.min(0.4, r / l1),
      f2 = Math.min(0.4, r / l2);
    const a = [c[0] + (p[0] - c[0]) * f1, c[1] + (p[1] - c[1]) * f1],
      b = [c[0] + (q[0] - c[0]) * f2, c[1] + (q[1] - c[1]) * f2];
    for (let t = 0; t <= 1.001; t += 0.25) {
      const u = 1 - t;
      o.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
    }
  }
  return o;
}
/** Hachures obliques dans le cadre d'un polygone (à utiliser sous un clip). */
function hatchClip(sp: Pt[], rnd: Rand, dens?: number): void {
  const [a, b, c, d] = bbox(sp);
  const n = Math.max(2, ((c - a) * (d - b) * (dens || 0.035)) | 0);
  A.g.strokeStyle = INK;
  A.g.lineCap = 'round';
  for (let k = 0; k < n; k++) {
    const x = a + rnd() * (c - a),
      y = b + rnd() * (d - b),
      l = 3 + rnd() * 3;
    A.g.globalAlpha = 0.18 + rnd() * 0.2;
    A.g.lineWidth = 0.5 + rnd() * 0.4;
    A.g.beginPath();
    A.g.moveTo(x, y);
    A.g.lineTo(x + l * 0.75, y + l * 0.6);
    A.g.stroke();
  }
  A.g.globalAlpha = 1;
}
/* une face : remplissage aux coins adoucis, texture, ombre hachurée si la face est sombre, trait de crayon */
/* facettes : chaque face est découpée en triangles de tons voisins, sans texture, pour un vrai rendu low-poly */
/** Découpe un polygone en triangles de tons voisins autour d'un centre décalé : l'aspect low-poly. */
function facets(sp: Pt[], col: string, rnd: Rand, amp: number): void {
  const n = sp.length;
  let cx = 0,
    cy = 0;
  for (const p of sp) {
    cx += p[0];
    cy += p[1];
  }
  cx /= n;
  cy /= n;
  const [a, b, c, d] = bbox(sp);
  const ct: Pt = [cx + (rnd() - 0.5) * (c - a) * 0.3, cy + (rnd() - 0.5) * (d - b) * 0.3];
  for (let k = 0; k < n; k++) {
    const p = sp[k],
      q = sp[(k + 1) % n],
      L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (L > 16) {
      const m: Pt = [(p[0] + q[0]) / 2 + (rnd() - 0.5) * 3, (p[1] + q[1]) / 2 + (rnd() - 0.5) * 3];
      for (const [u, v] of [
        [p, m],
        [m, q],
      ]) {
        const f = 1 + (rnd() - 0.5) * amp;
        P([ct, u, v], sh(col, f), sh(col, f), 0.6);
      }
    } else {
      const f = 1 + (rnd() - 0.5) * amp;
      P([ct, p, q], sh(col, f), sh(col, f), 0.6);
    }
  }
}
/** Une face : remplissage aux coins adoucis, facettes, motif éventuel, trait de crayon d'épaisseur pw. */
function face(sp: Pt[], col: string, rnd: Rand, tex?: Tex | null, pw?: number): Pt[] {
  const rp = roundPts(sp, 1.6);
  pathPts(rp, true);
  A.g.fillStyle = col;
  A.g.fill();
  A.g.save();
  pathPts(rp, true);
  A.g.clip();
  facets(sp, col, rnd, 0.16);
  if (tex) tex(sp, col, rnd);
  A.g.restore();
  pencil(rp, true, pw || 0.75, rnd, INK, 0.6);
  return rp;
}

/** Pavé de (x0, y0) à (x1, y1), de z0 à z1 : faces visibles, puis le dessus s'il a une couleur. */
function box(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  z0: number,
  z1: number,
  col: string,
  rnd: Rand,
  tex?: Tex | null,
  top?: string,
): void {
  const fs = [
    [x0, y1, x1, y1, 0, 1],
    [x1, y0, x1, y1, 1, 0],
    [x0, y0, x0, y1, -1, 0],
    [x0, y0, x1, y0, 0, -1],
  ];
  for (const [ax, ay, bx, by, nx, ny] of fs) {
    if (!vis(nx, ny)) continue;
    const f = fshade(nx, ny);
    face([W(ax, ay, z0), W(bx, by, z0), W(bx, by, z1), W(ax, ay, z1)], sh(col, f * 1.1), rnd, tex);
  }
  if (top) face([W(x0, y0, z1), W(x1, y0, z1), W(x1, y1, z1), W(x0, y1, z1)], top, rnd, null, 0.8);
}
/** Direction du plan tournée vers la caméra. */
function frontPt(): number {
  return Math.atan2(CR, SR);
}
/** Rectangle de largeur w et de hauteur h sur la façade y = y1, centré en xc. */
function onFront(x0: number, x1: number, y1: number, xc: number, w: number, z0: number, h: number): Pt[] {
  return [W(xc - w / 2, y1, z0), W(xc + w / 2, y1, z0), W(xc + w / 2, y1, z0 + h), W(xc - w / 2, y1, z0 + h)];
}
function door2(xc: number, y1: number, z0: number, w: number, h: number, rnd: Rand, col?: string): void {
  face(
    onFront(0, 0, y1, xc, w, z0, h),
    col || AC.guede,
    rnd,
    (sp, c) => {
      A.g.strokeStyle = sh(c, 0.7);
      A.g.lineWidth = 0.6;
      const [a, b, cc, d] = bbox(sp);
      A.g.beginPath();
      A.g.moveTo((a + cc) / 2, b);
      A.g.lineTo((a + cc) / 2, d);
      A.g.stroke();
    },
    0.8,
  );
}
/** Fenêtre à volets bleus. */
function win2(xc: number, y1: number, z0: number, rnd: Rand): void {
  face(onFront(0, 0, y1, xc, 0.07, z0, 4), '#2b2b33', rnd, null, 0.6);
  for (const s of [-1, 1]) face(onFront(0, 0, y1, xc + s * 0.06, 0.05, z0, 4), AC.guede, rnd, null, 0.5);
}
/** Toit à deux pans sur le pavé (x0, y0)-(x1, y1), posé à z, de hauteur h ; endCol colore le pignon. */
function gable2(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  z: number,
  h: number,
  col: string,
  rnd: Rand,
  endCol?: string,
  kind?: 'slate',
): void {
  const ym = (y0 + y1) / 2,
    X0 = x0 - 0.06,
    X1 = x1 + 0.06,
    Y0 = y0 - 0.08,
    Y1 = y1 + 0.08,
    left = vis(-1, 0),
    xw = left ? x0 : x1,
    xe = left ? X0 : X1;
  face([W(X0, Y0, z), W(X1, Y0, z), W(X1, ym, z + h), W(X0, ym, z + h)], sh(col, 1.12), rnd, null, 0.9);
  face([W(xw, y0, z), W(xw, y1, z), W(xw, ym, z + h)], sh(endCol || AC.chaux, fshade(left ? -1 : 1, 0) * 1.08), rnd, null, 0.9);
  face([W(X0, ym, z + h), W(X1, ym, z + h), W(X1, Y1, z), W(X0, Y1, z)], sh(col, fshade(0, 1) * 1.12), rnd, null, 1);
  A.g.strokeStyle = sh(col, 0.55);
  A.g.lineWidth = 2.4;
  A.g.lineCap = 'round';
  A.g.beginPath();
  const e1 = W(X0, Y1, z),
    e2 = W(X1, Y1, z);
  A.g.moveTo(e1[0], e1[1]);
  A.g.lineTo(e2[0], e2[1]);
  A.g.stroke();
  const v1 = W(xe, Y0, z),
    v2 = W(xe, ym, z + h),
    v3 = W(xe, Y1, z);
  A.g.lineWidth = 2.6;
  A.g.beginPath();
  A.g.moveTo(v1[0], v1[1]);
  A.g.lineTo(v2[0], v2[1]);
  A.g.lineTo(v3[0], v3[1]);
  A.g.stroke();
  pencil([W(X0, ym, z + h + 1), W(X1, ym, z + h + 1)], false, 1.6, rnd);
}
/** Toit en croupe (quatre pans) ; ins > 0 laisse un faîtage, 0 donne une pyramide. */
function hip2(
  X0: number,
  Y0: number,
  X1: number,
  Y1: number,
  z: number,
  h: number,
  col: string,
  rnd: Rand,
  ins: number,
  kind?: 'slate',
): void {
  const cx = (X0 + X1) / 2,
    cy = (Y0 + Y1) / 2,
    a = ins ? [X0 + ins, Y0 + ins, X1 - ins, Y1 - ins] : [cx, cy, cx, cy],
    zh = z + h;
  const fs: [P3[], number, number][] = [
    [
      [
        [X0, Y0, z],
        [X1, Y0, z],
        [a[2], a[1], zh],
        [a[0], a[1], zh],
      ],
      0,
      -1,
    ],
    [
      [
        [X0, Y0, z],
        [a[0], a[1], zh],
        [a[0], a[3], zh],
        [X0, Y1, z],
      ],
      -1,
      0,
    ],
    [
      [
        [X0, Y1, z],
        [a[0], a[3], zh],
        [a[2], a[3], zh],
        [X1, Y1, z],
      ],
      0,
      1,
    ],
    [
      [
        [X1, Y0, z],
        [X1, Y1, z],
        [a[2], a[3], zh],
        [a[2], a[1], zh],
      ],
      1,
      0,
    ],
  ];
  fs.sort((p, q) => p[1] * SR + p[2] * CR - (q[1] * SR + q[2] * CR));
  for (const [pp, nx, ny] of fs) {
    const sp = pp.map(p => W(p[0], p[1], p[2])),
      v = vis(nx, ny),
      f = v ? fshade(nx, ny) * 1.15 : 1.12;
    face(sp, sh(col, f), rnd, null, v ? 1 : 0.7);
  }
}

/** Nombre de facettes des cylindres et des cônes. */
const NC = 8;
/** Cylindre (tour, silo, puits) de rayon r, de z0 à z1. */
function cyl(cx: number, cy: number, r: number, z0: number, z1: number, col: string, rnd: Rand, tex?: Tex | null): void {
  for (let k = 0; k < NC; k++) {
    const a0 = (k / NC) * Math.PI * 2,
      a1 = ((k + 1) / NC) * Math.PI * 2,
      am = (a0 + a1) / 2,
      nx = Math.cos(am),
      ny = Math.sin(am);
    if (!vis(nx, ny)) continue;
    const sp: Pt[] = [
      W(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, z0),
      W(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, z0),
      W(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, z1),
      W(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, z1),
    ];
    const f = fshade(nx, ny),
      c1 = sh(col, f * 1.1 * (1 + (rnd() - 0.5) * 0.08)),
      c2 = sh(col, f * 1.1 * (0.94 + (rnd() - 0.5) * 0.06));
    P([sp[0], sp[1], sp[2]], c1, c1, 0.7);
    P([sp[0], sp[2], sp[3]], c2, c2, 0.7);
  }
  const outl: [number, Pt][] = [];
  for (let k = 0; k <= 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    const nx = Math.cos(a),
      ny = Math.sin(a);
    if (nx * SR + ny * CR >= -0.05) outl.push([a, W(cx + nx * r, cy + ny * r, z0)]);
  }
  outl.sort((p, q) => p[1][0] - q[1][0]);
  if (outl.length > 1) {
    const L = outl.map(p => p[1]);
    pencil(L, false, 0.9, rnd);
    const l = L[0],
      rr = L[L.length - 1];
    pencil([l, [l[0], l[1] - (z1 - z0)]], false, 0.9, rnd);
    pencil([rr, [rr[0], rr[1] - (z1 - z0)]], false, 0.9, rnd);
  }
}
/** Toit conique en facettes (chaume par défaut, ardoise avec kind 'slate'). */
function cone(cx: number, cy: number, r: number, z: number, h: number, col: string, rnd: Rand, kind?: 'slate'): void {
  const ap = W(cx - 0.015, cy - 0.02, z + h),
    fs: [number, number, number, number][] = [];
  for (let k = 0; k < NC; k++) {
    const a0 = (k / NC) * Math.PI * 2,
      a1 = ((k + 1) / NC) * Math.PI * 2,
      am = (a0 + a1) / 2;
    fs.push([a0, a1, Math.cos(am), Math.sin(am)]);
  }
  fs.sort((p, q) => p[2] * SR + p[3] * CR - (q[2] * SR + q[3] * CR));
  for (const [a0, a1, nx, ny] of fs) {
    const sp = [W(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, z), W(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, z), ap];
    const v = nx * SR + ny * CR > 0,
      f = v ? Math.min(1.25, fshade(nx, ny) * 1.18 + 0.06) : 1.1;
    P(sp, sh(col, f), sh(col, f), 0.8);
    if (v) {
      const m0: Pt = [sp[0][0] + (ap[0] - sp[0][0]) * 0.45, sp[0][1] + (ap[1] - sp[0][1]) * 0.45],
        m1: Pt = [sp[1][0] + (ap[0] - sp[1][0]) * 0.45, sp[1][1] + (ap[1] - sp[1][1]) * 0.45],
        c2 = sh(col, f * (1.07 + (rnd() - 0.5) * 0.05));
      P([m0, m1, ap], c2, c2, 0.7);
      const c3 = sh(col, f * (0.95 + (rnd() - 0.5) * 0.05));
      P([sp[0], sp[1], m1], c3, c3, 0.6);
    }
  }
  const base: Pt[] = [];
  for (let k = 0; k <= 24; k++) {
    const a = (k / 24) * Math.PI * 2,
      nx = Math.cos(a),
      ny = Math.sin(a);
    if (nx * SR + ny * CR >= -0.2) base.push(W(cx + nx * r, cy + ny * r, z));
  }
  base.sort((p, q) => p[0] - q[0]);
  A.g.strokeStyle = sh(col, 0.55);
  A.g.lineWidth = 2.4;
  A.g.lineCap = 'round';
  A.g.beginPath();
  base.forEach((p, k) => (k ? A.g.lineTo(p[0], p[1]) : A.g.moveTo(p[0], p[1])));
  A.g.stroke();
  pencil(base, false, 1, rnd);
  pencil([base[0], ap, base[base.length - 1]], false, 1, rnd);
}
/** Porte sur la face avant d'un cylindre. */
function cylDoor(cx: number, cy: number, r: number, z0: number, h: number, rnd: Rand, col?: string): void {
  const a = frontPt(),
    x = cx + Math.cos(a) * r,
    y = cy + Math.sin(a) * r,
    t = [-Math.sin(a) * 0.06, Math.cos(a) * 0.06];
  face(
    [W(x - t[0], y - t[1], z0), W(x + t[0], y + t[1], z0), W(x + t[0], y + t[1], z0 + h), W(x - t[0], y - t[1], z0 + h)],
    col || AC.guede,
    rnd,
    null,
    0.8,
  );
}
/** Sol de l'emprise (s : 1, 2 ou 3), en hexagones arrondis légèrement rentrés. */
function ground(s: 1 | 2 | 3, col: string, rnd: Rand, ins?: number): void {
  for (const [ox, oy] of FOOT[s]) {
    const sp: Pt[] = [];
    for (let k = 0; k < 6; k++) {
      const [x, y] = corner(ox, oy, k, HR * (ins || 0.9));
      sp.push(W(x, y, 0.4));
    }
    const rp = roundPts(sp, 4);
    pathPts(rp, true);
    A.g.fillStyle = col;
    A.g.fill();
    A.g.save();
    pathPts(rp, true);
    A.g.clip();
    facets(sp, col, rnd, 0.1);
    A.g.restore();
    pencil(rp, true, 0.6, rnd, INK, 0.35);
  }
}
/** Poteau de bois. */
function post(x: number, y: number, z0: number, z1: number, rnd: Rand, col?: string): void {
  const a = W(x, y, z0),
    b = W(x, y, z1);
  A.g.strokeStyle = col || AC.bois;
  A.g.lineWidth = 2.2;
  A.g.lineCap = 'round';
  A.g.beginPath();
  A.g.moveTo(a[0], a[1]);
  A.g.lineTo(b[0], b[1]);
  A.g.stroke();
  pencil(
    [
      [a[0] + 1.3, a[1]],
      [b[0] + 1.3, b[1]],
    ],
    false,
    0.5,
    rnd,
  );
}
function barrel3(x: number, y: number, rnd: Rand): void {
  cyl(x, y, 0.045, 0, 7, AC.bois, rnd);
  const t = W(x, y, 7);
  A.g.fillStyle = AC.boisC;
  A.g.beginPath();
  A.g.ellipse(t[0], t[1], 2.4, 1.4, 0, 0, 7);
  A.g.fill();
  for (const z of [2, 5]) {
    const p = W(x, y, z);
    A.g.strokeStyle = '#3e3228';
    A.g.lineWidth = 0.6;
    A.g.beginPath();
    A.g.ellipse(p[0], p[1], 2.6, 1.5, 0, 0, Math.PI);
    A.g.stroke();
  }
}
function crate3(x: number, y: number, sz: number, rnd: Rand): void {
  box(x - sz, y - sz, x + sz, y + sz, 0, sz * 60, AC.boisC, rnd, null, sh(AC.boisC, 1.15));
}
/** Amphore de vin, venue du sud par la mer. */
function amph3(x: number, y: number, rnd: Rand): void {
  const p = W(x, y);
  const sp: Pt[] = [
    [p[0] - 2.5, p[1]],
    [p[0] - 3.4, p[1] - 6],
    [p[0] - 1.2, p[1] - 11],
    [p[0] + 1.2, p[1] - 11],
    [p[0] + 3.4, p[1] - 6],
    [p[0] + 2.5, p[1]],
  ];
  const rp = roundPts(sp, 2);
  pathPts(rp, true);
  A.g.fillStyle = AC.ocre;
  A.g.fill();
  A.g.fillStyle = sh(AC.ocre, 0.75);
  A.g.beginPath();
  A.g.ellipse(p[0] + 1.4, p[1] - 5, 1.4, 4, 0, 0, 7);
  A.g.fill();
  pencil(rp, true, 0.6, rnd);
}
/** Pile de n rondins. */
function logs3(x: number, y: number, n: number, rnd: Rand): void {
  for (let k = 0; k < n; k++) {
    const row = k < 3 ? 0 : 1,
      i = row ? k - 3 : k,
      a = W(x - 0.12, y + i * 0.06, 1.8 + row * 3.2),
      b = W(x + 0.12, y + i * 0.06, 1.8 + row * 3.2);
    A.g.strokeStyle = AC.bois;
    A.g.lineWidth = 3.4;
    A.g.lineCap = 'round';
    A.g.beginPath();
    A.g.moveTo(a[0], a[1]);
    A.g.lineTo(b[0], b[1]);
    A.g.stroke();
    A.g.fillStyle = '#e0c08a';
    A.g.beginPath();
    A.g.ellipse(b[0], b[1], 1.7, 1.6, 0, 0, 7);
    A.g.fill();
    pencil(
      [
        [a[0], a[1] - 1.7],
        [b[0], b[1] - 1.7],
      ],
      false,
      0.5,
      rnd,
    );
  }
}
/** Palissade de hauteur h le long des points du plan. */
function fence3(pts: [number, number][], h: number, rnd: Rand): void {
  for (let k = 0; k < pts.length; k++) {
    const p = pts[k];
    post(p[0], p[1], 0, h, rnd, AC.boisC);
  }
  for (const z of [h * 0.4, h * 0.8]) {
    const L = pts.map(p => W(p[0], p[1], z));
    A.g.strokeStyle = AC.bois;
    A.g.lineWidth = 1;
    A.g.beginPath();
    L.forEach((p, k) => (k ? A.g.lineTo(p[0], p[1]) : A.g.moveTo(p[0], p[1])));
    A.g.stroke();
  }
}
/** n points sur une ellipse du plan. */
function ring(cx: number, cy: number, rx: number, ry: number, n: number): [number, number][] {
  const o: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    o.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return o;
}
/** Mât et bannière aux couleurs du clan. */
function banner(x: number, y: number, z0: number, h: number, col: string, rnd: Rand): void {
  post(x, y, z0, z0 + h, rnd, '#5a4030');
  const p = W(x, y, z0 + h);
  const sp: Pt[] = [
    [p[0] + 1, p[1]],
    [p[0] + 13, p[1] - 2],
    [p[0] + 12, p[1] + 8],
    [p[0] + 1, p[1] + 9],
  ];
  const rp = roundPts(sp, 2);
  pathPts(rp, true);
  A.g.fillStyle = col;
  A.g.fill();
  pencil(rp, true, 0.6, rnd);
  A.g.strokeStyle = AC.chaux;
  A.g.lineWidth = 0.8;
  A.g.beginPath();
  A.g.arc(p[0] + 7, p[1] + 3.6, 2, 0, 5.2);
  A.g.stroke();
}
function shield3(x: number, y: number, z: number, col: string, rnd: Rand): void {
  const p = W(x, y, z);
  A.g.fillStyle = col;
  A.g.beginPath();
  A.g.ellipse(p[0], p[1], 2.6, 4.2, 0, 0, 7);
  A.g.fill();
  A.g.fillStyle = AC.chaux;
  A.g.beginPath();
  A.g.arc(p[0], p[1], 0.9, 0, 7);
  A.g.fill();
  pencil(smoothPts(irregular(p[0], p[1], 2.6, 4.2, 8, rnd, 0.05)), true, 0.5, rnd);
}
/** Menhir de hauteur h. */
function menhir3(x: number, y: number, h: number, rnd: Rand): void {
  const p = W(x, y);
  softShadow(p[0] + 4, p[1] + 1, 6, 2.4);
  const sp: Pt[] = [
    [p[0] - 4, p[1]],
    [p[0] - 4.5, p[1] - h * 0.55],
    [p[0] - 2, p[1] - h],
    [p[0] + 2.5, p[1] - h * 0.94],
    [p[0] + 4.5, p[1] - h * 0.5],
    [p[0] + 4, p[1]],
  ];
  const rp = roundPts(sp, 2.5);
  pathPts(rp, true);
  A.g.fillStyle = AC.granit;
  A.g.fill();
  A.g.save();
  pathPts(rp, true);
  A.g.clip();
  A.g.fillStyle = AC.granitD;
  A.g.fillRect(p[0] + 0.6, p[1] - h - 2, 6, h + 3);
  hatchClip(sp, rnd, 0.05);
  A.g.fillStyle = '#e2d68c';
  A.g.beginPath();
  A.g.ellipse(p[0] - 1, p[1] - h * 0.6, 1.2, 0.8, 0, 0, 7);
  A.g.fill();
  A.g.restore();
  pencil(rp, true, 0.9, rnd);
}

export {
  FOOT,
  NC,
  amph3,
  banner,
  barrel3,
  box,
  cone,
  crate3,
  cyl,
  cylDoor,
  door2,
  face,
  facets,
  fence3,
  frontPt,
  gable2,
  ground,
  hatchClip,
  hip2,
  logs3,
  menhir3,
  onFront,
  post,
  ring,
  roundPts,
  shield3,
  win2,
};
