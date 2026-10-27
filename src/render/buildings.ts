/**
 * Dessins des bâtiments : maisons selon leur niveau, champ selon la saison, temples, monuments selon
 * l'avancement du chantier, ateliers et bâtiments publics, puis les animations posées par-dessus
 * (cochons, fumées, forge, feu du barde, remplissage des réserves, navire au quai, barre de vie).
 */
import { HR, HX, HY, corner, idx } from '../core/hex';
import type { Building, House } from '../core/state';
import { used } from '../sim/stock';
import { B } from '../data/buildings';
import { AC, INK } from '../data/palette';
import { A } from '../app/state';
import { DP2, TILT, W, ZH, ZW, bc } from './projection';
import { P, blur, ln, pick3, sh, sprite } from './kit';
import { figure, shipFig, smoke } from './units';
import { progress as monProg } from '../sim/monuments';
import { boulder3, irregular, mass, oak3, pathPts, pencil, smoothPts } from './decor';
import {
  FOOT,
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
  fence3,
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
} from './buildkit';
import type { Pt, Rand, Sprite } from './types';

/** Sprite d'un bâtiment d'emprise s, dessiné dans le repère du plan centré sur le bâtiment. */
function bArt2(key: string, s: number, fn: (rnd: Rand) => void): Sprite {
  return sprite('B2' + key, -(s * 44 + 60), -175, s * 44 + 60, s * 34 + 40, rnd => {
    const p = A.LOC;
    A.LOC = null;
    try {
      fn(rnd);
    } finally {
      A.LOC = p;
    }
  });
}
/** Sprite d'un bâtiment dans son état actuel (niveau de la maison, saison du champ, avancement du chantier). */
function bSprite(b: Building): Sprite {
  const t = b.type,
    v = b.id % 3,
    s = b.s;
  if (t === 'hut') {
    const h = b as House;
    if (h.pop <= 0 && h.inc <= 0)
      return bArt2('plot', 1, rnd => {
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
      });
    return bArt2('h' + h.lvl + '_' + v, 1, rnd => houseArt(h.lvl, v, rnd));
  }
  if (t === 'farm') {
    const st = Math.min(3, Math.floor(((b.prog ?? 0) / B.farm.time!) * 4));
    return bArt2('farm' + st, 2, rnd => farmArt2(st, rnd));
  }
  if (t.startsWith('t_')) return bArt2(t, 3, rnd => templeArt2(B[t].god!, rnd));
  if (B[t].mon) {
    const st = b.done ? 2 : monProg(b) >= 0.5 ? 1 : 0;
    return bArt2(t + st, 3, rnd => monArt2(t, st, rnd));
  }
  return bArt2(t, s, rnd => (ART2[t] || ART2.store)(rnd));
}
/** Maison de niveau L (1 hutte ronde à 4 demeure noble), variante v. */
function houseArt(L: number, v: number, rnd: Rand): void {
  if (L === 1) {
    ground(1, '#c9b08a', rnd, 0.62);
    if (v === 0) logs3(0.26, 0.1, 3, rnd);
    cyl(0, 0, 0.22, 0, 8, AC.granit, rnd);
    cylDoor(0, 0, 0.22, 0, 6.5, rnd);
    cone(0, 0, 0.3, 8, 19, AC.chaume, rnd);
    if (v === 1) barrel3(0.27, 0.16, rnd);
    return;
  }
  if (L === 2) {
    ground(1, '#cdb690', rnd, 0.72);
    if (v === 1) logs3(0.3, -0.05, 4, rnd);
    cyl(0, 0, 0.27, 0, 4, AC.granit, rnd);
    cyl(0, 0, 0.27, 4, 11, AC.chaux, rnd);
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
    box(-0.34, -0.15, 0.34, 0.15, 0, 3, AC.granit, rnd);
    box(-0.34, -0.15, 0.34, 0.15, 3, 10, AC.chaux, rnd);
    door2(-0.05, 0.15, 0, 0.11, 8, rnd);
    win2(0.18, 0.15, 4.5, rnd);
    gable2(-0.34, -0.15, 0.34, 0.15, 10, 13, AC.chaume, rnd, AC.chaux);
    if (v === 0) barrel3(0.36, 0.22, rnd);
    if (v === 1) logs3(-0.32, 0.24, 3, rnd);
    return;
  }
  ground(1, '#d6c3a2', rnd, 0.86);
  cyl(0.27, -0.13, 0.11, 0, 16, AC.granit, rnd);
  cone(0.27, -0.13, 0.15, 16, 12, AC.ardoise, rnd, 'slate');
  box(-0.37, -0.14, 0.3, 0.17, 0, 3, AC.granit, rnd);
  box(-0.37, -0.14, 0.3, 0.17, 3, 12, AC.chaux, rnd);
  door2(-0.04, 0.17, 0, 0.12, 9, rnd, AC.ocre);
  win2(-0.24, 0.17, 5, rnd);
  win2(0.17, 0.17, 5, rnd);
  for (const [x, c] of [
    [-0.15, AC.guede],
    [0.07, AC.ocre],
  ] as const)
    shield3(x, 0.17, 8, c, rnd);
  gable2(-0.37, -0.14, 0.3, 0.17, 12, 15, AC.chaume, rnd, AC.chaux);
  banner(-0.36, 0.22, 0, 30, AC.guede, rnd);
}
/** Champ de blé et sa grange ; st de 0 (labour) à 3 (moisson). */
function farmArt2(st: number, rnd: Rand): void {
  const col = ['#a07a52', '#93905a', '#7fa05a', '#e3bd55'][st];
  for (const [ox, oy] of FOOT[2]) {
    const sp: Pt[] = [];
    for (let k = 0; k < 6; k++) {
      const [x, y] = corner(ox, oy, k, HR * 0.92);
      sp.push(W(x, y, 0.4));
    }
    const rp = roundPts(sp, 4);
    pathPts(rp, true);
    A.g.fillStyle = col;
    A.g.fill();
    A.g.save();
    pathPts(rp, true);
    A.g.clip();
    for (let k = -6; k <= 6; k++) {
      const a = W(ox - 0.5, oy + k * 0.08),
        b = W(ox + 0.5, oy + k * 0.08);
      A.g.strokeStyle = sh(col, 0.72);
      A.g.lineWidth = 1.1;
      A.g.beginPath();
      A.g.moveTo(a[0], a[1]);
      A.g.lineTo(b[0], b[1]);
      A.g.stroke();
      if (st > 0)
        for (let t = 0; t < 1; t += 0.06) {
          const x = a[0] + (b[0] - a[0]) * t,
            y = a[1] + (b[1] - a[1]) * t,
            h = [0, 2, 4.5, 7][st];
          A.g.strokeStyle = st === 3 ? (rnd() < 0.5 ? '#f2d27a' : '#c99a3a') : rnd() < 0.5 ? '#5f9a4a' : '#8dbb5e';
          A.g.lineWidth = 0.9;
          A.g.beginPath();
          A.g.moveTo(x, y);
          A.g.lineTo(x + (rnd() - 0.5) * 1.4, y - h * (0.7 + rnd() * 0.5));
          A.g.stroke();
        }
    }
    A.g.restore();
    pencil(rp, true, 0.7, rnd, INK, 0.5);
  }
  ground(1, '#bfa580', rnd, 0.22);
  cyl(-0.02, -0.04, 0.09, 0, 5, AC.granit, rnd);
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
function templeArt2(god: string, rnd: Rand): void {
  const GC = ({ taranis: '#6f8fc4', belenos: '#ecc63f', epona: '#c4643e' } as Record<string, string>)[god];
  ground(3, AC.pave, rnd, 0.92);
  box(-0.62, -0.62, 0.62, 0.62, 0, 9, AC.chaux, rnd);
  for (let k = -2; k <= 2; k++) {
    const x = k * 0.24;
    face(onFront(0, 0, 0.62, x, 0.08, 0, 7), '#3a3530', rnd, null, 0.5);
  }
  hip2(-0.7, -0.7, 0.7, 0.7, 9, 8, AC.ardoise, rnd, 0.38, 'slate');
  box(-0.3, -0.3, 0.3, 0.3, 17, 36, AC.chaux, rnd);
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
  box(-0.16, 0.82, 0.16, 0.98, 0, 4, AC.granit, rnd, null, AC.granit);
  for (const [x, y] of [
    [-0.9, 0.3],
    [0.9, 0.3],
    [-0.85, -0.4],
  ])
    oak3(...W(x, y), 0.8, rnd, '#4a6a42');
}
/** Monument t : st 0 chantier, 1 à mi-chemin, 2 achevé. */
function monArt2(t: string, st: number, rnd: Rand): void {
  if (t === 'menhirs') {
    ground(3, st < 2 ? '#b8a07a' : '#7fa465', rnd, 0.94);
    const sp: [number, number, number, number][] = [];
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
      box(-0.2, -0.1, -0.12, 0.25, 0, 14, AC.granit, rnd);
      box(0.12, -0.1, 0.2, 0.25, 0, 14, AC.granit, rnd);
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
    box(-0.18, -0.4, 0.18, -0.25, 0, 7, AC.granit, rnd, null, AC.granit);
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
/** Dessins des autres bâtiments, par type. */
const ART2: Record<string, (rnd: Rand) => void> = {
  well(rnd) {
    ground(1, AC.pave, rnd, 0.55);
    cyl(0, 0, 0.15, 0, 6, AC.granit, rnd);
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
    box(sty[0] - 0.2, sty[1] - 0.14, sty[0] + 0.2, sty[1] + 0.14, 0, 7, AC.boisC, rnd);
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
    box(-0.32, -0.24, 0.32, 0.24, 10, 21, AC.boisC, rnd);
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
      cyl(x, y, 0.12, 0, 6, AC.granit, rnd);
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
        box(x0 + 0.04, y0 + 0.04, x1 - 0.04, y1 - 0.04, 0, 5, AC.boisC, rnd, null, sh(AC.boisC, 1.12));
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
          0.8,
        );
      });
  },
  wood(rnd) {
    ground(1, '#b39a74', rnd, 0.7);
    cyl(-0.12, -0.08, 0.15, 0, 6, AC.granit, rnd);
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
    box(-0.3, -0.3, 0.02, -0.02, 0, 16, AC.granitD, rnd, null, AC.granit);
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
    box(0.45, 0.4, 0.62, 0.55, 2, 7, AC.bois, rnd, null, '#6a5a5a');
  },
  brew(rnd) {
    ground(2, '#c9b08a', rnd, 0.92);
    box(-0.55, -0.22, 0.4, 0.18, 0, 3, AC.granit, rnd);
    box(-0.55, -0.22, 0.4, 0.18, 3, 12, AC.chaux, rnd);
    door2(-0.2, 0.18, 0, 0.13, 9, rnd);
    win2(0.14, 0.18, 5, rnd);
    gable2(-0.55, -0.22, 0.4, 0.18, 12, 14, AC.chaume, rnd, AC.chaux);
    box(0.18, -0.14, 0.3, -0.02, 20, 32, AC.granit, rnd, null, AC.granitD);
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
    box(-0.45, -0.25, 0.45, 0.2, 0, 12, AC.granit, rnd);
    door2(0, 0.2, 0, 0.16, 9, rnd, '#3a2a20');
    hip2(-0.5, -0.3, 0.5, 0.25, 12, 10, AC.ardoise, rnd, 0, 'slate');
    box(0.22, -0.2, 0.36, -0.06, 18, 38, AC.granitD, rnd, null, '#5a5650');
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
      0.7,
    );
    post(-0.3, 0.5, 0, 6, rnd, '#3a3836');
    box(0.3, 0.4, 0.55, 0.55, 0, 4, AC.bois, rnd, null, '#3f6a8a');
  },
  store(rnd) {
    ground(2, '#c4ab84', rnd, 0.92);
    box(-0.55, -0.28, 0.5, 0.22, 0, 15, AC.boisC, rnd);
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
    box(-0.22, -0.22, 0.22, 0.22, 25, 27, AC.bois, rnd, null, AC.boisC);
    const [fx, fy] = W(0, 0, 27);
    figure(fx, fy, 0, AC.guede, 'soldier');
    box(-0.22, -0.22, 0.22, 0.22, 27, 32, AC.boisC, rnd);
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
    box(-0.6, -0.42, 0.6, -0.08, 0, 12, AC.boisC, rnd);
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
    ground(3, '#6ea56f', rnd, 0.94);
    A.g.strokeStyle = 'rgba(240,232,200,.4)';
    A.g.lineWidth = 1.2;
    const [cx, cy] = W(0, 0);
    A.g.beginPath();
    A.g.ellipse(cx, cy, 42, 26, 0, 0, 7);
    A.g.stroke();
    const trees: [number, number][] = [
      [-0.95, -0.45],
      [0.95, -0.45],
      [0, -1],
      [-0.6, -0.85],
      [0.6, -0.85],
    ];
    trees.sort((a, b) => DP2(...a) - DP2(...b));
    for (const [x, y] of trees) oak3(...W(x, y), 1, rnd, '#4a6a42');
    menhir3(0, 0, 30, rnd);
    for (const [c, o] of [
      [AC.ocre, -5],
      [AC.guede, 0],
      [AC.ajonc, 5],
    ] as const) {
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
      oak3(...W(x, y), 1, rnd, '#4a6a42');
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
    box(-0.85, -0.32, 0.85, 0.3, 0, 4, AC.granit, rnd);
    box(-0.85, -0.32, 0.85, 0.3, 4, 15, AC.chaux, rnd);
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
    box(-0.55, -0.3, 0.15, 0.12, 0, 11, AC.boisC, rnd);
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
/** Animations d'un bâtiment, dessinées dans son repère local. */
function liveB(b: Building, time: number): void {
  const p = A.LOC,
    [ox, oy] = bc(b);
  A.LOC = { c: 0, k: 1, ox, oy, z: ZH(idx(b.x, b.y)) };
  try {
    liveB2(b, time);
  } finally {
    A.LOC = p;
  }
}
function liveB2(b: Building, time: number): void {
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
    if ((b.wk ?? 0) > 0) smoke(0.24, -0.08, 34, time, 'r');
  } else if (t === 'forge') {
    const [px, py] = W(0, 0.2, 4);
    const f = Math.sin(time / 120) * 0.5 + 0.5;
    A.g.fillStyle = `rgba(255,${(120 + f * 70) | 0},40,${(b.wk ?? 0) > 0 ? 0.95 : 0.25})`;
    A.g.fillRect(px - 4, py - 6, 8, 6);
    if ((b.wk ?? 0) > 0) {
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
    const u = used(b) / B[t].cap!;
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

export { bSprite, liveB };
