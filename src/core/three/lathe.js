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
import {LUG_CLEAR_MM,caseReachMm,geoOf,caseOf,thicknessStack,crownAng,strapMmOf,springBarMm,HAND_STACK_MM,HAND_CLEAR_MM,CRYSTAL_T_MM,handsTopAt} from '../geometry.js';
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

/* The case band's side, from the caseback (y0) up to where the chamfer starts
   (y1), as its radius at each height. The widest point is always rCase, so the
   case diameter, the lug-to-lug and everything placed round the case keep their
   figures; the profile only takes metal away.
     straight  a plain vertical wall
     drum      bowed out: widest at mid-height, drawn in toward top and bottom
     sloped    widest under the bezel, drawn in toward the caseback, so the case
               looks slimmer on the wrist
     stepped   a narrower lower tier below a small ledge
   points(from) gives the lathe points from height `from` to y1. */
export function bandOf(d,H=headHeights(d),Rr=headRadii(d)){
 const{rCase,rSeat}=Rr,side=caseOf(d).side;
 const y0=H.back,y1=H.seat-(rCase-rSeat),h=Math.max(.01,y1-y0);
 const dr=Math.min(.55,h*.09),sl=Math.min(.9,h*.13),st=Math.min(.5,h*.08),yStep=y0+h*.42;
 const radiusAt=y=>{const t=Math.min(1,Math.max(0,(y-y0)/h));
  if(side==='drum')return rCase-dr*Math.pow((t-.5)*2,2);
  if(side==='sloped')return rCase-sl*(1-t)*(1-t);
  if(side==='stepped')return y<yStep?rCase-st:rCase;
  return rCase};
 const points=from=>{const out=[];
  if(side==='stepped'){
   if(from<yStep){out.push(V(rCase-st,yStep-.1),V(rCase-st+.05,yStep),V(rCase-.1,yStep),V(rCase,yStep+.1))}
   out.push(V(rCase,y1));return out}
  const n=side==='straight'?1:12;
  for(let i=1;i<=n;i++){const y=from+(y1-from)*i/n;out.push(V(radiusAt(y),y))}
  return out};
 return{side,y0,y1,rTop:radiusAt(y1),rMax:rCase,radiusAt,points,yStep:side==='stepped'?yStep:null}}

/* Profiles, each a separate lathe so a hard machined edge stays hard: a single
   lathe averages normals across every joint and would round them all off. */
