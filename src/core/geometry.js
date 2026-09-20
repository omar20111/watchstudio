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
import {MARKERSET_VARIANT,markerSetOf,setDepthMm} from './markerset/index.js';
import {CASE_SHAPES,BEZEL_SHAPES,shapeSpec,extentAlong,supportAlong,inscribedApothem,crossingAt,outlinePoly,insetOf} from './caseshape.js';

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
 wear:'light',        /* new | light | worn — scratches and haze on the exposed metal */
 side:'straight',      /* straight | drum | sloped | stepped — the case band's profile */
 lugs:'straight',      /* straight | twisted | hooded | integrated */
 lugHoles:false,       /* spring-bar holes drilled through the lugs */
 shape:'round',        /* round | cushion | octagon | square | tonneau — the case's outline (caseshape.js) */
 bezelShape:'round'}); /* round | octagon | square */

export const CASE_SIDES=['straight','drum','sloped','stepped'], LUG_STYLES=['straight','twisted','hooded','integrated'];
export {CASE_SHAPES,BEZEL_SHAPES};
/* An integrated case has no lugs: a short shoulder at 12 and 6, the bracelet
   (or strap) coming out from under it. Its exposed length, as a share of the
   lug length a lugged case shows. */
export const INTEGRATED_EXPOSED=.3;
/* the gap between a strap's edge and the lug beside it, mm: a pair of lugs is
   as far apart as the lug width the watch is sold by, and no further */
export const LUG_CLEAR_MM=.15;

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
  /* up to four lines of 24 (render/caseback.js engravingLines cuts each one) */
  engraving:c0.engraving==null?'WATCHSTUDIO':String(c0.engraving).slice(0,4*25),
  wear:['new','light','worn'].includes(c0.wear)?c0.wear:'light',
  side:CASE_SIDES.includes(c0.side)?c0.side:'straight',
  lugs:LUG_STYLES.includes(c0.lugs)?c0.lugs:'straight',
  lugHoles:!!c0.lugHoles,
  shape:CASE_SHAPES.includes(c0.shape)?c0.shape:'round',
  bezelShape:BEZEL_SHAPES.includes(c0.bezelShape)?c0.bezelShape:'round'}}

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

/* lug-to-lug: the case's length from 12 to 6 + 2 x the exposed part of each
   lug. Lugs start inside the case silhouette, so 45% of the lug length is
   buried in the wall. */
export function lugToLugMm(d){
 const c=caseOf(d);
 return Math.round((caseLengthMm(d)+2*(c.lugLen*(c.lugs==='integrated'?INTEGRATED_EXPOSED:.55)))*10)/10}

/* How much further than its size the case reaches toward 12 (and 6), mm: 0 for
   a round, cushion, octagon or square case, whose flats face 12; more for a
   tonneau, which is longer than it is wide, and for a pebble, whose curve
   carries it past its width. Measured as the outline's width toward 12
   (supportAlong), which on a shape not symmetric about the 12-6 axis is
   reached beside 12 rather than at it. Read from the outline alone — geoOf
   leans on the lug-to-lug, so this cannot lean on geoOf. */
export function endReachMm(d){const c=d.case||{},A0=(+d.caseMm||40)/2;
 return CASE_SHAPES.includes(c.shape)&&c.shape!=='round'?Math.max(0,supportAlong(shapeSpec(c.shape),A0,-Math.PI/2)-A0):0}
/* the case from 12 to 6, mm: its size, or a tonneau's length */
export const caseLengthMm=d=>Math.round(((+d.caseMm||40)+2*endReachMm(d))*10)/10;

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
  /* an integrated case's shoulder may stand out far less than a lug */
  lugExt:clamp(lugToLugOf(d)*PX/2-R,R*(d.case&&d.case.lugs==='integrated'?.03:0.1),CAN-C-R-8),
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
/* where the hour indices' inner ends lie, in dial radii */
export function indexInnerOf(d){const r=geoOf(d).dialR,v=(d.parts.markers||{}).variant;
 /* a PartStudio set carries its own ring and index lengths, in mm */
 const set=v===MARKERSET_VARIANT?markerSetOf(d):null;
 return set?set.ringRatio-setDepthMm(set)/(r/PX):INDEX_OUTER-(INDEX_DEPTH[v]??INDEX_DEPTH.batons)}
