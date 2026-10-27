import { HR, HX, HY, corner, nb4 } from '../core/hex';
import { A } from '../app/state';
import { resetVis } from './overlays';
import { tilesOf } from '../app/game';
import { P } from './kit';
import { geo } from './terrain';

/* ---- géométrie hexagonale (pointe en haut, lignes impaires décalées) ---- */
const HW = 56,
  TILT = 0.62,
  ZW = -10;
const ROT = (-20 * Math.PI) / 180,
  CR = Math.cos(ROT),
  SR = Math.sin(ROT);
function W(x, y, z = 0) {
  if (A.LOC) {
    x = (x - A.LOC.c) * A.LOC.k + A.LOC.ox;
    y = (y - A.LOC.c) * A.LOC.k + A.LOC.oy;
    z += A.LOC.z || 0;
  }
  return [(x * CR - y * SR) * HW, (x * SR + y * CR) * HW * TILT - z];
}
const DP2 = (x, y) => x * SR + y * CR,
  DPi = i => DP2(HX(i), HY(i));
const vis = (nx, ny) => nx * SR + ny * CR > 0.03;
const fshade = (nx, ny) => 0.78 - 0.18 * (nx * CR - ny * SR);
const VISK = [0, 1, 2, 3, 4, 5].filter(k => {
  const a = ((60 * k - 60) * Math.PI) / 180;
  return vis(Math.cos(a), Math.sin(a));
});
function hexPts(cx, cy, r, z) {
  const o = [];
  for (let k = 0; k < 6; k++) {
    const [x, y] = corner(cx, cy, k, r);
    o.push(W(x, y, z));
  }
  return o;
}
const STEP = 9;
function ZH(i) {
  if (A.S.ter[i] === 2) {
    if (!A.S.road[i]) return ZW;
    let m = 99;
    for (const j of nb4(i)) if (A.S.ter[j] !== 2) m = Math.min(m, A.S.hgt ? A.S.hgt[j] * STEP : 0);
    return m === 99 ? 0 : m;
  }
  return A.S.hgt ? A.S.hgt[i] * STEP : 0;
}
function hexI(i, f, s, lw, ins, z) {
  ins = ins || 1;
  if (z != null || (A.S.ter[i] === 2 && !A.S.road[i])) {
    P(hexPts(HX(i), HY(i), HR * ins, z == null ? ZH(i) : z), f, s, lw);
    return;
  }
  const G = geo(i),
    cx = HX(i),
    cy = HY(i),
    o = [];
  for (let k = 0; k < 6; k++) {
    const [x, y] = corner(cx, cy, k, HR * ins);
    o.push(W(x, y, G.zc + (G.zs[k] - G.zc) * ins + 0.5));
  }
  P(o, f, s, lw);
}
function bc(b) {
  const t = tilesOf(b);
  let x = 0,
    y = 0;
  for (const i of t) {
    x += HX(i);
    y += HY(i);
  }
  return [x / t.length, y / t.length];
}
resetVis();

export { CR, DP2, DPi, HW, ROT, SR, STEP, TILT, VISK, W, ZH, ZW, bc, fshade, hexI, hexPts, vis };
