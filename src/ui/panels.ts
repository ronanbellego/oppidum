/**
 * Panneaux de l'interface : barre du haut, fiche de la sélection, panneau de droite (objectifs, chronique,
 * main-d'œuvre, tribut, dieux, défense, commerce), barre d'outils, légende des vues.
 */
import { N } from '../core/constants';
import type { GameState, House } from '../core/state';
import type { HouseStock } from '../sim/housing';
import { used } from '../sim/stock';
import { festival } from '../sim/gods';
import { taxPending } from '../sim/tax';
import { RES } from '../data/resources';
import { LV } from '../data/houses';
import { B, TOOLS } from '../data/buildings';
import { PRIO, SECT } from '../data/labor';
import { A } from '../app/state';
import { $, cv } from '../app/dom';
import { ENTRY, OBJ, blds, dateTxt, hasOf, log, newGame, save, staff, stockOf, taxDue } from '../app/game';
import { progress as monProg } from '../sim/monuments';
import { OV, ovKind } from '../render/overlays';
import { TER } from '../world/terrain';

/** Boutons de la page, typés. */
const buttons = (sel: string) => document.querySelectorAll<HTMLButtonElement>(sel);
const press = (b: Element, on: boolean) => b.setAttribute('aria-pressed', String(on));

/** Noms et descriptions des sites anciens. */
const DECO = ['', 'Grand menhir', 'Dolmen', 'Chêne des anciens'];
const DECOTXT = [
  '',
  "Dressé par des peuples bien plus anciens que le vôtre. Nul ne sait qui l'a levé.",
  "Une table de pierre posée sur ses piliers, tombeau d'ancêtres oubliés.",
  'Un chêne millénaire. Les druides disent que le gui y pousse depuis le premier âge.',
];
function setTool(t: string): void {
  A.tool = t;
  buttons('.tb').forEach(b => press(b, b.dataset.t === t));
  const d = B[t];
  $('hint').innerHTML = `<b>${d.n}</b>${d.cost ? ` · ${d.cost} st.` : ''}${(d.s ?? 1) > 1 ? ` · ${d.s}×${d.s}` : ''} — ${d.d}`;
  cv.style.cursor = t === 'inspect' ? 'grab' : 'crosshair';
}
function setSpeed(s: number): void {
  A.speed = s;
  buttons('.speed [data-s]').forEach(b => press(b, +b.dataset.s! === s));
}
/** Ouvre ou ferme le panneau de droite (utile sur petit écran). */
function setPanel(o: boolean): void {
  $('panel').dataset.open = o ? 'true' : 'false';
}
function buildToolbar(): void {
  const el = $('tools');
  el.innerHTML = '';
  for (const [cat, list] of TOOLS) {
    const g = document.createElement('div');
    g.className = 'grp';
    g.innerHTML = `<h4>${cat}</h4>`;
    const bt = document.createElement('div');
    bt.className = 'bt';
    for (const t of list) {
      const d = B[t];
      const b = document.createElement('button');
      b.className = 'tb';
      b.dataset.t = t;
      b.id = 'tool-' + t;
      b.setAttribute('aria-pressed', 'false');
      b.innerHTML = `<span class="n"><i style="background:${d.c}"></i>${d.n}</span><span class="c">${d.cost ? d.cost + ' st.' : t === 'inspect' ? 'vue' : 'gratuit'}</span>`;
      b.onclick = () => setTool(t);
      bt.appendChild(b);
    }
    g.appendChild(bt);
    el.appendChild(g);
  }
}
function buildTrade(): void {
  const el = $('tradeBtns');
  el.innerHTML = '';
  for (const r of Object.keys(RES)) {
    const b = document.createElement('button');
    b.id = 'sell-' + r;
    b.onclick = () => {
      A.S.sell[r] = !A.S.sell[r];
      renderTrade();
    };
    el.appendChild(b);
  }
  renderTrade();
}
function renderTrade(): void {
  for (const r of Object.keys(RES)) {
    const b = $('sell-' + r);
    press(b, !!A.S.sell[r]);
    b.textContent = `${RES[r].n} · ${RES[r].p}`;
  }
  $('tradeNote').textContent = A.S.tradeOK
    ? "Les navires de l'île de Bretagne accostent au port chaque mois et achètent ce que vous cochez, au-delà d'une réserve de 30. Prix en statères par unité."
    : 'Le port a besoin de bras pour accueillir les navires marchands.';
}
/** Texte sûr à insérer dans du HTML. */
const esc = (s: unknown): string => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

