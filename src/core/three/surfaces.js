/* What the watch lies on in the product render: studio paper, slate, walnut,
   marble or linen, or nothing but its shadow.

   Each surface is a generated seamless texture — colour, a normal map for its
   grain — tiled in millimetres, with the finish that makes it read: polished
   marble reflects the watch, varnished walnut catches a soft sheen, linen and
   paper stay matte. The disc fades out toward its rim, so in the live view it
   melts into the page's backdrop and in a photo into the path tracer's.
   Built from fixed seeds and cached, so a surface looks the same every time. */
import {Mesh,CircleGeometry,MeshPhysicalMaterial,DataTexture,RGBAFormat,SRGBColorSpace,LinearFilter,ClampToEdgeWrapping,Vector2} from 'three';
import {rng,lattice,dataTexture,normalsFromHeight} from './wear.js';

export const SURFACES=[['none','None'],['studio','Studio'],['slate','Slate'],['walnut','Walnut'],['marble','Marble'],['linen','Linen']];
export const SURFACE_IDS=SURFACES.map(s=>s[0]);

const W=1024;
const mix=(a,b,t)=>a+(b-a)*t;
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
/* colour from two hex stops by a 0..1 value, as sRGB bytes */
const ramp=(lo,hi,t,out,o)=>{const A=hex(lo),B=hex(hi);for(let k=0;k<3;k++)out[o+k]=Math.round(mix(A[k],B[k],Math.min(1,Math.max(0,t))))};

const colourTexture=(fn)=>{const a=new Uint8Array(W*W*4);
 for(let y=0;y<W;y++)for(let x=0;x<W;x++){const o=(y*W+x)*4;fn(x,y,a,o);a[o+3]=255}
 const t=dataTexture(W,W,a);t.colorSpace=SRGBColorSpace;return t};

/* id -> {tile mm, colour(x,y,out,o), height(x,y), normal strength, material} */
const DEFS={
 /* seamless photographer's paper: nearly flat colour, only a faint tooth */
 studio:r=>{const n=lattice(256,256,r),m=lattice(6,6,r);
  return{tile:160,colour:(x,y,a,o)=>ramp('#50535a','#5a5d64',.75*m(x/W*6,y/W*6)+.25*n(x/W*256,y/W*256),a,o),
   height:(x,y)=>n(x/W*256,y/W*256),normal:.25,mat:{roughness:.93}}},
 slate:r=>{const n=lattice(256,256,r),m=lattice(12,48,r),c=lattice(6,6,r);
  return{tile:140,colour:(x,y,a,o)=>{const v=.45*n(x/W*256,y/W*256)+.35*m(x/W*12,y/W*48)+.2*c(x/W*6,y/W*6);ramp('#24272c','#3b3f46',v,a,o)},
   height:(x,y)=>.6*n(x/W*256,y/W*256)+.4*m(x/W*12,y/W*48),normal:1.2,mat:{roughness:.72}}},
 /* A quarter-sawn board: fine, nearly straight grain lines along x, a gentle
    wandering figure, and open pores. Every periodic term has a whole number of
    cycles per tile, which is what keeps it seamless. */
 walnut:r=>{const warp=lattice(3,8,r),streak=lattice(24,384,r),pore=lattice(48,768,r),fig=lattice(3,5,r);
  /* lattice(nx, ny): few cells along x and many across y draws streaks along x */
  const grain=(x,y)=>{const w=warp(x/W*3,y/W*8);return .5+.5*Math.sin((y/W*40+w*3)*Math.PI*2)};
  return{tile:200,colour:(x,y,a,o)=>{const p=pore(x/W*48,y/W*768);
    const v=.3*grain(x,y)+.25*streak(x/W*24,y/W*384)+.45*fig(x/W*3,y/W*5)-(p>.78?.1:0);
    ramp('#2e1b10','#65412a',v,a,o)},
   height:(x,y)=>.7*pore(x/W*48,y/W*768)+.3*streak(x/W*24,y/W*384),normal:.6,mat:{roughness:.45,clearcoat:.3,clearcoatRoughness:.25}}},
 /* Honed white marble: a cloudy ground, one system of soft veins and a second
    of faint hairline ones, each wandering on its own warp. */
 marble:r=>{const w1=lattice(5,5,r),w2=lattice(11,11,r),w4=lattice(23,23,r),w3=lattice(9,9,r),
   cloud=lattice(7,7,r),gate=lattice(4,4,r),gate2=lattice(6,6,r),fine=lattice(256,256,r);
  /* a wave across the tile in whole cycles (kx, ky integers keep it seamless),
     warped by several octaves; d is 1 on a vein's line and falls away from it */
  const line=(x,y,kx,ky,warp)=>{const t=(kx*x+ky*y)/W+warp;return 1-Math.abs(Math.sin(t*Math.PI))};
  const fbm=(x,y)=>.5*w1(x/W*5,y/W*5)+.3*w2(x/W*11,y/W*11)+.2*w4(x/W*23,y/W*23);
  const sm=(e0,e1,v)=>{const t=Math.min(1,Math.max(0,(v-e0)/(e1-e0)));return t*t*(3-2*t)};
  return{tile:260,colour:(x,y,a,o)=>{
    /* a vein is a dark core in a soft halo, and fades out along its length */
    const d=line(x,y,2,1,2.4*fbm(x,y)),mask=sm(.3,.7,gate(x/W*4,y/W*4));
    const h=line(x,y,-3,5,1.6*w3(x/W*9,y/W*9)),mask2=sm(.45,.8,gate2(x/W*6,y/W*6));
    const v=.84+.1*cloud(x/W*7,y/W*7)+.03*fine(x/W*256,y/W*256)
     -mask*(.42*Math.pow(d,18)+.13*Math.pow(d,3))-.2*mask2*Math.pow(h,30);
    ramp('#8e9095','#f0efeb',v,a,o)},
   height:(x,y)=>fine(x/W*256,y/W*256)*.2,normal:.12,mat:{roughness:.14,clearcoat:.6,clearcoatRoughness:.05}}},
 linen:r=>{const n=lattice(64,64,r),slub=lattice(8,128,r);
  /* a plain weave: 96 threads each way, over and under */
  const thread=(x,y)=>{const u=x/W*96,v=y/W*96,cx=Math.floor(u),cy=Math.floor(v),over=(cx+cy)%2;
   const su=Math.sin((u-cx)*Math.PI),sv=Math.sin((v-cy)*Math.PI);return over?su*.8+.2*sv:sv*.8+.2*su};
  return{tile:40,colour:(x,y,a,o)=>{const v=.55*thread(x,y)+.25*n(x/W*64,y/W*64)+.2*slub(x/W*8,y/W*128);ramp('#b4ab9c','#d8d1c4',v,a,o)},
   height:(x,y)=>thread(x,y),normal:1.8,mat:{roughness:.95,sheen:.4,sheenRoughness:.8}}}};

