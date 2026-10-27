/**
 * Défense : pillards débarqués par la mer, guerriers du clan, tours de guet et remparts.
 * Les déplacements hors chemins s'appuient sur des cartes de distances calculées sur toute l'île :
 * les pillards descendent vers les bâtiments, les guerriers vers les pillards.
 */
import { BAL, N } from '../core/constants';
import { HX, HY, hdist, idx, nb4, type Cell } from '../core/hex';
import type { Building, GameState, Unit } from '../core/state';
import { B } from '../data/buildings';
import { TER } from '../world/terrain';
import type { SimCtx } from './context';
import { entryOf } from './migration';
import { access, buildings, monumentDone, tilesOf } from './query';
import { stockOf, take } from './stock';
import { BLESSING } from './gods';

/* ---------- réglages ---------- */
export const ENEMY = { hp: 24, damage: 0.35, speed: 0.075, wallDamage: 1.4, loot: 8 } as const;
export const WARRIOR = { hp: 30, heroesHp: 40, damage: 0.45, heroesMult: 1.5, speed: 0.1, heal: 0.04, perBarracks: 6, ironCost: 2, trainTime: 80 } as const;
export const TOWER = { range: 4.5, damage: 5, reload: 12 } as const;
export const MELEE = 1.05;
/** Coût en distance d'une case de rempart pour les pillards (ils préfèrent un détour à un mur). */
export const WALL_COST = 12;
export const WALL_PRICE = { wall: 6, gate: 15 } as const;
/** Pillage du port : durée avant la fuite, butin emporté au plus. */
export const PORT_PILLAGE = { ticks: 180, maxLoot: 25 } as const;
/** Foudre de Taranis sur les pillards : intervalle en pas et dégâts. */
export const TARANIS_STRIKE = { every: 40, damage: 20 } as const;

/** Cartes de distances, recalculées à la demande et invalidées quand la carte change. */
export const fields: { fe: Float32Array | null; fw: Float32Array | null } = { fe: null, fw: null };
export function resetFields(): void {
  fields.fe = null;
  fields.fw = null;
}

/* ---------- passages et distances ---------- */

/** Une case que peut traverser un pillard (les remparts se franchissent en les abattant). */
export function passE(s: GameState, i: Cell): boolean {
  const t = s.ter[i];
  if (t === TER.rocks || s.occ[i]) return false;
  if (t === TER.sea && !s.road[i]) return false;
  return true;
}
/** Une case que peut traverser un guerrier : comme un pillard, mais il passe par les portes et pas par les murs. */
export const passW = (s: GameState, i: Cell): boolean => passE(s, i) && s.wall[i] !== 1;

/** Distances depuis des sources, avec un coût par case (négatif = infranchissable). */
export function distanceField(src: Cell[], cost: (i: Cell) => number): Float32Array {
  const D = new Float32Array(N * N).fill(1e9);
  const buckets: Cell[][] = [];
  const push = (i: Cell, d: number) => (buckets[d] ??= []).push(i);
  for (const i of src) if (D[i] > 0) {
    D[i] = 0;
    push(i, 0);
  }
  for (let d = 0; d < buckets.length; d++) {
    const q = buckets[d];
    if (!q) continue;
    for (let k = 0; k < q.length; k++) {
      const i = q[k];
      if (D[i] !== d) continue;
      for (const j of nb4(i)) {
        const c = cost(j);
        if (c < 0) continue;
        const nd = d + c;
        if (nd < D[j]) {
          D[j] = nd;
          push(j, nd);
        }
      }
    }
  }
  return D;
}

/** Distance de chaque case au bâtiment le plus proche, pour un pillard. */
export function enemyField(s: GameState): Float32Array {
  const src: Cell[] = [];
  for (const b of buildings(s)) for (const t of tilesOf(b)) for (const j of nb4(t)) if (passE(s, j) && !s.wall[j]) src.push(j);
  return distanceField(src, j => (passE(s, j) ? (s.wall[j] ? WALL_COST : s.ter[j] === TER.forest ? 2 : 1) : -1));
}

