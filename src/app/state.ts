/**
 * État de l'affichage et de l'interface partagé entre plusieurs modules : partie en cours, caméra,
 * outil, sélection, contexte de dessin. Les modules ne pouvant pas réassigner une variable importée,
 * ces valeurs vivent dans un objet unique. Les caches propres à un module restent dans ce module.
 */
import type { Camera, GameState } from '../core/state';
import type { Cell } from '../core/hex';
import type { LocalFrame } from '../render/types';
import { ctx } from './dom';

/** Tracé en cours à la souris : chemin, rempart ou zone à raser, depuis la case a. */
export interface Drag {
  mode: 'road' | 'wall' | 'demolish';
  a: Cell;
}

export interface AppState {
  /** Partie en cours. */
  S: GameState;
  cam: Camera;
  /** Densité de pixels et taille de la zone de jeu en pixels CSS. */
  dpr: number;
  cw: number;
  ch: number;
  /** Outil choisi dans la barre du bas (« inspect » pour observer). */
  tool: string;
  /** Bâtiment sélectionné, et case cliquée. */
  sel: number | null;
  selTile: Cell;
  /** Case survolée, -1 hors de la carte. */
  hover: Cell;
  drag: Drag | null;
  /** Vitesse du jeu : 0 en pause, 1, 2 ou 4. */
  speed: number;
  /** Vue de couverture forcée par le joueur ('none' : selon l'outil ou la sélection). */
  view: string;
  /** Contexte de dessin courant : l'écran, ou un sprite en cours de préparation. */
  g: CanvasRenderingContext2D;
  /** Repère local du bâtiment en cours de dessin, null pour les coordonnées de la carte. */
  LOC: LocalFrame | null;
  /** Clé de la dernière vue affichée, pour ne mettre à jour la légende qu'au changement. */
  lastOv: string;
  /** Parties de l'interface à redessiner. */
  dirtySel: boolean;
  dirtyLog: boolean;
  dirtyObj: boolean;
}

export const A: AppState = {
  S: null as unknown as GameState, // posé par newGame ou load avant la première image
  cam: { x: 0, y: 0, z: 1 },
  dpr: 1,
  cw: 0,
  ch: 0,
  tool: 'inspect',
  sel: null,
  selTile: -1,
  hover: -1,
  drag: null,
  speed: 1,
  view: 'none',
  g: ctx,
  LOC: null,
  lastOv: '',
  dirtySel: true,
  dirtyLog: true,
  dirtyObj: true,
};
