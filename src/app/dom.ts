/** Accès à la page : éléments par identifiant, canevas du jeu et son contexte. */

/** Élément de la page ; il doit exister (index.html les déclare tous). */
export function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`élément #${id} absent de la page`);
  return el as T;
}

export const cv = $<HTMLCanvasElement>('cv');
export const ctx = cv.getContext('2d')!;
