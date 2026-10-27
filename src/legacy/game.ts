// @ts-nocheck — reste de la version mono-fichier, découpé module par module dans les étapes suivantes.
import { N, MONTH, WS, MAXSTEP, BAL } from '../core/constants';
import { rng, hashS, nextRandom } from '../core/rng';
import { serialize, deserialize } from '../core/save';
import { localStore } from '../core/storage';
import { idx, X, Y, inb, SQ3, HR, HX, HY, cube, fromCube, hdist, DIRS, nbDir, NBC, nb4, EDGE_DIR, corner, foot, hexRound, within, hexLine } from '../core/hex';
import { generateWorld } from '../world/generate';
import { buildings, tilesOf as tilesOfB, access as accessOf, jobsOf, monumentDone, isHouse } from '../sim/query';
import { assignLabor, payWages, rations } from '../sim/labor';
import { needsOf, housingMonth } from '../sim/housing';
import { taxRate as taxRateOf, accrueTax, collectTax, monthlyTaxDue, taxPending } from '../sim/tax';
import { seaDepth, landDistance } from '../world/terrain';
import { MONTHS } from '../data/calendar';
import { RES } from '../data/resources';
import { LV } from '../data/houses';
import { B, GODC, TOOLS } from '../data/buildings';
import { PRIO, SUB, SECT } from '../data/labor';
import { WALK, TCOL, INK, AC } from '../data/palette';











const $=id=>document.getElementById(id);
const cv=$('cv'), ctx=cv.getContext('2d');
let S=null, cam={x:0,y:0,z:1}, dpr=1, cw=0, ch=0, tool='inspect', sel=null, hover=-1, drag=null, speed=1;

/* ---- géométrie hexagonale (pointe en haut, lignes impaires décalées) ---- */
const HW=56,TILT=.62,ZW=-10;

let LOC=null;
const ROT=-20*Math.PI/180,CR=Math.cos(ROT),SR=Math.sin(ROT);
function W(x,y,z=0){if(LOC){x=(x-LOC.c)*LOC.k+LOC.ox;y=(y-LOC.c)*LOC.k+LOC.oy;z+=LOC.z||0;}return[(x*CR-y*SR)*HW,(x*SR+y*CR)*HW*TILT-z];}
const DP2=(x,y)=>x*SR+y*CR, DPi=i=>DP2(HX(i),HY(i));
const vis=(nx,ny)=>nx*SR+ny*CR>.03;
const fshade=(nx,ny)=>.78-.18*(nx*CR-ny*SR);
const VISK=[0,1,2,3,4,5].filter(k=>{const a=(60*k-60)*Math.PI/180;return vis(Math.cos(a),Math.sin(a));});










function hexPts(cx,cy,r,z){const o=[];for(let k=0;k<6;k++){const[x,y]=corner(cx,cy,k,r);o.push(W(x,y,z));}return o;}
const STEP=9;
function ZH(i){if(S.ter[i]===2){if(!S.road[i])return ZW;let m=99;for(const j of nb4(i))if(S.ter[j]!==2)m=Math.min(m,S.hgt?S.hgt[j]*STEP:0);return m===99?0:m;}return S.hgt?S.hgt[i]*STEP:0;}
function hexI(i,f,s,lw,ins,z){ins=ins||1;if(z!=null||(S.ter[i]===2&&!S.road[i])){P(hexPts(HX(i),HY(i),HR*ins,z==null?ZH(i):z),f,s,lw);return;}
  const G=geo(i),cx=HX(i),cy=HY(i),o=[];for(let k=0;k<6;k++){const[x,y]=corner(cx,cy,k,HR*ins);o.push(W(x,y,G.zc+(G.zs[k]-G.zc)*ins+.5));}P(o,f,s,lw);}

function bc(b){const t=tilesOf(b);let x=0,y=0;for(const i of t){x+=HX(i);y+=HY(i);}return[x/t.length,y/t.length];}



const ENTRY=()=>S&&S.entry!=null?S.entry:idx(0,24);

let DEP=new Uint8Array(N*N);
let LD=new Uint8Array(N*N);
function computeDep(){LD=landDistance(S.ter);DEP=seaDepth(S.ter);}
const VIS={};function resetVis(){for(const k of['market','druid','bard','tax'])VIS[k]=new Int32Array(N*N).fill(-1e9);}resetVis();
function markVis(w){const k=w.k==='priest'?'druid':w.k;if(VIS[k])VIS[k][w.cur]=S.tick;}

/* hasard de la simulation : tiré de l'état de la partie, donc reproductible et sauvegardé avec elle */
const R=()=>{const[v,n]=nextRandom(S.rs|0);S.rs=n;return v;};
const store=localStore('oppidum-save',['oppidum-v2']);

/* ---------- carte ---------- */
function newGame(seed){
  const wd=generateWorld(seed);
  S={seed,rs:(seed|0)^0x5bd1e995,ter:wd.ter,vr:wd.vr,lnd:wd.lnd,hgt:wd.hgt,road:new Uint8Array(N*N),occ:new Int32Array(N*N),b:{},nid:1,w:[],money:1500,tick:0,mi:0,
     favor:50,logs:[],sell:{bois:false,fer:false,cervoise:false,torques:false,ble:false,porc:false},
     won:false,flags:{},eff:0,labor:0,jobs:0,pop:0,unemp:0,taxM:0,lastTaxM:0,hungry:0,tradeOK:false,lastBal:0,wall:new Uint8Array(N*N),whp:new Float32Array(N*N),u:[],gf:{taranis:35,belenos:35,epona:35},raidNext:30,raid:0,deco:new Uint8Array(N*N)};
  FE=null;FW=null;FX.length=0;resetVis();computeDep();
  if(wd.port&&!place('port',wd.port.x,wd.port.y))console.warn('Le port prévu n\'a pas pu être posé.');
  S.road=wd.road;S.deco=wd.deco;S.dock=wd.dock;if(wd.entry>=0)S.entry=wd.entry;S.money=1500;S.hver=(S.hver||0)+1;computeDep();
  log("Votre clan vénète vient de débarquer sur l'île. Prolongez la route qui part du port, posez des huttes de part et d'autre et un puits.");
  const [cx,cy]=W(HX(wd.focus),HY(wd.focus)); cam.x=cx; cam.y=cy; cam.z=1.1;
}

/* ---------- utilitaires ---------- */
function log(t){S.logs.unshift({m:dateTxt(),t}); if(S.logs.length>14)S.logs.length=14; dirtyLog=true;}
function dateTxt(){const y=80-Math.floor(S.mi/12);return MONTHS[S.mi%12]+', '+(y>0?`an ${y} av. J.-C.`:`an ${1-y}`);}
let toastT=0;
function toast(t){const el=$('toast');el.textContent=t;el.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove('on'),2200);}
const shc={};
function sh(col,f){const k=col+f;if(shc[k])return shc[k];let r,gg,bb;
  if(col[0]==='#'){const n=parseInt(col.slice(1),16);r=n>>16;gg=(n>>8)&255;bb=n&255;}else{const m=col.match(/[\d.]+/g);r=+m[0];gg=+m[1];bb=+m[2];}
  const c=v=>Math.max(0,Math.min(255,Math.round(v*f)));return shc[k]=`rgb(${c(r)},${c(gg)},${c(bb)})`;}
function blds(){return buildings(S);}
const tilesOf=tilesOfB;
function roadNb(i){return nb4(i).filter(j=>S.road[j]);}
function access(b){return accessOf(S,b);}
function bfs(start,goal){
  const prev=new Int32Array(N*N).fill(-2);prev[start]=-1;const q=[start];let h=0;
  while(h<q.length){const i=q[h++];const g=goal(i);if(g){const p=[];let k=i;while(k!==-1){p.push(k);k=prev[k];}p.reverse();return{path:p,val:g};}
    for(const j of roadNb(i))if(prev[j]===-2){prev[j]=i;q.push(j);}}
  return null;
}
function used(b){let s=0;for(const k in b.stock)s+=b.stock[k];return s;}
function stockOf(r){let s=0;for(const b of blds()){const d=B[b.type];if(d.store&&b.stock[r])s+=b.stock[r];}return s;}
function take(r,n){for(const b of blds()){if(n<=0)break;const d=B[b.type];if(!d.store||!b.stock[r])continue;const t=Math.min(n,b.stock[r]);b.stock[r]-=t;n-=t;}return n<=0;}
function putAny(r,n){for(const b of blds()){const d=B[b.type];if(!d.store||!d.store.includes(r))continue;const t=Math.min(n,d.cap-used(b));if(t>0){b.stock[r]=(b.stock[r]||0)+t;n-=t;}if(n<=0)break;}}

function nearTer(b,t,r){let ok=false;for(const f of(foot(b.s,b.x,b.y)||[]))within(f,r,j=>{if(S.ter[j]===t)ok=true;});return ok;}

/* ---------- construction ---------- */
function canPlace(type,x,y){
  const d=B[type];
  const ft=foot(d.s,x,y);if(!ft)return"Hors de la carte";
  for(const k of ft){
    if(S.occ[k]||S.road[k]||S.wall[k])return"Emplacement occupé";if(S.deco&&S.deco[k])return"Un monument des anciens occupe cette case";
    if(S.ter[k]!==0)return S.ter[k]===2?"On ne bâtit pas sur l'eau":S.ter[k]===1?"Il faut d'abord défricher (un chemin coupe la forêt)":"Rochers impraticables";
  }
  const fake={x,y,s:d.s};
  if(d.near==='forest'&&!nearTer(fake,1,2))return"Il faut une forêt à 2 cases";
  if(d.near==='rock'&&!nearTer(fake,3,1))return"La mine doit toucher des rochers";
  if(S.money<d.cost)return"Pas assez de statères";
  return"";
}
function place(type,x,y){
  const why=canPlace(type,x,y);if(why){toast(why);return false;}
  const d=B[type];S.money-=d.cost;
  const b={id:S.nid++,type,x,y,s:d.s,prog:0,hold:0,cartOut:false,out:false,cool:8,loaded:false,status:'',stock:{}};
  if(type==='hut')Object.assign(b,{pop:0,inc:0,lvl:1,food:{ble:0,porc:0},cerv:0,torq:0,relig:-99,ent:-99,lastTax:-1,bad:0,hungry:0,has:{}});
  b.maxhp=b.hp=40*d.s*d.s;if(d.mon){b.got={};b.done=false;b.cool=5;}FE=null;
  S.b[b.id]=b;const h0=S.hgt?S.hgt[idx(x,y)]:0;for(const t of tilesOf(b)){S.occ[t]=b.id;if(S.hgt)S.hgt[t]=h0;}S.hver=(S.hver||0)+1;
  if(type==='granary'&&!S.flags.g1){S.flags.g1=1;b.stock.ble=80;log("Le clan dépose ses provisions au premier grenier : 80 blé.");}
  staff();dirtyLabor=true;
  return true;
}
function roadCost(i){const t=S.ter[i];return t===0?2:t===1?4:t===2?20:-1;}
function buildRoad(list){
  let spent=0,blocked=false;
  for(const i of list){if(S.road[i]||S.occ[i]||S.wall[i]||(S.deco&&S.deco[i]))continue;const c=roadCost(i);if(c<0){blocked=true;continue;}
    if(S.money<c){toast("Pas assez de statères");break;}S.money-=c;spent+=c;if(S.ter[i]===1)S.ter[i]=0;S.road[i]=1;}
  S.hver=(S.hver||0)+1;
  if(blocked)toast("Les rochers bloquent le chemin");
}
function demolishRect(a,c){S.hver=(S.hver||0)+1;
  const x0=Math.min(X(a),X(c)),x1=Math.max(X(a),X(c)),y0=Math.min(Y(a),Y(c)),y1=Math.max(Y(a),Y(c));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const i=idx(x,y);
    if(S.occ[i])removeB(S.occ[i]);else if(S.wall[i]){S.wall[i]=0;FE=null;}else if(S.road[i]&&i!==ENTRY())S.road[i]=0;}
}
function removeB(id){const b=S.b[id];if(!b||b.type==='port')return;FE=null;for(const t of tilesOf(b))S.occ[t]=0;delete S.b[id];
  for(const w of S.w)if(w.home===id||w.target===id)kill(w);if(sel===id)sel=null;}

/* ---------- marcheurs ---------- */
function spawn(w){w.t=0;w.prev=-1;w.steps=0;w.seen={};S.w.push(w);
  if(w.path){w.pi=0;w.cur=w.path[0];if(w.path.length===1){w.nxt=w.cur;arrive(w);}else w.nxt=w.path[1];}
  else{w.cur=w.nxt=w.start;serve(w);markVis(w);decide(w);}
}
function kill(w){if(w.dead)return;w.dead=true;const h=S.b[w.home];
  if(w.k==='cart'&&h)h.cartOut=false;
  if(w.k==='immigrant'){const t=S.b[w.target];if(t)t.inc=Math.max(0,t.inc-w.amt);}
  if(['market','druid','bard','tax','priest'].includes(w.k)&&h){h.out=false;h.cool=30;}
  if(w.k==='market'&&w.carry)for(const r in w.carry)if(w.carry[r]>0)putAny(r,w.carry[r]);
}
function arrive(w){
  if(w.k==='cart'){const t=S.b[w.target];if(t&&B[t.type].store){const n=Math.min(w.amt,B[t.type].cap-used(t));t.stock[w.res]=(t.stock[w.res]||0)+n;if(n<w.amt)putAny(w.res,w.amt-n);}}
  if(w.k==='immigrant'){const t=S.b[w.target];if(t){t.inc=Math.max(0,t.inc-w.amt);t.pop=Math.min(LV[t.lvl].cap,t.pop+w.amt);}w.dead=true;return;}
  kill(w);
}
function stepW(w){
  w.t+=WS;if(w.t<1)return;
  w.t=0;w.prev=w.cur;w.cur=w.nxt;if(w.path)w.pi++;
  if(!S.road[w.cur]){kill(w);return;}
  serve(w);markVis(w);decide(w);
}
function decide(w){
  if(w.path){if(w.pi>=w.path.length-1){arrive(w);return;}w.nxt=w.path[w.pi+1];return;}
  w.steps++;
  if(w.steps>=MAXSTEP){const h=S.b[w.home];if(!h){kill(w);return;}const set=access(h);
    const r=bfs(w.cur,i=>set.includes(i));if(!r){kill(w);return;}w.path=r.path;w.pi=0;w.back=true;
    if(r.path.length===1){arrive(w);return;}w.nxt=r.path[1];return;}
  let o=roadNb(w.cur).filter(j=>j!==w.prev);
  if(o.length>1){const fresh=o.filter(j=>!w.seen['t'+j]);if(fresh.length)o=fresh;}
  w.seen['t'+w.cur]=1;
  w.nxt=o.length?o[(R()*o.length)|0]:(w.prev>=0?w.prev:w.cur);
}
function serve(w){
  if(!['market','druid','bard','tax','priest'].includes(w.k))return;
  const cx=X(w.cur),cy=Y(w.cur);
  for(let y=cy-2;y<=cy+2;y++)for(let x=cx-3;x<=cx+3;x++){if(!inb(x,y)||hdist(w.cur,idx(x,y))>2)continue;const id=S.occ[idx(x,y)];if(!id)continue;
    const h=S.b[id];if(!h||h.type!=='hut'||h.pop<=0||w.seen[id])continue;w.seen[id]=1;
    if(w.k==='druid'||w.k==='priest')h.relig=S.mi;
    else if(w.k==='bard')h.ent=S.mi;
    else if(w.k==='tax'){collectTax(S,h);}
    else if(w.k==='market'){const per=Math.ceil(h.pop/4)*6;
      for(const f of['ble','porc']){const g=Math.min(Math.max(0,per-h.food[f]),w.carry[f]||0);h.food[f]+=g;w.carry[f]-=g;}
      if(h.lvl>=2){const g=Math.min(Math.max(0,3-h.cerv),w.carry.cervoise||0);h.cerv+=g;w.carry.cervoise-=g;}
      if(h.lvl>=3){const g=Math.min(Math.max(0,2-h.torq),w.carry.torques||0);h.torq+=g;w.carry.torques-=g;}}
  }
}

/* ---------- simulation ---------- */
function stepSim(){
  S.tick++;
  for(const b of blds())updB(b);
  for(const w of S.w)if(!w.dead)stepW(w);
  stepUnits();
  if(S.tick%50===0&&!S.raid)for(let i=0;i<N*N;i++)if(S.wall[i]&&S.whp[i]<100)S.whp[i]=Math.min(100,S.whp[i]+5);
  S.w=S.w.filter(w=>!w.dead);
  if(S.tick%10===0)staff();
  if(S.tick%15===0)immigrate();
  if(S.tick%MONTH===0)monthly();
}
function updB(b){
  const d=B[b.type];if(b.hp!=null&&b.hp<b.maxhp&&!S.raid)b.hp=Math.min(b.maxhp,b.hp+.05);
  if(b.type==='hut'||b.type==='well')return;
  const acc=access(b);
  if(!acc.length){b.status="Aucun chemin ne touche ce bâtiment";return;}
  const jb=jobsOf(b),ef=jb?(b.wk||0)/jb:1;
  if(d.mon){stepMon(b,ef);return;}
  if(b.type==='tower'||b.type==='barracks'){stepDefB(b,acc,ef);return;}
  if(d.out){
    if(d.near&&!nearTer(b,d.near==='forest'?1:3,d.near==='forest'?2:1)){b.status="Ressource naturelle hors de portée";return;}
    if(b.hold>0){if(!b.cartOut&&S.tick%10===0)sendCart(b,acc);return;}
    if(d.inp&&!b.loaded){
      const miss=Object.keys(d.inp).filter(r=>stockOf(r)<d.inp[r]);
      if(miss.length){b.status="En attente de "+miss.map(r=>RES[r].n.toLowerCase()).join(' et ');return;}
      for(const r in d.inp)take(r,d.inp[r]);b.loaded=true;
    }
    if(ef<=0){b.status="Personne pour y travailler : il faut plus d'habitants";return;}
    b.status=ef<.99?"Travaille au ralenti, faute de bras":"Au travail";
    b.prog+=ef;
    if(b.prog>=d.time){b.prog=0;b.hold=d.batch;b.loaded=false;sendCart(b,acc);}
    return;
  }
  if(d.roam){
    if(b.out){b.status="Marcheur en tournée";return;}
    if(ef<=0){b.status="Personne pour y travailler : il faut plus d'habitants";return;}
    b.cool-=ef;b.status="Prépare la prochaine tournée";
    if(b.cool>0)return;
    const w={k:b.type==='market'?'market':d.roam,home:b.id,god:d.god,start:acc[(R()*acc.length)|0]};
    if(w.k==='market'){
      const c={};let food=0;for(const f of['ble','porc'])food+=stockOf(f);
      if(food<=0&&stockOf('cervoise')<=0&&stockOf('torques')<=0){b.status="Greniers vides : rien à vendre";b.cool=20;return;}
      for(const f of['ble','porc']){const n=Math.min(70,stockOf(f));take(f,n);c[f]=n;}
      for(const[r,m]of[['cervoise',20],['torques',8]]){const n=Math.min(m,stockOf(r));take(r,n);c[r]=n;}
      w.carry=c;
    }
    b.out=true;spawn(w);
    return;
  }
  if(d.store){const u=used(b);b.status=u>=d.cap?"Plein":"En service";return;}
  if(b.type==='port'){b.status=b.wk>0?"Les navires marchands accostent chaque mois":"Personne pour décharger les navires";return;}
  if(b.type==='trade'){b.status=S.tradeOK?"Les marchands passent chaque mois":"Pas relié au chemin d'entrée";}
}
function sendCart(b,acc){
  const d=B[b.type];const r=d.out;
  let best=null;
  for(const a of acc){const f=bfs(a,i=>{for(const j of nb4(i)){const id=S.occ[j];if(!id)continue;const t=S.b[id];const td=t&&B[t.type];
      if(td&&td.store&&td.store.includes(r)&&td.cap-used(t)>0)return id;}return 0;});
    if(f&&(!best||f.path.length<best.path.length))best=f;}
  if(!best){if(!b.stuck){b.stuck=true;staff();}b.status=(r==='ble'||r==='porc')?"Grenier plein ou non relié : les ouvriers sont envoyés ailleurs":"Entrepôt plein ou non relié : les ouvriers sont envoyés ailleurs";return;}
  if(b.stuck){b.stuck=false;staff();}
  spawn({k:'cart',home:b.id,target:best.val,res:r,amt:b.hold,path:best.path});
  b.hold=0;b.cartOut=true;b.status="Livraison en cours";
}
function immigrate(){
  const imm=S.w.filter(w=>w.k==='immigrant').length;if(imm>=10)return;
  if(S.pop>20&&S.hungry>.6&&R()<.5){S.block="la faim ralentit les arrivées";return;}
  if(!monDone('tumulus')&&S.labor>10&&S.unemp>Math.max(8,S.labor*.3)){S.block="trop de bras sans travail";return;}
  if(S.taxLvl===2&&R()<.4){S.block="le tribut lourd décourage les familles";return;}
  S.block="";
  const hs=blds().filter(h=>h.type==='hut'&&LV[h.lvl].cap-h.pop-h.inc>0);
  if(!hs.length)return;
  const h=hs[(R()*hs.length)|0];const set=access(h);if(!set.length)return;
  const r=bfs(ENTRY(),i=>set.includes(i));if(!r)return;
  const n=Math.min((S.gf&&S.gf.epona>70?5:4)+(S.taxLvl===0?1:0),LV[h.lvl].cap-h.pop-h.inc);h.inc+=n;
  spawn({k:'immigrant',home:0,target:h.id,amt:n,path:r.path});
}



