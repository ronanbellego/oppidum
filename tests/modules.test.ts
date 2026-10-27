/** L'affichage et l'interface ne sont pas encore typés : on vérifie au moins que chaque module se compile. */
import { it, expect } from 'vitest';
import { transformSync } from 'esbuild';
import fs from 'fs';
import path from 'path';

const dirs = ['app', 'render', 'ui'];
const files = dirs.flatMap(d => fs.readdirSync(new URL(`../src/${d}/`, import.meta.url)).map(f => path.join(d, f)));

it.each(files)('src/%s se compile', f => {
  const code = fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
  expect(() => transformSync(code, { loader: 'ts', format: 'esm' })).not.toThrow();
});