export function handLengthsOf(d){const r=geoOf(d).dialR;
 const sec=MINUTE_TRACK_R-2/r;
 const min=MINUTE_TRACK_R-TRACK_TICK_PX.minor*.6/r;
 const inner=indexInnerOf(d);
 const hour=Math.min(Math.max(inner+.012,.6),min*.8);
 return{hour,min,sec}}
/* how high each hand's arbor stands above the dial, mm: the hour hand rides
   clear of the tallest applied index, each hand clears the one below, and the
   seconds pinion tops the stack. The crystal's underside clears that. */
export const HAND_LIFT_MM={hour:.36,min:.66,sec:.98};
export const HAND_STACK_MM=HAND_LIFT_MM.sec+.44;
/* Away from the centre only the seconds hand's own body (.16 mm) sweeps under
   the crystal; the pinion cap on top of it is this wide. */
export const HAND_SWEEP_MM=HAND_LIFT_MM.sec+.16, SEC_CAP_R_MM=13/PX;
/* the hands' height above the dial at `x` mm from the centre */
export const handsTopAt=x=>x<SEC_CAP_R_MM+.25?HAND_STACK_MM:HAND_SWEEP_MM;

/* ==================== CRYSTAL ====================
   A sapphire crystal is a solid: a flat one about 1.1 mm thick, a dome a shell
   about 0.9 mm, a box crystal's top and walls about 1 mm. Its underside clears
   the hands by HAND_CLEAR_MM; a crystal standing low in a thin bezel is ground
   thinner there rather than touching them. */
export const SAPPHIRE_IOR=1.77, CRYSTAL_T_MM={flat:1.1,dome:.9,box:1}, HAND_CLEAR_MM=.08;
/* how far the date wheel turns below the dial plate */
export const DATE_WHEEL_DROP_MM=.45;

/* A cyclops: a plano-convex sapphire lens bonded to the crystal over the date.
   Its footprint is a rounded rectangle over the window, its top a cut from a
   sphere. The sphere is what magnifies, so its radius is chosen to magnify the
   date about 2.5x from this height, but never flatter than the footprint allows.
   It needs a flat top to sit on, so a domed crystal has none. */
export const CYCLOPS_SCALE=1.6, CYCLOPS_MAG=2.5;
export function cyclopsOf(d){const P=d.parts||{},c=caseOf(d),L=dialLayoutOf(d);
 if(!(P.crystal&&P.crystal.cyclops)||!L.win||c.crystal==='dome')return null;
 const g=geoOf(d),st=thicknessStack(d),w=L.win;
 const x=(w.x-C)/PX,z=(w.y-C)/PX,cr=Math.hypot(x,z);
 const reach=(A,B,rc)=>Math.hypot(A-rc,B-rc)+rc;  /* centre to the farthest corner */
 let A=w.w/PX*CYCLOPS_SCALE/2,B=w.h/PX*CYCLOPS_SCALE/2;
 /* it stays on the flat of the crystal, clear of the bevel at its edge */
 const room=g.rBezIn/PX-.6-cr,s=Math.min(1,room/reach(A,B,Math.min(A,B)*.45));A*=s;B*=s;
 const rc=Math.min(A,B)*.45,rho=reach(A,B,rc),wall=.2;
 /* lens base to the date wheel, through the bezel and the crystal's height; of
    that, `glass` is the crystal itself (lathe.js crystalSolid grinds a flat
    underside to clear the hands) */
 const depth=st.bezel+st.crystal+(P.dial&&P.dial.step==='stepped'?DIAL_STEP_MM:0)+DATE_WHEEL_DROP_MM;
 const n=SAPPHIRE_IOR,glass=Math.min(CRYSTAL_T_MM[c.crystal]??1,st.bezel+st.crystal-HAND_STACK_MM-HAND_CLEAR_MM);
 /* A plano-convex lens magnifies f/(f-u), u measured from its curved crown.
    Sapphire looks shallower than it is by its index, so the crystal and the
    lens's own height count 1/n of their thickness. The height depends on the
    radius chosen, so settle the two together. */
 let R=rho*1.15,height=wall,u=depth;
 for(let i=0;i<4;i++){u=depth-glass+(glass+height)/n;
  R=Math.max(u*CYCLOPS_MAG/(CYCLOPS_MAG-1)*(n-1),rho*1.15);height=R-Math.sqrt(R*R-rho*rho)+wall}
 const f=R/(n-1);u=depth-glass+(glass+height)/n;
 return{x,z,A,B,rc,rho,R,wall,height,depth,glass,mag:f/(f-u)}}

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
 /* an integrated shoulder is short: the bar sits just inside its end */
 if(caseOf(d).lugs==='integrated')return(g.R+g.lugExt)/PX-.9;
 return(g.R+g.lugExt-lugW*.85)/PX}

