// @ts-nocheck — affichage et interface extraits de la version mono-fichier ; à typer progressivement.
import { HR, HX, HY, corner, idx } from '../core/hex';
import { used } from '../sim/stock';
import { B } from '../data/buildings';
import { AC, INK, OUTLINE } from '../data/palette';
import { A } from '../app/state';
import { CR, DP2, SR, TILT, W, ZH, ZW, bc, fshade, vis } from './projection';
import { P, bbox, blur, ln, mix, pick3, sh, shadowSprite, sprite, strokes } from './kit';
import { TCOL } from '../data/palette';
import { figure, shipFig, smoke } from './units';
import { monProg } from '../app/game';
import { softShadow } from './terrain';
import { boulder3, irregular, mass, oak3, pathPts, pencil, smoothPts } from './decor';

const FOOT = {
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
function roundPts(sp, r) {
  const n = sp.length,
    o = [];
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
function hatchClip(sp, rnd, dens) {
  if (!OUTLINE) return;
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
function facets(sp, col, rnd, amp) {
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
  const ct = [cx + (rnd() - 0.5) * (c - a) * 0.3, cy + (rnd() - 0.5) * (d - b) * 0.3];
  for (let k = 0; k < n; k++) {
    const p = sp[k],
      q = sp[(k + 1) % n],
      L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (L > 16) {
      const m = [(p[0] + q[0]) / 2 + (rnd() - 0.5) * 3, (p[1] + q[1]) / 2 + (rnd() - 0.5) * 3];
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
/* une face plane : arêtes vives, découpée en quelques facettes de tons voisins (et, dans l'ancien style, un trait de crayon) */
function face(sp, col, rnd, tex, sh2, pw) {
  P(sp, col, col, 0.5);
  A.g.save();
  pathPts(sp, true);
  A.g.clip();
  facets(sp, col, rnd, 0.1);
  if (tex && !tex.surf) tex(sp, col, rnd);
  A.g.restore();
  if (OUTLINE) pencil(roundPts(sp, 1.6), true, pw || 0.75, rnd, INK, 0.6);
  return sp;
}
const TX = {
  stone(sp, c, rnd) {
    const [a, b, cc, d] = bbox(sp);
    for (let y = b + 1.5; y < d + 2; y += 3.2)
      for (let x = a + ((y * 7) % 3); x < cc + 2; x += 4 + rnd() * 2) {
        A.g.fillStyle = sh(c, 0.86 + rnd() * 0.26);
        A.g.beginPath();
        A.g.ellipse(x, y, 2 + rnd() * 0.8, 1.3, 0, 0, 7);
        A.g.fill();
        A.g.strokeStyle = 'rgba(42,36,28,.32)';
        A.g.lineWidth = 0.4;
        A.g.stroke();
      }
  },
  plank(sp, c, rnd) {
    const [a, b, cc, d] = bbox(sp);
    A.g.lineWidth = 0.6;
    for (let x = a + 1.5; x < cc; x += 3.2) {
      A.g.strokeStyle = 'rgba(42,36,28,.35)';
      A.g.beginPath();
      A.g.moveTo(x + (rnd() - 0.5) * 0.4, b);
      A.g.lineTo(x + (rnd() - 0.5) * 0.4, d);
      A.g.stroke();
    }
  },
  chaux(sp, c, rnd) {
    const [a, b, cc, d] = bbox(sp);
    for (let k = 0; k < 3; k++) {
      const x = a + rnd() * (cc - a),
        y = b + rnd() * (d - b);
      A.g.strokeStyle = 'rgba(120,100,80,.25)';
      A.g.lineWidth = 0.5;
      A.g.beginPath();
      A.g.moveTo(x, y);
      A.g.lineTo(x + 2, y + 2.5);
      A.g.lineTo(x + 1, y + 4);
      A.g.stroke();
    }
  },
  thatch(dx, dy) {
    return (sp, c, rnd) => strokes(sp, rnd, 0.45, 5, dx, dy, [sh(c, 0.78), sh(c, 1.15), sh(c, 0.9)], 0.7, 0.18);
  },
  slate(dir) {
    return (sp, c, rnd) => {
      const [a, b, cc, d] = bbox(sp);
      A.g.strokeStyle = sh(c, 0.7);
      A.g.lineWidth = 0.6;
      const sl = dir[1] / (dir[0] || 1e-3);
      for (let y = b - 60; y < d + 60; y += 2.6) {
        A.g.beginPath();
        A.g.moveTo(a, y);
        A.g.lineTo(cc, y + (cc - a) * sl);
        A.g.stroke();
      }
      for (let k = 0; k < ((((cc - a) * (d - b)) / 18) | 0); k++) {
        const x = a + rnd() * (cc - a),
          y = b + rnd() * (d - b);
        A.g.beginPath();
        A.g.moveTo(x, y);
        A.g.lineTo(x, y + 1.6);
        A.g.stroke();
      }
    };
  },
};
function box(x0, y0, x1, y1, z0, z1, col, rnd, tex, top) {
  const fs = [
    [x0, y1, x1, y1, 0, 1],
    [x1, y0, x1, y1, 1, 0],
    [x0, y0, x0, y1, -1, 0],
    [x0, y0, x1, y0, 0, -1],
  ];
  for (const [ax, ay, bx, by, nx, ny] of fs) {
    if (!vis(nx, ny)) continue;
    const f = fshade(nx, ny);
    face([W(ax, ay, z0), W(bx, by, z0), W(bx, by, z1), W(ax, ay, z1)], sh(col, f * 1.1), rnd, tex, f < 0.8 ? 0.03 : 0);
  }
  if (top) face([W(x0, y0, z1), W(x1, y0, z1), W(x1, y1, z1), W(x0, y1, z1)], top, rnd, null, 0, 0.8);
}
function frontPt() {
  return Math.atan2(CR, SR);
}
function onFront(x0, x1, y1, xc, w, z0, h) {
  return [W(xc - w / 2, y1, z0), W(xc + w / 2, y1, z0), W(xc + w / 2, y1, z0 + h), W(xc - w / 2, y1, z0 + h)];
}
function door2(xc, y1, z0, w, h, rnd, col) {
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
    0,
    0.8,
  );
}
function win2(xc, y1, z0, rnd) {
  face(onFront(0, 0, y1, xc, 0.07, z0, 4), '#2b2b33', rnd, null, 0, 0.6);
  for (const s of [-1, 1]) face(onFront(0, 0, y1, xc + s * 0.06, 0.05, z0, 4), AC.guede, rnd, null, 0, 0.5);
}
function gable2(x0, y0, x1, y1, z, h, col, rnd, endCol, kind) {
  const ym = (y0 + y1) / 2,
    X0 = x0 - 0.06,
    X1 = x1 + 0.06,
    Y0 = y0 - 0.08,
    Y1 = y1 + 0.08,
    left = vis(-1, 0),
    xw = left ? x0 : x1,
    xe = left ? X0 : X1;
  const dB = [W(0, Y0)[0] - W(0, ym)[0], W(0, Y0, 0)[1] - W(0, ym, h)[1]],
    dF = [W(0, Y1)[0] - W(0, ym)[0], W(0, Y1, 0)[1] - W(0, ym, h)[1]],
    nb = Math.hypot(...dB) || 1,
    nf = Math.hypot(...dF) || 1;
  const tex = kind === 'slate' ? TX.slate([1, 0.36]) : null;
  face(
    [W(X0, Y0, z), W(X1, Y0, z), W(X1, ym, z + h), W(X0, ym, z + h)],
    sh(col, 1.12),
    rnd,
    tex || TX.thatch(dB[0] / nb, dB[1] / nb),
    0,
    0.9,
  );
  face(
    [W(xw, y0, z), W(xw, y1, z), W(xw, ym, z + h)],
    sh(endCol || AC.chaux, fshade(left ? -1 : 1, 0) * 1.08),
    rnd,
    endCol === AC.boisC ? TX.plank : null,
    0.02,
    0.9,
  );
  face(
    [W(X0, ym, z + h), W(X1, ym, z + h), W(X1, Y1, z), W(X0, Y1, z)],
    sh(col, fshade(0, 1) * 1.12),
    rnd,
    tex || TX.thatch(dF[0] / nf, dF[1] / nf),
    0.02,
    1,
  );
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
function hip2(X0, Y0, X1, Y1, z, h, col, rnd, ins, kind) {
  const cx = (X0 + X1) / 2,
    cy = (Y0 + Y1) / 2,
    a = ins ? [X0 + ins, Y0 + ins, X1 - ins, Y1 - ins] : [cx, cy, cx, cy],
    zh = z + h;
  const fs = [
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
      f = v ? fshade(nx, ny) * 1.15 : 1.12,
      e = [sp[pp.length - 1][0] - sp[0][0], sp[pp.length - 1][1] - sp[0][1]],
      en = Math.hypot(...e) || 1;
    face(
      sp,
      sh(col, f),
      rnd,
      kind === 'slate' ? TX.slate([e[0] / en, e[1] / en]) : TX.thatch(0, 1),
      v && f < 0.85 ? 0.025 : 0,
      v ? 1 : 0.7,
    );
  }
}
for (const k of ['stone', 'plank', 'chaux']) TX[k].surf = 1;
{
  const t0 = TX.thatch,
    s0 = TX.slate;
  TX.thatch = (a, b) => {
    const f = t0(a, b);
    f.surf = 1;
    return f;
  };
  TX.slate = d => {
    const f = s0(d);
    f.surf = 1;
    return f;
  };
}
const NC = 8;
function cyl(cx, cy, r, z0, z1, col, rnd, tex) {
  const bot = [],
    top = [];
  for (let k = 0; k < NC; k++) {
    const a0 = (k / NC) * Math.PI * 2,
      a1 = ((k + 1) / NC) * Math.PI * 2,
      am = (a0 + a1) / 2,
      nx = Math.cos(am),
      ny = Math.sin(am);
    if (!vis(nx, ny)) continue;
    const sp = [
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
  const outl = [];
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
function cone(cx, cy, r, z, h, col, rnd, kind) {
  const ap = W(cx - 0.015, cy - 0.02, z + h),
    fs = [];
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
      const m0 = [sp[0][0] + (ap[0] - sp[0][0]) * 0.45, sp[0][1] + (ap[1] - sp[0][1]) * 0.45],
        m1 = [sp[1][0] + (ap[0] - sp[1][0]) * 0.45, sp[1][1] + (ap[1] - sp[1][1]) * 0.45],
        c2 = sh(col, f * (1.07 + (rnd() - 0.5) * 0.05));
      P([m0, m1, ap], c2, c2, 0.7);
      const c3 = sh(col, f * (0.95 + (rnd() - 0.5) * 0.05));
      P([sp[0], sp[1], m1], c3, c3, 0.6);
    }
  }
  const base = [];
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
function cylDoor(cx, cy, r, z0, h, rnd, col) {
  const a = frontPt(),
    x = cx + Math.cos(a) * r,
    y = cy + Math.sin(a) * r,
    t = [-Math.sin(a) * 0.06, Math.cos(a) * 0.06];
  face(
    [W(x - t[0], y - t[1], z0), W(x + t[0], y + t[1], z0), W(x + t[0], y + t[1], z0 + h), W(x - t[0], y - t[1], z0 + h)],
    col || AC.guede,
    rnd,
    null,
    0,
    0.8,
  );
}
/*
 * Le sol d'un bâtiment (terre battue, champ, pavage) est peint à part, sous les ombres : le dessin d'un bâtiment
 * passe en trois couches, le sol (A.LAYER = 'ground'), l'ombre (A.SHADOW) et le volume (A.LAYER = 'body').
 */
function onGround(fn) {
  if (A.SHADOW || A.LAYER === 'body') return;
  if (A.LAYER === 'ground') {
    const g = A.g;
    A.g = A.GROUNDG;
    try {
      fn();
    } finally {
      A.g = g;
    }
  } else fn();
}
/* contour de l'emprise : les arêtes extérieures des cases, chaînées, puis resserrées vers le centre et chanfreinées */
const UNION = {};
function outline(s, shrink, cut) {
  const k0 = s + '|' + shrink + '|' + cut;
  if (UNION[k0]) return UNION[k0];
  const key = p => Math.round(p[0] * 1000) + ',' + Math.round(p[1] * 1000),
    edges = new Map();
  for (const [ox, oy] of FOOT[s])
    for (let k = 0; k < 6; k++) {
      const a = corner(ox, oy, k, HR),
        b = corner(ox, oy, (k + 1) % 6, HR),
        ka = key(a),
        kb = key(b),
        id = ka < kb ? ka + '>' + kb : kb + '>' + ka;
      if (edges.has(id)) edges.delete(id);
      else edges.set(id, [a, b]);
    }
  const list = [...edges.values()],
    loop = [list[0][0]];
  let cur = list[0][1];
  list.splice(0, 1);
  while (list.length) {
    loop.push(cur);
    const n = list.findIndex(([a, b]) => key(a) === key(cur) || key(b) === key(cur));
    if (n < 0) break;
    const [a, b] = list.splice(n, 1)[0];
    cur = key(a) === key(cur) ? b : a;
  }
  let cx = 0,
    cy = 0;
  for (const [ox, oy] of FOOT[s]) {
    cx += ox;
    cy += oy;
  }
  cx /= FOOT[s].length;
  cy /= FOOT[s].length;
  const sm = loop.map(p => [cx + (p[0] - cx) * shrink, cy + (p[1] - cy) * shrink]);
  const out = [];
  for (let k = 0; k < sm.length; k++) {
    const p = sm[(k + sm.length - 1) % sm.length],
      c = sm[k],
      q = sm[(k + 1) % sm.length];
    out.push([c[0] + (p[0] - c[0]) * cut, c[1] + (p[1] - c[1]) * cut], [c[0] + (q[0] - c[0]) * cut, c[1] + (q[1] - c[1]) * cut]);
  }
  return (UNION[k0] = out);
}
/* sol tassé sous un bâtiment, sans contour, un peu fondu dans la prairie */
function ground(s, col, rnd, ins) {
  onGround(() => {
    const c = mix(col, TCOL.g, 0.22),
      pts = outline(s, Math.min(0.96, (ins || 0.9) * 0.95), 0.22).map(([x, y]) => W(x + (rnd() - 0.5) * 0.03, y + (rnd() - 0.5) * 0.03, 0.6));
    P(pts, c, c, 0.6);
    facets(pts, c, rnd, 0.06);
  });
}
function post(x, y, z0, z1, rnd, col) {
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
function barrel3(x, y, rnd) {
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
function crate3(x, y, sz, rnd) {
  box(x - sz, y - sz, x + sz, y + sz, 0, sz * 60, AC.boisC, rnd, TX.plank, sh(AC.boisC, 1.15));
}
function amph3(x, y, rnd) {
  const p = W(x, y);
  const sp = [
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
function logs3(x, y, n, rnd) {
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
function fence3(pts, h, rnd) {
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
function ring(cx, cy, rx, ry, n) {
  const o = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    o.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return o;
}
function banner(x, y, z0, h, col, rnd) {
  post(x, y, z0, z0 + h, rnd, '#5a4030');
  const p = W(x, y, z0 + h);
  const sp = [
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
function shield3(x, y, z, col, rnd) {
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
function menhir3(x, y, h, rnd) {
  if (A.SHADOW) return;
  const p = W(x, y);
  softShadow(p[0] + 4, p[1] + 1, 6, 2.4);
  const sp = [
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
function bArt2(key, s, fn) {
  return sprite('B2' + key, -(s * 44 + 60), -175, s * 44 + 60, s * 34 + 40, rnd => {
    const p = A.LOC;
    A.LOC = null;
    A.LAYER = 'body';
    try {
      fn(rnd);
    } finally {
      A.LOC = p;
      A.LAYER = null;
    }
  });
}
let DUMMY = null;
function bGroundArt(key, s, fn) {
  return sprite('G|B2' + key, -(s * 44 + 30), -(s * 30 + 20), s * 44 + 30, s * 34 + 30, rnd => {
    const p = A.LOC,
      real = A.g;
    if (!DUMMY) {
      const c = document.createElement('canvas');
      c.width = c.height = 1;
      DUMMY = c.getContext('2d');
    }
    A.LOC = null;
    A.LAYER = 'ground';
    A.GROUNDG = real;
    A.g = DUMMY;
    try {
      fn(rnd);
    } finally {
      A.g = real;
      A.LOC = p;
      A.LAYER = null;
      A.GROUNDG = null;
    }
  });
}
/* ce qu'il faut dessiner pour un bâtiment : une clé de cache, une taille d'emprise et la fonction de dessin */
function artOf(b) {
  const t = b.type,
    v = b.id % 3,
    s = b.s;
  if (t === 'hut') {
    if (b.pop <= 0 && b.inc <= 0)
      return [
        'plot',
        1,
        rnd => {
          ground(1, '#c7ae84', rnd, 0.72);
          const R = ring(0, 0, 0.3, 0.3, 6);
          for (const [x, y] of R) post(x, y, 0, 8, rnd, AC.boisC);
          A.g.strokeStyle = 'rgba(240,232,210,.8)';
          A.g.lineWidth = 0.6;
          A.g.beginPath();
          R.concat([R[0]]).forEach(([x, y], k) => {
            const p = W(x, y, 6);
            k ? A.g.lineTo(p[0], p[1]) : A.g.moveTo(p[0], p[1]);
          });
          A.g.stroke();
        },
      ];
    return ['h' + b.lvl + '_' + v, 1, rnd => houseArt(b.lvl, v, rnd)];
  }
  if (t === 'farm') {
    const st = Math.min(3, Math.floor((b.prog / B.farm.time) * 4));
    return ['farm' + st, 2, rnd => farmArt2(st, rnd)];
  }
  if (t.startsWith('t_')) return [t, 3, rnd => templeArt2(B[t].god, rnd)];
  if (B[t].mon) {
    const st = b.done ? 2 : monProg(b) >= 0.5 ? 1 : 0;
    return [t + st, 3, rnd => monArt2(t, st, rnd)];
  }
  return [t, s, rnd => (ART2[t] || ART2.store)(rnd)];
}
function bSprite(b) {
  const [key, s, fn] = artOf(b);
  return bArt2(key, s, fn);
}
/* sol du bâtiment (terre battue, champ), à poser avant les ombres */
function bGround(b) {
  const [key, s, fn] = artOf(b);
  return bGroundArt(key, s, fn);
}
/* ombre portée du bâtiment, à poser au sol avant de le dessiner */
function bShadow(b) {
  const [key, s, fn] = artOf(b);
  return shadowSprite('B2' + key, -(s * 44 + 90), -175, s * 44 + 90, s * 34 + 60, rnd => {
    const p = A.LOC;
    A.LOC = null;
    try {
      fn(rnd);
    } finally {
      A.LOC = p;
    }
  });
}
function houseArt(L, v, rnd) {
  if (L === 1) {
    ground(1, '#c9b08a', rnd, 0.62);
    if (v === 0) logs3(0.26, 0.1, 3, rnd);
    cyl(0, 0, 0.22, 0, 8, AC.granit, rnd, TX.stone);
    cylDoor(0, 0, 0.22, 0, 6.5, rnd);
    cone(0, 0, 0.3, 8, 19, AC.chaume, rnd);
    if (v === 1) barrel3(0.27, 0.16, rnd);
    return;
  }
  if (L === 2) {
    ground(1, '#cdb690', rnd, 0.72);
    if (v === 1) logs3(0.3, -0.05, 4, rnd);
    cyl(0, 0, 0.27, 0, 4, AC.granit, rnd, TX.stone);
    cyl(0, 0, 0.27, 4, 11, AC.chaux, rnd, TX.chaux);
    cylDoor(0, 0, 0.27, 0, 8, rnd);
    cone(0, 0, 0.37, 11, 23, AC.chaume, rnd);
    if (v === 0) barrel3(0.3, 0.18, rnd);
    if (v === 2) {
      amph3(0.3, 0.2, rnd);
      amph3(0.36, 0.12, rnd);
    }
    return;
  }
  if (L === 3) {
    ground(1, '#d0bb98', rnd, 0.82);
    box(-0.34, -0.15, 0.34, 0.15, 0, 3, AC.granit, rnd, TX.stone);
    box(-0.34, -0.15, 0.34, 0.15, 3, 10, AC.chaux, rnd, TX.chaux);
    door2(-0.05, 0.15, 0, 0.11, 8, rnd);
    win2(0.18, 0.15, 4.5, rnd);
    gable2(-0.34, -0.15, 0.34, 0.15, 10, 13, AC.chaume, rnd, AC.chaux);
    if (v === 0) barrel3(0.36, 0.22, rnd);
    if (v === 1) logs3(-0.32, 0.24, 3, rnd);
    return;
  }
  ground(1, '#d6c3a2', rnd, 0.86);
  cyl(0.27, -0.13, 0.11, 0, 16, AC.granit, rnd, TX.stone);
  cone(0.27, -0.13, 0.15, 16, 12, AC.ardoise, rnd, 'slate');
  box(-0.37, -0.14, 0.3, 0.17, 0, 3, AC.granit, rnd, TX.stone);
  box(-0.37, -0.14, 0.3, 0.17, 3, 12, AC.chaux, rnd, TX.chaux);
  door2(-0.04, 0.17, 0, 0.12, 9, rnd, AC.ocre);
  win2(-0.24, 0.17, 5, rnd);
  win2(0.17, 0.17, 5, rnd);
  for (const [x, c] of [
    [-0.15, AC.guede],
    [0.07, AC.ocre],
  ])
    shield3(x, 0.17, 8, c, rnd);
  gable2(-0.37, -0.14, 0.3, 0.17, 12, 15, AC.chaume, rnd, AC.chaux);
  banner(-0.36, 0.22, 0, 30, AC.guede, rnd);
}
function farmArt2(st, rnd) {
  const col = ['#b08458', '#a4a05a', '#86b04e', '#efc556'][st];
  onGround(() => {
    const sp = outline(2, 0.95, 0.12).map(([x, y]) => W(x, y, 0.5));
    P(sp, col, col, 0.6);
    A.g.save();
    pathPts(sp, true);
    A.g.clip();
    facets(sp, col, rnd, 0.05);
    for (let k = -13; k <= 13; k++) {
      const a = W(-1.1, k * 0.08),
        b = W(1.1, k * 0.08);
      A.g.strokeStyle = sh(col, 0.8);
      A.g.lineWidth = 1.1;
      A.g.beginPath();
      A.g.moveTo(a[0], a[1]);
      A.g.lineTo(b[0], b[1]);
      A.g.stroke();
      if (st > 0)
        for (let t = 0; t < 1; t += 0.03) {
          const x = a[0] + (b[0] - a[0]) * t,
            y = a[1] + (b[1] - a[1]) * t,
            h = [0, 2, 4.5, 7][st];
          A.g.strokeStyle = st === 3 ? (rnd() < 0.5 ? '#f6d872' : '#d9a634') : rnd() < 0.5 ? '#5f9a4a' : '#8dbb5e';
          A.g.lineWidth = 0.9;
          A.g.beginPath();
          A.g.moveTo(x, y);
          A.g.lineTo(x + (rnd() - 0.5) * 1.4, y - h * (0.7 + rnd() * 0.5));
          A.g.stroke();
        }
    }
    A.g.restore();
  });
  ground(1, '#bfa580', rnd, 0.22);
  cyl(-0.02, -0.04, 0.09, 0, 5, AC.granit, rnd, TX.stone);
  cone(-0.02, -0.04, 0.13, 5, 10, AC.chaume, rnd);
  if (st === 3) {
    for (const [x, y] of [
      [0.25, 0.12],
      [-0.25, 0.12],
    ]) {
      const p = W(x, y);
      P(
        [
          [p[0] - 3, p[1]],
          [p[0], p[1] - 8],
          [p[0] + 3, p[1]],
        ],
        '#e3bd55',
        '#a07a32',
        0.6,
      );
    }
  }
}
function templeArt2(god, rnd) {
  const GC = { taranis: '#6f8fc4', belenos: '#ecc63f', epona: '#c4643e' }[god];
  ground(3, AC.pave, rnd, 0.92);
  box(-0.62, -0.62, 0.62, 0.62, 0, 9, AC.chaux, rnd, TX.chaux);
  for (let k = -2; k <= 2; k++) {
    const x = k * 0.24;
    face(onFront(0, 0, 0.62, x, 0.08, 0, 7), '#3a3530', rnd, null, 0, 0.5);
  }
  hip2(-0.7, -0.7, 0.7, 0.7, 9, 8, AC.ardoise, rnd, 0.38, 'slate');
  box(-0.3, -0.3, 0.3, 0.3, 17, 36, AC.chaux, rnd, TX.chaux);
  door2(0, 0.3, 17, 0.12, 9, rnd, GC);
  const [sx, sy] = W(0, 0.3, 30);
  A.g.strokeStyle = GC;
  A.g.fillStyle = GC;
  A.g.lineWidth = 1.6;
  if (god === 'taranis') {
    A.g.beginPath();
    A.g.arc(sx, sy, 4, 0, 7);
    A.g.stroke();
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3;
      A.g.beginPath();
      A.g.moveTo(sx, sy);
      A.g.lineTo(sx + Math.cos(a) * 4, sy + Math.sin(a) * 4);
      A.g.stroke();
    }
  } else if (god === 'belenos') {
    A.g.beginPath();
    A.g.arc(sx, sy, 2.8, 0, 7);
    A.g.fill();
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      A.g.beginPath();
      A.g.moveTo(sx + Math.cos(a) * 3.8, sy + Math.sin(a) * 3.8);
      A.g.lineTo(sx + Math.cos(a) * 5.8, sy + Math.sin(a) * 5.8);
      A.g.stroke();
    }
  } else {
    A.g.beginPath();
    A.g.arc(sx, sy + 1, 4, Math.PI * 0.15, Math.PI * 0.85, true);
    A.g.stroke();
  }
  hip2(-0.36, -0.36, 0.36, 0.36, 36, 16, AC.ardoise, rnd, 0, 'slate');
  banner(0.75, 0.6, 0, 40, GC, rnd);
  const al = [
    [-0.2, 0.85],
    [0.2, 0.85],
    [0.2, 0.98],
    [-0.2, 0.98],
  ];
  box(-0.16, 0.82, 0.16, 0.98, 0, 4, AC.granit, rnd, TX.stone, AC.granit);
  for (const [x, y] of [
    [-0.9, 0.3],
    [0.9, 0.3],
    [-0.85, -0.4],
  ])
    oak3(...W(x, y), 0.8, rnd);
}
function monArt2(t, st, rnd) {
  if (t === 'menhirs') {
    ground(3, st < 2 ? '#b8a07a' : '#7fa465', rnd, 0.94);
    const sp = [];
    for (let r = 0; r < 3; r++)
      for (let k = 0; k < 6; k++) sp.push([-1.05 + k * 0.42, -0.55 + r * 0.55, 22 + (5 - k) * 3 + rnd() * 6, r * 6 + k]);
    sp.sort((a, b) => DP2(a[0], a[1]) - DP2(b[0], b[1]));
    for (const [x, y, h, n] of sp) {
      const up = st === 2 || (st === 1 ? n % 2 === 0 : n % 5 === 0);
      if (up) menhir3(x, y, h, rnd);
      else if (n % 3 === 0) {
        box(x - 0.16, y - 0.05, x + 0.16, y + 0.05, 0, 4, AC.granit, rnd, null, AC.granit);
      }
    }
    if (st < 2) {
      logs3(1, 0.9, 5, rnd);
      post(0.4, 0.95, 0, 26, rnd);
      post(0.7, 0.95, 0, 26, rnd);
    }
    return;
  }
  if (t === 'tumulus') {
    ground(3, '#7fa465', rnd, 0.94);
    const [cx, cy] = W(0, 0);
    if (st >= 1) {
      const L = st === 2 ? 12 : 6,
        H = st === 2 ? 40 : 20;
      for (let k = 0; k <= L; k++) {
        const f = k / 12,
          r = Math.sqrt(Math.max(0, 1 - f * f)) * 90;
        A.g.fillStyle =
          st === 2
            ? `rgb(${[92 + f * 60, 140 + f * 40, 84 + f * 20].map(Math.round)})`
            : `rgb(${[150 + f * 30, 120 + f * 24, 84 + f * 14].map(Math.round)})`;
        A.g.beginPath();
        A.g.ellipse(cx - f * 6, cy - (k * H) / L, r, r * 0.55, 0, 0, 7);
        A.g.fill();
      }
      A.g.save();
      A.g.beginPath();
      A.g.ellipse(cx, cy - 12, 84, 54, 0, 0, 7);
      A.g.clip();
      hatchClip(
        [
          [cx, cy - 60],
          [cx + 90, cy],
          [cx, cy + 40],
          [cx - 90, cy],
        ],
        rnd,
        0.02,
      );
      A.g.restore();
      pencil(smoothPts(irregular(cx, cy - H * 0.5, 88, 48 + H * 0.3, 14, rnd, 0.05)), true, 1.2, rnd);
    }
    for (let k = 0; k <= 18; k++) {
      const a = (k / 18) * Math.PI;
      boulder3(...W(Math.cos(a) * 1.45, Math.sin(a) * 1.1), 0.42, rnd);
    }
    if (st === 0) {
      box(-0.2, -0.1, -0.12, 0.25, 0, 14, AC.granit, rnd, TX.stone);
      box(0.12, -0.1, 0.2, 0.25, 0, 14, AC.granit, rnd, TX.stone);
      box(-0.28, -0.15, 0.28, 0.3, 14, 18, AC.granitD, rnd, null, AC.granit);
      logs3(0.9, 0.8, 5, rnd);
    } else {
      const [ex, ey] = W(0, 1.05);
      face(
        [
          [ex - 8, ey],
          [ex - 8, ey - 14],
          [ex + 8, ey - 14],
          [ex + 8, ey],
        ],
        '#241c16',
        rnd,
        null,
        0,
        0.9,
      );
      face(
        [
          [ex - 11, ey - 13],
          [ex + 11, ey - 13],
          [ex + 11, ey - 18],
          [ex - 11, ey - 18],
        ],
        AC.granit,
        rnd,
        null,
        0,
        0.9,
      );
    }
    return;
  }
  ground(3, '#c9b48c', rnd, 0.94);
  const rim = ring(0, 0, 1.25, 1.15, 26),
    back = rim.filter(p => DP2(p[0], p[1]) < 0).sort((a, b) => a[0] - b[0]),
    front = rim.filter(p => DP2(p[0], p[1]) >= 0).sort((a, b) => a[0] - b[0]);
  const lim = st === 0 ? 6 : st === 1 ? 16 : 99;
  fence3(back.slice(0, lim), st === 2 ? 18 : 11, rnd);
  if (st >= 1) {
    const p = W(0, 0);
    A.g.fillStyle = '#2a1e14';
    A.g.beginPath();
    A.g.ellipse(p[0], p[1], 18, 9, 0, 0, 7);
    A.g.fill();
    pencil(smoothPts(irregular(p[0], p[1], 18, 9, 10, rnd, 0.05)), true, 0.8, rnd);
    box(-0.18, -0.4, 0.18, -0.25, 0, 7, AC.granit, rnd, TX.stone, AC.granit);
  }
  if (st === 2)
    for (const [x, y] of [
      [-0.7, -0.5],
      [0.7, -0.5],
      [-0.7, 0.5],
      [0.7, 0.5],
    ]) {
      post(x, y, 0, 26, rnd, '#5a4030');
      const p = W(x, y, 22);
      A.g.strokeStyle = '#5a4030';
      A.g.lineWidth = 1.6;
      A.g.beginPath();
      A.g.moveTo(p[0] - 7, p[1]);
      A.g.lineTo(p[0] + 7, p[1]);
      A.g.stroke();
      shield3(x, y, 16, pick3(rnd, [AC.guede, AC.ocre, AC.ajonc]), rnd);
      const h = W(x, y, 28);
      A.g.fillStyle = AC.fer;
      A.g.beginPath();
      A.g.arc(h[0], h[1], 3, Math.PI, 0);
      A.g.fill();
    }
  if (st === 0) logs3(0.4, 0.4, 5, rnd);
  fence3(front.slice(0, lim), st === 2 ? 18 : 11, rnd);
  if (st >= 1) {
    post(-0.22, 1.18, 0, 30, rnd, '#5a4030');
    post(0.22, 1.18, 0, 30, rnd, '#5a4030');
    const a = W(-0.28, 1.18, 29),
      b = W(0.28, 1.18, 29);
    A.g.strokeStyle = '#5a4030';
    A.g.lineWidth = 3;
    A.g.beginPath();
    A.g.moveTo(a[0], a[1]);
    A.g.lineTo(b[0], b[1]);
    A.g.stroke();
    if (st === 2)
      for (let k = 0; k < 3; k++) {
        const p = W(-0.15 + k * 0.15, 1.18, 25);
        A.g.fillStyle = AC.chaux;
        A.g.beginPath();
        A.g.arc(p[0], p[1], 2.3, 0, 7);
        A.g.fill();
        A.g.fillStyle = '#2a241c';
        A.g.fillRect(p[0] - 1.3, p[1] - 0.6, 0.9, 0.9);
        A.g.fillRect(p[0] + 0.4, p[1] - 0.6, 0.9, 0.9);
      }
  }
}
const ART2 = {
  well(rnd) {
    ground(1, AC.pave, rnd, 0.55);
    cyl(0, 0, 0.15, 0, 6, AC.granit, rnd, TX.stone);
    const t = W(0, 0, 6);
    A.g.fillStyle = AC.granit;
    A.g.beginPath();
    A.g.ellipse(t[0], t[1], 8.4, 8.4 * TILT * 0.9, 0, 0, 7);
    A.g.fill();
    A.g.fillStyle = '#1f3c52';
    A.g.beginPath();
    A.g.ellipse(t[0], t[1], 5.6, 5.6 * TILT * 0.9, 0, 0, 7);
    A.g.fill();
    pencil(smoothPts(irregular(t[0], t[1], 8.4, 4.8, 10, rnd, 0.04)), true, 0.7, rnd);
    post(-0.13, 0, 6, 22, rnd);
    post(0.13, 0, 6, 22, rnd);
    gable2(-0.18, -0.1, 0.18, 0.1, 21, 6, AC.chaume, rnd, AC.boisC);
  },
  pigs(rnd) {
    ground(2, '#8a6a4a', rnd, 0.94);
    const sty = FOOT[2][0];
    box(sty[0] - 0.2, sty[1] - 0.14, sty[0] + 0.2, sty[1] + 0.14, 0, 7, AC.boisC, rnd, TX.plank);
    gable2(sty[0] - 0.2, sty[1] - 0.14, sty[0] + 0.2, sty[1] + 0.14, 7, 8, AC.chaume, rnd, AC.boisC);
    const tr = W(0.15, 0.45);
    face(
      [
        [tr[0] - 9, tr[1]],
        [tr[0] + 9, tr[1] - 4],
        [tr[0] + 9, tr[1] - 1],
        [tr[0] - 9, tr[1] + 3],
      ],
      AC.bois,
      rnd,
      null,
      0,
      0.6,
    );
    const rim = ring(0, 0.05, 0.95, 0.85, 22)
      .filter(p => DP2(p[0], p[1] - 0.05) > -0.3)
      .sort((a, b) => a[0] - b[0]);
    fence3(rim, 7, rnd);
  },
  granary(rnd) {
    ground(2, '#c4ab84', rnd, 0.92);
    for (const [x, y] of [
      [-0.28, -0.2],
      [0.28, -0.2],
      [0.28, 0.2],
      [-0.28, 0.2],
      [0, 0.2],
    ])
      post(x, y, 0, 10, rnd);
    box(-0.32, -0.24, 0.32, 0.24, 10, 21, AC.boisC, rnd, TX.plank);
    door2(0, 0.24, 10, 0.12, 8, rnd);
    gable2(-0.32, -0.24, 0.32, 0.24, 21, 15, AC.chaume, rnd, AC.boisC);
    for (let k = 0; k < 5; k++) {
      const a = W(-0.07, 0.5 - k * 0.06, k * 2),
        b = W(0.07, 0.5 - k * 0.06, k * 2);
      A.g.strokeStyle = AC.bois;
      A.g.lineWidth = 1;
      A.g.beginPath();
      A.g.moveTo(a[0], a[1]);
      A.g.lineTo(b[0], b[1]);
      A.g.stroke();
    }
    for (const [x, y] of [
      [0.62, 0.15],
      [-0.62, 0.15],
    ]) {
      cyl(x, y, 0.12, 0, 6, AC.granit, rnd, TX.stone);
      cone(x, y, 0.16, 6, 11, AC.chaume, rnd);
    }
  },
  market(rnd) {
    ground(2, AC.pave, rnd, 0.94);
    const cols = [
      [AC.guede, AC.chaux],
      [AC.ocre, '#f6e7c4'],
      [AC.ajonc, '#6a4a2a'],
    ];
    FOOT[2]
      .slice()
      .sort((a, b) => DP2(...a) - DP2(...b))
      .forEach(([ox, oy], k) => {
        const x0 = ox - 0.22,
          x1 = ox + 0.22,
          y0 = oy - 0.17,
          y1 = oy + 0.17;
        for (const [x, y] of [
          [x0, y0],
          [x1, y0],
          [x1, y1],
          [x0, y1],
        ])
          post(x, y, 0, 13, rnd);
        box(x0 + 0.04, y0 + 0.04, x1 - 0.04, y1 - 0.04, 0, 5, AC.boisC, rnd, TX.plank, sh(AC.boisC, 1.12));
        for (let q = 0; q < 4; q++) {
          const p = W(x0 + 0.1 + q * 0.08, oy, 5);
          A.g.fillStyle = [AC.ajonc, '#e3a0a0', AC.ocre, '#8dbb5e'][(q + k) % 4];
          A.g.beginPath();
          A.g.arc(p[0], p[1] - 1, 2, 0, 7);
          A.g.fill();
        }
        const aw = [W(x0 - 0.04, y0 - 0.04, 15), W(x1 + 0.04, y0 - 0.04, 15), W(x1 + 0.04, y1 + 0.06, 12), W(x0 - 0.04, y1 + 0.06, 12)];
        face(
          aw,
          cols[k][0],
          rnd,
          sp => {
            for (let q = 0; q < 7; q += 2) {
              const t0 = q / 7,
                t1 = (q + 1) / 7;
              P(
                [
                  W(x0 - 0.04 + (x1 - x0 + 0.08) * t0, y0 - 0.04, 15),
                  W(x0 - 0.04 + (x1 - x0 + 0.08) * t1, y0 - 0.04, 15),
                  W(x0 - 0.04 + (x1 - x0 + 0.08) * t1, y1 + 0.06, 12),
                  W(x0 - 0.04 + (x1 - x0 + 0.08) * t0, y1 + 0.06, 12),
                ],
                cols[k][1],
              );
            }
          },
          0,
          0.8,
        );
      });
  },
  wood(rnd) {
    ground(1, '#b39a74', rnd, 0.7);
    cyl(-0.12, -0.08, 0.15, 0, 6, AC.granit, rnd, TX.stone);
    cone(-0.12, -0.08, 0.2, 6, 13, AC.chaume, rnd);
    logs3(0.18, 0.14, 5, rnd);
    const p = W(0.22, -0.14);
    A.g.fillStyle = AC.bois;
    A.g.beginPath();
    A.g.ellipse(p[0], p[1] - 2, 4, 2, 0, 0, 7);
    A.g.fill();
    A.g.fillStyle = '#e0c08a';
    A.g.beginPath();
    A.g.ellipse(p[0], p[1] - 4, 4, 2, 0, 0, 7);
    A.g.fill();
    pencil(smoothPts(irregular(p[0], p[1] - 3, 4, 2.6, 8, rnd, 0.05)), true, 0.6, rnd);
  },
  quarry(rnd) {
    ground(1, '#a39590', rnd, 0.82);
    box(-0.3, -0.3, 0.02, -0.02, 0, 16, AC.granitD, rnd, TX.stone, AC.granit);
    box(0.05, 0.08, 0.25, 0.25, 0, 6, AC.granit, rnd, null, sh(AC.granit, 1.1));
    box(-0.24, 0.1, -0.04, 0.28, 0, 6, AC.granit, rnd, null, sh(AC.granit, 1.1));
    box(-0.18, 0.14, -0.06, 0.24, 6, 11, AC.granit, rnd, null, sh(AC.granit, 1.1));
    post(0.22, -0.2, 0, 28, rnd);
    const t = W(0.22, -0.2, 28),
      e = W(0.36, 0.08, 24);
    A.g.strokeStyle = AC.bois;
    A.g.lineWidth = 1.8;
    A.g.beginPath();
    A.g.moveTo(t[0], t[1]);
    A.g.lineTo(e[0], e[1]);
    A.g.stroke();
    A.g.strokeStyle = '#ddd6c0';
    A.g.lineWidth = 0.6;
    A.g.beginPath();
    A.g.moveTo(e[0], e[1]);
    A.g.lineTo(e[0], e[1] + 12);
    A.g.stroke();
  },
  mine(rnd) {
    ground(2, '#9a8a7a', rnd, 0.94);
    mass(...W(0, -0.1), 62, 34, AC.granitD, rnd, { n: 11, hatch: 28, w: 1.3, v: 0.18 });
    mass(...W(-0.35, -0.25, 10), 30, 18, AC.granit, rnd, { n: 9, hatch: 8, v: 0.2 });
    const [ex, ey] = W(0, 0.35);
    face(
      [
        [ex - 11, ey],
        [ex - 11, ey - 16],
        [ex + 11, ey - 16],
        [ex + 11, ey],
      ],
      '#1c1612',
      rnd,
      null,
      0,
      0.8,
    );
    post(-0.2, 0.35, 0, 17, rnd);
    post(0.2, 0.35, 0, 17, rnd);
    const a = W(-0.24, 0.35, 17),
      b = W(0.24, 0.35, 17);
    A.g.strokeStyle = AC.bois;
    A.g.lineWidth = 3;
    A.g.beginPath();
    A.g.moveTo(a[0], a[1]);
    A.g.lineTo(b[0], b[1]);
    A.g.stroke();
    box(0.45, 0.4, 0.62, 0.55, 2, 7, AC.bois, rnd, TX.plank, '#6a5a5a');
  },
  brew(rnd) {
    ground(2, '#c9b08a', rnd, 0.92);
    box(-0.55, -0.22, 0.4, 0.18, 0, 3, AC.granit, rnd, TX.stone);
    box(-0.55, -0.22, 0.4, 0.18, 3, 12, AC.chaux, rnd, TX.chaux);
    door2(-0.2, 0.18, 0, 0.13, 9, rnd);
    win2(0.14, 0.18, 5, rnd);
    gable2(-0.55, -0.22, 0.4, 0.18, 12, 14, AC.chaume, rnd, AC.chaux);
    box(0.18, -0.14, 0.3, -0.02, 20, 32, AC.granit, rnd, TX.stone, AC.granitD);
    for (const [x, y] of [
      [0.35, 0.45],
      [0.45, 0.38],
      [0.24, 0.5],
    ])
      barrel3(x, y, rnd);
    cyl(-0.4, 0.48, 0.09, 0, 5, '#3a3836', rnd);
    const t = W(-0.4, 0.48, 5);
    A.g.fillStyle = '#d9a23a';
    A.g.beginPath();
    A.g.ellipse(t[0], t[1], 4.4, 2.4, 0, 0, 7);
    A.g.fill();
  },
  forge(rnd) {
    ground(2, '#a9a098', rnd, 0.92);
    box(-0.45, -0.25, 0.45, 0.2, 0, 12, AC.granit, rnd, TX.stone);
    door2(0, 0.2, 0, 0.16, 9, rnd, '#3a2a20');
    hip2(-0.5, -0.3, 0.5, 0.25, 12, 10, AC.ardoise, rnd, 0, 'slate');
    box(0.22, -0.2, 0.36, -0.06, 18, 38, AC.granitD, rnd, TX.stone, '#5a5650');
    const p = W(-0.3, 0.5);
    face(
      [
        [p[0] - 6, p[1] - 6],
        [p[0] + 6, p[1] - 6],
        [p[0] + 5, p[1] - 3],
        [p[0] - 5, p[1] - 3],
      ],
      '#3a3836',
      rnd,
      null,
      0,
      0.7,
    );
    post(-0.3, 0.5, 0, 6, rnd, '#3a3836');
    box(0.3, 0.4, 0.55, 0.55, 0, 4, AC.bois, rnd, TX.plank, '#3f6a8a');
  },
  store(rnd) {
    ground(2, '#c4ab84', rnd, 0.92);
    box(-0.55, -0.28, 0.5, 0.22, 0, 15, AC.boisC, rnd, TX.plank);
    door2(0, 0.22, 0, 0.22, 11, rnd, AC.bois);
    gable2(-0.55, -0.28, 0.5, 0.22, 15, 15, AC.chaume, rnd, AC.boisC);
    crate3(0.42, 0.45, 0.07, rnd);
    crate3(0.3, 0.52, 0.06, rnd);
    barrel3(-0.4, 0.45, rnd);
    barrel3(-0.28, 0.5, rnd);
    amph3(0.58, 0.32, rnd);
    amph3(0.62, 0.4, rnd);
  },
  tower(rnd) {
    ground(1, '#b8a07a', rnd, 0.6);
    for (const [x, y] of [
      [-0.16, -0.16],
      [0.16, -0.16],
      [0.16, 0.16],
      [-0.16, 0.16],
    ])
      post(x, y, 0, 26, rnd);
    const a = W(-0.16, 0.16, 3),
      b = W(0.16, 0.16, 22),
      c = W(0.16, 0.16, 3),
      d = W(-0.16, 0.16, 22);
    A.g.strokeStyle = AC.bois;
    A.g.lineWidth = 1.2;
    A.g.beginPath();
    A.g.moveTo(a[0], a[1]);
    A.g.lineTo(b[0], b[1]);
    A.g.moveTo(c[0], c[1]);
    A.g.lineTo(d[0], d[1]);
    A.g.stroke();
    box(-0.22, -0.22, 0.22, 0.22, 25, 27, AC.bois, rnd, TX.plank, AC.boisC);
    const [fx, fy] = W(0, 0, 27);
    figure(fx, fy, 0, AC.guede, 'soldier');
    box(-0.22, -0.22, 0.22, 0.22, 27, 32, AC.boisC, rnd, TX.plank);
    for (const [x, y] of [
      [-0.2, -0.2],
      [0.2, -0.2],
      [0.2, 0.2],
      [-0.2, 0.2],
    ])
      post(x, y, 32, 40, rnd);
    cone(0, 0, 0.3, 40, 14, AC.chaume, rnd);
  },
  barracks(rnd) {
    ground(2, '#c4ab84', rnd, 0.92);
    box(-0.6, -0.42, 0.6, -0.08, 0, 12, AC.boisC, rnd, TX.plank);
    door2(0, -0.08, 0, 0.14, 9, rnd, AC.ocre);
    gable2(-0.6, -0.42, 0.6, -0.08, 12, 13, AC.chaume, rnd, AC.boisC);
    const [dx, dy] = W(-0.3, 0.35);
    A.g.strokeStyle = AC.bois;
    A.g.lineWidth = 2;
    A.g.beginPath();
    A.g.moveTo(dx, dy);
    A.g.lineTo(dx, dy - 17);
    A.g.moveTo(dx - 7, dy - 12);
    A.g.lineTo(dx + 7, dy - 11);
    A.g.stroke();
    A.g.fillStyle = '#e6c870';
    A.g.beginPath();
    A.g.ellipse(dx, dy - 13, 3.4, 4.5, 0, 0, 7);
    A.g.fill();
    pencil(smoothPts(irregular(dx, dy - 13, 3.4, 4.5, 8, rnd, 0.05)), true, 0.6, rnd);
    post(0.2, 0.4, 0, 13, rnd);
    post(0.6, 0.4, 0, 13, rnd);
    const a = W(0.2, 0.4, 11),
      b = W(0.6, 0.4, 11);
    A.g.strokeStyle = AC.bois;
    A.g.lineWidth = 1.4;
    A.g.beginPath();
    A.g.moveTo(a[0], a[1]);
    A.g.lineTo(b[0], b[1]);
    A.g.stroke();
    for (let k = 0; k < 4; k++) {
      const p = W(0.27 + k * 0.1, 0.4);
      A.g.strokeStyle = '#6b4626';
      A.g.lineWidth = 0.9;
      A.g.beginPath();
      A.g.moveTo(p[0], p[1]);
      A.g.lineTo(p[0] + 1, p[1] - 19);
      A.g.stroke();
      A.g.fillStyle = '#c8cdd2';
      A.g.beginPath();
      A.g.moveTo(p[0] + 0.4, p[1] - 19);
      A.g.lineTo(p[0] + 2, p[1] - 19);
      A.g.lineTo(p[0] + 1.4, p[1] - 23);
      A.g.fill();
    }
    [AC.guede, AC.ocre, AC.ajonc].forEach((c, k) => shield3(0.26 + k * 0.15, 0.44, 4, c, rnd));
  },
  grove(rnd) {
    ground(3, '#6fa04c', rnd, 0.94);
    A.g.strokeStyle = 'rgba(240,232,200,.4)';
    A.g.lineWidth = 1.2;
    const [cx, cy] = W(0, 0);
    A.g.beginPath();
    A.g.ellipse(cx, cy, 42, 26, 0, 0, 7);
    A.g.stroke();
    const trees = [
      [-0.95, -0.45],
      [0.95, -0.45],
      [0, -1],
      [-0.6, -0.85],
      [0.6, -0.85],
    ];
    trees.sort((a, b) => DP2(...a) - DP2(...b));
    for (const [x, y] of trees) oak3(...W(x, y), 1, rnd);
    menhir3(0, 0, 30, rnd);
    for (const [c, o] of [
      [AC.ocre, -5],
      [AC.guede, 0],
      [AC.ajonc, 5],
    ]) {
      const p = W(0, 0, 22);
      A.g.strokeStyle = c;
      A.g.lineWidth = 1.2;
      A.g.beginPath();
      A.g.moveTo(p[0] - 3, p[1] + o * 0.2);
      A.g.quadraticCurveTo(p[0] + 6, p[1] + 4 + o * 0.3, p[0] + 4, p[1] + 12 + o * 0.4);
      A.g.stroke();
    }
    box(0.25, 0.25, 0.5, 0.38, 0, 4, AC.granit, rnd, null, AC.granit);
    for (const [x, y] of [
      [-0.95, 0.5],
      [0.9, 0.55],
    ])
      oak3(...W(x, y), 1, rnd);
  },
  bard(rnd) {
    ground(2, '#a99a72', rnd, 0.9);
    const rim = ring(0, 0.05, 0.55, 0.45, 10);
    rim.sort((a, b) => DP2(...a) - DP2(...b));
    for (const [k, [x, y]] of rim.entries()) {
      if (k % 2) boulder3(...W(x, y), 0.42, rnd);
      else {
        const a = W(x - 0.08, y),
          b = W(x + 0.08, y);
        A.g.strokeStyle = AC.bois;
        A.g.lineWidth = 4;
        A.g.lineCap = 'round';
        A.g.beginPath();
        A.g.moveTo(a[0], a[1] - 2);
        A.g.lineTo(b[0], b[1] - 2);
        A.g.stroke();
        pencil(
          [
            [a[0], a[1] - 4],
            [b[0], b[1] - 4],
          ],
          false,
          0.5,
          rnd,
        );
      }
    }
    const p = W(0, 0.05);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * 7;
      A.g.fillStyle = '#6c6960';
      A.g.beginPath();
      A.g.ellipse(p[0] + Math.cos(a) * 7, p[1] + Math.sin(a) * 3.5, 2.2, 1.5, 0, 0, 7);
      A.g.fill();
    }
  },
  chief(rnd) {
    ground(3, '#d0bb98', rnd, 0.94);
    const rim = ring(0, 0, 1.25, 1.12, 28)
      .filter(p => DP2(...p) < -0.1)
      .sort((a, b) => a[0] - b[0]);
    fence3(rim, 13, rnd);
    box(-0.85, -0.32, 0.85, 0.3, 0, 4, AC.granit, rnd, TX.stone);
    box(-0.85, -0.32, 0.85, 0.3, 4, 15, AC.chaux, rnd, TX.chaux);
    door2(0, 0.3, 0, 0.18, 12, rnd, AC.ocre);
    win2(-0.45, 0.3, 7, rnd);
    win2(0.45, 0.3, 7, rnd);
    [AC.guede, AC.ocre, AC.ajonc, AC.guede].forEach((c, k) => shield3(-0.7 + k * 0.47 + (k > 1 ? 0.1 : 0), 0.3, 10, c, rnd));
    gable2(-0.85, -0.32, 0.85, 0.3, 15, 22, AC.chaume, rnd, AC.chaux);
    for (const x of [-0.3, 0.3]) post(x, 0.62, 0, 18, rnd, '#5a4030');
    banner(0.95, -0.25, 0, 52, AC.ocre, rnd);
  },
  port(rnd) {
    ground(2, '#c8b996', rnd, 0.92);
    box(-0.55, -0.3, 0.15, 0.12, 0, 11, AC.boisC, rnd, TX.plank);
    door2(-0.2, 0.12, 0, 0.2, 9, rnd, AC.guede);
    gable2(-0.55, -0.3, 0.15, 0.12, 11, 13, AC.chaume, rnd, AC.boisC);
    post(0.35, -0.25, 0, 18, rnd);
    post(0.65, -0.05, 0, 18, rnd);
    A.g.strokeStyle = 'rgba(230,220,190,.75)';
    A.g.lineWidth = 0.5;
    for (let k = 0; k < 6; k++) {
      const a = W(0.35, -0.25, 16 - k * 2.4),
        b = W(0.65, -0.05, 16 - k * 2.4);
      A.g.beginPath();
      A.g.moveTo(a[0], a[1]);
      A.g.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 3, b[0], b[1]);
      A.g.stroke();
    }
    barrel3(-0.4, 0.4, rnd);
    barrel3(-0.28, 0.46, rnd);
    crate3(0.05, 0.42, 0.07, rnd);
    crate3(0.18, 0.5, 0.06, rnd);
    amph3(0.42, 0.3, rnd);
    amph3(0.48, 0.36, rnd);
  },
};
ART2.trade = ART2.store;
/* animations posées sur les nouveaux dessins (coordonnées relatives au centre du bâtiment) */
function liveB(b, time) {
  const p = A.LOC,
    [ox, oy] = bc(b);
  A.LOC = { c: 0, k: 1, ox, oy, z: ZH(idx(b.x, b.y)) };
  try {
    liveB2(b, time);
  } finally {
    A.LOC = p;
  }
}
function liveB2(b, time) {
  const t = b.type;
  if (t === 'port' && A.S.dock != null && A.S.dock >= 0) {
    const p = A.LOC;
    A.LOC = null;
    const [cx, cy] = bc(b),
      d = A.S.dock,
      z0 = ZH(idx(b.x, b.y));
    for (let k = 0; k < 7; k++) {
      const u = 0.25 + k * 0.11,
        x0 = cx + (HX(d) - cx) * u,
        y0 = cy + (HY(d) - cy) * u,
        dx = HY(d) - cy,
        dy = -(HX(d) - cx),
        n = Math.hypot(dx, dy) || 1;
      P(
        [
          W(x0 + (dx / n) * 0.13, y0 + (dy / n) * 0.13, z0 + 2),
          W(x0 + (dx / n) * 0.13 + (HX(d) - cx) * 0.1, y0 + (dy / n) * 0.13 + (HY(d) - cy) * 0.1, z0 + 2),
          W(x0 - (dx / n) * 0.13 + (HX(d) - cx) * 0.1, y0 - (dy / n) * 0.13 + (HY(d) - cy) * 0.1, z0 + 2),
          W(x0 - (dx / n) * 0.13, y0 - (dy / n) * 0.13, z0 + 2),
        ],
        k % 2 ? '#9a7a5a' : '#a88762',
        '#4e3e30',
        0.6,
      );
      if (k % 2 === 0) {
        const q = W(x0, y0, z0 + 2);
        ln(q, [q[0], q[1] + 10], '#3e3228', 1.6);
      }
    }
    const [sx, sy] = W(HX(d), HY(d), ZW);
    shipFig(sx + 6, sy + 2, 0.85, '#5a4030', '#c98a4a', time, 0);
    A.LOC = p;
  } else if (t === 'pigs')
    for (let k = 0; k < 3; k++) {
      const [px, py] = W(0.05 + k * 0.22 + Math.sin(time / 800 + k) * 0.08, 0.15 + Math.cos(time / 1000 + k * 2) * 0.1);
      A.g.fillStyle = 'rgba(0,0,0,.25)';
      A.g.beginPath();
      A.g.ellipse(px + 2, py, 6, 2.4, 0, 0, 7);
      A.g.fill();
      A.g.fillStyle = '#f0b0aa';
      A.g.beginPath();
      A.g.ellipse(px, py - 4, 6, 3.6, 0, 0, 7);
      A.g.fill();
      A.g.fillStyle = '#d8948e';
      A.g.beginPath();
      A.g.ellipse(px + 1.5, py - 3.5, 4, 2.4, 0, 0, 7);
      A.g.fill();
      A.g.fillStyle = '#f0b0aa';
      A.g.beginPath();
      A.g.arc(px - 5.5, py - 5, 2.6, 0, 7);
      A.g.fill();
      A.g.strokeStyle = INK;
      A.g.globalAlpha = 0.6;
      A.g.lineWidth = 0.6;
      A.g.beginPath();
      A.g.ellipse(px, py - 4, 6, 3.6, 0, 0, 7);
      A.g.stroke();
      A.g.globalAlpha = 1;
    }
  else if (t === 'brew') {
    if (b.wk > 0) smoke(0.24, -0.08, 34, time, 'r');
  } else if (t === 'forge') {
    const [px, py] = W(0, 0.2, 4);
    const f = Math.sin(time / 120) * 0.5 + 0.5;
    A.g.fillStyle = `rgba(255,${(120 + f * 70) | 0},40,${b.wk > 0 ? 0.95 : 0.25})`;
    A.g.fillRect(px - 4, py - 6, 8, 6);
    if (b.wk > 0) {
      blur(1);
      A.g.fillStyle = `rgba(255,150,40,${0.25 + f * 0.15})`;
      A.g.beginPath();
      A.g.arc(px, py - 2, 10, 0, 7);
      A.g.fill();
      blur(0);
      smoke(0.29, -0.13, 40, time, 'k');
    }
  } else if (t === 'bard') {
    const [px, py] = W(0, 0.05);
    const f = Math.sin(time / 90) * 2,
      f2 = Math.cos(time / 130) * 1.5;
    A.g.fillStyle = 'rgba(255,170,60,.2)';
    A.g.beginPath();
    A.g.arc(px, py - 6, 16, 0, 7);
    A.g.fill();
    A.g.fillStyle = '#e0601e';
    A.g.beginPath();
    A.g.moveTo(px - 7, py);
    A.g.quadraticCurveTo(px - 4 + f2, py - 14, px + f, py - 21 - f);
    A.g.quadraticCurveTo(px + 4, py - 10, px + 7, py);
    A.g.fill();
    A.g.fillStyle = '#f8d050';
    A.g.beginPath();
    A.g.moveTo(px - 4, py);
    A.g.quadraticCurveTo(px, py - 12 + f, px + 4, py);
    A.g.fill();
  } else if (B[t].store) {
    const u = used(b) / B[t].cap;
    if (u > 0) {
      const [px, py] = W(0, 0, 58);
      A.g.fillStyle = 'rgba(20,20,15,.75)';
      A.g.fillRect(px - 15, py, 30, 4.5);
      A.g.fillStyle = AC.ajonc;
      A.g.fillRect(px - 14.5, py + 0.5, 29 * u, 3.5);
    }
  }
  if (b.hp != null && b.hp < b.maxhp) {
    const [px, py] = W(0, 0, b.s > 1 ? 62 : 44);
    A.g.fillStyle = 'rgba(0,0,0,.65)';
    A.g.fillRect(px - 14, py, 28, 4);
    A.g.fillStyle = '#de6a4e';
    A.g.fillRect(px - 14, py, 28 * Math.max(0, b.hp / b.maxhp), 4);
  }
}
document.querySelectorAll('.vb button[data-v]').forEach(
  b =>
    (b.onclick = () => {
      A.view = b.dataset.v;
      A.lastOv = '';
    }),
);

export { bGround, bShadow, bSprite, liveB };