/** Fiche de la sélection : bâtiment, maison, ou case de la carte. */
function renderSel(): void {
  const el = $('selSec');
  const b = A.sel && A.S.b[A.sel];
  if (!b) {
    if (A.selTile >= 0 && A.S.road[A.selTile]) {
      el.innerHTML = `<h2>Chemin</h2><p class="muted">${A.S.ter[A.selTile] === TER.sea ? 'Un pont de planches franchit le bras de mer.' : 'Terre battue, praticable par tous les marcheurs.'}${A.selTile === ENTRY() ? ' Les familles arrivent par ici.' : ''}</p>`;
      return;
    }
    if (A.selTile >= 0 && A.S.deco && A.S.deco[A.selTile]) {
      el.innerHTML = `<h2>${DECO[A.S.deco[A.selTile]]}</h2><p class="muted">${DECOTXT[A.S.deco[A.selTile]]}</p>`;
      return;
    }
    if (A.selTile >= 0) {
      const n = ['Prairie', 'Forêt de chênes', 'Rivière', 'Rochers'][A.S.ter[A.selTile]];
      el.innerHTML = `<h2>${n}</h2><p class="muted">${['Terrain à bâtir.', 'Le bûcheron y coupe son bois. Un chemin la défriche.', 'On la franchit avec un pont (20 st.).', 'Le fer affleure : une mine doit toucher ces rochers.'][A.S.ter[A.selTile]]}</p>`;
      return;
    }
    const st = (A.S.pop ?? 0) < 30;
    el.innerHTML = `<h2>Premiers pas</h2><p>${st ? "Prolongez la route qui part du port, posez des huttes de part et d'autre et un puits. Ajoutez ensuite un champ de blé, un grenier et un marché, le tout relié par des chemins." : 'Sélectionnez <b>Observer</b> puis cliquez sur une maison pour savoir ce qui lui manque pour grandir.'}</p>`;
    return;
  }
  const d = B[b.type];
  if (b.type === 'hut') {
    renderHouse(el, b as HouseStock);
    return;
  }
  let h = `<h2>${d.n}</h2><p class="muted">${d.d}</p>`;
  if (d.jobs)
    h += `<div class="row"><span class="muted">Employés</span><span>${b.wk || 0} / ${d.jobs}</span></div><div class="bar"><i style="width:${((b.wk || 0) / d.jobs) * 100}%"></i></div><p class="muted">Secteur « ${SECT[PRIO[b.type]].toLowerCase()} », servi ${['en premier', 'en deuxième', 'en troisième', 'en quatrième', 'en dernier'][PRIO[b.type]]}.</p>`;
  if (b.status)
    h += `<div><span class="chip ${/Aucun|Personne|attente|vides|hors|Pas relié|Plein/i.test(b.status) ? 'warn' : 'good'}">${esc(b.status)}</span></div>`;
  if (d.mon) {
    const pr = monProg(b);
    h +=
      `<div class="row"><span class="muted">${b.done ? 'Achevé' : 'Avancement du chantier'}</span><span>${Math.round(pr * 100)} %</span></div><div class="bar"><i style="width:${pr * 100}%"></i></div>` +
      (b.done
        ? ''
        : Object.keys(d.mon)
            .map(r => `<div class="row"><span>${RES[r].n}</span><span>${(b.got && b.got[r]) || 0} / ${d.mon![r]}</span></div>`)
            .join(''));
  }
  if (d.out) {
    h += `<div class="row"><span class="muted">Production (${d.batch} ${RES[d.out].n.toLowerCase()})</span><span>${Math.round(((b.prog ?? 0) / d.time!) * 100)} %</span></div><div class="bar"><i style="width:${Math.min(100, ((b.prog ?? 0) / d.time!) * 100)}%"></i></div>`;
  }
  if (d.store) {
    h +=
      `<div class="row"><span class="muted">Rempli</span><span>${used(b)} / ${d.cap}</span></div>` +
      d.store.map(r => `<div class="row"><span>${RES[r].n}</span><span>${Math.floor(b.stock[r] || 0)}</span></div>`).join('');
  }
  el.innerHTML = h;
}

