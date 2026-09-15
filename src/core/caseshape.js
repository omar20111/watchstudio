/* Case and bezel outlines (plain math, no three.js).

   An outline is a regular polygon with rounded corners, or a circle:
     round    a circle
     cushion  a square with generous corners, its flats facing 12, 3, 6 and 9
     octagon  eight flats with small corners, flats facing 12, 3, 6 and 9 too

   It is sized by its apothem A0 — the distance from the centre to a flat, or the
   radius of a circle — so a cushion case "40 mm" is 40 mm across its flats, as a
   round one is across its diameter, and the lug-to-lug is measured the same way.

   The same shape set in by `inset` mm is exactly the outline offset inward by
   that much: apothem A0 - inset, corner radius (cf·A0 - inset), no less than 0.
   So a band, a chamfer or a bevel keeps its width all the way round a shaped
   case, just as it does round a turned one.

   Points are in the dial plane, x toward 3 o'clock and z toward 6, and are
   addressed by the angle phi of their outward normal. A flat has one normal for
   its whole length, so the sample list carries each flat's normal twice, once
   for each end (side -1 and +1). */

export const CASE_SHAPES=['round','cushion','octagon'], BEZEL_SHAPES=['round','octagon'];
const SPECS={round:{N:0,cf:1},cushion:{N:4,cf:.42},octagon:{N:8,cf:.07}};
export const shapeSpec=kind=>SPECS[kind]||SPECS.round;
const TAU=Math.PI*2;

/* the apothem that puts a shape's corners (not its flats) on radius R */
export const inscribedApothem=(spec,R)=>spec.N?R/((1-spec.cf)/Math.cos(Math.PI/spec.N)+spec.cf):R;

/* trace an outline into a 2D canvas path, in sheet px about (cx,cy) */
export function outlinePath(ctx,spec,A0,inset,cx,cy,n=96){
 const pts=outlineSamples([spec],n).map(({phi,side})=>outlinePoint(spec,A0,inset,phi,side));
 pts.forEach(([x,z],i)=>i?ctx.lineTo(cx+x,cy+z):ctx.moveTo(cx+x,cy+z));ctx.closePath()}

/* the point with outward normal phi on `spec` sized A0, set in by `inset` */
export function outlinePoint(spec,A0,inset,phi,side=0){
 const a=A0-inset;
 if(!spec.N)return[a*Math.cos(phi),a*Math.sin(phi)];
 /* a negative inset grows the outline: apothem and corner radius grow alike */
 const N=spec.N,step=TAU/N,rc=Math.max(0,Math.min(spec.cf*A0-inset,a));
 let k=Math.floor((phi+side*1e-9)/step);k=((k%N)+N)%N;
 const th=(k+.5)*step,d=(a-rc)/Math.cos(Math.PI/N);
 return[d*Math.cos(th)+rc*Math.cos(phi),d*Math.sin(th)+rc*Math.sin(phi)]}

/* The normal angles to sample an outline (or several, for a loft between shapes)
   at: n even steps round, with every flat's normal carried twice. */
export function outlineSamples(specs,n=160){
 const flats=new Set();
 for(const s of specs)if(s.N)for(let k=0;k<s.N;k++)flats.add(+(k*TAU/s.N).toFixed(9));
 const out=[];
 for(let i=0;i<n;i++){const phi=i*TAU/n,next=(i+1)*TAU/n;
  if(!flats.has(+phi.toFixed(9)))out.push({phi,side:0});
  for(const f of[...flats].filter(f=>f>=phi-1e-12&&f<next-1e-12).sort((a,b)=>a-b))out.push({phi:f,side:-1},{phi:f,side:1})}
 return out}

/* the outline as a closed polyline with each point's normal angle */
export function outlinePoly(spec,A0,inset,n=160){
 return outlineSamples([spec],n).map(({phi,side})=>({p:outlinePoint(spec,A0,inset,phi,side),phi,side}))}

/* how far inside the outline a point is, mm (negative outside) */
export function insetOf(spec,A0,x,z){
 if(!spec.N)return A0-Math.hypot(x,z);
 const N=spec.N,rc=Math.max(0,spec.cf*A0),ac=A0-rc,step=TAU/N;
 /* signed distance to the core polygon (apothem ac); the outline is that grown by rc */
 let best=-Infinity,bk=0;
 for(let k=0;k<N;k++){const v=x*Math.cos(k*step)+z*Math.sin(k*step)-ac;if(v>best){best=v;bk=k}}
 let sd=best;
 if(best>0){const t=-x*Math.sin(bk*step)+z*Math.cos(bk*step),h=ac*Math.tan(Math.PI/N);
  if(Math.abs(t)>h){const sgn=Math.sign(t),vx=ac*Math.cos(bk*step)-sgn*h*Math.sin(bk*step),vz=ac*Math.sin(bk*step)+sgn*h*Math.cos(bk*step);
   sd=Math.hypot(x-vx,z-vz)}}
 return rc-sd}

/* distance from the centre to the outline along the direction at angle `ang` */
export function extentAlong(spec,A0,ang,inset=0){
 const ux=Math.cos(ang),uz=Math.sin(ang);let lo=0,hi=A0*2;
 /* an outline set in by `inset` is the points that far inside the full one */
 for(let i=0;i<40;i++){const m=(lo+hi)/2;if(insetOf(spec,A0,m*ux,m*uz)>inset)lo=m;else hi=m}
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