export function headProfiles(d){
 const H=headHeights(d),Rr=headRadii(d),arch=caseOf(d);
 const{rCase,rSeat,rBezOut,rBezIn,dialR,rGripIn,rInCham}=Rr;
 const cham=rCase-rSeat;                          /* 45 degree case chamfer */
 const e=Math.min(.35,(H.seat-H.back)*.08);        /* edge break on the flank */
 const P={};

 /* an exhibition back is a ring around a sapphire window, its bore facing in and
    running up to the movement */
 const back0=arch.caseback==='exhibition'?[V(rCase*CASEBACK_WINDOW,H.back),V(rCase*CASEBACK_WINDOW,0)]:[V(0,0)];
 P.caseback=[...back0,V(rCase*.80,0)];
 /* its rounded rim, polished apart from the turned centre */
 P.casebackRim=[V(rCase*.80,0),...round(V(rCase*.80,0),V(rCase*.88,0),V(rCase*.88,H.back*.6),4),
  V(rCase*.88,H.back*.6),V(rCase*.92,H.back)];

 /* mid-case flank: tucks in under the caseback, rises to the chamfer along the
    case's side profile (bandOf) */
 const B=bandOf(d,H,Rr),rb=B.radiusAt(B.y0);
 P.flank=[V(rCase*.92,H.back),V(rb-e,H.back),...round(V(rb-e,H.back),V(rb,H.back),V(B.radiusAt(H.back+e),H.back+e)),...B.points(H.back+e)];
 P.chamfer=[V(B.rTop,B.y1),V(rSeat,H.seat)];
 P.seat=[V(rSeat,H.seat),V(rBezOut*.985,H.seat)];

 /* bezel: flank, then a top face that is flat for an insert and crowned for a
    dress bezel, then the inner chamfer dropping to the crystal */
 const bh=H.bezelTop-H.seat,eb=Math.min(.3,bh*.28);
 P.bezelFlank=[V(rBezOut,H.seat),V(rBezOut,H.bezelTop-eb)];
 /* the rounded edge between flank and top, polished (materials.js zoneFinish) */
 P.bezelEdge=[V(rBezOut,H.bezelTop-eb),...round(V(rBezOut,H.bezelTop-eb),V(rBezOut,H.bezelTop),V(rBezOut-eb,H.bezelTop)),V(rBezOut-eb,H.bezelTop)];
 /* the top runs on from the edge; a grip ring's flat lies between them */
 const grip=rGripIn<rBezOut-eb-1e-6?[V(rBezOut-eb,H.bezelTop)]:[];
 /* an insert, or an engraved tachymeter scale, needs a flat face to sit on */
 if(Rr.rotating||d.parts.bezel.variant==='tachy')P.bezelTop=[...grip,V(rGripIn,H.bezelTop),V(rInCham,H.bezelTop)];
 else{const crown=bh*.18,mid=(rGripIn+rInCham)/2;
  P.bezelTop=[...grip,V(rGripIn,H.bezelTop),...round(V(rGripIn,H.bezelTop),V(mid,H.bezelTop+crown*1.6),V(rInCham,H.bezelTop),8),V(rInCham,H.bezelTop)]}
 const innerDrop=Math.min(bh*.45,(rInCham-rBezIn)*1.6);
 P.bezelInner=[V(rInCham,H.bezelTop),V(rBezIn,H.bezelTop-innerDrop)];

 /* rehaut: the flange falling from under the bezel's inner edge to the dial */
 P.rehaut=[V(rBezIn,H.bezelTop-innerDrop),V(dialR,H.dial)];

 const crystal=crystalSolid(H,Rr,arch,H.bezelTop-innerDrop*.7);
 P.crystal=crystal.outer;
 return{profiles:P,heights:H,radii:Rr,crystal}}

/* The crystal as a solid of sapphire, seated on its gasket at c0 just inside
   the bezel's inner edge. Its top is flat with a ground bevel, a domed cap, or
   a box crystal's tall wall rounded over. Its underside clears the hands
   (HAND_STACK_MM). Outside the dial's edge a rim steps down to the seat, the
   rebate a crystal is cut with, so there is no gap under it at the bezel.
   Every face is its own lathe, so the bevel and the rim keep hard edges; each
   runs so its lathe's normals face out of the solid. `outer` runs from the
   seat to the apex. */
