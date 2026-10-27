/**
 * Terrain en facettes low-poly : chaque case est un hexagone aux coins arrondis dont les sommets suivent
 * le relief voisin (pentes continues, sans terrasses), bordé de falaises vers la mer. Les terres sont
 * peintes par blocs dans des canevas mis en cache ; la mer est posée case par case.
 */
import { N } from '../core/constants';
import { EDGE_DIR, HR, HX, HY, corner, idx, nb4, nbDir, type Cell } from '../core/hex';
import { TER, landDistance, seaDepth } from '../world/terrain';
import { TCOL } from '../data/palette';
import { A } from '../app/state';
import type { GameState } from '../core/state';
import type { Pt, Pt3, Rand, Sprite } from './types';
import { DPi, HW, ROT, STEP, VISK, W, ZH, ZW, fshade, hexPts, vis } from './projection';
import { P, blit, blur, ln, pick3, sh, sprite } from './kit';

/** Distance à la terre (pour la mer) et profondeur de la mer, recalculées à chaque nouvelle île. */
export let DEP = new Uint8Array(N * N);
export let LD = new Uint8Array(N * N);

/** Coin d'un contour arrondi : x, y en hexagones, altitude, coin de l'hexagone dont il provient. */
type RimPt = [number, number, number, number];
/** Polygone à l'écran et sa couleur. */
type Poly = [Pt[], string];
/** Aspect d'une case : b plage, g prairie, l lande, f sous-bois, r éboulis. */
type LandKind = 'b' | 'g' | 'l' | 'f' | 'r';

/** Géométrie d'une case de terre, prête à peindre. */
interface TileGeo {
  /** Facettes du dessus, falaises visibles, sous-couche qui comble les joints. */
  tris: Poly[];
  cliffs: Poly[];
  under: Poly;
  kind: LandKind;
  /** Altitude du centre et des six coins. */
  zc: number;
  zs: number[];
}

/** Géométrie des cases et blocs de terrain peints, valables pour une partie et une version du relief. */
let GEO: TileGeo[] = [],
  GEOS: GameState | null = null,
  GEOV = -1;
let CHK: Record<string, Sprite | null> = {},
  CHKS: GameState | null = null,
  CHKV = -1;

/** Recalcule la profondeur de la mer et la distance à la terre (nouvelle île ou partie chargée). */
function computeDep(): void {
  LD = landDistance(A.S.ter);
  DEP = seaDepth(A.S.ter);
}
/** Hexagone arrondi plat découpé en facettes, centré sur l'origine : le fond des cases de mer. */
function facetRound(base: string, rnd: Rand, amp: number): void {
  const cs: [number, number][] = [];
  for (let k = 0; k < 6; k++) cs.push(corner(0, 0, k, HR));
  const top = rbound(cs, [0, 0, 0, 0, 0, 0], null).map((p): RimPt => [p[0] * INS, p[1] * INS, 0, p[3]]);
  const c = [(rnd() - 0.5) * 0.12, (rnd() - 0.5) * 0.1];
  for (let k = 0; k < top.length; k++) {
    const a = top[k],
      b = top[(k + 1) % top.length];
    const mid = Math.atan2((a[1] + b[1]) / 2, (a[0] + b[0]) / 2);
    const f = 1 + amp * Math.cos(mid + ROT - Math.PI * 1.25) + (((a[3] * 37) % 7) / 7 - 0.5) * amp * 0.5;
    P([W(c[0], c[1]), W(a[0], a[1]), W(b[0], b[1])], sh(base, f), sh(base, f), 0.4);
  }
}
/** Petite touffe en facettes (herbe, bruyère, galets). */
function clump(x: number, y: number, r: number, cols: string, rnd: Rand, h: number): void {
  const n = 5 + ((rnd() * 2) | 0),
    pts: Pt[] = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + rnd() * 0.4;
    pts.push([x + Math.cos(a) * r * (0.75 + rnd() * 0.4), y + Math.sin(a) * r * 0.55 * (0.75 + rnd() * 0.4)]);
  }
  const top = [x - r * 0.15, y - h];
  for (let k = 0; k < n; k++) {
    const a = pts[k],
      b = pts[(k + 1) % n];
    const m = Math.atan2((a[1] + b[1]) / 2 - y, (a[0] + b[0]) / 2 - x);
    P([top as Pt, a, b], sh(cols, 1 + 0.14 * Math.cos(m - Math.PI * 1.25)));
  }
}
/** Direction de la lumière (normée), et éclairage d'une surface horizontale. */
const LIGHT = (() => {
    const v = [-0.45, -0.55, 0.9],
      n = Math.hypot(...v);
    return v.map(a => a / n);
  })(),
  FLAT = LIGHT[2];