/** Distance de chaque case au pillard le plus proche, pour un guerrier. */
export function warriorField(s: GameState): Float32Array {
  return distanceField(s.u.filter(u => u.k === 'enemy').map(u => u.cur), j => (passW(s, j) ? (s.ter[j] === TER.forest ? 2 : 1) : -1));
}

function gridPath(s: GameState, start: Cell, goal: (i: Cell) => boolean): Cell[] | null {
  const prev = new Int32Array(N * N).fill(-2);
  prev[start] = -1;
  const q = [start];
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    if (goal(i)) {
      const p: Cell[] = [];
      for (let k = i; k !== -1; k = prev[k]) p.push(k);
      return p.reverse();
    }
    for (const j of nb4(i)) if (prev[j] === -2 && passW(s, j)) {
      prev[j] = i;
      q.push(j);
    }
  }
  return null;
}

/* ---------- combattants ---------- */

export function placeUnit(u: Unit): void {
  u.px = HX(u.cur) + (HX(u.nxt) - HX(u.cur)) * u.t;
  u.py = HY(u.cur) + (HY(u.nxt) - HY(u.cur)) * u.t;
}

export function spawnUnit(s: GameState, k: Unit['k'], at: Cell, ctx: SimCtx, home = 0): Unit {
  const max = k === 'enemy' ? ENEMY.hp : monumentDone(s, 'heroes') ? WARRIOR.heroesHp : WARRIOR.hp;
  const u: Unit = { k, cur: at, nxt: at, t: 0, hp: max, max, home, px: 0, py: 0, ox: (ctx.rand() - 0.5) * 0.5, oy: (ctx.rand() - 0.5) * 0.5 };
  placeUnit(u);
  s.u.push(u);
  return u;
}

function nearest(s: GameState, k: Unit['k'], u: Unit, r: number): Unit | null {
  let best: Unit | null = null, bd = r;
  for (const v of s.u) {
    if (v.k !== k || v.dead) continue;
    const d = Math.hypot(v.px - u.px, v.py - u.py);
    if (d < bd) {
      bd = d;
      best = v;
    }
  }
  return best;
}

export function hurt(s: GameState, u: Unit, dmg: number): void {
  if (u.dead) return;
  u.hp -= dmg;
  if (u.hp <= 0) {
    u.dead = true;
    if (u.k === 'enemy') s.loot = ((s.loot as number) ?? 0) + ENEMY.loot;
    else s.fallen = ((s.fallen as number) ?? 0) + 1;
  }
}

/** Dégâts d'un guerrier : plus forts avec le sanctuaire des héros et la faveur de Toutatis. */
export const warriorDamage = (s: GameState): number => WARRIOR.damage * (monumentDone(s, 'heroes') ? WARRIOR.heroesMult : 1) * (0.8 + (0.4 * s.favor) / 100);

