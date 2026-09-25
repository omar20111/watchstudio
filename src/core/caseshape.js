/* Case and bezel outlines (plain math, no three.js).

   An outline is a convex core polygon with a rounded edge of radius rc all the
   way round it (the core grown by a disc):
     round    a circle: the core is a single point
     cushion  a square with generous corners, its flats facing 12, 3, 6 and 9
     octagon  eight flats with small corners, flats facing 12, 3, 6 and 9 too
     square   a square with tight corners
     tonneau  a barrel: longer from 12 to 6 than across, its sides bowed out,
              its ends narrower and gently domed, its corners rounded
     pebble   an asymmetric oval after the sculpted buildings it is drawn from:
              the same from 12 to 6 as a round case, sweeping wider toward the
              crown and narrowing toward 9, with no straight side anywhere

   It is sized by A0, how far it reaches toward 3 o'clock, so a cushion case
   "40 mm" is 40 mm across its flats, as a round one is across its diameter. A
   tonneau reaches further toward 12 and 6: its length, 1.1 to 1.45 times as
   far (the case's tonneauLen, TONNEAU_LENGTH unless set).

   The same shape set in by `inset` mm is exactly the outline offset inward by
   that much: while the inset is less than rc only the corner radius shrinks;
   past it the core polygon itself is offset inward, its edges moving in and any
   too short to survive dropping out. So a band, a chamfer or a bevel keeps its
   width all the way round a shaped case, just as it does round a turned one.

   Points are in the dial plane, x toward 3 o'clock and z toward 6, and are
   addressed by the angle phi of their outward normal. A flat has one normal for
   its whole length, so the sample list carries each flat's normal twice, once
   for each end (side -1 and +1). */

/* 'case': the bezel takes the case's own shape, and keeps it all the way in —
   its opening, the flange under it and the crystal follow the case instead of
   coming back to a circle, as a shaped watch's do. */
export const CASE_SHAPES=['round','cushion','octagon','square','tonneau','pebble'], BEZEL_SHAPES=['round','octagon','square','case'];
export const TONNEAU_LENGTH=1.2,TONNEAU_RANGE=[1.1,1.45];
const TAU=Math.PI*2;
const wrap=a=>((a%TAU)+TAU)%TAU;

/* a spec from a unit core (vertices anticlockwise from +x toward +z) and rc.
   `curved`: the core's edges only approximate a curve (a tonneau's bowed sides),
   so they are not flats to keep sharp: sampled evenly, the surface shades as the
   smooth curve it stands for instead of a hundred narrow facets. */
function spec(kind,v,cf,{curved=false}={}){
 const edges=v.length<2?[]:v.map((a,i)=>{const b=v[(i+1)%v.length],ex=b[0]-a[0],ez=b[1]-a[1],l=Math.hypot(ex,ez);
  const nx=ez/l,nz=-ex/l;return{a,b,nx,nz,h:nx*a[0]+nz*a[1],phi:wrap(Math.atan2(nz,nx))}});
 return{kind,v,cf,edges,flats:curved?[]:edges.map(e=>e.phi),curved,N:edges.length,
  maxR:Math.max(...v.map(p=>Math.hypot(p[0],p[1]))),shrunk:new Map()}}

function regular(kind,N,cf){const d=(1-cf)/Math.cos(Math.PI/N);
 return spec(kind,Array.from({length:N},(_,k)=>{const th=(k+.5)*TAU/N;return[d*Math.cos(th),d*Math.sin(th)]}),cf)}

/* The barrel: each side an arc through the widest point at 3 (or 9) and the two
   corners, each end an arc through the corners and its crown at 12 (or 6), the
   whole grown by rc. */
function tonneau(len=TONNEAU_LENGTH){const cf=.18,w=1-cf,l=len-cf,we=.62,lc=l-.06;
 const xc=(w*w-we*we-lc*lc)/(2*(w-we)),Rs=w-xc,a=Math.asin(lc/Rs);
 const yc=(l*l-we*we-lc*lc)/(2*(l-lc)),Re=l-yc,b=Math.asin(we/Re);
 const v=[],S=40,E=16;
 for(let i=0;i<S;i++){const t=-a+2*a*i/S;v.push([xc+Rs*Math.cos(t),Rs*Math.sin(t)])}
 for(let i=0;i<E;i++){const t=Math.PI/2-b+2*b*i/E;v.push([Re*Math.cos(t),yc+Re*Math.sin(t)])}
 for(let i=0;i<S;i++){const t=Math.PI-a+2*a*i/S;v.push([-xc+Rs*Math.cos(t),Rs*Math.sin(t)])}
 for(let i=0;i<E;i++){const t=1.5*Math.PI-b+2*b*i/E;v.push([Re*Math.cos(t),-yc+Re*Math.sin(t)])}
 return spec('tonneau',v,cf,{curved:true})}

/* The pebble. A squarish oval — a superellipse, so its top and bottom run
   nearly straight before turning — swelled toward the crown and drawn out to a
   nose at 9, the sculpted mass this case is named for. The nose is a corner of
   the core, so it comes out as tight as the corner radius; everything else is
   sampled curve. It is scaled so its narrowest reach is exactly A0: a case is
   never smaller than the size it states, or a round bezel would stand out past
   it. */
