/* Lathe profiles: the millimetre construction as revolved geometry.

   A watch head is a solid of revolution, and geometry.js already holds both
   halves of its profile — the radial stack (rCase > rSeat > rBezOut > rBezIn >
   dialR) and the thickness stack (caseback + band + movement + dial + bezel +
   crystal). This module only pairs them into (radius, height) points. It adds
   no proportions of its own beyond edge radii and chamfer angles, so the 3D
   head, the front drawing and the spec sheet read one set of numbers.

   Units are mm. +y points out of the dial toward the viewer, y=0 is the bottom
   of the caseback, and the lathe axis is the dial's centre.

   Point order matters: LatheGeometry takes each segment's normal as (dy, -dx),
   so every profile runs bottom -> outside -> top -> inward, which faces its
   normals out of the metal. */
import {Vector2,LatheGeometry,Shape} from 'three';
import {PX} from '../constants.js';
import {geoOf,caseOf,thicknessStack,crownAng,strapMmOf} from '../geometry.js';
import {bezelRings} from '../render/bezel.js';
import {CASEBACK_WINDOW} from '../render/caseback.js';

const V=(x,y)=>new Vector2(x,y);

/* a quarter-round from `a` to `b`, bulging away from the corner `c` they share */
function round(a,c,b,n=6){const out=[];
 for(let i=1;i<n;i++){const t=i/n,u=1-t;
  out.push(V(u*u*a.x+2*u*t*c.x+t*t*b.x,u*u*a.y+2*u*t*c.y+t*t*b.y))}
 return out}

/* Every height the head is built from, taken straight off the thickness stack. */
export function headHeights(d){const st=thicknessStack(d);
 const back=st.caseback;
 const seat=back+st.band+st.movement+st.dial;   /* top of the mid-case; the dial sits level with it */
 const bezelTop=seat+st.bezel;
 const top=bezelTop+st.crystal;                  /* crystal apex = total thickness */
 return{back,seat,dial:seat,bezelTop,top,stack:st}}

export function headRadii(d){const g=geoOf(d),mm=px=>px/PX;
 const b=bezelRings(g,d.parts.bezel.variant);
 return{rCase:mm(g.rCase),rSeat:mm(g.rSeat),rBezOut:mm(g.rBezOut),rBezIn:mm(g.rBezIn),dialR:mm(g.dialR),
  rGripIn:mm(b.rGripIn),rInsOut:mm(b.rInsOut),rInCham:mm(b.rInCham),rotating:b.rot}}

/* Profiles, each a separate lathe so a hard machined edge stays hard: a single
   lathe averages normals across every joint and would round them all off. */
