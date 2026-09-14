/* Relief: a ground solid from a coverage field.

   Ported from WatchStudio (core/three/relief.js + tracer.js), where it grinds
   the hands and applied indices. An index is not a slab with a flat top: a
   bevelled baton has chamfered flanks and a flat top carrying its lume, a wedge
   is two facets meeting at a ridge, a dot is domed. All of those are a height
   that follows the distance in from the part's edge, so the top surface is
   built from a distance field of the outline, and every outline — preset,
   hand-drawn or a numeral's glyph — gets its form without being written twice.

   Profiles, with d the distance in from the edge:
     chamfer  rises in a straight line over `bevel` of the way to the middle, then flat
     roof     rises straight to the middle: planar facets and a ridge
     dome     a quarter round over `bevel` of the way, then flat
   A lume channel is the region more than `lumeMarginMm` in from the edge: the
   metal is cut down to `pocket` there and a separate solid of compound, domed
   up to `lumeTop`, sits in it.

   Output is millimetres, face up (+y), underside at y = 0; x and z are the
   field's x and y. Pure (three's BufferGeometry only), so it runs in node. */
import {BufferGeometry,Float32BufferAttribute} from 'three';

const TH=.5,INF=1e20;

/* ------------------------------------------------------------ tracing */

/* Marching squares with linear interpolation, so an anti-aliased edge gives a
   sub-sample contour rather than a staircase. Every crossed cell edge joins
   exactly two segments, so segments chain into closed loops; saddle cells are
   resolved from the cell centre. Loops are in sample coordinates. */