function stepEnemy(s: GameState, u: Unit, ctx: SimCtx): void {
  const foe = nearest(s, 'warrior', u, MELEE);
  if (foe) return hurt(s, foe, ENEMY.damage);
  if (u.nxt === u.cur) {
    if (u.bT) {
      const b = s.b[u.bT];
      if (b) {
        b.hp -= ENEMY.damage;
        if (b.type === 'port') {
          b.hp = Math.max(5, b.hp);
          u.pill = (u.pill ?? 0) + 1;
          if (u.pill > PORT_PILLAGE.ticks) {
            const l = Math.min(Math.floor(s.money), PORT_PILLAGE.maxLoot);
            s.money -= l;
            u.dead = true;
            u.fled = 1;
            if (!s.flags.pillMsg) {
              s.flags.pillMsg = 1;
              ctx.log(`Des pillards ont mis le port à sac et repris la mer avec ${l} statères.`);
            }
          }
          return;
        }
        if (b.hp <= 0) {
          const t = tilesOf(b);
          ctx.fx({ k: 'fire', x: t.reduce((a, i) => a + HX(i), 0) / t.length, y: t.reduce((a, i) => a + HY(i), 0) / t.length, t: 90 });
          ctx.log(`Les pillards ont incendié : ${B[b.type].n.toLowerCase()}.`);
          ctx.removeBuilding(b.id);
          fields.fe = null;
          u.bT = 0;
        }
        return;
      }
      u.bT = 0;
    }
    if (u.wallT != null) {
      if (s.wall[u.wallT]) {
        s.whp[u.wallT] -= ENEMY.damage * ENEMY.wallDamage;
        if (s.whp[u.wallT] <= 0) {
          const gate = s.wall[u.wallT] === 2;
          s.wall[u.wallT] = 0;
          fields.fe = null;
          if (!s.breach) {
            s.breach = 1;
            ctx.log(gate ? 'Les pillards ont enfoncé une porte !' : 'Les pillards ont ouvert une brèche dans le rempart !');
          }
        }
        return;
      }
      u.wallT = null;
    }
    const fe = (fields.fe ??= enemyField(s));
    const i = u.cur;
    for (const j of nb4(i)) {
      const id = s.occ[j];
      if (id && s.b[id]) {
        u.bT = id;
        return;
      }
    }
    let best = -1, bd = fe[i];
    for (const j of nb4(i)) {
      if (!passE(s, j)) continue;
      if (fe[j] < bd) {
        bd = fe[j];
        best = j;
      }
    }
    if (best < 0) return;
    if (s.wall[best]) {
      u.wallT = best;
      return;
    }
    u.nxt = best;
  }
  u.t += ENEMY.speed * (s.ter[u.nxt] === TER.forest ? 0.6 : 1);
  if (u.t >= 1) {
    u.cur = u.nxt;
    u.t = 0;
  }
}

function stepWarrior(s: GameState, u: Unit): void {
  const foe = nearest(s, 'enemy', u, MELEE);
  if (foe) return hurt(s, foe, warriorDamage(s));
  const raid = s.u.some(v => v.k === 'enemy');
  if (!raid && u.hp < u.max) u.hp = Math.min(u.max, u.hp + WARRIOR.heal);
  if (u.nxt === u.cur) {
    if (raid) {
      u.path = null;
      const fw = (fields.fw ??= warriorField(s));
      const i = u.cur;
      let best = -1, bd = fw[i];
      for (const j of nb4(i)) {
        if (!passW(s, j)) continue;
        if (fw[j] < bd) {
          bd = fw[j];
          best = j;
        }
      }
      if (best < 0) return;
      u.nxt = best;
    } else {
      const h = s.b[u.home];
      if (!h) return;
      if (!u.path) {
        const acc = access(s, h);
        if (!acc.length || acc.includes(u.cur) || hdist(u.cur, idx(h.x, h.y)) <= 2) return;
        u.path = gridPath(s, u.cur, i => acc.includes(i));
        u.pi = 0;
        if (!u.path) return;
      }
      u.pi = (u.pi ?? 0) + 1;
      if (u.pi >= u.path.length) {
        u.path = null;
        return;
      }
      const j = u.path[u.pi];
      if (!passW(s, j)) {
        u.path = null;
        return;
      }
      u.nxt = j;
    }
  }
  u.t += WARRIOR.speed * (s.ter[u.nxt] === TER.forest ? 0.6 : 1);
  if (u.t >= 1) {
    u.cur = u.nxt;
    u.t = 0;
  }
}