/** Fiche d'une maison : habitants, réserves, et ce qui lui manque pour grandir. */
function renderHouse(el: HTMLElement, b: HouseStock): void {
  const a = hasOf(b);
  const cap = LV[b.lvl].cap;
  const needs: [string, boolean, number][] = [
    ["Eau d'un puits proche", a.water, 2],
    ['Nourriture livrée par le marché', a.food, 2],
    ["Visite d'un druide", a.relig, 3],
    ['Cervoise', a.cerv, 3],
    ['Blé et porc', a.types2, 4],
    ["Chants d'un barde", a.ent, 4],
    ['Torques', a.torq, 4],
  ];
  const show = needs.filter(n => n[2] <= Math.min(4, b.lvl + 1));
  el.innerHTML = `<h2>${LV[b.lvl].n}</h2>
      <div class="row"><span class="muted">Habitants</span><span>${b.pop} / ${cap}</span></div><div class="row"><span class="muted">Tribut en attente</span><span>${Math.floor(b.owed || 0)} st.</span></div>${b.inc ? `<div class="row"><span class="muted">En chemin</span><span>${b.inc}</span></div>` : ''}
      <h3>Réserves de la maison</h3>
      <div class="res"><span>Blé</span><span>${Math.floor(b.food.ble)}</span><span>Porc</span><span>${Math.floor(b.food.porc)}</span><span>Cervoise</span><span>${Math.floor(b.cerv)}</span><span>Torques</span><span>${b.torq.toFixed(1)}</span></div>
      ${b.pop === 0 && !b.inc ? '<p class="muted">Parcelle libre. Elle doit être reliée par un chemin à l\'entrée du village.</p>' : ''}
      <h3>${b.lvl < 4 ? 'Pour devenir ' + LV[b.lvl + 1]!.n.toLowerCase() : 'Pour rester demeure noble'}</h3>
      ${show.map(n => `<div class="need ${n[1] ? 'y' : 'n'}"><span class="m">${n[1] ? '✓' : '✗'}</span><span>${n[0]}</span></div>`).join('')}
      ${b.bad ? '<span class="chip warn">Risque de déclin le mois prochain</span>' : ''}`;
}

