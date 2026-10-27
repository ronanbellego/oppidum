/** Le reste du jeu n'est pas encore typé : on vérifie au moins qu'il se compile (pas de déclaration en double, etc.). */
import { it, expect } from 'vitest';
import { transformSync } from 'esbuild';
import fs from 'fs';

it('src/legacy/game.ts se compile', () => {
  const code = fs.readFileSync(new URL('../src/legacy/game.ts', import.meta.url), 'utf8');
  expect(() => transformSync(code, { loader: 'ts', format: 'esm' })).not.toThrow();
});
