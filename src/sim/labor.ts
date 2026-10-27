/**
 * Main-d'œuvre : une part fixe des habitants travaille, et les postes sont pourvus par ordre de priorité
 * (secteur, puis rang dans le secteur, puis ancienneté du bâtiment). Un bâtiment sans chemin ou bloqué
 * n'ouvre aucun poste.
 */
import { BAL } from '../core/constants';
import type { GameState } from '../core/state';
import { PRIO, SECT, SUB } from '../data/labor';
import { access, buildings, houses, jobsOf } from './query';

/** Rations mangées par mois pour une maison de pop habitants. */
export const rations = (pop: number): number => Math.ceil(pop / 4);

export function assignLabor(s: GameState): void {
  let pop = 0, cons = 0;
  for (const h of houses(s)) {
    pop += h.pop;
    cons += rations(h.pop);
  }
  s.pop = pop;
  s.cons = cons;
  s.labor = Math.floor(pop * BAL.laborShare);

  // un bâtiment qui n'ouvre plus de poste (monument achevé) rend ses ouvriers
  for (const b of buildings(s)) if (b.wk && !jobsOf(b)) b.wk = 0;
  const employers = buildings(s)
    .filter(b => jobsOf(b))
    .sort((a, b) => PRIO[a.type] - PRIO[b.type] || (SUB[a.type] ?? 3) - (SUB[b.type] ?? 3) || a.id - b.id);

  let left = s.labor, jobs = 0;
  const sect: [number, number][] = SECT.map(() => [0, 0]);
  for (const b of employers) {
    const j = jobsOf(b);
    if (!access(s, b).length || b.stuck) {
      b.wk = 0;
      continue;
    }
    jobs += j;
    const w = Math.min(j, left);
    b.wk = w;
    left -= w;
    sect[PRIO[b.type]][0] += w;
    sect[PRIO[b.type]][1] += j;
  }
  s.sect = sect;
  s.jobs = jobs;
  s.emp = s.labor - left;
  s.unemp = left;
  s.eff = jobs ? s.emp / jobs : 1;
}

/**
 * Paie les salaires du mois dans la limite du trésor : quand il est vide, les ouvriers travaillent
 * à crédit plutôt que de faire plonger le trésor sous zéro.
 */
export function payWages(s: GameState): { due: number; paid: number } {
  const due = (s.emp ?? 0) * BAL.wage;
  const paid = Math.min(due, Math.max(0, s.money));
  s.money -= paid;
  return { due, paid };
}
