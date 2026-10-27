// Transforme dist/index.html en fragment publiable comme artefact Claude :
// le service ajoute lui-même doctype, <html>, <head> et <body>, on ne garde donc que leur contenu.
import fs from 'fs';
const html = fs.readFileSync('dist/index.html', 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
  .replace(/<meta charset[^>]*>\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '');
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
fs.writeFileSync('dist/artifact.html', head.trim() + '\n' + body.trim() + '\n');
console.log('dist/artifact.html', fs.statSync('dist/artifact.html').size, 'octets');