/** Un pas pour tous les combattants, puis la fin du raid si plus aucun pillard ne reste. */
export function stepUnits(s: GameState, ctx: SimCtx): void {
  if (!s.u.length && !s.raid) return;
  const anyEnemy = s.u.some(u => u.k === 'enemy');
  if (anyEnemy) {
    if (s.tick % 20 === 0) fields.fe = null;
    if (s.tick % 12 === 0) fields.fw = null;
  }
  for (const u of s.u) {
    if (u.dead) continue;
    if (u.k === 'enemy') stepEnemy(s, u, ctx);
    else stepWarrior(s, u);
    placeUnit(u);
  }
  if (anyEnemy && s.gf.taranis > BLESSING.taranisStrikes && s.tick % TARANIS_STRIKE.every === 0) {
    const es = s.u.filter(u => u.k === 'enemy' && !u.dead);
    if (es.length) {
      const e = es[(ctx.rand() * es.length) | 0];
      hurt(s, e, TARANIS_STRIKE.damage);
      ctx.fx({ k: 'bolt', x: e.px, y: e.py, t: 12 });
    }
  }
  s.u = s.u.filter(u => !u.dead);
  if (s.raid && !s.u.some(u => u.k === 'enemy')) {
    s.flags.pillMsg = 0;
    s.raid = 0;
    const l = (s.loot as number) ?? 0;
    s.money += l;
    s.loot = 0;
    s.flags.raidWon = 1;
    s.breach = 0;
    fields.fw = null;
    const fallen = (s.fallen as number) ?? 0;
    ctx.log(`Les pillards sont repoussés.${l ? ` Leurs armes et leurs bijoux rapportent ${l} statères.` : ''}${fallen ? ` ${fallen} guerrier(s) sont tombés.` : ''}`);
    s.fallen = 0;
    ctx.toast('Raid repoussé');
  }
}

/* ---------- raids ---------- */

/** Côtes où des pillards peuvent débarquer : au bord de l'eau, loin du port, avec un chemin vers le village. */
export function raidSources(s: GameState): Cell[] {
  const fe = (fields.fe = enemyField(s));
  const c: Cell[] = [];
  const port = s.entry ?? -1;
  for (let i = 0; i < N * N; i++) {
    if (s.ter[i] === TER.sea || !passE(s, i) || fe[i] >= 1e8) continue;
    if (!nb4(i).some(j => s.ter[j] === TER.sea && !s.road[j])) continue;
    if (port >= 0 && hdist(i, port) < 10) continue;
    c.push(i);
  }
  if (!c.length)
    for (let k = 0; k < N; k++)
      for (const i of [idx(k, 0), idx(k, N - 1), idx(0, k), idx(N - 1, k)]) if (fe[i] < 1e8 && i !== entryOf(s) && !c.includes(i)) c.push(i);
  return c;
}

/** Côté de l'île d'une case, pour les messages. */
export function sideOf(i: Cell): string {
  const d = ((Math.atan2(HY(i) - N * 0.433, HX(i) - N / 2) * 180) / Math.PI + 360) % 360;
  return d < 45 || d >= 315 ? "l'est" : d < 135 ? 'le sud' : d < 225 ? "l'ouest" : 'le nord';
}

export function startRaid(s: GameState, ctx: SimCtx): boolean {
  const c = raidSources(s);
  if (!c.length) return false;
  const from = s.raidFrom != null && c.includes(s.raidFrom as number) ? (s.raidFrom as number) : c[(ctx.rand() * c.length) | 0];
  c.sort((a, b) => hdist(a, from) - hdist(b, from));
  const n = Math.min(14, 3 + Math.floor((s.pop ?? 0) / 30));
  for (let k = 0; k < n; k++) spawnUnit(s, 'enemy', c[k % Math.min(c.length, 5)], ctx);
  s.raid = 1;
  s.breach = 0;
  s.fallen = 0;
  const wj = nb4(from).find(j => s.ter[j] === TER.sea);
  if (wj != null) ctx.fx({ k: 'raider', d: wj, t: 420 });
  ctx.log(`${n} pillards débarquent sur la côte, par ${sideOf(from)} de l'île. Aux armes !`);
  ctx.toast('Les pillards attaquent !');
  return true;
}

/** Calendrier des raids : annonce un mois à l'avance, puis débarquement. */
export function raidMonth(s: GameState, ctx: SimCtx): void {
  if (s.raids === false || (s.pop ?? 0) < BAL.raidMinPop) return;
  if (s.raidNext == null) s.raidNext = s.mi + 12;
  const next = s.raidNext as number;
  if (!s.raidWarn && s.mi >= next - 1 && !s.raid) {
    const c = raidSources(s);
    if (c.length) {
      s.raidFrom = c[(ctx.rand() * c.length) | 0];
      s.raidWarn = 1;
      ctx.log(`Les guetteurs aperçoivent des voiles pillardes au large, côté ${sideOf(s.raidFrom as number).replace(/^(le |l')/, '')}. Elles aborderont le mois prochain.`);
    }
  }
  if (s.mi >= next && !s.raid) {
    startRaid(s, ctx);
    s.raidNext = s.mi + 16 + ((ctx.rand() * 8) | 0);
    s.raidWarn = 0;
  }
}

