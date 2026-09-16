/* Surface wear and texture: what makes a render stop looking factory-perfect.

   A real case is never a flawless mirror. Polish carries faint hairline
   scratches and swirl marks, and a haze where it has been handled; a brushed
   surface is a field of fine streaks rather than a uniform satin; leather has
   a grain, rubber a matte skin, webbing a weave. None of it is geometry — all
   of it is roughness and normal detail, which is what a reflection reads.

   - wearMap: tileable, in the case's own millimetres. R fine micro-scratches,
     B the sparser deeper ones, G handling haze. Applied by triplanar projection
     in object space, so it needs no UVs: a lathe, an extrusion and a buckle all
     wear alike, and a scratch stays on its part as the part moves.
   - grainMap: brushing streaks, laid along the same UV tangent the material's
     anisotropy already follows, so the streaks and the stretched highlight agree.
   - strap normal maps: leather pebble grain, rubber micro-texture, NATO weave.

   Wear levels are a case setting (new, light, worn). Metal under the crystal —
   hands, indices, the dial — is never touched. All textures are generated from
   a fixed seed: the same design renders the same scratches every time. The
   scratches and grain live in the shader, so a GLB export carries the strap
   grain (a normal map) but not the wear. */
import {DataTexture,RGBAFormat,RepeatWrapping,LinearFilter,LinearMipmapLinearFilter,NoColorSpace} from 'three';
import {addShaderHook,finishOf} from './materials.js';

export const WEAR_LEVELS=['new','light','worn'];
const WEAR_TILE_MM=14;
/* brushing streaks: the grain map spans this many mm along and across the grain */
const GRAIN_MM=[8,2];

/* a small fast deterministic generator (mulberry32) */
export const rng=seed=>()=>{seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);
 t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};

/* tileable value noise on an nx by ny lattice, sampled in lattice units */
export function lattice(nx,ny,r){const a=new Float32Array(nx*ny);for(let i=0;i<a.length;i++)a[i]=r();
 const g=(i,j)=>a[(((j%ny)+ny)%ny)*nx+(((i%nx)+nx)%nx)];
 return(x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
  return(g(xi,yi)*(1-sx)+g(xi+1,yi)*sx)*(1-sy)+(g(xi,yi+1)*(1-sx)+g(xi+1,yi+1)*sx)*sy}}

export function dataTexture(w,h,rgba,{aniso=8}={}){
 const t=new DataTexture(rgba,w,h,RGBAFormat);t.colorSpace=NoColorSpace;
 t.wrapS=t.wrapT=RepeatWrapping;t.magFilter=LinearFilter;t.minFilter=LinearMipmapLinearFilter;
 t.generateMipmaps=true;t.anisotropy=aniso;t.needsUpdate=true;return t}

const memo=new Map();
const once=(k,f)=>{if(!memo.has(k))memo.set(k,f());return memo.get(k)};

/* Scratches are drawn as anti-aliased hairlines that fade in and out along their
   length. Most follow a few dominant directions, the way a cloth or a desk
   leaves them; the rest fall anywhere. Everything wraps, so the tile repeats
   without a seam. */