function pebble(){const cf=.12,N=240,n=3.1,k=.13,nose=1.1;
 const pts=[];
 for(let i=0;i<N;i++){const t=i/N*TAU,c=Math.cos(t),si=Math.sin(t);
  const base=Math.pow(Math.pow(Math.abs(c),n)+Math.pow(Math.abs(si),n),-1/n);
  const r=base*(1+k*c)*.86;pts.push([r*c,r*si])}
 pts.push([-nose*.86,0]);
 const core=hull(pts);
 /* measured on the outline itself, the narrowest it comes to the centre, scaled
    to 1: the support of the core is a hair further out than the ray meets */
 const probe=spec('pebble',core,cf,{curved:true});
 let min=Infinity;for(let i=0;i<720;i++)min=Math.min(min,extentAlong(probe,1,i/720*TAU));
 const d=1.0002/min;
 return spec('pebble',core.map(p=>[d*p[0],d*p[1]]),cf*d,{curved:true})}

/* the convex hull of a point set (monotone chain), anticlockwise */
function hull(pts){const p=[...pts].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
 const lo=[];for(const q of p){while(lo.length>1&&cross(lo[lo.length-2],lo[lo.length-1],q)<=0)lo.pop();lo.push(q)}
 const up=[];for(let i=p.length-1;i>=0;i--){const q=p[i];while(up.length>1&&cross(up[up.length-2],up[up.length-1],q)<=0)up.pop();up.push(q)}
 return lo.slice(0,-1).concat(up.slice(0,-1))}

const SPECS={round:spec('round',[[0,0]],1),cushion:regular('cushion',4,.42),octagon:regular('octagon',8,.07),
 square:regular('square',4,.12),pebble:pebble()};
/* a tonneau for each length asked for, to the half percent */
const tonneaus=new Map();
const tonneauSpec=len=>{const L=Math.round(Math.min(TONNEAU_RANGE[1],Math.max(TONNEAU_RANGE[0],+len||TONNEAU_LENGTH))*200)/200;
 let s=tonneaus.get(L);if(!s){s=tonneau(L);tonneaus.set(L,s)}return s};
/* `c`, the case (geometry.js caseOf), carries a tonneau's length */
export const shapeSpec=(kind,c)=>kind==='tonneau'?tonneauSpec(c&&c.tonneauLen):SPECS[kind]||SPECS.round;

/* the A0 that puts a shape's farthest corner (not its flats) on radius R */
export const inscribedApothem=(spec,R)=>R/(spec.maxR+spec.cf);

/* keep the part of polygon P where nx*x+nz*z <= h */
function clip(P,nx,nz,h){const out=[];
 for(let i=0;i<P.length;i++){const p=P[i],q=P[(i+1)%P.length],dp=nx*p[0]+nz*p[1]-h,dq=nx*q[0]+nz*q[1]-h;
  if(dp<=0)out.push(p);
  if((dp<0&&dq>0)||(dp>0&&dq<0)){const t=dp/(dp-dq);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t])}}
 return out}

/* the core scaled by A0 and offset inward by t mm (t > 0), cached per spec */
function shrunkCore(s,A0,t){const key=A0.toFixed(9)+'|'+t.toFixed(9);
 let P=s.shrunk.get(key);if(P)return P;
 P=s.v.map(p=>[p[0]*A0,p[1]*A0]);
 for(const e of s.edges){P=clip(P,e.nx,e.nz,e.h*A0-t);if(!P.length)break}
 if(!P.length)P=[[0,0]];
 s.shrunk.set(key,P);if(s.shrunk.size>512)s.shrunk.delete(s.shrunk.keys().next().value);
 return P}

/* the vertex of P farthest along the normal at phi; a flat's two ends by `side` */
function support(P,phi,side){const f=phi+(side||1)*1e-9,nx=Math.cos(f),nz=Math.sin(f);
 let k=0,best=-Infinity;for(let i=0;i<P.length;i++){const v=P[i][0]*nx+P[i][1]*nz;if(v>best+1e-12){best=v;k=i}}
 return P[k]}

/* trace an outline into a 2D canvas path, in sheet px about (cx,cy) */
export function outlinePath(ctx,spec,A0,inset,cx,cy,n=96){
 const pts=outlineSamples([spec],n).map(({phi,side})=>outlinePoint(spec,A0,inset,phi,side));
 pts.forEach(([x,z],i)=>i?ctx.lineTo(cx+x,cy+z):ctx.moveTo(cx+x,cy+z));ctx.closePath()}

/* the point with outward normal phi on `spec` sized A0, set in by `inset`; a
   negative inset grows the outline */