function staff(){assignLabor(S);}
function taxRate(){return taxRateOf(S);}
function taxDue(){return monthlyTaxDue(S);}
function hasOf(h){return needsOf(S,h);}
function monthly(){
  // emploi
  staff();const{due,paid:wages}=payWages(S);
  if(wages<due&&!S.flags.unpaid){S.flags.unpaid=1;log("Le trésor est vide : les ouvriers travaillent à crédit en attendant le tribut.");}if(S.money>50)S.flags.unpaid=0;
  // maisons
  const hr=housingMonth(S,R);const{hungry,covered,occupied:occ}=hr;
  for(const e of hr.events)log(e.level===3?"Première longue maison : le village prend de l'importance.":"Une famille noble s'installe dans une demeure digne d'elle.");
  S.hungry=occ?hungry/occ:0;
  // faveur
  const target=Math.min(100,(occ?covered/occ*100:50)+(monDone('menhirs')?15:0));
  S.favor+=(target-S.favor)*.2;S.favor=Math.max(0,Math.min(100,S.favor));
  if(S.wrath!==false&&occ>5&&S.favor<15&&R()<.12){const c=blds().filter(b=>b.type!=='hut'&&b.type!=='port');if(c.length){const v=c[(R()*c.length)|0];
    log(`Taranis lance la foudre : ${B[v.type].n.toLowerCase()} réduit en cendres. Honorez Toutatis.`);removeB(v.id);}}
  godsMonthly();raidMonthly();
  // commerce
  const tr=blds().filter(b=>b.type==='trade'||b.type==='port');
  S.tradeOK=tr.some(t=>{const set=access(t);return set.length&&bfs(ENTRY(),i=>set.includes(i));});
  let gain=0;
  if(S.tradeOK&&blds().some(b=>(b.type==='trade'||b.type==='port')&&b.wk>0))for(const r in S.sell){if(!S.sell[r])continue;const n=Math.floor(stockOf(r)-30);if(n>0){take(r,n);gain+=n*RES[r].p*(S.gf&&S.gf.epona>70?1.25:1);}}
  if(gain>0){S.money+=gain;log(`Un navire marchand venu de l'île de Bretagne repart chargé : ${Math.round(gain)} statères encaissés.`);if(S.dock!=null&&S.dock>=0)FX.push({k:'ship',d:S.dock,t:300});}
  S.lastTaxM=S.taxM||0;const bal=(S.taxM||0)+gain-wages;S.lastBal=S.balAvg==null?bal:S.balAvg*.6+bal*.4;S.balAvg=S.lastBal;S.taxM=0;
  S.mi++;
  if(S.mi%12===0)log(`Samonios : une nouvelle année commence. Le clan compte ${S.pop} âmes.`);
  checkObj();
  save();
}
const OBJ=[
  ['Atteindre 150 habitants',()=>S.pop>=150,()=>`${S.pop} / 150`],
  ['Trois longues maisons',()=>cntL(3)>=3,()=>`${cntL(3)} / 3`],
  ['Une demeure noble',()=>cntL(4)>=1,()=>`${cntL(4)} / 1`],
  ['Achever un monument',()=>['menhirs','tumulus','heroes'].some(monDone),()=>`${['menhirs','tumulus','heroes'].filter(monDone).length} / 1`],
  ['Repousser un raid',()=>!!S.flags.raidWon||S.raids===false,()=>S.raids===false?'raids désactivés':S.flags.raidWon?'fait':'à faire'],
  ['Trésor de 2 500 statères',()=>S.money>=2500,()=>`${Math.floor(S.money)} / 2500`]
];
function cntL(l){return blds().filter(b=>b.type==='hut'&&b.lvl>=l&&b.pop>0).length;}
function checkObj(){if(!S.won&&OBJ.every(o=>o[1]())){S.won=true;log("Le conseil des druides vous proclame vergobret de l'oppidum. Victoire !");}dirtyObj=true;}

/* ---------- sauvegarde ---------- */
function ser(){return serialize(S,cam);}
function load(str){const r=deserialize(str);if(!r.ok){console.warn('Sauvegarde ignorée :',r.reason);return false;}
  const o=r.state;
  /* relief absent des plus anciennes sauvegardes : on le recalcule depuis la graine, aplani sous les bâtiments */
  if(r.missing.includes('hgt')){o.hgt=generateWorld(o.seed).hgt;for(const b of Object.values(o.b)){const f=foot(b.s,b.x,b.y)||[];const h0=o.hgt[idx(b.x,b.y)];for(const t of f)o.hgt[t]=h0;}}
  S=o;computeDep();for(const b of blds())if(b.hp==null){b.maxhp=b.hp=40*b.s*b.s;}FE=null;FW=null;resetVis();if(r.cam)cam=r.cam;
  if(r.migratedFrom)log(`Partie reprise depuis une sauvegarde au format ${r.migratedFrom}, mise à jour automatiquement.`);
  return true;}
function save(){store.write(ser());}

/* ---------- rendu : sprites pré-rendus ---------- */
let g=ctx;
const SK=(window.devicePixelRatio||1)>1?3:2;
const SPR={};
const OUT='rgba(30,18,8,.55)';

function sprite(key,x0,y0,x1,y1,fn,halo){
  const o=SPR[key];if(o)return o;
  const w=x1-x0,h=y1-y0;let c=document.createElement('canvas');c.width=Math.ceil(w*SK);c.height=Math.ceil(h*SK);
  const prev=g;g=c.getContext('2d');g.setTransform(SK,0,0,SK,-x0*SK,-y0*SK);g.lineJoin='round';g.lineCap='round';
  try{fn(rng(hashS(key)));}finally{g=prev;}
  if(halo)c=crayon(c,hashS(key));
  return SPR[key]={c,x0,y0,w,h};
}
/* contour au crayon : une silhouette sombre, décalée en couronne et grainée, posée sous le dessin */
function crayon(c,seed){const W2=c.width,H2=c.height,sil=document.createElement('canvas');sil.width=W2;sil.height=H2;const s2=sil.getContext('2d');
  s2.drawImage(c,0,0);s2.globalCompositeOperation='source-in';s2.fillStyle='#221e18';s2.fillRect(0,0,W2,H2);
  const grain=document.createElement('canvas');grain.width=W2;grain.height=H2;const gr=grain.getContext('2d');const rr=rng(seed);
  for(const[rad,a]of[[2.4*SK,.09],[1.5*SK,.16],[.8*SK,.2]]){gr.globalAlpha=a;for(let k=0;k<10;k++){const an=k/10*Math.PI*2+rr()*.3,d=rad*(.75+rr()*.5);gr.drawImage(sil,Math.cos(an)*d,Math.sin(an)*d);}}
  gr.globalAlpha=1;gr.globalCompositeOperation='destination-out';for(let k=0;k<W2*H2/90;k++){gr.fillStyle=`rgba(0,0,0,${.25+rr()*.5})`;gr.fillRect(rr()*W2,rr()*H2,1+rr()*1.5,1+rr()*1.5);}
  const out=document.createElement('canvas');out.width=W2;out.height=H2;const o=out.getContext('2d');o.drawImage(grain,0,0);o.drawImage(c,0,0);return out;}
function blit(s,ax,ay){g.drawImage(s.c,ax+s.x0,ay+s.y0,s.w,s.h);}
function P(pts,fill,stroke,lw){g.beginPath();g.moveTo(pts[0][0],pts[0][1]);for(let k=1;k<pts.length;k++)g.lineTo(pts[k][0],pts[k][1]);g.closePath();
  if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=lw||1;g.stroke();}}

function ln(a,b,c,w){g.strokeStyle=c;g.lineWidth=w;g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();}
function clipPoly(pts){g.beginPath();g.moveTo(pts[0][0],pts[0][1]);for(let k=1;k<pts.length;k++)g.lineTo(pts[k][0],pts[k][1]);g.closePath();g.clip();}
function bbox(pts){let a=1e9,b=1e9,c=-1e9,d=-1e9;for(const p of pts){a=Math.min(a,p[0]);b=Math.min(b,p[1]);c=Math.max(c,p[0]);d=Math.max(d,p[1]);}return[a,b,c,d];}
function pick3(rnd,a){return a[(rnd()*a.length)|0];}
function strokes(pts,rnd,dens,len,dx,dy,cols,w,jit){g.save();clipPoly(pts);const[a,b,c,d]=bbox(pts);const n=Math.max(4,(c-a)*(d-b)*dens|0);g.lineWidth=w;
  for(let k=0;k<n;k++){const x=a+rnd()*(c-a),y=b+rnd()*(d-b),ex=dx+(rnd()-.5)*jit,ey=dy+(rnd()-.5)*jit,l=len*(.6+rnd()*.7);
    g.strokeStyle=pick3(rnd,cols);g.beginPath();g.moveTo(x,y);g.lineTo(x+ex*l,y+ey*l);g.stroke();}g.restore();}

function blur(on){try{g.filter=on?'blur(3.5px)':'none';}catch(e){}}

/* ---- bâtiments (dessinés une fois à l'origine) ---- */

/* ---- éléments animés, dessinés à chaque image ---- */

function smoke(x,y,z,time,c){for(let k=0;k<4;k++){const ph=((time/1800)+k/4)%1;const[px,py]=W(x,y,z+ph*34);
  g.fillStyle=c==='k'?`rgba(90,88,84,${.42*(1-ph)})`:`rgba(215,210,198,${.38*(1-ph)})`;g.beginPath();g.arc(px+Math.sin(ph*5+k)*5+ph*6,py,3+ph*7,0,7);g.fill();}}

function figure(px,py,ph,body,kind){
  g.fillStyle='rgba(0,0,0,.28)';g.beginPath();g.ellipse(px+1.5,py,4.5,1.8,0,0,7);g.fill();
  const sw=Math.sin(ph)*2.2;
  ln([px-1,py-5],[px-1+sw,py],'#3a2614',1.4);ln([px+1,py-5],[px+1-sw,py],'#3a2614',1.4);
  const long=kind==='druid'||kind==='priest';
  P([[px-3,py-12],[px+3,py-12],[px+3.8,long?py-1:py-4.5],[px-3.8,long?py-1:py-4.5]],body);
  P([[px,py-12],[px+3,py-12],[px+3.8,long?py-1:py-4.5],[px,long?py-1:py-4.5]],'rgba(0,0,0,.2)');
  ln([px-3.2,py-7.5],[px+3.4,py-7.5],'#3a2614',.9);
  g.fillStyle='#e2c4a0';g.beginPath();g.arc(px,py-14.5,2.5,0,7);g.fill();
  g.fillStyle=kind==='druid'?'#f2f0e8':'#8a5a2a';g.beginPath();g.arc(px,py-15.4,2.6,Math.PI,0);g.fill();
  if(kind==='druid'){ln([px+4,py],[px+5,py-19],'#6b4626',1.1);g.fillStyle='#d9e8a0';g.beginPath();g.arc(px+5,py-19,1.5,0,7);g.fill();}
  else if(kind==='market'){g.fillStyle='#a7834e';g.beginPath();g.ellipse(px,py-18,4.5,2,0,0,7);g.fill();g.fillStyle='#e2c25e';g.beginPath();g.arc(px-1,py-19.5,1.4,0,7);g.arc(px+1.5,py-19.5,1.3,0,7);g.fill();}
  else if(kind==='bard'){g.strokeStyle='#d9a24a';g.lineWidth=1;g.beginPath();g.moveTo(px+3,py-6);g.lineTo(px+7,py-13);g.lineTo(px+4,py-12);g.closePath();g.stroke();}
  else if(kind==='tax'){g.fillStyle='#d9a24a';g.beginPath();g.arc(px+3.8,py-6,1.8,0,7);g.fill();}
  else if(kind==='immigrant'){g.fillStyle='#8c7a5c';g.beginPath();g.ellipse(px-3,py-10,3,3.6,0,0,7);g.fill();ln([px-5,py-13],[px+2,py-11],'#5a3a1e',.8);}
}
function cartFig(px,py,ph,res){
  g.fillStyle='rgba(0,0,0,.28)';g.beginPath();g.ellipse(px+6,py,9,2.4,0,0,7);g.fill();
  P([[px+1,py-9],[px+12,py-9],[px+12,py-4],[px+1,py-4]],'#7a5232',OUT,.6);
  g.fillStyle=RES[res].c;g.beginPath();g.ellipse(px+6.5,py-10,5,2.4,0,0,7);g.fill();
  g.strokeStyle='#3a2614';g.lineWidth=1.2;g.beginPath();g.arc(px+8,py-3,3,0,7);g.stroke();
  ln([px+1,py-7],[px-2,py-8],'#5a3a1e',1);
  figure(px-4,py,ph,'#7b5a38','cart');
}

/* ---------- défense : remparts, unités, raids ---------- */
let FE=null,FW=null;const FX=[];
const ESP=.075,WSP=.1;
function monDone(t){return monumentDone(S,t);}
function monProg(b){const d=B[b.type].mon;let a=0,n=0;for(const r in d){n+=d[r];a+=Math.min(d[r],(b.got&&b.got[r])||0);}return n?a/n:1;}
function passE(i){const t=S.ter[i];if(t===3||S.occ[i])return false;if(t===2&&!S.road[i])return false;return true;}
function passW(i){return passE(i)&&S.wall[i]!==1;}
function field(src,cost){const D=new Float32Array(N*N).fill(1e9);const bk=[];const push=(i,d)=>{(bk[d]||(bk[d]=[])).push(i);};
  for(const s of src){if(D[s]>0){D[s]=0;push(s,0);}}
  for(let d=0;d<bk.length;d++){const q=bk[d];if(!q)continue;for(let k=0;k<q.length;k++){const i=q[k];if(D[i]!==d)continue;
    for(const j of nb4(i)){const c=cost(j);if(c<0)continue;const nd=d+c;if(nd<D[j]){D[j]=nd;push(j,nd);}}}}
  return D;}
function enemyField(){const src=[];for(const b of blds())for(const t of tilesOf(b))for(const j of nb4(t))if(passE(j)&&!S.wall[j])src.push(j);
  return field(src,j=>passE(j)?(S.wall[j]?12:S.ter[j]===1?2:1):-1);}
function warriorField(){const src=S.u.filter(u=>u.k==='enemy').map(u=>u.cur);return field(src,j=>passW(j)?(S.ter[j]===1?2:1):-1);}
function gridPath(start,goal){const prev=new Int32Array(N*N).fill(-2);prev[start]=-1;const q=[start];let h=0;
  while(h<q.length){const i=q[h++];if(goal(i)){const p=[];let k=i;while(k!==-1){p.push(k);k=prev[k];}return p.reverse();}
    for(const j of nb4(i))if(prev[j]===-2&&passW(j)){prev[j]=i;q.push(j);}}return null;}
function spawnUnit(k,i,home){const heroes=monDone('heroes');const max=k==='enemy'?24:(heroes?40:30);
  const u={k,cur:i,nxt:i,t:0,hp:max,max,home:home||0,ox:(R()-.5)*.5,oy:(R()-.5)*.5};upos(u);S.u.push(u);return u;}
function upos(u){u.px=HX(u.cur)+(HX(u.nxt)-HX(u.cur))*u.t;u.py=HY(u.cur)+(HY(u.nxt)-HY(u.cur))*u.t;}
function nearest(k,u,r){let best=null,bd=r;for(const v of S.u){if(v.k!==k||v.dead)continue;const d=Math.hypot(v.px-u.px,v.py-u.py);if(d<bd){bd=d;best=v;}}return best;}
function hurt(u,d){if(u.dead)return;u.hp-=d;if(u.hp<=0){u.dead=true;if(u.k==='enemy')S.loot=(S.loot||0)+8;else S.fallen=(S.fallen||0)+1;}}
function wDmg(){return .45*(monDone('heroes')?1.5:1)*(.8+.4*S.favor/100);}
const EDMG=.35;
function stepEnemy(u){
  const foe=nearest('warrior',u,1.05);if(foe){hurt(foe,EDMG);return;}
  if(u.nxt===u.cur){
    if(u.bT){const b=S.b[u.bT];if(b){b.hp-=EDMG;if(b.type==='port'){b.hp=Math.max(5,b.hp);u.pill=(u.pill||0)+1;if(u.pill>180){const l=Math.min(Math.floor(S.money),25);S.money-=l;u.dead=true;u.fled=1;if(!S.flags.pillMsg){S.flags.pillMsg=1;log(`Des pillards ont mis le port à sac et repris la mer avec ${l} statères.`);}}return;}if(b.hp<=0){{const[fx,fy]=bc(b);FX.push({k:'fire',x:fx,y:fy,t:90});}log(`Les pillards ont incendié : ${B[b.type].n.toLowerCase()}.`);removeB(b.id);FE=null;u.bT=0;}return;}u.bT=0;}
    if(u.wallT!=null){if(S.wall[u.wallT]){S.whp[u.wallT]-=EDMG*1.4;if(S.whp[u.wallT]<=0){const g2=S.wall[u.wallT]===2;S.wall[u.wallT]=0;FE=null;if(!S.breach){S.breach=1;log(g2?"Les pillards ont enfoncé une porte !":"Les pillards ont ouvert une brèche dans le rempart !");}}return;}u.wallT=null;}
    if(!FE)FE=enemyField();
    const i=u.cur;
    for(const j of nb4(i)){const id=S.occ[j];if(id&&S.b[id]){u.bT=id;return;}}
    let best=-1,bd=FE[i];for(const j of nb4(i)){if(!passE(j))continue;if(FE[j]<bd){bd=FE[j];best=j;}}
    if(best<0)return;
    if(S.wall[best]){u.wallT=best;return;}
    u.nxt=best;
  }
  u.t+=ESP*(S.ter[u.nxt]===1?.6:1);if(u.t>=1){u.cur=u.nxt;u.t=0;}
}
function stepWarrior(u){
  const foe=nearest('enemy',u,1.05);if(foe){hurt(foe,wDmg());return;}
  const raid=S.u.some(v=>v.k==='enemy');
  if(!raid&&u.hp<u.max)u.hp=Math.min(u.max,u.hp+.04);
  if(u.nxt===u.cur){
    if(raid){u.path=null;if(!FW)FW=warriorField();const i=u.cur;let best=-1,bd=FW[i];
      for(const j of nb4(i)){if(!passW(j))continue;if(FW[j]<bd){bd=FW[j];best=j;}}if(best<0)return;u.nxt=best;}
    else{
      const h=S.b[u.home];if(!h)return;
      if(!u.path){const acc=access(h);if(!acc.length||acc.includes(u.cur)||hdist(u.cur,idx(h.x,h.y))<=2)return;
        u.path=gridPath(u.cur,i=>acc.includes(i));u.pi=0;if(!u.path)return;}
      u.pi++;if(u.pi>=u.path.length){u.path=null;return;}const j=u.path[u.pi];if(!passW(j)){u.path=null;return;}u.nxt=j;}
  }
  u.t+=WSP*(S.ter[u.nxt]===1?.6:1);if(u.t>=1){u.cur=u.nxt;u.t=0;}
}
function stepUnits(){
  if(!S.u.length&&!FX.length)return;
  const anyE=S.u.some(u=>u.k==='enemy');
  if(anyE){if(S.tick%20===0)FE=null;if(S.tick%12===0)FW=null;}
  for(const u of S.u){if(u.dead)continue;if(u.k==='enemy')stepEnemy(u);else stepWarrior(u);upos(u);}
  if(anyE&&S.gf&&S.gf.taranis>60&&S.tick%40===0){const es=S.u.filter(u=>u.k==='enemy'&&!u.dead);if(es.length){const e=es[(R()*es.length)|0];hurt(e,20);FX.push({k:'bolt',x:e.px,y:e.py,t:12});}}
  S.u=S.u.filter(u=>!u.dead);
  for(const f of FX)f.t--;for(let k=FX.length-1;k>=0;k--)if(FX[k].t<=0)FX.splice(k,1);
  if(S.raid&&!S.u.some(u=>u.k==='enemy')){S.flags.pillMsg=0;S.raid=0;const l=S.loot||0;S.money+=l;S.loot=0;S.flags.raidWon=1;S.breach=0;FW=null;
    log(`Les pillards sont repoussés.${l?` Leurs armes et leurs bijoux rapportent ${l} statères.`:''}${S.fallen?` ${S.fallen} guerrier(s) sont tombés.`:''}`);S.fallen=0;toast("Raid repoussé");}
}
function raidSource(){FE=enemyField();const c=[];const pi=S.entry!=null?S.entry:-1;
  for(let i=0;i<N*N;i++){if(S.ter[i]===2||!passE(i)||FE[i]>=1e8)continue;if(!nb4(i).some(j=>S.ter[j]===2&&!S.road[j]))continue;if(pi>=0&&hdist(i,pi)<10)continue;c.push(i);}
  if(!c.length)for(let k=0;k<N;k++)for(const i of[idx(k,0),idx(k,N-1),idx(0,k),idx(N-1,k)])if(FE[i]<1e8&&i!==ENTRY()&&!c.includes(i))c.push(i);
  return c;}
function sideOf(i){const d=(Math.atan2(HY(i)-N*.433,HX(i)-N/2)*180/Math.PI+360)%360;return d<45||d>=315?"l'est":d<135?'le sud':d<225?"l'ouest":'le nord';}
function startRaid(){
  const c=raidSource();if(!c.length)return false;
  let s=S.raidFrom!=null&&c.includes(S.raidFrom)?S.raidFrom:c[(R()*c.length)|0];
  c.sort((a,b)=>hdist(a,s)-hdist(b,s));
  const n=Math.min(14,3+Math.floor(S.pop/30));
  for(let k=0;k<n;k++)spawnUnit('enemy',c[k%Math.min(c.length,5)]);
  S.raid=1;S.breach=0;S.fallen=0;
  {const wj=nb4(s).find(j=>S.ter[j]===2);if(wj!=null)FX.push({k:'raider',d:wj,t:420});}
  log(`${n} pillards débarquent sur la côte, par ${sideOf(s)} de l'île. Aux armes !`);toast("Les pillards attaquent !");return true;
}
function raidMonthly(){
  if(S.raids===false||S.pop<BAL.raidMinPop)return;
  if(S.raidNext==null)S.raidNext=S.mi+12;
  if(!S.raidWarn&&S.mi>=S.raidNext-1&&!S.raid){const c=raidSource();if(c.length){S.raidFrom=c[(R()*c.length)|0];S.raidWarn=1;
    log(`Les guetteurs aperçoivent des voiles pillardes au large, côté ${sideOf(S.raidFrom).replace(/^(le |l')/,'')}. Elles aborderont le mois prochain.`);}}
  if(S.mi>=S.raidNext&&!S.raid){startRaid();S.raidNext=S.mi+16+((R()*8)|0);S.raidWarn=0;}
}
function buildWall(list){let blocked=false;
  for(const i of list){if(S.occ[i]||S.wall[i]||(S.deco&&S.deco[i]))continue;const gate=!!S.road[i];const c=gate?15:6;
    if(!gate&&S.ter[i]!==0){blocked=true;continue;}if(S.money<c){toast("Pas assez de statères");break;}
    S.money-=c;S.wall[i]=gate?2:1;S.whp[i]=100;}
  if(blocked)toast("Le rempart ne s'élève que sur la prairie ou sur un chemin");FE=null;}
