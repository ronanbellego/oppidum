/**
 * Générateur décoratif à graine (congruentiel linéaire). Sert aux dessins et à la génération de carte,
 * où l'on veut le même résultat pour une même graine sans dépendre de l'état de la partie.
 */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Empreinte FNV-1a d'une chaîne, pour dériver une graine stable d'une clé. */
export function hashS(str: string): number {
  let h = 2166136261;
  for (let k = 0; k < str.length; k++) {
    h ^= str.charCodeAt(k);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Pas du générateur de la simulation (mulberry32). Son état tient dans un entier stocké dans la partie :
 * une partie sauvegardée puis rechargée tire exactement les mêmes nombres.
 */
export function nextRandom(seedState: number): [value: number, next: number] {
  const next = (seedState + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}
