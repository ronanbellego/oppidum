/**
 * État d'une partie : tout ce qui doit être sauvegardé, et rien d'autre.
 * Les caches graphiques, les cartes de distances et les animations vivent ailleurs et se recalculent.
 */
import { N } from './constants';

/** Les grilles de la carte, une valeur par hexagone (N × N). */
export interface Grids {
  /** Terrain : 0 prairie, 1 forêt, 2 mer, 3 rochers. */
  ter: Uint8Array;
  /** Variation décorative propre à chaque case, entre 0 et 1. */
  vr: Float32Array;
  /** Lande (bruyère et ajonc) sur une case de prairie. */
  lnd: Uint8Array;
  /** Altitude, de 0 à 7. */
  hgt: Uint8Array;
  /** Chemin ou pont. */
  road: Uint8Array;
  /** Identifiant du bâtiment qui occupe la case, 0 si libre. */
  occ: Int32Array;
  /** Rempart : 0 aucun, 1 mur, 2 porte. */
  wall: Uint8Array;
  /** Solidité du rempart, de 0 à 100. */
  whp: Float32Array;
  /** Site ancien : 0 aucun, 1 grand menhir, 2 dolmen, 3 chêne des anciens. */
  deco: Uint8Array;
}

export type GridName = keyof Grids;

/** Type de tableau attendu pour chaque grille, utilisé à l'encodage et au contrôle des sauvegardes. */
export const GRID_TYPES = {
  ter: Uint8Array,
  vr: Float32Array,
  lnd: Uint8Array,
  hgt: Uint8Array,
  road: Uint8Array,
  occ: Int32Array,
  wall: Uint8Array,
  whp: Float32Array,
  deco: Uint8Array,
} as const satisfies Record<GridName, unknown>;

export const GRID_NAMES = Object.keys(GRID_TYPES) as GridName[];

export interface Building {
  id: number;
  type: string;
  x: number;
  y: number;
  /** Taille d'emprise : 1, 2 (trois hexagones) ou 3 (sept hexagones). */
  s: 1 | 2 | 3;
  hp: number;
  maxhp: number;
  /** Travailleurs affectés. */
  wk?: number;
  stock: Record<string, number>;
  /** Atelier dont la production ne trouve plus de place : ses ouvriers sont envoyés ailleurs. */
  stuck?: boolean;
  /** Monument achevé, et matériaux déjà livrés au chantier. */
  done?: boolean;
  got?: Record<string, number>;
  /** Avancement de la production en cours, lot prêt à livrer, porteur en route, matières premières chargées. */
  prog?: number;
  hold?: number;
  cartOut?: boolean;
  loaded?: boolean;
  /** État affiché dans la fiche du bâtiment. */
  status?: string;
  [extra: string]: unknown;
}

/** Une maison (type « hut »), quel que soit son niveau. */
export interface House extends Building {
  type: 'hut';
  pop: number;
  /** Habitants en route vers la maison. */
  inc: number;
  /** Niveau, de 1 (hutte) à 4 (demeure noble). */
  lvl: 1 | 2 | 3 | 4;
  /** Tribut accumulé, en attente du collecteur. */
  owed?: number;
  /** Mois du dernier passage du collecteur. */
  lastTax: number;
}

/** Personnage qui circule sur les chemins : marchande, druide, prêtre, barde, collecteur, porteur, migrant. */
export interface Walker {
  k: 'market' | 'druid' | 'priest' | 'bard' | 'tax' | 'cart' | 'immigrant';
  /** Case actuelle, case visée et avancement entre les deux (de 0 à 1). */
  cur: number;
  nxt: number;
  t: number;
  /** Bâtiment d'origine (0 pour un migrant). */
  home: number;
  prev?: number;
  /** Pas parcourus en tournée, cases et maisons déjà vues. */
  steps?: number;
  seen?: Record<string, number>;
  /** Trajet imposé (porteur, migrant, retour de tournée) et position sur ce trajet. */
  path?: number[];
  pi?: number;
  back?: boolean;
  start?: number;
  /** Destination, ressource et quantité transportées. */
  target?: number;
  res?: string;
  amt?: number;
  /** Panier de la marchande. */
  carry?: Record<string, number>;
  /** Dieu servi par un prêtre. */
  god?: string;
  dead?: boolean;
}

/** Combattant libre de ses mouvements (hors chemins) : pillard ou guerrier du clan. */
export interface Unit {
  k: 'enemy' | 'warrior';
  cur: number;
  nxt: number;
  t: number;
  hp: number;
  max: number;
  /** Caserne d'origine d'un guerrier. */
  home: number;
  /** Position dans le plan, tenue à jour pour les distances et l'affichage. */
  px: number;
  py: number;
  /** Petit décalage d'un guerrier au repos, pour qu'ils ne se superposent pas. */
  ox: number;
  oy: number;
  /** Cible du pillard : bâtiment ou case de rempart attaqués. */
  bT?: number;
  wallT?: number | null;
  /** Pas passés à piller le port. */
  pill?: number;
  fled?: number;
  /** Trajet de retour d'un guerrier. */
  path?: number[] | null;
  pi?: number;
  dead?: boolean;
}

export interface LogEntry {
  /** Date de jeu, déjà mise en forme. */
  m: string;
  t: string;
}

export interface GameState extends Grids {
  seed: number;
  /** État du générateur de hasard de la simulation. */
  rs: number;
  tick: number;
  /** Nombre de mois écoulés depuis le début de la partie. */
  mi: number;
  money: number;
  nid: number;
  b: Record<number, Building>;
  w: Walker[];
  u: Unit[];
  logs: LogEntry[];
  flags: Record<string, number | boolean>;
  favor: number;
  gf: { taranis: number; belenos: number; epona: number };
  sell: Record<string, boolean>;
  /** Case d'arrivée des familles (départ de la route du port). */
  entry?: number;
  /** Case d'eau où accostent les navires. */
  dock?: number;
  /** Compteur de modifications du relief, pour invalider les caches. */
  hver?: number;
  won: boolean;

  /* ---- statistiques recalculées par la simulation ---- */
  pop?: number;
  /** Rations consommées par mois. */
  cons?: number;
  /** Travailleurs disponibles, postes ouverts, employés, sans-emploi. */
  labor?: number;
  jobs?: number;
  emp?: number;
  unemp?: number;
  /** Part des postes pourvus. */
  eff?: number;
  /** Par secteur : [employés, postes]. */
  sect?: [number, number][];
  /** Tribut encaissé depuis le début du mois. */
  taxM?: number;

  /** Le port (ou un comptoir) est relié à l'entrée et peut recevoir les navires. */
  tradeOK?: boolean;
  /** Part des maisons affamées. */
  hungry?: number;

  /* ---- réglages du joueur ---- */
  /** Foudre de Taranis sur les bâtiments quand Toutatis est négligé (désactivable). */
  wrath?: boolean;
  /** Taux du tribut : 0 léger, 1 normal, 2 lourd. */
  taxLvl?: 0 | 1 | 2;
  /** Champs de simulation secondaires (statistiques du mois, réglages du joueur…), typés au fil du découpage. */
  [extra: string]: unknown;
}

/** Caméra sauvegardée avec la partie, pour la retrouver au même endroit. */
export interface Camera {
  x: number;
  y: number;
  z: number;
}

/** Crée des grilles vides de la bonne taille. */
export function emptyGrids(): Grids {
  const g = {} as Grids;
  for (const name of GRID_NAMES) (g as unknown as Record<string, unknown>)[name] = new GRID_TYPES[name](N * N);
  return g;
}