/** Altitude du coin k d'une case : moyenne avec les deux voisines qui le partagent, abaissée au bord de l'eau. */
function cornerZ(i: Cell, k: number): number {
  const a = nbDir(i, EDGE_DIR[k]),
    b = nbDir(i, EDGE_DIR[(k + 5) % 6]);
  let s = (A.S.hgt ? A.S.hgt[i] : 0) * STEP,
    n = 1,
    wet = false;
  for (const j of [a, b]) {
    if (j < 0) continue;
    if (A.S.ter[j] === TER.sea && !A.S.road[j]) {
      wet = true;
      continue;
    }
    s += (A.S.hgt ? A.S.hgt[j] : 0) * STEP;
    n++;
  }
  const z = s / n;
  return wet && z < STEP * 1.6 ? ZW + 3 : z;
}
function isBeach(i: Cell): boolean {
  return A.S.ter[i] === TER.prairie && (!A.S.hgt || A.S.hgt[i] <= 1) && nb4(i).some(j => A.S.ter[j] === TER.sea && !A.S.road[j]);
}
/** Part de chaque côté rognée pour arrondir un coin, et réduction du dessus qui marque les joints. */
const RT = 0.26,
  INS = 0.955;
/** Contour d'un hexagone aux coins arrondis (sauf ceux marqués sharp), avec l'altitude interpolée. */
function rbound(cs: [number, number][], zs: number[], sharp: boolean[] | null): RimPt[] {
  const o: RimPt[] = [];
  for (let k = 0; k < 6; k++) {
    const c = cs[k],
      p = cs[(k + 5) % 6],
      n = cs[(k + 1) % 6],
      zc = zs[k],
      zp = zs[(k + 5) % 6],
      zn = zs[(k + 1) % 6];
    if (sharp && sharp[k]) {
      o.push([c[0], c[1], zc, k]);
      continue;
    }
    const a: RimPt = [c[0] + (p[0] - c[0]) * RT, c[1] + (p[1] - c[1]) * RT, zc + (zp - zc) * RT, k],
      b: RimPt = [c[0] + (n[0] - c[0]) * RT, c[1] + (n[1] - c[1]) * RT, zc + (zn - zc) * RT, k];
    o.push(a, [0.25 * a[0] + 0.5 * c[0] + 0.25 * b[0], 0.25 * a[1] + 0.5 * c[1] + 0.25 * b[1], 0.25 * a[2] + 0.5 * zc + 0.25 * b[2], k], b);
  }
  return o;
}
/** Éclairage d'un triangle (points en pixels) par rapport à une surface plate : positif s'il est plus clair. */
function triShade(a: Pt3, b: Pt3, c: Pt3): number {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
    w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
  if (n[2] < 0) n = n.map(a => -a);
  const nn = Math.hypot(...n) || 1;
  return (n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]) / nn - FLAT;
}
const isLand = (j: Cell): boolean => j >= 0 && (A.S.ter[j] !== TER.sea || !!A.S.road[j]);
function geoTile(i: Cell): TileGeo {
  const t = A.S.ter[i],
    cx = HX(i),
    cy = HY(i),
    v = A.S.vr[i],
    zc = ZH(i) + (v - 0.5) * 3,
    jc = [cx + (v - 0.5) * 0.08, cy + (((v * 7) % 1) - 0.5) * 0.08];
  const kind: LandKind = isBeach(i) ? 'b' : t === TER.prairie ? (A.S.lnd && A.S.lnd[i] ? 'l' : 'g') : t === TER.forest ? 'f' : 'r';
  const base = kind === 'b' ? '#c8b996' : TCOL[kind];
  const cs: [number, number][] = [],
    zs: number[] = [];
  for (let k = 0; k < 6; k++) {
    cs.push(corner(cx, cy, k, HR * 1.004));
    zs.push(cornerZ(i, k));
  }
  // sous-couche : coins vifs à l'intérieur des terres, arrondis sur le rivage
  const sharp = [0, 1, 2, 3, 4, 5].map(k => isLand(nbDir(i, EDGE_DIR[(k + 5) % 6])) && isLand(nbDir(i, EDGE_DIR[k])));
  const under: Poly = [rbound(cs, zs, sharp).map(p => W(p[0], p[1], p[2] - 0.6)), sh(base, 0.58)];
  // dessus : hexagone arrondi, légèrement rentré pour marquer les joints
  const top = rbound(cs, zs, null).map((p): RimPt => [cx + (p[0] - cx) * INS, cy + (p[1] - cy) * INS, p[2], p[3]]);
  const tris: Poly[] = [],
    L = top.length;
  for (let s2 = 0; s2 < L; s2++) {
    const p = top[s2],
      q = top[(s2 + 1) % L];
    const d = triShade([jc[0] * HW, jc[1] * HW, zc], [p[0] * HW, p[1] * HW, p[2]], [q[0] * HW, q[1] * HW, q[2]]);
    const f = (1 + 1.15 * d + (((v * 31 + p[3] * 7) % 1) - 0.5) * 0.035) * (1 + (0.01 * zc) / STEP);
    tris.push([[W(jc[0], jc[1], zc), W(p[0], p[1], p[2]), W(q[0], q[1], q[2])], sh(base, f)]);
  }
  // falaises le long du contour arrondi
  const bot = [0, 1, 2, 3, 4, 5].map(e => {
    const j = nbDir(i, EDGE_DIR[e]);
    if (j < 0) return -30;
    if (A.S.ter[j] === TER.sea && !A.S.road[j] && Math.max(zs[e], zs[(e + 1) % 6]) > ZW + 4) return ZW - 1;
    return null;
  });
  const cliffs: Poly[] = [];
  for (let s2 = 0; s2 < L; s2++) {
    const p = top[s2],
      q = top[(s2 + 1) % L];
    let zb;
    if (p[3] === q[3]) {
      const a = bot[(p[3] + 5) % 6],
        b = bot[p[3]];
      zb = a != null && b != null ? Math.min(a, b) : (a ?? b);
    } else zb = bot[p[3]];
    if (zb == null) continue;
    const mx = (p[0] + q[0]) / 2 - cx,
      my = (p[1] + q[1]) / 2 - cy,
      dx = q[0] - p[0],
      dy = q[1] - p[1];
    let nx = dy,
      ny = -dx;
    if (nx * mx + ny * my < 0) {
      nx = -nx;
      ny = -ny;
    }
    const nn = Math.hypot(nx, ny) || 1;
    nx /= nn;
    ny /= nn;
    if (!vis(nx, ny)) continue;
    const col = zb <= -30 ? '#8a7a70' : '#9a8a84',
      f = fshade(nx, ny);
    cliffs.push([[W(p[0], p[1], p[2]), W(q[0], q[1], q[2]), W(q[0], q[1], zb), W(p[0], p[1], zb)], sh(col, f)]);
  }
  return { tris, cliffs, under, kind, zc, zs };
}
/** Géométrie d'une case de terre, calculée à la demande et gardée jusqu'au prochain changement de relief. */
function geo(i: Cell): TileGeo {
  if (GEOS !== A.S || GEOV !== (A.S.hver || 0)) {
    GEO = [];
    GEOS = A.S;
    GEOV = A.S.hver || 0;
  }
  return GEO[i] || (GEO[i] = geoTile(i));
}
/* les terres sont peintes une fois par blocs de 12×12 hexagones, puis réutilisées tant que rien ne change */
const CHN = 12;
function chunk(cx2: number, cy2: number): Sprite | null {
  if (CHKS !== A.S || CHKV !== (A.S.hver || 0)) {
    CHK = {};
    CHKS = A.S;
    CHKV = A.S.hver || 0;
  }
  const key = cx2 + ',' + cy2;
  if (key in CHK) return CHK[key];
  const ts: Cell[] = [];
  for (let y = cy2 * CHN; y < Math.min(N, (cy2 + 1) * CHN); y++)
    for (let x = cx2 * CHN; x < Math.min(N, (cx2 + 1) * CHN); x++) {
      const i = idx(x, y);
      if (A.S.ter[i] !== TER.sea || A.S.road[i]) ts.push(i);
    }
  if (!ts.length) return (CHK[key] = null);
  let x0 = 1e9,
    y0 = 1e9,
    x1 = -1e9,
    y1 = -1e9;
  for (const i of ts) {
    const [wx, wy] = W(HX(i), HY(i));
    x0 = Math.min(x0, wx - 44);
    x1 = Math.max(x1, wx + 44);
    y0 = Math.min(y0, wy - 110);
    y1 = Math.max(y1, wy + 60);
  }
  const SC = (window.devicePixelRatio || 1) > 1 ? 1.6 : 1.3,
    c = document.createElement('canvas');
  c.width = Math.ceil((x1 - x0) * SC);
  c.height = Math.ceil((y1 - y0) * SC);
  const prev = A.g;
  A.g = c.getContext('2d')!;
  A.g.setTransform(SC, 0, 0, SC, -x0 * SC, -y0 * SC);
  A.g.lineJoin = 'round';
  try {
    ts.sort((a, b) => DPi(a) - DPi(b));
    for (const i of ts) {
      const t = A.S.ter[i];
      if (t !== TER.sea) {
        const G = geo(i),
          [wx, wy] = W(HX(i), HY(i));
        P(G.under[0], G.under[1]);
        for (const [p, cl] of G.tris) P(p, cl, cl, 0.5);
        for (const [p, cl] of G.cliffs) P(p, cl, cl, 0.5);
        blit(tileDecor(G.kind, (A.S.vr[i] * (t === TER.prairie ? 6 : 3)) | 0), wx, wy - G.zc);
      }
    }
    for (const i of ts) if (A.S.road[i]) roadBand(i);
  } finally {
    A.g = prev;
  }
  return (CHK[key] = { c, x0, y0, w: x1 - x0, h: y1 - y0 });
}
/** Menus détails posés sur une case de terre : touffes d'herbe, bruyère et ajonc, feuilles mortes, cailloux. */
function tileDecor(kind: LandKind, v: number): Sprite {
  return sprite('dc' + kind + v, -34, -24, 34, 18, rnd => {
    const spot = () => {
      const a = rnd() * Math.PI * 2,
        d = rnd() * 0.33;
      return W(Math.cos(a) * d, Math.sin(a) * d);
    };
    if (kind === 'g') {
      for (let k = 0; k < 3; k++) {
        const [x, y] = spot();
        clump(x, y, 2.4, '#6a8458', rnd, 3);
      }
    } else if (kind === 'l') {
      for (let k = 0; k < 4; k++) {
        const [x, y] = spot();
        clump(x, y, 3.6 + rnd() * 1.5, pick3(rnd, ['#8e6c8f', '#7d5f80', '#9a789c']), rnd, 3);
      }
      if (v % 2 === 0)
        for (let k = 0; k < 2; k++) {
          const [x, y] = spot();
          clump(x, y, 3, '#d4b23c', rnd, 4);
        }
    } else if (kind === 'f') {
      for (let k = 0; k < 3; k++) {
        const [x, y] = spot();
        clump(x, y, 2.6, '#5a4a3a', rnd, 1.5);
      }
    } else if (kind === 'r') {
      for (let k = 0; k < 3; k++) {
        const [x, y] = spot();
        clump(x, y, 2.6, '#a3958f', rnd, 2);
      }
    } else if (kind === 'b') {
      for (let k = 0; k < 2; k++) {
        const [x, y] = spot();
        clump(x, y, 1.6, '#a39a86', rnd, 1);
      }
    }
  });
}
/** Case de mer : w eau profonde, s haut-fond (avec parfois un rocher affleurant). */
function tileSpr(kind: 'w' | 's', v: number): Sprite {
  return sprite('hR' + kind + v, -36, -26, 36, 26, rnd => {
    const base = sh(TCOL[kind], 0.985 + rnd() * 0.03);
    facetRound(base, rnd, 0.035);
    if (kind === 's' && v === 0) {
      const a = rnd() * Math.PI * 2,
        d = rnd() * 0.33;
      const [x, y] = W(Math.cos(a) * d, Math.sin(a) * d);
      clump(x, y, 2.4, '#5e7c84', rnd, 0);
    }
  });
}
/** Ombre portée floue au pied d'un objet. */
function softShadow(x: number, y: number, rx: number, ry: number): void {
  blur(1);
  A.g.fillStyle = 'rgba(20,28,34,.26)';
  A.g.beginPath();
  A.g.ellipse(x, y, rx, ry, 0, 0, 7);
  A.g.fill();
  blur(0);
}
/** Prisme hexagonal de z0 à z1 : faces visibles éclairées, puis le dessus. */
function hexPrism(cx: number, cy: number, r: number, z0: number, z1: number, top: string, side: string): void {
  const c = (k: number) => corner(cx, cy, k, r);
  for (const k of VISK) {
    const a = c(k),
      b = c((k + 1) % 6),
      an = ((60 * k - 60) * Math.PI) / 180;
    P(
      [W(a[0], a[1], z0), W(b[0], b[1], z0), W(b[0], b[1], z1), W(a[0], a[1], z1)],
      sh(side, fshade(Math.cos(an), Math.sin(an))),
      'rgba(30,24,22,.35)',
      0.5,
    );
  }
  P(hexPts(cx, cy, r, z1), top, 'rgba(30,24,22,.35)', 0.5);
}
/** Case de rempart : w talus palissadé, d talus endommagé, g porte. */
function wallSpr(kind: 'w' | 'd' | 'g'): Sprite {
  return sprite('hw_' + kind, -40, -50, 40, 30, rnd => {
    if (kind === 'g') {
      for (const sx of [-0.3, 0.3]) {
        hexPrism(sx, 0, HR * 0.32, 0, 20, '#a39790', '#8f837d');
      }
      P([W(-0.36, -0.06, 22), W(0.36, -0.06, 22), W(0.36, 0.06, 18), W(-0.36, 0.06, 18)], '#5e4a38', 'rgba(30,24,22,.4)', 0.5);
      return;
    }
    const dmg = kind === 'd';
    hexPrism(0, 0, HR * 0.98, 0, 13, dmg ? '#6f7a52' : '#738450', dmg ? '#7d716a' : '#958983');
    for (let k = 0; k < 6; k++) {
      const [x, y] = corner(0, 0, k, HR * 0.55);
      const p = W(x, y, 13);
      P(
        [
          [p[0] - 1.2, p[1]],
          [p[0] + 1.2, p[1]],
          [p[0] + 0.6, p[1] - 8],
          [p[0] - 0.6, p[1] - 8],
        ],
        '#5a4636',
      );
    }
    if (dmg) {
      const p = W(0.1, 0.45, 8);
      P(
        [
          [p[0] - 4, p[1] - 6],
          [p[0] + 5, p[1] - 3],
          [p[0] + 1, p[1] + 4],
        ],
        '#3e3430',
      );
    }
  });
}
/** Chemin de terre battue (ou pont de planches) reliant la case à ses voisines desservies. */
function roadBand(i: Cell): void {
  const cx = HX(i),
    cy = HY(i),
    bridge = A.S.ter[i] === TER.sea,
    links: Cell[] = [];
  for (const j of nb4(i)) if (A.S.road[j] || (A.S.occ[j] && !bridge)) links.push(j);
  const wd = 0.17,
    col = bridge ? '#7a6452' : '#a59885',
    edge = bridge ? '#4e3e30' : '#857a6a';
  const zc = ZH(i);
  const band = (j: Cell, w: number, c: string) => {
    const mx = (cx + HX(j)) / 2,
      my = (cy + HY(j)) / 2,
      dx = mx - cx,
      dy = my - cy,
      n = Math.hypot(dx, dy),
      px = (-dy / n) * w,
      py = (dx / n) * w,
      zm = (zc + ZH(j)) / 2;
    P([W(cx + px, cy + py, zc), W(mx + px, my + py, zm), W(mx - px, my - py, zm), W(cx - px, cy - py, zc)], c);
  };
  const hub = (w: number, c: string) => P(hexPts(cx, cy, w * 1.15, zc), c);
  for (const j of links) if (A.S.road[j]) band(j, wd + 0.04, edge);
  hub(wd + 0.04, edge);
  for (const j of links) if (A.S.road[j]) band(j, wd, col);
  hub(wd, col);
  if (bridge) {
    for (const j of links)
      if (A.S.road[j]) {
        const mx = (cx + HX(j)) / 2,
          my = (cy + HY(j)) / 2;
        ln(W(cx, cy - 0.18, zc + 4), W(mx, my - 0.18, (zc + ZH(j)) / 2 + 4), '#4e3e30', 1.4);
      }
    const p = W(cx, cy, zc);
    ln([p[0] - 8, p[1] + 2], [p[0] - 8, p[1] + 12], '#3e3228', 2);
    ln([p[0] + 8, p[1] + 2], [p[0] + 8, p[1] + 12], '#3e3228', 2);
  }
}

export { CHN, chunk, computeDep, geo, softShadow, tileSpr, wallSpr };