export const wearMap=()=>once('wear',()=>{const W=1024,r=rng(0x5eed),px=W/WEAR_TILE_MM;
 const fine=new Float32Array(W*W),deep=new Float32Array(W*W);
 const plot=(buf,x,y,v)=>{const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi;
  for(const[dx,dy,k]of[[0,0,(1-fx)*(1-fy)],[1,0,fx*(1-fy)],[0,1,(1-fx)*fy],[1,1,fx*fy]]){
   const i=((((yi+dy)%W)+W)%W)*W+((((xi+dx)%W)+W)%W);buf[i]=Math.max(buf[i],v*k)}};
 const wipes=[0,1,2,3].map(()=>r()*Math.PI);
 const scratch=(buf,lenMm,strength)=>{let x=r()*W,y=r()*W;
  let a=r()<.6?wipes[Math.floor(r()*wipes.length)]+(r()-.5)*.4:r()*Math.PI*2;
  const bend=(r()-.5)*.004,steps=Math.max(2,Math.round(lenMm*px*2)),s=strength*(.3+.7*r());
  for(let i=0;i<=steps;i++){const t=i/steps;plot(buf,x,y,s*Math.sqrt(Math.sin(Math.PI*t)));
   x+=Math.cos(a)*.5;y+=Math.sin(a)*.5;a+=bend}};
 for(let i=0;i<2200;i++)scratch(fine,.15+2.4*r()**3,1);
 for(let i=0;i<70;i++)scratch(deep,1.5+9*r()**2,1);
 const n1=lattice(7,7,r),n2=lattice(17,17,r);
 const a=new Uint8Array(W*W*4);
 for(let y=0;y<W;y++)for(let x=0;x<W;x++){const i=y*W+x,o=i*4;
  const h=.65*n1(x/W*7,y/W*7)+.35*n2(x/W*17,y/W*17);
  const haze=Math.min(1,Math.max(0,(h-.5)/.3));
  a[o]=Math.round(Math.min(1,fine[i])*255);a[o+1]=Math.round(haze*haze*255);a[o+2]=Math.round(Math.min(1,deep[i])*255);a[o+3]=255}
 return dataTexture(W,W,a)});

/* brushing: long thin streaks in x, at three scales, from fine lines to broad
   bands where the belt pressed harder */
export const grainMap=()=>once('grain',()=>{const W=512,r=rng(0xb205),a=new Uint8Array(W*W*4);
 const oct=[[lattice(10,256,r),10,256,.5],[lattice(5,64,r),5,64,.3],[lattice(2,12,r),2,12,.2]];
 for(let y=0;y<W;y++)for(let x=0;x<W;x++){let v=0;
  for(const[n,nx,ny,k]of oct)v+=k*n(x/W*nx,y/W*ny);
  const o=(y*W+x)*4;a[o]=a[o+1]=a[o+2]=Math.round(v*255);a[o+3]=255}
 return dataTexture(W,W,a)});

/* a tangent-space normal map from a tileable height function h(x, y) in pixels */
export function normalsFromHeight(W,h,strength){const H=new Float32Array(W*W);
 for(let y=0;y<W;y++)for(let x=0;x<W;x++)H[y*W+x]=h(x,y);
 const at=(x,y)=>H[(((y%W)+W)%W)*W+(((x%W)+W)%W)];
 const a=new Uint8Array(W*W*4);
 for(let y=0;y<W;y++)for(let x=0;x<W;x++){
  const nx=-(at(x+1,y)-at(x-1,y))*strength,ny=-(at(x,y+1)-at(x,y-1))*strength,l=Math.hypot(nx,ny,1),o=(y*W+x)*4;
  a[o]=Math.round((nx/l*.5+.5)*255);a[o+1]=Math.round((ny/l*.5+.5)*255);a[o+2]=Math.round((1/l*.5+.5)*255);a[o+3]=255}
 return dataTexture(W,W,a)}

/* The strap's surface, as a normal map and the millimetres one tile covers.
   leather  pebbled grain: rounded cells with creases between and a few pores
   rubber   a fine matte skin
   nato     the weave: ridges across the webbing, offset column by column */
