// @ts-nocheck — affichage et interface extraits de la version mono-fichier ; à typer progressivement.
import { N } from '../core/constants';
import { EDGE_DIR, HR, HX, HY, corner, idx, nb4, nbDir } from '../core/hex';
import { landDistance, seaDepth } from '../world/terrain';
import { DEEP, SEA, TCOL, VEG } from '../data/palette';
import { A } from '../app/state';
import { DPi, STEP, VISK, W, ZH, ZW, fshade, hexPts, vis } from './projection';
import { P, blur, canPaint, gem, levelFor, pick3, sh, sprite } from './kit';

function computeDep() {
  A.LD = landDistance(A.S.ter);
  A.DEP = seaDepth(A.S.ter);
}

/* ---------- hasard attaché à un point du monde : deux cases voisines tirent la même valeur pour un sommet commun ---------- */
function hv(x, y, salt) {
  let h = Math.imul(Math.round(x * 240) | 0, 374761393) ^ Math.imul(Math.round(y * 240) | 0, 668265263) ^ Math.imul(salt | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function rndAt(seed) {
  let s = seed | 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- couleurs : chaque sommet prend la moyenne des cases qui le partagent, pour fondre les transitions ---------- */
const rgbc = {};
function rgb(hex) {
  if (rgbc[hex]) return rgbc[hex];
  const n = parseInt(hex.slice(1), 16);
  return (rgbc[hex] = [n >> 16, (n >> 8) & 255, n & 255]);
}
function avg3(a, b, c) {
  return [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
}
function avg2(a, b) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}
function css(c, f) {
  const k = v => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${k(c[0])},${k(c[1])},${k(c[2])})`;
}

/* ---------- géométrie d'une case ---------- */
/* les ponts restent de l'eau pour le dessin du sol : leur tablier est posé par les chemins */
const isWet = j => j >= 0 && A.S.ter[j] === 2;
const isLand = j => j >= 0 && !isWet(j);
function isBeach(i) {
  return A.S.ter[i] === 0 && (!A.S.hgt || A.S.hgt[i] <= 1) && nb4(i).some(j => isWet(j));
}
function kindOf(i) {
  const t = A.S.ter[i];
  if (t === 2) return 'b';
  return isBeach(i) ? 'b' : t === 0 ? (A.S.lnd && A.S.lnd[i] ? 'l' : 'g') : t === 1 ? 'f' : 'r';
}
function landRGB(j) {
  return rgb(TCOL[kindOf(j)]);
}
/* hauteur d'un coin : moyenne des terres qui le partagent ; un coin qui touche la mer descend au ras de l'eau */
function cornerZ(i, k) {
  const a = nbDir(i, EDGE_DIR[k]),
    b = nbDir(i, EDGE_DIR[(k + 5) % 6]);
  let s = (A.S.hgt ? A.S.hgt[i] : 0) * STEP,
    n = 1,
    wet = false;
  for (const j of [a, b]) {
    if (j < 0) continue;
    if (isWet(j)) {
      wet = true;
      continue;
    }
    s += (A.S.hgt ? A.S.hgt[j] : 0) * STEP;
    n++;
  }
  const z = s / n;
  return wet && z < STEP * 1.6 ? ZW + 3 : z;
}
function cornerRGB(i, k) {
  const a = nbDir(i, EDGE_DIR[k]),
    b = nbDir(i, EDGE_DIR[(k + 5) % 6]);
  const own = landRGB(i);
  const ca = isLand(a) ? landRGB(a) : own,
    cb = isLand(b) ? landRGB(b) : own;
  return avg3(own, ca, cb);
}
const LIGHT = (() => {
    const v = [-0.45, -0.55, 0.9],
      n = Math.hypot(...v);
    return v.map(a => a / n);
  })(),
  FLAT = LIGHT[2];
function triShade(a, b, c) {
  const u = [(b[0] - a[0]) * 56, (b[1] - a[1]) * 56, b[2] - a[2]],
    w = [(c[0] - a[0]) * 56, (c[1] - a[1]) * 56, c[2] - a[2]];
  let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
  if (n[2] < 0) n = n.map(v => -v);
  const nn = Math.hypot(...n) || 1;
  return (n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]) / nn - FLAT;
}
const RT = 0.15;
/*
 * Une case de terre : un anneau de sommets (coins et milieux d'arêtes) relié à un centre.
 * Les sommets partagés avec une case de terre voisine ont la même position, la même hauteur et la même couleur
 * des deux côtés : le sol est continu, sans joint. Sur le rivage, les coins s'arrondissent.
 */
function geoTile(i) {
  const cx = HX(i),
    cy = HY(i);
  const zs = [],
    cs = [];
  for (let k = 0; k < 6; k++) {
    cs.push(corner(cx, cy, k, HR));
    zs.push(isWet(i) ? ZW : cornerZ(i, k));
  }
  if (isWet(i)) return { wet: true, zc: ZW, zs, tris: [], cliffs: [] };
  const sharp = [0, 1, 2, 3, 4, 5].map(k => isLand(nbDir(i, EDGE_DIR[(k + 5) % 6])) && isLand(nbDir(i, EDGE_DIR[k])));
  const own = landRGB(i);
  const ring = [];
  for (let k = 0; k < 6; k++) {
    const c = cs[k],
      p = cs[(k + 5) % 6],
      n = cs[(k + 1) % 6];
    const cc = cornerRGB(i, k);
    if (sharp[k]) {
      const j = 0.035;
      ring.push({
        p: [c[0] + (hv(c[0], c[1], 1) - 0.5) * j, c[1] + (hv(c[0], c[1], 2) - 0.5) * j, zs[k] + (hv(c[0], c[1], 3) - 0.5) * 2.4],
        c: cc,
      });
    } else {
      const zp = zs[(k + 5) % 6],
        zn = zs[(k + 1) % 6];
      const a = [c[0] + (p[0] - c[0]) * RT, c[1] + (p[1] - c[1]) * RT, zs[k] + (zp - zs[k]) * RT],
        b = [c[0] + (n[0] - c[0]) * RT, c[1] + (n[1] - c[1]) * RT, zs[k] + (zn - zs[k]) * RT];
      ring.push({ p: a, c: cc }, { p: [0.25 * a[0] + 0.5 * c[0] + 0.25 * b[0], 0.25 * a[1] + 0.5 * c[1] + 0.25 * b[1], 0.25 * a[2] + 0.5 * zs[k] + 0.25 * b[2]], c: cc }, { p: b, c: cc });
    }
    // milieu de l'arête k (entre les coins k et k+1), partagé avec la case voisine
    const j = nbDir(i, EDGE_DIR[k]),
      m = [(c[0] + n[0]) / 2, (c[1] + n[1]) / 2],
      landN = isLand(j),
      both = sharp[k] && sharp[(k + 1) % 6];
    const mz = (zs[k] + zs[(k + 1) % 6]) / 2 + (landN ? (hv(m[0], m[1], 3) - 0.5) * 2.4 : 0);
    const mj = both ? 0.03 : 0;
    ring.push({
      p: [m[0] + (hv(m[0], m[1], 1) - 0.5) * mj, m[1] + (hv(m[0], m[1], 2) - 0.5) * mj, mz],
      c: landN ? avg2(own, landRGB(j)) : own,
    });
  }
  // au bord de l'eau, le centre suit la moyenne de ses coins : la grève descend en pente douce au lieu de former une tente
  const coast = nb4(i).some(isWet),
    zc = (coast ? Math.min(ZH(i), zs.reduce((a, b) => a + b, 0) / 6 + 2) : ZH(i)) + (hv(cx, cy, 4) - 0.5) * 2,
    ctr = [cx + (hv(cx, cy, 5) - 0.5) * 0.08, cy + (hv(cx, cy, 6) - 0.5) * 0.08, zc];
  const tris = [];
  const L = ring.length;
  for (let s = 0; s < L; s++) {
    const p = ring[s],
      q = ring[(s + 1) % L];
    const d = triShade(ctr, p.p, q.p);
    const f = Math.max(0.78, Math.min(1.16, 1 + 1.25 * d)) * (1 + (hv((p.p[0] + q.p[0] + cx) / 3, (p.p[1] + q.p[1] + cy) / 3, 7) - 0.5) * 0.05) * (1 + 0.012 * (zc / STEP));
    tris.push([[W(ctr[0], ctr[1], ctr[2]), W(p.p[0], p.p[1], p.p[2]), W(q.p[0], q.p[1], q.p[2])], css(avg3(own, p.c, q.c), f)]);
  }
  // falaises : sous le bord des terres hautes qui tombent dans la mer, ou au bout de la carte
  const bot = [0, 1, 2, 3, 4, 5].map(e => {
    const j = nbDir(i, EDGE_DIR[e]);
    if (j < 0) return -30;
    if (isWet(j) && Math.max(zs[e], zs[(e + 1) % 6]) > ZW + 4) return ZW - 1;
    return null;
  });
  const cliffs = [];
  for (let s = 0; s < L; s++) {
    const p = ring[s].p,
      q = ring[(s + 1) % L].p;
    const mx = (p[0] + q[0]) / 2 - cx,
      my = (p[1] + q[1]) / 2 - cy;
    // arête la plus proche de ce segment, d'après son angle autour du centre
    let e = 0,
      best = -9;
    for (let k = 0; k < 6; k++) {
      const a = cs[k],
        b = cs[(k + 1) % 6],
        ex = (a[0] + b[0]) / 2 - cx,
        ey = (a[1] + b[1]) / 2 - cy,
        dd = (ex * mx + ey * my) / (Math.hypot(ex, ey) * (Math.hypot(mx, my) || 1));
      if (dd > best) {
        best = dd;
        e = k;
      }
    }
    const zb = bot[e];
    if (zb == null) continue;
    const dx = q[0] - p[0],
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
    const f = fshade(nx, ny) * 1.12,
      col = zb <= -30 ? sh(TCOL.cliff, 0.86) : TCOL.cliff,
      v = (hv(mx + cx, my + cy, 8) - 0.5) * 0.08;
    const tp = W(p[0], p[1], p[2]),
      tq = W(q[0], q[1], q[2]),
      bq = W(q[0], q[1], zb),
      bp = W(p[0], p[1], zb);
    cliffs.push([[tp, tq, bq], sh(col, f * (1 + v))], [[tp, bq, bp], sh(col, f * (0.95 - v))]);
  }
  return { wet: false, zc, zs, tris, cliffs, kind: kindOf(i) };
}
function geo(i) {
  if (A.GEOS !== A.S || A.GEOV !== (A.S.hver || 0)) {
    A.GEO = [];
    A.GEOS = A.S;
    A.GEOV = A.S.hver || 0;
  }
  return A.GEO[i] || (A.GEO[i] = geoTile(i));
}

/* ---------- la mer : un seul tapis de facettes, du turquoise des hauts-fonds au bleu du large ---------- */
function depthOf(j) {
  if (j < 0) return 9;
  if (!isWet(j)) return 0;
  return Math.max(1, A.DEP[j] || 9);
}
function seaRGB(d) {
  d = Math.max(0, Math.min(9, d));
  const a = Math.floor(d),
    b = Math.min(9, a + 1),
    t = d - a,
    ca = rgb(SEA[a]),
    cb = rgb(SEA[b]);
  return [ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t];
}
function paintSea(i) {
  const cx = HX(i),
    cy = HY(i),
    d0 = depthOf(i),
    pts = [];
  for (let k = 0; k < 6; k++) {
    const c = corner(cx, cy, k, HR * 1.01),
      n = corner(cx, cy, (k + 1) % 6, HR * 1.01);
    const a = nbDir(i, EDGE_DIR[k]),
      b = nbDir(i, EDGE_DIR[(k + 5) % 6]);
    pts.push({ p: c, d: (d0 + depthOf(a) + depthOf(b)) / 3 });
    pts.push({ p: [(c[0] + n[0]) / 2, (c[1] + n[1]) / 2], d: (d0 + depthOf(a)) / 2 });
  }
  const C = W(cx, cy, ZW);
  for (let s = 0; s < pts.length; s++) {
    const p = pts[s],
      q = pts[(s + 1) % pts.length];
    const d = (d0 + p.d + q.d) / 3,
      calm = Math.max(0, 1 - d / 9),
      n = (hv((p.p[0] + q.p[0] + cx) / 3, (p.p[1] + q.p[1] + cy) / 3, 9) - 0.5) * 0.09 * (0.25 + calm);
    const col = css(seaRGB(d), 1 + n);
    P([C, W(p.p[0], p.p[1], ZW), W(q.p[0], q.p[1], ZW)], col, col, 0.6);
  }
}

/* ---------- petit décor du sol, tiré au hasard pour chaque case : touffes, ajoncs, bruyère, cailloux ---------- */
function tileDecor(i, out) {
  if (A.S.occ[i] || A.S.road[i] || A.S.wall[i] || (A.S.deco && A.S.deco[i])) return;
  const kind = kindOf(i),
    t = A.S.ter[i];
  if (t === 2 || t === 1) return;
  const cx = HX(i),
    cy = HY(i),
    rnd = rndAt(i * 2654435761 + 97),
    z = ZH(i);
  const spot = r => {
    const a = rnd() * Math.PI * 2,
      d = Math.sqrt(rnd()) * (r ?? 0.36);
    return W(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.95, z + 0.6);
  };
  // densité par plaques : un bruit grossier fait alterner zones fournies et zones nues
  const patch = hv(Math.floor(cx / 3), Math.floor(cy / 3), 11) * 0.6 + hv(cx, cy, 12) * 0.4;
  if (kind === 'g') {
    const n = (patch * 4) | 0;
    for (let k = 0; k < n; k++) {
      const [x, y] = spot();
      out.push([y, () => gem(x, y - 1.2, 2.6 + rnd() * 1.4, 1.5 + rnd() * 0.7, pick3(rnd, VEG.grass), rnd, { n: 6, lift: 0.5 })]);
    }
    if (patch > 0.62)
      for (let k = 0; k < 3; k++) {
        const [x, y] = spot(),
          c = pick3(rnd, VEG.flower);
        out.push([y, () => P([[x - 0.9, y], [x, y - 1.6], [x + 0.9, y]], c)]);
      }
  } else if (kind === 'l') {
    // les ajoncs poussent en buissons serrés ; la bruyère forme des plaques à part
    const groups = 1 + ((patch * 3) | 0);
    for (let g = 0; g < groups; g++) {
      const [gx, gy] = spot(0.3),
        heather = rnd() < 0.2,
        n = 2 + ((rnd() * 3) | 0);
      for (let k = 0; k < n; k++) {
        const x = gx + (rnd() - 0.5) * 9,
          y = gy + (rnd() - 0.5) * 4,
          s = 0.85 + rnd() * 0.5;
        out.push([y, () => gem(x, y - 2 * s, 3.6 * s, 2.3 * s, heather ? pick3(rnd, VEG.heather) : pick3(rnd, VEG.gorse), rnd, { n: 7, lift: 0.9 })]);
      }
    }
  } else if (kind === 'r') {
    for (let k = 0; k < 2 + ((patch * 3) | 0); k++) {
      const [x, y] = spot(),
        s = 0.6 + rnd() * 0.5;
      out.push([y, () => gem(x, y - 1.5 * s, 3.2 * s, 2 * s, pick3(rnd, VEG.rock), rnd, { n: 6, lift: 0.4 })]);
    }
  } else if (kind === 'b' && patch > 0.55) {
    const [x, y] = spot(0.25);
    out.push([y, () => gem(x, y - 0.8, 2, 1.2, pick3(rnd, VEG.rock), rnd, { n: 5, lift: 0.3 })]);
  }
}

/* ---------- chemins : une bande de terre battue qui passe par le milieu des arêtes, sans nœud à chaque case ---------- */
const ROAD = { edge: '#a6875a', fill: '#d6b986', bEdge: '#5a4430', bFill: '#94704c' };
function roadPath(i) {
  const cx = HX(i),
    cy = HY(i),
    zc = ZH(i) + 0.8,
    C = W(cx, cy, zc),
    ms = [];
  for (const j of nb4(i))
    if (A.S.road[j]) {
      const zm = (zc + ZH(j) + 0.8) / 2;
      ms.push(W((cx + HX(j)) / 2, (cy + HY(j)) / 2, zm));
    }
  const g = A.g;
  g.beginPath();
  if (ms.length === 0) {
    g.moveTo(C[0] - 0.01, C[1]);
    g.lineTo(C[0] + 0.01, C[1]);
  } else if (ms.length === 2) {
    g.moveTo(ms[0][0], ms[0][1]);
    g.quadraticCurveTo(C[0], C[1], ms[1][0], ms[1][1]);
  } else
    for (const m of ms) {
      g.moveTo(C[0], C[1]);
      g.lineTo(m[0], m[1]);
    }
  return ms.length;
}
function roadLayer(list, outer) {
  const g = A.g;
  g.lineJoin = 'round';
  for (const i of list) {
    const bridge = A.S.ter[i] === 2,
      n = roadPath(i);
    // les bouts libres et les croisements s'arrondissent ; les raccords aux cases voisines restent droits
    g.lineCap = n === 2 ? 'butt' : 'round';
    g.strokeStyle = outer ? (bridge ? ROAD.bEdge : ROAD.edge) : bridge ? ROAD.bFill : ROAD.fill;
    g.lineWidth = outer ? 12.5 : 9;
    if (n !== 2 && n > 0) {
      // les tronçons droits restent coupés net au milieu des arêtes ; seul le centre est arrondi
      g.lineCap = 'butt';
      g.stroke();
      const C = W(HX(i), HY(i), ZH(i) + 0.8);
      g.fillStyle = g.strokeStyle;
      g.beginPath();
      g.ellipse(C[0], C[1], g.lineWidth / 2, g.lineWidth / 2.6, 0, 0, 7);
      g.fill();
    } else g.stroke();
  }
  if (!outer)
    for (const i of list)
      if (A.S.ter[i] === 2) {
        const p = W(HX(i), HY(i), ZH(i));
        g.strokeStyle = '#3e3228';
        g.lineWidth = 2;
        g.lineCap = 'butt';
        for (const dx of [-7, 7]) {
          g.beginPath();
          g.moveTo(p[0] + dx, p[1] + 3);
          g.lineTo(p[0] + dx, p[1] + 13);
          g.stroke();
        }
      }
}

/* ---------- blocs de terrain peints une fois, à la résolution affichée ---------- */
const CHN = 8;
const BUDGET = 24e6; // pixels gardés en mémoire pour les blocs, toutes résolutions confondues
function chunkTiles(cx2, cy2) {
  const ts = [];
  for (let y = cy2 * CHN; y < Math.min(N, (cy2 + 1) * CHN); y++) for (let x = cx2 * CHN; x < Math.min(N, (cx2 + 1) * CHN); x++) ts.push(idx(x, y));
  return ts;
}
/* empreinte de ce qui, dans le bloc et sur sa bordure, change le dessin du sol */
function chunkSig(ts) {
  let h = 2166136261;
  const seen = new Set();
  for (const i of ts) for (const j of [i, ...nb4(i)]) {
    if (seen.has(j)) continue;
    seen.add(j);
    h = Math.imul(h ^ (A.S.road[j] | (A.S.occ[j] ? 2 : 0) | (A.S.wall[j] ? 4 : 0) | (A.S.ter[j] << 3)), 16777619);
  }
  return h >>> 0;
}
function chunkBox(ts) {
  let x0 = 1e9,
    y0 = 1e9,
    x1 = -1e9,
    y1 = -1e9;
  for (const i of ts) {
    const [wx, wy] = W(HX(i), HY(i));
    x0 = Math.min(x0, wx - 42);
    x1 = Math.max(x1, wx + 42);
    y0 = Math.min(y0, wy - 75);
    y1 = Math.max(y1, wy + 48);
  }
  return [x0, y0, x1, y1];
}
function paintChunk(ts, box, sc) {
  const [x0, y0, x1, y1] = box,
    c = document.createElement('canvas');
  c.width = Math.ceil((x1 - x0) * sc);
  c.height = Math.ceil((y1 - y0) * sc);
  const prev = A.g;
  A.g = c.getContext('2d');
  A.g.setTransform(sc, 0, 0, sc, -x0 * sc, -y0 * sc);
  A.g.lineJoin = 'round';
  try {
    const sorted = ts.slice().sort((a, b) => DPi(a) - DPi(b));
    // 1. la mer, sous les rivages aussi, pour que les criques arrondies laissent voir l'eau
    for (const i of sorted) if (isWet(i) || nb4(i).some(isWet) || nb4(i).length < 6) paintSea(i);
    // 2. les terres, de l'arrière vers l'avant
    for (const i of sorted)
      if (!isWet(i)) {
        const G = geo(i);
        for (const [p, cl] of G.tris) P(p, cl, cl, 0.6);
        for (const [p, cl] of G.cliffs) P(p, cl, cl, 0.6);
      }
    // 3. les chemins, bordure puis bande
    const roads = sorted.filter(i => A.S.road[i]);
    roadLayer(roads, true);
    roadLayer(roads, false);
    // 4. le petit décor, trié de haut en bas
    const deco = [];
    for (const i of sorted) tileDecor(i, deco);
    deco.sort((a, b) => a[0] - b[0]);
    for (const [, f] of deco) f();
  } finally {
    A.g = prev;
  }
  return c;
}
let FRAME = 0,
  PAINTED = 0;
/* à appeler au début de chaque image : fixe la résolution voulue et le nombre de blocs qu'on peut repeindre */
function chunkFrame(need) {
  FRAME++;
  PAINTED = 0;
  if (A.CHKS !== A.S) {
    A.CHK = {};
    A.CHKS = A.S;
    A.CHKV = A.S.hver || 0;
    A.CHL = 0;
  }
  if (A.CHKV !== (A.S.hver || 0)) {
    A.CHKV = A.S.hver || 0;
    for (const k in A.CHK) A.CHK[k].check = true;
  }
  A.CHL = levelFor(need, A.CHL, 3.5);
}
function evict() {
  let total = 0;
  const all = [];
  for (const k in A.CHK)
    for (const l in A.CHK[k].lv) {
      const v = A.CHK[k].lv[l];
      total += v.c.width * v.c.height;
      all.push([v.t, k, l, v.c.width * v.c.height]);
    }
  if (total <= BUDGET) return;
  all.sort((a, b) => a[0] - b[0]);
  for (const [t, k, l, px] of all) {
    if (total <= BUDGET || t >= FRAME) break;
    delete A.CHK[k].lv[l];
    total -= px;
  }
}
/* le bloc (cx2, cy2) prêt à poser, ou null s'il sort de la vue [vx0, vx1] × [vy0, vy1] */
function chunk(cx2, cy2, vx0, vx1, vy0, vy1) {
  const key = cx2 + ',' + cy2;
  let e = A.CHK[key];
  if (!e) {
    const ts = chunkTiles(cx2, cy2);
    e = A.CHK[key] = { ts, box: chunkBox(ts), sig: chunkSig(ts), lv: {} };
  } else if (e.check) {
    e.check = false;
    const s = chunkSig(e.ts);
    if (s !== e.sig) {
      e.sig = s;
      e.lv = {};
    }
  }
  const [x0, y0, x1, y1] = e.box,
    L = A.CHL;
  if (x0 > vx1 || x1 < vx0 || y0 > vy1 || y1 < vy0) return null;
  let v = e.lv[L];
  if (!v) {
    const others = Object.keys(e.lv);
    // quand une version d'une autre résolution peut patienter à l'écran, on ne repeint que dans le temps restant de l'image
    if (others.length && (PAINTED >= 2 || !canPaint())) v = e.lv[others[0]];
    else {
      PAINTED++;
      v = e.lv[L] = { c: paintChunk(e.ts, e.box, L) };
      evict();
    }
  }
  v.t = FRAME;
  return { c: v.c, x0, y0, w: x1 - x0, h: y1 - y0 };
}

/* ---------- grille, à la demande ---------- */
function gridPath(vx0, vx1, vy0, vy1) {
  const g = A.g;
  g.beginPath();
  for (let i = 0; i < N * N; i++) {
    const [wx, wy] = W(HX(i), HY(i));
    if (wx < vx0 || wx > vx1 || wy < vy0 || wy > vy1) continue;
    const G = geo(i),
      cx = HX(i),
      cy = HY(i);
    for (let k = 0; k < 6; k++) {
      const [x, y] = corner(cx, cy, k, HR),
        p = W(x, y, (G.wet ? ZW : G.zs[k]) + 0.6);
      k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]);
    }
    g.closePath();
  }
}

/* ---------- ombres douces et remparts ---------- */
function softShadow(x, y, rx, ry) {
  if (A.SHADOW) return;
  blur(1);
  A.g.fillStyle = 'rgba(24,46,40,.24)';
  A.g.beginPath();
  A.g.ellipse(x, y, rx, ry, 0, 0, 7);
  A.g.fill();
  blur(0);
}
function hexPrism(cx, cy, r, z0, z1, top, side) {
  const c = k => corner(cx, cy, k, r);
  for (const k of VISK) {
    const a = c(k),
      b = c((k + 1) % 6),
      an = ((60 * k - 60) * Math.PI) / 180,
      col = sh(side, fshade(Math.cos(an), Math.sin(an)) * 1.1);
    P([W(a[0], a[1], z0), W(b[0], b[1], z0), W(b[0], b[1], z1), W(a[0], a[1], z1)], col, col, 0.5);
  }
  P(hexPts(cx, cy, r, z1), top, top, 0.5);
}
function wallSpr(kind) {
  return sprite('hw_' + kind, -40, -50, 40, 30, rnd => {
    if (kind === 'g') {
      for (const sx of [-0.3, 0.3]) hexPrism(sx, 0, HR * 0.32, 0, 20, '#b9b5ae', '#a19c96');
      P([W(-0.36, -0.06, 22), W(0.36, -0.06, 22), W(0.36, 0.06, 18), W(-0.36, 0.06, 18)], '#6b5440');
      return;
    }
    const dmg = kind === 'd';
    hexPrism(0, 0, HR * 0.98, 0, 13, dmg ? '#7d8a52' : '#7f9a50', dmg ? '#8f8a84' : '#a19c96');
    for (let k = 0; k < 6; k++) {
      const [x, y] = corner(0, 0, k, HR * 0.55);
      const p = W(x, y, 13);
      P([[p[0] - 1.2, p[1]], [p[0] + 1.2, p[1]], [p[0] + 0.6, p[1] - 8], [p[0] - 0.6, p[1] - 8]], '#6b5440');
    }
    if (dmg) {
      const p = W(0.1, 0.45, 8);
      P([[p[0] - 4, p[1] - 6], [p[0] + 5, p[1] - 3], [p[0] + 1, p[1] + 4]], '#3e3430');
    }
  });
}

export { CHN, DEEP, chunk, chunkFrame, computeDep, geo, gridPath, isBeach, softShadow, wallSpr };