export function outlinePoint(spec,A0,inset,phi,side=0){
 const rc=spec.cf*A0-inset,nx=Math.cos(phi),nz=Math.sin(phi);
 if(rc>=0){const u=support(spec.v,phi,side);return[u[0]*A0+rc*nx,u[1]*A0+rc*nz]}
 /* A curve set in past its corner radius. Offsetting its core exactly turns the
    curve back into the polygon it was sampled as — the facets show as a crinkle
    along a caseback's rim, where the inset is deepest. A curve is set in by
    scaling instead: smooth, still convex, and within a hair of the true offset
    on shapes as round as these. A shape with real flats keeps the offset, which
    is what holds a band's width constant round an octagon. */
 if(spec.curved){const k=Math.max(0,(A0-inset)/A0),u=support(spec.v,phi,side),r=spec.cf*A0*k;
  return[u[0]*A0*k+r*nx,u[1]*A0*k+r*nz]}
 return support(shrunkCore(spec,A0,-rc),phi,side).slice()}

/* The normal angles to sample an outline (or several, for a loft between shapes)
   at: n even steps round, with every flat's normal carried twice. */
export function outlineSamples(specs,n=160){
 const flats=new Set();
 for(const s of specs)for(const f of s.flats)flats.add(+f.toFixed(9));
 const sorted=[...flats].sort((a,b)=>a-b),out=[];
 for(let i=0;i<n;i++){const phi=i*TAU/n,next=(i+1)*TAU/n;
  if(!flats.has(+phi.toFixed(9)))out.push({phi,side:0});
  for(const f of sorted)if(f>=phi-1e-12&&f<next-1e-12)out.push({phi:f,side:-1},{phi:f,side:1})}
 return out}

/* the outline as a closed polyline with each point's normal angle */
export function outlinePoly(spec,A0,inset,n=160){
 return outlineSamples([spec],n).map(({phi,side})=>({p:outlinePoint(spec,A0,inset,phi,side),phi,side}))}

/* how far inside the outline a point is, mm (negative outside) */
export function insetOf(spec,A0,x,z){
 const rc=spec.cf*A0;
 if(!spec.N)return rc-Math.hypot(x,z);
 /* signed distance to the core: inside, the nearest edge line; outside, the
    nearest point of the boundary. The outline is the core grown by rc. */
 let m=-Infinity;for(const e of spec.edges)m=Math.max(m,e.nx*x+e.nz*z-e.h*A0);
 let sd=m;
 if(m>0){sd=Infinity;
  for(const e of spec.edges){const ax=e.a[0]*A0,az=e.a[1]*A0,ex=(e.b[0]-e.a[0])*A0,ez=(e.b[1]-e.a[1])*A0;
   const t=Math.max(0,Math.min(1,((x-ax)*ex+(z-az)*ez)/(ex*ex+ez*ez)));
   sd=Math.min(sd,Math.hypot(x-ax-ex*t,z-az-ez*t))}}
 return rc-sd}

/* How far the outline reaches in the direction `ang`, measured along that
   direction — its support, not the ray through the centre. On a shape that is
   not symmetric about that axis the farthest point lies off it: a pebble case's
   widest point toward 12 is not at 12 o'clock, so the ray would read short. */
export function supportAlong(spec,A0,ang){const ux=Math.cos(ang),uz=Math.sin(ang);
 const rc=spec.cf*A0;
 if(!spec.N)return rc;
 let m=-Infinity;for(const v of spec.v)m=Math.max(m,(v[0]*ux+v[1]*uz)*A0);
 return m+rc}

/* distance from the centre to the outline along the direction at angle `ang` */
export function extentAlong(spec,A0,ang,inset=0){
 const ux=Math.cos(ang),uz=Math.sin(ang);let lo=0,hi=A0*(spec.maxR+spec.cf)*1.5+Math.max(0,-inset)+1;
 /* an outline set in by `inset` is the points that far inside the full one */
 for(let i=0;i<44;i++){const m=(lo+hi)/2;if(insetOf(spec,A0,m*ux,m*uz)>inset)lo=m;else hi=m}
 return(lo+hi)/2}

/* In a frame whose axis points along angle `beta` from the centre, where the
   outline (inflated by `grow`) crosses the line at lateral offset `lat` on the
   side the axis faces: {s: distance along the axis, normal: [nx,nz]}. Lateral
   is measured toward the axis rotated a quarter turn from x toward z. */
export function crossingAt(spec,A0,beta,lat,grow=0){
 const ux=Math.cos(beta),uz=Math.sin(beta),lx=-uz,lz=ux;
 const poly=outlinePoly(spec,A0,-grow,720);
 let best=null;
 for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];
  const la=a.p[0]*lx+a.p[1]*lz,lb=b.p[0]*lx+b.p[1]*lz;
  if((la-lat)*(lb-lat)>0||la===lb)continue;
  const t=(lat-la)/(lb-la),x=a.p[0]+(b.p[0]-a.p[0])*t,z=a.p[1]+(b.p[1]-a.p[1])*t,s=x*ux+z*uz;
  if(!best||s>best.s){const ex=b.p[0]-a.p[0],ez=b.p[1]-a.p[1],l=Math.hypot(ex,ez)||1;
   let nx=ez/l,nz=-ex/l;if(nx*x+nz*z<0){nx=-nx;nz=-nz}
   best={s,x,z,normal:[nx,nz]}}}
 return best}
