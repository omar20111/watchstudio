/* Geometry: horological proportions, frames and canvas hit-testing.

   The radial construction stack, outside in — every renderer works from these
   so components meet at shared radii instead of guessing and overlapping:

     rCase    case band at its widest (the sliver you see outside the bezel)
     rSeat    top of the case band / bezel seat — rCase..rSeat is the case chamfer
     rBezOut  bezel outer edge
     rBezIn   bezel inner edge, where the crystal starts
     rRehaut  = dialR — the flange runs rBezIn..dialR at an angle
     dialR    dial face (deliberately unchanged from v3 so markers, hands and
              dial text keep their existing positions on saved projects)
*/
import {C,CAN,PX} from './constants.js';
import {clamp} from './utils.js';

const num=(v,fallback)=>v==null||v==='auto'||!isFinite(+v)?fallback:+v;

export const strapMmOf=d=>d.strapMm!=='auto'?+d.strapMm:(d.caseMm<=38?18:d.caseMm<=41?20:22);
export const caseThickOf=d=>caseOf(d).thickness;
export const lugToLugOf=d=>lugToLugMm(d);
export const crownMmOf=d=>num(d.crownMm,+((+d.caseMm||40)*0.165).toFixed(1));
export const crystalMmOf=d=>caseOf(d).crystalMm;

/* resolved bezel and rehaut widths in mm — the sliders and the sheet both need
   these and they are derived, not stored */
export const bezelMmOf=d=>+((geoOf(d).rBezOut-geoOf(d).rBezIn)/PX).toFixed(2);
export const rehautMmOf=d=>+(geoOf(d).rehautW/PX).toFixed(2);
/* the width the clamp in geoOf will actually honour, so the slider can't offer
   values it will silently refuse */
export const bezelRangeOf=d=>{const g=geoOf(d),span=g.rBezOut-g.dialR;
 /* rounded inward: a max that rounds up sits above geoOf's clamp and the thumb
    springs back off the end of the track */
 return[Math.ceil(span*0.34/PX*10)/10,Math.floor(span*0.88/PX*10)/10]};
/* the largest lug-to-lug whose tips still fit the sheet, so the slider cannot
   offer a value the geometry will silently clamp away */
export const lugToLugMaxOf=d=>{const R=d.caseMm*PX/2;
 return Math.min(d.caseMm*1.5,(R+(CAN-C-R-8))*2/PX)};


/* ==================== CASE ARCHITECTURE (mm truth) ====================
   A watch is a volume. Every number here is real millimetres and every one
   feeds BOTH the profile camera and the spec sheet, so the drawing and the
   paperwork can never disagree.

   thickness = caseback + mid-band + movement + dial + bezel + crystal, and
   the stack sums to the requested thickness exactly (asserted at boot).
   Lug-to-lug is derived from lug length, not from an R*0.26 fudge.
==================================================================== */
export const DEF_CASE=()=>({
 thicknessMm:12,      /* total case height, caseback -> crystal apex */
 lugLenMm:6.5,        /* case edge -> spring-bar hole */
 lugDropMm:2.5,       /* how far the spring bar sits below the caseback plane */
 crystalMm:1.6,       /* crystal standing proud of the bezel plane */
 crystal:'dome',      /* flat | dome | box */
 caseback:'solid',    /* solid | exhibition | engraved */
 wrM:100,             /* water resistance is a parameter, not dial text */
 movement:'automatic',/* automatic | manual | quartz | spring */
 pushers:false,       /* chrono pushers at 2h and 4h */
 crownPos:'3',        /* 3 | 430 */
 engraving:'WATCHSTUDIO'});

const mmOf=(v,lo,hi,fb)=>{const n=+v;return Number.isFinite(n)?clamp(n,lo,hi):fb};

/* The shortest lug the front view can draw: geoOf never lets a horn stand less
   than R*0.1 proud of the case. Below this the drawing used the floor while the
   spec sheet reported the shorter lug, so the two disagreed. Clamping here keeps
   caseOf, the lug-to-lug figure and the slider on the number that is drawn.
   exposed = lugLen*0.55*PX >= caseMm*PX/2*0.1  ->  lugLen >= caseMm/11 */
export const lugLenMinOf=caseMm=>Math.max(3,Math.ceil((+caseMm||40)/11*10)/10);