function stepDefB(b,acc,ef){
  if(b.type==='tower'){if(ef<=0){b.status="Personne pour y travailler : il faut plus d'habitants";return;}
    b.cool-=1;if(b.cool>0)return;b.cool=12;
    const[cx,cy]=bc(b);let best=null,bd=4.5;for(const u of S.u){if(u.k!=='enemy'||u.dead)continue;const d=Math.hypot(u.px-cx,u.py-cy);if(d<bd){bd=d;best=u;}}
    if(best){hurt(best,5*ef);FX.push({k:'arrow',x0:cx,y0:cy,x1:best.px,y1:best.py,t:6});b.status="Tire sur les pillards";}else b.status="Guette l'horizon";return;}
  if(b.type==='barracks'){const mine=S.u.filter(u=>u.k==='warrior'&&u.home===b.id).length;
    if(ef<=0){b.status=`${mine} guerrier(s) · personne pour les entraîner`;return;}
    if(mine>=6){b.status="6 guerriers prêts au combat";return;}
    if(stockOf('fer')<2){b.status=`${mine} guerrier(s) · en attente de fer à l'entrepôt`;return;}
    b.status=`${mine} guerrier(s) · entraînement en cours`;b.prog+=ef;
    if(b.prog>=80){b.prog=0;take('fer',2);spawnUnit('warrior',acc[(R()*acc.length)|0],b.id);if(!S.flags.w1){S.flags.w1=1;log("Le premier guerrier du clan a reçu ses armes.");}}return;}
}
function stepMon(b,ef){const d=B[b.type];
  if(b.done){b.status="Achevé";return;}
  if(ef<=0){b.status="Chantier à l'arrêt : il faut plus d'habitants";return;}
  b.cool-=ef;if(b.cool>0)return;b.cool=5;
  const miss=Object.keys(d.mon).filter(r=>(b.got[r]||0)<d.mon[r]);
  if(!miss.length){b.done=true;b.hp=b.maxhp=400;log(MONMSG[b.type]);toast(B[b.type].n+" achevé");staff();return;}
  const av=miss.filter(r=>stockOf(r)>=1);
  if(!av.length){b.status="Chantier arrêté : il manque "+miss.map(r=>RES[r].n.toLowerCase()).join(', ')+" à l'entrepôt";return;}
  const r=av[(R()*av.length)|0];take(r,1);b.got[r]=(b.got[r]||0)+1;b.status="Chantier en cours";}
const MONMSG={menhirs:"L'alignement de menhirs est dressé. Les dieux contemplent l'oppidum avec bienveillance.",
  tumulus:"Le tumulus royal est achevé. Les ancêtres veillent : le tribut rentre mieux et les familles affluent.",
  heroes:"Le sanctuaire des héros est consacré. Les guerriers se battent désormais avec la force de leurs ancêtres."};
function godsMonthly(){
  const bonus=monDone('menhirs')?15:0;
  for(const gd of['taranis','belenos','epona']){const n=blds().filter(b=>b.type==='t_'+gd&&b.wk>0).length;const tg=Math.min(100,35+30*n+bonus);S.gf[gd]+=(tg-S.gf[gd])*.2;}
  if(S.gf.belenos>70&&R()<.12&&blds().some(b=>b.type==='granary')){putAny('ble',40);log("Bélénos fait mûrir les blés : 40 blé de plus au grenier.");}
}

/* ---- art : défense, temples, monuments ---- */

function unitFig(u,px,py,ph){const en=u.k==='enemy';
  figure(px,py,ph,en?'#5d6b3c':'#3f66a3','soldier');
  if(en){ln([px+3,py-2],[px+5,py-21],'#6b4626',1);P([[px+4.2,py-21],[px+5.8,py-21],[px+5,py-24.5]],'#cfd3d8');g.fillStyle='#7a5232';g.beginPath();g.ellipse(px-3.6,py-8,3.2,4.2,0,0,7);g.fill();g.strokeStyle='#3a2614';g.lineWidth=.6;g.stroke();}
  else{g.fillStyle='#d9c27a';g.beginPath();g.ellipse(px-3.6,py-8,2.6,5,0,0,7);g.fill();g.strokeStyle='#b4553f';g.lineWidth=1;g.stroke();ln([px+3,py-7],[px+6,py-15],'#d8dde2',1.3);}
  if(u.hp<u.max){g.fillStyle='rgba(0,0,0,.6)';g.fillRect(px-6,py-29,12,2.6);g.fillStyle=en?'#de6a4e':'#86b86a';g.fillRect(px-6,py-29,12*Math.max(0,u.hp/u.max),2.6);}
}
function shipFig(px,py,s,hull,sail,time,ph){const b=Math.sin(time/700+ph)*1.6;py+=b;
  g.fillStyle='rgba(20,36,46,.35)';g.beginPath();g.ellipse(px+3*s,py+3*s,26*s,6*s,0,0,7);g.fill();
  const H=[[px-24*s,py-12*s],[px-18*s,py-2*s],[px+16*s,py-2*s],[px+24*s,py-13*s],[px+18*s,py-7*s],[px-17*s,py-7*s]];
  P([H[0],H[5],H[4],H[3],H[2],H[1]],hull);P([H[5],H[4],H[3],[px+22*s,py-14*s],[px-22*s,py-13*s]],sh(hull,1.25));
  P([[px-24*s,py-12*s],[px-27*s,py-22*s],[px-22*s,py-13*s]],sh(hull,.85));P([[px+24*s,py-13*s],[px+27*s,py-24*s],[px+22*s,py-14*s]],sh(hull,.85));
  ln([px,py-8*s],[px,py-46*s],'#3a2a1c',1.6*s);
  P([[px-13*s,py-42*s],[px+13*s,py-43*s],[px+12*s,py-18*s],[px-12*s,py-17*s]],sail);P([[px,py-42.5*s],[px+13*s,py-43*s],[px+12*s,py-18*s],[px,py-17.5*s]],sh(sail,.82));
  for(const y of[-36,-29,-22])ln([px-12.5*s,py+(y)*s],[px+12.5*s,py+(y-.6)*s],sh(sail,.6),.5);}
function drawFX(time){for(const f of FX){
  if(f.k==='ship'||f.k==='raider'){const d=f.d,dx=HX(d)-N/2,dy=HY(d)-N*.433,n=Math.hypot(dx,dy)||1;let o=0;
    if(f.k==='ship'){const t=300-f.t;o=t<120?(1-t/120)*9:t>180?((t-180)/120)*9:0;}
    const[px,py]=W(HX(d)+dx/n*o,HY(d)+dy/n*o,ZW);if(f.k==='ship')shipFig(px,py,.9,'#5a4030','#9a6a44',time,1);else shipFig(px,py,.9,'#33261c','#4a2e28',time,2);continue;}
  if(f.k==='arrow'){const a=W(f.x0,f.y0,30),b=W(f.x1,f.y1,9),t=1-f.t/6;const x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t-Math.sin(t*Math.PI)*10;
    const dx=(b[0]-a[0]),dy=(b[1]-a[1]),n=Math.hypot(dx,dy)||1;ln([x,y],[x-dx/n*6,y-dy/n*6],'#f0e6c8',1.2);}
  else if(f.k==='bolt'){const[bx,by]=W(f.x,f.y);ctx.globalAlpha=Math.min(1,f.t/6);g.strokeStyle='#e8f0ff';g.lineWidth=2.2;g.beginPath();let x=bx+((f.t*37)%20-10),y=by-220;g.moveTo(x,y);
    while(y<by-4){y+=22;x+=((y*13)%17)-8;g.lineTo(y>by?bx:x,Math.min(y,by));}g.stroke();g.fillStyle='rgba(220,235,255,.5)';g.beginPath();g.arc(bx,by-4,14,0,7);g.fill();ctx.globalAlpha=1;}
  else if(f.k==='fire'){for(let k=0;k<5;k++){const ph=((time/900)+k/5)%1;const[px,py]=W(f.x,f.y,8+ph*40);g.fillStyle=`rgba(${k%2?'240,120,40':'70,66,60'},${.5*(1-ph)*Math.min(1,f.t/30)})`;g.beginPath();g.arc(px+Math.sin(ph*6+k)*8,py,5+ph*10,0,7);g.fill();}}
}}

/* ---- terrain low-poly : hexagones facettés ---- */

function facetRound(base,rnd,amp){
  const cs=[];for(let k=0;k<6;k++)cs.push(corner(0,0,k,HR));const top=rbound(cs,[0,0,0,0,0,0],null).map(p=>[p[0]*INS,p[1]*INS,0,p[3]]);
  const c=[(rnd()-.5)*.12,(rnd()-.5)*.1];
  for(let k=0;k<top.length;k++){const a=top[k],b=top[(k+1)%top.length];const mid=Math.atan2((a[1]+b[1])/2,(a[0]+b[0])/2);
    const f=1+amp*Math.cos(mid+ROT-Math.PI*1.25)+(((a[3]*37)%7)/7-.5)*amp*.5;P([W(c[0],c[1]),W(a[0],a[1]),W(b[0],b[1])],sh(base,f),sh(base,f),.4);}}
function facetHex(base,rnd,amp){
  const c=[(rnd()-.5)*.16,(rnd()-.5)*.14],pts=[];for(let k=0;k<6;k++)pts.push(corner(0,0,k,HR*1.012));
  for(let k=0;k<6;k++){const a=pts[k],b=pts[(k+1)%6];const mid=(60*k-60)*Math.PI/180;
    const f=1+amp*Math.cos(mid+ROT-Math.PI*1.25)+(rnd()-.5)*amp*.6;
    P([W(c[0],c[1]),W(a[0],a[1]),W(b[0],b[1])],sh(base,f));}
}
function clump(x,y,r,cols,rnd,h){const n=5+(rnd()*2|0),pts=[];for(let k=0;k<n;k++){const a=k/n*Math.PI*2+rnd()*.4;pts.push([x+Math.cos(a)*r*(.75+rnd()*.4),y+Math.sin(a)*r*.55*(.75+rnd()*.4)]);}
  const top=[x-r*.15,y-h];for(let k=0;k<n;k++){const a=pts[k],b=pts[(k+1)%n];const m=Math.atan2((a[1]+b[1])/2-y,(a[0]+b[0])/2-x);
    P([top,a,b],sh(cols,1+.14*Math.cos(m-Math.PI*1.25)));}}
/* ---- relief continu : chaque coin d'hexagone prend la hauteur moyenne des trois hexagones qui le partagent ---- */
let GEO=[],GEOS=null,GEOV=-1;
const LIGHT=(()=>{const v=[-.45,-.55,.9],n=Math.hypot(...v);return v.map(a=>a/n);})(),FLAT=LIGHT[2];
function cornerZ(i,k){const a=nbDir(i,EDGE_DIR[k]),b=nbDir(i,EDGE_DIR[(k+5)%6]);let s=(S.hgt?S.hgt[i]:0)*STEP,n=1,wet=false;
  for(const j of[a,b]){if(j<0)continue;if(S.ter[j]===2&&!S.road[j]){wet=true;continue;}s+=(S.hgt?S.hgt[j]:0)*STEP;n++;}
  const z=s/n;return wet&&z<STEP*1.6?ZW+3:z;}
function isBeach(i){return S.ter[i]===0&&(!S.hgt||S.hgt[i]<=1)&&nb4(i).some(j=>S.ter[j]===2&&!S.road[j]);}
const RT=.26,INS=.955;
function rbound(cs,zs,sharp){const o=[];for(let k=0;k<6;k++){const c=cs[k],p=cs[(k+5)%6],n=cs[(k+1)%6],zc=zs[k],zp=zs[(k+5)%6],zn=zs[(k+1)%6];
    if(sharp&&sharp[k]){o.push([c[0],c[1],zc,k]);continue;}
    const a=[c[0]+(p[0]-c[0])*RT,c[1]+(p[1]-c[1])*RT,zc+(zp-zc)*RT,k],b=[c[0]+(n[0]-c[0])*RT,c[1]+(n[1]-c[1])*RT,zc+(zn-zc)*RT,k];
    o.push(a,[.25*a[0]+.5*c[0]+.25*b[0],.25*a[1]+.5*c[1]+.25*b[1],.25*a[2]+.5*zc+.25*b[2],k],b);}
  return o;}
function triShade(A,Bp,C){const u=[Bp[0]-A[0],Bp[1]-A[1],Bp[2]-A[2]],w=[C[0]-A[0],C[1]-A[1],C[2]-A[2]];let n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];
  if(n[2]<0)n=n.map(a=>-a);const nn=Math.hypot(...n)||1;return(n[0]*LIGHT[0]+n[1]*LIGHT[1]+n[2]*LIGHT[2])/nn-FLAT;}
const isLand=j=>j>=0&&(S.ter[j]!==2||S.road[j]);
function geoTile(i){
  const t=S.ter[i],cx=HX(i),cy=HY(i),v=S.vr[i],zc=ZH(i)+(v-.5)*3,jc=[cx+(v-.5)*.08,cy+(((v*7)%1)-.5)*.08];
  const kind=isBeach(i)?'b':t===0?(S.lnd&&S.lnd[i]?'l':'g'):t===1?'f':'r';
  const base=kind==='b'?'#c8b996':TCOL[kind];
  const cs=[],zs=[];for(let k=0;k<6;k++){cs.push(corner(cx,cy,k,HR*1.004));zs.push(cornerZ(i,k));}
  // sous-couche : coins vifs à l'intérieur des terres, arrondis sur le rivage
  const sharp=[0,1,2,3,4,5].map(k=>isLand(nbDir(i,EDGE_DIR[(k+5)%6]))&&isLand(nbDir(i,EDGE_DIR[k])));
  const under=[rbound(cs,zs,sharp).map(p=>W(p[0],p[1],p[2]-.6)),sh(base,.58)];
  // dessus : hexagone arrondi, légèrement rentré pour marquer les joints
  const top=rbound(cs,zs,null).map(p=>[cx+(p[0]-cx)*INS,cy+(p[1]-cy)*INS,p[2],p[3]]);
  const tris=[],L=top.length;
  for(let s2=0;s2<L;s2++){const p=top[s2],q=top[(s2+1)%L];
    const d=triShade([jc[0]*HW,jc[1]*HW,zc],[p[0]*HW,p[1]*HW,p[2]],[q[0]*HW,q[1]*HW,q[2]]);
    const f=(1+1.15*d+(((v*31+p[3]*7)%1)-.5)*.035)*(1+.01*zc/STEP);
    tris.push([[W(jc[0],jc[1],zc),W(p[0],p[1],p[2]),W(q[0],q[1],q[2])],sh(base,f)]);}
  // falaises le long du contour arrondi
  const bot=[0,1,2,3,4,5].map(e=>{const j=nbDir(i,EDGE_DIR[e]);if(j<0)return-30;if(S.ter[j]===2&&!S.road[j]&&Math.max(zs[e],zs[(e+1)%6])>ZW+4)return ZW-1;return null;});
  const cliffs=[];
  for(let s2=0;s2<L;s2++){const p=top[s2],q=top[(s2+1)%L];let zb;
    if(p[3]===q[3]){const a=bot[(p[3]+5)%6],b=bot[p[3]];zb=a!=null&&b!=null?Math.min(a,b):(a??b);}else zb=bot[p[3]];
    if(zb==null)continue;
    const mx=(p[0]+q[0])/2-cx,my=(p[1]+q[1])/2-cy,dx=q[0]-p[0],dy=q[1]-p[1];let nx=dy,ny=-dx;if(nx*mx+ny*my<0){nx=-nx;ny=-ny;}const nn=Math.hypot(nx,ny)||1;nx/=nn;ny/=nn;
    if(!vis(nx,ny))continue;const col=zb<=-30?'#8a7a70':'#9a8a84',f=fshade(nx,ny);
    cliffs.push([[W(p[0],p[1],p[2]),W(q[0],q[1],q[2]),W(q[0],q[1],zb),W(p[0],p[1],zb)],sh(col,f)]);}
  return{tris,cliffs,under,kind,zc,zs};}
function geo(i){if(GEOS!==S||GEOV!==(S.hver||0)){GEO=[];GEOS=S;GEOV=S.hver||0;}return GEO[i]||(GEO[i]=geoTile(i));}
/* les terres sont peintes une fois par blocs de 12×12 hexagones, puis réutilisées tant que rien ne change */
const CHN=12;let CHK={},CHKV=-1,CHKS=null;
function chunk(cx2,cy2){if(CHKS!==S||CHKV!==(S.hver||0)){CHK={};CHKS=S;CHKV=S.hver||0;}const key=cx2+','+cy2;if(key in CHK)return CHK[key];
  const ts=[];for(let y=cy2*CHN;y<Math.min(N,(cy2+1)*CHN);y++)for(let x=cx2*CHN;x<Math.min(N,(cx2+1)*CHN);x++){const i=idx(x,y);if(S.ter[i]!==2||S.road[i])ts.push(i);}
  if(!ts.length)return CHK[key]=null;
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const i of ts){const[wx,wy]=W(HX(i),HY(i));x0=Math.min(x0,wx-44);x1=Math.max(x1,wx+44);y0=Math.min(y0,wy-110);y1=Math.max(y1,wy+60);}
  const SC=(window.devicePixelRatio||1)>1?1.6:1.3,c=document.createElement('canvas');c.width=Math.ceil((x1-x0)*SC);c.height=Math.ceil((y1-y0)*SC);
  const prev=g;g=c.getContext('2d');g.setTransform(SC,0,0,SC,-x0*SC,-y0*SC);g.lineJoin='round';
  try{ts.sort((a,b)=>DPi(a)-DPi(b));
    for(const i of ts){const t=S.ter[i];if(t!==2){const G=geo(i),[wx,wy]=W(HX(i),HY(i));P(G.under[0],G.under[1]);for(const[p,cl]of G.tris)P(p,cl,cl,.5);for(const[p,cl]of G.cliffs)P(p,cl,cl,.5);
      blit(tileDecor(G.kind,(S.vr[i]*(t===0?6:3))|0),wx,wy-G.zc);}}
    for(const i of ts)if(S.road[i])roadBand(i,0);}
  finally{g=prev;}
  return CHK[key]={c,x0,y0,w:x1-x0,h:y1-y0};}
function tileDecor(kind,v){return sprite('dc'+kind+v,-34,-24,34,18,rnd=>{
  const spot=()=>{const a=rnd()*Math.PI*2,d=rnd()*.33;return W(Math.cos(a)*d,Math.sin(a)*d);};
  if(kind==='g'){for(let k=0;k<3;k++){const[x,y]=spot();clump(x,y,2.4,'#6a8458',rnd,3);}}
  else if(kind==='l'){for(let k=0;k<4;k++){const[x,y]=spot();clump(x,y,3.6+rnd()*1.5,pick3(rnd,['#8e6c8f','#7d5f80','#9a789c']),rnd,3);}
    if(v%2===0)for(let k=0;k<2;k++){const[x,y]=spot();clump(x,y,3,'#d4b23c',rnd,4);}}
  else if(kind==='f'){for(let k=0;k<3;k++){const[x,y]=spot();clump(x,y,2.6,'#5a4a3a',rnd,1.5);}}
  else if(kind==='r'){for(let k=0;k<3;k++){const[x,y]=spot();clump(x,y,2.6,'#a3958f',rnd,2);}}
  else if(kind==='b'){for(let k=0;k<2;k++){const[x,y]=spot();clump(x,y,1.6,'#a39a86',rnd,1);}}
});}
function tileSpr(kind,v){return sprite('hR'+kind+v,-36,-26,36,26,rnd=>{
  const base=sh(TCOL[kind],.985+rnd()*.03);if(kind==='w'||kind==='s')facetRound(base,rnd,.035);else facetHex(base,rnd,.05);
  const spot=()=>{const a=rnd()*Math.PI*2,d=rnd()*.33;const p=W(Math.cos(a)*d,Math.sin(a)*d);return p;};
  if(kind==='g'){for(let k=0;k<3;k++){const[x,y]=spot();clump(x,y,2.4,'#6a8458',rnd,3);}}
  else if(kind==='l'){for(let k=0;k<4;k++){const[x,y]=spot();clump(x,y,3.6+rnd()*1.5,pick3(rnd,['#8e6c8f','#7d5f80','#9a789c']),rnd,3);}
    if(v%2===0)for(let k=0;k<2;k++){const[x,y]=spot();clump(x,y,3,'#d4b23c',rnd,4);}}
  else if(kind==='f'){for(let k=0;k<3;k++){const[x,y]=spot();clump(x,y,2.6,'#5a4a3a',rnd,1.5);}}
  else if(kind==='r'){for(let k=0;k<3;k++){const[x,y]=spot();clump(x,y,2.6,'#a3958f',rnd,2);}}
  else if(kind==='s'&&v===0){const[x,y]=spot();clump(x,y,2.4,'#5e7c84',rnd,0);}
});}

function softShadow(x,y,rx,ry){blur(1);g.fillStyle='rgba(20,28,34,.26)';g.beginPath();g.ellipse(x,y,rx,ry,0,0,7);g.fill();blur(0);}

function hexPrism(cx,cy,r,z0,z1,top,side){
  const c=k=>corner(cx,cy,k,r);
  for(const k of VISK){const a=c(k),b=c((k+1)%6),an=(60*k-60)*Math.PI/180;P([W(a[0],a[1],z0),W(b[0],b[1],z0),W(b[0],b[1],z1),W(a[0],a[1],z1)],sh(side,fshade(Math.cos(an),Math.sin(an))),'rgba(30,24,22,.35)',.5);}
  P(hexPts(cx,cy,r,z1),top,'rgba(30,24,22,.35)',.5);}
