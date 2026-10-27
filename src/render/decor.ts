// @ts-nocheck — à typer (en cours).
import { nb4 } from '../core/hex';
import { INK } from '../data/palette';
import { A } from '../app/state';
import { pick3, sh, sprite } from './kit';
import { LD, softShadow } from './terrain';

function smoothPts(pts) {
  const n = pts.length,
    o = [];
  for (let k = 0; k < n; k++) {
    const p = pts[(k + n - 1) % n],
      c = pts[k],
      q = pts[(k + 1) % n];
    const a = [(p[0] + c[0]) / 2, (p[1] + c[1]) / 2],
      b = [(c[0] + q[0]) / 2, (c[1] + q[1]) / 2];
    for (let t = 0; t < 1; t += 1 / 6) {
      const u = 1 - t;
      o.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
    }
  }
  return o;
}
function pathPts(sp, closed) {
  A.g.beginPath();
  A.g.moveTo(sp[0][0], sp[0][1]);
  for (let k = 1; k < sp.length; k++) A.g.lineTo(sp[k][0], sp[k][1]);
  if (closed) A.g.closePath();
}
function roundPath(pts) {
  pathPts(smoothPts(pts), true);
}
function irregular(x, y, rx, ry, n, rnd, var_) {
  const o = [];
  const v = var_ ?? 0.22;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + (rnd() - 0.5) * 0.4,
      m = 1 - v / 2 + rnd() * v;
    o.push([x + Math.cos(a) * rx * m, y + Math.sin(a) * ry * m]);
  }
  return o;
}
/* trait hésitant : épaisseur qui varie, léger tremblé, quelques reprises */
function pencil(sp, closed, w, rnd, col, alpha) {
  const n = sp.length,
    m = closed ? n : n - 1;
  A.g.lineCap = 'round';
  for (let pass = 0; pass < 2; pass++) {
    A.g.strokeStyle = col || INK;
    A.g.globalAlpha = (alpha || 0.75) * (pass ? 0.45 : 1);
    let ph = rnd() * 6;
    for (let k = 0; k < m; k++) {
      if (pass && rnd() < 0.07) continue;
      const a = sp[k],
        b = sp[(k + 1) % n];
      ph += 0.55 + rnd() * 0.3;
      A.g.lineWidth = w * (0.55 + 0.6 * (0.5 + 0.5 * Math.sin(ph))) * (pass ? 0.7 : 1);
      const j = w * 0.35;
      A.g.beginPath();
      A.g.moveTo(a[0] + (rnd() - 0.5) * j, a[1] + (rnd() - 0.5) * j);
      A.g.lineTo(b[0] + (rnd() - 0.5) * j, b[1] + (rnd() - 0.5) * j);
      A.g.stroke();
    }
  }
  A.g.globalAlpha = 1;
}
function hatchIn(cx, cy, rx, ry, rnd, col, n, len) {
  A.g.strokeStyle = col;
  A.g.lineCap = 'round';
  for (let k = 0; k < n; k++) {
    const a = rnd() * Math.PI * 0.9 - 0.1,
      d = 0.35 + rnd() * 0.6,
      x = cx + Math.cos(a) * rx * d,
      y = cy + Math.sin(a) * ry * d;
    A.g.globalAlpha = 0.25 + rnd() * 0.25;
    A.g.lineWidth = 0.6 + rnd() * 0.5;
    A.g.beginPath();
    A.g.moveTo(x, y);
    A.g.quadraticCurveTo(x + len * 0.5, y + len * 0.15, x + len * 0.8, y + len * 0.55);
    A.g.stroke();
  }
  A.g.globalAlpha = 1;
}
function mass(x, y, rx, ry, base, rnd, opt) {
  opt = opt || {};
  const pts = irregular(x, y, rx, ry, opt.n || 8, rnd, opt.v),
    sp = smoothPts(pts);
  pathPts(sp, true);
  A.g.fillStyle = base;
  A.g.fill();
  A.g.save();
  pathPts(sp, true);
  A.g.clip();
  A.g.fillStyle = sh(base, 1.2);
  A.g.beginPath();
  A.g.ellipse(x - rx * 0.28, y - ry * 0.32, rx * 0.62, ry * 0.55, 0, 0, 7);
  A.g.fill();
  A.g.fillStyle = sh(base, 0.76);
  A.g.beginPath();
  A.g.ellipse(x + rx * 0.42, y + ry * 0.45, rx * 0.8, ry * 0.62, 0, 0, 7);
  A.g.fill();
  hatchIn(x + rx * 0.05, y + ry * 0.1, rx, ry, rnd, INK, opt.hatch ?? Math.round(rx * 0.5), Math.max(3, rx * 0.28));
  if (opt.ticks)
    for (let k = 0; k < opt.ticks; k++) {
      const px = x - rx * 0.6 + rnd() * rx * 0.9,
        py = y - ry * 0.7 + rnd() * ry * 0.8;
      A.g.strokeStyle = sh(base, 1.45);
      A.g.globalAlpha = 0.6;
      A.g.lineWidth = 0.8;
      A.g.beginPath();
      A.g.moveTo(px, py);
      A.g.lineTo(px + 1.6, py - 1.2);
      A.g.stroke();
    }
  A.g.globalAlpha = 1;
  A.g.restore();
  pencil(sp, true, opt.w || 1.1, rnd);
  return sp;
}
function trunk2(x, y, w, h, lean, col, rnd) {
  const pts = [
    [x - w, y],
    [x - w * 0.55 + lean * 0.35, y - h * 0.5],
    [x - w * 0.4 + lean, y - h],
    [x + w * 0.4 + lean, y - h],
    [x + w * 0.55 + lean * 0.35, y - h * 0.5],
    [x + w, y],
  ];
  A.g.fillStyle = col;
  A.g.beginPath();
  A.g.moveTo(pts[0][0], pts[0][1]);
  A.g.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
  A.g.lineTo(pts[3][0], pts[3][1]);
  A.g.quadraticCurveTo(pts[4][0], pts[4][1], pts[5][0], pts[5][1]);
  A.g.closePath();
  A.g.fill();
  A.g.fillStyle = sh(col, 0.7);
  A.g.beginPath();
  A.g.moveTo(x + w * 0.15, y);
  A.g.quadraticCurveTo(x + w * 0.2 + lean * 0.35, y - h * 0.5, x + w * 0.05 + lean, y - h);
  A.g.lineTo(pts[3][0], pts[3][1]);
  A.g.quadraticCurveTo(pts[4][0], pts[4][1], pts[5][0], pts[5][1]);
  A.g.closePath();
  A.g.fill();
  const L = [];
  for (let t = 0; t <= 1; t += 0.2) L.push([x - w + (w * 0.6 + lean) * t, y - h * t]);
  pencil(L, false, 0.9, rnd);
  const R2 = [];
  for (let t = 0; t <= 1; t += 0.2) R2.push([x + w + (-w * 0.6 + lean) * t, y - h * t]);
  pencil(R2, false, 0.9, rnd);
}
function contact(x, y, s) {
  A.g.fillStyle = 'rgba(22,26,20,.42)';
  A.g.beginPath();
  A.g.ellipse(x + 1.5 * s, y + 0.5 * s, 6 * s, 2 * s, 0, 0, 7);
  A.g.fill();
}
function tuft(x, y, s, col, rnd) {
  const sp = mass(x, y - 1.5 * s, 4 * s, 2.4 * s, col, rnd, { n: 6, hatch: 2, w: 0.8, v: 0.3 });
}
function oak3(x, y, s, rnd, tone) {
  const c = tone || '#3f5338';
  softShadow(x + 7 * s, y + 1, 14 * s, 5 * s);
  contact(x, y, s);
  trunk2(x, y, 2.4 * s, 13 * s, (rnd() - 0.5) * 2 * s, '#5e5040', rnd);
  mass(x + 5 * s, y - 18 * s, 10 * s, 7.5 * s, sh(c, 0.88), rnd, { ticks: 3 });
  mass(x - 4 * s, y - 20 * s, 9 * s, 7 * s, c, rnd, { ticks: 4 });
  mass(x + 2 * s, y - 26 * s, 9 * s, 7 * s, sh(c, 1.1), rnd, { ticks: 5 });
  for (let k = 0; k < 3; k++)
    tuft(x + (k - 1) * 4 * s + (rnd() - 0.5) * s, y + 1.2 * s, s * 0.8, pick3(rnd, ['#56704a', '#4c6340', '#6a8458']), rnd);
}
function pine3(x, y, s, rnd) {
  softShadow(x + 9 * s, y + 1, 12 * s, 4 * s);
  contact(x, y, s);
  const lean = (6 + rnd() * 5) * s;
  A.g.strokeStyle = '#5a4636';
  A.g.lineWidth = 2.8 * s;
  A.g.lineCap = 'round';
  A.g.beginPath();
  A.g.moveTo(x, y);
  A.g.quadraticCurveTo(x + lean * 0.2, y - 15 * s, x + lean, y - 30 * s);
  A.g.stroke();
  const L = [];
  for (let t = 0; t <= 1; t += 0.25) {
    const u = 1 - t;
    L.push([
      u * u * x + 2 * u * t * (x + lean * 0.2) + t * t * (x + lean) - 1.4 * s,
      u * u * y + 2 * u * t * (y - 15 * s) + t * t * (y - 30 * s),
    ]);
  }
  pencil(L, false, 0.8, rnd);
  mass(x + lean + 2 * s, y - 31 * s, 13 * s, 4.8 * s, '#2f4134', rnd, { n: 9, v: 0.3, hatch: 6, ticks: 3 });
  mass(x + lean + 5 * s, y - 36 * s, 8 * s, 3.6 * s, '#3a4f3e', rnd, { n: 8, v: 0.3, hatch: 3, ticks: 3 });
  for (let k = 0; k < 2; k++) tuft(x + (k - 0.5) * 5 * s, y + 1.2 * s, s * 0.8, pick3(rnd, ['#6a5a46', '#7d5f80', '#56704a']), rnd);
}
function boulder3(x, y, s, rnd, base) {
  const b = base || '#b49c95';
  softShadow(x + 5 * s, y + 1, 11 * s, 4 * s);
  contact(x, y, s * 1.4);
  mass(x, y - 6 * s, 10 * s, 7 * s, b, rnd, { n: 7, v: 0.25, hatch: Math.round(4 * s), w: 1.1 });
  for (let k = 0; k < 3; k++) {
    A.g.fillStyle = pick3(rnd, ['#d9cf8a', '#e6e2d4', '#c9c27a']);
    A.g.beginPath();
    A.g.ellipse(x - 6 * s + rnd() * 10 * s, y - 11 * s + rnd() * 6 * s, 1.3 * s, 0.8 * s, 0, 0, 7);
    A.g.fill();
  }
}
function slab3(x, y, s, rnd) {
  softShadow(x + 4 * s, y + 1, 12 * s, 4 * s);
  contact(x, y, s * 1.4);
  const w = 11 * s,
    d = 4 * s,
    h = (3 + rnd() * 4) * s,
    t = (rnd() - 0.3) * 5 * s;
  const side = [
      [x - w, y - h + t],
      [x - w * 0.1, y - h + d * 0.6],
      [x + w, y - h - d * 0.6 - t],
      [x + w, y - d * 0.3],
      [x - w * 0.1, y + d * 0.4],
      [x - w, y],
    ],
    top = [
      [x - w, y - h + t],
      [x + w * 0.2, y - h - d - t * 0.3],
      [x + w, y - h - d * 0.6 - t],
      [x - w * 0.1, y - h + d * 0.6],
    ];
  roundPath(side);
  A.g.fillStyle = '#8f7872';
  A.g.fill();
  hatchIn(x, y - h * 0.4, w, d, rnd, INK, 4, 4);
  pencil(smoothPts(side), true, 1, rnd);
  roundPath(top);
  A.g.fillStyle = '#c4aaa2';
  A.g.fill();
  pencil(smoothPts(top), true, 0.9, rnd);
}
function needle3(x, y, h, rnd) {
  softShadow(x + 6, y + 1, 10, 3.5);
  contact(x, y, 1.5);
  const pts = [
    [x - 7, y],
    [x - 5, y - h * 0.55],
    [x - 1, y - h],
    [x + 3, y - h * 0.95],
    [x + 7, y - h * 0.45],
    [x + 8, y],
  ];
  const sp = smoothPts(pts);
  pathPts(sp, true);
  A.g.fillStyle = '#b49c95';
  A.g.fill();
  A.g.save();
  pathPts(sp, true);
  A.g.clip();
  A.g.fillStyle = '#8f7872';
  A.g.beginPath();
  A.g.moveTo(x + 1, y - h);
  A.g.lineTo(x + 9, y - h * 0.4);
  A.g.lineTo(x + 9, y);
  A.g.lineTo(x + 1, y);
  A.g.fill();
  hatchIn(x + 4, y - h * 0.45, 5, h * 0.45, rnd, INK, 8, 5);
  A.g.restore();
  pencil(sp, true, 1.2, rnd);
}
/* le tapis : sous-bois, aiguilles, éboulis ou herbe, qui couvre l'essentiel de la case */
function carpet(rnd, cols, clumps) {
  const pts = irregular(0, 0, 27, 17, 14, rnd, 0.18),
    sp = smoothPts(pts);
  pathPts(sp, true);
  A.g.fillStyle = cols[0];
  A.g.fill();
  A.g.save();
  pathPts(sp, true);
  A.g.clip();
  for (let k = 0; k < clumps; k++) {
    A.g.fillStyle = pick3(rnd, cols.slice(1));
    const a = rnd() * 7,
      d = rnd() * 0.8;
    A.g.beginPath();
    A.g.ellipse(Math.cos(a) * 24 * d, Math.sin(a) * 14 * d, 3 + rnd() * 5, 2 + rnd() * 2.5, 0, 0, 7);
    A.g.fill();
  }
  hatchIn(4, 4, 26, 15, rnd, INK, 10, 4);
  A.g.restore();
  pencil(sp, true, 0.8, rnd, INK, 0.45);
}
function spotsIn(n, rx, ry, rnd) {
  const o = [];
  let tries = 0;
  while (o.length < n && tries < 200) {
    tries++;
    const a = rnd() * Math.PI * 2,
      d = Math.sqrt(rnd());
    const p = [Math.cos(a) * rx * d, Math.sin(a) * ry * d];
    if (o.every(q => Math.hypot((q[0] - p[0]) / 1.6, q[1] - p[1]) > 5.5)) o.push(p);
  }
  return o.sort((a, b) => a[1] - b[1]);
}
function treeCtx(i) {
  let nf = 0;
  for (const j of nb4(i)) if (A.S.ter[j] === 1) nf++;
  return ((LD[i] || 9) <= 3 ? 'p' : 'f') + (nf >= 5 ? 'd' : 'e');
}
function rockCtx(i) {
  let nr = 0,
    hi = true;
  for (const j of nb4(i)) {
    if (A.S.ter[j] === 3) nr++;
    if (A.S.hgt && A.S.hgt[j] > A.S.hgt[i]) hi = false;
  }
  return nr >= 5 ? (hi && i % 4 === 0 ? 'rc' : 'ra') : 'rb';
}
function treeSpr2(c, v) {
  return sprite('T3' + c + v, -64, -112, 64, 34, rnd => {
    const dense = c[1] === 'd',
      pine = c[0] === 'p';
    carpet(
      rnd,
      pine
        ? ['#4e4636', '#5e5040', '#46523a', '#6a5a46']
        : dense
          ? ['#2f3a2b', '#3a4634', '#2b3527', '#45533d']
          : ['#3e4c38', '#4a5a42', '#7d5f80', '#d4b23c'],
      dense ? 14 : 10,
    );
    const pts = [],
      rows = dense ? [-12, -6, 0, 6, 12] : [-10, -3, 4, 11];
    for (const y of rows) {
      const half = Math.sqrt(Math.max(0, 1 - (y / 16) ** 2)) * 24,
        n = Math.max(1, Math.round(half / (dense ? 7 : 8.5)));
      for (let k = 0; k <= n; k++) {
        if (!dense && rnd() < 0.22) continue;
        const x = -half + 2 * half * (n ? k / n : 0.5) + (rnd() - 0.5) * 4;
        pts.push([x, y + (rnd() - 0.5) * 2.5]);
      }
    }
    if (!dense) for (const p of spotsIn(3, 22, 13, rnd)) p.push('s'), pts.push(p);
    pts.sort((a, b) => a[1] - b[1]);
    for (const p of pts) {
      if (p[2] === 's') {
        tuft(p[0], p[1], 1.2, pick3(rnd, ['#8e6c8f', '#d4b23c', '#5d7a4a']), rnd);
        continue;
      }
      const s = (dense ? 1.05 : 0.9) + rnd() * 0.3;
      if (pine && rnd() < 0.85) pine3(p[0], p[1], s, rnd);
      else oak3(p[0], p[1], s, rnd, pick3(rnd, ['#3c4f37', '#435a3b', '#4b5f3a', '#506640', '#3a4a33']));
    }
  });
}
function rockSpr2(c, v) {
  return sprite('R2' + c + v, -56, -86, 56, 30, rnd => {
    if (c === 'ra') {
      carpet(rnd, ['#8d817c', '#9a8e88', '#7d736e', '#6a8458'], 12);
      for (const p of spotsIn(4 + (v % 2), 19, 10, rnd)) boulder3(p[0], p[1], 0.9 + rnd() * 0.5, rnd);
      if (v === 0) boulder3(-3, -8, 0.8, rnd, '#c2aaa2');
    } else if (c === 'rb') {
      carpet(rnd, ['#6f8a5c', '#7b9467', '#8d817c', '#5f7350'], 8);
      for (const p of spotsIn(2 + (v % 2), 18, 9, rnd)) slab3(p[0], p[1], 0.9 + rnd() * 0.3, rnd);
    } else {
      carpet(rnd, ['#8d817c', '#9a8e88', '#a8908a'], 14);
      needle3(0, 2, 56 + rnd() * 16, rnd);
      for (const p of spotsIn(3, 20, 11, rnd)) if (Math.abs(p[0]) > 8) boulder3(p[0], p[1], 0.5, rnd);
    }
  });
}
function loneOak(v) {
  return sprite('LO2' + v, -54, -86, 54, 26, rnd => {
    const pts = irregular(2, 2, 15, 8, 10, rnd, 0.2),
      sp = smoothPts(pts);
    pathPts(sp, true);
    A.g.fillStyle = '#6a8458';
    A.g.fill();
    pencil(sp, true, 0.7, rnd, INK, 0.35);
    oak3(0, 4, 1.35 + rnd() * 0.2, rnd, '#3e5238');
  });
}
function decoSpr(t) {
  return sprite('D2' + t, -70, -150, 70, 34, rnd => {
    carpet(rnd, t === 2 ? ['#7f7a66', '#8e6c8f', '#7d5f80', '#d4b23c'] : ['#6a8458', '#7b9467', '#5d7a4a', '#8e6c8f'], 12);
    if (t === 1) {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        boulder3(Math.cos(a) * 24, Math.sin(a) * 12 + 2, 0.36, rnd);
      }
      const h = 96,
        pts = [
          [-11, 4],
          [-12, -h * 0.5],
          [-7, -h * 0.92],
          [2, -h],
          [9, -h * 0.82],
          [12, -h * 0.4],
          [11, 4],
        ],
        sp = smoothPts(pts);
      softShadow(14, 4, 18, 6);
      contact(0, 3, 2.5);
      pathPts(sp, true);
      A.g.fillStyle = '#b49c95';
      A.g.fill();
      A.g.save();
      pathPts(sp, true);
      A.g.clip();
      A.g.fillStyle = '#8f7872';
      A.g.beginPath();
      A.g.moveTo(2, -h);
      A.g.lineTo(14, -h * 0.5);
      A.g.lineTo(14, 6);
      A.g.lineTo(3, 6);
      A.g.fill();
      A.g.fillStyle = '#c9b1a9';
      A.g.beginPath();
      A.g.moveTo(-13, -h * 0.55);
      A.g.lineTo(-7, -h * 0.93);
      A.g.lineTo(2, -h);
      A.g.lineTo(-3, -h * 0.6);
      A.g.fill();
      hatchIn(7, -h * 0.45, 7, h * 0.45, rnd, INK, 18, 6);
      for (let k = 0; k < 7; k++) {
        A.g.fillStyle = pick3(rnd, ['#d9cf8a', '#e6e2d4']);
        A.g.beginPath();
        A.g.ellipse(-8 + rnd() * 16, -h * 0.15 - rnd() * h * 0.7, 1.8, 1.1, 0, 0, 7);
        A.g.fill();
      }
      A.g.restore();
      pencil(sp, true, 1.4, rnd);
      for (let k = 0; k < 4; k++) tuft(-10 + k * 7, 5, 1, pick3(rnd, ['#56704a', '#6a8458']), rnd);
    } else if (t === 2) {
      softShadow(10, 6, 40, 12);
      for (const [x, y, h] of [
        [-22, -4, 22],
        [18, -6, 24],
      ]) {
        const pts = [
          [x - 5, y],
          [x - 5, y - h],
          [x + 5, y - h - 2],
          [x + 5, y],
        ];
        const sp = smoothPts(pts);
        pathPts(sp, true);
        A.g.fillStyle = '#9a837d';
        A.g.fill();
        pencil(sp, true, 1, rnd);
      }
      A.g.fillStyle = '#1c1612';
      A.g.beginPath();
      A.g.ellipse(0, 0, 16, 6, 0, 0, 7);
      A.g.fill();
      for (const [x, y, h] of [
        [-14, 8, 20],
        [16, 8, 21],
      ]) {
        const pts = [
          [x - 5, y],
          [x - 5, y - h],
          [x + 5, y - h - 2],
          [x + 5, y],
        ];
        const sp = smoothPts(pts);
        pathPts(sp, true);
        A.g.fillStyle = '#a8908a';
        A.g.fill();
        hatchIn(x + 2, y - h * 0.5, 4, h * 0.4, rnd, INK, 5, 4);
        pencil(sp, true, 1, rnd);
      }
      const top = [
          [-34, -24],
          [-6, -34],
          [32, -30],
          [30, -20],
          [-2, -12],
          [-32, -16],
        ],
        sp = smoothPts(top);
      pathPts(sp, true);
      A.g.fillStyle = '#a8908a';
      A.g.fill();
      A.g.save();
      pathPts(sp, true);
      A.g.clip();
      A.g.fillStyle = '#c4aaa2';
      A.g.beginPath();
      A.g.moveTo(-34, -24);
      A.g.lineTo(-6, -34);
      A.g.lineTo(32, -30);
      A.g.lineTo(0, -24);
      A.g.fill();
      A.g.fillStyle = '#866e6a';
      A.g.beginPath();
      A.g.moveTo(-32, -16);
      A.g.lineTo(-2, -12);
      A.g.lineTo(30, -20);
      A.g.lineTo(32, -14);
      A.g.lineTo(-2, -6);
      A.g.lineTo(-34, -10);
      A.g.fill();
      hatchIn(0, -14, 30, 6, rnd, INK, 10, 5);
      for (let k = 0; k < 6; k++) {
        A.g.fillStyle = '#d9cf8a';
        A.g.beginPath();
        A.g.ellipse(-20 + rnd() * 40, -28 + rnd() * 8, 1.6, 1, 0, 0, 7);
        A.g.fill();
      }
      A.g.restore();
      pencil(sp, true, 1.3, rnd);
      for (let k = 0; k < 5; k++) tuft(-24 + k * 12, 12 + (k % 2) * 2, 1, pick3(rnd, ['#8e6c8f', '#d4b23c', '#6a8458']), rnd);
    } else {
      softShadow(18, 6, 46, 14);
      contact(0, 4, 4);
      for (const [a, l] of [
        [-2.6, 18],
        [-0.6, 16],
        [-1.7, 14],
        [0.4, 14],
      ]) {
        A.g.strokeStyle = '#5e5040';
        A.g.lineWidth = 5;
        A.g.lineCap = 'round';
        A.g.beginPath();
        A.g.moveTo(0, 0);
        A.g.lineTo(Math.cos(a) * l, 4 + Math.sin(a) * 4);
        A.g.stroke();
        pencil(
          [
            [0, -2],
            [Math.cos(a) * l, 2 + Math.sin(a) * 4],
          ],
          false,
          0.8,
          rnd,
        );
      }
      trunk2(0, 4, 9, 40, 3, '#6a5a48', rnd);
      const c = '#3a4e34';
      mass(10, -50, 30, 18, sh(c, 0.9), rnd, { n: 10, ticks: 8 });
      mass(-16, -58, 22, 15, c, rnd, { n: 9, ticks: 8 });
      mass(22, -64, 20, 13, sh(c, 1.08), rnd, { n: 9, ticks: 8 });
      mass(0, -74, 22, 13, sh(c, 1.18), rnd, { n: 9, ticks: 10 });
      for (let k = 0; k < 10; k++) {
        A.g.fillStyle = 'rgba(220,230,170,.6)';
        A.g.beginPath();
        A.g.arc(-20 + rnd() * 40, -80 + rnd() * 30, 1.4, 0, 7);
        A.g.fill();
      }
      for (let k = 0; k < 5; k++) tuft(-16 + k * 8, 7 + (k % 2) * 2, 1.1, pick3(rnd, ['#56704a', '#6a8458', '#7d5f80']), rnd);
    }
  });
}

export { boulder3, decoSpr, irregular, loneOak, mass, oak3, pathPts, pencil, rockCtx, rockSpr2, smoothPts, treeCtx, treeSpr2 };