/* thinnest mid-band a real case can have and still hold a movement */
export const MIN_BAND_MM=0.8;

/* the fixed contributions to the stack, from the requested parameters */
export function stackParts(c,bezelVariant){
 const bezel=bezelVariant==='diver'?2.2:bezelVariant==='fluted'?1.8:bezelVariant==='gmt'?2.0:1.3;
 const crystal=c.crystalMm, dial=0.4;
 const movement=c.movement==='quartz'?2.4:c.movement==='manual'?3.2:c.movement==='spring'?4.2:4.6;
 const caseback=c.caseback==='exhibition'?1.5:1.0;
 const fixed=caseback+movement+dial+bezel+crystal;
 return{bezel,crystal,dial,movement,caseback,fixed,min:Math.round((fixed+MIN_BAND_MM)*10)/10}}

/* Resolved case architecture. If the requested thickness cannot physically
   hold the chosen movement, crystal, bezel and caseback, it is raised to the
   feasible minimum and `feasible` says so — we never draw an impossible watch. */
export function caseOf(d){
 const c0=d.case||{},mm=+d.caseMm||40;
 const bezelVariant=(d.parts&&d.parts.bezel&&d.parts.bezel.variant)||'smooth';
 const div=bezelVariant==='diver';
 const defT=clamp(Math.round((mm*0.29+(div?1.4:0))*2)/2,8,18);
 const crystal=['flat','dome','box'].includes(c0.crystal)?c0.crystal:'dome';
 const crys=crystal==='flat'?mmOf(c0.crystalMm,0.6,2.5,1.1)
  :crystal==='box'?mmOf(c0.crystalMm,2,5,3.0)
  :mmOf(c0.crystalMm,0.8,4,1.6);
 const req={crystal,crystalMm:crys,
  caseback:['solid','exhibition','engraved'].includes(c0.caseback)?c0.caseback:'solid',
  movement:['automatic','manual','quartz','spring'].includes(c0.movement)?c0.movement:'automatic'};
 const sp=stackParts(req,bezelVariant);
 const requested=mmOf(c0.thicknessMm,6,20,defT);
 const thickness=Math.max(requested,sp.min);
 return{thickness,requested,minThickness:sp.min,feasible:requested>=sp.min-1e-9,
  crystal,crystalMm:crys,caseback:req.caseback,movement:req.movement,
  wrM:[30,50,100,200,300,500,1000].includes(+c0.wrM)?+c0.wrM:100,
  lugLen:mmOf(c0.lugLenMm,lugLenMinOf(mm),12,clamp(mm*0.16,5,8)),
  lugDrop:mmOf(c0.lugDropMm,0,6,2.5),
  pushers:!!c0.pushers,
  crownPos:c0.crownPos==='430'?'430':'3',
  engraving:c0.engraving==null?'WATCHSTUDIO':String(c0.engraving).slice(0,24)}}

/* The thickness stack in mm. Sums to caseOf(d).thickness exactly — the
   mid-band absorbs the remainder and can never fall below MIN_BAND_MM,
   because caseOf() refuses an impossible thickness in the first place. */
export function thicknessStack(d){
 const c=caseOf(d);
 const sp=stackParts(c,(d.parts&&d.parts.bezel&&d.parts.bezel.variant)||'smooth');
 const band=Math.round((c.thickness-sp.fixed)*100)/100;
 return{caseback:sp.caseback,band,movement:sp.movement,dial:sp.dial,bezel:sp.bezel,crystal:sp.crystal,
  total:Math.round((sp.caseback+band+sp.movement+sp.dial+sp.bezel+sp.crystal)*100)/100,
  minThickness:c.minThickness,feasible:c.feasible}}

/* lug-to-lug: case diameter + 2 x the exposed part of each lug. Lugs start
   inside the case silhouette, so 45% of the lug length is buried in the wall. */
export function lugToLugMm(d){
 const c=caseOf(d);
 return Math.round((( +d.caseMm||40)+2*(c.lugLen*0.55))*10)/10}

export const lugWidthMm=d=>strapMmOf(d);
/* crown bearing in degrees clockwise from 12 (3h = 90, 4:30 = 135) */
export const crownAng=d=>caseOf(d).crownPos==='430'?135:90;