function wallSpr(kind){return sprite('hw_'+kind,-40,-50,40,30,rnd=>{
  if(kind==='g'){for(const sx of[-.3,.3]){hexPrism(sx,0,HR*.32,0,20,'#a39790','#8f837d');}
    P([W(-.36,-.06,22),W(.36,-.06,22),W(.36,.06,18),W(-.36,.06,18)],'#5e4a38','rgba(30,24,22,.4)',.5);return;}
  const dmg=kind==='d';hexPrism(0,0,HR*.98,0,13,dmg?'#6f7a52':'#738450',dmg?'#7d716a':'#958983');
  for(let k=0;k<6;k++){const[x,y]=corner(0,0,k,HR*.55);const p=W(x,y,13);P([[p[0]-1.2,p[1]],[p[0]+1.2,p[1]],[p[0]+.6,p[1]-8],[p[0]-.6,p[1]-8]],'#5a4636');}
  if(dmg){const p=W(.1,.45,8);P([[p[0]-4,p[1]-6],[p[0]+5,p[1]-3],[p[0]+1,p[1]+4]],'#3e3430');}
});}
function roadBand(i,time){
  const cx=HX(i),cy=HY(i),bridge=S.ter[i]===2,links=[];
  for(const j of nb4(i))if(S.road[j]||(S.occ[j]&&!bridge))links.push(j);
  const wd=.17,col=bridge?'#7a6452':'#a59885',edge=bridge?'#4e3e30':'#857a6a';
  const zc=ZH(i);
  const band=(j,w,c)=>{const mx=(cx+HX(j))/2,my=(cy+HY(j))/2,dx=mx-cx,dy=my-cy,n=Math.hypot(dx,dy),px=-dy/n*w,py=dx/n*w,zm=(zc+ZH(j))/2;
    P([W(cx+px,cy+py,zc),W(mx+px,my+py,zm),W(mx-px,my-py,zm),W(cx-px,cy-py,zc)],c);};
  const hub=(w,c)=>P(hexPts(cx,cy,w*1.15,zc),c);
  for(const j of links)if(S.road[j])band(j,wd+.04,edge);hub(wd+.04,edge);
  for(const j of links)if(S.road[j])band(j,wd,col);hub(wd,col);
  if(bridge){for(const j of links)if(S.road[j]){const mx=(cx+HX(j))/2,my=(cy+HY(j))/2;ln(W(cx,cy-.18,zc+4),W(mx,my-.18,(zc+ZH(j))/2+4),'#4e3e30',1.4);}
    const p=W(cx,cy,zc);ln([p[0]-8,p[1]+2],[p[0]-8,p[1]+12],'#3e3228',2);ln([p[0]+8,p[1]+2],[p[0]+8,p[1]+12],'#3e3228',2);}
}

/* ---- décors naturels : volumes arrondis, ombrés au crayon, posés sur un tapis qui remplit la case ---- */

function smoothPts(pts){const n=pts.length,o=[];for(let k=0;k<n;k++){const p=pts[(k+n-1)%n],c=pts[k],q=pts[(k+1)%n];
    const a=[(p[0]+c[0])/2,(p[1]+c[1])/2],b=[(c[0]+q[0])/2,(c[1]+q[1])/2];
    for(let t=0;t<1;t+=1/6){const u=1-t;o.push([u*u*a[0]+2*u*t*c[0]+t*t*b[0],u*u*a[1]+2*u*t*c[1]+t*t*b[1]]);}}return o;}
function pathPts(sp,closed){g.beginPath();g.moveTo(sp[0][0],sp[0][1]);for(let k=1;k<sp.length;k++)g.lineTo(sp[k][0],sp[k][1]);if(closed)g.closePath();}
function roundPath(pts){pathPts(smoothPts(pts),true);}
function irregular(x,y,rx,ry,n,rnd,var_){const o=[];const v=var_??.22;for(let k=0;k<n;k++){const a=k/n*Math.PI*2+(rnd()-.5)*.4,m=1-v/2+rnd()*v;o.push([x+Math.cos(a)*rx*m,y+Math.sin(a)*ry*m]);}return o;}
/* trait hésitant : épaisseur qui varie, léger tremblé, quelques reprises */
function pencil(sp,closed,w,rnd,col,alpha){const n=sp.length,m=closed?n:n-1;g.lineCap='round';
  for(let pass=0;pass<2;pass++){g.strokeStyle=col||INK;g.globalAlpha=(alpha||.75)*(pass?.45:1);let ph=rnd()*6;
    for(let k=0;k<m;k++){if(pass&&rnd()<.07)continue;const a=sp[k],b=sp[(k+1)%n];ph+=.55+rnd()*.3;
      g.lineWidth=w*(.55+.6*(.5+.5*Math.sin(ph)))*(pass?.7:1);const j=w*.35;
      g.beginPath();g.moveTo(a[0]+(rnd()-.5)*j,a[1]+(rnd()-.5)*j);g.lineTo(b[0]+(rnd()-.5)*j,b[1]+(rnd()-.5)*j);g.stroke();}}
  g.globalAlpha=1;}
function hatchIn(cx,cy,rx,ry,rnd,col,n,len){g.strokeStyle=col;g.lineCap='round';
  for(let k=0;k<n;k++){const a=rnd()*Math.PI*.9-.1,d=.35+rnd()*.6,x=cx+Math.cos(a)*rx*d,y=cy+Math.sin(a)*ry*d;
    g.globalAlpha=.25+rnd()*.25;g.lineWidth=.6+rnd()*.5;g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+len*.5,y+len*.15,x+len*.8,y+len*.55);g.stroke();}g.globalAlpha=1;}
function mass(x,y,rx,ry,base,rnd,opt){opt=opt||{};const pts=irregular(x,y,rx,ry,opt.n||8,rnd,opt.v),sp=smoothPts(pts);
  pathPts(sp,true);g.fillStyle=base;g.fill();
  g.save();pathPts(sp,true);g.clip();
  g.fillStyle=sh(base,1.2);g.beginPath();g.ellipse(x-rx*.28,y-ry*.32,rx*.62,ry*.55,0,0,7);g.fill();
  g.fillStyle=sh(base,.76);g.beginPath();g.ellipse(x+rx*.42,y+ry*.45,rx*.8,ry*.62,0,0,7);g.fill();
  hatchIn(x+rx*.05,y+ry*.1,rx,ry,rnd,INK,opt.hatch??Math.round(rx*.5),Math.max(3,rx*.28));
  if(opt.ticks)for(let k=0;k<opt.ticks;k++){const px=x-rx*.6+rnd()*rx*.9,py=y-ry*.7+rnd()*ry*.8;g.strokeStyle=sh(base,1.45);g.globalAlpha=.6;g.lineWidth=.8;g.beginPath();g.moveTo(px,py);g.lineTo(px+1.6,py-1.2);g.stroke();}
  g.globalAlpha=1;g.restore();pencil(sp,true,opt.w||1.1,rnd);return sp;}
function trunk2(x,y,w,h,lean,col,rnd){const pts=[[x-w,y],[x-w*.55+lean*.35,y-h*.5],[x-w*.4+lean,y-h],[x+w*.4+lean,y-h],[x+w*.55+lean*.35,y-h*.5],[x+w,y]];
  g.fillStyle=col;g.beginPath();g.moveTo(pts[0][0],pts[0][1]);g.quadraticCurveTo(pts[1][0],pts[1][1],pts[2][0],pts[2][1]);g.lineTo(pts[3][0],pts[3][1]);g.quadraticCurveTo(pts[4][0],pts[4][1],pts[5][0],pts[5][1]);g.closePath();g.fill();
  g.fillStyle=sh(col,.7);g.beginPath();g.moveTo(x+w*.15,y);g.quadraticCurveTo(x+w*.2+lean*.35,y-h*.5,x+w*.05+lean,y-h);g.lineTo(pts[3][0],pts[3][1]);g.quadraticCurveTo(pts[4][0],pts[4][1],pts[5][0],pts[5][1]);g.closePath();g.fill();
  const L=[];for(let t=0;t<=1;t+=.2)L.push([x-w+(w*.6+lean)*t,y-h*t]);pencil(L,false,.9,rnd);const R2=[];for(let t=0;t<=1;t+=.2)R2.push([x+w+(-w*.6+lean)*t,y-h*t]);pencil(R2,false,.9,rnd);}
function contact(x,y,s){g.fillStyle='rgba(22,26,20,.42)';g.beginPath();g.ellipse(x+1.5*s,y+.5*s,6*s,2*s,0,0,7);g.fill();}
function tuft(x,y,s,col,rnd){const sp=mass(x,y-1.5*s,4*s,2.4*s,col,rnd,{n:6,hatch:2,w:.8,v:.3});}
function oak3(x,y,s,rnd,tone){const c=tone||'#3f5338';softShadow(x+7*s,y+1,14*s,5*s);contact(x,y,s);trunk2(x,y,2.4*s,13*s,(rnd()-.5)*2*s,'#5e5040',rnd);
  mass(x+5*s,y-18*s,10*s,7.5*s,sh(c,.88),rnd,{ticks:3});mass(x-4*s,y-20*s,9*s,7*s,c,rnd,{ticks:4});mass(x+2*s,y-26*s,9*s,7*s,sh(c,1.1),rnd,{ticks:5});
  for(let k=0;k<3;k++)tuft(x+(k-1)*4*s+(rnd()-.5)*s,y+1.2*s,s*.8,pick3(rnd,['#56704a','#4c6340','#6a8458']),rnd);}
function pine3(x,y,s,rnd){softShadow(x+9*s,y+1,12*s,4*s);contact(x,y,s);const lean=(6+rnd()*5)*s;
  g.strokeStyle='#5a4636';g.lineWidth=2.8*s;g.lineCap='round';g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+lean*.2,y-15*s,x+lean,y-30*s);g.stroke();
  const L=[];for(let t=0;t<=1;t+=.25){const u=1-t;L.push([u*u*x+2*u*t*(x+lean*.2)+t*t*(x+lean)-1.4*s,u*u*y+2*u*t*(y-15*s)+t*t*(y-30*s)]);}pencil(L,false,.8,rnd);
  mass(x+lean+2*s,y-31*s,13*s,4.8*s,'#2f4134',rnd,{n:9,v:.3,hatch:6,ticks:3});mass(x+lean+5*s,y-36*s,8*s,3.6*s,'#3a4f3e',rnd,{n:8,v:.3,hatch:3,ticks:3});
  for(let k=0;k<2;k++)tuft(x+(k-.5)*5*s,y+1.2*s,s*.8,pick3(rnd,['#6a5a46','#7d5f80','#56704a']),rnd);}
function boulder3(x,y,s,rnd,base){const b=base||'#b49c95';softShadow(x+5*s,y+1,11*s,4*s);contact(x,y,s*1.4);
  mass(x,y-6*s,10*s,7*s,b,rnd,{n:7,v:.25,hatch:Math.round(4*s),w:1.1});
  for(let k=0;k<3;k++){g.fillStyle=pick3(rnd,['#d9cf8a','#e6e2d4','#c9c27a']);g.beginPath();g.ellipse(x-6*s+rnd()*10*s,y-11*s+rnd()*6*s,1.3*s,.8*s,0,0,7);g.fill();}}
function slab3(x,y,s,rnd){softShadow(x+4*s,y+1,12*s,4*s);contact(x,y,s*1.4);const w=11*s,d=4*s,h=(3+rnd()*4)*s,t=(rnd()-.3)*5*s;
  const side=[[x-w,y-h+t],[x-w*.1,y-h+d*.6],[x+w,y-h-d*.6-t],[x+w,y-d*.3],[x-w*.1,y+d*.4],[x-w,y]],top=[[x-w,y-h+t],[x+w*.2,y-h-d-t*.3],[x+w,y-h-d*.6-t],[x-w*.1,y-h+d*.6]];
  roundPath(side);g.fillStyle='#8f7872';g.fill();hatchIn(x,y-h*.4,w,d,rnd,INK,4,4);pencil(smoothPts(side),true,1,rnd);
  roundPath(top);g.fillStyle='#c4aaa2';g.fill();pencil(smoothPts(top),true,.9,rnd);}
function needle3(x,y,h,rnd){softShadow(x+6,y+1,10,3.5);contact(x,y,1.5);const pts=[[x-7,y],[x-5,y-h*.55],[x-1,y-h],[x+3,y-h*.95],[x+7,y-h*.45],[x+8,y]];const sp=smoothPts(pts);
  pathPts(sp,true);g.fillStyle='#b49c95';g.fill();g.save();pathPts(sp,true);g.clip();g.fillStyle='#8f7872';g.beginPath();g.moveTo(x+1,y-h);g.lineTo(x+9,y-h*.4);g.lineTo(x+9,y);g.lineTo(x+1,y);g.fill();
  hatchIn(x+4,y-h*.45,5,h*.45,rnd,INK,8,5);g.restore();pencil(sp,true,1.2,rnd);}
/* le tapis : sous-bois, aiguilles, éboulis ou herbe, qui couvre l'essentiel de la case */
function carpet(rnd,cols,clumps){const pts=irregular(0,0,27,17,14,rnd,.18),sp=smoothPts(pts);pathPts(sp,true);g.fillStyle=cols[0];g.fill();
  g.save();pathPts(sp,true);g.clip();for(let k=0;k<clumps;k++){g.fillStyle=pick3(rnd,cols.slice(1));const a=rnd()*7,d=rnd()*.8;g.beginPath();g.ellipse(Math.cos(a)*24*d,Math.sin(a)*14*d,3+rnd()*5,2+rnd()*2.5,0,0,7);g.fill();}
  hatchIn(4,4,26,15,rnd,INK,10,4);g.restore();pencil(sp,true,.8,rnd,INK,.45);}
function spotsIn(n,rx,ry,rnd){const o=[];let tries=0;while(o.length<n&&tries<200){tries++;const a=rnd()*Math.PI*2,d=Math.sqrt(rnd());const p=[Math.cos(a)*rx*d,Math.sin(a)*ry*d];
    if(o.every(q=>Math.hypot((q[0]-p[0])/1.6,q[1]-p[1])>5.5))o.push(p);}return o.sort((a,b)=>a[1]-b[1]);}
function treeCtx(i){let nf=0;for(const j of nb4(i))if(S.ter[j]===1)nf++;return((LD[i]||9)<=3?'p':'f')+(nf>=5?'d':'e');}
function rockCtx(i){let nr=0,hi=true;for(const j of nb4(i)){if(S.ter[j]===3)nr++;if(S.hgt&&S.hgt[j]>S.hgt[i])hi=false;}return nr>=5?(hi&&(i%4===0)?'rc':'ra'):'rb';}
function treeSpr2(c,v){return sprite('T3'+c+v,-64,-112,64,34,rnd=>{
  const dense=c[1]==='d',pine=c[0]==='p';
  carpet(rnd,pine?['#4e4636','#5e5040','#46523a','#6a5a46']:dense?['#2f3a2b','#3a4634','#2b3527','#45533d']:['#3e4c38','#4a5a42','#7d5f80','#d4b23c'],dense?14:10);
  const pts=[],rows=dense?[-12,-6,0,6,12]:[-10,-3,4,11];
  for(const y of rows){const half=Math.sqrt(Math.max(0,1-(y/16)**2))*24,n=Math.max(1,Math.round(half/(dense?7:8.5)));
    for(let k=0;k<=n;k++){if(!dense&&rnd()<.22)continue;const x=-half+(2*half)*(n?k/n:.5)+(rnd()-.5)*4;pts.push([x,y+(rnd()-.5)*2.5]);}}
  if(!dense)for(const p of spotsIn(3,22,13,rnd))p.push('s'),pts.push(p);
  pts.sort((a,b)=>a[1]-b[1]);
  for(const p of pts){if(p[2]==='s'){tuft(p[0],p[1],1.2,pick3(rnd,['#8e6c8f','#d4b23c','#5d7a4a']),rnd);continue;}
    const s=(dense?1.05:.9)+rnd()*.3;if(pine&&rnd()<.85)pine3(p[0],p[1],s,rnd);else oak3(p[0],p[1],s,rnd,pick3(rnd,['#3c4f37','#435a3b','#4b5f3a','#506640','#3a4a33']));}});}
function rockSpr2(c,v){return sprite('R2'+c+v,-56,-86,56,30,rnd=>{
  if(c==='ra'){carpet(rnd,['#8d817c','#9a8e88','#7d736e','#6a8458'],12);for(const p of spotsIn(4+v%2,19,10,rnd))boulder3(p[0],p[1],.9+rnd()*.5,rnd);if(v===0)boulder3(-3,-8,.8,rnd,'#c2aaa2');}
  else if(c==='rb'){carpet(rnd,['#6f8a5c','#7b9467','#8d817c','#5f7350'],8);for(const p of spotsIn(2+v%2,18,9,rnd))slab3(p[0],p[1],.9+rnd()*.3,rnd);}
  else{carpet(rnd,['#8d817c','#9a8e88','#a8908a'],14);needle3(0,2,56+rnd()*16,rnd);for(const p of spotsIn(3,20,11,rnd))if(Math.abs(p[0])>8)boulder3(p[0],p[1],.5,rnd);}});}
function loneOak(v){return sprite('LO2'+v,-54,-86,54,26,rnd=>{const pts=irregular(2,2,15,8,10,rnd,.2),sp=smoothPts(pts);pathPts(sp,true);g.fillStyle='#6a8458';g.fill();pencil(sp,true,.7,rnd,INK,.35);oak3(0,4,1.35+rnd()*.2,rnd,'#3e5238');});}
const DECO=['','Grand menhir','Dolmen','Chêne des anciens'];
const DECOTXT=['',"Dressé par des peuples bien plus anciens que le vôtre. Nul ne sait qui l'a levé.","Une table de pierre posée sur ses piliers, tombeau d'ancêtres oubliés.","Un chêne millénaire. Les druides disent que le gui y pousse depuis le premier âge."];
function decoSpr(t){return sprite('D2'+t,-70,-150,70,34,rnd=>{
  carpet(rnd,t===2?['#7f7a66','#8e6c8f','#7d5f80','#d4b23c']:['#6a8458','#7b9467','#5d7a4a','#8e6c8f'],12);
  if(t===1){for(let k=0;k<8;k++){const a=k/8*Math.PI*2;boulder3(Math.cos(a)*24,Math.sin(a)*12+2,.36,rnd);}
    const h=96,pts=[[-11,4],[-12,-h*.5],[-7,-h*.92],[2,-h],[9,-h*.82],[12,-h*.4],[11,4]],sp=smoothPts(pts);softShadow(14,4,18,6);contact(0,3,2.5);
    pathPts(sp,true);g.fillStyle='#b49c95';g.fill();g.save();pathPts(sp,true);g.clip();g.fillStyle='#8f7872';g.beginPath();g.moveTo(2,-h);g.lineTo(14,-h*.5);g.lineTo(14,6);g.lineTo(3,6);g.fill();
    g.fillStyle='#c9b1a9';g.beginPath();g.moveTo(-13,-h*.55);g.lineTo(-7,-h*.93);g.lineTo(2,-h);g.lineTo(-3,-h*.6);g.fill();hatchIn(7,-h*.45,7,h*.45,rnd,INK,18,6);
    for(let k=0;k<7;k++){g.fillStyle=pick3(rnd,['#d9cf8a','#e6e2d4']);g.beginPath();g.ellipse(-8+rnd()*16,-h*.15-rnd()*h*.7,1.8,1.1,0,0,7);g.fill();}g.restore();pencil(sp,true,1.4,rnd);
    for(let k=0;k<4;k++)tuft(-10+k*7,5,1,pick3(rnd,['#56704a','#6a8458']),rnd);}
  else if(t===2){softShadow(10,6,40,12);
    for(const[x,y,h]of[[-22,-4,22],[18,-6,24]]){const pts=[[x-5,y],[x-5,y-h],[x+5,y-h-2],[x+5,y]];const sp=smoothPts(pts);pathPts(sp,true);g.fillStyle='#9a837d';g.fill();pencil(sp,true,1,rnd);}
    g.fillStyle='#1c1612';g.beginPath();g.ellipse(0,0,16,6,0,0,7);g.fill();
    for(const[x,y,h]of[[-14,8,20],[16,8,21]]){const pts=[[x-5,y],[x-5,y-h],[x+5,y-h-2],[x+5,y]];const sp=smoothPts(pts);pathPts(sp,true);g.fillStyle='#a8908a';g.fill();hatchIn(x+2,y-h*.5,4,h*.4,rnd,INK,5,4);pencil(sp,true,1,rnd);}
    const top=[[-34,-24],[-6,-34],[32,-30],[30,-20],[-2,-12],[-32,-16]],sp=smoothPts(top);pathPts(sp,true);g.fillStyle='#a8908a';g.fill();
    g.save();pathPts(sp,true);g.clip();g.fillStyle='#c4aaa2';g.beginPath();g.moveTo(-34,-24);g.lineTo(-6,-34);g.lineTo(32,-30);g.lineTo(0,-24);g.fill();
    g.fillStyle='#866e6a';g.beginPath();g.moveTo(-32,-16);g.lineTo(-2,-12);g.lineTo(30,-20);g.lineTo(32,-14);g.lineTo(-2,-6);g.lineTo(-34,-10);g.fill();hatchIn(0,-14,30,6,rnd,INK,10,5);
    for(let k=0;k<6;k++){g.fillStyle='#d9cf8a';g.beginPath();g.ellipse(-20+rnd()*40,-28+rnd()*8,1.6,1,0,0,7);g.fill();}g.restore();pencil(sp,true,1.3,rnd);
    for(let k=0;k<5;k++)tuft(-24+k*12,12+(k%2)*2,1,pick3(rnd,['#8e6c8f','#d4b23c','#6a8458']),rnd);}
  else{softShadow(18,6,46,14);contact(0,4,4);
    for(const[a,l]of[[-2.6,18],[-.6,16],[-1.7,14],[.4,14]]){g.strokeStyle='#5e5040';g.lineWidth=5;g.lineCap='round';g.beginPath();g.moveTo(0,0);g.lineTo(Math.cos(a)*l,4+Math.sin(a)*4);g.stroke();
      pencil([[0,-2],[Math.cos(a)*l,2+Math.sin(a)*4]],false,.8,rnd);}
    trunk2(0,4,9,40,3,'#6a5a48',rnd);
    const c='#3a4e34';mass(10,-50,30,18,sh(c,.9),rnd,{n:10,ticks:8});mass(-16,-58,22,15,c,rnd,{n:9,ticks:8});mass(22,-64,20,13,sh(c,1.08),rnd,{n:9,ticks:8});mass(0,-74,22,13,sh(c,1.18),rnd,{n:9,ticks:10});
    for(let k=0;k<10;k++){g.fillStyle='rgba(220,230,170,.6)';g.beginPath();g.arc(-20+rnd()*40,-80+rnd()*30,1.4,0,7);g.fill();}
    for(let k=0;k<5;k++)tuft(-16+k*8,7+(k%2)*2,1.1,pick3(rnd,['#56704a','#6a8458','#7d5f80']),rnd);}
});}