function renderObj(): void {
  $('objList').innerHTML =
    (A.S.won ? '<div class="win">Victoire : le conseil des druides vous a proclamé vergobret. Vous pouvez continuer à bâtir.</div>' : '') +
    OBJ.map(o => {
      const ok = o[1]();
      return `<div class="obj ${ok ? 'y' : ''}"><span class="m">${ok ? '✓' : '·'}</span><span style="flex:1">${o[0]}</span><span class="muted">${o[2]()}</span></div>`;
    }).join('');
}
function renderLog(): void {
  $('log').innerHTML = A.S.logs.map(l => `<div><em>${esc(l.m)}</em>${esc(l.t)}</div>`).join('');
}
function renderLabor(): void {
  const sc: [number, number][] = A.S.sect || [
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ];
  const jobs = A.S.jobs ?? 0,
    unemp = A.S.unemp ?? 0;
  const miss = jobs - (A.S.emp || 0);
  let h = `<div class="row"><span class="muted">Habitants</span><span>${A.S.pop}</span></div><div class="row"><span class="muted">Travailleurs (la moitié)</span><span>${A.S.labor}</span></div><div class="row"><span class="muted">Postes ouverts</span><span>${A.S.jobs}</span></div>`;
  sc.forEach(([a, b], k) => {
    if (b)
      h += `<div class="row"><span>${SECT[k]}</span><span>${a} / ${b}</span></div><div class="bar"><i style="width:${(a / b) * 100}%;background:${a < b ? 'var(--bad)' : 'var(--ok)'}"></i></div>`;
  });
  h +=
    miss > 0
      ? `<span class="chip warn">Il manque ${miss} travailleurs, soit environ ${miss * 2} habitants</span>`
      : unemp > 0
        ? `<span class="chip">${unemp} sans travail : vous pouvez ouvrir des bâtiments</span>`
        : jobs
          ? '<span class="chip good">Tous les postes sont pourvus</span>'
          : '';
  $('laborBody').innerHTML = h;
}
function renderTax(): void {
  const lv = A.S.taxLvl ?? 1;
  buttons('#taxBtns button').forEach(b => press(b, +b.dataset.t! === lv));
  const owed = taxPending(A.S);
  const chief = blds().some(b => b.type === 'chief' && (b.wk ?? 0) > 0);
  $('taxBody').innerHTML =
    `<div class="row"><span class="muted">Dû chaque mois</span><span>${Math.round(taxDue())} st.</span></div><div class="row"><span class="muted">En attente dans les maisons</span><span>${Math.round(owed)} st.</span></div>` +
    (chief ? '' : '<span class="chip warn">Sans maison du chef, personne ne collecte</span>') +
    `<p class="muted" style="font-size:12.5px">Chaque maison accumule son tribut ; le collecteur ramasse tout à son passage. ${['Léger : les familles arrivent plus nombreuses.', 'Normal : aucun effet sur les arrivées.', 'Lourd : les familles hésitent à venir.'][lv]}</p>`;
}
buttons('#taxBtns button').forEach(
  b =>
    (b.onclick = () => {
      A.S.taxLvl = +b.dataset.t! as 0 | 1 | 2;
      renderTax();
    }),
);
/** Barre du haut et panneau de droite, mis à jour quelques fois par seconde. */
function renderStats(): void {
  const bal = A.S.lastBal ?? 0;
  $('sMoney').innerHTML = `${Math.floor(A.S.money)} <small>${bal >= 0 ? '+' : ''}${Math.round(bal)}/mois</small>`;
  let p = 0;
  for (const b of blds()) if (b.type === 'hut') p += (b as House).pop;
  $('sPop').innerHTML = p + (A.S.block ? ` <small>· arrivées freinées : ${A.S.block}</small>` : '');
  const fd = Math.floor(stockOf('ble') + stockOf('porc'));
  $('sFood').innerHTML = `${fd} <small>${A.S.cons ? '−' + A.S.cons + '/mois' : ''}</small>`;
  const emp = A.S.emp ?? 0,
    jobs = A.S.jobs ?? 0,
    unemp = A.S.unemp ?? 0;
  $('sLabor').innerHTML =
    `${emp} / ${jobs}${jobs > emp ? ` <small>manque ${jobs - emp}</small>` : unemp > 0 ? ` <small>${unemp} sans travail</small>` : ''}`;
  renderLabor();
  renderViews();
  $('sFavor').textContent = Math.round(A.S.favor) + ' %';
  renderGods();
  renderDef();
  renderTax();
  $('sDate').textContent = dateTxt();
  $<HTMLButtonElement>('festBtn').disabled = A.S.money < 200;
}

/** Légende de la vue de couverture active, mise à jour seulement quand elle change. */
function renderViews(): void {
  const k = ovKind();
  const key = k + '|' + A.view;
  if (key === A.lastOv) return;
  A.lastOv = key;
  buttons('.vb button').forEach(b => press(b, b.dataset.v === (A.view === 'none' && k ? k : A.view)));
  const n = $('viewNote');
  if (!k) {
    n.hidden = true;
    return;
  }
  const o = OV[k];
  n.hidden = false;
  n.innerHTML = `<b>Vue ${o.n.toLowerCase()}</b> · ${o.d}${k !== 'water' ? ' Contour : zone que le marcheur du bâtiment sélectionné peut atteindre.' : ''}<br><span class="dot" style="background:#86b86a"></span>${o.ok} · <span class="dot" style="background:#de6a4e"></span>maison qui en manque`;
}
buttons('.vb button').forEach(
  b =>
    (b.onclick = () => {
      A.view = b.dataset.v!;
      A.lastOv = '';
    }),
);