/* ==================== ROTATING BEZEL (pure) ====================
   A diver insert clicks. `detents` is clicks per revolution; the pip sits at
   0 deg of the insert and elapsed time reads pip -> minute hand, clockwise. */
export function detentOf(d){
 const b=d.parts.bezel,want=+b.detents;
 if(b.variant==='gmt')return [24,120].includes(want)?want:120;
 if(b.variant==='diver')return [60,120].includes(want)?want:120;
 return 0}                                   /* smooth/fluted/tachy: fixed */
export const detentStep=n=>n>0?360/n:0;
export const bezelRotatable=d=>{const b=d.parts.bezel;
 if(b.variant!=='diver'&&b.variant!=='gmt')return false;
 return !(d.active&&d.active.bezel)};        /* a custom upload has no insert to spin */
export const bezelRotOf=d=>(((+d.parts.bezel.rot||0)%360)+360)%360;
export function snapDetent(deg,n){
 if(!(n>0))return ((deg%360)+360)%360;
 const step=360/n;
 return ((Math.round(deg/step)*step)%360+360)%360}
/* minutes elapsed since the pip was lined up with the minute hand */
export const bezelElapsedMin=(minHandDeg,rotDeg)=>((((minHandDeg-rotDeg)%360)+360)%360)/6;
/* where a GMT hand at gmtDeg reads on a 24h insert rotated by rot */
export function gmtReadHours(gmtDeg,rotDeg){
 const h=(((( gmtDeg-rotDeg)%360)+360)%360)/15,hours=Math.floor(h);
 /* floor, not round: at 13:09.6 the hand has not reached :10 yet */
 return{hours,minutes:Math.floor((h-hours)*60+1e-9),decimal:h}}

export function geoOf(d){
 const R=d.caseMm*PX/2, sw=strapMmOf(d)*PX;
 const dialR=R*0.78;
 /* Thickness is visible from above: a thick case shows more of its flank as the
    band curves away, a thin one barely any. The auto default reproduces the
    fixed 0.955/0.948 the stack used before, so saved projects are unchanged. */
 const bandFrac=clamp(0.028+(caseThickOf(d)/d.caseMm)*0.06,0.025,0.085);
 const rCase=R, rSeat=R*(1-bandFrac), rBezOut=rSeat-R*0.007;
 const span=rBezOut-dialR;                                   /* bezel + rehaut share this */
 /* a rotating bezel carries an insert with printing on it, so it needs more of
    the face than a plain dress bezel does */
 const rot=d.parts&&d.parts.bezel&&(d.parts.bezel.variant==='diver'||d.parts.bezel.variant==='gmt');
 const bezelW=clamp(num(d.bezelMm,null)==null?span*(rot?0.80:0.68):d.bezelMm*PX,span*0.34,span*0.88);
 const rBezIn=rBezOut-bezelW;
 const rehautW=rBezIn-dialR;
  return{R,sw,dialR,rCase,rSeat,rBezOut,rBezIn,rehautW,
  /* lug tips have to stay on the sheet too — the lug-to-lug slider's top end
     otherwise pushes them past the 1200 px edge on a large case */
  lugExt:clamp(lugToLugOf(d)*PX/2-R,R*0.1,CAN-C-R-8),
  /* the crown must stay on the sheet: an oversized barrel reaches
     C + R + crownR*(0.30 + 1.5*1.22), which overflows at the top of both the
     case-diameter and crown-diameter sliders */
  crownR:Math.min(crownMmOf(d)*PX/2,Math.max(PX,(CAN-C-R-10)/2.13)),
  crystalH:crystalMmOf(d)*PX,
  crystalR:rBezIn+PX*0.1};
}

export const posAt=(deg,r)=>[C+r*Math.sin(deg*Math.PI/180),C-r*Math.cos(deg*Math.PI/180)];

/* crown grows with the 'oversized' variant — shared by its frame, hit-box and selection guide */
const crownScale=d=>d.parts.crown.variant==='oversized'?1.22:1;  /* must match crown.js */

