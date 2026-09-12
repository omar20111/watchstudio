/* Silhouette tracing: a `shape` bake -> extrudable outlines.

   The hands and indices already exist as drawing code — five hand styles, five
   marker styles, numerals in a serif font. Rather than writing each shape a
   second time as geometry, the renderer bakes its silhouette in white and this
   traces the alpha edge back into outlines (with holes: the Mercedes ring, the
   counters in "VIII"), which ExtrudeGeometry turns into solid parts.

   Marching squares with linear interpolation, so an anti-aliased edge gives a
   sub-pixel contour rather than a staircase. Every crossed cell edge joins
   exactly two segments, so segments chain into closed loops without needing a
   direction table; saddle cells are resolved from the cell centre. */
import {Shape,Path,ExtrudeGeometry} from 'three';
import {C,PX} from '../constants.js';

const TH=.5;                                          /* alpha iso-level */

export function traceLoops(cv){
 const W=cv.width,H=cv.height;
 const data=cv.getContext('2d').getImageData(0,0,W,H).data;
 /* the silhouette usually covers a few percent of the sheet: find its box */
 let x0=W,y0=H,x1=-1,y1=-1;
 for(let y=0;y<H;y++){const row=y*W;
  for(let x=0;x<W;x++)if(data[(row+x)*4+3]>8){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}}
 if(x1<0)return[];
 /* one pixel of empty margin all round, so every loop closes */
 const bx=x0-1,by=y0-1,bw=x1-x0+3,bh=y1-y0+3;
 const A=(x,y)=>{const X=x+bx,Y=y+by;return X<0||Y<0||X>=W||Y>=H?0:data[(Y*W+X)*4+3]/255};

 const pts=new Map(),adj=new Map();
 const edge=(ax,ay,horizontal)=>(ay*(bw+1)+ax)*2+(horizontal?0:1);
 const at=(id,ax,ay,bx2,by2)=>{if(pts.has(id))return;
  const va=A(ax,ay),vb=A(bx2,by2),t=(TH-va)/((vb-va)||1e-9);
  pts.set(id,[ax+(bx2-ax)*t+bx,ay+(by2-ay)*t+by])};
 const link=(a,b)=>{(adj.get(a)||adj.set(a,[]).get(a)).push(b);(adj.get(b)||adj.set(b,[]).get(b)).push(a)};

 for(let y=0;y<bh-1;y++)for(let x=0;x<bw-1;x++){
  const tl=A(x,y)>TH,tr=A(x+1,y)>TH,br=A(x+1,y+1)>TH,bl=A(x,y+1)>TH;
  const k=(tl?8:0)|(tr?4:0)|(br?2:0)|(bl?1:0);if(k===0||k===15)continue;
  const top=edge(x,y,true),bot=edge(x,y+1,true),lef=edge(x,y,false),rig=edge(x+1,y,false);
  if(tl!==tr)at(top,x,y,x+1,y);if(bl!==br)at(bot,x,y+1,x+1,y+1);
  if(tl!==bl)at(lef,x,y,x,y+1);if(tr!==br)at(rig,x+1,y,x+1,y+1);
  if(k===5||k===10){const mid=(A(x,y)+A(x+1,y)+A(x+1,y+1)+A(x,y+1))/4>TH;
   /* joined through the centre: cut off the two corners that are the odd ones out */
   if((k===5)===mid){link(top,lef);link(rig,bot)}else{link(top,rig);link(lef,bot)}}
  else{const e=[];if(tl!==tr)e.push(top);if(tr!==br)e.push(rig);if(bl!==br)e.push(bot);if(tl!==bl)e.push(lef);
   link(e[0],e[1])}}

 const loops=[],seen=new Set();
 for(const start of adj.keys()){if(seen.has(start))continue;
  const loop=[];let prev=-1,cur=start;
  while(cur!==undefined&&!seen.has(cur)){seen.add(cur);loop.push(pts.get(cur));
   const n=adj.get(cur);const next=n[0]!==prev?n[0]:n[1];prev=cur;cur=next}
  if(loop.length>=3)loops.push(loop)}
 return loops}

const area=l=>{let s=0;for(let i=0,j=l.length-1;i<l.length;j=i++)s+=(l[j][0]-l[i][0])*(l[j][1]+l[i][1]);return s/2};
const inside=(p,l)=>{let c=false;for(let i=0,j=l.length-1;i<l.length;j=i++){const[xi,yi]=l[i],[xj,yj]=l[j];
 if((yi>p[1])!==(yj>p[1])&&p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi)c=!c}return c};

/* Ramer-Douglas-Peucker on a closed loop */
function simplify(l,eps){if(l.length<8)return l;
 const keep=new Uint8Array(l.length);keep[0]=keep[l.length-1]=1;
 const stack=[[0,l.length-1]];
 while(stack.length){const[a,b]=stack.pop();let dm=0,im=-1;
  const[ax,ay]=l[a],[bx,by]=l[b],dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy)||1;
  for(let i=a+1;i<b;i++){const d=Math.abs(dy*l[i][0]-dx*l[i][1]+bx*ay-by*ax)/len;if(d>dm){dm=d;im=i}}
  if(dm>eps){keep[im]=1;stack.push([a,im],[im,b])}}
 return l.filter((_,i)=>keep[i])}

/* loops (canvas px) -> three Shapes (mm, +y = 12 o'clock), holes attached to
   the loop that contains them */
export function loopsToShapes(loops,{eps=.35,minArea=3}={}){
 const L=loops.map(l=>simplify(l,eps)).filter(l=>Math.abs(area(l))>=minArea);
 const depth=L.map((l,i)=>L.reduce((n,o,j)=>n+(j!==i&&Math.abs(area(o))>Math.abs(area(l))&&inside(l[0],o)?1:0),0));
 const mm=([x,y])=>[(x-C)/PX,-(y-C)/PX];
 const shapes=[];
 L.forEach((l,i)=>{if(depth[i]%2)return;
  const s=new Shape();l.map(mm).forEach(([x,y],k)=>k?s.lineTo(x,y):s.moveTo(x,y));
  L.forEach((h,j)=>{if(depth[j]===depth[i]+1&&inside(h[0],l)){
   const p=new Path();h.map(mm).forEach(([x,y],k)=>k?p.lineTo(x,y):p.moveTo(x,y));s.holes.push(p)}});
  shapes.push(s)});
 return shapes}

const traced=new WeakMap();
/* Extruded solid from a silhouette bake, lying face-up with its underside at
   y=0. Traces once per bake canvas; the bevel is capped so it can never eat a
   thin feature like a second hand. */
export function extrudeSilhouette(cv,{depth=.25,bevel=.04}={}){
 let shapes=traced.get(cv);if(!shapes){shapes=loopsToShapes(traceLoops(cv));traced.set(cv,shapes)}
 if(!shapes.length)return null;
 const g=new ExtrudeGeometry(shapes,{depth:Math.max(.01,depth-bevel*2),bevelEnabled:bevel>0,
  bevelThickness:bevel,bevelSize:bevel,bevelOffset:-bevel,bevelSegments:2,curveSegments:4});
 g.translate(0,0,bevel);g.rotateX(-Math.PI/2);g.computeVertexNormals();
 return g}
