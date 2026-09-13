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
 engraving:'WATCHSTUDIO',
 wear:'light'});       /* new | light | worn — scratches and haze on the exposed metal */

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
 const bezel=bezelVariant==='diver'?2.2:bezelVariant==='fluted'?1.8:bezelVariant==='gmt'?2.0:bezelVariant==='coin'?1.6:1.3;
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
  engraving:c0.engraving==null?'WATCHSTUDIO':String(c0.engraving).slice(0,24),
  wear:['new','light','worn'].includes(c0.wear)?c0.wear:'light'}}

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

/* ==================== DIAL FURNITURE & HANDS ====================
   Where the dial's rings are, in dial radii, and how long each hand is — the
   dial, the markers and the hands all read these, so a hand can be set by what
   it points at.

   The minute track's ticks run inward from MINUTE_TRACK_R, 16 px at the fives
   and 9 px between. Every marker style ends on INDEX_OUTER and runs inward by
   its depth (markers.js). Hands follow the watchmaker's rule: the seconds hand
   reaches the outer end of the track, the minute hand reaches into it, and the
   hour hand reaches the inner end of the hour markers — never longer than four
   fifths of the minute hand, so the two stay distinct over short markers. */
export const MINUTE_TRACK_R=.965;
export const TRACK_TICK_PX={major:16,minor:9};
export const INDEX_OUTER=.885;
/* radial depth of each marker style; numerals by their typical glyph height */
export const INDEX_DEPTH={batons:.17,wedges:.17,minimal:.075,dots:.104,roman:.145,arabic:.145,eastern:.145};
/* the hands' widths and shapes are drawn to these reference lengths, so a
   hand that grows longer does not also grow fatter */
export const HAND_REF={hour:.55,min:.8,sec:.9};
export function handLengthsOf(d){const r=geoOf(d).dialR,v=(d.parts.markers||{}).variant;
 const sec=MINUTE_TRACK_R-2/r;
 const min=MINUTE_TRACK_R-TRACK_TICK_PX.minor*.6/r;
 const inner=INDEX_OUTER-(INDEX_DEPTH[v]??INDEX_DEPTH.batons);
 const hour=Math.min(Math.max(inner+.012,.6),min*.8);
 return{hour,min,sec}}

/* ==================== STRAP ENDS ====================
   How a 3D strap ends, shared by its flat bake and its mesh so the painted
   edges and stitching follow the outline the mesh is cut to. The 6 o'clock
   strap narrows to a rounded tail carrying the holes; the 12 o'clock strap is
   squared off where it folds round the buckle, its corners rounded.
   strapEndFactor scales the strap's width `toTip` mm short of its end. */
export const STRAP_TAIL_MM=12, STRAP_END_ROUND_MM=1.6;
/* the holes, as mm short of the tip of the 6 o'clock strap */
export const STRAP_HOLES_MM=[20,26.5,33,39.5,46];
export function strapEndFactor(which,toTip){
 const ell=(t,len)=>{const u=1-Math.max(0,t)/len;return Math.sqrt(Math.max(0,1-u*u))};
 if(which==='bottom')return toTip>=STRAP_TAIL_MM?1:ell(toTip,STRAP_TAIL_MM);
 return toTip>=STRAP_END_ROUND_MM?1:.8+.2*ell(toTip,STRAP_END_ROUND_MM)}

/* ==================== STRAP LENGTHS ====================
   A two-piece strap is sold by the length of each piece from the spring bar:
   on a 20 mm strap about 75 mm for the buckle piece, buckle included, and
   115-120 mm for the piece with the holes, which is what reaches round the
   wrist. Narrower straps are cut a little shorter, wider ones longer. The
   spring bar sits in the lug near its tip. */
export const strapTaperEnd=.86;                   /* the strap's width at its ends, of the lug width */
export function springBarMm(d){const g=geoOf(d),lugW=g.R*(d.parts.case.variant==='sport'?.17:.135);
 return(g.R+g.lugExt-lugW*.85)/PX}
/* a tongue buckle's frame around a strap end of half-width `a` mm: its wire,
   its length along the strap, and how far it reaches past the strap's fold */
export function buckleOf(a){const wire=Math.min(2.2,Math.max(1.5,a*.19)),L=Math.max(13,a*1.5);
 return{wire,L,reach:L-1.2*wire}}
