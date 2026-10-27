// Découpe src/legacy/game.ts (affichage et interface) en modules.
// 1. Les variables globales réassignées (let) deviennent des champs d'un objet partagé A (src/app/state.ts),
//    car un module ne peut pas réassigner une variable importée.
// 2. Chaque déclaration de premier niveau est rangée dans un module selon sa section ou une règle explicite.
// 3. Les imports et exports entre modules sont calculés par analyse de portée.
import * as acorn from 'acorn';
import * as eslintScope from 'eslint-scope';
import fs from 'fs';
import path from 'path';

const SRC = 'src/legacy/game.ts';
let code = fs.readFileSync(SRC, 'utf8').replace(/^\/\/ @ts-nocheck[^\n]*\n/, '');

const parse = c => acorn.parse(c, { ecmaVersion: 2022, sourceType: 'module', ranges: true });
let ast = parse(code);
let sm = eslintScope.analyze(ast, { ecmaVersion: 2022, sourceType: 'module' });
let mod = sm.scopes.find(s => s.type === 'module');

/* ---------- 1. variables partagées ---------- */
const MUT = mod.variables.filter(v => v.defs.some(d => d.type === 'Variable' && d.parent.kind === 'let')).map(v => v.name);
const inits = {};
const edits = []; // [start, end, text]
for (const st of ast.body) {
  if (st.type !== 'VariableDeclaration' || st.kind !== 'let') continue;
  for (const d of st.declarations) inits[d.id.name] = d.init ? code.slice(d.init.start, d.init.end) : 'undefined';
  edits.push([st.start, st.end, '']);
}
const shorthand = new Set();
walk(ast, (n, parent) => { if (parent && parent.type === 'Property' && parent.shorthand && parent.value === n) shorthand.add(n.start); });
for (const v of mod.variables) {
  if (!MUT.includes(v.name)) continue;
  for (const r of v.references) {
    const id = r.identifier;
    if (edits.some(([a, b]) => id.start >= a && id.end <= b)) continue; // dans la déclaration supprimée
    edits.push([id.start, id.end, shorthand.has(id.start) ? `${v.name}: A.${v.name}` : `A.${v.name}`]);
  }
}
edits.sort((a, b) => b[0] - a[0]);
for (const [a, b, t] of edits) code = code.slice(0, a) + t + code.slice(b);

function walk(node, fn, parent = null) {
  if (!node || typeof node.type !== 'string') return;
  fn(node, parent);
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (Array.isArray(v)) v.forEach(c => c && typeof c.type === 'string' && walk(c, fn, node));
    else if (v && typeof v.type === 'string' && k !== 'parent') walk(v, fn, node);
  }
}

/* ---------- 2. répartition ---------- */
ast = parse(code);
sm = eslintScope.analyze(ast, { ecmaVersion: 2022, sourceType: 'module' });
mod = sm.scopes.find(s => s.type === 'module');