const GODS: ['favor' | keyof GameState['gf'], string, string][] = [
  ['favor', 'Toutatis', 'Nemetons et druides. Plus elle est haute, plus vos guerriers sont vaillants.'],
  ['taranis', 'Taranis', 'Temple de Taranis. Au-dessus de 60 %, la foudre frappe les pillards.'],
  ['belenos', 'Bélénos', 'Temple de Bélénos. Au-dessus de 70 %, moissons abondantes.'],
  ['epona', 'Épona', "Temple d'Épona. Au-dessus de 70 %, plus d'arrivées et ventes mieux payées."],
];
function renderGods(): void {
  $('godList').innerHTML = GODS.map(([k, n, d]) => {
    const v = Math.round(k === 'favor' ? A.S.favor : A.S.gf[k]);
    const c = v < 25 ? 'var(--bad)' : v >= 70 ? 'var(--ok)' : 'var(--bronze)';
    return `<div><div class="row"><span><b>${n}</b></span><span>${v} %</span></div><div class="bar"><i style="width:${v}%;background:${c}"></i></div><p class="muted" style="font-size:12.5px;margin-top:3px">${d}</p></div>`;
  }).join('');
}
function renderDef(): void {
  const war = A.S.u.filter(u => u.k === 'warrior').length,
    en = A.S.u.filter(u => u.k === 'enemy').length,
    tw = blds().filter(b => b.type === 'tower').length;
  let walls = 0;
  for (let i = 0; i < N * N; i++) if (A.S.wall[i]) walls++;
  let next: string;
  if (A.S.raids === false) next = 'Raids désactivés';
  else if (en) next = `<span class="chip warn">${en} pillards dans l'oppidum</span>`;
  else if ((A.S.pop ?? 0) < 40) next = 'Aucun raid tant que le village compte moins de 40 habitants.';
  else {
    const m = Math.max(0, (A.S.raidNext ?? A.S.mi + 12) - A.S.mi);
    next = A.S.raidWarn ? '<span class="chip warn">Raid annoncé pour le mois prochain</span>' : `Prochain raid dans environ ${m} mois.`;
  }
  $('defBody').innerHTML =
    `<div class="row"><span class="muted">Guerriers</span><span>${war}</span></div><div class="row"><span class="muted">Tours de guet</span><span>${tw}</span></div><div class="row"><span class="muted">Cases de rempart</span><span>${walls}</span></div><div>${next}</div>`;
  const rb = $('raidBtn'),
    on = A.S.raids !== false;
  press(rb, on);
  rb.textContent = 'Raids de pillards : ' + (on ? 'activés' : 'désactivés');
}
$('raidBtn').onclick = () => {
  A.S.raids = A.S.raids === false;
  if (A.S.raids === false) {
    A.S.u = A.S.u.filter(u => u.k !== 'enemy');
    A.S.raid = 0;
    A.S.raidWarn = 0;
  } else A.S.raidNext = A.S.mi + 12;
  renderDef();
  save();
};
function renderWrath(): void {
  const on = A.S.wrath !== false;
  const b = $('wrathBtn');
  press(b, on);
  b.textContent = 'Foudre de Taranis : ' + (on ? 'activée' : 'désactivée');
  $('favNote').textContent = on
    ? 'Si la faveur de Toutatis tombe sous 15 %, Taranis peut foudroyer un bâtiment. Une fête élève tous les dieux de 15 points.'
    : 'La foudre sur vos bâtiments est désactivée. Une fête élève tous les dieux de 15 points.';
}
$('wrathBtn').onclick = () => {
  A.S.wrath = A.S.wrath === false;
  renderWrath();
  save();
};
$('festBtn').onclick = () => {
  if (!festival(A.S)) return;
  log("Grande fête : sacrifices et banquet en l'honneur des dieux du clan.");
  renderGods();
};
buttons('.speed [data-s]').forEach(b => (b.onclick = () => setSpeed(+b.dataset.s!)));
/** Nouvelle partie en deux clics, pour éviter de tout perdre par mégarde. */
let confirmT: ReturnType<typeof setTimeout> | undefined;

$('infoBtn').onclick = () => setPanel($('panel').dataset.open !== 'true');
$('newBtn').onclick = () => {
  const b = $('newBtn');
  if (b.dataset.c !== '1') {
    b.dataset.c = '1';
    b.textContent = 'Confirmer : tout recommencer';
    clearTimeout(confirmT);
    confirmT = setTimeout(() => {
      b.dataset.c = '';
      b.textContent = 'Nouvelle partie';
    }, 3000);
    return;
  }
  b.dataset.c = '';
  b.textContent = 'Nouvelle partie';
  const wr = A.S.wrath;
  newGame((Math.random() * 1e9) | 0);
  A.S.wrath = wr;
  staff();
  renderWrath();
  A.sel = null;
  A.selTile = -1;
  A.dirtySel = A.dirtyLog = A.dirtyObj = true;
  renderTrade();
  save();
};

export { buildToolbar, buildTrade, renderLog, renderObj, renderSel, renderStats, renderWrath, setPanel, setSpeed, setTool };
