// @ts-nocheck — extrait tel quel de la version mono-fichier ; à typer progressivement.

function rng(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
function hashS(s){let h=2166136261;for(let k=0;k<s.length;k++){h^=s.charCodeAt(k);h=Math.imul(h,16777619);}return h>>>0;}

export { rng, hashS };
