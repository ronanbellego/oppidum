/**
 * Assemblage d'une image, dans cet ordre : la mer case par case, le fondu du large, les terres (blocs en
 * cache), les zones de couverture, puis tout ce qui a du volume trié par profondeur (forêts, rochers,
 * sites anciens, bâtiments, remparts, personnages), les pastilles des maisons, la brume, les effets,
 * la sélection et le curseur.
 */
import { MONTH, N } from '../core/constants';
import { EDGE_DIR, HR, HX, HY, X, Y, corner, foot, hdist, idx, nb4, nbDir, type Cell } from '../core/hex';
import type { Building, House, Unit, Walker } from '../core/state';
import { B, GODC } from '../data/buildings';
import { WALK } from '../data/palette';
import { TER } from '../world/terrain';
import { tilesOf } from '../sim/query';
import { A } from '../app/state';
import { ctx, cv } from '../app/dom';
import { blds, canPlace, roadCost, roadLine } from '../app/game';
import { DP2, DPi, HW, TILT, W, ZH, ZW, bc, hexI } from './projection';
import { OV, TOOLOV, VIS, houseOK, ovKind, reachOf, type ViewKind } from './overlays';
import { blit, ln } from './kit';
import { cartFig, figure, unitFig } from './units';
import { drawFX } from './fx';
import { CHN, DEP, chunk, tileSpr, wallSpr } from './terrain';
import { decoSpr, loneOak, rockCtx, rockSpr2, treeCtx, treeSpr2 } from './decor';
import { bSprite, liveB } from './buildings';

/** Couleur du large, sur laquelle la mer se fond. */
const OPEN_SEA = '#284250';

/** Ce qui a du volume et se dessine trié par profondeur d. */
type Item = { d: number } & (
  | { k: 'tree' | 'rock' | 'lone'; i: Cell; v: number }
  | { k: 'deco' | 'wall'; i: Cell }
  | { k: 'b'; b: Building }
  | { k: 'u'; u: Unit }
  | { k: 'w'; w: Walker; px: number; py: number }
);

/** Cadre visible dans le plan de l'écran, avec une marge pour les objets hauts. */
interface View {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export function render(time: number): void {
  A.g = ctx;
  A.LOC = null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = OPEN_SEA;
  ctx.fillRect(0, 0, cv.width, cv.height);
  const z = A.cam.z;
  ctx.setTransform(A.dpr * z, 0, 0, A.dpr * z, A.dpr * (A.cw / 2 - A.cam.x * z), A.dpr * (A.ch / 2 - A.cam.y * z));
  const view: View = {
    x0: A.cam.x - A.cw / 2 / z - 80,
    x1: A.cam.x + A.cw / 2 / z + 80,
    y0: A.cam.y - A.ch / 2 / z - 100,
    y1: A.cam.y + A.ch / 2 / z + 80,
  };
  const ov = ovKind();

