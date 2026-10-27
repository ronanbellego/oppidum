// @ts-nocheck — affichage et interface extraits de la version mono-fichier ; à typer progressivement.
import { hashS, rng } from '../core/rng';
import { A } from '../app/state';

const shc = {};
function sh(col, f) {
  const k = col + f;
  if (shc[k]) return shc[k];
  let r, gg, bb;
  if (col[0] === '#') {
    const n = parseInt(col.slice(1), 16);
    r = n >> 16;
    gg = (n >> 8) & 255;
    bb = n & 255;
  } else {
    const m = col.match(/[\d.]+/g);
    r = +m[0];
    gg = +m[1];
    bb = +m[2];
  }
  const c = v => Math.max(0, Math.min(255, Math.round(v * f)));
  return (shc[k] = `rgb(${c(r)},${c(gg)},${c(bb)})`);
}
/* mélange de deux couleurs #rrggbb, t de 0 (a) à 1 (b) */
const mixc = {};
function mix(a, b, t) {
  t = Math.max(0, Math.min(1, t));
  const k = a + b + ((t * 64) | 0);
  if (mixc[k]) return mixc[k];
  const p = parseInt(a.slice(1), 16),
    q = parseInt(b.slice(1), 16),
    tq = ((t * 64) | 0) / 64;
  const ch = s => Math.round(((p >> s) & 255) * (1 - tq) + ((q >> s) & 255) * tq);
  return (mixc[k] = '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1));
}

/*
 * Résolution des dessins mis en cache. Chaque petite image est peinte à la densité de pixels réellement
 * affichée (zoom × densité de l'écran), arrondie à un palier pour ne pas repeindre à chaque cran de molette.
 * Quand le palier change, les images de l'ancien palier sont abandonnées et repeintes à la demande.
 */
const LEVELS = [1, 1.5, 2, 2.5, 3, 3.5, 4];
function levelFor(need, cur, max) {
  need = Math.min(max, need);
  let l = LEVELS.find(v => v >= need - 0.02) ?? LEVELS[LEVELS.length - 1];
  l = Math.min(l, max);
  // hystérésis : on garde le palier courant tant qu'il couvre le besoin sans être trois fois trop fin
  if (cur && cur >= need - 0.02 && cur <= Math.max(need * 1.6, LEVELS[0]) && cur <= max) return cur;
  return l;
}
const SPR = {};
let SPRL = 0,
  T0 = 0;
/*
 * Au changement de palier, les images ne sont pas toutes repeintes d'un coup : chaque image du jeu dispose
 * d'environ 8 ms pour repeindre ; au-delà, l'ancienne version (d'une autre résolution) reste affichée.
 */
function spriteLevel(need) {
  T0 = performance.now();
  SPRL = levelFor(need, SPRL, 4);
  return SPRL;
}
function canPaint() {
  return performance.now() - T0 < 8;
}
const OUT = 'rgba(30,18,8,.55)';
function paint(w, h, sk, x0, y0, fn, seed) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * sk));
  c.height = Math.max(1, Math.ceil(h * sk));
  const prev = A.g;
  A.g = c.getContext('2d');
  A.g.setTransform(sk, 0, 0, sk, -x0 * sk, -y0 * sk);
  A.g.lineJoin = 'round';
  A.g.lineCap = 'round';
  try {
    fn(rng(seed));
  } finally {
    A.g = prev;
  }
  return c;
}
function sprite(key, x0, y0, x1, y1, fn) {
  const o = SPR[key];
  if (o && (o.l === SPRL || !canPaint())) return o;
  const sk = SPRL || 2,
    w = x1 - x0,
    h = y1 - y0;
  return (SPR[key] = { c: paint(w, h, sk, x0, y0, fn, hashS(key)), x0, y0, w, h, l: sk });
}

/*
 * Ombre portée d'un dessin : on le repeint en écrasant chaque point sur le sol dans la direction opposée
 * au soleil (voir W dans projection.ts), puis on n'en garde que la silhouette, assombrie et adoucie.
 * Les parties dessinées à plat (sol, champs) ne projettent rien.
 */
const SUN = [0.0157, 0.019];
function shadowSprite(key, x0, y0, x1, y1, fn) {
  const k = 'S|' + key,
    o = SPR[k];
  if (o && (o.l === SPRL || !canPaint())) return o;
  const sk = SPRL || 2,
    w = x1 - x0,
    h = y1 - y0;
  const prev = A.SHADOW;
  A.SHADOW = SUN;
  let c;
  try {
    c = paint(w, h, sk, x0, y0, fn, hashS(key));
  } finally {
    A.SHADOW = prev;
  }
  const out = document.createElement('canvas');
  out.width = c.width;
  out.height = c.height;
  const g = out.getContext('2d');
  try {
    g.filter = `blur(${(0.8 * sk).toFixed(1)}px)`;
  } catch (e) {}
  g.drawImage(c, 0, 0);
  g.filter = 'none';
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = 'rgba(22,44,38,.4)';
  g.fillRect(0, 0, out.width, out.height);
  return (SPR[k] = { c: out, x0, y0, w, h, l: sk });
}

