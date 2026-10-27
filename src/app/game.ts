// @ts-nocheck — à typer (en cours).
import { nextRandom } from '../core/rng';
import { deserialize, serialize } from '../core/save';
import { localStore } from '../core/storage';
import { HX, HY, foot, hexLine, idx } from '../core/hex';
import { generateWorld } from '../world/generate';
import { access as accessOf, buildings, monumentDone, nearTerrain, tilesOf as tilesOfB } from '../sim/query';
import { assignLabor } from '../sim/labor';
import { needsOf } from '../sim/housing';
import { putAny as putAnyS, stockOf as stockOfS, take as takeS } from '../sim/stock';
import { roadNb as roadNbS, roadSearch } from '../sim/paths';
import { killWalker } from '../sim/walkers';
import {
  buildWall as buildWallS,
  passE as passES,
  resetFields,
  spawnUnit as spawnUnitS,
  startRaid as startRaidS,
  stepUnits as stepUnitsS,
} from '../sim/defense';
import { progress } from '../sim/monuments';
import { dateLabel, simStep } from '../sim/tick';
import { buildingStep } from '../sim/buildings';
import { OBJECTIVES } from '../sim/objectives';
import {
  buildRoad as buildRoadS,
  canPlace as canPlaceS,
  createGame,
  demolishArea,
  placeBuilding,
  removeBuilding,
  roadCost as roadCostS,
} from '../sim/construction';
import { monthlyTaxDue, taxRate as taxRateOf } from '../sim/tax';
import { A } from './state';
import { $ } from './dom';
import { W } from '../render/projection';
import { computeDep } from '../render/terrain';
import { markVis, resetVis } from '../render/overlays';
import { FX } from '../render/fx';

let toastT = 0;

const ENTRY = () => (A.S && A.S.entry != null ? A.S.entry : idx(0, 24));
/* hasard de la simulation : tiré de l'état de la partie, donc reproductible et sauvegardé avec elle */
const R = () => {
  const [v, n] = nextRandom(A.S.rs | 0);
  A.S.rs = n;
  return v;
};
const store = localStore('oppidum-save', ['oppidum-v2']);
/* ---------- carte ---------- */
function newGame(seed) {
  const wd = generateWorld(seed);
  A.S = createGame(seed, wd);
  resetFields();
  FX.length = 0;
  resetVis();
  computeDep();
  log(
    "Votre clan vénète vient de débarquer sur l'île. Prolongez la route qui part du port, posez des huttes de part et d'autre et un puits.",
  );
  const [cx, cy] = W(HX(wd.focus), HY(wd.focus));
  A.cam.x = cx;
  A.cam.y = cy;
  A.cam.z = 1.1;
}
/* ---------- utilitaires ---------- */
function log(t) {
  A.S.logs.unshift({ m: dateTxt(), t });
  if (A.S.logs.length > 14) A.S.logs.length = 14;
  A.dirtyLog = true;
}
function dateTxt() {
  return dateLabel(A.S.mi);
}
function toast(t) {
  const el = $('toast');
  el.textContent = t;
  el.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('on'), 2200);
}
function blds() {
  return buildings(A.S);
}
const tilesOf = tilesOfB;
function roadNb(i) {
  return roadNbS(A.S, i);
}
function access(b) {
  return accessOf(A.S, b);
}
function bfs(start, goal) {
  return roadSearch(A.S, start, goal);
}
function stockOf(r) {
  return stockOfS(A.S, r);
}
function take(r, n) {
  return takeS(A.S, r, n);
}
function putAny(r, n) {
  putAnyS(A.S, r, n);
}
function nearTer(b, t, r) {
  return nearTerrain(A.S, b, t, r);
}
/* ---------- construction ---------- */
function canPlace(type, x, y) {
  return canPlaceS(A.S, type, x, y);
}
function place(type, x, y) {
  const b = placeBuilding(A.S, type, x, y, CTX);
  return !!b;
}
function roadCost(i) {
  return roadCostS(A.S, i);
}
function buildRoad(list) {
  buildRoadS(A.S, list, CTX);
}
function demolishRect(a, c) {
  demolishArea(A.S, a, c, id => removeB(id));
}
function removeB(id) {
  if (removeBuilding(A.S, id) && A.sel === id) A.sel = null;
}
/* ---------- marcheurs ---------- */
function kill(w) {
  killWalker(A.S, w);
}
/* ---------- simulation ---------- */
function stepSim() {
  simStep(A.S, CTX, {
    onMonth: () => {
      A.dirtyObj = true;
      save();
    },
  });
}
function updB(b) {
  buildingStep(A.S, b, CTX);
}
function staff() {
  assignLabor(A.S);
}
function taxRate() {
  return taxRateOf(A.S);
}
function taxDue() {
  return monthlyTaxDue(A.S);
}
function hasOf(h) {
  return needsOf(A.S, h);
}
const OBJ = OBJECTIVES.map(o => [o.label, () => o.done(A.S), () => o.progress(A.S)]);
/* ---------- sauvegarde ---------- */
function ser() {
  return serialize(A.S, A.cam);
}
function load(str) {
  const r = deserialize(str);
  if (!r.ok) {
    console.warn('Sauvegarde ignorée :', r.reason);
    return false;
  }
  const o = r.state;
  /* relief absent des plus anciennes sauvegardes : on le recalcule depuis la graine, aplani sous les bâtiments */
  if (r.missing.includes('hgt')) {
    o.hgt = generateWorld(o.seed).hgt;
    for (const b of Object.values(o.b)) {
      const f = foot(b.s, b.x, b.y) || [];
      const h0 = o.hgt[idx(b.x, b.y)];
      for (const t of f) o.hgt[t] = h0;
    }
  }
  A.S = o;
  computeDep();
  for (const b of blds())
    if (b.hp == null) {
      b.maxhp = b.hp = 40 * b.s * b.s;
    }
  resetFields();
  resetVis();
  if (r.cam) A.cam = r.cam;
  if (r.migratedFrom) log(`Partie reprise depuis une sauvegarde au format ${r.migratedFrom}, mise à jour automatiquement.`);
  return true;
}
function save() {
  store.write(ser());
}
/* ce que la simulation demande au jeu : hasard, chronique, effets, retrait d'un bâtiment */
const CTX = {
  rand: () => R(),
  log: m => log(m),
  toast: m => toast(m),
  fx: e => FX.push(e),
  removeBuilding: id => removeB(id),
  onVisit: w => markVis(w),
};
function monDone(t) {
  return monumentDone(A.S, t);
}
function monProg(b) {
  return progress(b);
}
function passE(i) {
  return passES(A.S, i);
}
function spawnUnit(k, i, home) {
  return spawnUnitS(A.S, k, i, CTX, home);
}
function stepUnits() {
  stepUnitsS(A.S, CTX);
  for (const f of FX) f.t--;
  for (let k = FX.length - 1; k >= 0; k--) if (FX[k].t <= 0) FX.splice(k, 1);
}
function startRaid() {
  return startRaidS(A.S, CTX);
}
function buildWall(list) {
  buildWallS(A.S, list, CTX);
}
const roadLine = hexLine;

export {
  ENTRY,
  OBJ,
  access,
  blds,
  buildRoad,
  buildWall,
  canPlace,
  dateTxt,
  demolishRect,
  hasOf,
  load,
  log,
  monProg,
  newGame,
  place,
  roadCost,
  roadLine,
  roadNb,
  save,
  ser,
  staff,
  stepSim,
  stockOf,
  store,
  taxDue,
  tilesOf,
};