const cache=new Map();
function surfaceMaterial(id){
 if(cache.has(id))return cache.get(id);
 const def=DEFS[id](rng(id.charCodeAt(0)*131+id.length));
 const map=colourTexture(def.colour),normalMap=normalsFromHeight(W,def.height,def.normal);
 /* tiling: the disc's UVs span its diameter, so repeat = diameter / tile */
 for(const t of[map,normalMap])t.repeat.set(DISC_MM/def.tile,DISC_MM/def.tile);
 const out={map,normalMap,mat:def.mat};cache.set(id,out);return out}

/* the rim fade, as an alpha map over the disc's own UVs (not tiled) */
let fade=null;
function fadeMap(){if(fade)return fade;const S=256,a=new Uint8Array(S*S*4);
 for(let y=0;y<S;y++)for(let x=0;x<S;x++){const r=Math.hypot(x/(S-1)-.5,y/(S-1)-.5)*2,o=(y*S+x)*4;
  const t=Math.min(1,Math.max(0,(r-.32)/(.95-.32))),v=1-t*t*(3-2*t);a[o]=a[o+1]=a[o+2]=Math.round(v*255);a[o+3]=255}
 fade=new DataTexture(a,S,S,RGBAFormat);fade.magFilter=fade.minFilter=LinearFilter;fade.wrapS=fade.wrapT=ClampToEdgeWrapping;fade.needsUpdate=true;return fade}

const DISC_MM=720;
/* The surface as a mesh lying at height y (the watch's table). null for 'none'. */
export function surfaceMesh(id,y){
 if(!DEFS[id])return null;
 const s=surfaceMaterial(id);
 const mat=new MeshPhysicalMaterial({map:s.map,normalMap:s.normalMap,normalScale:new Vector2(.6,.6),alphaMap:fadeMap(),
  transparent:true,depthWrite:true,metalness:0,...s.mat});
 const m=new Mesh(new CircleGeometry(DISC_MM/2,96),mat);
 m.rotation.x=-Math.PI/2;m.position.y=y;m.receiveShadow=true;m.name='surface:'+id;
 m.userData.surface=id;return m}
