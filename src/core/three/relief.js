/* Relief: a shaped solid from a silhouette bake.

   Extruded straight up, every hand and index had a flat top — a slab. Real hands
   and applied indices are ground: a dauphine is two facets meeting at a ridge,
   a baton has bevelled edges and a flat top with its lume set into a channel,
   a dot is domed. All of those are a height that follows the distance from the
   part's edge, so this builds the top surface from a distance field of the same
   `shape` bake the tracer reads — every hand and marker style gets its form
   without any shape being written twice.

   Profiles, with d the distance in from the edge:
     roof   rises straight to the widest point: planar facets and a ridge
     bevel  rises over `bevel` of the width, then flat
     dome   a quarter-round over `bevel` of the width, then flat
   A `lume` bake cuts a pocket to `pocket` height wherever the compound sits,
   so a flat lume decal laid at that height is seen only inside the channel.

   The outline is marching squares on the anti-aliased alpha, as in tracer.js,
   so the edge is sub-pixel rather than a staircase. Output is millimetres,
   face-up, underside at y = 0, with sheet UVs for texturing and tangents. */
import {BufferGeometry,Float32BufferAttribute} from 'three';
import {C,PX,CAN} from '../constants.js';
import {traceLoops,simplifyLoop} from './tracer.js';

const TH=.5,INF=1e20,SHEET=CAN/PX;

const alphaOf=cv=>cv?cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data:null;

const cache=new WeakMap();
export function reliefFromSilhouette(cv,opts={}){
 const key=JSON.stringify([opts.height,opts.edge,opts.profile,opts.bevel,opts.pocket]);
 let per=cache.get(cv);if(!per){per=new Map();cache.set(cv,per)}
 const lumeKey=opts.lume||null;
 let hit=per.get(key);
 if(!hit||hit.lume!==lumeKey){hit={lume:lumeKey,out:build(cv,opts)};per.set(key,hit)}
 /* a copy: a built watch disposes its geometry, and the GLB exporter adds
    tangents to it — neither may reach the cached original */
 return hit.out&&{...hit.out,geometry:hit.out.geometry.clone()}}

