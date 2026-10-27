// @ts-nocheck — affichage et interface extraits de la version mono-fichier ; à typer progressivement.
import { nb4 } from '../core/hex';
import { INK, OUTLINE, VEG } from '../data/palette';
import { A } from '../app/state';
import { P, gem, pick3, sh, sprite, tri } from './kit';
import { softShadow } from './terrain';

/* ---------- outils de tracé conservés pour l'ancien style illustré ---------- */
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
/* trait hésitant au crayon : seulement dans l'ancien style (OUTLINE) */
function pencil(sp, closed, w, rnd, col, alpha) {
  if (!OUTLINE) return;
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
/* un volume arrondi : désormais un bloc à facettes (voir gem dans kit.ts) */
function mass(x, y, rx, ry, base, rnd, opt) {
  opt = opt || {};
  return gem(x, y, rx, ry, base, rnd, { n: opt.n || 8, v: opt.v, lift: 0.2 });
}

/* ---------- prismes verticaux : pierres levées, tronc, montants ---------- */
/* silhouette en colonnes : bas (gauche → droite) et haut (gauche → droite) ; chaque bande verticale est une facette */
/* volume vertical (pierre levée, tronc) : un seul contour, éclairé à gauche et fondu vers l'ombre à droite */
function column(bot, top, base, rnd, amp) {
  const pts = [...bot, ...top.slice().reverse()],
    g = A.g;
  let x0 = 1e9,
    x1 = -1e9;
  for (const p of pts) {
    x0 = Math.min(x0, p[0]);
    x1 = Math.max(x1, p[0]);
  }
  const grd = g.createLinearGradient(x0, 0, x1, 0);
  grd.addColorStop(0, sh(base, 1.16));
  grd.addColorStop(0.45, sh(base, 1));
  grd.addColorStop(1, sh(base, 0.74));
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k < pts.length; k++) {
    const p = pts[k - 1],
      q = pts[k];
    g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  g.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
  g.closePath();
  g.fillStyle = grd;
  g.fill();
}
function trunk(x, y, w, h, lean, col, rnd) {
  column(
    [[x - w, y], [x - w * 0.1, y + w * 0.3], [x + w, y]],
    [[x - w * 0.55 + lean, y - h], [x + lean * 1.05, y - h + w * 0.2], [x + w * 0.55 + lean, y - h]],
    col,
    rnd,
  );
}
function contact(x, y, s) {
  A.g.fillStyle = 'rgba(24,46,40,.3)';
  A.g.beginPath();
  A.g.ellipse(x + 1.5 * s, y + 0.5 * s, 5 * s, 1.7 * s, 0, 0, 7);
  A.g.fill();
}

/* ---------- arbres ---------- */
function oak3(x, y, s, rnd, tone) {
  if (A.SHADOW) return;
  const c = tone || pick3(rnd, VEG.oak);
  softShadow(x + 7 * s, y + 1, 11 * s, 3.8 * s);
  contact(x, y, s);
  trunk(x, y, 1.7 * s, 10 * s, (rnd() - 0.5) * 1.5 * s, VEG.trunk, rnd);
  const lean = (rnd() - 0.5) * 2 * s;
  gem(x + 3.6 * s + lean, y - 13 * s, 7 * s, 5.4 * s, sh(c, 0.9), rnd, { n: 7, lift: 0.25 });
  gem(x - 3.4 * s + lean, y - 14.5 * s, 6.6 * s, 5.2 * s, c, rnd, { n: 7, lift: 0.25 });
  gem(x + 0.6 * s + lean, y - 19.5 * s, 6.4 * s, 5 * s, sh(c, 1.08), rnd, { n: 7, lift: 0.3 });
}
function pine3(x, y, s, rnd) {
  if (A.SHADOW) return;
  softShadow(x + 7 * s, y + 1, 9 * s, 3.2 * s);
  contact(x, y, s * 0.8);
  trunk(x, y, 1.3 * s, 9 * s, 0, VEG.trunk, rnd);
  const c = pick3(rnd, VEG.pine);
  for (let k = 0; k < 3; k++) {
    const yy = y - (9 + k * 6) * s,
      r = (6 - k * 1.6) * s;
    gem(x, yy, r, r * 0.62, sh(c, 0.94 + k * 0.08), rnd, { n: 6, lift: 0.7 });
  }
}
function tuft(x, y, s, col, rnd) {
  gem(x, y - 1.5 * s, 3.4 * s, 2.2 * s, col, rnd, { n: 6, lift: 0.8 });
}

/* ---------- rochers ---------- */
function boulder3(x, y, s, rnd, base) {
  if (A.SHADOW) return;
  const b = base || pick3(rnd, VEG.rock);
  softShadow(x + 4 * s, y + 1, 9 * s, 3.2 * s);
  contact(x, y, s * 1.2);
  // une base sombre, un dessus éclairé : le bloc paraît posé et non collé au sol
  gem(x + 0.6 * s, y - 2.6 * s, 9 * s, 5.6 * s, sh(b, 0.82), rnd, { n: 7, v: 0.3, lift: 0.1, amp: 0.2 });
  gem(x - 0.4 * s, y - 5.6 * s, 7.8 * s, 5.2 * s, b, rnd, { n: 7, v: 0.3, lift: 0.4, amp: 0.34 });
}
function slab3(x, y, s, rnd) {
  if (A.SHADOW) return;
  softShadow(x + 4 * s, y + 1, 11 * s, 3.6 * s);
  const w = 10 * s,
    d = 3.6 * s,
    h = (2.5 + rnd() * 3) * s,
    t = (rnd() - 0.3) * 4 * s,
    b = pick3(rnd, VEG.rock);
  const fl = [x - w, y - h + t],
    fm = [x - w * 0.1, y - h + d * 0.6],
    fr = [x + w, y - h - d * 0.6 - t],
    bl = [x - w, y],
    bm = [x - w * 0.1, y + d * 0.4],
    br = [x + w, y - d * 0.3],
    back = [x + w * 0.2, y - h - d - t * 0.3];
  P([bl, bm, fm, fl], sh(b, 0.92), sh(b, 0.92), 0.5);
  P([bm, br, fr, fm], sh(b, 0.72), sh(b, 0.72), 0.5);
  tri(fl, back, fm, sh(b, 1.16));
  tri(fm, back, fr, sh(b, 1.04));
}
function needle3(x, y, h, rnd) {
  if (A.SHADOW) return;
  softShadow(x + 6, y + 1, 9, 3);
  contact(x, y, 1.3);
  const w = 6,
    b = VEG.rock[1];
  column(
    [[x - w, y], [x - 1, y + 2], [x + w, y]],
    [[x - 2.5, y - h * 0.9], [x - 0.5, y - h], [x + 2.5, y - h * 0.86]],
    b,
    rnd,
    0.08,
  );
  // une cassure à mi-hauteur
  tri([x - w * 0.8, y - h * 0.45], [x - 1, y - h * 0.5], [x - 2.2, y - h * 0.62], sh(b, 1.22));
}

/* ---------- forêts, rochers, chênes isolés : plusieurs variantes par contexte ---------- */
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
  return ((A.LD[i] || 9) <= 3 ? 'p' : 'f') + (nf >= 5 ? 'd' : 'e');
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
  return sprite('T4' + c + v, -48, -64, 48, 26, rnd => {
    const dense = c[1] === 'd',
      coast = c[0] === 'p';
    const pts = [],
      rows = dense ? [-13, -7, -1, 5, 11] : [-11, -4, 3, 10];
    for (const y of rows) {
      const half = Math.sqrt(Math.max(0, 1 - (y / 16) ** 2)) * 24,
        n = Math.max(1, Math.round(half / (dense ? 7 : 8.5)));
      for (let k = 0; k <= n; k++) {
        // quelques trouées, plus nombreuses en lisière
        if (rnd() < (dense ? 0.12 : 0.28)) continue;
        const x = -half + 2 * half * (n ? k / n : 0.5) + (rnd() - 0.5) * 5;
        pts.push([x, y + (rnd() - 0.5) * 3]);
      }
    }
    if (!dense) for (const p of spotsIn(2, 20, 11, rnd)) (p.push('s'), pts.push(p));
    pts.sort((a, b) => a[1] - b[1]);
    for (const p of pts) {
      if (p[2] === 's') {
        tuft(p[0], p[1], 0.9, pick3(rnd, [...VEG.gorse, ...VEG.grass]), rnd);
        continue;
      }
      const s = (dense ? 0.74 : 0.66) + rnd() * 0.3;
      if (coast && rnd() < 0.35) pine3(p[0], p[1], s, rnd);
      else oak3(p[0], p[1], s, rnd);
    }
  });
}
function rockSpr2(c, v) {
  return sprite('R3' + c + v, -48, -60, 48, 24, rnd => {
    if (c === 'ra') {
      for (const p of spotsIn(4 + (v % 3), 19, 10, rnd)) boulder3(p[0], p[1], 0.55 + rnd() * 0.32, rnd);
    } else if (c === 'rb') {
      for (const p of spotsIn(2 + (v % 2), 18, 9, rnd)) slab3(p[0], p[1], 0.6 + rnd() * 0.22, rnd);
    } else {
      for (const p of spotsIn(3, 20, 11, rnd)) if (p[1] < -2) boulder3(p[0], p[1], 0.42, rnd);
      needle3(0, 2, 26 + rnd() * 8, rnd);
      for (const p of spotsIn(3, 20, 11, rnd)) if (p[1] >= -2 && Math.abs(p[0]) > 8) boulder3(p[0], p[1], 0.42, rnd);
    }
  });
}
function loneOak(v) {
  return sprite('LO3' + v, -40, -48, 40, 18, rnd => {
    oak3(0, 4, 1 + rnd() * 0.18, rnd);
  });
}

