// Découpe l'ancien fichier unique en modules : données, grille hexagonale, hasard, styles, page,
// et un module « legacy » qui contient tout le reste en attendant d'être découpé à son tour.
import * as acorn from 'acorn';
import fs from 'fs';
import path from 'path';

const [, , srcFile, outDir] = process.argv;
const html = fs.readFileSync(srcFile, 'utf8');
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1].trim();
const head = html.slice(0, html.indexOf('<style>'));
const body = html.slice(html.indexOf('</style>') + 8, html.indexOf('<script>')).trim();
let js = html.match(/<script>([\s\S]*)<\/script>/)[1];

// retirer l'enveloppe (()=>{ "use strict"; ... })();
js = js.replace(/^\s*\(\(\)=>\{\s*\n?"use strict";\s*\n?/, '').replace(/\}\)\(\);\s*$/, '');

// scinder les déclarations groupées dont une partie part dans un module et l'autre reste
js = js.replace('const HW=56,TILT=.62,SQ3=Math.sqrt(3),HR=1/SQ3,ZW=-10;', 'const HW=56,TILT=.62,ZW=-10;\nconst SQ3=Math.sqrt(3),HR=1/SQ3;');

const ast = acorn.parse(js, { ecmaVersion: 2022, sourceType: 'module' });
const stmts = ast.body;
const declNames = st => st.type === 'FunctionDeclaration' ? [st.id.name]
  : st.type === 'VariableDeclaration' ? st.declarations.map(d => d.id.name) : [];

const MODULES = {
  'core/constants.ts': ['N', 'MONTH', 'WS', 'MAXSTEP', 'BAL'],
  'core/rng.ts': ['rng', 'hashS'],
  'core/hex.ts': ['idx', 'X', 'Y', 'inb', 'SQ3', 'HR', 'HX', 'HY', 'cube', 'fromCube', 'hdist', 'DIRS', 'nbDir', 'NBC', 'nb4', 'EDGE_DIR', 'corner', 'foot', 'hexRound', 'within'],
  'data/calendar.ts': ['MONTHS'],
  'data/resources.ts': ['RES'],
  'data/houses.ts': ['LV'],
  'data/buildings.ts': ['B', 'GODC', 'TOOLS'],
  'data/labor.ts': ['PRIO', 'SUB', 'SECT'],
  'data/palette.ts': ['WALK', 'TCOL', 'INK', 'AC'],
};
const owner = {};
for (const [f, names] of Object.entries(MODULES)) for (const n of names) owner[n] = f;

const taken = {};          // fichier -> [texte]
const removeRanges = [];
for (const st of stmts) {
  const names = declNames(st);
  if (!names.length) continue;
  const files = new Set(names.map(n => owner[n]).filter(Boolean));
  if (!files.size) continue;
  if (files.size > 1 || names.some(n => !owner[n])) throw new Error('déclaration mixte : ' + names.join(','));
  const f = [...files][0];
  (taken[f] = taken[f] || []).push(js.slice(st.start, st.end));
  removeRanges.push([st.start, st.end]);
}
for (const [a, b] of removeRanges.sort((p, q) => q[0] - p[0])) js = js.slice(0, a) + js.slice(b);

// dépendances entre modules extraits
const deps = {
  'core/hex.ts': { 'core/constants.ts': ['N'] },
  'data/buildings.ts': {},
};
const rel = (from, to) => { let r = path.relative(path.dirname(from), to).replace(/\.ts$/, ''); return r.startsWith('.') ? r : './' + r; };
const write = (f, txt) => { const p = path.join(outDir, 'src', f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, txt); };

for (const [f, parts] of Object.entries(taken)) {
  const imports = Object.entries(deps[f] || {}).map(([m, ns]) => `import { ${ns.join(', ')} } from '${rel(f, m)}';`).join('\n');
  const exportsLine = `export { ${MODULES[f].join(', ')} };`;
  write(f, `// @ts-nocheck — extrait tel quel de la version mono-fichier ; à typer progressivement.\n${imports ? imports + '\n' : ''}\n${parts.join('\n')}\n\n${exportsLine}\n`);
}

// le reste du jeu, en module, avec ses imports
const imp = Object.entries(MODULES).map(([f, ns]) => `import { ${ns.join(', ')} } from '${rel('legacy/game.ts', f)}';`).join('\n');
write('legacy/game.ts', `// @ts-nocheck — reste de la version mono-fichier, découpé module par module dans les étapes suivantes.\n${imp}\n\n${js.trim()}\n`);
write('styles/app.css', css + '\n');
write('main.ts', `import './styles/app.css';\nimport './legacy/game';\n`);

const page = head.replace(/\s*$/, '\n') + body + '\n<script type="module" src="/src/main.ts"></script>\n';
fs.writeFileSync(path.join(outDir, 'index.html'), '<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
  page.replace(/<div id="app">/, '</head>\n<body>\n<div id="app">') + '</body>\n</html>\n');
console.log('modules :', Object.keys(taken).join(', '));
console.log('legacy :', js.split('\n').length, 'lignes');