export function strapLengthsOf(d){const w=strapMmOf(d);
 const short=clamp(55+w,66,80),long=clamp(78+2*w,100,128);
 const buckle=buckleOf(w*strapTaperEnd/2).reach;
 /* the strap pieces themselves, past the spring bar: the buckle piece's
    leather ends at the fold, the buckle frame carries on past it */
 return{top:short-buckle,bottom:long,short,long,buckle}}
/* the sheet pixel, from the centre, where each piece ends */
export const strapReachPx=(d,which)=>(springBarMm(d)+strapLengthsOf(d)[which])*PX;

/* ==================== DIAL CONSTRUCTION ====================
   The dial plate's layout in sheet px, read by the 2D dial and markers, the 3D
   plate, and the checks — so a date window cut into the 3D plate sits exactly
   where the 2D dial draws it and where the index it replaces used to be.

   stepped   the centre of the plate is sunk below a chapter ring carrying the
             minute track; the step sits between the indices and the track
   subdials  a chronograph's registers, milled into the plate
   win       the date window: an upright aperture onto a date wheel below */
export const DATE_POSITIONS=['none','3','430','6'];
export const DIAL_STEP_MM=.18;          /* depth of the sunk centre below the chapter ring */
export const SUBDIAL_DEPTH_MM=.28;      /* depth of a register below the plate */

export function dialLayoutOf(d){
 const r=geoOf(d).dialR,P=(d.parts&&d.parts.dial)||{},chrono=P.variant==='chrono';
 let date=DATE_POSITIONS.includes(P.date)?P.date:'none';
 /* a chronograph's 6 o'clock register and model line leave no room at 6 */
 if(chrono&&date==='6')date='430';
 const stepped=P.step==='stepped';
 const subdials=chrono?[[90,'smallsec'],[180,'chHr'],[270,'chMin']].map(([deg,key])=>{
  const[x,y]=posAt(deg,r*.45);return{deg,key,x,y,r:r*.2}}):[];
 let win=null;
 if(date!=='none'){const deg={'3':90,'430':135,'6':180}[date];
  /* centred where the index was, pulled in at 4:30 so the corners of an upright
     window clear the step */
  const at=date==='430'?.75:.77;
  const[x,y]=posAt(deg,r*at);
  /* The wheel's days are 360/31 deg apart, about 0.156 r at this radius. The
     window must stay narrower than that across the wheel's direction of travel,
     or the neighbouring days show at its edges: at 3 that direction is the
     window's height, at 6 its width, at 4:30 both. A chronograph's window at 3
     is also narrower radially, to fit between its register and the track. */
  const[ww,wh]=date==='3'?[chrono?.18:.22,.165]:date==='6'?[.155,.14]:[.145,.12];
  win={deg,x,y,w:r*ww,h:r*wh,rad:r*.028,frame:r*.012,skipHour:date==='3'?3:date==='6'?6:null}}
 return{r,chrono,stepped,stepR:r*.915,subdials,date,win}}

/* the day the date wheel shows: the set date for a posed design, today otherwise */
export function dialDayOf(d,nowMs=Date.now()){const t=d.time||{},now=new Date(nowMs);
 if(t.mode!=='set')return now.getDate();
 const last=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
 return Math.min(clamp(Math.round(+t.date||1),1,31),last)}

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
 /* swung to the crown's bearing, so a 4:30 crown is outlined at 4:30 */
 case'crown':{const b=crownBox(d);return[{t:'r',x:b.x+3,y:b.y+3,w:b.w-6,h:b.h-6,rot:crownAng(d)-90}]}
 case'bezel':return[{t:'c',r:g.rBezOut},{t:'c',r:g.rBezIn}];
 case'dial':return[{t:'c',r:g.dialR}];
 case'markers':return[{t:'c',r:g.dialR*0.92}];
 case'hands':return[{t:'c',r:g.dialR*0.95}];
 case'crystal':return[{t:'c',r:g.crystalR}];
 default:return[]}}

/* the crown's footprint at 3 o'clock, before its bearing is applied — used for
   its selection guide and upload frame. Picking is a ray into the 3D crown
   (three/watch.js pickPart3D), not a box. */
export function crownBox(d){const g=geoOf(d);const sc=crownScale(d);
 const h=g.crownR*2*sc+16,w=g.crownR*(1.5*sc+0.75)+16;
 return{x:C+g.R-g.crownR*0.45-8,y:C-h/2,w,h}}