export function headProfiles(d){
 const H=headHeights(d),Rr=headRadii(d),arch=caseOf(d);
 const{rCase,rSeat,rBezOut,rBezIn,dialR,rGripIn,rInCham}=Rr;
 const cham=rCase-rSeat;                          /* 45 degree case chamfer */
 const e=Math.min(.35,(H.seat-H.back)*.08);        /* edge break on the flank */
 const P={};

 /* an exhibition back is a ring around a sapphire window, its wall facing in */
 const back0=arch.caseback==='exhibition'?[V(rCase*CASEBACK_WINDOW,H.back*.55),V(rCase*CASEBACK_WINDOW,0)]:[V(0,0)];
 P.caseback=[...back0,V(rCase*.80,0),...round(V(rCase*.80,0),V(rCase*.88,0),V(rCase*.88,H.back*.6),4),
  V(rCase*.88,H.back*.6),V(rCase*.92,H.back)];

 /* mid-case flank: tucks in under the caseback, rises vertically to the chamfer */
 P.flank=[V(rCase*.92,H.back),V(rCase-e,H.back),...round(V(rCase-e,H.back),V(rCase,H.back),V(rCase,H.back+e)),
  V(rCase,H.back+e),V(rCase,H.seat-cham)];
 P.chamfer=[V(rCase,H.seat-cham),V(rSeat,H.seat)];
 P.seat=[V(rSeat,H.seat),V(rBezOut*.985,H.seat)];

 /* bezel: flank, then a top face that is flat for an insert and crowned for a
    dress bezel, then the inner chamfer dropping to the crystal */
 const bh=H.bezelTop-H.seat,eb=Math.min(.3,bh*.28);
 P.bezelFlank=[V(rBezOut,H.seat),V(rBezOut,H.bezelTop-eb),...round(V(rBezOut,H.bezelTop-eb),V(rBezOut,H.bezelTop),V(rBezOut-eb,H.bezelTop)),
  V(rBezOut-eb,H.bezelTop),V(rGripIn,H.bezelTop)];
 /* an insert, or an engraved tachymeter scale, needs a flat face to sit on */
 if(Rr.rotating||d.parts.bezel.variant==='tachy')P.bezelTop=[V(rGripIn,H.bezelTop),V(rInCham,H.bezelTop)];
 else{const crown=bh*.18,mid=(rGripIn+rInCham)/2;
  P.bezelTop=[V(rGripIn,H.bezelTop),...round(V(rGripIn,H.bezelTop),V(mid,H.bezelTop+crown*1.6),V(rInCham,H.bezelTop),8),V(rInCham,H.bezelTop)]}
 const innerDrop=Math.min(bh*.45,(rInCham-rBezIn)*1.6);
 P.bezelInner=[V(rInCham,H.bezelTop),V(rBezIn,H.bezelTop-innerDrop)];

 /* rehaut: the flange falling from under the bezel's inner edge to the dial */
 P.rehaut=[V(rBezIn,H.bezelTop-innerDrop),V(dialR,H.dial)];

 /* crystal, seated just inside the bezel's inner edge */
 const c0=H.bezelTop-innerDrop*.7,h=H.top-c0,a=rBezIn;
 if(arch.crystal==='dome'){/* spherical cap through the rim and the apex */
  const Rs=(a*a+h*h)/(2*h),n=24;P.crystal=[];
  for(let i=0;i<=n;i++){const x=a*(1-i/n),y=H.top-Rs+Math.sqrt(Math.max(0,Rs*Rs-x*x));P.crystal.push(V(x,y))}
  P.crystal[P.crystal.length-1]=V(0,H.top)}
 else{const k=arch.crystal==='box'?Math.min(.5,h*.25):Math.min(.2,h*.3);
  P.crystal=[V(a,c0),V(a,H.top-k),...round(V(a,H.top-k),V(a,H.top),V(a-k,H.top)),V(a-k,H.top),V(0,H.top)]}
 return{profiles:P,heights:H,radii:Rr}}

export const lathe=(points,segments=160)=>new LatheGeometry(points,segments);

/* ---------------------------------------------------------------------------
   The parts that are not solids of revolution. Every outline below is the one
   case.js / crown.js already draw, re-expressed in mm, so the 3D case and the
   2D drawing share their proportions.
--------------------------------------------------------------------------- */

const quad=(a,c,b,n=10)=>{const o=[];for(let i=1;i<=n;i++){const t=i/n,u=1-t;
 o.push([u*u*a[0]+2*u*t*c[0]+t*t*b[0],u*u*a[1]+2*u*t*c[1]+t*t*b[1]])}return o};
const shapeOf=pts=>{const s=new Shape();pts.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));return s};
export const smoothstep=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};

/* Lug horns: broad where they leave the band, tapering and leaning outward to a
   rounded tip (case.js lugPath). Shape coordinates are (x, -z) so that laying
   the extrusion face-up puts it at world z. They drop toward the tip by the
   case's lug drop. */
export function lugParts(d){
 const g=geoOf(d),H=headHeights(d),arch=caseOf(d),sport=d.parts.case.variant==='sport';
 const R=g.R,sw=g.sw,lugW=R*(sport?.17:.135),outer=R+g.lugExt,inner=R*.42;
 /* the rounded tip is a quadratic whose peak sits 0.14·wt inside its end
    points, so the end points go that far out for the tip to land on lug-to-lug */
 const wb=lugW*2,wt=lugW*1.1,lean=lugW*.12,yb=inner,yt=outer+wt*.14;
 const local=[[-wb/2,yb],...quad([-wb/2,yb],[-wt/2-lugW*.10,(yb+yt)*.55],[lean-wt/2,yt-wt*.44]),
  ...quad([lean-wt/2,yt-wt*.44],[lean,yt+wt*.16],[lean+wt/2,yt-wt*.44]),
  ...quad([lean+wt/2,yt-wt*.44],[wb/2+lugW*.06,(yb+yt)*.55],[wb/2,yb])];
 const shapes=[];
 for(const sy of[-1,1])for(const sx of[-1,1])
  shapes.push(shapeOf(local.map(([lx,ly])=>[sx*(sw*.5+lugW*.95+lx)/PX,-(sy*ly)/PX])));
 const cham=(g.rCase-g.rSeat)/PX;
 const top=H.seat-cham-.15,bottom=H.back+(H.seat-H.back)*.38;
 return{shapes,top,bottom,thick:top-bottom,drop:arch.lugDrop,
  /* where the drop starts and where it is complete, in mm from the centre */
  z0:R*.9/PX,z1:outer/PX,
  /* spring bar: near the tip, where case.js drills the lug hole */
  springZ:(outer-lugW*.85)/PX}}

