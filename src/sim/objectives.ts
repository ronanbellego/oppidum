/** Objectifs de la partie : tous atteints, le conseil des druides proclame le joueur vergobret. */
import type { GameState } from '../core/state';
import { houses, monumentDone } from './query';

export interface Objective {
  label: string;
  done(s: GameState): boolean;
  progress(s: GameState): string;
}

const housesAtLeast = (s: GameState, lvl: number) => houses(s).filter(h => h.lvl >= lvl && h.pop > 0).length;
const MONUMENTS = ['menhirs', 'tumulus', 'heroes'];

export const OBJECTIVES: Objective[] = [
  { label: 'Atteindre 150 habitants', done: s => (s.pop ?? 0) >= 150, progress: s => `${s.pop ?? 0} / 150` },
  { label: 'Trois longues maisons', done: s => housesAtLeast(s, 3) >= 3, progress: s => `${housesAtLeast(s, 3)} / 3` },
  { label: 'Une demeure noble', done: s => housesAtLeast(s, 4) >= 1, progress: s => `${housesAtLeast(s, 4)} / 1` },
  { label: 'Achever un monument', done: s => MONUMENTS.some(m => monumentDone(s, m)), progress: s => `${MONUMENTS.filter(m => monumentDone(s, m)).length} / 1` },
  {
    label: 'Repousser un raid',
    done: s => !!s.flags.raidWon || s.raids === false,
    progress: s => (s.raids === false ? 'raids désactivés' : s.flags.raidWon ? 'fait' : 'à faire'),
  },
  { label: 'Trésor de 2 500 statères', done: s => s.money >= 2500, progress: s => `${Math.floor(s.money)} / 2500` },
];

/** Vrai la première fois que tous les objectifs sont atteints. */
export function checkVictory(s: GameState): boolean {
  if (s.won || !OBJECTIVES.every(o => o.done(s))) return false;
  s.won = true;
  return true;
}