/* How large a shaped bezel can be on this case, mm: as large as the case top
   holds it — everywhere as far inside the case's outline as a round bezel sits
   inside a round case — and no larger than its flats at the bezel's round size.
   On a round case that puts an octagon's corners on the bezel's size; on a
   square case a square bezel's corners run out into the case's. It fits if its
   flats still clear the crystal opening. */
const fitCache=new Map();
export function bezelFit(d,kind){const g=geoOf(d),c=caseOf(d),cs=shapeSpec(c.shape),bs=shapeSpec(bezelSpecKind(kind,c));
 const cA0=g.rCase/PX,bOut=g.rBezOut/PX,bIn=g.rBezIn/PX;
 /* a bezel of the case's own shape needs no room made for it: it is the case,
    set in by the band, and a round case's is simply round */
 if(kind==='round'||(kind==='case'&&c.shape==='round'))return{A0:bOut,fits:true};
 const key=[c.shape,kind,cA0,bOut,bIn].join('|');if(fitCache.has(key))return fitCache.get(key);
 /* the bezel's outline scales with A0: the largest whose every point keeps the gap */
 const unit=outlinePoly(bs,1,0,720).map(q=>q.p),gap=cA0-bOut;
 const holds=a=>unit.every(p=>insetOf(cs,cA0,p[0]*a,p[1]*a)>=gap-1e-4);
 let A0=bOut;
 if(!holds(A0)){let lo=0,hi=bOut;for(let i=0;i<32;i++){const m=(lo+hi)/2;if(holds(m))lo=m;else hi=m}A0=lo}
 const r={A0,fits:A0>=bIn+.4};
 fitCache.set(key,r);if(fitCache.size>64)fitCache.delete(fitCache.keys().next().value);return r}

/* The case's and the bezel's outlines in mm (caseshape.js): each a spec and A0,
   how far it reaches toward 3 o'clock. A bezel shape that does not fit (bezelFit)
   is built round. `scale` maps a profile's round radius onto the outline. */
/* which outline a bezel shape draws: its own, or the case's */
const bezelSpecKind=(kind,c)=>kind==='case'?c.shape:kind;
export function outlinesOf(d){const g=geoOf(d),c=caseOf(d);
 const bf=bezelFit(d,c.bezelShape),bk=bf.fits?c.bezelShape:'round',A0=bf.fits?bf.A0:g.rBezOut/PX;
 return{case:{kind:c.shape,spec:shapeSpec(c.shape),A0:g.rCase/PX,scale:1},
  bezel:{kind:bk,spec:shapeSpec(bezelSpecKind(bk,c)),A0,scale:A0/(g.rBezOut/PX)}}}
/* A tonneau's ends are narrower than its middle. Where a pair of lugs (or an
   integrated shoulder) stands wider than the end's flat run, it sits out on the
   rounded corners: {ok, endMm: the end's width where it still faces 12, needMm}. */
const endCache=new Map();
export function lugsFitEnd(d){const O=outlinesOf(d).case,lp=strapMmOf(d)/2+LUG_CLEAR_MM;
 const sport=d.parts.case.variant==='sport',need=lp+(caseOf(d).lugs==='integrated'?Math.max(.9,O.A0*(sport?.17:.135)*.55):O.A0*(sport?.17:.135)*1.1);
 if(O.kind!=='tonneau')return{ok:true,endMm:null,needMm:need*2};
 /* the end still faces 12 while its normal is within 30 degrees of the axis */
 let lo=endCache.get(O.A0);
 if(lo==null){lo=0;let hi=O.A0;for(let i=0;i<24;i++){const m=(lo+hi)/2,c=crossingAt(O.spec,O.A0,-Math.PI/2,m);
   if(c&&Math.abs(Math.atan2(c.normal[0],-c.normal[1]))<Math.PI/6)lo=m;else hi=m}
  endCache.set(O.A0,lo)}
 return{ok:need<=lo+1e-6,endMm:lo*2,needMm:need*2}}

/* how much further out the case's outline reaches than its radius, along a
   bearing in degrees clockwise from 12 (a cushion's corner stands proud) */
export function caseReachMm(d,bearing){const O=outlinesOf(d).case;
 return extentAlong(O.spec,O.A0,(bearing-90)*Math.PI/180)-O.A0}
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
/* A bracelet laid open: links from each end link, the 6 o'clock half ending in
   a folding clasp and the 12 o'clock half in the link whose bar the clasp locks
   onto — about 175 mm round a wrist when closed. */
