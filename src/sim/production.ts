/**
 * Ateliers : un bâtiment qui produit (champ, porcherie, bûcheron, carrière, mine, brasserie, forge)
 * avance au rythme de ses ouvriers, charge ses matières premières au début de chaque lot,
 * puis attend qu'un porteur emporte le lot vers un dépôt.
 */
import type { Building, GameState } from '../core/state';
import { B } from '../data/buildings';
import { RES } from '../data/resources';
import { nearTerrain } from './query';
import { stockOf, take } from './stock';
import { TER } from '../world/terrain';

/** Distance de la ressource naturelle requise : forêt à 2 hexagones, rochers au contact. */
export const NEAR_RANGE = { forest: 2, rock: 1 } as const;
/** Un porteur bloqué retente sa livraison tous les RETRY_TICKS pas. */
export const RETRY_TICKS = 10;

export const isWorkshop = (b: Building): boolean => !!B[b.type].out;

/**
 * Un pas de production. ef est la part des postes pourvus (de 0 à 1).
 * Renvoie vrai quand un porteur doit partir livrer le lot en attente.
 */
export function workshopStep(s: GameState, b: Building, ef: number): boolean {
  const d = B[b.type];
  if (d.near && !nearTerrain(s, b, d.near === 'forest' ? TER.forest : TER.rocks, NEAR_RANGE[d.near])) {
    b.status = 'Ressource naturelle hors de portée';
    return false;
  }
  if ((b.hold ?? 0) > 0) return !b.cartOut && s.tick % RETRY_TICKS === 0;
  if (d.inp && !b.loaded) {
    const miss = Object.keys(d.inp).filter(r => stockOf(s, r) < d.inp![r]);
    if (miss.length) {
      b.status = 'En attente de ' + miss.map(r => RES[r].n.toLowerCase()).join(' et ');
      return false;
    }
    for (const r in d.inp) take(s, r, d.inp[r]);
    b.loaded = true;
  }
  if (ef <= 0) {
    b.status = "Personne pour y travailler : il faut plus d'habitants";
    return false;
  }
  b.status = ef < 0.99 ? 'Travaille au ralenti, faute de bras' : 'Au travail';
  b.prog = (b.prog ?? 0) + ef;
  if (b.prog >= d.time!) {
    b.prog = 0;
    b.hold = d.batch;
    b.loaded = false;
    return true;
  }
  return false;
}
