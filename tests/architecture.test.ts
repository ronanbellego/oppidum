/**
 * Sens des dépendances entre dossiers : la simulation ne connaît ni l'écran ni la page, et seule
 * l'interface (et le point d'entrée) dépend de l'interface. Voir « Règles d'architecture » dans le README.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SRC = new URL('../src/', import.meta.url).pathname;

/** Dossiers que chaque dossier n'a pas le droit d'importer. */
const FORBIDDEN: Record<string, string[]> = {
  core: ['data', 'world', 'sim', 'app', 'render', 'ui'],
  data: ['world', 'sim', 'app', 'render', 'ui'],
  world: ['sim', 'app', 'render', 'ui'],
  sim: ['app', 'render', 'ui'],
  render: ['ui'],
  app: ['ui'],
};

function importsOf(file: string): string[] {
  const code = fs.readFileSync(file, 'utf8');
  return [...code.matchAll(/^import[^'"]*['"]([^'"]+)['"]/gm)].map(m => m[1]).filter(s => s.startsWith('.'));
}

describe('sens des dépendances', () => {
  for (const [dir, banned] of Object.entries(FORBIDDEN)) {
    const files = fs.readdirSync(path.join(SRC, dir)).filter(f => f.endsWith('.ts'));
    it.each(files)(`${dir}/%s n'importe pas ${banned.join(', ')}`, f => {
      const file = path.join(SRC, dir, f);
      const targets = importsOf(file).map(s => path.relative(SRC, path.resolve(path.dirname(file), s)).split(path.sep)[0]);
      expect(targets.filter(t => banned.includes(t))).toEqual([]);
    });
  }
});
