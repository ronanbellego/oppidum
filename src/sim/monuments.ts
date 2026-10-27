/**
 * Monuments : un chantier puise ses matériaux un par un dans les dépôts, au rythme de ses ouvriers,
 * jusqu'à ce que tout soit livré. Achevé, il n'emploie plus personne et accorde son bienfait.
 */
import type { Building, GameState } from '../core/state';
import { B } from '../data/buildings';
import { RES } from '../data/resources';
import type { SimCtx } from './context';
import { assignLabor } from './labor';
import { stockOf, take } from './stock';

/** Pas entre deux livraisons à plein effectif, et solidité d'un monument achevé. */
export const DELIVERY_EVERY = 5;
export const MONUMENT_HP = 400;

export const MONUMENT_DONE: Record<string, string> = {
  menhirs: "L'alignement de menhirs est dressé. Les dieux contemplent l'oppidum avec bienveillance.",
  tumulus: 'Le tumulus royal est achevé. Les ancêtres veillent : le tribut rentre mieux et les familles affluent.',
  heroes: 'Le sanctuaire des héros est consacré. Les guerriers se battent désormais avec la force de leurs ancêtres.',
};

/** Avancement d'un chantier, de 0 à 1. */
export function progress(b: Building): number {
  const need = B[b.type].mon!;
  let got = 0, total = 0;
  for (const r in need) {
    total += need[r];
    got += Math.min(need[r], b.got?.[r] ?? 0);
  }
  return total ? got / total : 1;
}

export function monumentStep(s: GameState, b: Building, ef: number, ctx: SimCtx): void {
  const need = B[b.type].mon!;
  if (b.done) {
    b.status = 'Achevé';
    return;
  }
  if (ef <= 0) {
    b.status = "Chantier à l'arrêt : il faut plus d'habitants";
    return;
  }
  b.cool = ((b.cool as number) ?? 0) - ef;
  if ((b.cool as number) > 0) return;
  b.cool = DELIVERY_EVERY;
  b.got ??= {};
  const missing = Object.keys(need).filter(r => (b.got![r] ?? 0) < need[r]);
  if (!missing.length) {
    b.done = true;
    b.hp = b.maxhp = MONUMENT_HP;
    ctx.log(MONUMENT_DONE[b.type]);
    ctx.toast(B[b.type].n + ' achevé');
    assignLabor(s);
    return;
  }
  const available = missing.filter(r => stockOf(s, r) >= 1);
  if (!available.length) {
    b.status = 'Chantier arrêté : il manque ' + missing.map(r => RES[r].n.toLowerCase()).join(', ') + " à l'entrepôt";
    return;
  }
  const r = available[(ctx.rand() * available.length) | 0];
  take(s, r, 1);
  b.got[r] = (b.got[r] ?? 0) + 1;
  b.status = 'Chantier en cours';
}