/* ---------- remparts et bâtiments de défense ---------- */

/** Élève un rempart le long des cases données ; sur un chemin, il devient une porte. */
export function buildWall(s: GameState, cells: Cell[], ctx: SimCtx): void {
  let blocked = false;
  for (const i of cells) {
    if (s.occ[i] || s.wall[i] || s.deco[i]) continue;
    const gate = !!s.road[i];
    const c = gate ? WALL_PRICE.gate : WALL_PRICE.wall;
    if (!gate && s.ter[i] !== TER.prairie) {
      blocked = true;
      continue;
    }
    if (s.money < c) {
      ctx.toast('Pas assez de statères');
      break;
    }
    s.money -= c;
    s.wall[i] = gate ? 2 : 1;
    s.whp[i] = 100;
  }
  if (blocked) ctx.toast("Le rempart ne s'élève que sur la prairie ou sur un chemin");
  fields.fe = null;
}

/** Les remparts endommagés se réparent peu à peu hors des raids. */
export function repairWalls(s: GameState): void {
  if (s.raid) return;
  for (let i = 0; i < N * N; i++) if (s.wall[i] && s.whp[i] < 100) s.whp[i] = Math.min(100, s.whp[i] + 5);
}

/** Tour de guet et caserne. acc : cases de chemin qui desservent le bâtiment ; ef : part des postes pourvus. */
export function defenseStep(s: GameState, b: Building, acc: Cell[], ef: number, ctx: SimCtx): void {
  if (b.type === 'tower') {
    if (ef <= 0) {
      b.status = "Personne pour y travailler : il faut plus d'habitants";
      return;
    }
    b.cool = ((b.cool as number) ?? 0) - 1;
    if ((b.cool as number) > 0) return;
    b.cool = TOWER.reload;
    const t = tilesOf(b), cx = t.reduce((a, i) => a + HX(i), 0) / t.length, cy = t.reduce((a, i) => a + HY(i), 0) / t.length;
    let best: Unit | null = null, bd: number = TOWER.range;
    for (const u of s.u) {
      if (u.k !== 'enemy' || u.dead) continue;
      const d = Math.hypot(u.px - cx, u.py - cy);
      if (d < bd) {
        bd = d;
        best = u;
      }
    }
    if (best) {
      hurt(s, best, TOWER.damage * ef);
      ctx.fx({ k: 'arrow', x0: cx, y0: cy, x1: best.px, y1: best.py, t: 6 });
      b.status = 'Tire sur les pillards';
    } else b.status = "Guette l'horizon";
    return;
  }
  if (b.type === 'barracks') {
    const mine = s.u.filter(u => u.k === 'warrior' && u.home === b.id).length;
    if (ef <= 0) {
      b.status = `${mine} guerrier(s) · personne pour les entraîner`;
      return;
    }
    if (mine >= WARRIOR.perBarracks) {
      b.status = `${WARRIOR.perBarracks} guerriers prêts au combat`;
      return;
    }
    if (stockOf(s, 'fer') < WARRIOR.ironCost) {
      b.status = `${mine} guerrier(s) · en attente de fer à l'entrepôt`;
      return;
    }
    b.status = `${mine} guerrier(s) · entraînement en cours`;
    b.prog = (b.prog ?? 0) + ef;
    if (b.prog >= WARRIOR.trainTime) {
      b.prog = 0;
      take(s, 'fer', WARRIOR.ironCost);
      spawnUnit(s, 'warrior', acc[(ctx.rand() * acc.length) | 0], ctx, b.id);
      if (!s.flags.w1) {
        s.flags.w1 = 1;
        ctx.log('Le premier guerrier du clan a reçu ses armes.');
      }
    }
  }
}