export const STRAP_GRAIN_MM={leather:6,rubber:4,nato:3.9,mesh:2.4};
export const strapGrainMap=variant=>once('strap:'+variant,()=>{const W=512,r=rng(variant.length*7919+13);
 /* Milanese: rows of tiny interlocked loops, a pillow grid turned 45 degrees,
    0.4 mm apart: a whole number of loops a tile each way keeps both diagonals
    whole across the edge. Finer than that, the weave was under a pixel at an
    ordinary zoom and the band rendered as a plain sheet of metal. */
 if(variant==='mesh'){const k=6/W;
  return normalsFromHeight(W,(x,y)=>{const u=(x+y)*k,v=(x-y)*k,fu=u-Math.floor(u),fv=v-Math.floor(v);
   return Math.sin(fu*Math.PI)*Math.sin(fv*Math.PI)},8)}
 if(variant==='rubber'){const n=lattice(96,96,r),m=lattice(24,24,r);
  return normalsFromHeight(W,(x,y)=>.7*n(x/W*96,y/W*96)+.3*m(x/W*24,y/W*24),1.4)}
 if(variant==='nato'){const rows=10,cols=10,n=lattice(64,64,r);
  return normalsFromHeight(W,(x,y)=>{const col=Math.floor(x/W*cols),p=W/rows;
   const s=Math.sin(Math.PI*((y+(col%2)*p/2)/p));return s*s*.8+.2*n(x/W*64,y/W*64)},2.2)}
 /* leather: jittered cells, one point each, distance to the nearest two. The
    lookup is warped by noise so the pebbles come out rounded and irregular
    rather than as the straight-edged polygons of a plain cell pattern. */
 const C=16,cell=W/C,pts=[];for(let j=0;j<C;j++)for(let i=0;i<C;i++)pts.push([(i+.15+.7*r())*cell,(j+.15+.7*r())*cell]);
 const pore=lattice(128,128,r),wx=lattice(24,24,r),wy=lattice(24,24,r),fine=lattice(64,64,r);
 return normalsFromHeight(W,(x0,y0)=>{
  const x=x0+cell*.45*(wx(x0/W*24,y0/W*24)-.5),y=y0+cell*.45*(wy(x0/W*24,y0/W*24)-.5);
  const ci=Math.floor(x/cell),cj=Math.floor(y/cell);let f1=1e9,f2=1e9;
  for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const ii=ci+di,jj=cj+dj;
   const p=pts[((jj%C+C)%C)*C+((ii%C+C)%C)],px=p[0]+(ii-((ii%C+C)%C))*cell,py=p[1]+(jj-((jj%C+C)%C))*cell;
   const dd=Math.hypot(x-px,y-py);if(dd<f1){f2=f1;f1=dd}else if(dd<f2)f2=dd}
  const e=Math.min(1,(f2-f1)/(cell*.4)),crease=e*e*(3-2*e);
  const p=pore(x0/W*128,y0/W*128);
  return .75*crease+.25*fine(x0/W*64,y0/W*64)-(p>.84?(p-.84)*3:0)},1.3)});

/* how much each wear level scuffs each finish, in roughness: fine and deep
   scratches, and handling haze. A matte or blasted surface is burnished where
   it is rubbed, so its scratches read shinier rather than duller. */
const WEAR={
 new:{polished:[0,0,.012],brushed:[0,0,.01],matte:[0,0,0]},
 light:{polished:[.1,.05,.035],brushed:[.05,.03,.02],matte:[-.08,-.05,0]},
 worn:{polished:[.22,.38,.08],brushed:[.12,.26,.05],matte:[-.16,-.3,.03]}};

/* mm per unit of u and of v across a geometry: the median of each triangle's
   UV Jacobian, robust to the odd degenerate or seam triangle */
const uvMmCache=new WeakMap();
export function uvMillimetres(geo){if(uvMmCache.has(geo))return uvMmCache.get(geo);
 const p=geo.attributes.position,uv=geo.attributes.uv;let out=[1,1];
 if(p&&uv){const ix=geo.index,n=(ix?ix.count:p.count)/3,step=Math.max(1,Math.floor(n/500)),us=[],vs=[];
  const at=i=>ix?ix.getX(i):i;
  for(let t=0;t<n;t+=step){const a=at(t*3),b=at(t*3+1),c=at(t*3+2);
   const e1=[p.getX(b)-p.getX(a),p.getY(b)-p.getY(a),p.getZ(b)-p.getZ(a)],e2=[p.getX(c)-p.getX(a),p.getY(c)-p.getY(a),p.getZ(c)-p.getZ(a)];
   const d1=[uv.getX(b)-uv.getX(a),uv.getY(b)-uv.getY(a)],d2=[uv.getX(c)-uv.getX(a),uv.getY(c)-uv.getY(a)];
   const det=d1[0]*d2[1]-d2[0]*d1[1];if(Math.abs(det)<1e-9)continue;
   us.push(Math.hypot(...e1.map((e,k)=>(e*d2[1]-e2[k]*d1[1])/det)));
   vs.push(Math.hypot(...e2.map((e,k)=>(e*d1[0]-e1[k]*d2[0])/det)))}
  const med=a=>{if(!a.length)return 1;a.sort((x,y)=>x-y);return a[a.length>>1]};
  out=[med(us),med(vs)]}
 uvMmCache.set(geo,out);return out}