function blit(s, ax, ay) {
  A.g.drawImage(s.c, ax + s.x0, ay + s.y0, s.w, s.h);
}
function P(pts, fill, stroke, lw) {
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
/* un triangle plein, bordé de sa propre couleur pour effacer les jours entre facettes voisines */
function tri(a, b, c, col) {
  P([a, b, c], col, col, 0.5);
}
function ln(a, b, c, w) {
  A.g.strokeStyle = c;
  A.g.lineWidth = w;
  A.g.beginPath();
  A.g.moveTo(a[0], a[1]);
  A.g.lineTo(b[0], b[1]);
  A.g.stroke();
}
function clipPoly(pts) {
  A.g.beginPath();
  A.g.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k < pts.length; k++) A.g.lineTo(pts[k][0], pts[k][1]);
  A.g.closePath();
  A.g.clip();
}
function bbox(pts) {
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
function pick3(rnd, a) {
  return a[(rnd() * a.length) | 0];
}
function strokes(pts, rnd, dens, len, dx, dy, cols, w, jit) {
  A.g.save();
  clipPoly(pts);
  const [a, b, c, d] = bbox(pts);
  const n = Math.max(4, ((c - a) * (d - b) * dens) | 0);
  A.g.lineWidth = w;
  for (let k = 0; k < n; k++) {
    const x = a + rnd() * (c - a),
      y = b + rnd() * (d - b),
      ex = dx + (rnd() - 0.5) * jit,
      ey = dy + (rnd() - 0.5) * jit,
      l = len * (0.6 + rnd() * 0.7);
    A.g.strokeStyle = pick3(rnd, cols);
    A.g.beginPath();
    A.g.moveTo(x, y);
    A.g.lineTo(x + ex * l, y + ey * l);
    A.g.stroke();
  }
  A.g.restore();
}
function blur(on) {
  try {
    A.g.filter = on ? 'blur(3.5px)' : 'none';
  } catch (e) {}
}

/*
 * Volume à facettes vu d'en haut : un anneau extérieur irrégulier, un anneau intérieur décalé vers le soleil
 * et un sommet. Chaque facette est éclairée selon son orientation à l'écran (soleil en haut à gauche).
 * Sert aux houppiers, aux rochers, aux touffes de lande.
 */
const LDIR = [-0.72, -0.69];
function gem(x, y, rx, ry, base, rnd, opt = {}) {
  // dessiné en pixels, debout : il ne projette pas d'ombre calculée (les arbres et rochers ont leur ombre douce)
  if (A.SHADOW) return [];
  const n = opt.n || 8,
    v = opt.v ?? 0.22,
    amp = opt.amp ?? 0.3,
    o = [],
    m = Math.max(3, Math.round(n / 2)),
    inner = [];
  const rot = rnd() * Math.PI * 2;
  for (let k = 0; k < n; k++) {
    const a = rot + (k / n) * Math.PI * 2 + (rnd() - 0.5) * 0.35,
      f = 1 - v / 2 + rnd() * v;
    o.push([x + Math.cos(a) * rx * f, y + Math.sin(a) * ry * f]);
  }
  const cx = x + LDIR[0] * rx * 0.16,
    cy = y + LDIR[1] * ry * 0.22 - (opt.lift ?? 0.12) * ry;
  for (let k = 0; k < m; k++) {
    const a = rot + ((k + 0.5) / m) * Math.PI * 2;
    inner.push([cx + Math.cos(a) * rx * 0.48, cy + Math.sin(a) * ry * 0.46]);
  }
  const shade = (px, py, top) => {
    let dx = px - x,
      dy = (py - y) * (rx / ry);
    const d = Math.hypot(dx, dy) || 1;
    const dot = (dx / d) * LDIR[0] + (dy / d) * LDIR[1];
    return (top ? 1.07 + amp * 0.35 * dot : 0.9 + amp * dot) * (1 + (rnd() - 0.5) * 0.06);
  };
  // bande extérieure : chaque arête de l'anneau extérieur rejoint le point intérieur le plus proche
  const near = p => {
    let b = inner[0],
      bd = 1e9;
    for (const q of inner) {
      const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2;
      if (d < bd) {
        bd = d;
        b = q;
      }
    }
    return b;
  };
  P(o, sh(base, 0.9));
  for (let k = 0; k < n; k++) {
    const p = o[k],
      q = o[(k + 1) % n],
      a = near(p),
      b = near(q);
    tri(p, q, b, sh(base, shade((p[0] + q[0] + b[0]) / 3, (p[1] + q[1] + b[1]) / 3, false)));
    if (a !== b) tri(p, b, a, sh(base, shade((p[0] + a[0] + b[0]) / 3, (p[1] + a[1] + b[1]) / 3, false)));
  }
  for (let k = 0; k < m; k++) {
    const p = inner[k],
      q = inner[(k + 1) % m];
    tri([cx, cy], p, q, sh(base, shade((p[0] + q[0] + cx) / 3, (p[1] + q[1] + cy) / 3, true)));
  }
  return o;
}

export { OUT, P, LDIR, bbox, canPaint, blit, blur, gem, ln, mix, pick3, sh, shadowSprite, sprite, spriteLevel, levelFor, strokes, tri };
