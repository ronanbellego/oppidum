/**
 * Génération complète d'une île à partir d'une graine. Fonction pure : la même graine donne toujours
 * la même île, ce qui permet de la tester et de la recalculer pour reprendre une ancienne sauvegarde.
 */
import { N } from '../core/constants';
import { idx, X, Y, foot, type Cell } from '../core/hex';
import { rng } from '../core/rng';
import { shapeIsland, keepMainIsland, spreadHeath } from './island';
import { raiseRelief } from './relief';
import { findPortSite, clearAround, findDock, layRoad, PORT_SIZE } from './port';
import { placeLandmarks } from './landmarks';
import { seaDepth } from './terrain';

export interface World {
  seed: number;
  ter: Uint8Array;
  vr: Float32Array;
  lnd: Uint8Array;
  hgt: Uint8Array;
  road: Uint8Array;
  deco: Uint8Array;
  /** Port à poser au démarrage : case d'ancrage et emprise, ou null si aucune côte ne convient. */
  port: { x: number; y: number; tiles: Cell[] } | null;
  /** Case d'eau où accostent les navires. */
  dock: Cell;
  /** Départ de la route, par où arrivent les familles. */
  entry: Cell;
  /** Case sur laquelle centrer la caméra au début. */
  focus: Cell;
  /** Sites anciens, dans l'ordre menhir, dolmen, chêne. */
  landmarks: Cell[];
}

export function generateWorld(seed: number): World {
  // L'ordre des étapes fixe l'ordre des tirages : le changer donnerait d'autres îles pour les mêmes graines.
  const rand = rng(seed);
  const { ter, vr, mass } = shapeIsland(rand);
  keepMainIsland(ter, rand);
  const lnd = spreadHeath(ter, mass, rand);
  const portCell = findPortSite(ter, rand);
  if (portCell >= 0) clearAround(portCell, ter, lnd);
  const hgt = raiseRelief(ter, mass, portCell, rand);

  const road = new Uint8Array(N * N);
  let port: World['port'] = null, dock = -1, entry = -1, focus = idx(N >> 1, N >> 1);
  if (portCell >= 0) {
    const tiles = foot(PORT_SIZE, X(portCell), Y(portCell))!;
    const depth = seaDepth(ter);
    const inPort = new Set(tiles);
    for (const t of tiles) hgt[t] = hgt[portCell];
    dock = findDock(tiles, ter, depth);
    entry = layRoad(tiles, ter, road, i => inPort.has(i));
    if (entry >= 0) focus = entry;
    port = { x: X(portCell), y: Y(portCell), tiles };
  }
  const occupied = (i: Cell) => !!port && port.tiles.includes(i);
  const { deco, sites } = placeLandmarks({ ter, lnd, hgt, road, occupied, focus }, rand);
  return { seed, ter, vr, lnd, hgt, road, deco, port, dock, entry, focus, landmarks: sites };
}