function build(cv,{height=.3,edge=.08,profile='bevel',bevel=.35,lume=null,pocket=null}={}){
 const W0=cv.width,H0=cv.height,data=alphaOf(cv);
 let x0=W0,y0=H0,x1=-1,y1=-1;
 for(let y=0;y<H0;y++){const row=y*W0;for(let x=0;x<W0;x++)if(data[(row+x)*4+3]>8){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}}
 if(x1<0)return null;
 /* two pixels of margin so the field and the contour both close */
 const bx=x0-2,by=y0-2,W=x1-x0+5,H=y1-y0+5;
 const lumeData=pocket!=null&&lume?alphaOf(lume):null;
 const A=new Float32Array(W*H),L=lumeData?new Float32Array(W*H):null,inside=new Uint8Array(W*H);
 for(let j=0;j<H;j++)for(let i=0;i<W;i++){const X=i+bx,Y=j+by,k=j*W+i;
  if(X<0||Y<0||X>=W0||Y>=H0)continue;const p=(Y*W0+X)*4;
  A[k]=data[p+3]/255;inside[k]=A[k]>TH?1:0;if(L)L[k]=lumeData[p+3]/255}
 /* Distance to the contour itself — the sub-pixel outline marching squares
    traces through the anti-aliased edge — not to the nearest outside pixel.
    A pixel-centre distance transform ripples along any edge that is not
    horizontal or vertical, and on a polished dauphine facet, whose edges run
    almost along the hand, those ripples are long enough to read as ribs. */
 /* ...and to the outline simplified to a tolerance of 0.4 px: a straight edge
    becomes one exact line, so a facet ground against it comes out truly flat.
    The raw marching-squares contour wobbles by a fraction of a pixel along a
    long, almost-vertical edge, and on a mirror polish that wobble reads as ribs. */
 const S=6,segs=[];
 for(const loop of traceLoops(cv,data)){const l=simplifyLoop(loop,.4);
  for(let n=0;n<l.length;n++){const p=l[n],q=l[(n+1)%l.length];
   /* cut into pieces no longer than a bucket: still exactly straight, and the
      ring search below may assume a piece lies within its own bucket */
   const pieces=Math.max(1,Math.ceil(Math.hypot(q[0]-p[0],q[1]-p[1])/S));
   for(let m=0;m<pieces;m++){const t0=m/pieces,t1=(m+1)/pieces;
    segs.push([[p[0]+(q[0]-p[0])*t0-bx,p[1]+(q[1]-p[1])*t0-by],[p[0]+(q[0]-p[0])*t1-bx,p[1]+(q[1]-p[1])*t1-by]])}}}
 const BW=Math.ceil(W/S)+1,BH=Math.ceil(H/S)+1,bucket=new Array(BW*BH);
 segs.forEach((s,n)=>{const bi=Math.floor((s[0][0]+s[1][0])/2/S),bj=Math.floor((s[0][1]+s[1][1])/2/S);
  (bucket[bj*BW+bi]||(bucket[bj*BW+bi]=[])).push(n)});
 const segDist=(px,py,s)=>{const[ax,ay]=s[0],[bx2,by2]=s[1],dx=bx2-ax,dy=by2-ay,l2=dx*dx+dy*dy;
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
   /* every bucket beyond this ring is at least r*S away (plus a segment's half-length) */
   if(best<=(r-1)*S)break}
  dist[k]=best;if(inside[k]&&best>maxD)maxD=best}
 maxD=Math.max(1,maxD);
 const ease=profile==='dome'?t=>Math.sqrt(1-(1-t)*(1-t)):profile==='bevel'?t=>Math.sin(t*Math.PI/2):t=>t;
 const span=profile==='roof'?maxD:Math.max(1,maxD*bevel);
 /* Just outside, the flank is continued downward as its mirror image about the
    edge. The smoothing below would otherwise average the first pixels inside
    with a flat `edge` outside — by an amount that depends on where a slanted
    outline happens to cross the pixel grid, which on a polished facet shows as
    a row of dark notches along the edge. Mirrored, a straight flank blurs into
    itself and stays straight. */
 const hAt=new Float32Array(W*H);
 for(let k=0;k<W*H;k++){
  if(!inside[k]){hAt[k]=near[k]?edge-(height-edge)*ease(Math.min(1,dist[k]/span)):edge;continue}
  let h=edge+(height-edge)*ease(Math.min(1,dist[k]/span));
  if(L&&L[k]>TH)h=Math.min(h,pocket);
  hAt[k]=h}
 /* A lume pocket is cut where the lume bake's pixels are, so its rim follows the
    pixel grid; and the grid samples the surface only once a pixel. A small
    gaussian (one pass of a 5-tap binomial, sigma ~1 px, about 0.05 mm) rounds
    the pocket rim and the ridge just enough. Outside the part the smoothed
    mirror is kept for the rim's gradients only — the rim itself is built at
    the edge height, so the outline stays put. */
 {const tmp=new Float32Array(W*H),K=[1,4,6,4,1];
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){let s=0,w=0;
   for(let q=-2;q<=2;q++){const ii=i+q;if(ii<0||ii>=W)continue;s+=hAt[j*W+ii]*K[q+2];w+=K[q+2]}tmp[j*W+i]=s/w}
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){let s=0,w=0;
   for(let q=-2;q<=2;q++){const jj=j+q;if(jj<0||jj>=H)continue;s+=tmp[jj*W+i]*K[q+2];w+=K[q+2]}
   /* nothing inside sinks below the rim, or the rim grows a hairline moat */
   const k=j*W+i;hAt[k]=inside[k]?Math.max(edge,s/w):s/w}}

 const pos=[],nrm=[],uv=[],idx=[];
 const mmX=i=>(i+bx-C)/PX,mmZ=j=>(j+by-C)/PX,step=1/PX;
 const push=(x,y,z,nx,ny,nz)=>{pos.push(x,y,z);nrm.push(nx,ny,nz);uv.push(.5+x/SHEET,.5-z/SHEET);return pos.length/3-1};
 /* top-surface normal from the height field's gradient */
 const hN=(i,j)=>{const g=(ii,jj)=>ii<0||jj<0||ii>=W||jj>=H?edge:hAt[jj*W+ii];
  const nx=-(g(i+1,j)-g(i-1,j))/(2*step),nz=-(g(i,j+1)-g(i,j-1))/(2*step),l=Math.hypot(nx,1,nz);return[nx/l,1/l,nz/l]};

 const gridV=new Int32Array(W*H).fill(-1);
 const vGrid=(i,j)=>{const k=j*W+i;if(gridV[k]<0){const[nx,ny,nz]=hN(i,j);gridV[k]=push(mmX(i),hAt[k],mmZ(j),nx,ny,nz)}return gridV[k]};
 /* a contour point on the edge between two grid points, shared by the top rim and the wall */
 const crossing=new Map();
 const cross=(i,j,horizontal)=>{const id=(j*W+i)*2+(horizontal?0:1);let c=crossing.get(id);
  if(!c){const i2=horizontal?i+1:i,j2=horizontal?j:j+1,va=A[j*W+i],vb=A[j2*W+i2],t=(TH-va)/((vb-va)||1e-9);
   const x=mmX(i+(i2-i)*t),z=mmZ(j+(j2-j)*t);
   const ii=inside[j*W+i]?i:i2,jj=inside[j*W+i]?j:j2,[nx,ny,nz]=hN(ii,jj);
   c={x,z,top:push(x,edge,z,nx,ny,nz)};crossing.set(id,c)}
  return c};
 const tri=(a,b,c)=>idx.push(a,c,b);            /* image-clockwise in, +y normal out */

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

 /* walls: from the rim down to the dial, faced outward, smooth along the contour */
 const bilinear=(x,z)=>{const fi=x*PX+C-bx,fj=z*PX+C-by,i=Math.floor(fi),j=Math.floor(fj),u=fi-i,v=fj-j;
  const g=(ii,jj)=>ii<0||jj<0||ii>=W||jj>=H?0:A[jj*W+ii];
  return g(i,j)*(1-u)*(1-v)+g(i+1,j)*u*(1-v)+g(i,j+1)*(1-u)*v+g(i+1,j+1)*u*v};
 const wallV=new Map(),acc=[];
 const wv=(c,lvl)=>{const key=c.top*2+lvl;let v=wallV.get(key);
  if(v==null){v=push(c.x,lvl?edge:0,c.z,0,0,0);wallV.set(key,v);acc[v]=[0,0]}return v};
 for(let[P,Q]of walls){let dx=Q.x-P.x,dz=Q.z-P.z;const len=Math.hypot(dx,dz);if(len<1e-6)continue;
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
 geo.setIndex(idx);geo.computeBoundingSphere();
 return{geometry:geo,maxDmm:maxD/PX,pocket}}