const VERT_HEAD='varying vec3 vWearPos;\nvarying vec3 vWearNrm;\nvarying vec2 vWearUv;\n';
const FRAG_HEAD=`uniform sampler2D uWearMap;uniform sampler2D uGrainMap;
uniform float uWearTile;uniform vec3 uWear;uniform float uGrain;uniform vec2 uGrainMm;uniform float uGrainRot;uniform vec2 uGrainSize;
varying vec3 vWearPos;varying vec3 vWearNrm;varying vec2 vWearUv;
`;
const FRAG_BODY=`
{
 vec3 wb=pow(abs(normalize(vWearNrm)),vec3(4.0));wb/=max(1e-4,wb.x+wb.y+wb.z);
 vec3 wp=vWearPos/uWearTile;
 vec4 w=texture2D(uWearMap,wp.zy)*wb.x+texture2D(uWearMap,wp.xz+vec2(.37,.11))*wb.y+texture2D(uWearMap,wp.xy+vec2(.71,.53))*wb.z;
 float dr=uWear.x*w.r+uWear.y*w.b+uWear.z*w.g;
 vec2 mm=vWearUv*uGrainMm;float cr=cos(uGrainRot),sr=sin(uGrainRot);
 dr+=uGrain*(texture2D(uGrainMap,vec2(mm.x*cr+mm.y*sr,-mm.x*sr+mm.y*cr)/uGrainSize).r-.5);
 roughnessFactor=clamp(roughnessFactor+dr,.04,1.0);
}
`;

/* Wear a metal mesh's material. `level` is the case's wear setting. Returns
   whether the material was changed. */
export function applyWear(mesh,level){const mat=mesh.material;
 if(!(mat&&mat.isMeshPhysicalMaterial&&mat.metalness===1&&mat.transmission===0))return false;
 const finish=finishOf.get(mat)||(mat.anisotropy>0?'brushed':mat.roughness>=.5?'matte':'polished');
 const k=(WEAR[level]||WEAR.light)[finish==='none'?'polished':finish]||WEAR.light.polished;
 const brushed=finish==='brushed';
 const u={uWearMap:{value:wearMap()},uGrainMap:{value:grainMap()},uWearTile:{value:WEAR_TILE_MM},
  uWear:{value:k},uGrain:{value:brushed?.14:0},uGrainMm:{value:brushed?uvMillimetres(mesh.geometry):[1,1]},
  uGrainRot:{value:mat.anisotropyRotation||0},uGrainSize:{value:GRAIN_MM}};
 addShaderHook(mat,'ws-wear',sh=>{Object.assign(sh.uniforms,u);
  sh.vertexShader=VERT_HEAD+sh.vertexShader.replace('#include <begin_vertex>',
   '#include <begin_vertex>\n\tvWearPos=transformed;vWearNrm=objectNormal;vWearUv=uv;');
  sh.fragmentShader=FRAG_HEAD+sh.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>'+FRAG_BODY)});
 wornBy.set(mat,{level,finish:finish==='none'?'polished':finish});
 return true}

/* What a worn material averages to. A path tracer cannot run the wear shader,
   and baking a scratch map per part would multiply its texture memory; a photo
   instead gets the wear's mean roughness, so a worn case still photographs
   duller than a new one. Brushed metal adds a little for the streaks the path
   tracer cannot draw either. 0 for a material that does not wear. */
const wornBy=new WeakMap();
let means=null;
export function wearRoughness(mat){const w=wornBy.get(mat);if(!w)return 0;
 if(!means){const{data}=wearMap().image,n=data.length/4;let r=0,g=0,b=0;
  for(let i=0;i<data.length;i+=4){r+=data[i];g+=data[i+1];b+=data[i+2]}
  means=[r/n/255,g/n/255,b/n/255]}
 const k=(WEAR[w.level]||WEAR.light)[w.finish]||WEAR.light.polished;
 return Math.max(0,k[0]*means[0]+k[2]*means[1]+k[1]*means[2])+(w.finish==='brushed'?.04:0)}
