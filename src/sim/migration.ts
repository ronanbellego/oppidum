/**
 * Arrivée des familles : par le port, un groupe se rend vers une maison qui a de la place.
 * La faim, le chômage ou un tribut lourd freinent les arrivées ; Épona satisfaite et un tribut léger les augmentent.
 */
import { idx } from '../core/hex';
import type { GameState } from '../core/state';
import { BAL } from '../core/constants';
import { LV } from '../data/houses';
import { roadSearch } from './paths';
import { access, houses, monumentDone } from './query';
import { spawnWalker, type WalkerCtx } from './walkers';

/** Groupes de migrants en route au plus. */
export const MAX_GROUPS = 10;

/** Case par laquelle arrivent les familles. */
export const entryOf = (s: GameState): number => s.entry ?? idx(0, 24);

/** Tente de faire venir un groupe. Renvoie la raison d'un refus, ou une chaîne vide. */
export function immigrate(s: GameState, ctx: WalkerCtx): string {
  if (s.w.filter(w => w.k === 'immigrant').length >= MAX_GROUPS) return (s.block as string) ?? '';
  const pop = s.pop ?? 0, labor = s.labor ?? 0, unemp = s.unemp ?? 0;
  if (pop > 20 && ((s.hungry as number) ?? 0) > 0.6 && ctx.rand() < 0.5) return (s.block = 'la faim ralentit les arrivées');
  if (!monumentDone(s, 'tumulus') && labor > 10 && unemp > Math.max(8, labor * 0.3)) return (s.block = 'trop de bras sans travail');
  if (s.taxLvl === 2 && ctx.rand() < 0.4) return (s.block = 'le tribut lourd décourage les familles');
  s.block = '';
  const open = houses(s).filter(h => LV[h.lvl]!.cap - h.pop - h.inc > 0);
  if (!open.length) return '';
  const h = open[(ctx.rand() * open.length) | 0];
  const set = access(s, h);
  if (!set.length) return '';
  const r = roadSearch(s, entryOf(s), i => set.includes(i));
  if (!r) return '';
  const size = BAL.immigrantGroup + (s.gf.epona > 70 ? 1 : 0) + (s.taxLvl === 0 ? 1 : 0);
  const n = Math.min(size, LV[h.lvl]!.cap - h.pop - h.inc);
  h.inc += n;
  spawnWalker(s, { k: 'immigrant', home: 0, target: h.id, amt: n, path: r.path, cur: 0, nxt: 0, t: 0 }, ctx);
  return '';
}
