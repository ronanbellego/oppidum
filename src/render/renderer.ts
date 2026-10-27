// @ts-nocheck — affichage et interface extraits de la version mono-fichier ; à typer progressivement.
import { MONTH, N } from '../core/constants';
import { EDGE_DIR, HR, HX, HY, X, Y, corner, foot, hdist, idx, nb4, nbDir } from '../core/hex';
import { B, GODC } from '../data/buildings';
import { DEEP, WALK } from '../data/palette';
import { A } from '../app/state';
import { ctx, cv } from '../app/dom';
import { DP2, DPi, HW, TILT, W, ZH, ZW, bc, hexI } from './projection';
import { OV, TOOLOV, VIS, houseOK, ovKind, reachOf } from './overlays';
import { blds, canPlace, roadCost, roadLine, tilesOf } from '../app/game';
import { blit, ln, spriteLevel } from './kit';
import { cartFig, figure, unitFig } from './units';
import { drawFX } from './fx';
import { CHN, chunk, chunkFrame, gridPath, wallSpr } from './terrain';
import { decoSpr, loneOak, rockCtx, rockSpr2, treeCtx, treeSpr2 } from './decor';
import { bGround, bShadow, bSprite, liveB } from './buildings';

/* taille des personnages par rapport aux maisons */
const FIG = 0.62;
function scaled(px, py, fn) {
  A.g.save();
  A.g.translate(px, py);
  A.g.scale(FIG, FIG);
  A.g.translate(-px, -py);
  try {
    fn();
  } finally {
    A.g.restore();
  }
}