/* ================= bâtiments : facettes low-poly, arêtes adoucies, crayon, couleurs d'Armorique ================= */

const FOOT={1:[[0,0]],2:[[-.5,-.2887],[.5,-.2887],[0,.5774]],3:[[0,0],[1,0],[-1,0],[.5,.866],[-.5,.866],[.5,-.866],[-.5,-.866]]};
function roundPts(sp,r){const n=sp.length,o=[];for(let k=0;k<n;k++){const p=sp[(k+n-1)%n],c=sp[k],q=sp[(k+1)%n];
  const l1=Math.hypot(p[0]-c[0],p[1]-c[1])||1,l2=Math.hypot(q[0]-c[0],q[1]-c[1])||1,f1=Math.min(.4,r/l1),f2=Math.min(.4,r/l2);
  const a=[c[0]+(p[0]-c[0])*f1,c[1]+(p[1]-c[1])*f1],b=[c[0]+(q[0]-c[0])*f2,c[1]+(q[1]-c[1])*f2];
  for(let t=0;t<=1.001;t+=.25){const u=1-t;o.push([u*u*a[0]+2*u*t*c[0]+t*t*b[0],u*u*a[1]+2*u*t*c[1]+t*t*b[1]]);}}return o;}
function hatchClip(sp,rnd,dens){const[a,b,c,d]=bbox(sp);const n=Math.max(2,((c-a)*(d-b))*(dens||.035)|0);g.strokeStyle=INK;g.lineCap='round';
  for(let k=0;k<n;k++){const x=a+rnd()*(c-a),y=b+rnd()*(d-b),l=3+rnd()*3;g.globalAlpha=.18+rnd()*.2;g.lineWidth=.5+rnd()*.4;g.beginPath();g.moveTo(x,y);g.lineTo(x+l*.75,y+l*.6);g.stroke();}g.globalAlpha=1;}
/* une face : remplissage aux coins adoucis, texture, ombre hachurée si la face est sombre, trait de crayon */
/* facettes : chaque face est découpée en triangles de tons voisins, sans texture, pour un vrai rendu low-poly */
function facets(sp,col,rnd,amp){const n=sp.length;let cx=0,cy=0;for(const p of sp){cx+=p[0];cy+=p[1];}cx/=n;cy/=n;const[a,b,c,d]=bbox(sp);
  const ct=[cx+(rnd()-.5)*(c-a)*.3,cy+(rnd()-.5)*(d-b)*.3];
  for(let k=0;k<n;k++){const p=sp[k],q=sp[(k+1)%n],L=Math.hypot(q[0]-p[0],q[1]-p[1]);
    if(L>16){const m=[(p[0]+q[0])/2+(rnd()-.5)*3,(p[1]+q[1])/2+(rnd()-.5)*3];for(const[u,v]of[[p,m],[m,q]]){const f=1+(rnd()-.5)*amp;P([ct,u,v],sh(col,f),sh(col,f),.6);}}
    else{const f=1+(rnd()-.5)*amp;P([ct,p,q],sh(col,f),sh(col,f),.6);}}}
function face(sp,col,rnd,tex,sh2,pw){const rp=roundPts(sp,1.6);pathPts(rp,true);g.fillStyle=col;g.fill();
  g.save();pathPts(rp,true);g.clip();facets(sp,col,rnd,.16);if(tex&&!tex.surf)tex(sp,col,rnd);g.restore();pencil(rp,true,pw||.75,rnd,INK,.6);return rp;}
const TX={
  stone(sp,c,rnd){const[a,b,cc,d]=bbox(sp);for(let y=b+1.5;y<d+2;y+=3.2)for(let x=a+((y*7)%3);x<cc+2;x+=4+rnd()*2){g.fillStyle=sh(c,.86+rnd()*.26);g.beginPath();g.ellipse(x,y,2+rnd()*.8,1.3,0,0,7);g.fill();g.strokeStyle='rgba(42,36,28,.32)';g.lineWidth=.4;g.stroke();}},
  plank(sp,c,rnd){const[a,b,cc,d]=bbox(sp);g.lineWidth=.6;for(let x=a+1.5;x<cc;x+=3.2){g.strokeStyle='rgba(42,36,28,.35)';g.beginPath();g.moveTo(x+(rnd()-.5)*.4,b);g.lineTo(x+(rnd()-.5)*.4,d);g.stroke();}},
  chaux(sp,c,rnd){const[a,b,cc,d]=bbox(sp);for(let k=0;k<3;k++){const x=a+rnd()*(cc-a),y=b+rnd()*(d-b);g.strokeStyle='rgba(120,100,80,.25)';g.lineWidth=.5;g.beginPath();g.moveTo(x,y);g.lineTo(x+2,y+2.5);g.lineTo(x+1,y+4);g.stroke();}},
  thatch(dx,dy){return(sp,c,rnd)=>strokes(sp,rnd,.45,5,dx,dy,[sh(c,.78),sh(c,1.15),sh(c,.9)],.7,.18);},
  slate(dir){return(sp,c,rnd)=>{const[a,b,cc,d]=bbox(sp);g.strokeStyle=sh(c,.7);g.lineWidth=.6;const sl=dir[1]/(dir[0]||1e-3);for(let y=b-60;y<d+60;y+=2.6){g.beginPath();g.moveTo(a,y);g.lineTo(cc,y+(cc-a)*sl);g.stroke();}
    for(let k=0;k<((cc-a)*(d-b)/18|0);k++){const x=a+rnd()*(cc-a),y=b+rnd()*(d-b);g.beginPath();g.moveTo(x,y);g.lineTo(x,y+1.6);g.stroke();}};}
};
function box(x0,y0,x1,y1,z0,z1,col,rnd,tex,top){
  const fs=[[x0,y1,x1,y1,0,1],[x1,y0,x1,y1,1,0],[x0,y0,x0,y1,-1,0],[x0,y0,x1,y0,0,-1]];
  for(const[ax,ay,bx,by,nx,ny]of fs){if(!vis(nx,ny))continue;const f=fshade(nx,ny);face([W(ax,ay,z0),W(bx,by,z0),W(bx,by,z1),W(ax,ay,z1)],sh(col,f*1.1),rnd,tex,f<.8?.03:0);}
  if(top)face([W(x0,y0,z1),W(x1,y0,z1),W(x1,y1,z1),W(x0,y1,z1)],top,rnd,null,0,.8);}
function frontPt(){return Math.atan2(CR,SR);}
function onFront(x0,x1,y1,xc,w,z0,h){return[W(xc-w/2,y1,z0),W(xc+w/2,y1,z0),W(xc+w/2,y1,z0+h),W(xc-w/2,y1,z0+h)];}
function door2(xc,y1,z0,w,h,rnd,col){face(onFront(0,0,y1,xc,w,z0,h),col||AC.guede,rnd,(sp,c)=>{g.strokeStyle=sh(c,.7);g.lineWidth=.6;const[a,b,cc,d]=bbox(sp);g.beginPath();g.moveTo((a+cc)/2,b);g.lineTo((a+cc)/2,d);g.stroke();},0,.8);}
function win2(xc,y1,z0,rnd){face(onFront(0,0,y1,xc,.07,z0,4),'#2b2b33',rnd,null,0,.6);for(const s of[-1,1])face(onFront(0,0,y1,xc+s*.06,.05,z0,4),AC.guede,rnd,null,0,.5);}
function gable2(x0,y0,x1,y1,z,h,col,rnd,endCol,kind){
  const ym=(y0+y1)/2,X0=x0-.06,X1=x1+.06,Y0=y0-.08,Y1=y1+.08,left=vis(-1,0),xw=left?x0:x1,xe=left?X0:X1;
  const dB=[W(0,Y0)[0]-W(0,ym)[0],W(0,Y0,0)[1]-W(0,ym,h)[1]],dF=[W(0,Y1)[0]-W(0,ym)[0],W(0,Y1,0)[1]-W(0,ym,h)[1]],nb=Math.hypot(...dB)||1,nf=Math.hypot(...dF)||1;
  const tex=kind==='slate'?TX.slate([1,.36]):null;
  face([W(X0,Y0,z),W(X1,Y0,z),W(X1,ym,z+h),W(X0,ym,z+h)],sh(col,1.12),rnd,tex||TX.thatch(dB[0]/nb,dB[1]/nb),0,.9);
  face([W(xw,y0,z),W(xw,y1,z),W(xw,ym,z+h)],sh(endCol||AC.chaux,fshade(left?-1:1,0)*1.08),rnd,endCol===AC.boisC?TX.plank:null,.02,.9);
  face([W(X0,ym,z+h),W(X1,ym,z+h),W(X1,Y1,z),W(X0,Y1,z)],sh(col,fshade(0,1)*1.12),rnd,tex||TX.thatch(dF[0]/nf,dF[1]/nf),.02,1);
  g.strokeStyle=sh(col,.55);g.lineWidth=2.4;g.lineCap='round';g.beginPath();const e1=W(X0,Y1,z),e2=W(X1,Y1,z);g.moveTo(e1[0],e1[1]);g.lineTo(e2[0],e2[1]);g.stroke();
  const v1=W(xe,Y0,z),v2=W(xe,ym,z+h),v3=W(xe,Y1,z);g.lineWidth=2.6;g.beginPath();g.moveTo(v1[0],v1[1]);g.lineTo(v2[0],v2[1]);g.lineTo(v3[0],v3[1]);g.stroke();
  pencil([W(X0,ym,z+h+1),W(X1,ym,z+h+1)],false,1.6,rnd);}
function hip2(X0,Y0,X1,Y1,z,h,col,rnd,ins,kind){const cx=(X0+X1)/2,cy=(Y0+Y1)/2,a=ins?[X0+ins,Y0+ins,X1-ins,Y1-ins]:[cx,cy,cx,cy],zh=z+h;
  const fs=[[[[X0,Y0,z],[X1,Y0,z],[a[2],a[1],zh],[a[0],a[1],zh]],0,-1],[[[X0,Y0,z],[a[0],a[1],zh],[a[0],a[3],zh],[X0,Y1,z]],-1,0],[[[X0,Y1,z],[a[0],a[3],zh],[a[2],a[3],zh],[X1,Y1,z]],0,1],[[[X1,Y0,z],[X1,Y1,z],[a[2],a[3],zh],[a[2],a[1],zh]],1,0]];
  fs.sort((p,q)=>(p[1]*SR+p[2]*CR)-(q[1]*SR+q[2]*CR));
  for(const[pp,nx,ny]of fs){const sp=pp.map(p=>W(p[0],p[1],p[2])),v=vis(nx,ny),f=v?fshade(nx,ny)*1.15:1.12,e=[sp[pp.length-1][0]-sp[0][0],sp[pp.length-1][1]-sp[0][1]],en=Math.hypot(...e)||1;
    face(sp,sh(col,f),rnd,kind==='slate'?TX.slate([e[0]/en,e[1]/en]):TX.thatch(0,1),v&&f<.85?.025:0,v?1:.7);}}
for(const k of['stone','plank','chaux'])TX[k].surf=1;{const t0=TX.thatch,s0=TX.slate;TX.thatch=(a,b)=>{const f=t0(a,b);f.surf=1;return f;};TX.slate=d=>{const f=s0(d);f.surf=1;return f;};}
const NC=8;
function cyl(cx,cy,r,z0,z1,col,rnd,tex){const bot=[],top=[];
  for(let k=0;k<NC;k++){const a0=k/NC*Math.PI*2,a1=(k+1)/NC*Math.PI*2,am=(a0+a1)/2,nx=Math.cos(am),ny=Math.sin(am);if(!vis(nx,ny))continue;
    const sp=[W(cx+Math.cos(a0)*r,cy+Math.sin(a0)*r,z0),W(cx+Math.cos(a1)*r,cy+Math.sin(a1)*r,z0),W(cx+Math.cos(a1)*r,cy+Math.sin(a1)*r,z1),W(cx+Math.cos(a0)*r,cy+Math.sin(a0)*r,z1)];
    const f=fshade(nx,ny),c1=sh(col,f*1.1*(1+(rnd()-.5)*.08)),c2=sh(col,f*1.1*(.94+(rnd()-.5)*.06));P([sp[0],sp[1],sp[2]],c1,c1,.7);P([sp[0],sp[2],sp[3]],c2,c2,.7);}
  const outl=[];for(let k=0;k<=24;k++){const a=k/24*Math.PI*2;const nx=Math.cos(a),ny=Math.sin(a);if(nx*SR+ny*CR>=-.05)outl.push([a,W(cx+nx*r,cy+ny*r,z0)]);}
  outl.sort((p,q)=>p[1][0]-q[1][0]);if(outl.length>1){const L=outl.map(p=>p[1]);pencil(L,false,.9,rnd);
    const l=L[0],rr=L[L.length-1];pencil([l,[l[0],l[1]-(z1-z0)]],false,.9,rnd);pencil([rr,[rr[0],rr[1]-(z1-z0)]],false,.9,rnd);}}
function cone(cx,cy,r,z,h,col,rnd,kind){const ap=W(cx-.015,cy-.02,z+h),fs=[];
  for(let k=0;k<NC;k++){const a0=k/NC*Math.PI*2,a1=(k+1)/NC*Math.PI*2,am=(a0+a1)/2;fs.push([a0,a1,Math.cos(am),Math.sin(am)]);}
  fs.sort((p,q)=>(p[2]*SR+p[3]*CR)-(q[2]*SR+q[3]*CR));
  for(const[a0,a1,nx,ny]of fs){const sp=[W(cx+Math.cos(a0)*r,cy+Math.sin(a0)*r,z),W(cx+Math.cos(a1)*r,cy+Math.sin(a1)*r,z),ap];
    const v=nx*SR+ny*CR>0,f=v?Math.min(1.25,fshade(nx,ny)*1.18+.06):1.1;P(sp,sh(col,f),sh(col,f),.8);
    if(v){const m0=[sp[0][0]+(ap[0]-sp[0][0])*.45,sp[0][1]+(ap[1]-sp[0][1])*.45],m1=[sp[1][0]+(ap[0]-sp[1][0])*.45,sp[1][1]+(ap[1]-sp[1][1])*.45],c2=sh(col,f*(1.07+(rnd()-.5)*.05));P([m0,m1,ap],c2,c2,.7);const c3=sh(col,f*(.95+(rnd()-.5)*.05));P([sp[0],sp[1],m1],c3,c3,.6);}}
  const base=[];for(let k=0;k<=24;k++){const a=k/24*Math.PI*2,nx=Math.cos(a),ny=Math.sin(a);if(nx*SR+ny*CR>=-.2)base.push(W(cx+nx*r,cy+ny*r,z));}
  base.sort((p,q)=>p[0]-q[0]);g.strokeStyle=sh(col,.55);g.lineWidth=2.4;g.lineCap='round';g.beginPath();base.forEach((p,k)=>k?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.stroke();
  pencil(base,false,1,rnd);pencil([base[0],ap,base[base.length-1]],false,1,rnd);}
function cylDoor(cx,cy,r,z0,h,rnd,col){const a=frontPt(),x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r,t=[-Math.sin(a)*.06,Math.cos(a)*.06];
  face([W(x-t[0],y-t[1],z0),W(x+t[0],y+t[1],z0),W(x+t[0],y+t[1],z0+h),W(x-t[0],y-t[1],z0+h)],col||AC.guede,rnd,null,0,.8);}
function ground(s,col,rnd,ins){for(const[ox,oy]of FOOT[s]){const sp=[];for(let k=0;k<6;k++){const[x,y]=corner(ox,oy,k,HR*(ins||.9));sp.push(W(x,y,.4));}const rp=roundPts(sp,4);pathPts(rp,true);g.fillStyle=col;g.fill();
    g.save();pathPts(rp,true);g.clip();facets(sp,col,rnd,.1);g.restore();pencil(rp,true,.6,rnd,INK,.35);}}
function post(x,y,z0,z1,rnd,col){const a=W(x,y,z0),b=W(x,y,z1);g.strokeStyle=col||AC.bois;g.lineWidth=2.2;g.lineCap='round';g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();pencil([[a[0]+1.3,a[1]],[b[0]+1.3,b[1]]],false,.5,rnd);}
function barrel3(x,y,rnd){cyl(x,y,.045,0,7,AC.bois,rnd);const t=W(x,y,7);g.fillStyle=AC.boisC;g.beginPath();g.ellipse(t[0],t[1],2.4,1.4,0,0,7);g.fill();for(const z of[2,5]){const p=W(x,y,z);g.strokeStyle='#3e3228';g.lineWidth=.6;g.beginPath();g.ellipse(p[0],p[1],2.6,1.5,0,0,Math.PI);g.stroke();}}
function crate3(x,y,sz,rnd){box(x-sz,y-sz,x+sz,y+sz,0,sz*60,AC.boisC,rnd,TX.plank,sh(AC.boisC,1.15));}
function amph3(x,y,rnd){const p=W(x,y);const sp=[[p[0]-2.5,p[1]],[p[0]-3.4,p[1]-6],[p[0]-1.2,p[1]-11],[p[0]+1.2,p[1]-11],[p[0]+3.4,p[1]-6],[p[0]+2.5,p[1]]];const rp=roundPts(sp,2);pathPts(rp,true);g.fillStyle=AC.ocre;g.fill();g.fillStyle=sh(AC.ocre,.75);g.beginPath();g.ellipse(p[0]+1.4,p[1]-5,1.4,4,0,0,7);g.fill();pencil(rp,true,.6,rnd);}
function logs3(x,y,n,rnd){for(let k=0;k<n;k++){const row=k<3?0:1,i=row?k-3:k,a=W(x-.12,y+i*.06,1.8+row*3.2),b=W(x+.12,y+i*.06,1.8+row*3.2);
  g.strokeStyle=AC.bois;g.lineWidth=3.4;g.lineCap='round';g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();g.fillStyle='#e0c08a';g.beginPath();g.ellipse(b[0],b[1],1.7,1.6,0,0,7);g.fill();pencil([[a[0],a[1]-1.7],[b[0],b[1]-1.7]],false,.5,rnd);}}
function fence3(pts,h,rnd){for(let k=0;k<pts.length;k++){const p=pts[k];post(p[0],p[1],0,h,rnd,AC.boisC);}for(const z of[h*.4,h*.8]){const L=pts.map(p=>W(p[0],p[1],z));g.strokeStyle=AC.bois;g.lineWidth=1;g.beginPath();L.forEach((p,k)=>k?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.stroke();}}
function ring(cx,cy,rx,ry,n){const o=[];for(let k=0;k<n;k++){const a=k/n*Math.PI*2;o.push([cx+Math.cos(a)*rx,cy+Math.sin(a)*ry]);}return o;}
function banner(x,y,z0,h,col,rnd){post(x,y,z0,z0+h,rnd,'#5a4030');const p=W(x,y,z0+h);const sp=[[p[0]+1,p[1]],[p[0]+13,p[1]-2],[p[0]+12,p[1]+8],[p[0]+1,p[1]+9]];const rp=roundPts(sp,2);pathPts(rp,true);g.fillStyle=col;g.fill();pencil(rp,true,.6,rnd);
  g.strokeStyle=AC.chaux;g.lineWidth=.8;g.beginPath();g.arc(p[0]+7,p[1]+3.6,2,0,5.2);g.stroke();}
function shield3(x,y,z,col,rnd){const p=W(x,y,z);g.fillStyle=col;g.beginPath();g.ellipse(p[0],p[1],2.6,4.2,0,0,7);g.fill();g.fillStyle=AC.chaux;g.beginPath();g.arc(p[0],p[1],.9,0,7);g.fill();pencil(smoothPts(irregular(p[0],p[1],2.6,4.2,8,rnd,.05)),true,.5,rnd);}
function menhir3(x,y,h,rnd){const p=W(x,y);softShadow(p[0]+4,p[1]+1,6,2.4);const sp=[[p[0]-4,p[1]],[p[0]-4.5,p[1]-h*.55],[p[0]-2,p[1]-h],[p[0]+2.5,p[1]-h*.94],[p[0]+4.5,p[1]-h*.5],[p[0]+4,p[1]]];const rp=roundPts(sp,2.5);
  pathPts(rp,true);g.fillStyle=AC.granit;g.fill();g.save();pathPts(rp,true);g.clip();g.fillStyle=AC.granitD;g.fillRect(p[0]+.6,p[1]-h-2,6,h+3);hatchClip(sp,rnd,.05);g.fillStyle='#e2d68c';g.beginPath();g.ellipse(p[0]-1,p[1]-h*.6,1.2,.8,0,0,7);g.fill();g.restore();pencil(rp,true,.9,rnd);}
function bArt2(key,s,fn){return sprite('B2'+key,-(s*44+60),-175,s*44+60,s*34+40,rnd=>{const p=LOC;LOC=null;try{fn(rnd);}finally{LOC=p;}});}
function bSprite(b){
  const t=b.type,v=b.id%3,s=b.s;
  if(t==='hut'){if(b.pop<=0&&b.inc<=0)return bArt2('plot',1,rnd=>{ground(1,'#c7ae84',rnd,.72);const R=ring(0,0,.3,.3,6);for(const[x,y]of R)post(x,y,0,8,rnd,AC.boisC);
      g.strokeStyle='rgba(240,232,210,.8)';g.lineWidth=.6;g.beginPath();R.concat([R[0]]).forEach(([x,y],k)=>{const p=W(x,y,6);k?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]);});g.stroke();});
    return bArt2('h'+b.lvl+'_'+v,1,rnd=>houseArt(b.lvl,v,rnd));}
  if(t==='farm'){const st=Math.min(3,Math.floor(b.prog/B.farm.time*4));return bArt2('farm'+st,2,rnd=>farmArt2(st,rnd));}
  if(t.startsWith('t_'))return bArt2(t,3,rnd=>templeArt2(B[t].god,rnd));
  if(B[t].mon){const st=b.done?2:monProg(b)>=.5?1:0;return bArt2(t+st,3,rnd=>monArt2(t,st,rnd));}
  return bArt2(t,s,rnd=>(ART2[t]||ART2.store)(rnd));}
