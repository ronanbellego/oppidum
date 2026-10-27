// @ts-nocheck — à typer (en cours).
import { MAXSTEP, N } from '../core/constants';
import { A } from '../app/state';
import { $ } from '../app/dom';
import { access, hasOf, roadNb } from '../app/game';

/** Dernière zone atteignable calculée, gardée quelques pas pour ne pas la refaire à chaque image. */
let reachC: { id: number; t: number; set: Set<Cell> | null } = { id: 0, t: -99, set: null };

const VIS = {};
function resetVis() {
  for (const k of ['market', 'druid', 'bard', 'tax']) VIS[k] = new Int32Array(N * N).fill(-1e9);
}
function markVis(w) {
  const k = w.k === 'priest' ? 'druid' : w.k;
  if (VIS[k]) VIS[k][w.cur] = A.S.tick;
}
const OV = {
  water: { n: 'Eau', c: '110,170,230', d: 'Zone bleue : portée des puits (3 cases).', ok: "maison qui a de l'eau" },
  market: {
    n: 'Marché',
    c: '232,170,70',
    d: "Chemins colorés : passages récents d'une marchande (la couleur s'efface en 4 mois).",
    ok: 'maison qui a des vivres',
  },
  druid: {
    n: 'Culte',
    c: '240,238,226',
    d: "Chemins colorés : passages récents d'un druide ou d'un prêtre.",
    ok: 'maison visitée depuis moins de 4 mois',
  },
  bard: { n: 'Bardes', c: '226,104,70', d: "Chemins colorés : passages récents d'un barde.", ok: 'maison visitée depuis moins de 4 mois' },
  tax: { n: 'Tribut', c: '110,160,232', d: 'Chemins colorés : passages récents du collecteur.', ok: 'maison taxée depuis moins de 3 mois' },
};
const TOOLOV = {
  well: 'water',
  market: 'market',
  grove: 'druid',
  t_taranis: 'druid',
  t_belenos: 'druid',
  t_epona: 'druid',
  bard: 'bard',
  chief: 'tax',
};
function ovKind() {
  if (A.view !== 'none') return A.view;
  if (TOOLOV[A.tool]) return TOOLOV[A.tool];
  const b = A.sel && A.S.b[A.sel];
  return (b && TOOLOV[b.type]) || null;
}
function houseOK(h, k) {
  if (k === 'tax') return A.S.mi - h.lastTax <= 2;
  const a = hasOf(h);
  return k === 'water' ? a.water : k === 'market' ? a.food : k === 'druid' ? a.relig : a.ent;
}
function reachOf(b) {
  if (reachC.id === b.id && A.S.tick - reachC.t < 30) return reachC.set;
  const set = new Set();
  const dist = new Map();
  const q = [];
  for (const a of access(b)) {
    dist.set(a, 0);
    q.push(a);
  }
  let h = 0;
  while (h < q.length) {
    const i = q[h++];
    set.add(i);
    const d = dist.get(i);
    if (d >= MAXSTEP) continue;
    for (const j of roadNb(i))
      if (!dist.has(j)) {
        dist.set(j, d + 1);
        q.push(j);
      }
  }
  reachC = { id: b.id, t: A.S.tick, set };
  return set;
}
function renderViews() {
  const k = ovKind();
  const key = k + '|' + A.view;
  if (key === A.lastOv) return;
  A.lastOv = key;
  document
    .querySelectorAll('.vb button')
    .forEach(b => b.setAttribute('aria-pressed', b.dataset.v === (A.view === 'none' && k ? k : A.view)));
  const n = $('viewNote');
  if (!k) {
    n.hidden = true;
    return;
  }
  const o = OV[k];
  n.hidden = false;
  n.innerHTML = `<b>Vue ${o.n.toLowerCase()}</b> · ${o.d}${k !== 'water' ? ' Contour : zone que le marcheur du bâtiment sélectionné peut atteindre.' : ''}<br><span class="dot" style="background:#86b86a"></span>${o.ok} · <span class="dot" style="background:#de6a4e"></span>maison qui en manque`;
}

export { OV, TOOLOV, VIS, houseOK, markVis, ovKind, reachOf, renderViews, resetVis };