export function traceField({alpha,W,H}){
 const A=(x,y)=>x<0||y<0||x>=W||y>=H?0:alpha[y*W+x];
 const pts=new Map(),adj=new Map(),SW=W+2;
 const edge=(ax,ay,horizontal)=>((ay+1)*SW+(ax+1))*2+(horizontal?0:1);
 const at=(id,ax,ay,bx,by)=>{if(pts.has(id))return;
  const va=A(ax,ay),vb=A(bx,by),t=(TH-va)/((vb-va)||1e-9);
  pts.set(id,[ax+(bx-ax)*t,ay+(by-ay)*t])};
 const link=(a,b)=>{(adj.get(a)||adj.set(a,[]).get(a)).push(b);(adj.get(b)||adj.set(b,[]).get(b)).push(a)};
 for(let y=-1;y<H;y++)for(let x=-1;x<W;x++){
  const tl=A(x,y)>TH,tr=A(x+1,y)>TH,br=A(x+1,y+1)>TH,bl=A(x,y+1)>TH;
  const k=(tl?8:0)|(tr?4:0)|(br?2:0)|(bl?1:0);if(k===0||k===15)continue;
  const top=edge(x,y,true),bot=edge(x,y+1,true),lef=edge(x,y,false),rig=edge(x+1,y,false);
  if(tl!==tr)at(top,x,y,x+1,y);if(bl!==br)at(bot,x,y+1,x+1,y+1);
  if(tl!==bl)at(lef,x,y,x,y+1);if(tr!==br)at(rig,x+1,y,x+1,y+1);
  if(k===5||k===10){const mid=(A(x,y)+A(x+1,y)+A(x+1,y+1)+A(x,y+1))/4>TH;
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

/* Ramer-Douglas-Peucker on a closed loop */
export function simplifyLoop(l,eps){if(l.length<8)return l;
 const keep=new Uint8Array(l.length);keep[0]=keep[l.length-1]=1;
 const stack=[[0,l.length-1]];
 while(stack.length){const[a,b]=stack.pop();let dm=0,im=-1;
  const[ax,ay]=l[a],[bx,by]=l[b],dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy)||1;
  for(let i=a+1;i<b;i++){const d=Math.abs(dy*l[i][0]-dx*l[i][1]+bx*ay-by*ax)/len;if(d>dm){dm=d;im=i}}
  if(dm>eps){keep[im]=1;stack.push([a,im],[im,b])}}
 return l.filter((_,i)=>keep[i])}

/* the inked samples of a field in mm (every other one), for placing numerals by their ink */
export function inkPoints({alpha,W,H,ppmm,ox,oy}){const out=[];
 for(let j=0;j<H;j+=2)for(let i=0;i<W;i+=2)if(alpha[j*W+i]>TH)out.push([(i+ox)/ppmm,(j+oy)/ppmm]);
 return out}

/* ------------------------------------------------------------ the solid */

export function buildRelief(field,opts={}){
 const out=build(field,opts);
 if(!out)return null;
 if(opts.pocket!=null&&opts.lumeMarginMm!=null&&out.lumeField){
  out.lume=build(out.lumeField,{profile:'dome',height:opts.lumeTop??opts.pocket+.05,edge:opts.pocket+.004,bevel:.5,bottom:opts.bottom})?.geometry||null}
 delete out.lumeField;
 return out}

function build(field,{height=.3,edge=.08,profile='chamfer',bevel=.35,pocket=null,lumeMarginMm=null,bottom=false}={}){
 const{alpha:A,W,H,ppmm,ox,oy}=field;
 const inside=new Uint8Array(W*H);let any=false;
 for(let k=0;k<W*H;k++)if(A[k]>TH){inside[k]=1;any=true}
 if(!any)return null;

 /* Distance to the contour itself — the sub-sample outline marching squares
    traces through the anti-aliased edge — simplified to 0.4 samples so a
    straight edge is one exact line and a facet ground against it comes out
    truly flat. A pixel-centre distance transform ripples along any slanted
    edge, and on a mirror polish those ripples read as ribs. */
 const S=6,segs=[];
 for(const loop of traceField(field)){const l=simplifyLoop(loop,.4);
  for(let n=0;n<l.length;n++){const p=l[n],q=l[(n+1)%l.length];
   const pieces=Math.max(1,Math.ceil(Math.hypot(q[0]-p[0],q[1]-p[1])/S));
   for(let m=0;m<pieces;m++){const t0=m/pieces,t1=(m+1)/pieces;
    segs.push([[p[0]+(q[0]-p[0])*t0,p[1]+(q[1]-p[1])*t0],[p[0]+(q[0]-p[0])*t1,p[1]+(q[1]-p[1])*t1]])}}}
 const BW=Math.ceil(W/S)+1,BH=Math.ceil(H/S)+1,bucket=new Array(BW*BH);
 segs.forEach((s,n)=>{const bi=Math.max(0,Math.min(BW-1,Math.floor((s[0][0]+s[1][0])/2/S))),bj=Math.max(0,Math.min(BH-1,Math.floor((s[0][1]+s[1][1])/2/S)));
  (bucket[bj*BW+bi]||(bucket[bj*BW+bi]=[])).push(n)});
 const segDist=(px,py,s)=>{const[ax,ay]=s[0],[bx,by]=s[1],dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy;
  let t=l2?((px-ax)*dx+(py-ay)*dy)/l2:0;t=t<0?0:t>1?1:t;return Math.hypot(px-ax-t*dx,py-ay-t*dy)};
 /* distances are also needed just outside the outline (see the smoothing below) */
 const near=new Uint8Array(W*H);
 for(let j=0;j<H;j++)for(let i=0;i<W;i++){if(!inside[j*W+i])continue;
  for(let jj=Math.max(0,j-4);jj<=Math.min(H-1,j+4);jj++)for(let ii=Math.max(0,i-4);ii<=Math.min(W-1,i+4);ii++)near[jj*W+ii]=1}
 const dist=new Float32Array(W*H);let maxD=0;
 for(let j=0;j<H;j++)for(let i=0;i<W;i++){const k=j*W+i;if(!near[k])continue;
  const bi=Math.floor(i/S),bj=Math.floor(j/S);let best=INF;
  for(let r=0;r<Math.max(BW,BH);r++){
   for(let jj=bj-r;jj<=bj+r;jj++)for(let ii=bi-r;ii<=bi+r;ii++){
    if(Math.max(Math.abs(ii-bi),Math.abs(jj-bj))!==r||ii<0||jj<0||ii>=BW||jj>=BH)continue;
    const list=bucket[jj*BW+ii];if(!list)continue;
    for(const n of list){const dd=segDist(i,j,segs[n]);if(dd<best)best=dd}}
   if(best<=(r-1)*S)break}
  dist[k]=best;if(inside[k]&&best>maxD)maxD=best}
 maxD=Math.max(1,maxD);

 const ease=profile==='dome'?t=>Math.sqrt(1-(1-t)*(1-t)):t=>t;
 const span=profile==='roof'?maxD:Math.max(1,maxD*bevel);

 /* The lume channel starts where the flank has reached the top, plus a flat
    polished rim of `lumeMarginMm`: cut any closer to the edge and the channel
    would eat into the bevel and the index would never reach its height. A roof
    has no flat top, so its channel is cut down the ridge itself. */
 let lumeField=null;
 if(pocket!=null&&lumeMarginMm!=null){const m=lumeMarginMm*ppmm+(profile==='roof'?0:span),la=new Float32Array(W*H);let some=false;
  for(let k=0;k<W*H;k++)if(inside[k]){la[k]=Math.min(1,Math.max(0,dist[k]-m+.5));if(la[k]>TH)some=true}
  if(some)lumeField={...field,alpha:la}}
 /* Just outside, the flank is continued downward as its mirror image about the
    edge. The smoothing below would otherwise average the first samples inside
    with a flat `edge` outside — by an amount that depends on where a slanted
    outline happens to cross the sample grid, which on a polished facet shows
    as a row of dark notches along the edge. Mirrored, a straight flank blurs
    into itself and stays straight. */
 const hAt=new Float32Array(W*H);
 for(let k=0;k<W*H;k++){
  if(!inside[k]){hAt[k]=near[k]?edge-(height-edge)*ease(Math.min(1,dist[k]/span)):edge;continue}
  let h=edge+(height-edge)*ease(Math.min(1,dist[k]/span));
  if(lumeField&&lumeField.alpha[k]>TH)h=Math.min(h,pocket);
  hAt[k]=h}
 /* one pass of a 5-tap binomial (sigma about one sample) rounds the pocket rim
    and the ridge just enough */
 {const tmp=new Float32Array(W*H),K=[1,4,6,4,1];
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){let s=0,w=0;
   for(let q=-2;q<=2;q++){const ii=i+q;if(ii<0||ii>=W)continue;s+=hAt[j*W+ii]*K[q+2];w+=K[q+2]}tmp[j*W+i]=s/w}
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){let s=0,w=0;
   for(let q=-2;q<=2;q++){const jj=j+q;if(jj<0||jj>=H)continue;s+=tmp[jj*W+i]*K[q+2];w+=K[q+2]}
   /* nothing inside sinks below the rim, or the rim grows a hairline moat */
   const k=j*W+i;hAt[k]=inside[k]?Math.max(edge,s/w):s/w}}

 const pos=[],nrm=[],uv=[],idx=[];
 const mmX=i=>(i+ox)/ppmm,mmZ=j=>(j+oy)/ppmm,step=1/ppmm;
 const push=(x,y,z,nx,ny,nz)=>{pos.push(x,y,z);nrm.push(nx,ny,nz);uv.push(x,z);return pos.length/3-1};
 const hN=(i,j)=>{const g=(ii,jj)=>ii<0||jj<0||ii>=W||jj>=H?edge:hAt[jj*W+ii];
  const nx=-(g(i+1,j)-g(i-1,j))/(2*step),nz=-(g(i,j+1)-g(i,j-1))/(2*step),l=Math.hypot(nx,1,nz);return[nx/l,1/l,nz/l]};
 const gridV=new Int32Array(W*H).fill(-1);
 const vGrid=(i,j)=>{const k=j*W+i;if(gridV[k]<0){const[nx,ny,nz]=hN(i,j);gridV[k]=push(mmX(i),hAt[k],mmZ(j),nx,ny,nz)}return gridV[k]};
 const crossing=new Map();
 const cross=(i,j,horizontal)=>{const id=(j*W+i)*2+(horizontal?0:1);let c=crossing.get(id);
  if(!c){const i2=horizontal?i+1:i,j2=horizontal?j:j+1,va=A[j*W+i],vb=A[j2*W+i2],t=(TH-va)/((vb-va)||1e-9);
   const x=mmX(i+(i2-i)*t),z=mmZ(j+(j2-j)*t);
   const ii=inside[j*W+i]?i:i2,jj=inside[j*W+i]?j:j2,[nx,ny,nz]=hN(ii,jj);
   c={x,z,top:push(x,edge,z,nx,ny,nz)};crossing.set(id,c)}
  return c};
 const tri=(a,b,c)=>idx.push(a,c,b);            /* field-clockwise in, +y normal out */

 const walls=[];
 for(let j=0;j<H-1;j++)for(let i=0;i<W-1;i++){
  const tl=inside[j*W+i],tr=inside[j*W+i+1],br=inside[(j+1)*W+i+1],bl=inside[(j+1)*W+i];
  const k=(tl?8:0)|(tr?4:0)|(br?2:0)|(bl?1:0);if(k===0)continue;
  if(k===15){const a=vGrid(i,j),b=vGrid(i+1,j),c=vGrid(i+1,j+1),e=vGrid(i,j+1);tri(a,b,c);tri(a,c,e);continue}
  const T=tl!==tr?cross(i,j,true):null,R=tr!==br?cross(i+1,j,false):null,
        B=bl!==br?cross(i,j+1,true):null,Lf=tl!==bl?cross(i,j,false):null;
  const saddle=k===5||k===10;
  const mid=(A[j*W+i]+A[j*W+i+1]+A[(j+1)*W+i+1]+A[(j+1)*W+i])/4>TH;
  if(saddle&&!mid){
   if(k===10){tri(vGrid(i,j),T.top,Lf.top);tri(vGrid(i+1,j+1),B.top,R.top);walls.push([T,Lf],[B,R])}
   else{tri(vGrid(i+1,j),R.top,T.top);tri(vGrid(i,j+1),Lf.top,B.top);walls.push([R,T],[Lf,B])}
   continue}
  const poly=[];
  if(tl)poly.push(vGrid(i,j));if(T)poly.push(T.top);
  if(tr)poly.push(vGrid(i+1,j));if(R)poly.push(R.top);
  if(br)poly.push(vGrid(i+1,j+1));if(B)poly.push(B.top);
  if(bl)poly.push(vGrid(i,j+1));if(Lf)poly.push(Lf.top);
  for(let q=1;q<poly.length-1;q++)tri(poly[0],poly[q],poly[q+1]);
  const cs=[T,R,B,Lf].filter(Boolean);
  if(saddle){if(k===10)walls.push([T,R],[B,Lf]);else walls.push([T,Lf],[R,B])}
  else walls.push([cs[0],cs[1]])}

 /* the underside, for a closed solid (STL): the top's triangulation, flat and reversed */
 if(bottom){const n=pos.length/3,topIdx=idx.length;
  for(let v=0;v<n;v++)push(pos[v*3],0,pos[v*3+2],0,-1,0);
  for(let t=0;t<topIdx;t+=3)idx.push(idx[t]+n,idx[t+2]+n,idx[t+1]+n)}

 /* walls: from the rim down to the dial, faced outward, smooth along the contour */
 const bilinear=(x,z)=>{const fi=x*ppmm-ox,fj=z*ppmm-oy,i=Math.floor(fi),j=Math.floor(fj),u=fi-i,v=fj-j;
  const g=(ii,jj)=>ii<0||jj<0||ii>=W||jj>=H?0:A[jj*W+ii];
  return g(i,j)*(1-u)*(1-v)+g(i+1,j)*u*(1-v)+g(i,j+1)*(1-u)*v+g(i+1,j+1)*u*v};
 const wallV=new Map(),acc=[];
 const wv=(c,lvl)=>{const key=c.top*2+lvl;let v=wallV.get(key);
  if(v==null){v=push(c.x,lvl?edge:0,c.z,0,0,0);wallV.set(key,v);acc[v]=[0,0]}return v};
 for(let[P,Q]of walls){let dx=Q.x-P.x,dz=Q.z-P.z;const len=Math.hypot(dx,dz);if(len<1e-9)continue;
  let nx=dz/len,nz=-dx/len;
  if(bilinear((P.x+Q.x)/2+nx*step*.35,(P.z+Q.z)/2+nz*step*.35)>TH){[P,Q]=[Q,P];nx=-nx;nz=-nz}
  const pt=wv(P,1),qt=wv(Q,1),pb=wv(P,0),qb=wv(Q,0);
  /* wound so the face looks along n, outward: (qt - pt) x (pb - pt) = n */
  idx.push(pt,qt,pb,qt,qb,pb);
  for(const v of[pt,qt,pb,qb]){acc[v][0]+=nx*len;acc[v][1]+=nz*len}}
 for(const v of wallV.values()){const[ax,az]=acc[v],l=Math.hypot(ax,az)||1;nrm[v*3]=ax/l;nrm[v*3+1]=0;nrm[v*3+2]=az/l}

 const geo=new BufferGeometry();
 geo.setAttribute('position',new Float32BufferAttribute(pos,3));
 geo.setAttribute('normal',new Float32BufferAttribute(nrm,3));
 geo.setAttribute('uv',new Float32BufferAttribute(uv,2));
 geo.setIndex(idx);geo.computeBoundingBox();geo.computeBoundingSphere();
 return{geometry:geo,maxDmm:maxD/ppmm,lumeField}}