function houseArt(L,v,rnd){
  if(L===1){ground(1,'#c9b08a',rnd,.62);if(v===0)logs3(.26,.1,3,rnd);cyl(0,0,.22,0,8,AC.granit,rnd,TX.stone);cylDoor(0,0,.22,0,6.5,rnd);cone(0,0,.3,8,19,AC.chaume,rnd);if(v===1)barrel3(.27,.16,rnd);return;}
  if(L===2){ground(1,'#cdb690',rnd,.72);if(v===1)logs3(.3,-.05,4,rnd);cyl(0,0,.27,0,4,AC.granit,rnd,TX.stone);cyl(0,0,.27,4,11,AC.chaux,rnd,TX.chaux);cylDoor(0,0,.27,0,8,rnd);cone(0,0,.37,11,23,AC.chaume,rnd);
    if(v===0)barrel3(.3,.18,rnd);if(v===2){amph3(.3,.2,rnd);amph3(.36,.12,rnd);}return;}
  if(L===3){ground(1,'#d0bb98',rnd,.82);box(-.34,-.15,.34,.15,0,3,AC.granit,rnd,TX.stone);box(-.34,-.15,.34,.15,3,10,AC.chaux,rnd,TX.chaux);door2(-.05,.15,0,.11,8,rnd);win2(.18,.15,4.5,rnd);
    gable2(-.34,-.15,.34,.15,10,13,AC.chaume,rnd,AC.chaux);if(v===0)barrel3(.36,.22,rnd);if(v===1)logs3(-.32,.24,3,rnd);return;}
  ground(1,'#d6c3a2',rnd,.86);cyl(.27,-.13,.11,0,16,AC.granit,rnd,TX.stone);cone(.27,-.13,.15,16,12,AC.ardoise,rnd,'slate');
  box(-.37,-.14,.3,.17,0,3,AC.granit,rnd,TX.stone);box(-.37,-.14,.3,.17,3,12,AC.chaux,rnd,TX.chaux);door2(-.04,.17,0,.12,9,rnd,AC.ocre);win2(-.24,.17,5,rnd);win2(.17,.17,5,rnd);
  for(const[x,c]of[[-.15,AC.guede],[.07,AC.ocre]])shield3(x,.17,8,c,rnd);gable2(-.37,-.14,.3,.17,12,15,AC.chaume,rnd,AC.chaux);banner(-.36,.22,0,30,AC.guede,rnd);}
function farmArt2(st,rnd){
  const col=['#a07a52','#93905a','#7fa05a','#e3bd55'][st];
  for(const[ox,oy]of FOOT[2]){const sp=[];for(let k=0;k<6;k++){const[x,y]=corner(ox,oy,k,HR*.92);sp.push(W(x,y,.4));}const rp=roundPts(sp,4);pathPts(rp,true);g.fillStyle=col;g.fill();
    g.save();pathPts(rp,true);g.clip();for(let k=-6;k<=6;k++){const a=W(ox-.5,oy+k*.08),b=W(ox+.5,oy+k*.08);g.strokeStyle=sh(col,.72);g.lineWidth=1.1;g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();
      if(st>0)for(let t=0;t<1;t+=.06){const x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t,h=[0,2,4.5,7][st];g.strokeStyle=st===3?(rnd()<.5?'#f2d27a':'#c99a3a'):(rnd()<.5?'#5f9a4a':'#8dbb5e');g.lineWidth=.9;g.beginPath();g.moveTo(x,y);g.lineTo(x+(rnd()-.5)*1.4,y-h*(.7+rnd()*.5));g.stroke();}}
    g.restore();pencil(rp,true,.7,rnd,INK,.5);}
  ground(1,'#bfa580',rnd,.22);cyl(-.02,-.04,.09,0,5,AC.granit,rnd,TX.stone);cone(-.02,-.04,.13,5,10,AC.chaume,rnd);if(st===3){for(const[x,y]of[[.25,.12],[-.25,.12]]){const p=W(x,y);P([[p[0]-3,p[1]],[p[0],p[1]-8],[p[0]+3,p[1]]],'#e3bd55','#a07a32',.6);}}}
function templeArt2(god,rnd){const GC={taranis:'#6f8fc4',belenos:'#ecc63f',epona:'#c4643e'}[god];
  ground(3,AC.pave,rnd,.92);
  box(-.62,-.62,.62,.62,0,9,AC.chaux,rnd,TX.chaux);
  for(let k=-2;k<=2;k++){const x=k*.24;face(onFront(0,0,.62,x,.08,0,7),'#3a3530',rnd,null,0,.5);}
  hip2(-.7,-.7,.7,.7,9,8,AC.ardoise,rnd,.38,'slate');
  box(-.3,-.3,.3,.3,17,36,AC.chaux,rnd,TX.chaux);door2(0,.3,17,.12,9,rnd,GC);
  const[sx,sy]=W(0,.3,30);g.strokeStyle=GC;g.fillStyle=GC;g.lineWidth=1.6;
  if(god==='taranis'){g.beginPath();g.arc(sx,sy,4,0,7);g.stroke();for(let k=0;k<6;k++){const a=k*Math.PI/3;g.beginPath();g.moveTo(sx,sy);g.lineTo(sx+Math.cos(a)*4,sy+Math.sin(a)*4);g.stroke();}}
  else if(god==='belenos'){g.beginPath();g.arc(sx,sy,2.8,0,7);g.fill();for(let k=0;k<8;k++){const a=k*Math.PI/4;g.beginPath();g.moveTo(sx+Math.cos(a)*3.8,sy+Math.sin(a)*3.8);g.lineTo(sx+Math.cos(a)*5.8,sy+Math.sin(a)*5.8);g.stroke();}}
  else{g.beginPath();g.arc(sx,sy+1,4,Math.PI*.15,Math.PI*.85,true);g.stroke();}
  hip2(-.36,-.36,.36,.36,36,16,AC.ardoise,rnd,0,'slate');
  banner(.75,.6,0,40,GC,rnd);const al=[[-.2,.85],[.2,.85],[.2,.98],[-.2,.98]];box(-.16,.82,.16,.98,0,4,AC.granit,rnd,TX.stone,AC.granit);
  for(const[x,y]of[[-.9,.3],[.9,.3],[-.85,-.4]])oak3(...W(x,y),.8,rnd,'#4a6a42');}
function monArt2(t,st,rnd){
  if(t==='menhirs'){ground(3,st<2?'#b8a07a':'#7fa465',rnd,.94);const sp=[];for(let r=0;r<3;r++)for(let k=0;k<6;k++)sp.push([-1.05+k*.42,-.55+r*.55,22+(5-k)*3+rnd()*6,r*6+k]);
    sp.sort((a,b)=>DP2(a[0],a[1])-DP2(b[0],b[1]));
    for(const[x,y,h,n]of sp){const up=st===2||(st===1?n%2===0:n%5===0);if(up)menhir3(x,y,h,rnd);else if(n%3===0){box(x-.16,y-.05,x+.16,y+.05,0,4,AC.granit,rnd,null,AC.granit);}}
    if(st<2){logs3(1,.9,5,rnd);post(.4,.95,0,26,rnd);post(.7,.95,0,26,rnd);}return;}
  if(t==='tumulus'){ground(3,'#7fa465',rnd,.94);const[cx,cy]=W(0,0);
    if(st>=1){const L=st===2?12:6,H=st===2?40:20;for(let k=0;k<=L;k++){const f=k/12,r=Math.sqrt(Math.max(0,1-f*f))*90;g.fillStyle=st===2?`rgb(${[92+f*60,140+f*40,84+f*20].map(Math.round)})`:`rgb(${[150+f*30,120+f*24,84+f*14].map(Math.round)})`;g.beginPath();g.ellipse(cx-f*6,cy-k*H/L,r,r*.55,0,0,7);g.fill();}
      g.save();g.beginPath();g.ellipse(cx,cy-12,84,54,0,0,7);g.clip();hatchClip([[cx,cy-60],[cx+90,cy],[cx,cy+40],[cx-90,cy]],rnd,.02);g.restore();pencil(smoothPts(irregular(cx,cy-H*.5,88,48+H*.3,14,rnd,.05)),true,1.2,rnd);}
    for(let k=0;k<=18;k++){const a=k/18*Math.PI;boulder3(...W(Math.cos(a)*1.45,Math.sin(a)*1.1),.42,rnd);}
    if(st===0){box(-.2,-.1,-.12,.25,0,14,AC.granit,rnd,TX.stone);box(.12,-.1,.2,.25,0,14,AC.granit,rnd,TX.stone);box(-.28,-.15,.28,.3,14,18,AC.granitD,rnd,null,AC.granit);logs3(.9,.8,5,rnd);}
    else{const[ex,ey]=W(0,1.05);face([[ex-8,ey],[ex-8,ey-14],[ex+8,ey-14],[ex+8,ey]],'#241c16',rnd,null,0,.9);face([[ex-11,ey-13],[ex+11,ey-13],[ex+11,ey-18],[ex-11,ey-18]],AC.granit,rnd,null,0,.9);}
    return;}
  ground(3,'#c9b48c',rnd,.94);
  const rim=ring(0,0,1.25,1.15,26),back=rim.filter(p=>DP2(p[0],p[1])<0).sort((a,b)=>a[0]-b[0]),front=rim.filter(p=>DP2(p[0],p[1])>=0).sort((a,b)=>a[0]-b[0]);
  const lim=st===0?6:st===1?16:99;fence3(back.slice(0,lim),st===2?18:11,rnd);
  if(st>=1){const p=W(0,0);g.fillStyle='#2a1e14';g.beginPath();g.ellipse(p[0],p[1],18,9,0,0,7);g.fill();pencil(smoothPts(irregular(p[0],p[1],18,9,10,rnd,.05)),true,.8,rnd);box(-.18,-.4,.18,-.25,0,7,AC.granit,rnd,TX.stone,AC.granit);}
  if(st===2)for(const[x,y]of[[-.7,-.5],[.7,-.5],[-.7,.5],[.7,.5]]){post(x,y,0,26,rnd,'#5a4030');const p=W(x,y,22);g.strokeStyle='#5a4030';g.lineWidth=1.6;g.beginPath();g.moveTo(p[0]-7,p[1]);g.lineTo(p[0]+7,p[1]);g.stroke();
    shield3(x,y,16,pick3(rnd,[AC.guede,AC.ocre,AC.ajonc]),rnd);const h=W(x,y,28);g.fillStyle=AC.fer;g.beginPath();g.arc(h[0],h[1],3,Math.PI,0);g.fill();}
  if(st===0)logs3(.4,.4,5,rnd);
  fence3(front.slice(0,lim),st===2?18:11,rnd);
  if(st>=1){post(-.22,1.18,0,30,rnd,'#5a4030');post(.22,1.18,0,30,rnd,'#5a4030');const a=W(-.28,1.18,29),b=W(.28,1.18,29);g.strokeStyle='#5a4030';g.lineWidth=3;g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();
    if(st===2)for(let k=0;k<3;k++){const p=W(-.15+k*.15,1.18,25);g.fillStyle=AC.chaux;g.beginPath();g.arc(p[0],p[1],2.3,0,7);g.fill();g.fillStyle='#2a241c';g.fillRect(p[0]-1.3,p[1]-.6,.9,.9);g.fillRect(p[0]+.4,p[1]-.6,.9,.9);}}}
const ART2={
  well(rnd){ground(1,AC.pave,rnd,.55);cyl(0,0,.15,0,6,AC.granit,rnd,TX.stone);const t=W(0,0,6);g.fillStyle=AC.granit;g.beginPath();g.ellipse(t[0],t[1],8.4,8.4*TILT*.9,0,0,7);g.fill();g.fillStyle='#1f3c52';g.beginPath();g.ellipse(t[0],t[1],5.6,5.6*TILT*.9,0,0,7);g.fill();
    pencil(smoothPts(irregular(t[0],t[1],8.4,4.8,10,rnd,.04)),true,.7,rnd);post(-.13,0,6,22,rnd);post(.13,0,6,22,rnd);gable2(-.18,-.1,.18,.1,21,6,AC.chaume,rnd,AC.boisC);},
  pigs(rnd){ground(2,'#8a6a4a',rnd,.94);const sty=FOOT[2][0];box(sty[0]-.2,sty[1]-.14,sty[0]+.2,sty[1]+.14,0,7,AC.boisC,rnd,TX.plank);gable2(sty[0]-.2,sty[1]-.14,sty[0]+.2,sty[1]+.14,7,8,AC.chaume,rnd,AC.boisC);
    const tr=W(.15,.45);face([[tr[0]-9,tr[1]],[tr[0]+9,tr[1]-4],[tr[0]+9,tr[1]-1],[tr[0]-9,tr[1]+3]],AC.bois,rnd,null,0,.6);
    const rim=ring(0,.05,.95,.85,22).filter(p=>DP2(p[0],p[1]-.05)>-.3).sort((a,b)=>a[0]-b[0]);fence3(rim,7,rnd);},
  granary(rnd){ground(2,'#c4ab84',rnd,.92);for(const[x,y]of[[-.28,-.2],[.28,-.2],[.28,.2],[-.28,.2],[0,.2]])post(x,y,0,10,rnd);box(-.32,-.24,.32,.24,10,21,AC.boisC,rnd,TX.plank);door2(0,.24,10,.12,8,rnd);
    gable2(-.32,-.24,.32,.24,21,15,AC.chaume,rnd,AC.boisC);for(let k=0;k<5;k++){const a=W(-.07,.5-k*.06,k*2),b=W(.07,.5-k*.06,k*2);g.strokeStyle=AC.bois;g.lineWidth=1;g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();}
    for(const[x,y]of[[.62,.15],[-.62,.15]]){cyl(x,y,.12,0,6,AC.granit,rnd,TX.stone);cone(x,y,.16,6,11,AC.chaume,rnd);}},
  market(rnd){ground(2,AC.pave,rnd,.94);const cols=[[AC.guede,AC.chaux],[AC.ocre,'#f6e7c4'],[AC.ajonc,'#6a4a2a']];
    FOOT[2].slice().sort((a,b)=>DP2(...a)-DP2(...b)).forEach(([ox,oy],k)=>{const x0=ox-.22,x1=ox+.22,y0=oy-.17,y1=oy+.17;for(const[x,y]of[[x0,y0],[x1,y0],[x1,y1],[x0,y1]])post(x,y,0,13,rnd);
      box(x0+.04,y0+.04,x1-.04,y1-.04,0,5,AC.boisC,rnd,TX.plank,sh(AC.boisC,1.12));for(let q=0;q<4;q++){const p=W(x0+.1+q*.08,oy,5);g.fillStyle=[AC.ajonc,'#e3a0a0',AC.ocre,'#8dbb5e'][(q+k)%4];g.beginPath();g.arc(p[0],p[1]-1,2,0,7);g.fill();}
      const aw=[W(x0-.04,y0-.04,15),W(x1+.04,y0-.04,15),W(x1+.04,y1+.06,12),W(x0-.04,y1+.06,12)];face(aw,cols[k][0],rnd,(sp)=>{for(let q=0;q<7;q+=2){const t0=q/7,t1=(q+1)/7;P([W(x0-.04+(x1-x0+.08)*t0,y0-.04,15),W(x0-.04+(x1-x0+.08)*t1,y0-.04,15),W(x0-.04+(x1-x0+.08)*t1,y1+.06,12),W(x0-.04+(x1-x0+.08)*t0,y1+.06,12)],cols[k][1]);}},0,.8);});},
  wood(rnd){ground(1,'#b39a74',rnd,.7);cyl(-.12,-.08,.15,0,6,AC.granit,rnd,TX.stone);cone(-.12,-.08,.2,6,13,AC.chaume,rnd);logs3(.18,.14,5,rnd);
    const p=W(.22,-.14);g.fillStyle=AC.bois;g.beginPath();g.ellipse(p[0],p[1]-2,4,2,0,0,7);g.fill();g.fillStyle='#e0c08a';g.beginPath();g.ellipse(p[0],p[1]-4,4,2,0,0,7);g.fill();pencil(smoothPts(irregular(p[0],p[1]-3,4,2.6,8,rnd,.05)),true,.6,rnd);},
  quarry(rnd){ground(1,'#a39590',rnd,.82);box(-.3,-.3,.02,-.02,0,16,AC.granitD,rnd,TX.stone,AC.granit);box(.05,.08,.25,.25,0,6,AC.granit,rnd,null,sh(AC.granit,1.1));box(-.24,.1,-.04,.28,0,6,AC.granit,rnd,null,sh(AC.granit,1.1));box(-.18,.14,-.06,.24,6,11,AC.granit,rnd,null,sh(AC.granit,1.1));
    post(.22,-.2,0,28,rnd);const t=W(.22,-.2,28),e=W(.36,.08,24);g.strokeStyle=AC.bois;g.lineWidth=1.8;g.beginPath();g.moveTo(t[0],t[1]);g.lineTo(e[0],e[1]);g.stroke();g.strokeStyle='#ddd6c0';g.lineWidth=.6;g.beginPath();g.moveTo(e[0],e[1]);g.lineTo(e[0],e[1]+12);g.stroke();},
  mine(rnd){ground(2,'#9a8a7a',rnd,.94);mass(...W(0,-.1),62,34,AC.granitD,rnd,{n:11,hatch:28,w:1.3,v:.18});mass(...W(-.35,-.25,10),30,18,AC.granit,rnd,{n:9,hatch:8,v:.2});
    const[ex,ey]=W(0,.35);face([[ex-11,ey],[ex-11,ey-16],[ex+11,ey-16],[ex+11,ey]],'#1c1612',rnd,null,0,.8);post(-.2,.35,0,17,rnd);post(.2,.35,0,17,rnd);const a=W(-.24,.35,17),b=W(.24,.35,17);g.strokeStyle=AC.bois;g.lineWidth=3;g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();
    box(.45,.4,.62,.55,2,7,AC.bois,rnd,TX.plank,'#6a5a5a');},
  brew(rnd){ground(2,'#c9b08a',rnd,.92);box(-.55,-.22,.4,.18,0,3,AC.granit,rnd,TX.stone);box(-.55,-.22,.4,.18,3,12,AC.chaux,rnd,TX.chaux);door2(-.2,.18,0,.13,9,rnd);win2(.14,.18,5,rnd);
    gable2(-.55,-.22,.4,.18,12,14,AC.chaume,rnd,AC.chaux);box(.18,-.14,.3,-.02,20,32,AC.granit,rnd,TX.stone,AC.granitD);for(const[x,y]of[[.35,.45],[.45,.38],[.24,.5]])barrel3(x,y,rnd);
    cyl(-.4,.48,.09,0,5,'#3a3836',rnd);const t=W(-.4,.48,5);g.fillStyle='#d9a23a';g.beginPath();g.ellipse(t[0],t[1],4.4,2.4,0,0,7);g.fill();},
  forge(rnd){ground(2,'#a9a098',rnd,.92);box(-.45,-.25,.45,.2,0,12,AC.granit,rnd,TX.stone);door2(0,.2,0,.16,9,rnd,'#3a2a20');hip2(-.5,-.3,.5,.25,12,10,AC.ardoise,rnd,0,'slate');box(.22,-.2,.36,-.06,18,38,AC.granitD,rnd,TX.stone,'#5a5650');
    const p=W(-.3,.5);face([[p[0]-6,p[1]-6],[p[0]+6,p[1]-6],[p[0]+5,p[1]-3],[p[0]-5,p[1]-3]],'#3a3836',rnd,null,0,.7);post(-.3,.5,0,6,rnd,'#3a3836');box(.3,.4,.55,.55,0,4,AC.bois,rnd,TX.plank,'#3f6a8a');},
  store(rnd){ground(2,'#c4ab84',rnd,.92);box(-.55,-.28,.5,.22,0,15,AC.boisC,rnd,TX.plank);door2(0,.22,0,.22,11,rnd,AC.bois);gable2(-.55,-.28,.5,.22,15,15,AC.chaume,rnd,AC.boisC);
    crate3(.42,.45,.07,rnd);crate3(.3,.52,.06,rnd);barrel3(-.4,.45,rnd);barrel3(-.28,.5,rnd);amph3(.58,.32,rnd);amph3(.62,.4,rnd);},
  tower(rnd){ground(1,'#b8a07a',rnd,.6);for(const[x,y]of[[-.16,-.16],[.16,-.16],[.16,.16],[-.16,.16]])post(x,y,0,26,rnd);
    const a=W(-.16,.16,3),b=W(.16,.16,22),c=W(.16,.16,3),d=W(-.16,.16,22);g.strokeStyle=AC.bois;g.lineWidth=1.2;g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.moveTo(c[0],c[1]);g.lineTo(d[0],d[1]);g.stroke();
    box(-.22,-.22,.22,.22,25,27,AC.bois,rnd,TX.plank,AC.boisC);const[fx,fy]=W(0,0,27);figure(fx,fy,0,AC.guede,'soldier');box(-.22,-.22,.22,.22,27,32,AC.boisC,rnd,TX.plank);
    for(const[x,y]of[[-.2,-.2],[.2,-.2],[.2,.2],[-.2,.2]])post(x,y,32,40,rnd);cone(0,0,.3,40,14,AC.chaume,rnd);},
  barracks(rnd){ground(2,'#c4ab84',rnd,.92);box(-.6,-.42,.6,-.08,0,12,AC.boisC,rnd,TX.plank);door2(0,-.08,0,.14,9,rnd,AC.ocre);gable2(-.6,-.42,.6,-.08,12,13,AC.chaume,rnd,AC.boisC);
    const[dx,dy]=W(-.3,.35);g.strokeStyle=AC.bois;g.lineWidth=2;g.beginPath();g.moveTo(dx,dy);g.lineTo(dx,dy-17);g.moveTo(dx-7,dy-12);g.lineTo(dx+7,dy-11);g.stroke();g.fillStyle='#e6c870';g.beginPath();g.ellipse(dx,dy-13,3.4,4.5,0,0,7);g.fill();pencil(smoothPts(irregular(dx,dy-13,3.4,4.5,8,rnd,.05)),true,.6,rnd);
    post(.2,.4,0,13,rnd);post(.6,.4,0,13,rnd);const a=W(.2,.4,11),b=W(.6,.4,11);g.strokeStyle=AC.bois;g.lineWidth=1.4;g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();
    for(let k=0;k<4;k++){const p=W(.27+k*.1,.4);g.strokeStyle='#6b4626';g.lineWidth=.9;g.beginPath();g.moveTo(p[0],p[1]);g.lineTo(p[0]+1,p[1]-19);g.stroke();g.fillStyle='#c8cdd2';g.beginPath();g.moveTo(p[0]+.4,p[1]-19);g.lineTo(p[0]+2,p[1]-19);g.lineTo(p[0]+1.4,p[1]-23);g.fill();}
    [AC.guede,AC.ocre,AC.ajonc].forEach((c,k)=>shield3(.26+k*.15,.44,4,c,rnd));},
  grove(rnd){ground(3,'#6ea56f',rnd,.94);g.strokeStyle='rgba(240,232,200,.4)';g.lineWidth=1.2;const[cx,cy]=W(0,0);g.beginPath();g.ellipse(cx,cy,42,26,0,0,7);g.stroke();
    const trees=[[-.95,-.45],[.95,-.45],[0,-1],[-.6,-.85],[.6,-.85]];trees.sort((a,b)=>DP2(...a)-DP2(...b));for(const[x,y]of trees)oak3(...W(x,y),1,rnd,'#4a6a42');
    menhir3(0,0,30,rnd);for(const[c,o]of[[AC.ocre,-5],[AC.guede,0],[AC.ajonc,5]]){const p=W(0,0,22);g.strokeStyle=c;g.lineWidth=1.2;g.beginPath();g.moveTo(p[0]-3,p[1]+o*.2);g.quadraticCurveTo(p[0]+6,p[1]+4+o*.3,p[0]+4,p[1]+12+o*.4);g.stroke();}
    box(.25,.25,.5,.38,0,4,AC.granit,rnd,null,AC.granit);for(const[x,y]of[[-.95,.5],[.9,.55]])oak3(...W(x,y),1,rnd,'#4a6a42');},
  bard(rnd){ground(2,'#a99a72',rnd,.9);const rim=ring(0,.05,.55,.45,10);rim.sort((a,b)=>DP2(...a)-DP2(...b));
    for(const[k,[x,y]]of rim.entries()){if(k%2)boulder3(...W(x,y),.42,rnd);else{const a=W(x-.08,y),b=W(x+.08,y);g.strokeStyle=AC.bois;g.lineWidth=4;g.lineCap='round';g.beginPath();g.moveTo(a[0],a[1]-2);g.lineTo(b[0],b[1]-2);g.stroke();pencil([[a[0],a[1]-4],[b[0],b[1]-4]],false,.5,rnd);}}
    const p=W(0,.05);for(let k=0;k<7;k++){const a=k/7*7;g.fillStyle='#6c6960';g.beginPath();g.ellipse(p[0]+Math.cos(a)*7,p[1]+Math.sin(a)*3.5,2.2,1.5,0,0,7);g.fill();}},
  chief(rnd){ground(3,'#d0bb98',rnd,.94);const rim=ring(0,0,1.25,1.12,28).filter(p=>DP2(...p)<-.1).sort((a,b)=>a[0]-b[0]);fence3(rim,13,rnd);
    box(-.85,-.32,.85,.3,0,4,AC.granit,rnd,TX.stone);box(-.85,-.32,.85,.3,4,15,AC.chaux,rnd,TX.chaux);door2(0,.3,0,.18,12,rnd,AC.ocre);win2(-.45,.3,7,rnd);win2(.45,.3,7,rnd);
    [AC.guede,AC.ocre,AC.ajonc,AC.guede].forEach((c,k)=>shield3(-.7+k*.47+(k>1?.1:0),.3,10,c,rnd));gable2(-.85,-.32,.85,.3,15,22,AC.chaume,rnd,AC.chaux);
    for(const x of[-.3,.3])post(x,.62,0,18,rnd,'#5a4030');banner(.95,-.25,0,52,AC.ocre,rnd);},
  port(rnd){ground(2,'#c8b996',rnd,.92);box(-.55,-.3,.15,.12,0,11,AC.boisC,rnd,TX.plank);door2(-.2,.12,0,.2,9,rnd,AC.guede);gable2(-.55,-.3,.15,.12,11,13,AC.chaume,rnd,AC.boisC);
    post(.35,-.25,0,18,rnd);post(.65,-.05,0,18,rnd);g.strokeStyle='rgba(230,220,190,.75)';g.lineWidth=.5;for(let k=0;k<6;k++){const a=W(.35,-.25,16-k*2.4),b=W(.65,-.05,16-k*2.4);g.beginPath();g.moveTo(a[0],a[1]);g.quadraticCurveTo((a[0]+b[0])/2,(a[1]+b[1])/2+3,b[0],b[1]);g.stroke();}
    barrel3(-.4,.4,rnd);barrel3(-.28,.46,rnd);crate3(.05,.42,.07,rnd);crate3(.18,.5,.06,rnd);amph3(.42,.3,rnd);amph3(.48,.36,rnd);},
};
ART2.trade=ART2.store;

