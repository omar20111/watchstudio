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
import {Vector2,LatheGeometry} from 'three';
import {PX} from '../constants.js';
import {geoOf,caseOf,thicknessStack} from '../geometry.js';
import {bezelRings} from '../render/bezel.js';

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

 P.caseback=[V(0,0),V(rCase*.80,0),...round(V(rCase*.80,0),V(rCase*.88,0),V(rCase*.88,H.back*.6),4),
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