/* Crown guards on the sport case, swung to the crown's bearing */
export function guardShapes(d){
 if(d.parts.case.variant!=='sport')return[];
 const g=geoOf(d),R=g.R,cr=g.crownR,gi=cr*.86,go=cr*1.95,gx=R+cr;
 const b=(crownAng(d)-90)*Math.PI/180,cs=Math.cos(b),sn=Math.sin(b);
 const w=([x,y])=>[(x*cs-y*sn)/PX,-(x*sn+y*cs)/PX];
 return[-1,1].map(sy=>shapeOf([[R*.88,sy*go],...quad([R*.88,sy*go],[gx*.99,sy*go*.92],[gx,sy*gi]),[R*.94,sy*gi*.86]].map(w)))}

/* Crown and pushers along their own axis (+x before the bearing is applied) */
export function crownParts(d){
 const g=geoOf(d),H=headHeights(d),sc=d.parts.crown.variant==='oversized'?1.22:1;
 const R=g.R/PX,cr=g.crownR/PX,rb=cr*sc,L=cr*1.5*sc;
 const x0=R-cr*.45,x1=R+cr*.30;                  /* tube: from inside the band to the barrel */
 const e=Math.min(.35,rb*.14);
 return{axisY:H.back+(H.seat-H.back)*.5,bearing:crownAng(d),
  tube:{r:rb*.19,x0,x1},barrelX:x1,
  /* barrel as lathe pieces around its own axis (radius, distance along axis) */
  inner:[V(rb*.19,0),V(rb-e,0),...round(V(rb-e,0),V(rb,0),V(rb,e)),V(rb,e)],
  side:[V(rb,e),V(rb,L-e*1.4)],
  end:[V(rb,L-e*1.4),V(rb-e*1.4,L),...round(V(rb-e*1.4,L),V(rb*.55,L+e*.5),V(0,L+e*.35),6),V(0,L+e*.35)],
  teeth:Math.max(18,Math.round(rb*2*Math.PI/.55)),
  pushers:d.case&&caseOf(d).pushers?[-30,30].map(off=>({bearing:crownAng(d)+off,
   shoulder:{r:cr*.86*.3,x0:R-cr*.18,x1:R+cr*.16},
   head:{r:cr*.86*.5,x0:R+cr*.12,len:cr*.52}})):[]}}

/* The strap's centreline, from the spring bar outward: a first bend down and
   away, a second back to level, then lying flat on the table — a watch resting
   on its strap. Returns positions along arc length s (mm past the spring bar)
   in the strap's own (along, up) plane; `dir` is -1 toward 12, +1 toward 6. */
export function strapPath(d){
 const lp=lugParts(d),v=d.parts.strap.variant;
 const T=v==='nato'?1.3:v==='steel'?3.4:v==='rubber'?3.6:3.1;
 const lugDropAtBar=lp.drop*smoothstep(lp.z0,lp.z1,lp.springZ);
 const y0=lp.bottom-lugDropAtBar+lp.thick*.42-T/2;   /* centreline at the spring bar */
 const r1=16,r2=12,th=55*Math.PI/180;
 const s1=r1*th,s2=s1+r2*th;
 const pos=s=>{
  if(s<=0)return[s,y0,0];
  if(s<=s1){const a=s/r1;return[r1*Math.sin(a),y0-r1*(1-Math.cos(a)),-a]}
  const zA=r1*Math.sin(th),yA=y0-r1*(1-Math.cos(th));
  if(s<=s2){const a=th-(s-s1)/r2;                   /* unwinding back to level */
   return[zA+r2*(Math.sin(th)-Math.sin(a)),yA-r2*(Math.cos(a)-Math.cos(th)),-a]}
  const zB=zA+r2*Math.sin(th),yB=yA-r2*(1-Math.cos(th));
  return[zB+(s-s2),yB,0]};
 const groundY=pos(s2+1)[1]-T/2;
 return{T,start:lp.springZ,pos,groundY,width:strapMmOf(d)}}
