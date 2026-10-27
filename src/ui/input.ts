// @ts-nocheck — affichage et interface extraits de la version mono-fichier ; à typer progressivement.
import { X, Y, fromCube, hexRound } from '../core/hex';
import { B } from '../data/buildings';
import { A } from '../app/state';
import { $, cv } from '../app/dom';
import { CR, DPi, HW, SR, STEP, TILT, ZH, ZW } from '../render/projection';
import { buildRoad, buildWall, demolishRect, place, roadLine } from '../app/game';
import { setPanel, setSpeed, setTool } from './panels';

/* ---------- entrées ---------- */
function resize(){const r=$('view').getBoundingClientRect();A.dpr=window.devicePixelRatio||1;A.cw=r.width;A.ch=r.height;cv.width=Math.max(1,A.cw*A.dpr|0);cv.height=Math.max(1,A.ch*A.dpr|0);}
function pick(cx,cy){const r=cv.getBoundingClientRect();const wx=(cx-r.left-A.cw/2)/A.cam.z+A.cam.x,wy=(cy-r.top-A.ch/2)/A.cam.z+A.cam.y;
  const at=zz=>{const qx=wx/HW,qy=(wy+zz)/(HW*TILT),px=qx*CR+qy*SR,py=-qx*SR+qy*CR,rf=py/.866;const[hq,hr]=hexRound(px-rf/2,rf);return fromCube(hq,hr);};
  let best=-1,bd=-1e9;for(let h=-1;h<=8;h++){const zz=h<0?ZW:h*STEP,j=at(zz);if(j<0)continue;if(Math.abs(ZH(j)-zz)<.5&&DPi(j)>bd){bd=DPi(j);best=j;}}
  return best>=0?best:at(0);}
const ptrs=new Map();
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('pointerdown',e=>{
  cv.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptrs.size===2){const[a,b]=[...ptrs.values()];A.pinch={d:Math.hypot(a.x-b.x,a.y-b.y),z:A.cam.z};A.drag=null;A.down=null;return;}
  const i=pick(e.clientX,e.clientY);
  A.down={x:e.clientX,y:e.clientY,cx:A.cam.x,cy:A.cam.y,moved:0,btn:e.button,pan:e.button!==0||A.tool==='inspect'};
  if(!A.down.pan&&i>=0&&(A.tool==='road'||A.tool==='demolish'||A.tool==='wall'))A.drag={mode:A.tool,a:i};
});
cv.addEventListener('pointermove',e=>{
  if(ptrs.has(e.pointerId))ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(A.pinch&&ptrs.size===2){const[a,b]=[...ptrs.values()];A.cam.z=Math.max(.45,Math.min(2.4,A.pinch.z*Math.hypot(a.x-b.x,a.y-b.y)/A.pinch.d));return;}
  A.hover=pick(e.clientX,e.clientY);
  if(!A.down)return;
  const dx=e.clientX-A.down.x,dy=e.clientY-A.down.y;A.down.moved=Math.max(A.down.moved,Math.hypot(dx,dy));
  if(!A.drag&&(A.down.pan||A.down.moved>12)){A.down.pan=true;A.cam.x=A.down.cx-dx/A.cam.z;A.cam.y=A.down.cy-dy/A.cam.z;}
});
function endPtr(e){
  ptrs.delete(e.pointerId);if(A.pinch){if(ptrs.size<2)A.pinch=null;A.down=null;return;}
  if(!A.down)return;const i=pick(e.clientX,e.clientY);
  if(A.drag){if(i>=0){if(A.drag.mode==='road')buildRoad(roadLine(A.drag.a,i));else if(A.drag.mode==='wall')buildWall(roadLine(A.drag.a,i));else demolishRect(A.drag.a,i);}A.drag=null;}
  else if(A.down.moved<8&&A.down.btn===0&&i>=0){
    if(A.tool==='inspect'){A.sel=A.S.occ[i]||null;A.selTile=i;A.dirtySel=true;if(A.sel&&innerWidth<=820)setPanel(true);}
    else if(B[A.tool].s){if(place(A.tool,X(i),Y(i))){A.sel=A.S.occ[i];A.selTile=i;A.dirtySel=true;}}
  }
  A.down=null;
}
cv.addEventListener('pointerup',endPtr);
cv.addEventListener('pointercancel',e=>{ptrs.delete(e.pointerId);A.down=null;A.drag=null;A.pinch=null;});
cv.addEventListener('pointerleave',()=>{if(!A.down)A.hover=-1;});
cv.addEventListener('wheel',e=>{e.preventDefault();const r=cv.getBoundingClientRect();const mx=e.clientX-r.left-A.cw/2,my=e.clientY-r.top-A.ch/2;
  const wx=mx/A.cam.z+A.cam.x,wy=my/A.cam.z+A.cam.y;A.cam.z=Math.max(.45,Math.min(2.4,A.cam.z*Math.exp(-e.deltaY*.0015)));A.cam.x=wx-mx/A.cam.z;A.cam.y=wy-my/A.cam.z;},{passive:false});
const keys={};
addEventListener('keydown',e=>{if(e.target.tagName==='BUTTON'&&(e.key===' '||e.key==='Enter'))return;keys[e.key.toLowerCase()]=1;
  if(e.key==='Escape'){setTool('inspect');A.sel=null;A.dirtySel=true;}
  if(e.key===' '){e.preventDefault();setSpeed(A.speed?0:1);}
  if(e.key==='+'||e.key==='=')A.cam.z=Math.min(2.4,A.cam.z*1.15);if(e.key==='-')A.cam.z=Math.max(.45,A.cam.z/1.15);});
addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=0;});

export { keys, resize };
