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
const SK = (window.devicePixelRatio || 1) > 1 ? 3 : 2;
const SPR = {};
const OUT = 'rgba(30,18,8,.55)';
function sprite(key, x0, y0, x1, y1, fn, halo) {
  const o = SPR[key];
  if (o) return o;
  const w = x1 - x0,
    h = y1 - y0;
  let c = document.createElement('canvas');
  c.width = Math.ceil(w * SK);
  c.height = Math.ceil(h * SK);
  const prev = A.g;
  A.g = c.getContext('2d');
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
function crayon(c, seed) {
  const W2 = c.width,
    H2 = c.height,
    sil = document.createElement('canvas');
  sil.width = W2;
  sil.height = H2;
  const s2 = sil.getContext('2d');
  s2.drawImage(c, 0, 0);
  s2.globalCompositeOperation = 'source-in';
  s2.fillStyle = '#221e18';
  s2.fillRect(0, 0, W2, H2);
  const grain = document.createElement('canvas');
  grain.width = W2;
  grain.height = H2;
  const gr = grain.getContext('2d');
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
  const out = document.createElement('canvas');
  out.width = W2;
  out.height = H2;
  const o = out.getContext('2d');
  o.drawImage(grain, 0, 0);
  o.drawImage(c, 0, 0);
  return out;
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

export { OUT, P, bbox, blit, blur, ln, pick3, sh, sprite, strokes };
