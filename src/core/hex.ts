// @ts-nocheck — extrait tel quel de la version mono-fichier ; à typer progressivement.
import { N } from './constants';

const idx=(x,y)=>y*N+x, X=i=>i%N, Y=i=>(i/N)|0, inb=(x,y)=>x>=0&&y>=0&&x<N&&y<N;
const SQ3=Math.sqrt(3),HR=1/SQ3;
const HX=i=>X(i)+((Y(i)&1)?.5:0), HY=i=>Y(i)*.866;
function cube(i){const c=X(i),r=Y(i);const q=c-((r-(r&1))>>1);return[q,r,-q-r];}
function fromCube(q,r){const c=q+((r-(r&1))>>1);return inb(c,r)?idx(c,r):-1;}
function hdist(a,b){const A=cube(a),C=cube(b);return Math.max(Math.abs(A[0]-C[0]),Math.abs(A[1]-C[1]),Math.abs(A[2]-C[2]));}
const DIRS=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
function nbDir(i,d){const[q,r]=cube(i);return fromCube(q+DIRS[d][0],r+DIRS[d][1]);}
const NBC=[];
function nb4(i){let o=NBC[i];if(o)return o;o=[];for(let d=0;d<6;d++){const j=nbDir(i,d);if(j>=0)o.push(j);}return NBC[i]=o;}
const EDGE_DIR=[1,0,5,4,3,2];
function corner(cx,cy,k,r){const a=(60*k-90)*Math.PI/180;return[cx+r*Math.cos(a),cy+r*Math.sin(a)];}
function foot(s,x,y){if(!inb(x,y))return null;const a=idx(x,y);if(s===1)return[a];
  if(s===2){const e=nbDir(a,0),se=nbDir(a,5);return e<0||se<0?null:[a,e,se];}
  const o=[a];for(let d=0;d<6;d++){const j=nbDir(a,d);if(j<0)return null;o.push(j);}return o;}
function hexRound(qf,rf){const sf=-qf-rf;let q=Math.round(qf),r=Math.round(rf),s=Math.round(sf);const dq=Math.abs(q-qf),dr=Math.abs(r-rf),ds=Math.abs(s-sf);
  if(dq>dr&&dq>ds)q=-r-s;else if(dr>ds)r=-q-s;return[q,r];}
function within(i,rad,fn){const x0=X(i),y0=Y(i);for(let y=y0-rad;y<=y0+rad;y++)for(let x=x0-rad-1;x<=x0+rad+1;x++){if(!inb(x,y))continue;const j=idx(x,y);if(hdist(i,j)<=rad)fn(j);}}

export { idx, X, Y, inb, SQ3, HR, HX, HY, cube, fromCube, hdist, DIRS, nbDir, NBC, nb4, EDGE_DIR, corner, foot, hexRound, within };
