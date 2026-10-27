/**
 * Vues de couverture : où passent les marchandes, druides, bardes et collecteurs, quelles maisons
 * ont ce qu'il leur faut, quelle zone le marcheur d'un bâtiment peut atteindre.
 */
import { MAXSTEP, N } from '../core/constants';
import type { Cell } from '../core/hex';
import type { Building, House, Walker } from '../core/state';
import { A } from '../app/state';
import { access, hasOf, roadNb } from '../app/game';

export type ViewKind = 'water' | 'market' | 'druid' | 'bard' | 'tax';
type WalkerView = Exclude<ViewKind, 'water'>;

/** Pas du dernier passage de chaque type de marcheur, case par case. Non sauvegardé. */
export const VIS = {} as Record<WalkerView, Int32Array>;

export function resetVis(): void {
  for (const k of ['market', 'druid', 'bard', 'tax'] as const) VIS[k] = new Int32Array(N * N).fill(-1e9);
}
resetVis();

/** Note le passage d'un marcheur (appelé par la simulation à chaque pas de tournée). */
export function markVis(w: Walker): void {
  const k = (w.k === 'priest' ? 'druid' : w.k) as WalkerView;
  if (VIS[k]) VIS[k][w.cur] = A.S.tick;
}

/** Nom, couleur (r,g,b), explication et légende de chaque vue. */
export const OV: Record<ViewKind, { n: string; c: string; d: string; ok: string }> = {
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

/** Vue affichée d'office quand on choisit cet outil ou qu'on sélectionne ce bâtiment. */
export const TOOLOV: Record<string, ViewKind> = {
  well: 'water',
  market: 'market',
  grove: 'druid',
  t_taranis: 'druid',
  t_belenos: 'druid',
  t_epona: 'druid',
  bard: 'bard',
  chief: 'tax',
};

/** Vue active : celle choisie par le joueur, sinon celle de l'outil, sinon celle du bâtiment sélectionné. */
export function ovKind(): ViewKind | null {
  if (A.view !== 'none') return A.view as ViewKind;
  if (TOOLOV[A.tool]) return TOOLOV[A.tool];
  const b = A.sel && A.S.b[A.sel];
  return (b && TOOLOV[b.type]) || null;
}

/** La maison a-t-elle ce que montre la vue k ? */
export function houseOK(h: House, k: ViewKind): boolean {
  if (k === 'tax') return A.S.mi - h.lastTax <= 2;
  const a = hasOf(h);
  return !!(k === 'water' ? a.water : k === 'market' ? a.food : k === 'druid' ? a.relig : a.ent);
}

/** Dernière zone atteignable calculée, gardée quelques pas pour ne pas la refaire à chaque image. */
let reachC: { id: number; t: number; set: Set<Cell> | null } = { id: 0, t: -99, set: null };

/** Cases de chemin que le marcheur d'un bâtiment peut atteindre dans sa tournée. */
export function reachOf(b: Building): Set<Cell> {
  if (reachC.id === b.id && A.S.tick - reachC.t < 30) return reachC.set!;
  const set = new Set<Cell>();
  const dist = new Map<Cell, number>();
  const q: Cell[] = [];
  for (const a of access(b)) {
    dist.set(a, 0);
    q.push(a);
  }
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    set.add(i);
    const d = dist.get(i)!;
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