export const BRACELET_MM={top:62,bottom:80,clasp:34};
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

/* Real sizes on a dial, in mm. A date window and a chronograph's registers
   belong to the movement, and printing is set for legibility, so none of them
   grows with the case: a 46 mm watch does not get a date window a third larger
   than a 34 mm one, and its registers sit where the movement puts them. A small
   dial with no room for a size shrinks it to fit, as a small calibre does.
     date      aperture [width, height] by position; corner radius; frame width
     register  centre distance from the dial centre, radius, clearance to the track
     text      font size of the brand and the model line; gap when they stack
     pinion    the dot at the centre; tapisserie the pyramids' pitch */
export const DIAL_MM={
 date:{'3':[3.1,2.4],chrono3:[2.6,2.4],'6':[2.7,2.3],'430':[2.5,2.1],rad:.45,frame:.2},
 register:{dist:8,r:3.9,gap:.35},
 text:{brand:2,line:1.2,stack:.6},
 pinion:.45,tapisserie:1,
 /* a sculpted dial: the pitch of the ribs in its channels */
 rib:.55};
export const STRAP_STRIPE_MM=2.4;      /* the width of a strap's centre stripe */
export const DIAL_PLATE_MM=.34;        /* how far a sculpted dial's plates stand over it */
export const SUBDIAL_DEPTH_MM=.28;      /* depth of a register below the plate */

export function dialLayoutOf(d){
 const r=geoOf(d).dialR,P=(d.parts&&d.parts.dial)||{},chrono=P.variant==='chrono';
 let date=DATE_POSITIONS.includes(P.date)?P.date:'none';
 /* a chronograph's 6 o'clock register and model line leave no room at 6 */
 if(chrono&&date==='6')date='430';
 const stepped=P.step==='stepped';
 /* registers where a chronograph movement puts them, no further out than the
    track (or the step) allows and never touching each other */
 const RG=DIAL_MM.register,rMm=r/PX,dist=Math.min(RG.dist,rMm*.5);
 const rs=Math.min(RG.r,(stepped?r*.915:r*.9)/PX-RG.gap-dist,dist*.68);
 const subdials=chrono?[[90,'smallsec'],[180,'chHr'],[270,'chMin']].map(([deg,key])=>{
  const[x,y]=posAt(deg,dist*PX);return{deg,key,x,y,r:rs*PX}}):[];
 /* A chronograph's date at 3 goes between the running-seconds register and the
    track when there is room for the window and its frame; on a smaller dial
    there is not, and it moves to 4:30 as it does from 6. */
 const D=DIAL_MM.date,limitMm=(stepped?r*.915:r*.905)/PX;
 let at3=.77;
 if(chrono&&date==='3'){const wMm=Math.min(D.chrono3[0],r*.18/PX),need=wMm+2*D.frame+.6,from=dist+rs;
  if(limitMm-from>=need)at3=(from+.3+D.frame+wMm/2)*PX/r;else date='430'}
 let win=null;
 if(date!=='none'){const deg={'3':90,'430':135,'6':180}[date];
  /* centred where the index was, pulled in at 4:30 so the corners of an upright
     window clear the step */
  const at=date==='430'?.75:date==='3'?at3:.77;
  const[x,y]=posAt(deg,r*at);
  /* The wheel's days are 360/31 deg apart, about 0.156 r at this radius. The
     window must stay narrower than that across the wheel's direction of travel,
     or the neighbouring days show at its edges: at 3 that direction is the
     window's height, at 6 its width, at 4:30 both. A chronograph's window at 3
     is also narrower radially, to fit between its register and the track. */
  const[ww,wh]=date==='3'?[chrono?.18:.22,.165]:date==='6'?[.155,.14]:[.145,.12];
  /* the movement's aperture in mm, or the dial's proportion where that is smaller */
  const[mw,mh]=D[chrono&&date==='3'?'chrono3':date];
  win={deg,x,y,w:Math.min(mw*PX,r*ww),h:Math.min(mh*PX,r*wh),rad:Math.min(D.rad*PX,r*.028),frame:Math.min(D.frame*PX,r*.012),
   skipHour:date==='3'?3:date==='6'?6:null}}
 /* hours whose index is left out: the one a date window replaces, and those a
    register reaches into */
 const skipHours=win&&win.skipHour!=null?[win.skipHour]:[];
 if(chrono&&(dist+rs+.2)*PX>indexInnerOf(d)*r)for(const h of[3,6,9])if(!skipHours.includes(h))skipHours.push(h);
 return{r,chrono,stepped,stepR:r*.915,subdials,date,win,skipHours}}