/* bounding frame used for upload auto-fit + thumbnails */
export function frameBox(part,d){const g=geoOf(d);switch(part){
 case'strap':return[C-g.sw/2-10,C+g.R+10,g.sw+20,g.sw*1.1];
 /* the case paints out to the lug tips, so its frame has to include them or
    uploads auto-fit to the wrong box and thumbnails crop the horns off */
 case'case':{const r=g.R+g.lugExt+14;return[C-r,C-r,2*r,2*r]}
 case'crown':{const cb=crownBox(d);return[cb.x,cb.y,cb.w,cb.h]}
 case'bezel':{const r=g.rBezOut;return[C-r,C-r,2*r,2*r]}
 case'crystal':{const r=g.crystalR;return[C-r,C-r,2*r,2*r]}
 default:{const r=g.dialR;return[C-r,C-r,2*r,2*r]}}}

/* dashed selection-guide shapes for the stage overlay */
export function frames(sel,d){const g=geoOf(d),r=g.R;switch(sel){
 case'strap':return[{t:'r',x:C-g.sw/2-8,y:28,w:g.sw+16,h:C-g.R-40},{t:'r',x:C-g.sw/2-8,y:C+g.R+12,w:g.sw+16,h:CAN-28-(C+g.R+12)}];
 case'case':return[{t:'c',r:r+10}];
 case'crown':{const b=crownBox(d);return[{t:'r',x:b.x+3,y:b.y+3,w:b.w-6,h:b.h-6}]}
 case'bezel':return[{t:'c',r:g.rBezOut},{t:'c',r:g.rBezIn}];
 case'dial':return[{t:'c',r:g.dialR}];
 case'markers':return[{t:'c',r:g.dialR*0.92}];
 case'hands':return[{t:'c',r:g.dialR*0.95}];
 case'crystal':return[{t:'c',r:g.crystalR}];
 default:return[]}}

/* hit-test shapes (account for each part's current transform) */
export function crownBox(d){const g=geoOf(d);const sc=crownScale(d);
 const h=g.crownR*2*sc+16,w=g.crownR*(1.5*sc+0.75)+16;
 return{x:C+g.R-g.crownR*0.45-8,y:C-h/2,w,h}}
export function strapBoxes(d){const g=geoOf(d);const w=g.sw;
 return[{x:C-w/2-6,y:28,w:w+12,h:C-g.R*0.55-28},{x:C-w/2-6,y:C+g.R*0.55,w:w+12,h:CAN-46-(C+g.R*0.55)}]}

export function pickPart(px,py,d,sel){const g=geoOf(d),P=d.parts;
 const base=part=>part==='hands'?P.hands.tH:P[part].t;
 /* the crown is drawn at its bearing, so the hit box has to be tested in the
    same rotated frame — otherwise a 4:30 crown is clickable at 3 o'clock */
 {const tt=base('crown'),cb=crownBox(d),bearing=(crownAng(d)-90)*Math.PI/180;
  let qx=px-tt.x-C,qy=py-tt.y-C;
  if(bearing){const cs=Math.cos(-bearing),sn=Math.sin(-bearing);
   const rx=qx*cs-qy*sn,ry=qx*sn+qy*cs;qx=rx;qy=ry}
  const hx=qx+C,hy=qy+C;
  if(hx>=cb.x&&hx<=cb.x+cb.w&&hy>=cb.y&&hy<=cb.y+cb.h)return'crown'}
 {const fam=['dial','markers','hands','crystal'].includes(sel)?sel:'dial';const q=base(fam);
  if(Math.hypot(px-(C+q.x),py-(C+q.y))<=g.dialR*q.s)return fam}
 {const q=base('bezel');const dz=Math.hypot(px-(C+q.x),py-(C+q.y));
  if(dz<=g.rBezOut*q.s&&dz>g.dialR*q.s)return'bezel'}
 {const q=base('case');if(Math.hypot(px-(C+q.x),py-(C+q.y))<=g.R*q.s)return'case';
  /* the lug horns are part of the case and sit outside its circle */
  const lw=g.R*0.17*2.0;
  for(const sx of[-1,1])for(const sy of[-1,1]){
   const cx=C+sx*(g.sw*0.5+g.R*0.17*0.95)+q.x,cy=C+sy*(g.R*0.72)+q.y;
   if(Math.abs(px-cx)<=lw*q.s&&Math.abs(py-cy)<=(g.R*0.3+g.lugExt)*q.s)return'case'}}
 {const q=base('strap');for(const b of strapBoxes(d))
  if(px>=b.x+q.x&&px<=b.x+q.x+b.w&&py>=b.y+q.y&&py<=b.y+q.y+b.h)return'strap'}
 return null}
