/**
 * Ce que la simulation demande au reste du jeu, sans le connaître : tirer au hasard, écrire dans la chronique,
 * signaler un effet visuel, retirer un bâtiment. Les tests fournissent une version minimale.
 */
import type { Walker } from '../core/state';

export type Effect =
  | { k: 'fire'; x: number; y: number; t: number }
  | { k: 'arrow'; x0: number; y0: number; x1: number; y1: number; t: number }
  | { k: 'bolt'; x: number; y: number; t: number }
  | { k: 'raider' | 'ship'; d: number; t: number };

export interface SimCtx {
  rand(): number;
  log(msg: string): void;
  toast(msg: string): void;
  fx(e: Effect): void;
  /** Retire un bâtiment du village (incendie, foudre, démolition). */
  removeBuilding(id: number): void;
  onVisit?(w: Walker): void;
}

/** Contexte silencieux, pour les tests. */
export function quietCtx(rand: () => number = () => 0.5, journal: string[] = []): SimCtx & { journal: string[]; effects: Effect[] } {
  const effects: Effect[] = [];
  return {
    rand, journal, effects,
    log: m => journal.push(m),
    toast: () => {},
    fx: e => effects.push(e),
    removeBuilding: () => {},
  };
}
