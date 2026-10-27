/** Boucle d'animation et démarrage du jeu. */
import { A } from '../app/state';
import { $ } from '../app/dom';
import { load, newGame, ser, staff, stepSim, store } from '../app/game';
import { render } from '../render/renderer';
import { keys, resize } from './input';
import { buildToolbar, buildTrade, renderLog, renderObj, renderSel, renderStats, renderWrath, setPanel, setTool } from './panels';

/** Horodatage de l'image précédente, pas de simulation en retard, temps depuis la mise à jour des panneaux. */
let last = 0,
  acc = 0,
  uiT = 0;

/** Pas de simulation par seconde à la vitesse ×1, et au plus par image (au-delà, on lâche le retard). */
const STEPS_PER_SECOND = 10;
const MAX_STEPS_PER_FRAME = 40;
/** Intervalle de mise à jour des panneaux, en millisecondes. */
const UI_EVERY = 300;

/** Une image : caméra au clavier, pas de simulation en retard, dessin, puis panneaux. */
function frame(t: number): void {
  const dt = Math.min(250, t - (last || t));
  last = t;
  const ps = ((500 / A.cam.z) * dt) / 1000;
  if (keys['arrowleft'] || keys['q'] || keys['a']) A.cam.x -= ps;
  if (keys['arrowright'] || keys['d']) A.cam.x += ps;
  if (keys['arrowup'] || keys['z'] || keys['w']) A.cam.y -= ps;
  if (keys['arrowdown'] || keys['s']) A.cam.y += ps;
  if (A.speed > 0) {
    acc += (dt * A.speed * STEPS_PER_SECOND) / 1000;
    let n = 0;
    while (acc >= 1 && n < MAX_STEPS_PER_FRAME) {
      stepSim();
      acc--;
      n++;
    }
    if (n >= MAX_STEPS_PER_FRAME) acc = 0;
  }
  render(t);
  uiT += dt;
  if (uiT > UI_EVERY) {
    uiT = 0;
    renderStats();
    if (A.sel || A.dirtySel) {
      renderSel();
      A.dirtySel = false;
    }
  }
  if (A.dirtyLog) {
    renderLog();
    A.dirtyLog = false;
  }
  if (A.dirtyObj) {
    renderObj();
    A.dirtyObj = false;
  }
  requestAnimationFrame(frame);
}
/** Démarre sur la partie transmise par le rechargement à chaud, sinon la sauvegarde, sinon une nouvelle île. */
function start(data: HotData): void {
  let ok = false;
  if (data && data.save) {
    try {
      ok = load(data.save);
    } catch (e) {}
  }
  if (!ok) {
    const s = store.read();
    if (s) {
      try {
        ok = load(s);
      } catch (e) {
        console.warn(e);
      }
    }
  }
  if (!ok) newGame(20260);
  staff();
  if (innerWidth > 820) setPanel(true);
  buildToolbar();
  buildTrade();
  renderWrath();
  setTool('inspect');
  resize();
  new ResizeObserver(resize).observe($('view'));
  requestAnimationFrame(frame);
}
/** Rechargement à chaud de l'artefact : la partie survit à une mise à jour de la page. */
interface HotData {
  save?: string;
}
interface Hot {
  snapshot?(fn: () => HotData): void;
  ready?(fn: (data: HotData) => void): void;
  data?: HotData;
}
const hot = (window as unknown as { claude?: { hot?: Hot } }).claude?.hot;
hot?.snapshot?.(() => ({ save: ser() }));
if (hot?.ready) hot.ready(start);
else start(hot?.data ?? {});
