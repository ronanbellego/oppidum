/** Le port de départ : son emplacement, son quai et la route qui part vers l'intérieur. */
import { N } from '../core/constants';
import { X, Y, HX, HY, nb4, foot, within, hexRound, fromCube, hexLine, type Cell } from '../core/hex';
import { TER, CENTER_X, CENTER_Y } from './terrain';

/** Taille d'emprise du port (trois hexagones). */
export const PORT_SIZE = 2;
/** Longueur de la route tracée depuis le port, en hexagones. */
export const ROAD_LENGTH = 6;

/**
 * Cherche une côte bien en vue, de préférence au sud-ouest de l'île : l'emprise du port doit être
 * entièrement sur la terre et toucher la mer. Renvoie la case d'ancrage, ou -1.
 */
export function findPortSite(ter: Uint8Array, rand: () => number): Cell {
  let port = -1, best = -1e9;
  for (let i = 0; i < N * N; i++) {
    if (ter[i] === TER.sea) continue;
    const ft = foot(PORT_SIZE, X(i), Y(i));
    if (!ft || ft.some(t => ter[t] === TER.sea)) continue;
    if (!ft.some(t => nb4(t).some(j => ter[j] === TER.sea))) continue;
    const dx = HX(i) - CENTER_X, dy = HY(i) - CENTER_Y;
    const score = dy * 0.9 - dx * 0.5 - Math.abs(Math.hypot(dx, dy) - N * 0.3) * 0.2 + rand() * 2;
    if (score > best) {
      best = score;
      port = i;
    }
  }
  return port;
}

/** Dégage la prairie autour du port : ni forêt, ni rochers, ni lande sur cinq hexagones. */
export function clearAround(port: Cell, ter: Uint8Array, lnd: Uint8Array): void {
  within(port, 5, j => {
    if (ter[j] !== TER.sea) {
      ter[j] = TER.prairie;
      lnd[j] = 0;
    }
  });
}

/** Case d'eau la plus profonde au contact de l'emprise, où accostent les navires. */
export function findDock(tiles: Cell[], ter: Uint8Array, depth: Uint8Array): Cell {
  let dock = -1;
  for (const t of tiles) for (const j of nb4(t)) if (ter[j] === TER.sea && (dock < 0 || depth[j] > depth[dock])) dock = j;
  return dock;
}

/**
 * Trace la route de départ : elle part de la case de terre voisine du port la plus proche du centre
 * et file vers l'intérieur. Modifie ter (la route défriche) et road. Renvoie la case d'entrée, ou -1.
 */
export function layRoad(tiles: Cell[], ter: Uint8Array, road: Uint8Array, occupied: (i: Cell) => boolean): Cell {
  let start = -1, best = 1e9;
  for (const t of tiles)
    for (const j of nb4(t))
      if (ter[j] !== TER.sea && !occupied(j)) {
        const d = Math.hypot(HX(j) - CENTER_X, HY(j) - CENTER_Y);
        if (d < best) {
          best = d;
          start = j;
        }
      }
  if (start < 0) return -1;
  const dx = CENTER_X - HX(start), dy = CENTER_Y - HY(start), n = Math.hypot(dx, dy) || 1;
  const tx = HX(start) + (dx / n) * ROAD_LENGTH, ty = HY(start) + (dy / n) * ROAD_LENGTH, rf = ty / 0.866;
  const [q, r] = hexRound(tx - rf / 2, rf);
  const target = fromCube(q, r);
  for (const j of hexLine(start, target >= 0 ? target : start)) {
    if (ter[j] === TER.sea || occupied(j)) break;
    ter[j] = TER.prairie;
    road[j] = 1;
  }
  return start;
}