/* animations posées sur les nouveaux dessins (coordonnées relatives au centre du bâtiment) */
function liveB(b,time){const p=LOC,[ox,oy]=bc(b);LOC={c:0,k:1,ox,oy,z:ZH(idx(b.x,b.y))};try{liveB2(b,time);}finally{LOC=p;}}
function liveB2(b,time){const t=b.type;
  if(t==='port'&&S.dock!=null&&S.dock>=0){const p=LOC;LOC=null;const[cx,cy]=bc(b),d=S.dock,z0=ZH(idx(b.x,b.y));
    for(let k=0;k<7;k++){const u=.25+k*.11,x0=cx+(HX(d)-cx)*u,y0=cy+(HY(d)-cy)*u,dx=HY(d)-cy,dy=-(HX(d)-cx),n=Math.hypot(dx,dy)||1;
      P([W(x0+dx/n*.13,y0+dy/n*.13,z0+2),W(x0+dx/n*.13+(HX(d)-cx)*.1,y0+dy/n*.13+(HY(d)-cy)*.1,z0+2),W(x0-dx/n*.13+(HX(d)-cx)*.1,y0-dy/n*.13+(HY(d)-cy)*.1,z0+2),W(x0-dx/n*.13,y0-dy/n*.13,z0+2)],k%2?'#9a7a5a':'#a88762','#4e3e30',.6);
      if(k%2===0){const q=W(x0,y0,z0+2);ln(q,[q[0],q[1]+10],'#3e3228',1.6);}}
    const[sx,sy]=W(HX(d),HY(d),ZW);shipFig(sx+6,sy+2,.85,'#5a4030','#c98a4a',time,0);LOC=p;}
  else if(t==='pigs')for(let k=0;k<3;k++){const[px,py]=W(.05+k*.22+Math.sin(time/800+k)*.08,.15+Math.cos(time/1000+k*2)*.1);
    g.fillStyle='rgba(0,0,0,.25)';g.beginPath();g.ellipse(px+2,py,6,2.4,0,0,7);g.fill();g.fillStyle='#f0b0aa';g.beginPath();g.ellipse(px,py-4,6,3.6,0,0,7);g.fill();g.fillStyle='#d8948e';g.beginPath();g.ellipse(px+1.5,py-3.5,4,2.4,0,0,7);g.fill();
    g.fillStyle='#f0b0aa';g.beginPath();g.arc(px-5.5,py-5,2.6,0,7);g.fill();g.strokeStyle=INK;g.globalAlpha=.6;g.lineWidth=.6;g.beginPath();g.ellipse(px,py-4,6,3.6,0,0,7);g.stroke();g.globalAlpha=1;}
  else if(t==='brew'){if(b.wk>0)smoke(.24,-.08,34,time,'r');}
  else if(t==='forge'){const[px,py]=W(0,.2,4);const f=Math.sin(time/120)*.5+.5;g.fillStyle=`rgba(255,${120+f*70|0},40,${b.wk>0?.95:.25})`;g.fillRect(px-4,py-6,8,6);
    if(b.wk>0){blur(1);g.fillStyle=`rgba(255,150,40,${.25+f*.15})`;g.beginPath();g.arc(px,py-2,10,0,7);g.fill();blur(0);smoke(.29,-.13,40,time,'k');}}
  else if(t==='bard'){const[px,py]=W(0,.05);const f=Math.sin(time/90)*2,f2=Math.cos(time/130)*1.5;
    g.fillStyle='rgba(255,170,60,.2)';g.beginPath();g.arc(px,py-6,16,0,7);g.fill();g.fillStyle='#e0601e';g.beginPath();g.moveTo(px-7,py);g.quadraticCurveTo(px-4+f2,py-14,px+f,py-21-f);g.quadraticCurveTo(px+4,py-10,px+7,py);g.fill();
    g.fillStyle='#f8d050';g.beginPath();g.moveTo(px-4,py);g.quadraticCurveTo(px,py-12+f,px+4,py);g.fill();}
  else if(B[t].store){const u=used(b)/B[t].cap;if(u>0){const[px,py]=W(0,0,58);g.fillStyle='rgba(20,20,15,.75)';g.fillRect(px-15,py,30,4.5);g.fillStyle=AC.ajonc;g.fillRect(px-14.5,py+.5,29*u,3.5);}}
  if(b.hp!=null&&b.hp<b.maxhp){const[px,py]=W(0,0,b.s>1?62:44);g.fillStyle='rgba(0,0,0,.65)';g.fillRect(px-14,py,28,4);g.fillStyle='#de6a4e';g.fillRect(px-14,py,28*Math.max(0,b.hp/b.maxhp),4);}}

function render(time){
  g=ctx;LOC=null;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#284250';ctx.fillRect(0,0,cv.width,cv.height);
  const z=cam.z;ctx.setTransform(dpr*z,0,0,dpr*z,dpr*(cw/2-cam.x*z),dpr*(ch/2-cam.y*z));
  const vx0=cam.x-cw/2/z-80,vx1=cam.x+cw/2/z+80,vy0=cam.y-ch/2/z-100,vy1=cam.y+ch/2/z+80;
  const ov=ovKind();
  const wells=tool==='well'||tool==='hut'||ov==='water'?blds().filter(b=>b.type==='well').map(b=>idx(b.x,b.y)):null;
  const items=[],land=[],roadsV=[];
  for(let i=0;i<N*N;i++){
    const[wx,wy]=W(HX(i),HY(i));if(wx<vx0||wx>vx1||wy<vy0||wy>vy1)continue;
    const t=S.ter[i],v=S.vr[i];
    if(t===2){blit(tileSpr(DEP[i]>=3?'w':'s',(v*3)|0),wx,wy-ZW);
      for(let k=0;k<6;k++){const j=nbDir(i,EDGE_DIR[k]);if(j>=0&&S.ter[j]!==2){const a=corner(HX(i),HY(i),k,HR),b=corner(HX(i),HY(i),(k+1)%6,HR);
        const tide=.5+.5*Math.sin(time/2600+X(i)*.15);ln(W(a[0],a[1],ZW),W(b[0],b[1],ZW),'rgba(235,240,238,'+(.35+.4*tide)+')',1.2+tide*1.6);}}
      if(((i*13)%7)<2){const o=Math.sin(time/1100+i)*.08;const p1=W(HX(i)-.15+o,HY(i)-.05,ZW),p2=W(HX(i)+.05+o,HY(i)+.02,ZW);ln(p1,p2,'rgba(220,232,232,.3)',1);}
      if(S.road[i])land.push(i);
    }else land.push(i);
    if(S.road[i])roadsV.push(i);
    if(t===1&&!S.road[i])items.push({d:DPi(i)+.05,k:'tree',i,v});
    if(t===3)items.push({d:DPi(i)+.05,k:'rock',i,v});
    if(S.deco&&S.deco[i])items.push({d:DPi(i)+.06,k:'deco',i});
    else if(t===0&&!S.road[i]&&!S.occ[i]&&!S.wall[i]&&!(S.lnd&&S.lnd[i])&&((Math.imul(i,2654435761)>>>0)%100)<3&&!nb4(i).some(j=>S.ter[j]===1||S.occ[j]))items.push({d:DPi(i)+.05,k:'lone',i,v});
    const id=S.occ[i];if(id){const b=S.b[id];if(b&&i===idx(b.x,b.y)){let m=-1e9;for(const f of tilesOf(b))m=Math.max(m,DPi(f));items.push({d:m+.2,k:'b',b});}}
    if(S.wall[i])items.push({d:DPi(i)+.15,k:'wall',i});
  }
  {const[mx,my]=W(N/2,N*.433);ctx.save();ctx.translate(mx,my);ctx.scale(1,TILT);const R0=N*.34*HW,R1=N*.62*HW;
    const gr=ctx.createRadialGradient(0,0,R0,0,0,R1);gr.addColorStop(0,'rgba(40,66,80,0)');gr.addColorStop(.55,'rgba(40,66,80,.7)');gr.addColorStop(1,'rgba(40,66,80,1)');
    ctx.fillStyle=gr;ctx.fillRect(-R1*3,-R1*3,R1*6,R1*6);ctx.restore();}
  for(let cy2=0;cy2<N/CHN;cy2++)for(let cx2=0;cx2<N/CHN;cx2++){const c=chunk(cx2,cy2);if(!c||c.x0>vx1||c.x0+c.w<vx0||c.y0>vy1||c.y0+c.h<vy0)continue;g.drawImage(c.c,c.x0,c.y0,c.w,c.h);}
  for(const i of land){const t=S.ter[i];
    if(wells&&t===0&&!S.road[i]&&!S.occ[i]&&wells.some(w=>hdist(w,i)<=3))hexI(i,'rgba(110,170,230,.28)',null,0,.96);
  }
  if(ov&&ov!=='water'){const c=OV[ov].c,V=VIS[ov];for(const i of roadsV){const age=(S.tick-V[i])/(MONTH*4);if(age<1)hexI(i,`rgba(${c},${.12+.5*(1-age)})`,null,0,.8);}
    const sb=sel&&S.b[sel];if(sb&&TOOLOV[sb.type]===ov){const rs=reachOf(sb);for(const i of rs)hexI(i,null,`rgba(${c},.95)`,1.6/z,.86);}}
  for(const u of S.u)items.push({d:DP2(u.px,u.py)+.1,k:'u',u});
  for(const w of S.w){const ax=HX(w.cur),ay=HY(w.cur),bx=HX(w.nxt),by=HY(w.nxt);const px=ax+(bx-ax)*w.t,py=ay+(by-ay)*w.t;items.push({d:DP2(px,py)+.1,k:'w',w,px,py});}
  items.sort((a,b)=>a.d-b.d);
  for(const it of items){
    if(it.k==='tree'){const[wx,wy]=W(HX(it.i),HY(it.i),ZH(it.i));blit(treeSpr2(treeCtx(it.i),(it.v*4)|0),wx,wy);}
    else if(it.k==='lone'){const[wx,wy]=W(HX(it.i),HY(it.i),ZH(it.i));blit(loneOak((it.v*3)|0),wx,wy);}
    else if(it.k==='deco'){const[wx,wy]=W(HX(it.i),HY(it.i),ZH(it.i));blit(decoSpr(S.deco[it.i]),wx,wy);}
    else if(it.k==='rock'){const[wx,wy]=W(HX(it.i),HY(it.i),ZH(it.i));blit(rockSpr2(rockCtx(it.i),(it.v*3)|0),wx,wy);}
    else if(it.k==='b'){const b=it.b,[cx,cy]=bc(b),[ax,ay]=W(cx,cy,ZH(idx(b.x,b.y)));blit(bSprite(b),ax,ay);liveB(b,time);}
    else if(it.k==='w'){const w=it.w,[px,py]=W(it.px,it.py,ZH(w.cur)+(ZH(w.nxt)-ZH(w.cur))*w.t),ph=w.t*Math.PI*2;
      if(w.k==='cart')cartFig(px,py,ph,w.res);else figure(px,py,ph,w.k==='priest'?GODC[w.god]:WALK[w.k],w.k);}
    else if(it.k==='wall'){const i=it.i,[wx,wy]=W(HX(i),HY(i),ZH(i));blit(wallSpr(S.wall[i]===2?'g':S.whp[i]<50?'d':'w'),wx,wy);}
    else if(it.k==='u'){const u=it.u,idle=!S.raid&&u.k==='warrior'&&u.nxt===u.cur;const[px,py]=W(u.px+(idle?u.ox:0),u.py+(idle?u.oy:0),ZH(u.cur)+(ZH(u.nxt)-ZH(u.cur))*u.t);unitFig(u,px,py,u.t*Math.PI*2);}
  }
  if(ov)for(const h of blds()){if(h.type!=='hut'||h.pop<=0)continue;const[hx,hy]=bc(h),[px,py]=W(hx,hy,ZH(idx(h.x,h.y))+(h.lvl>=3?40:34));
    if(px<vx0||px>vx1||py<vy0||py>vy1)continue;const ok=houseOK(h,ov);ctx.fillStyle=ok?'#86b86a':'#de6a4e';ctx.strokeStyle='#14100a';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(px,py,4.6,0,7);ctx.fill();ctx.stroke();}
  ctx.save();ctx.globalCompositeOperation='multiply';
  for(let k=0;k<4;k++){const cxw=((time*.006+k*820)%3400)-700,cyw=200+k*230-((time*.003+k*300)%900);
    const gr=ctx.createRadialGradient(cxw,cyw,10,cxw,cyw,260);gr.addColorStop(0,'rgba(90,104,118,.22)');gr.addColorStop(1,'rgba(90,104,118,0)');
    ctx.fillStyle=gr;ctx.beginPath();ctx.ellipse(cxw,cyw,320,170,0,0,7);ctx.fill();}
  ctx.fillStyle='rgba(222,230,238,.25)';ctx.fillRect(vx0-200,vy0-200,vx1-vx0+400,vy1-vy0+400);
  ctx.restore();
  drawFX(time);
  if(sel&&S.b[sel]){for(const i of tilesOf(S.b[sel]))hexI(i,null,'#f0c45a',2/z,.97);}
  if(hover>=0){
    const hx=X(hover),hy=Y(hover);
    if(drag&&drag.mode==='wall'){for(const i of roadLine(drag.a,hover))hexI(i,(S.occ[i]||S.wall[i])?null:(S.road[i]||S.ter[i]===0)?'rgba(200,190,160,.55)':'rgba(222,106,78,.55)',null,0,.92);}
    else if(drag&&drag.mode==='road'){for(const i of roadLine(drag.a,hover))hexI(i,(S.road[i]||S.occ[i])?null:roadCost(i)<0?'rgba(222,106,78,.55)':'rgba(240,200,110,.45)',null,0,.92);}
    else if(drag&&drag.mode==='demolish'){const a=drag.a;for(let y=Math.min(Y(a),hy);y<=Math.max(Y(a),hy);y++)for(let x=Math.min(X(a),hx);x<=Math.max(X(a),hx);x++)hexI(idx(x,y),'rgba(222,106,78,.35)',null,0,.95);}
    else if(tool==='road'||tool==='demolish'||tool==='wall'){hexI(hover,tool==='road'?'rgba(240,200,110,.4)':'rgba(222,106,78,.35)',null,0,.95);}
    else if(B[tool].s){const f=foot(B[tool].s,hx,hy);const ok=!canPlace(tool,hx,hy);if(f)for(const i of f)hexI(i,ok?'rgba(134,184,106,.45)':'rgba(222,106,78,.45)',ok?'#cde8b8':'#f2b0a0',1.2/z,.95);else hexI(hover,'rgba(222,106,78,.45)',null,0,.95);}
  }
}
const OV={water:{n:'Eau',c:'110,170,230',d:"Zone bleue : portée des puits (3 cases).",ok:"maison qui a de l'eau"},
  market:{n:'Marché',c:'232,170,70',d:"Chemins colorés : passages récents d'une marchande (la couleur s'efface en 4 mois).",ok:"maison qui a des vivres"},
  druid:{n:'Culte',c:'240,238,226',d:"Chemins colorés : passages récents d'un druide ou d'un prêtre.",ok:"maison visitée depuis moins de 4 mois"},
  bard:{n:'Bardes',c:'226,104,70',d:"Chemins colorés : passages récents d'un barde.",ok:"maison visitée depuis moins de 4 mois"},
  tax:{n:'Tribut',c:'110,160,232',d:"Chemins colorés : passages récents du collecteur.",ok:"maison taxée depuis moins de 3 mois"}};
const TOOLOV={well:'water',market:'market',grove:'druid',t_taranis:'druid',t_belenos:'druid',t_epona:'druid',bard:'bard',chief:'tax'};
function ovKind(){if(view!=='none')return view;if(TOOLOV[tool])return TOOLOV[tool];const b=sel&&S.b[sel];return b&&TOOLOV[b.type]||null;}
function houseOK(h,k){if(k==='tax')return S.mi-h.lastTax<=2;const a=hasOf(h);return k==='water'?a.water:k==='market'?a.food:k==='druid'?a.relig:a.ent;}
let reachC={id:0,t:-99,set:null};
function reachOf(b){if(reachC.id===b.id&&S.tick-reachC.t<30)return reachC.set;const set=new Set();const dist=new Map();const q=[];
  for(const a of access(b)){dist.set(a,0);q.push(a);}let h=0;while(h<q.length){const i=q[h++];set.add(i);const d=dist.get(i);if(d>=MAXSTEP)continue;for(const j of roadNb(i))if(!dist.has(j)){dist.set(j,d+1);q.push(j);}}
  reachC={id:b.id,t:S.tick,set};return set;}