  const { land, roads, items } = scan(view, time);
  seaFade();
  drawLand(view);
  drawCoverage(land, roads, ov, z);
  addMovers(items);
  items.sort((a, b) => a.d - b.d);
  for (const it of items) drawItem(it, time);
  if (ov) houseMarkers(view, ov);
  haze(view, time);
  drawFX(time);
  if (A.sel && A.S.b[A.sel]) for (const i of tilesOf(A.S.b[A.sel])) hexI(i, null, '#f0c45a', 2 / z, 0.97);
  drawCursor(z);
}

/**
 * Parcourt les cases visibles : dessine la mer au passage (fond, écume du rivage, reflets) et relève les
 * terres, les chemins et les objets à trier.
 */
function scan(view: View, time: number): { land: Cell[]; roads: Cell[]; items: Item[] } {
  const S = A.S;
  const items: Item[] = [],
    land: Cell[] = [],
    roads: Cell[] = [];
  for (let i = 0; i < N * N; i++) {
    const [wx, wy] = W(HX(i), HY(i));
    if (wx < view.x0 || wx > view.x1 || wy < view.y0 || wy > view.y1) continue;
    const t = S.ter[i],
      v = S.vr[i];
    if (t === TER.sea) {
      seaTile(i, wx, wy, time);
      if (S.road[i]) land.push(i);
    } else land.push(i);
    if (S.road[i]) roads.push(i);
    if (t === TER.forest && !S.road[i]) items.push({ d: DPi(i) + 0.05, k: 'tree', i, v });
    if (t === TER.rocks) items.push({ d: DPi(i) + 0.05, k: 'rock', i, v });
    if (S.deco && S.deco[i]) items.push({ d: DPi(i) + 0.06, k: 'deco', i });
    else if (loneOakAt(i)) items.push({ d: DPi(i) + 0.05, k: 'lone', i, v });
    const id = S.occ[i];
    if (id) {
      const b = S.b[id];
      if (b && i === idx(b.x, b.y)) {
        // un bâtiment passe derrière la plus profonde de ses cases
        let m = -1e9;
        for (const f of tilesOf(b)) m = Math.max(m, DPi(f));
        items.push({ d: m + 0.2, k: 'b', b });
      }
    }
    if (S.wall[i]) items.push({ d: DPi(i) + 0.15, k: 'wall', i });
  }
  return { land, roads, items };
}

/** Une case de mer : fond en facettes, écume qui va et vient le long du rivage, quelques reflets. */
function seaTile(i: Cell, wx: number, wy: number, time: number): void {
  blit(tileSpr(DEP[i] >= 3 ? 'w' : 's', (A.S.vr[i] * 3) | 0), wx, wy - ZW);
  for (let k = 0; k < 6; k++) {
    const j = nbDir(i, EDGE_DIR[k]);
    if (j >= 0 && A.S.ter[j] !== TER.sea) {
      const a = corner(HX(i), HY(i), k, HR),
        b = corner(HX(i), HY(i), (k + 1) % 6, HR);
      const tide = 0.5 + 0.5 * Math.sin(time / 2600 + X(i) * 0.15);
      ln(W(a[0], a[1], ZW), W(b[0], b[1], ZW), 'rgba(235,240,238,' + (0.35 + 0.4 * tide) + ')', 1.2 + tide * 1.6);
    }
  }
  if ((i * 13) % 7 < 2) {
    const o = Math.sin(time / 1100 + i) * 0.08;
    ln(W(HX(i) - 0.15 + o, HY(i) - 0.05, ZW), W(HX(i) + 0.05 + o, HY(i) + 0.02, ZW), 'rgba(220,232,232,.3)', 1);
  }
}

/** Chêne isolé : environ 3 % des prairies libres, loin des forêts et des bâtiments, toujours aux mêmes endroits. */
function loneOakAt(i: Cell): boolean {
  const S = A.S;
  return (
    S.ter[i] === TER.prairie &&
    !S.road[i] &&
    !S.occ[i] &&
    !S.wall[i] &&
    !(S.lnd && S.lnd[i]) &&
    (Math.imul(i, 2654435761) >>> 0) % 100 < 3 &&
    !nb4(i).some(j => S.ter[j] === TER.forest || S.occ[j])
  );
}

/** La mer se perd progressivement dans le large autour de l'île. */
function seaFade(): void {
  const [mx, my] = W(N / 2, N * 0.433);
  ctx.save();
  ctx.translate(mx, my);
  ctx.scale(1, TILT);
  const R0 = N * 0.34 * HW,
    R1 = N * 0.62 * HW;
  const gr = ctx.createRadialGradient(0, 0, R0, 0, 0, R1);
  gr.addColorStop(0, 'rgba(40,66,80,0)');
  gr.addColorStop(0.55, 'rgba(40,66,80,.7)');
  gr.addColorStop(1, 'rgba(40,66,80,1)');
  ctx.fillStyle = gr;
  ctx.fillRect(-R1 * 3, -R1 * 3, R1 * 6, R1 * 6);
  ctx.restore();
}

/** Les terres, peintes par blocs mis en cache. */
function drawLand(view: View): void {
  for (let cy = 0; cy < N / CHN; cy++)
    for (let cx = 0; cx < N / CHN; cx++) {
      const c = chunk(cx, cy);
      if (!c || c.x0 > view.x1 || c.x0 + c.w < view.x0 || c.y0 > view.y1 || c.y0 + c.h < view.y0) continue;
      A.g.drawImage(c.c, c.x0, c.y0, c.w, c.h);
    }
}

/** Zones de couverture : portée des puits, passages récents des marcheurs, zone atteignable du bâtiment sélectionné. */
function drawCoverage(land: Cell[], roads: Cell[], ov: ViewKind | null, z: number): void {
  const S = A.S;
  if (A.tool === 'well' || A.tool === 'hut' || ov === 'water') {
    const wells = blds()
      .filter(b => b.type === 'well')
      .map(b => idx(b.x, b.y));
    for (const i of land)
      if (S.ter[i] === TER.prairie && !S.road[i] && !S.occ[i] && wells.some(w => hdist(w, i) <= 3))
        hexI(i, 'rgba(110,170,230,.28)', null, 0, 0.96);
  }
  if (ov && ov !== 'water') {
    const c = OV[ov].c,
      V = VIS[ov];
    for (const i of roads) {
      const age = (S.tick - V[i]) / (MONTH * 4);
      if (age < 1) hexI(i, `rgba(${c},${0.12 + 0.5 * (1 - age)})`, null, 0, 0.8);
    }
    const sb = A.sel && S.b[A.sel];
    if (sb && TOOLOV[sb.type] === ov) for (const i of reachOf(sb)) hexI(i, null, `rgba(${c},.95)`, 1.6 / z, 0.86);
  }
}

/** Ajoute les combattants et les marcheurs, à leur position entre deux cases. */
function addMovers(items: Item[]): void {
  for (const u of A.S.u) items.push({ d: DP2(u.px, u.py) + 0.1, k: 'u', u });
  for (const w of A.S.w) {
    const ax = HX(w.cur),
      ay = HY(w.cur);
    const px = ax + (HX(w.nxt) - ax) * w.t,
      py = ay + (HY(w.nxt) - ay) * w.t;
    items.push({ d: DP2(px, py) + 0.1, k: 'w', w, px, py });
  }
}

function drawItem(it: Item, time: number): void {
  const S = A.S;
  switch (it.k) {
    case 'tree':
    case 'lone':
    case 'rock':
    case 'deco': {
      const [wx, wy] = W(HX(it.i), HY(it.i), ZH(it.i));
      const spr =
        it.k === 'tree'
          ? treeSpr2(treeCtx(it.i), (it.v * 4) | 0)
          : it.k === 'lone'
            ? loneOak((it.v * 3) | 0)
            : it.k === 'rock'
              ? rockSpr2(rockCtx(it.i), (it.v * 3) | 0)
              : decoSpr(S.deco[it.i]);
      blit(spr, wx, wy);
      break;
    }
    case 'b': {
      const b = it.b,
        [cx, cy] = bc(b),
        [ax, ay] = W(cx, cy, ZH(idx(b.x, b.y)));
      blit(bSprite(b), ax, ay);
      liveB(b, time);
      break;
    }
    case 'w': {
      const w = it.w,
        [px, py] = W(it.px, it.py, ZH(w.cur) + (ZH(w.nxt) - ZH(w.cur)) * w.t),
        ph = w.t * Math.PI * 2;
      if (w.k === 'cart') cartFig(px, py, ph, w.res!);
      else figure(px, py, ph, w.k === 'priest' ? GODC[w.god!] : WALK[w.k], w.k);
      break;
    }
    case 'wall': {
      const i = it.i,
        [wx, wy] = W(HX(i), HY(i), ZH(i));
      blit(wallSpr(S.wall[i] === 2 ? 'g' : S.whp[i] < 50 ? 'd' : 'w'), wx, wy);
      break;
    }
    case 'u': {
      const u = it.u,
        idle = !S.raid && u.k === 'warrior' && u.nxt === u.cur;
      const [px, py] = W(u.px + (idle ? u.ox : 0), u.py + (idle ? u.oy : 0), ZH(u.cur) + (ZH(u.nxt) - ZH(u.cur)) * u.t);
      unitFig(u, px, py, u.t * Math.PI * 2);
      break;
    }
  }
}

/** Pastille verte ou rouge au-dessus des maisons habitées, selon qu'elles ont ce que montre la vue. */
function houseMarkers(view: View, ov: ViewKind): void {
  for (const b of blds()) {
    if (b.type !== 'hut') continue;
    const h = b as House;
    if (h.pop <= 0) continue;
    const [hx, hy] = bc(h),
      [px, py] = W(hx, hy, ZH(idx(h.x, h.y)) + (h.lvl >= 3 ? 40 : 34));
    if (px < view.x0 || px > view.x1 || py < view.y0 || py > view.y1) continue;
    ctx.fillStyle = houseOK(h, ov) ? '#86b86a' : '#de6a4e';
    ctx.strokeStyle = '#14100a';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(px, py, 4.6, 0, 7);
    ctx.fill();
    ctx.stroke();
  }
}

/** Ombres de nuages qui dérivent et voile de brume marine. */
function haze(view: View, time: number): void {
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
  ctx.fillStyle = 'rgba(222,230,238,.25)';
  ctx.fillRect(view.x0 - 200, view.y0 - 200, view.x1 - view.x0 + 400, view.y1 - view.y0 + 400);
  ctx.restore();
}

/** Aperçu de l'action sous la souris : tracé en cours, case visée, emprise du bâtiment à poser. */
function drawCursor(z: number): void {
  const S = A.S;
  if (A.hover < 0) return;
  const hx = X(A.hover),
    hy = Y(A.hover);
  const drag = A.drag;
  if (drag && drag.mode === 'wall') {
    for (const i of roadLine(drag.a, A.hover))
      hexI(
        i,
        S.occ[i] || S.wall[i] ? null : S.road[i] || S.ter[i] === TER.prairie ? 'rgba(200,190,160,.55)' : 'rgba(222,106,78,.55)',
        null,
        0,
        0.92,
      );
  } else if (drag && drag.mode === 'road') {
    for (const i of roadLine(drag.a, A.hover))
      hexI(i, S.road[i] || S.occ[i] ? null : roadCost(i) < 0 ? 'rgba(222,106,78,.55)' : 'rgba(240,200,110,.45)', null, 0, 0.92);
  } else if (drag && drag.mode === 'demolish') {
    const a = drag.a;
    for (let y = Math.min(Y(a), hy); y <= Math.max(Y(a), hy); y++)
      for (let x = Math.min(X(a), hx); x <= Math.max(X(a), hx); x++) hexI(idx(x, y), 'rgba(222,106,78,.35)', null, 0, 0.95);
  } else if (A.tool === 'road' || A.tool === 'demolish' || A.tool === 'wall') {
    hexI(A.hover, A.tool === 'road' ? 'rgba(240,200,110,.4)' : 'rgba(222,106,78,.35)', null, 0, 0.95);
  } else if (B[A.tool].s) {
    const f = foot(B[A.tool].s!, hx, hy);
    const ok = !canPlace(A.tool, hx, hy);
    if (f) for (const i of f) hexI(i, ok ? 'rgba(134,184,106,.45)' : 'rgba(222,106,78,.45)', ok ? '#cde8b8' : '#f2b0a0', 1.2 / z, 0.95);
    else hexI(A.hover, 'rgba(222,106,78,.45)', null, 0, 0.95);
  }
}