/* ==================== CLEARANCES ====================
   The hands sweep over everything on the dial, so what stands on it must clear
   them, and what is printed on it must not be hidden by them in a posed picture.

   Height: an applied part (an index, a marker-set index, an applied logo) may
   stand no taller than the underside of the lowest hand that passes over it:
   the hour hand out to its tip, the minute hand beyond, the seconds hand beyond
   that. Measured from the dial face the hands' lifts are measured from.

   Place: the logo stays clear of the printing, the date window, the registers,
   the hour indices and the hands' centre (logo.js logoBoxOf). */
export const DIAL_CLEAR_MM=.02, HANDS_HUB_MM=1.4;
export function appliedHeightLimitOf(d){const rMm=geoOf(d).dialR/PX,L=handLengthsOf(d);
 const reach=[['hour',L.hour*rMm],['min',L.min*rMm],['sec',L.sec*rMm]];
 return rhoMm=>{for(const[k,len]of reach)if(rhoMm<=len)return HAND_LIFT_MM[k]-DIAL_CLEAR_MM;return Infinity}}

/* The printed and cut-out parts of the dial as boxes in sheet px, each with what
   it is: the brand and model line (at an estimate of their printed width — the
   renderer measures the real one, never wider), the date window with its frame.
   A clearance `pad` px is added all round. */
export function dialBoxesOf(d,pad=0){const L=dialLayoutOf(d),T=dialTextOf(d),t=(d.parts.dial||{}).text||{},out=[];
 const est=(s,size,caps)=>s.length*(size*(caps?.66:.56)+(caps?4:1));
 for(const[kind,str,b]of[['brand text',t.top,T.brand],['model line',t.bottom,T.line]]){if(!str)continue;
  const w=Math.min(b.maxW,est(str,b.size,t.font==='caps'));
  out.push({kind,x0:C-w/2-pad,x1:C+w/2+pad,y0:b.y-b.size*.6-pad,y1:b.y+b.size*.6+pad})}
 if(L.win){const w=L.win,hx=w.w/2+w.frame+pad,hy=w.h/2+w.frame+pad;out.push({kind:'date window',x0:w.x-hx,x1:w.x+hx,y0:w.y-hy,y1:w.y+hy})}
 return out}
const segmentHitsBox=(ax,ay,bx,by,b)=>{let t0=0,t1=1;const dx=bx-ax,dy=by-ay;
 for(const[p,q]of[[-dx,ax-b.x0],[dx,b.x1-ax],[-dy,ay-b.y0],[dy,b.y1-ay]]){
  if(Math.abs(p)<1e-12){if(q<0)return false;continue}
  const t=q/p;if(p<0){if(t>t1)return false;if(t>t0)t0=t}else{if(t<t0)return false;if(t<t1)t1=t}}
 return true};
/* A posed picture reads 10:09 with the seconds hand where it hides nothing
   printed: the first second, from 36 outward, whose hand (tail to tip, and its
   width) clears the printing, the date window and `extra` boxes (the logo). */
export const MARKETING_SECONDS=[36,37,38,35,39,40,34,41,33,42,32,43,31,44,30,45];
export function marketingSecondsOf(d,extra=[]){const r=geoOf(d).dialR,L=handLengthsOf(d),half=.2*PX;
 const boxes=[...dialBoxesOf(d,half),...extra.map(b=>({...b,x0:b.x0-half,x1:b.x1+half,y0:b.y0-half,y1:b.y1+half}))];
 for(const s of MARKETING_SECONDS){const a=s*6*Math.PI/180,ux=Math.sin(a),uy=-Math.cos(a);
  const ax=C-ux*r*.22,ay=C-uy*r*.22,bx=C+ux*r*L.sec,by=C+uy*r*L.sec;
  if(!boxes.some(b=>segmentHitsBox(ax,ay,bx,by,b)))return s}
 return MARKETING_SECONDS[0]}

/* The dial's printing, in sheet px: the brand below 12 and the model line above
   6, each at its printed size in mm, shrunk only where it is wider than the dial
   has room for (`maxW`). On a chronograph the 6 o'clock register takes the model
   line's place, so it stacks under the brand. */
