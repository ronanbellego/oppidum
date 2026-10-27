/**
 * La boucle de simulation : un pas, puis, tous les MONTH pas, la fin du mois.
 * L'ordre des systèmes fait partie des règles du jeu : le changer change l'issue des parties.
 */
import { MONTH } from '../core/constants';
import type { GameState } from '../core/state';
import { B } from '../data/buildings';
import { buildingStep } from './buildings';
import type { SimCtx } from './context';
import { repairWalls, raidMonth, stepUnits } from './defense';
import { templesMonth, toutatisMonth, HARVEST } from './gods';
import { housingMonth } from './housing';
import { assignLabor, payWages } from './labor';
import { immigrate } from './migration';
import { checkVictory } from './objectives';
import { buildings } from './query';
import { tradeMonth } from './trade';
import { stepWalker } from './walkers';
import { MONTHS } from '../data/calendar';

/** Fréquences, en pas, des systèmes qui ne tournent pas à chaque pas. */
export const EVERY = { labor: 10, immigration: 15, wallRepair: 50 } as const;
/** Trésor au-dessus duquel le message « trésor vide » peut réapparaître. */
export const UNPAID_RESET = 50;

export interface TickHooks {
  /** Appelé après chaque fin de mois (sauvegarde, rafraîchissement des objectifs). */
  onMonth?(s: GameState): void;
}

/** Date de jeu lisible : mois du calendrier de Coligny et année avant ou après notre ère. */
export function dateLabel(mi: number): string {
  const y = 80 - Math.floor(mi / 12);
  return MONTHS[mi % 12] + ', ' + (y > 0 ? `an ${y} av. J.-C.` : `an ${1 - y}`);
}

/** Un pas de simulation. */
export function simStep(s: GameState, ctx: SimCtx, hooks: TickHooks = {}): void {
  s.tick++;
  for (const b of buildings(s)) buildingStep(s, b, ctx);
  for (const w of s.w) if (!w.dead) stepWalker(s, w, ctx);
  stepUnits(s, ctx);
  if (s.tick % EVERY.wallRepair === 0) repairWalls(s);
  s.w = s.w.filter(w => !w.dead);
  if (s.tick % EVERY.labor === 0) assignLabor(s);
  if (s.tick % EVERY.immigration === 0) immigrate(s, ctx);
  if (s.tick % MONTH === 0) {
    monthEnd(s, ctx);
    hooks.onMonth?.(s);
  }
}

/** Fin du mois : salaires, maisons, dieux, raids, commerce, bilan, objectifs. */
export function monthEnd(s: GameState, ctx: SimCtx): void {
  assignLabor(s);
  const { due, paid } = payWages(s);
  if (paid < due && !s.flags.unpaid) {
    s.flags.unpaid = 1;
    ctx.log('Le trésor est vide : les ouvriers travaillent à crédit en attendant le tribut.');
  }
  if (s.money > UNPAID_RESET) s.flags.unpaid = 0;

  const hr = housingMonth(s, ctx.rand);
  for (const e of hr.events)
    ctx.log(e.level === 3 ? "Première longue maison : le village prend de l'importance." : "Une famille noble s'installe dans une demeure digne d'elle.");
  s.hungry = hr.occupied ? hr.hungry / hr.occupied : 0;

  const hit = toutatisMonth(s, hr.covered, hr.occupied, ctx.rand);
  if (hit != null) {
    ctx.log(`Taranis lance la foudre : ${B[s.b[hit].type].n.toLowerCase()} réduit en cendres. Honorez Toutatis.`);
    ctx.removeBuilding(hit);
  }
  if (templesMonth(s, ctx.rand)) ctx.log(`Bélénos fait mûrir les blés : ${HARVEST.wheat} blé de plus au grenier.`);
  raidMonth(s, ctx);

  const gain = tradeMonth(s);
  if (gain > 0) {
    ctx.log(`Un navire marchand venu de l'île de Bretagne repart chargé : ${Math.round(gain)} statères encaissés.`);
    if (s.dock != null && s.dock >= 0) ctx.fx({ k: 'ship', d: s.dock, t: 300 });
  }

  const taxM = s.taxM ?? 0;
  s.lastTaxM = taxM;
  const bal = taxM + gain - paid;
  s.lastBal = s.balAvg == null ? bal : (s.balAvg as number) * 0.6 + bal * 0.4;
  s.balAvg = s.lastBal;
  s.taxM = 0;

  s.mi++;
  if (s.mi % 12 === 0) ctx.log(`Samonios : une nouvelle année commence. Le clan compte ${s.pop ?? 0} âmes.`);
  if (checkVictory(s)) ctx.log("Le conseil des druides vous proclame vergobret de l'oppidum. Victoire !");
}
