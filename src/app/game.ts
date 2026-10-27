/**
 * La partie en cours, vue de l'interface : création, chronique, messages, actions du joueur et sauvegarde.
 * Ce module relie la simulation (qui ne connaît ni l'écran ni la page) au reste du jeu, à travers CTX.
 */
import { nextRandom } from '../core/rng';
import { deserialize, serialize } from '../core/save';
import { localStore } from '../core/storage';
import { HX, HY, foot, hexLine, idx, type Cell } from '../core/hex';
import type { Building, House } from '../core/state';
import { generateWorld } from '../world/generate';
import { access as accessOf, buildings } from '../sim/query';
import { assignLabor } from '../sim/labor';
import { needsOf, type HouseNeeds, type HouseStock } from '../sim/housing';
import { stockOf as stockOfS } from '../sim/stock';
import { roadNb as roadNbS } from '../sim/paths';
import { buildWall as buildWallS, resetFields } from '../sim/defense';
import { dateLabel, simStep } from '../sim/tick';
import { OBJECTIVES } from '../sim/objectives';
import type { SimCtx } from '../sim/context';
import {
  buildRoad as buildRoadS,
  canPlace as canPlaceS,
  createGame,
  demolishArea,
  placeBuilding,
  removeBuilding,
  roadCost as roadCostS,
} from '../sim/construction';
import { monthlyTaxDue } from '../sim/tax';
import { A } from './state';
import { $ } from './dom';
import { W } from '../render/projection';
import { computeDep } from '../render/terrain';
import { markVis, resetVis } from '../render/overlays';
import { FX, ageFX } from '../render/fx';

/** Nombre d'entrées gardées dans la chronique. */
const LOG_SIZE = 14;

export const store = localStore('oppidum-save', ['oppidum-v2']);

/** Hasard de la simulation : tiré de l'état de la partie, donc reproductible et sauvegardé avec elle. */
function rand(): number {
  const [v, n] = nextRandom(A.S.rs | 0);
  A.S.rs = n;
  return v;
}

/** Ce que la simulation demande au jeu : hasard, chronique, messages, effets, retrait d'un bâtiment. */
const CTX: SimCtx = {
  rand,
  log: m => log(m),
  toast: m => toast(m),
  fx: e => FX.push(e),
  removeBuilding: id => removeB(id),
  onVisit: w => markVis(w),
};

/** Remet à zéro tout ce qui dépend de la partie sans être sauvegardé : distances, effets, passages, profondeur de la mer. */
function resetCaches(): void {
  resetFields();
  FX.length = 0;
  resetVis();
  computeDep();
}

/* ---------- partie ---------- */

export function newGame(seed: number): void {
  const wd = generateWorld(seed);
  A.S = createGame(seed, wd);
  resetCaches();
  log(
    "Votre clan vénète vient de débarquer sur l'île. Prolongez la route qui part du port, posez des huttes de part et d'autre et un puits.",
  );
  const [cx, cy] = W(HX(wd.focus), HY(wd.focus));
  A.cam.x = cx;
  A.cam.y = cy;
  A.cam.z = 1.1;
}

/** Un pas de simulation, puis le vieillissement des effets visuels. Sauvegarde à chaque fin de mois. */
export function stepSim(): void {
  simStep(A.S, CTX, {
    onMonth: () => {
      A.dirtyObj = true;
      save();
    },
  });
  ageFX();
}

/** Répartit les travailleurs (à appeler après un chargement ou une nouvelle partie). */
export function staff(): void {
  assignLabor(A.S);
}

/* ---------- chronique et messages ---------- */

export function log(t: string): void {
  A.S.logs.unshift({ m: dateTxt(), t });
  if (A.S.logs.length > LOG_SIZE) A.S.logs.length = LOG_SIZE;
  A.dirtyLog = true;
}

export function dateTxt(): string {
  return dateLabel(A.S.mi);
}

let toastT: ReturnType<typeof setTimeout> | undefined;
/** Message bref en bas de l'écran. */
function toast(t: string): void {
  const el = $('toast');
  el.textContent = t;
  el.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('on'), 2200);
}

/* ---------- lectures pour l'affichage ---------- */

/** Case d'arrivée des familles. */
export const ENTRY = (): Cell => (A.S && A.S.entry != null ? A.S.entry : idx(0, 24));
export const blds = (): Building[] => buildings(A.S);
export const roadNb = (i: Cell): Cell[] => roadNbS(A.S, i);
export const access = (b: Building): Cell[] => accessOf(A.S, b);
export const stockOf = (r: string): number => stockOfS(A.S, r);
export const taxDue = (): number => monthlyTaxDue(A.S);
export const hasOf = (h: House): HouseNeeds => needsOf(A.S, h as HouseStock);
export const canPlace = (type: string, x: number, y: number): string => canPlaceS(A.S, type, x, y);
export const roadCost = (i: Cell): number => roadCostS(A.S, i);
/** Cases d'une ligne droite entre deux cases, pour tracer chemins et remparts. */
export const roadLine = hexLine;

/** Objectifs : libellé, atteint ?, avancement affiché. */
export const OBJ: [string, () => boolean, () => string][] = OBJECTIVES.map(o => [o.label, () => o.done(A.S), () => o.progress(A.S)]);

/* ---------- actions du joueur ---------- */

/** Pose un bâtiment ; renvoie faux si l'emplacement ou le trésor ne le permettent pas. */
export function place(type: string, x: number, y: number): boolean {
  return !!placeBuilding(A.S, type, x, y, CTX);
}

export function buildRoad(list: Cell[]): void {
  buildRoadS(A.S, list, CTX);
}

export function buildWall(list: Cell[]): void {
  buildWallS(A.S, list, CTX);
}

export function demolishRect(a: Cell, c: Cell): void {
  demolishArea(A.S, a, c, id => removeB(id));
}

function removeB(id: number): void {
  if (removeBuilding(A.S, id) && A.sel === id) A.sel = null;
}

/* ---------- sauvegarde ---------- */

export function ser(): string {
  return serialize(A.S, A.cam);
}

export function save(): void {
  store.write(ser());
}

/** Reprend une partie sauvegardée ; renvoie faux si la sauvegarde est illisible. */
export function load(str: string): boolean {
  const r = deserialize(str);
  if (r.ok === false) {
    console.warn('Sauvegarde ignorée :', r.reason);
    return false;
  }
  const o = r.state;
  // relief absent des plus anciennes sauvegardes : on le recalcule depuis la graine, aplani sous les bâtiments
  if (r.missing.includes('hgt')) {
    o.hgt = generateWorld(o.seed).hgt;
    for (const b of Object.values(o.b)) {
      const h0 = o.hgt[idx(b.x, b.y)];
      for (const t of foot(b.s, b.x, b.y) ?? []) o.hgt[t] = h0;
    }
  }
  A.S = o;
  for (const b of blds()) if (b.hp == null) b.maxhp = b.hp = 40 * b.s * b.s;
  resetCaches();
  if (r.cam) A.cam = r.cam;
  if (r.migratedFrom) log(`Partie reprise depuis une sauvegarde au format ${r.migratedFrom}, mise à jour automatiquement.`);
  return true;
}
