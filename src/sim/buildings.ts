/**
 * Un pas pour un bâtiment : il se répare hors des raids, puis agit selon sa nature
 * (chantier, défense, atelier, départ en tournée, dépôt, port).
 */
import type { Building, GameState, Walker } from '../core/state';
import { B } from '../data/buildings';
import type { SimCtx } from './context';
import { defenseStep } from './defense';
import { assignLabor } from './labor';
import { monumentStep } from './monuments';
import { workshopStep } from './production';
import { access, jobsOf } from './query';
import { findDepot, fillMarketBasket, used } from './stock';
import { spawnWalker } from './walkers';

/** Réparation par pas d'un bâtiment endommagé, et attente d'une marchande sans rien à vendre. */
export const REPAIR = 0.05;
export const EMPTY_MARKET_WAIT = 20;

/** Envoie un porteur vers un dépôt ; si aucun n'a de place, l'atelier se bloque et rend ses ouvriers. */
export function sendCart(s: GameState, b: Building, acc: number[], ctx: SimCtx): void {
  const res = B[b.type].out!;
  const best = findDepot(s, acc, res);
  if (!best) {
    if (!b.stuck) {
      b.stuck = true;
      assignLabor(s);
    }
    b.status = res === 'ble' || res === 'porc'
      ? 'Grenier plein ou non relié : les ouvriers sont envoyés ailleurs'
      : 'Entrepôt plein ou non relié : les ouvriers sont envoyés ailleurs';
    return;
  }
  if (b.stuck) {
    b.stuck = false;
    assignLabor(s);
  }
  spawnWalker(s, { k: 'cart', home: b.id, target: best.val, res, amt: b.hold, path: best.path, cur: 0, nxt: 0, t: 0 }, ctx);
  b.hold = 0;
  b.cartOut = true;
  b.status = 'Livraison en cours';
}

export function buildingStep(s: GameState, b: Building, ctx: SimCtx): void {
  const d = B[b.type];
  if (b.hp != null && b.hp < b.maxhp && !s.raid) b.hp = Math.min(b.maxhp, b.hp + REPAIR);
  if (b.type === 'hut' || b.type === 'well') return;
  const acc = access(s, b);
  if (!acc.length) {
    b.status = 'Aucun chemin ne touche ce bâtiment';
    return;
  }
  const jobs = jobsOf(b), ef = jobs ? (b.wk ?? 0) / jobs : 1;
  if (d.mon) return monumentStep(s, b, ef, ctx);
  if (b.type === 'tower' || b.type === 'barracks') return defenseStep(s, b, acc, ef, ctx);
  if (d.out) {
    if (workshopStep(s, b, ef)) sendCart(s, b, acc, ctx);
    return;
  }
  if (d.roam) {
    if (b.out) {
      b.status = 'Marcheur en tournée';
      return;
    }
    if (ef <= 0) {
      b.status = "Personne pour y travailler : il faut plus d'habitants";
      return;
    }
    b.cool = ((b.cool as number) ?? 0) - ef;
    b.status = 'Prépare la prochaine tournée';
    if ((b.cool as number) > 0) return;
    const w: Walker = { k: (b.type === 'market' ? 'market' : d.roam) as Walker['k'], home: b.id, god: d.god, start: acc[(ctx.rand() * acc.length) | 0], cur: 0, nxt: 0, t: 0 };
    if (w.k === 'market') {
      const c = fillMarketBasket(s);
      if (!c) {
        b.status = 'Greniers vides : rien à vendre';
        b.cool = EMPTY_MARKET_WAIT;
        return;
      }
      w.carry = c;
    }
    b.out = true;
    spawnWalker(s, w, ctx);
    return;
  }
  if (d.store) {
    b.status = used(b) >= d.cap! ? 'Plein' : 'En service';
    return;
  }
  if (b.type === 'port') b.status = (b.wk ?? 0) > 0 ? 'Les navires marchands accostent chaque mois' : 'Personne pour décharger les navires';
  else if (b.type === 'trade') b.status = s.tradeOK ? 'Les marchands passent chaque mois' : "Pas relié au chemin d'entrée";
}