function crystalSolid(H,Rr,arch,c0){const a=Rr.rBezIn,h=H.top-c0,shape=arch.crystal;
 const clear=H.dial+HAND_STACK_MM+HAND_CLEAR_MM,t=CRYSTAL_T_MM[shape]??1;
 const clearAt=x=>H.dial+handsTopAt(x)+HAND_CLEAR_MM;
 const rStep=Math.max(Rr.dialR*.985,a-1.1);
 const faces=[];let outer,under;
 if(shape==='dome'){
  /* an edge standing a little proud of the bezel, then a spherical cap from
     its top to the apex: a dome's rim is where the glass is thickest over the
     hands' tips, so it is never sunk into the bezel */
  const e=H.bezelTop-c0+Math.min(.3,(H.top-H.bezelTop)*.3),hh=H.top-(c0+e),Rs=(a*a+hh*hh)/(2*hh),yc=H.top-Rs,n=32;
  const cap=[];for(let i=0;i<=n;i++){const x=a*(1-i/n);cap.push(V(x,yc+Math.sqrt(Math.max(0,Rs*Rs-x*x))))}
  cap[n]=V(0,H.top);
  faces.push([V(a,c0),V(a,c0+e)],[V(a,c0+e),...cap.slice(1)]);
  outer=[V(a,c0),V(a,c0+e),...cap.slice(1)];
  /* the inside is the same sphere, a shell's thickness smaller, never lower than the hands allow */
  const Ri=Rs-t;under=x=>Math.max(clearAt(x),x<Ri?yc+Math.sqrt(Ri*Ri-x*x):-1e9)}
 else{
  /* a flat crystal's edge is ground to a 45 degree bevel; a box crystal's is rounded over */
  const k=shape==='box'?Math.min(.5,h*.25):Math.min(.25,h*.3);
  const edge=shape==='box'?[V(a,H.top-k),...round(V(a,H.top-k),V(a,H.top),V(a-k,H.top)),V(a-k,H.top)]:[V(a,H.top-k),V(a-k,H.top)];
  faces.push([V(a,c0),V(a,H.top-k)],edge,[V(a-k,H.top),V(0,H.top)]);
  outer=[V(a,c0),...edge,V(0,H.top)];
  const yU=Math.max(H.top-t,clear);under=()=>yU}
 /* the underside, from the axis out to the rebate; then down (or up) to the seat, and out to the rim */
 const n=shape==='dome'?48:1,inner=[];for(let i=0;i<=n;i++){const x=rStep*i/n;inner.push(V(x,under(x)))}
 faces.push(inner,[V(rStep,under(rStep)),V(rStep,c0)],[V(rStep,c0),V(a,c0)]);
 return{outer,faces,c0,rim:a,rStep,under,thickness:H.top-under(0),clear}}

export const lathe=(points,segments=160)=>new LatheGeometry(points,segments);

/* ---------------------------------------------------------------------------
   The parts that are not solids of revolution: lugs, crown and strap, in mm.
--------------------------------------------------------------------------- */

const shapeOf=pts=>{const s=new Shape();pts.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));return s};
export const smoothstep=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};

/* The lugs' plan and heights, in mm (built as solids by casebody.js). A lug's
   inner face stands LUG_CLEAR_MM off the strap's edge, so the gap between a
   pair of lugs is the lug width the watch is sold by; its tip lands on the
   lug-to-lug. `shapes` are the plan outlines as (x, -z) Shapes. `top` and
   `bottom` are the lug's heights clear of the case, before the drop toward
   the tip; `topCase` is where its top leaves the chamfer. */
export function lugParts(d){
 const g=geoOf(d),H=headHeights(d),arch=caseOf(d),sport=d.parts.case.variant==='sport';
 const R=g.R/PX,sw=g.sw/PX,lugW=R*(sport?.17:.135),tip=(g.R+g.lugExt)/PX;
 const wt=lugW*1.1,xi=sw/2+LUG_CLEAR_MM,xo=xi+wt,xc=(xi+xo)/2,rf=Math.min(1.6,R*.07);
 const cham=(g.rCase-g.rSeat)/PX;
 const top=H.seat-cham-.15,bottom=H.back+(H.seat-H.back)*.38;
 const tipR=wt/2,sIn=R*.42,shapes=[];
 const outline=[[xi,sIn],[xi,tip-tipR]];
 for(let i=1;i<=12;i++){const a=Math.PI-i/12*Math.PI;outline.push([xc+tipR*Math.cos(a),tip-tipR+tipR*Math.sin(a)])}
 outline.push([xo,sIn]);
 for(const sy of[-1,1])for(const sx of[-1,1])shapes.push(shapeOf(outline.map(([x,s])=>[sx*x,-sy*s])));
 return{shapes,top,bottom,thick:top-bottom,drop:arch.lugDrop,
  /* where the drop starts and where it is complete, in mm from the centre */
  z0:R*.9,z1:tip,
  /* spring bar: near the tip, through the lug */
  springZ:springBarMm(d),
  plan:{xi,xo,xc,wt,rf,tip,lugW},
  heights:{top,bottom,topCase:H.seat-cham*.45,bandBottom:H.back+(H.seat-H.back)*.24,
   /* an integrated shoulder carries the case top on out, falling only a little */
   shoulderTop:H.seat-cham*.45-Math.min(arch.lugDrop,.5)}}}

