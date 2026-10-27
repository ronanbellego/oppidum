/**
 * Sauvegarde versionnée. Une sauvegarde est une enveloppe JSON :
 *   { format: 'oppidum', version, savedAt, state, cam }
 * Les grilles y sont encodées en base64 pour rester compactes.
 * Chaque changement de format ajoute une migration au lieu de rendre les anciennes parties illisibles.
 */
import { N } from './constants';
import { GRID_NAMES, GRID_TYPES, type Camera, type GameState, type GridName } from './state';

export const SAVE_VERSION = 3;
const FORMAT = 'oppidum';

interface EncodedGrid {
  enc: 'b64';
  data: string;
}

export interface SaveEnvelope {
  format: typeof FORMAT;
  version: number;
  savedAt: string;
  state: Record<string, unknown>;
  cam?: Camera;
}

export type LoadResult =
  | { ok: true; state: GameState; cam?: Camera; migratedFrom?: number; missing: GridName[] }
  | { ok: false; reason: string };

/* ---------- encodage des grilles ---------- */

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  const step = 0x8000;
  for (let k = 0; k < bytes.length; k += step) bin += String.fromCharCode(...bytes.subarray(k, k + step));
  return btoa(bin);
}

function fromBase64(str: string): Uint8Array {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let k = 0; k < bin.length; k++) out[k] = bin.charCodeAt(k);
  return out;
}

function encodeGrid(arr: ArrayBufferView): EncodedGrid {
  return { enc: 'b64', data: toBase64(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength)) };
}

/** Accepte l'encodage base64 (version 3) comme les tableaux JSON des anciennes sauvegardes. */
function decodeGrid(name: GridName, raw: unknown): ArrayBufferView | null {
  const Ctor = GRID_TYPES[name];
  let out: ArrayBufferView;
  if (raw && typeof raw === 'object' && (raw as EncodedGrid).enc === 'b64') {
    const bytes = fromBase64((raw as EncodedGrid).data);
    if (bytes.byteLength % Ctor.BYTES_PER_ELEMENT) return null;
    out = new Ctor(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  } else if (Array.isArray(raw)) {
    out = Ctor.from(raw as number[]);
  } else return null;
  return (out as Uint8Array).length === N * N ? out : null;
}

/* ---------- écriture ---------- */

export function serialize(state: GameState, cam?: Camera): string {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(state)) out[k] = (GRID_NAMES as string[]).includes(k) ? encodeGrid(v as ArrayBufferView) : v;
  const env: SaveEnvelope = { format: FORMAT, version: SAVE_VERSION, savedAt: new Date().toISOString(), state: out, cam };
  return JSON.stringify(env);
}

/* ---------- migrations ---------- */

/** Chaque migration fait passer une sauvegarde brute de la version n à la version n + 1. */
const MIGRATIONS: Record<number, (raw: any) => any> = {
  /**
   * Version 2 : l'ancien format mono-fichier, { S: { v: 2, … }, cam }, grilles en tableaux JSON,
   * sans état de hasard. On l'emballe dans l'enveloppe et on initialise le hasard à partir de la graine.
   */
  2: raw => {
    const { v, ...state } = raw.S;
    void v;
    if (state.rs == null) state.rs = (state.seed | 0) ^ 0x5bd1e995;
    return { format: FORMAT, version: 3, savedAt: new Date(0).toISOString(), state, cam: raw.cam };
  },
};

/** Lit la version d'une sauvegarde brute, quel que soit son format. */
function versionOf(raw: any): number | null {
  if (raw && raw.format === FORMAT && Number.isInteger(raw.version)) return raw.version;
  if (raw && raw.S && Number.isInteger(raw.S.v)) return raw.S.v;
  return null;
}

/* ---------- lecture ---------- */

export function deserialize(text: string): LoadResult {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'La sauvegarde est illisible.' };
  }
  const from = versionOf(raw);
  if (from == null) return { ok: false, reason: "Ce n'est pas une sauvegarde d'Oppidum." };
  if (from > SAVE_VERSION) return { ok: false, reason: 'Cette sauvegarde vient d\'une version plus récente du jeu.' };
  if (from < 2) return { ok: false, reason: 'Cette sauvegarde date de la carte carrée et ne peut pas être reprise.' };

  for (let v = from; v < SAVE_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) return { ok: false, reason: `Aucune migration depuis la version ${v}.` };
    raw = step(raw);
  }

  const src = raw.state as Record<string, unknown>;
  if (!src || typeof src.seed !== 'number' || !src.b) return { ok: false, reason: 'La sauvegarde est incomplète.' };

  const state = { ...src } as GameState;
  const missing: GridName[] = [];
  for (const name of GRID_NAMES) {
    const grid = src[name] == null ? null : decodeGrid(name, src[name]);
    if (src[name] != null && !grid && name === 'ter') return { ok: false, reason: 'La carte de la sauvegarde est endommagée.' };
    if (!grid) {
      missing.push(name);
      (state as unknown as Record<string, unknown>)[name] = new GRID_TYPES[name](N * N);
    } else (state as unknown as Record<string, unknown>)[name] = grid;
  }
  if (missing.includes('ter')) return { ok: false, reason: 'La sauvegarde ne contient pas de carte.' };

  state.u ??= [];
  state.w ??= [];
  state.logs ??= [];
  state.flags ??= {};
  state.gf ??= { taranis: 35, belenos: 35, epona: 35 };
  state.rs ??= (state.seed | 0) ^ 0x5bd1e995;

  return { ok: true, state, cam: raw.cam, migratedFrom: from < SAVE_VERSION ? from : undefined, missing };
}