let lastOv='';
function renderViews(){const k=ovKind();const key=k+'|'+view;if(key===lastOv)return;lastOv=key;
  document.querySelectorAll('.vb button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===(view==='none'&&k?k:view)));
  const n=$('viewNote');if(!k){n.hidden=true;return;}const o=OV[k];n.hidden=false;
  n.innerHTML=`<b>Vue ${o.n.toLowerCase()}</b> · ${o.d}${k!=='water'?' Contour : zone que le marcheur du bâtiment sélectionné peut atteindre.':''}<br><span class="dot" style="background:#86b86a"></span>${o.ok} · <span class="dot" style="background:#de6a4e"></span>maison qui en manque`;}
document.querySelectorAll('.vb button').forEach(b=>b.onclick=()=>{view=b.dataset.v;lastOv='';});
const roadLine=hexLine;

/* ---------- entrées ---------- */
function resize(){const r=$('view').getBoundingClientRect();dpr=window.devicePixelRatio||1;cw=r.width;ch=r.height;cv.width=Math.max(1,cw*dpr|0);cv.height=Math.max(1,ch*dpr|0);}
function pick(cx,cy){const r=cv.getBoundingClientRect();const wx=(cx-r.left-cw/2)/cam.z+cam.x,wy=(cy-r.top-ch/2)/cam.z+cam.y;
  const at=zz=>{const qx=wx/HW,qy=(wy+zz)/(HW*TILT),px=qx*CR+qy*SR,py=-qx*SR+qy*CR,rf=py/.866;const[hq,hr]=hexRound(px-rf/2,rf);return fromCube(hq,hr);};
  let best=-1,bd=-1e9;for(let h=-1;h<=8;h++){const zz=h<0?ZW:h*STEP,j=at(zz);if(j<0)continue;if(Math.abs(ZH(j)-zz)<.5&&DPi(j)>bd){bd=DPi(j);best=j;}}
  return best>=0?best:at(0);}
const ptrs=new Map();let pinch=null,down=null;
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('pointerdown',e=>{
  cv.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptrs.size===2){const[a,b]=[...ptrs.values()];pinch={d:Math.hypot(a.x-b.x,a.y-b.y),z:cam.z};drag=null;down=null;return;}
  const i=pick(e.clientX,e.clientY);
  down={x:e.clientX,y:e.clientY,cx:cam.x,cy:cam.y,moved:0,btn:e.button,pan:e.button!==0||tool==='inspect'};
  if(!down.pan&&i>=0&&(tool==='road'||tool==='demolish'||tool==='wall'))drag={mode:tool,a:i};
});
cv.addEventListener('pointermove',e=>{
  if(ptrs.has(e.pointerId))ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pinch&&ptrs.size===2){const[a,b]=[...ptrs.values()];cam.z=Math.max(.45,Math.min(2.4,pinch.z*Math.hypot(a.x-b.x,a.y-b.y)/pinch.d));return;}
  hover=pick(e.clientX,e.clientY);
  if(!down)return;
  const dx=e.clientX-down.x,dy=e.clientY-down.y;down.moved=Math.max(down.moved,Math.hypot(dx,dy));
  if(!drag&&(down.pan||down.moved>12)){down.pan=true;cam.x=down.cx-dx/cam.z;cam.y=down.cy-dy/cam.z;}
});
function endPtr(e){
  ptrs.delete(e.pointerId);if(pinch){if(ptrs.size<2)pinch=null;down=null;return;}
  if(!down)return;const i=pick(e.clientX,e.clientY);
  if(drag){if(i>=0){if(drag.mode==='road')buildRoad(roadLine(drag.a,i));else if(drag.mode==='wall')buildWall(roadLine(drag.a,i));else demolishRect(drag.a,i);}drag=null;}
  else if(down.moved<8&&down.btn===0&&i>=0){
    if(tool==='inspect'){sel=S.occ[i]||null;selTile=i;dirtySel=true;if(sel&&innerWidth<=820)setPanel(true);}
    else if(B[tool].s){if(place(tool,X(i),Y(i))){sel=S.occ[i];selTile=i;dirtySel=true;}}
  }
  down=null;
}
cv.addEventListener('pointerup',endPtr);cv.addEventListener('pointercancel',e=>{ptrs.delete(e.pointerId);down=null;drag=null;pinch=null;});
cv.addEventListener('pointerleave',()=>{if(!down)hover=-1;});
cv.addEventListener('wheel',e=>{e.preventDefault();const r=cv.getBoundingClientRect();const mx=e.clientX-r.left-cw/2,my=e.clientY-r.top-ch/2;
  const wx=mx/cam.z+cam.x,wy=my/cam.z+cam.y;cam.z=Math.max(.45,Math.min(2.4,cam.z*Math.exp(-e.deltaY*.0015)));cam.x=wx-mx/cam.z;cam.y=wy-my/cam.z;},{passive:false});
const keys={};
addEventListener('keydown',e=>{if(e.target.tagName==='BUTTON'&&(e.key===' '||e.key==='Enter'))return;keys[e.key.toLowerCase()]=1;
  if(e.key==='Escape'){setTool('inspect');sel=null;dirtySel=true;}
  if(e.key===' '){e.preventDefault();setSpeed(speed?0:1);}
  if(e.key==='+'||e.key==='=')cam.z=Math.min(2.4,cam.z*1.15);if(e.key==='-')cam.z=Math.max(.45,cam.z/1.15);});
addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=0;});

/* ---------- interface ---------- */
let selTile=-1,dirtySel=true,dirtyLog=true,dirtyObj=true,dirtyLabor=true,view='none';
function setTool(t){tool=t;document.querySelectorAll('.tb').forEach(b=>b.setAttribute('aria-pressed',b.dataset.t===t));
  const d=B[t];$('hint').innerHTML=`<b>${d.n}</b>${d.cost?` · ${d.cost} st.`:''}${d.s>1?` · ${d.s}×${d.s}`:''} — ${d.d}`;
  cv.style.cursor=t==='inspect'?'grab':'crosshair';}
function setSpeed(s){speed=s;document.querySelectorAll('.speed [data-s]').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.s===s));}
function setPanel(o){$('panel').dataset.open=o?'true':'false';}
function buildToolbar(){const el=$('tools');el.innerHTML='';
  for(const[cat,list]of TOOLS){const g=document.createElement('div');g.className='grp';g.innerHTML=`<h4>${cat}</h4>`;const bt=document.createElement('div');bt.className='bt';
    for(const t of list){const d=B[t];const b=document.createElement('button');b.className='tb';b.dataset.t=t;b.id='tool-'+t;b.setAttribute('aria-pressed','false');
      b.innerHTML=`<span class="n"><i style="background:${d.c}"></i>${d.n}</span><span class="c">${d.cost?d.cost+' st.':t==='inspect'?'vue':'gratuit'}</span>`;
      b.onclick=()=>setTool(t);bt.appendChild(b);}
    g.appendChild(bt);el.appendChild(g);}
}
function buildTrade(){const el=$('tradeBtns');el.innerHTML='';for(const r of Object.keys(RES)){const b=document.createElement('button');b.id='sell-'+r;
  b.onclick=()=>{S.sell[r]=!S.sell[r];renderTrade();};el.appendChild(b);}renderTrade();}
function renderTrade(){for(const r of Object.keys(RES)){const b=$('sell-'+r);b.setAttribute('aria-pressed',!!S.sell[r]);b.textContent=`${RES[r].n} · ${RES[r].p}`;}
  $('tradeNote').textContent=S.tradeOK?"Les navires de l'île de Bretagne accostent au port chaque mois et achètent ce que vous cochez, au-delà d'une réserve de 30. Prix en statères par unité.":"Le port a besoin de bras pour accueillir les navires marchands.";}
const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
function renderSel(){
  const el=$('selSec');const b=sel&&S.b[sel];
  if(!b){
    if(selTile>=0&&S.road[selTile]){el.innerHTML=`<h2>Chemin</h2><p class="muted">${S.ter[selTile]===2?'Un pont de planches franchit le bras de mer.':'Terre battue, praticable par tous les marcheurs.'}${selTile===ENTRY()?' Les familles arrivent par ici.':''}</p>`;return;}
    if(selTile>=0&&S.deco&&S.deco[selTile]){el.innerHTML=`<h2>${DECO[S.deco[selTile]]}</h2><p class="muted">${DECOTXT[S.deco[selTile]]}</p>`;return;}
    if(selTile>=0){const n=['Prairie','Forêt de chênes','Rivière','Rochers'][S.ter[selTile]];el.innerHTML=`<h2>${n}</h2><p class="muted">${['Terrain à bâtir.','Le bûcheron y coupe son bois. Un chemin la défriche.','On la franchit avec un pont (20 st.).','Le fer affleure : une mine doit toucher ces rochers.'][S.ter[selTile]]}</p>`;return;}
    const st=S.pop<30;
    el.innerHTML=`<h2>Premiers pas</h2><p>${st?"Prolongez la route qui part du port, posez des huttes de part et d'autre et un puits. Ajoutez ensuite un champ de blé, un grenier et un marché, le tout relié par des chemins.":"Sélectionnez <b>Observer</b> puis cliquez sur une maison pour savoir ce qui lui manque pour grandir."}</p>`;return;}
  const d=B[b.type];
  if(b.type==='hut'){
    const a=hasOf(b);const cap=LV[b.lvl].cap;
    const needs=[['Eau d\'un puits proche',a.water,2],['Nourriture livrée par le marché',a.food,2],['Visite d\'un druide',a.relig,3],['Cervoise',a.cerv,3],['Blé et porc',a.types2,4],['Chants d\'un barde',a.ent,4],['Torques',a.torq,4]];
    const show=needs.filter(n=>n[2]<=Math.min(4,b.lvl+1));
    el.innerHTML=`<h2>${LV[b.lvl].n}</h2>
      <div class="row"><span class="muted">Habitants</span><span>${b.pop} / ${cap}</span></div><div class="row"><span class="muted">Tribut en attente</span><span>${Math.floor(b.owed||0)} st.</span></div>${b.inc?`<div class="row"><span class="muted">En chemin</span><span>${b.inc}</span></div>`:''}
      <h3>Réserves de la maison</h3>
      <div class="res"><span>Blé</span><span>${Math.floor(b.food.ble)}</span><span>Porc</span><span>${Math.floor(b.food.porc)}</span><span>Cervoise</span><span>${Math.floor(b.cerv)}</span><span>Torques</span><span>${b.torq.toFixed(1)}</span></div>
      ${b.pop===0&&!b.inc?'<p class="muted">Parcelle libre. Elle doit être reliée par un chemin à l\'entrée du village.</p>':''}
      <h3>${b.lvl<4?'Pour devenir '+LV[b.lvl+1].n.toLowerCase():'Pour rester demeure noble'}</h3>
      ${show.map(n=>`<div class="need ${n[1]?'y':'n'}"><span class="m">${n[1]?'✓':'✗'}</span><span>${n[0]}</span></div>`).join('')}
      ${b.bad?'<span class="chip warn">Risque de déclin le mois prochain</span>':''}`;
    return;
  }
  let h=`<h2>${d.n}</h2><p class="muted">${d.d}</p>`;
  if(d.jobs)h+=`<div class="row"><span class="muted">Employés</span><span>${b.wk||0} / ${d.jobs}</span></div><div class="bar"><i style="width:${(b.wk||0)/d.jobs*100}%"></i></div><p class="muted">Secteur « ${SECT[PRIO[b.type]].toLowerCase()} », servi ${['en premier','en deuxième','en troisième','en quatrième','en dernier'][PRIO[b.type]]}.</p>`;
  if(b.status)h+=`<div><span class="chip ${/Aucun|Personne|attente|vides|hors|Pas relié|Plein/i.test(b.status)?'warn':'good'}">${esc(b.status)}</span></div>`;
  if(d.mon){const pr=monProg(b);h+=`<div class="row"><span class="muted">${b.done?'Achevé':'Avancement du chantier'}</span><span>${Math.round(pr*100)} %</span></div><div class="bar"><i style="width:${pr*100}%"></i></div>`+(b.done?'':Object.keys(d.mon).map(r=>`<div class="row"><span>${RES[r].n}</span><span>${(b.got&&b.got[r])||0} / ${d.mon[r]}</span></div>`).join(''));}
  if(d.out){h+=`<div class="row"><span class="muted">Production (${d.batch} ${RES[d.out].n.toLowerCase()})</span><span>${Math.round(b.prog/d.time*100)} %</span></div><div class="bar"><i style="width:${Math.min(100,b.prog/d.time*100)}%"></i></div>`;}
  if(d.store){h+=`<div class="row"><span class="muted">Rempli</span><span>${used(b)} / ${d.cap}</span></div>`+d.store.map(r=>`<div class="row"><span>${RES[r].n}</span><span>${Math.floor(b.stock[r]||0)}</span></div>`).join('');}
  el.innerHTML=h;
}
function renderObj(){$('objList').innerHTML=(S.won?'<div class="win">Victoire : le conseil des druides vous a proclamé vergobret. Vous pouvez continuer à bâtir.</div>':'')+
  OBJ.map(o=>{const ok=o[1]();return`<div class="obj ${ok?'y':''}"><span class="m">${ok?'✓':'·'}</span><span style="flex:1">${o[0]}</span><span class="muted">${o[2]()}</span></div>`;}).join('');}
function renderLog(){$('log').innerHTML=S.logs.map(l=>`<div><em>${esc(l.m)}</em>${esc(l.t)}</div>`).join('');}
function renderLabor(){const sc=S.sect||[[0,0],[0,0],[0,0],[0,0],[0,0]];const miss=S.jobs-(S.emp||0);
  let h=`<div class="row"><span class="muted">Habitants</span><span>${S.pop}</span></div><div class="row"><span class="muted">Travailleurs (la moitié)</span><span>${S.labor}</span></div><div class="row"><span class="muted">Postes ouverts</span><span>${S.jobs}</span></div>`;
  sc.forEach(([a,b],k)=>{if(b)h+=`<div class="row"><span>${SECT[k]}</span><span>${a} / ${b}</span></div><div class="bar"><i style="width:${a/b*100}%;background:${a<b?'var(--bad)':'var(--ok)'}"></i></div>`;});
  h+=miss>0?`<span class="chip warn">Il manque ${miss} travailleurs, soit environ ${miss*2} habitants</span>`:S.unemp>0?`<span class="chip">${S.unemp} sans travail : vous pouvez ouvrir des bâtiments</span>`:S.jobs?'<span class="chip good">Tous les postes sont pourvus</span>':'';
  $('laborBody').innerHTML=h;}
function renderTax(){const lv=S.taxLvl??1;document.querySelectorAll('#taxBtns button').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.t===lv));
  const owed=taxPending(S);const chief=blds().some(b=>b.type==='chief'&&b.wk>0);
  $('taxBody').innerHTML=`<div class="row"><span class="muted">Dû chaque mois</span><span>${Math.round(taxDue())} st.</span></div><div class="row"><span class="muted">En attente dans les maisons</span><span>${Math.round(owed)} st.</span></div>`+
   (chief?'':'<span class="chip warn">Sans maison du chef, personne ne collecte</span>')+
   `<p class="muted" style="font-size:12.5px">Chaque maison accumule son tribut ; le collecteur ramasse tout à son passage. ${['Léger : les familles arrivent plus nombreuses.','Normal : aucun effet sur les arrivées.','Lourd : les familles hésitent à venir.'][lv]}</p>`;}
document.querySelectorAll('#taxBtns button').forEach(b=>b.onclick=()=>{S.taxLvl=+b.dataset.t;renderTax();});
function renderStats(){
  $('sMoney').innerHTML=`${Math.floor(S.money)} <small>${S.lastBal>=0?'+':''}${Math.round(S.lastBal)}/mois</small>`;
  let p=0;for(const b of blds())if(b.type==='hut')p+=b.pop;
  $('sPop').innerHTML=p+(S.block?` <small>· arrivées freinées : ${S.block}</small>`:'');
  const fd=Math.floor(stockOf('ble')+stockOf('porc'));$('sFood').innerHTML=`${fd} <small>${S.cons?'−'+S.cons+'/mois':''}</small>`;
  $('sLabor').innerHTML=`${S.emp||0} / ${S.jobs}${S.jobs>(S.emp||0)?` <small>manque ${S.jobs-S.emp}</small>`:S.unemp>0?` <small>${S.unemp} sans travail</small>`:''}`;
  renderLabor();renderViews();
  $('sFavor').textContent=Math.round(S.favor)+' %';renderGods();renderDef();renderTax();
  $('sDate').textContent=dateTxt();$('festBtn').disabled=S.money<200;
}

const GODS=[['favor','Toutatis',"Nemetons et druides. Plus elle est haute, plus vos guerriers sont vaillants."],['taranis','Taranis',"Temple de Taranis. Au-dessus de 60 %, la foudre frappe les pillards."],
  ['belenos','Bélénos',"Temple de Bélénos. Au-dessus de 70 %, moissons abondantes."],['epona','Épona',"Temple d'Épona. Au-dessus de 70 %, plus d'arrivées et ventes mieux payées."]];
function renderGods(){$('godList').innerHTML=GODS.map(([k,n,d])=>{const v=Math.round(k==='favor'?S.favor:S.gf[k]);const c=v<25?'var(--bad)':v>=70?'var(--ok)':'var(--bronze)';
  return`<div><div class="row"><span><b>${n}</b></span><span>${v} %</span></div><div class="bar"><i style="width:${v}%;background:${c}"></i></div><p class="muted" style="font-size:12.5px;margin-top:3px">${d}</p></div>`;}).join('');}
function renderDef(){const war=S.u.filter(u=>u.k==='warrior').length,en=S.u.filter(u=>u.k==='enemy').length,tw=blds().filter(b=>b.type==='tower').length;
  let walls=0;for(let i=0;i<N*N;i++)if(S.wall[i])walls++;
  let next;if(S.raids===false)next='Raids désactivés';else if(en)next=`<span class="chip warn">${en} pillards dans l'oppidum</span>`;else if(S.pop<40)next='Aucun raid tant que le village compte moins de 40 habitants.';
  else{const m=Math.max(0,(S.raidNext??S.mi+12)-S.mi);next=S.raidWarn?'<span class="chip warn">Raid annoncé pour le mois prochain</span>':`Prochain raid dans environ ${m} mois.`;}
  $('defBody').innerHTML=`<div class="row"><span class="muted">Guerriers</span><span>${war}</span></div><div class="row"><span class="muted">Tours de guet</span><span>${tw}</span></div><div class="row"><span class="muted">Cases de rempart</span><span>${walls}</span></div><div>${next}</div>`;
  const rb=$('raidBtn'),on=S.raids!==false;rb.setAttribute('aria-pressed',on);rb.textContent='Raids de pillards : '+(on?'activés':'désactivés');}
$('raidBtn').onclick=()=>{S.raids=S.raids===false;if(S.raids===false){S.u=S.u.filter(u=>u.k!=='enemy');S.raid=0;S.raidWarn=0;}else S.raidNext=S.mi+12;renderDef();save();};
function renderWrath(){const on=S.wrath!==false;const b=$('wrathBtn');b.setAttribute('aria-pressed',on);b.textContent='Foudre de Taranis : '+(on?'activée':'désactivée');
  $('favNote').textContent=on?"Si la faveur de Toutatis tombe sous 15 %, Taranis peut foudroyer un bâtiment. Une fête élève tous les dieux de 15 points.":"La foudre sur vos bâtiments est désactivée. Une fête élève tous les dieux de 15 points.";}
$('wrathBtn').onclick=()=>{S.wrath=S.wrath===false;renderWrath();save();};
$('festBtn').onclick=()=>{if(S.money<200)return;S.money-=200;S.favor=Math.min(100,S.favor+15);for(const k in S.gf)S.gf[k]=Math.min(100,S.gf[k]+15);log("Grande fête : sacrifices et banquet en l'honneur des dieux du clan.");renderGods();};
document.querySelectorAll('.speed [data-s]').forEach(b=>b.onclick=()=>setSpeed(+b.dataset.s));
$('infoBtn').onclick=()=>setPanel($('panel').dataset.open!=='true');
let confirmT=0;
$('newBtn').onclick=()=>{const b=$('newBtn');if(b.dataset.c!=='1'){b.dataset.c='1';b.textContent='Confirmer : tout recommencer';clearTimeout(confirmT);confirmT=setTimeout(()=>{b.dataset.c='';b.textContent='Nouvelle partie';},3000);return;}
  b.dataset.c='';b.textContent='Nouvelle partie';const wr=S.wrath;newGame((Math.random()*1e9)|0);S.wrath=wr;staff();renderWrath();sel=null;selTile=-1;dirtySel=dirtyLog=dirtyObj=true;renderTrade();save();};

/* ---------- boucle ---------- */
let last=0,acc=0,uiT=0;
function frame(t){
  const dt=Math.min(250,t-(last||t));last=t;
  const ps=500/cam.z*dt/1000;if(keys['arrowleft']||keys['q']||keys['a'])cam.x-=ps;if(keys['arrowright']||keys['d'])cam.x+=ps;if(keys['arrowup']||keys['z']||keys['w'])cam.y-=ps;if(keys['arrowdown']||keys['s'])cam.y+=ps;
  if(speed>0){acc+=dt*speed*10/1000;let n=0;while(acc>=1&&n<40){stepSim();acc--;n++;}if(n>=40)acc=0;}
  render(t);
  uiT+=dt;if(uiT>300){uiT=0;renderStats();if(sel||dirtySel){renderSel();dirtySel=false;}}
  if(dirtyLog){renderLog();dirtyLog=false;}if(dirtyObj){renderObj();dirtyObj=false;}
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