function render(time) {
  A.g = ctx;
  A.LOC = null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = DEEP;
  ctx.fillRect(0, 0, cv.width, cv.height);
  const z = A.cam.z;
  // résolution des dessins en cache : celle des pixels réellement affichés
  spriteLevel(A.dpr * z);
  chunkFrame(A.dpr * z);
  ctx.setTransform(A.dpr * z, 0, 0, A.dpr * z, A.dpr * (A.cw / 2 - A.cam.x * z), A.dpr * (A.ch / 2 - A.cam.y * z));
  const vx0 = A.cam.x - A.cw / 2 / z - 80,
    vx1 = A.cam.x + A.cw / 2 / z + 80,
    vy0 = A.cam.y - A.ch / 2 / z - 100,
    vy1 = A.cam.y + A.ch / 2 / z + 80;
  const ov = ovKind();
  const wells =
    A.tool === 'well' || A.tool === 'hut' || ov === 'water'
      ? blds()
          .filter(b => b.type === 'well')
          .map(b => idx(b.x, b.y))
      : null;
  const items = [],
    land = [],
    roadsV = [];
  for (let i = 0; i < N * N; i++) {
    const [wx, wy] = W(HX(i), HY(i));
    if (wx < vx0 || wx > vx1 || wy < vy0 || wy > vy1) continue;
    const t = A.S.ter[i],
      v = A.S.vr[i];
    if (t === 2) {
      for (let k = 0; k < 6; k++) {
        const j = nbDir(i, EDGE_DIR[k]);
        if (j >= 0 && A.S.ter[j] !== 2) {
          const a = corner(HX(i), HY(i), k, HR),
            b = corner(HX(i), HY(i), (k + 1) % 6, HR);
          const tide = 0.5 + 0.5 * Math.sin(time / 2600 + X(i) * 0.15);
          ln(W(a[0], a[1], ZW), W(b[0], b[1], ZW), 'rgba(240,248,250,' + (0.25 + 0.35 * tide) + ')', 1 + tide * 1.4);
        }
      }
      if ((i * 13) % 7 < 2) {
        const o = Math.sin(time / 1100 + i) * 0.08;
        const p1 = W(HX(i) - 0.15 + o, HY(i) - 0.05, ZW),
          p2 = W(HX(i) + 0.05 + o, HY(i) + 0.02, ZW);
        ln(p1, p2, 'rgba(225,240,248,.28)', 1);
      }
      if (A.S.road[i]) land.push(i);
    } else land.push(i);
    if (A.S.road[i]) roadsV.push(i);
    if (t === 1 && !A.S.road[i]) items.push({ d: DPi(i) + 0.05, k: 'tree', i, v });
    if (t === 3) items.push({ d: DPi(i) + 0.05, k: 'rock', i, v });
    if (A.S.deco && A.S.deco[i]) items.push({ d: DPi(i) + 0.06, k: 'deco', i });
    else if (
      t === 0 &&
      !A.S.road[i] &&
      !A.S.occ[i] &&
      !A.S.wall[i] &&
      !(A.S.lnd && A.S.lnd[i]) &&
      (Math.imul(i, 2654435761) >>> 0) % 100 < 3 &&
      !nb4(i).some(j => A.S.ter[j] === 1 || A.S.occ[j])
    )
      items.push({ d: DPi(i) + 0.05, k: 'lone', i, v });
    const id = A.S.occ[i];
    if (id) {
      const b = A.S.b[id];
      if (b && i === idx(b.x, b.y)) {
        let m = -1e9;
        for (const f of tilesOf(b)) m = Math.max(m, DPi(f));
        items.push({ d: m + 0.2, k: 'b', b });
      }
    }
    if (A.S.wall[i]) items.push({ d: DPi(i) + 0.15, k: 'wall', i });
  }
  for (let cy2 = 0; cy2 < N / CHN; cy2++)
    for (let cx2 = 0; cx2 < N / CHN; cx2++) {
      const c = chunk(cx2, cy2, vx0, vx1, vy0, vy1);
      if (!c) continue;
      A.g.drawImage(c.c, c.x0, c.y0, c.w, c.h);
    }
  if (A.grid) {
    gridPath(vx0, vx1, vy0, vy1);
    ctx.strokeStyle = 'rgba(255,255,255,.26)';
    ctx.lineWidth = 1.1 / z;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  for (const i of land) {
    const t = A.S.ter[i];
    if (wells && t === 0 && !A.S.road[i] && !A.S.occ[i] && wells.some(w => hdist(w, i) <= 3))
      hexI(i, 'rgba(110,170,230,.28)', null, 0, 0.96);
  }
  if (ov && ov !== 'water') {
    const c = OV[ov].c,
      V = VIS[ov];
    for (const i of roadsV) {
      const age = (A.S.tick - V[i]) / (MONTH * 4);
      if (age < 1) hexI(i, `rgba(${c},${0.12 + 0.5 * (1 - age)})`, null, 0, 0.8);
    }
    const sb = A.sel && A.S.b[A.sel];
    if (sb && TOOLOV[sb.type] === ov) {
      const rs = reachOf(sb);
      for (const i of rs) hexI(i, null, `rgba(${c},.95)`, 1.6 / z, 0.86);
    }
  }
  for (const u of A.S.u) items.push({ d: DP2(u.px, u.py) + 0.1, k: 'u', u });
  for (const w of A.S.w) {
    const ax = HX(w.cur),
      ay = HY(w.cur),
      bx = HX(w.nxt),
      by = HY(w.nxt);
    const px = ax + (bx - ax) * w.t,
      py = ay + (by - ay) * w.t;
    items.push({ d: DP2(px, py) + 0.1, k: 'w', w, px, py });
  }
  items.sort((a, b) => a.d - b.d);
  // sol des bâtiments, puis leurs ombres, posés avant tout ce qui se dresse
  const bs = items.filter(it => it.k === 'b');
  for (const pass of [bGround, bShadow])
    for (const it of bs) {
      const b = it.b,
        [cx, cy] = bc(b),
        [ax, ay] = W(cx, cy, ZH(idx(b.x, b.y)));
      blit(pass(b), ax, ay);
    }
  for (const it of items) {
    if (it.k === 'tree') {
      const [wx, wy] = W(HX(it.i), HY(it.i), ZH(it.i));
      blit(treeSpr2(treeCtx(it.i), (it.v * 7) | 0), wx, wy);
    } else if (it.k === 'lone') {
      const [wx, wy] = W(HX(it.i), HY(it.i), ZH(it.i));
      blit(loneOak((it.v * 5) | 0), wx, wy);
    } else if (it.k === 'deco') {
      const [wx, wy] = W(HX(it.i), HY(it.i), ZH(it.i));
      blit(decoSpr(A.S.deco[it.i]), wx, wy);
    } else if (it.k === 'rock') {
      const [wx, wy] = W(HX(it.i), HY(it.i), ZH(it.i));
      blit(rockSpr2(rockCtx(it.i), (it.v * 5) | 0), wx, wy);
    } else if (it.k === 'b') {
      const b = it.b,
        [cx, cy] = bc(b),
        [ax, ay] = W(cx, cy, ZH(idx(b.x, b.y)));
      blit(bSprite(b), ax, ay);
      liveB(b, time);
    } else if (it.k === 'w') {
      const w = it.w,
        [px, py] = W(it.px, it.py, ZH(w.cur) + (ZH(w.nxt) - ZH(w.cur)) * w.t),
        ph = w.t * Math.PI * 2;
      scaled(px, py, () => {
        if (w.k === 'cart') cartFig(px, py, ph, w.res);
        else figure(px, py, ph, w.k === 'priest' ? GODC[w.god] : WALK[w.k], w.k);
      });
    } else if (it.k === 'wall') {
      const i = it.i,
        [wx, wy] = W(HX(i), HY(i), ZH(i));
      blit(wallSpr(A.S.wall[i] === 2 ? 'g' : A.S.whp[i] < 50 ? 'd' : 'w'), wx, wy);
    } else if (it.k === 'u') {
      const u = it.u,
        idle = !A.S.raid && u.k === 'warrior' && u.nxt === u.cur;
      const [px, py] = W(u.px + (idle ? u.ox : 0), u.py + (idle ? u.oy : 0), ZH(u.cur) + (ZH(u.nxt) - ZH(u.cur)) * u.t);
      scaled(px, py, () => unitFig(u, px, py, u.t * Math.PI * 2));
    }
  }
  if (ov)
    for (const h of blds()) {
      if (h.type !== 'hut' || h.pop <= 0) continue;
      const [hx, hy] = bc(h),
        [px, py] = W(hx, hy, ZH(idx(h.x, h.y)) + (h.lvl >= 3 ? 40 : 34));
      if (px < vx0 || px > vx1 || py < vy0 || py > vy1) continue;
      const ok = houseOK(h, ov);
      ctx.fillStyle = ok ? '#86b86a' : '#de6a4e';
      ctx.strokeStyle = '#14100a';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(px, py, 4.6, 0, 7);
      ctx.fill();
      ctx.stroke();
    }
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  for (let k = 0; k < 4; k++) {
    const cxw = ((time * 0.006 + k * 820) % 3400) - 700,
      cyw = 200 + k * 230 - ((time * 0.003 + k * 300) % 900);
    const gr = ctx.createRadialGradient(cxw, cyw, 10, cxw, cyw, 260);
    gr.addColorStop(0, 'rgba(90,104,118,.22)');
    gr.addColorStop(1, 'rgba(90,104,118,0)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.ellipse(cxw, cyw, 320, 170, 0, 0, 7);
    ctx.fill();
  }
  // ciel couvert : un voile gris-bleu léger sur toute la scène
  ctx.fillStyle = 'rgba(222,230,238,.25)';
  ctx.fillRect(vx0 - 200, vy0 - 200, vx1 - vx0 + 400, vy1 - vy0 + 400);
  ctx.restore();
  drawFX(time);
  if (A.sel && A.S.b[A.sel]) {
    for (const i of tilesOf(A.S.b[A.sel])) hexI(i, null, '#f0c45a', 2 / z, 0.97);
  }
  if (A.hover >= 0) {
    const hx = X(A.hover),
      hy = Y(A.hover);
    if (A.drag && A.drag.mode === 'wall') {
      for (const i of roadLine(A.drag.a, A.hover))
        hexI(
          i,
          A.S.occ[i] || A.S.wall[i] ? null : A.S.road[i] || A.S.ter[i] === 0 ? 'rgba(200,190,160,.55)' : 'rgba(222,106,78,.55)',
          null,
          0,
          0.92,
        );
    } else if (A.drag && A.drag.mode === 'road') {
      for (const i of roadLine(A.drag.a, A.hover))
        hexI(i, A.S.road[i] || A.S.occ[i] ? null : roadCost(i) < 0 ? 'rgba(222,106,78,.55)' : 'rgba(240,200,110,.45)', null, 0, 0.92);
    } else if (A.drag && A.drag.mode === 'demolish') {
      const a = A.drag.a;
      for (let y = Math.min(Y(a), hy); y <= Math.max(Y(a), hy); y++)
        for (let x = Math.min(X(a), hx); x <= Math.max(X(a), hx); x++) hexI(idx(x, y), 'rgba(222,106,78,.35)', null, 0, 0.95);
    } else if (A.tool === 'road' || A.tool === 'demolish' || A.tool === 'wall') {
      hexI(A.hover, A.tool === 'road' ? 'rgba(240,200,110,.4)' : 'rgba(222,106,78,.35)', null, 0, 0.95);
    } else if (B[A.tool].s) {
      const f = foot(B[A.tool].s, hx, hy);
      const ok = !canPlace(A.tool, hx, hy);
      if (f) for (const i of f) hexI(i, ok ? 'rgba(134,184,106,.45)' : 'rgba(222,106,78,.45)', ok ? '#cde8b8' : '#f2b0a0', 1.2 / z, 0.95);
      else hexI(A.hover, 'rgba(222,106,78,.45)', null, 0, 0.95);
    }
  }
}

export { render };