const SECTIONS = [ // premier mot-clé de commentaire de section → module par défaut
  ['géométrie hexagonale', 'render/projection'],
  ['carte', 'app/game'],
  ['utilitaires', 'app/game'],
  ['construction', 'app/game'],
  ['marcheurs', 'app/game'],
  ['simulation', 'app/game'],
  ['sauvegarde', 'app/game'],
  ['rendu : sprites', 'render/kit'],
  ['éléments animés', 'render/units'],
  ['défense : remparts', 'app/game'],
  ['art : défense', 'render/units'],
  ['terrain low-poly', 'render/terrain'],
  ['relief continu', 'render/terrain'],
  ['décors naturels', 'render/decor'],
  ['bâtiments : facettes', 'render/buildings'],
  ['entrées', 'ui/input'],
  ['interface', 'ui/panels'],
  ['boucle', 'ui/loop'],
];
const OVERRIDE = {
  $: 'app/dom', cv: 'app/dom', ctx: 'app/dom',
  ENTRY: 'app/game', R: 'app/game', store: 'app/game',
  DEP: 'render/terrain', LD: 'render/terrain', computeDep: 'render/terrain',
  VIS: 'render/overlays', resetVis: 'render/overlays', markVis: 'render/overlays',
  sh: 'render/kit', shc: 'render/kit',
  FX: 'render/fx', drawFX: 'render/fx', shipFig: 'render/units',
  render: 'render/renderer',
  OV: 'render/overlays', TOOLOV: 'render/overlays', ovKind: 'render/overlays', houseOK: 'render/overlays', reachOf: 'render/overlays', renderViews: 'render/overlays',
  roadLine: 'app/game', resize: 'ui/input', pick: 'ui/input',
  smoke: 'render/units', liveB: 'render/buildings', liveB2: 'render/buildings',
  DECO: 'ui/panels', DECOTXT: 'ui/panels',
};
// les commentaires de section se trouvent dans le texte : on repère leur position
const marks = [];
for (const [key, m] of SECTIONS) {
  const re = new RegExp('/\\*[-= ]+' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const i = code.search(re);
  if (i < 0) throw new Error('section introuvable : ' + key);
  marks.push([i, m]);
}
marks.sort((a, b) => a[0] - b[0]);
const sectionOf = pos => { let m = 'app/game'; for (const [i, mm] of marks) if (i <= pos) m = mm; return m; };
const declNames = st =>
  st.type === 'FunctionDeclaration' ? [st.id.name]
  : st.type === 'VariableDeclaration' ? st.declarations.flatMap(d => (d.id.type === 'Identifier' ? [d.id.name] : []))
  : [];

const modules = {}; // nom → { parts: [{start,end,text}], decl: Set }
const owner = {};
const imports = {}; // nom importé → source
for (const st of ast.body) {
  if (st.type === 'ImportDeclaration') {
    for (const s of st.specifiers) imports[s.local.name] = { src: st.source.value, imported: s.imported ? s.imported.name : 'default' };
    continue;
  }
  const names = declNames(st);
  let m = sectionOf(st.start);
  const ov = names.map(n => OVERRIDE[n]).filter(Boolean);
  if (ov.length) m = ov[0];
  (modules[m] ??= { parts: [], decl: new Set() });
  // garder le commentaire qui précède immédiatement la déclaration
  modules[m].parts.push({ start: st.start, end: st.end });
  for (const n of names) {
    modules[m].decl.add(n);
    owner[n] = m;
  }
}

/* ---------- 3. imports et exports ---------- */
const used = {}; // module → Set de noms de portée module utilisés
for (const v of mod.variables) {
  for (const r of v.references) {
    const pos = r.identifier.start;
    const st = ast.body.find(s => s.start <= pos && pos < s.end);
    if (!st || st.type === 'ImportDeclaration') continue;
    const names = declNames(st);
    let m = sectionOf(st.start);
    const ov = names.map(n => OVERRIDE[n]).filter(Boolean);
    if (ov.length) m = ov[0];
    (used[m] ??= new Set()).add(v.name);
  }
}
const exportsOf = {};
for (const [m, names] of Object.entries(used)) for (const n of names) if (owner[n] && owner[n] !== m) (exportsOf[owner[n]] ??= new Set()).add(n);

const relTo = (from, to) => { let r = path.relative(path.dirname('src/' + from), to.startsWith('src/') ? to : 'src/' + to); return r.startsWith('.') ? r : './' + r; };
const leadingComment = start => {
  // lignes de commentaire (sur une seule ligne chacune) collées juste avant la déclaration
  const lines = code.slice(0, start).split('\n');
  lines.pop(); // début de la ligne de la déclaration
  const kept = [];
  while (lines.length) {
    const l = lines[lines.length - 1].trim();
    if (/^\/\*.*\*\/$/.test(l) || /^\/\//.test(l)) kept.unshift(lines.pop());
    else break;
  }
  return kept.length ? kept.join('\n') + '\n' : '';
};

const out = {};
for (const [m, info] of Object.entries(modules)) {
  const lines = [];
  const u = used[m] ?? new Set();
  // imports externes
  const bySrc = {};
  for (const n of u) if (imports[n]) {
    const { src, imported } = imports[n];
    (bySrc[src] ??= []).push(imported === n ? n : `${imported} as ${n}`);
  }
  for (const [src, names] of Object.entries(bySrc)) {
    const abs = path.normalize(path.join('src/legacy', src));
    lines.push(`import { ${names.sort().join(', ')} } from '${relTo(m, abs)}';`);
  }
  if (code.includes('A.') && /\bA\./.test(info.parts.map(p => code.slice(p.start, p.end)).join('\n'))) lines.push(`import { A } from '${relTo(m, 'src/app/state')}';`);
  // imports internes
  const byMod = {};
  for (const n of u) if (owner[n] && owner[n] !== m) (byMod[owner[n]] ??= []).push(n);
  for (const [om, names] of Object.entries(byMod)) lines.push(`import { ${names.sort().join(', ')} } from '${relTo(m, 'src/' + om)}';`);
  const body = info.parts.map(p => leadingComment(p.start) + code.slice(p.start, p.end)).join('\n');
  const ex = [...(exportsOf[m] ?? [])].sort();
  out[m] = `// @ts-nocheck — affichage et interface extraits de la version mono-fichier ; à typer progressivement.\n${lines.join('\n')}\n\n${body}\n${ex.length ? `\nexport { ${ex.join(', ')} };\n` : ''}`;
}

/* ---------- état partagé ---------- */
const stateLines = Object.entries(inits).map(([n, v]) => `  ${n}: ${v},`).join('\n');
const state = `// @ts-nocheck — état de l'affichage et de l'interface (partie en cours, caméra, outil, sélection, caches).
// Ces valeurs sont réassignées par plusieurs modules : elles vivent donc dans un objet partagé.
import { N } from '../core/constants';
import { ctx } from './dom';

export const A = {
${stateLines}
};
`;

fs.mkdirSync('src/app', { recursive: true });
fs.writeFileSync('src/app/state.ts', state);
for (const [m, txt] of Object.entries(out)) {
  const p = 'src/' + m + '.ts';
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, txt);
}
console.log('variables partagées :', MUT.join(', '));
console.log('modules :', Object.keys(out).map(m => `${m} (${out[m].split('\n').length})`).join(', '));