export function dialTextOf(d){const r=geoOf(d).dialR,L=dialLayoutOf(d),T=DIAL_MM.text;
 const brand={size:T.brand*PX,y:C-r*.4,maxW:r*1.1};
 const lead=(T.brand*.62+T.line*.62+T.stack)*PX,gap=.3*PX;
 const line={size:T.line*PX,y:L.chrono?brand.y+lead:C+r*.46,maxW:r*1.0};
 /* stacked above the registers at 3 and 9, not squeezed between them: the pair
    moves up toward 12 as far as that needs */
 if(L.chrono&&L.subdials.length){line.y=Math.min(line.y,C-L.subdials[0].r-gap-line.size*.6);brand.y=Math.min(brand.y,line.y-lead)}
 /* a line of print is centred; anything level with it — a register, the date
    window — leaves it the width up to its nearer edge, less a clearance */
 const obstacles=[...L.subdials.map(s=>({x0:s.x-s.r,x1:s.x+s.r,y0:s.y-s.r,y1:s.y+s.r})),
  ...(L.win?[{x0:L.win.x-L.win.w/2-L.win.frame,x1:L.win.x+L.win.w/2+L.win.frame,y0:L.win.y-L.win.h/2-L.win.frame,y1:L.win.y+L.win.h/2+L.win.frame}]:[])];
 for(const t of[brand,line]){const half=t.size*.6;
  for(const o of obstacles){if(o.y1<t.y-half||o.y0>t.y+half)continue;
   const near=o.x0>C?o.x0-C:o.x1<C?C-o.x1:0;t.maxW=Math.max(0,Math.min(t.maxW,2*(near-gap)))}}
 return{brand,line}}

/* the day the date wheel shows: the set date for a posed design, today otherwise */
export function dialDayOf(d,nowMs=Date.now()){const t=d.time||{},now=new Date(nowMs);
 if(t.mode!=='set')return now.getDate();
 const last=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
 return Math.min(clamp(Math.round(+t.date||1),1,31),last)}

/* crown grows with the 'oversized' variant — shared by its frame, hit-box and selection guide */
const crownScale=d=>d.parts.crown.variant==='oversized'?1.22:1;  /* must match crownParts in three/lathe.js */

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
/* a shaped outline as an SVG path on the sheet, grown by `grow` px */
const outlineD=(spec,A0,grow)=>outlinePoly(spec,A0,-grow,96).map(({p},i)=>`${i?'L':'M'}${(C+p[0]).toFixed(1)} ${(C+p[1]).toFixed(1)}`).join('')+'Z';
export function frames(sel,d){const g=geoOf(d),r=g.R,c=caseOf(d);switch(sel){
 case'strap':return[{t:'r',x:C-g.sw/2-8,y:28,w:g.sw+16,h:C-g.R-40},{t:'r',x:C-g.sw/2-8,y:C+g.R+12,w:g.sw+16,h:CAN-28-(C+g.R+12)}];
 case'case':return c.shape==='round'?[{t:'c',r:r+10}]:[{t:'p',d:outlineD(shapeSpec(c.shape),g.rCase,10)}];
 /* swung to the crown's bearing, so a 4:30 crown is outlined at 4:30 */
 case'crown':{const b=crownBox(d);return[{t:'r',x:b.x+3,y:b.y+3,w:b.w-6,h:b.h-6,rot:crownAng(d)-90}]}
 case'bezel':{const B=outlinesOf(d).bezel;
  return[B.kind==='round'?{t:'c',r:g.rBezOut}:{t:'p',d:outlineD(B.spec,B.A0*PX,0)},{t:'c',r:g.rBezIn}]}
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

/* ==================== MOVEMENT ====================
   What moves behind an exhibition caseback. A mechanical balance swings to and
   fro at its beat: 28,800 vibrations an hour (4 full swings a second) for an
   automatic, 21,600 (3) for a hand-wound calibre, about 270 degrees either side
   of rest. A spring drive has no balance; its glide wheel turns steadily, 8
   times a second. Nothing moves that shows in a quartz movement. */
export const BEAT_HZ={automatic:4,manual:3}, BALANCE_AMPLITUDE_DEG=270, GLIDE_RPS=8;
export function movementAngles(kind,ms){const s=ms/1000,hz=BEAT_HZ[kind];
 return{balance:hz?BALANCE_AMPLITUDE_DEG*Math.sin(2*Math.PI*hz*s):0,glide:kind==='spring'?(s*GLIDE_RPS*360)%360:0}}
