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
/*
 * Triangle en dégradé : chaque sommet a sa couleur [r, g, b] et la couleur varie linéairement entre eux
 * (ombrage de Gouraud). Le canevas ne sait faire que des dégradés linéaires : on prend la direction où
 * la luminosité change le plus et l'on y pose les deux couleurs extrêmes. Bordé de son propre dégradé
 * pour effacer les jours entre triangles voisins.
 */
function rgbs(c) {
  const k = v => Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${k(c[0])},${k(c[1])},${k(c[2])})`;
}
function gtri(p0, p1, p2, c0, c1, c2) {
  const g = A.g;
  const ex = p1[0] - p0[0],
    ey = p1[1] - p0[1],
    fx = p2[0] - p0[0],
    fy = p2[1] - p0[1],
    det = ex * fy - ey * fx;
  const lum = c => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  const l0 = lum(c0),
    l1 = lum(c1) - l0,
    l2 = lum(c2) - l0;
  let style;
  if (Math.abs(det) < 1e-6 || (Math.abs(l1) < 0.6 && Math.abs(l2) < 0.6)) {
    style = rgbs([(c0[0] + c1[0] + c2[0]) / 3, (c0[1] + c1[1] + c2[1]) / 3, (c0[2] + c1[2] + c2[2]) / 3]);
  } else {
    // gradient de la luminosité dans le plan de l'écran
    const gx = (l1 * fy - l2 * ey) / det,
      gy = (l2 * ex - l1 * fx) / det,
      gn = Math.hypot(gx, gy),
      nx = gx / gn,
      ny = gy / gn;
    const t = [0, ex * nx + ey * ny, fx * nx + fy * ny],
      tmin = Math.min(...t),
      tmax = Math.max(...t);
    const A0 = [p0[0] + nx * tmin, p0[1] + ny * tmin],
      B0 = [p0[0] + nx * tmax, p0[1] + ny * tmax];
    // couleur d'un point du plan par coordonnées barycentriques (extrapolées hors du triangle)
    const at = q => {
      const qx = q[0] - p0[0],
        qy = q[1] - p0[1],
        b1 = (qx * fy - qy * fx) / det,
        b2 = (ex * qy - ey * qx) / det,
        b0 = 1 - b1 - b2;
      return [0, 1, 2].map(k => b0 * c0[k] + b1 * c1[k] + b2 * c2[k]);
    };
    style = g.createLinearGradient(A0[0], A0[1], B0[0], B0[1]);
    style.addColorStop(0, rgbs(at(A0)));
    style.addColorStop(1, rgbs(at(B0)));
  }
  g.beginPath();
  g.moveTo(p0[0], p0[1]);
  g.lineTo(p1[0], p1[1]);
  g.lineTo(p2[0], p2[1]);
  g.closePath();
  g.fillStyle = style;
  g.fill();
  g.strokeStyle = style;
  g.lineWidth = 1;
  g.stroke();
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
 * Volume arrondi vu d'en haut (houppier, rocher, touffe) : un contour irrégulier lissé en courbes,
 * rempli d'un dégradé radial qui part d'un reflet tourné vers le soleil et s'assombrit vers le bord opposé.
 */
const LDIR = [-0.72, -0.69];
function smoothLoop(pts) {
  const n = pts.length,
    o = [];
  for (let k = 0; k < n; k++) {
    const p = pts[(k + n - 1) % n],
      c = pts[k],
      q = pts[(k + 1) % n];
    const a = [(p[0] + c[0]) / 2, (p[1] + c[1]) / 2],
      b = [(c[0] + q[0]) / 2, (c[1] + q[1]) / 2];
    for (let t = 0; t < 1; t += 1 / 5) {
      const u = 1 - t;
      o.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
    }
  }
  return o;
}
function gem(x, y, rx, ry, base, rnd, opt = {}) {
  // dessiné en pixels, debout : il ne projette pas d'ombre calculée (les arbres et rochers ont leur ombre douce)
  if (A.SHADOW) return [];
  const n = opt.n || 8,
    v = opt.v ?? 0.22,
    amp = opt.amp ?? 0.3,
    o = [];
  const rot = rnd() * Math.PI * 2;
  for (let k = 0; k < n; k++) {
    const a = rot + (k / n) * Math.PI * 2 + (rnd() - 0.5) * 0.35,
      f = 1 - v / 2 + rnd() * v;
    o.push([x + Math.cos(a) * rx * f, y + Math.sin(a) * ry * f]);
  }
  const sp = smoothLoop(o),
    g = A.g;
  const hx = x + LDIR[0] * rx * 0.4,
    hy = y + LDIR[1] * ry * (0.45 + (opt.lift ?? 0.2) * 0.4),
    R = Math.max(rx, ry) * 1.45;
  const grd = g.createRadialGradient(hx, hy, 0, hx, hy, R);
  grd.addColorStop(0, sh(base, 1 + amp * 0.62));
  grd.addColorStop(0.5, base);
  grd.addColorStop(1, sh(base, 1 - amp * 0.95));
  g.beginPath();
  g.moveTo(sp[0][0], sp[0][1]);
  for (let k = 1; k < sp.length; k++) g.lineTo(sp[k][0], sp[k][1]);
  g.closePath();
  g.fillStyle = grd;
  g.fill();
  return sp;
}

export { OUT, P, LDIR, bbox, canPaint, gtri, rgbs, blit, blur, gem, ln, mix, pick3, sh, shadowSprite, sprite, spriteLevel, levelFor, strokes, tri };