/*
 * Sites des anciens : le grand menhir, le dolmen et le chêne des anciens. On ne peut rien y bâtir ;
 * ils gardent une taille hors d'échelle pour se voir de loin, et un petit cadre (cercle de pierres,
 * bruyère, fleurs) qui les détache du terrain alentour.
 */
function decoSpr(t) {
  return sprite('D3' + t, -76, -150, 76, 38, rnd => {
    if (t === 1) menhirGrand(rnd);
    else if (t === 2) dolmen(rnd);
    else greatOak(rnd);
  });
}
function menhirGrand(rnd) {
  // cercle de petites pierres, celles du fond d'abord
  const ring = [];
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2 + 0.2;
    ring.push([Math.cos(a) * 30, Math.sin(a) * 15 + 2]);
  }
  ring.sort((a, b) => a[1] - b[1]);
  for (const [x, y] of ring.filter(p => p[1] < 2)) boulder3(x, y, 0.42, rnd);
  softShadow(18, 4, 22, 6);
  contact(0, 3, 2.4);
  const h = 98,
    b = '#b49c95';
  column(
    [[-12, 4], [-4, 7], [5, 7], [12, 4]],
    [[-7, -h * 0.9], [-2, -h], [4, -h * 0.97], [8, -h * 0.82]],
    b,
    rnd,
    0.06,
  );
  // facettes de taille : quelques éclats plus clairs à gauche, plus sombres à droite
  tri([-12, -h * 0.3], [-4, -h * 0.42], [-9, -h * 0.62], sh(b, 1.24));
  tri([5, -h * 0.25], [12, -h * 0.4], [8, -h * 0.6], sh(b, 0.72));
  tri([-7, -h * 0.9], [-2, -h], [-3.5, -h * 0.82], sh(b, 1.3));
  // lichens dorés
  for (let k = 0; k < 7; k++) {
    const x = -8 + rnd() * 14,
      y = -h * 0.12 - rnd() * h * 0.7;
    P([[x - 1.6, y], [x, y - 1.2], [x + 1.6, y], [x, y + 1]], pick3(rnd, ['#e3cf6a', '#d8c35a', '#ece3b4']));
  }
  for (const [x, y] of ring.filter(p => p[1] >= 2)) boulder3(x, y, 0.42, rnd);
}
function dolmen(rnd) {
  // bruyère et ajoncs autour de la chambre
  for (const p of spotsIn(6, 40, 16, rnd).filter(p => p[1] < -4)) tuft(p[0], p[1], 1.1, pick3(rnd, [...VEG.heather, ...VEG.gorse]), rnd);
  softShadow(14, 6, 42, 12);
  const stone = '#ad968f';
  const upright = (x, y, h, w) =>
    column([[x - w, y], [x, y + 2], [x + w, y]], [[x - w * 0.9, y - h], [x, y - h - 1.5], [x + w * 0.9, y - h - 0.5]], stone, rnd, 0.06);
  upright(-22, -4, 23, 5);
  upright(18, -6, 25, 5);
  // l'entrée sombre
  P([[-14, 4], [-10, -14], [12, -16], [15, 4]], '#2a2622');
  upright(-14, 8, 21, 5.5);
  upright(16, 8, 22, 5.5);
  // la table : dessus éclairé, tranche avant, côté dans l'ombre
  const tl = [-36, -24],
    tb = [-6, -36],
    tr = [34, -31],
    fr = [31, -20],
    fm = [-2, -12],
    fl = [-33, -16];
  tri(tl, tb, fm, sh(stone, 1.2));
  tri(tb, tr, fm, sh(stone, 1.1));
  tri(tr, fr, fm, sh(stone, 0.98));
  tri(tl, fm, fl, sh(stone, 1.04));
  P([fl, fm, [-2, -6], [-34, -10]], sh(stone, 0.86), sh(stone, 0.86), 0.5);
  P([fm, fr, [32, -14], [-2, -6]], sh(stone, 0.68), sh(stone, 0.68), 0.5);
  for (let k = 0; k < 5; k++) {
    const x = -22 + rnd() * 40,
      y = -30 + rnd() * 8;
    P([[x - 1.6, y], [x, y - 1], [x + 1.6, y], [x, y + 0.9]], '#e3cf6a');
  }
  for (const p of spotsIn(6, 40, 16, rnd).filter(p => p[1] > 8)) tuft(p[0], p[1], 1.1, pick3(rnd, [...VEG.heather, ...VEG.gorse]), rnd);
}
function greatOak(rnd) {
  softShadow(26, 6, 52, 15);
  contact(0, 4, 4);
  // racines
  for (const [a, l] of [
    [-2.7, 18],
    [-0.5, 17],
    [-1.8, 14],
    [0.5, 15],
  ])
    P([[0, -3], [Math.cos(a) * l, 3 + Math.sin(a) * 3], [Math.cos(a) * l * 0.6, 6]], sh(VEG.trunk, 0.85));
  trunk(0, 5, 9, 40, 3, VEG.trunk, rnd);
  // le houppier : de larges blocs, de l'arrière vers l'avant
  const greens = ['#3a4a33', '#3c4f37', '#435a3b', '#4b5f3a'];
  for (const [x, y, rx, ry, k] of [
    [-24, -54, 20, 14, 0],
    [24, -58, 21, 14, 0],
    [0, -78, 24, 15, 2],
    [-16, -68, 20, 13, 1],
    [18, -72, 20, 13, 2],
    [-4, -54, 26, 15, 1],
    [8, -86, 16, 10, 3],
  ])
    gem(x, y, rx, ry, greens[k], rnd, { n: 9, lift: 0.3 });
  // le gui, en boules vert pâle
  for (let k = 0; k < 4; k++) gem(-18 + rnd() * 36, -86 + rnd() * 34, 3, 2.4, '#b9c98a', rnd, { n: 6, lift: 0.4 });
  // fleurs au pied
  for (const p of spotsIn(6, 30, 10, rnd).filter(p => p[1] > 2)) tuft(p[0], p[1] + 4, 0.8, pick3(rnd, [...VEG.flower, ...VEG.grass]), rnd);
}

export { boulder3, decoSpr, irregular, loneOak, mass, oak3, pathPts, pencil, rockCtx, rockSpr2, smoothPts, treeCtx, treeSpr2 };
