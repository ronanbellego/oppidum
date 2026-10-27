// @ts-nocheck — affichage et interface extraits de la version mono-fichier ; à typer progressivement.
import { A } from '../app/state';
import { $ } from '../app/dom';
import { load, newGame, ser, staff, stepSim, store } from '../app/game';
import { render } from '../render/renderer';
import { keys, resize } from './input';
import { buildToolbar, buildTrade, renderLog, renderObj, renderSel, renderStats, renderWrath, setPanel, setTool } from './panels';

function frame(t){
  const dt=Math.min(250,t-(A.last||t));A.last=t;
  const ps=500/A.cam.z*dt/1000;if(keys['arrowleft']||keys['q']||keys['a'])A.cam.x-=ps;if(keys['arrowright']||keys['d'])A.cam.x+=ps;if(keys['arrowup']||keys['z']||keys['w'])A.cam.y-=ps;if(keys['arrowdown']||keys['s'])A.cam.y+=ps;
  if(A.speed>0){A.acc+=dt*A.speed*10/1000;let n=0;while(A.acc>=1&&n<40){stepSim();A.acc--;n++;}if(n>=40)A.acc=0;}
  render(t);
  A.uiT+=dt;if(A.uiT>300){A.uiT=0;renderStats();if(A.sel||A.dirtySel){renderSel();A.dirtySel=false;}}
  if(A.dirtyLog){renderLog();A.dirtyLog=false;}if(A.dirtyObj){renderObj();A.dirtyObj=false;}
  requestAnimationFrame(frame);
}
function start(data){
  let ok=false;
  if(data&&data.save){try{ok=load(data.save);}catch(e){}}
  if(!ok){const s=store.read();if(s){try{ok=load(s);}catch(e){console.warn(e);}}}
  if(!ok)newGame(20260);
  staff();
  if(innerWidth>820)setPanel(true);
  buildToolbar();buildTrade();renderWrath();setTool('inspect');resize();
  new ResizeObserver(resize).observe($('view'));
  requestAnimationFrame(frame);
}
window.claude?.hot?.snapshot?.(()=>({save:ser()}));
window.claude?.hot?.ready?window.claude.hot.ready(start):start(window.claude?.hot?.data??{});