/* Crown and pushers along their own axis (+x before the bearing is applied) */
export function crownParts(d){
 const g=geoOf(d),H=headHeights(d),sc=d.parts.crown.variant==='oversized'?1.22:1;
 /* measured from where the case's outline reaches along the crown's bearing */
 const R=g.R/PX+caseReachMm(d,crownAng(d)),cr=g.crownR/PX,rb=cr*sc,L=cr*1.5*sc;
 const x0=R-cr*.45,x1=R+cr*.30;                  /* tube: from inside the band to the barrel */
 const e=Math.min(.35,rb*.14);
 return{axisY:H.back+(H.seat-H.back)*.5,bearing:crownAng(d),
  tube:{r:rb*.19,x0,x1},barrelX:x1,
  /* barrel as lathe pieces around its own axis (radius, distance along axis) */
  inner:[V(rb*.19,0),V(rb-e,0),...round(V(rb-e,0),V(rb,0),V(rb,e)),V(rb,e)],
  side:[V(rb,e),V(rb,L-e*1.4)],
  end:[V(rb,L-e*1.4),V(rb-e*1.4,L),...round(V(rb-e*1.4,L),V(rb*.55,L+e*.5),V(0,L+e*.35),6),V(0,L+e*.35)],
  teeth:Math.max(18,Math.round(rb*2*Math.PI/.55)),
  pushers:d.case&&caseOf(d).pushers?[-30,30].map(off=>{const b=crownAng(d)+off,Rp=g.R/PX+caseReachMm(d,b);return{bearing:b,
   shoulder:{r:cr*.86*.3,x0:Rp-cr*.18,x1:Rp+cr*.16},
   head:{r:cr*.86*.5,x0:Rp+cr*.12,len:cr*.52}}}):[]}}

/* The strap's centreline, from the spring bar outward: a first bend down and
   away, a second back to level, then lying flat on the table — a watch resting
   on its strap. Returns positions along arc length s (mm past the spring bar)
   in the strap's own (along, up) plane; `dir` is -1 toward 12, +1 toward 6. */
export function strapPath(d){
 const lp=lugParts(d),v=d.parts.strap.variant;
 const T=v==='nato'?1.3:v==='steel'?3.4:v==='rubber'?3.6:v==='mesh'?2.2:3.1;
 const lugDropAtBar=lp.drop*smoothstep(lp.z0,lp.z1,lp.springZ);
 /* centreline at the spring bar; an integrated case's strap or bracelet comes
    out of the shoulder's end flush with its top */
 const integrated=caseOf(d).lugs==='integrated';
 /* how far a strap's top stands above its centreline where it leaves the case, as
    a share of T (its crown and padding; measured off the built straps) */
 const TOP={steel:.48,rubber:.69,leather:.86,nato:.5,mesh:.55}[v]??.6;
 const y0=integrated?lp.heights.shoulderTop-.05-T*TOP:lp.bottom-lugDropAtBar+lp.thick*.42-T/2;
 const r1=16,r2=12,th=55*Math.PI/180;
 /* an integrated bracelet leaves the case level, as its first link, before it bends */
 const lead=integrated?7:0;
 const s1=r1*th,s2=s1+r2*th;
 const pos=s0=>{const s=s0-lead;
  if(s<=0)return[s0,y0,0];
  if(s<=s1){const a=s/r1;return[lead+r1*Math.sin(a),y0-r1*(1-Math.cos(a)),-a]}
  const zA=r1*Math.sin(th),yA=y0-r1*(1-Math.cos(th));
  if(s<=s2){const a=th-(s-s1)/r2;                   /* unwinding back to level */
   return[lead+zA+r2*(Math.sin(th)-Math.sin(a)),yA-r2*(Math.cos(a)-Math.cos(th)),-a]}
  const zB=zA+r2*Math.sin(th),yB=yA-r2*(1-Math.cos(th));
  return[lead+zB+(s-s2),yB,0]};
 const groundY=pos(lead+s2+1)[1]-T/2;
 return{T,start:lp.springZ,pos,groundY,width:strapMmOf(d)}}
