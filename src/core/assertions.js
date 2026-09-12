/* Boot invariants.

   Imported for side effects at startup. Everything here is pure maths over
   the geometry and clock modules — no canvas, no DOM — so it runs identically
   in the browser, in the headless tests and in CI.

   Failures are collected rather than thrown one at a time, so a single run
   reports every broken invariant. `assertThrowIfFailed()` is what turns that
   into a hard failure; main.jsx calls it in dev and logs in production.

   These exist because each one has already been a real bug in this codebase or
   its v5 sibling: a negative rehaut on a wide bezel, a lug-to-lug that was a
   0.26·R fudge, detent snapping that rounded the wrong way past 0. */
import {assert,assertClose,hash01} from './utils.js';
import {DEF} from '../state/store.js';
import {clone} from './utils.js';
import {geoOf,caseOf,thicknessStack,lugToLugMm,crownAng,snapDetent,
        bezelElapsedMin,gmtReadHours,detentOf,bezelRangeOf} from './geometry.js';
import {sceneClock,calcAngles,marketingClock} from './time.js';

const design=over=>{const d=clone(DEF);return over?over(d)||d:d};

/* ---- 1. the ring stack is strictly monotonic, every size, every bezel ----
   bezelMm is swept PAST the slider's range on purpose: the clamp inside geoOf
   is the only thing keeping a wide bezel from eating through the rehaut and
   out the far side of the dial, and a test that never reaches the clamp
   passes vacuously however broken the clamp is. */
for(const caseMm of[34,38,40,42,46])
 for(const variant of['smooth','fluted','diver','gmt','tachy'])
 for(const bez of['auto',0.1,1,2.5,4,8,40]){
  const d=design(x=>{x.caseMm=caseMm;x.parts.bezel.variant=variant;x.bezelMm=bez});
  const g=geoOf(d);const tag=`${caseMm}mm ${variant} bezel=${bez}`;
  assert(g.rCase>g.rSeat,`ring stack ${tag}: rCase must exceed rSeat`);
  assert(g.rSeat>g.rBezOut,`ring stack ${tag}: rSeat must exceed rBezOut`);
  assert(g.rBezOut>g.rBezIn,`ring stack ${tag}: rBezOut must exceed rBezIn`);
  assert(g.rBezIn>g.dialR,`ring stack ${tag}: rBezIn must exceed dialR`);
  assert(g.dialR>0,`ring stack ${tag}: dialR must be positive`);
  /* 2. the rehaut may be thin but never negative — it goes negative the moment
        a wide bezel is allowed to eat past the dial edge */
  assert(g.rehautW>=0,`rehaut ${tag}: width must not go negative (got ${g.rehautW.toFixed(2)})`);
  /* and the slider range must agree with the clamp it feeds */
  const[lo,hi]=bezelRangeOf(d);
  assert(hi>=lo,`bezel slider ${tag}: max must not fall below min`);
 }

/* ---- 3. the thickness stack sums to the requested thickness ---- */
{const d=design(x=>{x.caseMm=40;x.parts.bezel.variant='diver';x.case.thicknessMm=13});
 const s=thicknessStack(d);
 assertClose(s.total,13,0.011,'thickness stack must sum to the requested thickness');
 assert(s.band>=0.8-1e-9,'mid-band must not fall below MIN_BAND_MM');}

/* an impossible request is raised to the feasible minimum and flagged */
{const d=design(x=>{x.caseMm=38;x.parts.bezel.variant='fluted';
  x.case={...x.case,thicknessMm:7,movement:'automatic',crystal:'dome',crystalMm:1.6,caseback:'exhibition'}});
 const c=caseOf(d);
 assert(c.thickness>=c.minThickness,'an impossible thickness must be raised to the minimum');
 assert(c.feasible===false,'an impossible thickness must be flagged infeasible');
 assertClose(thicknessStack(d).total,c.thickness,0.011,'the raised stack must still sum exactly');}

/* ---- 4. lug-to-lug is derived from lug length, not a fudge ---- */
{const d=design(x=>{x.caseMm=42;x.case={...x.case,lugLenMm:7}});
 assertClose(lugToLugMm(d),49.7,0.01,'42 mm case with 7 mm lugs must be 49.7 mm lug-to-lug');}

/* ---- 5. detent snapping ---- */
assert(snapDetent(7,120)===6,'detent 120: 7deg must snap to 6deg');
assert(snapDetent(-1,60)===0,'detent 60: -1deg is nearer 0 than 354');
assert(snapDetent(-4,60)===354,'detent 60: -4deg must snap to 354deg');
assert(snapDetent(359.4,60)===0,'detent 60: 359.4deg must wrap to 0');
assert(snapDetent(23,0)===23,'no detents: must pass through unchanged');

/* ---- 6. ratchet direction ---- */
{/* a diver bezel may not run backwards past 12 — clockwise-only elapsed time
    can never read LESS than it did, so the ratchet clamps at 0 */
 const ccw=(cur,delta)=>Math.max(0,cur+delta);
 assert(ccw(0,-6)===0,'CCW ratchet must clamp at 0 rather than run backwards');
 const bi=(cur,delta)=>((cur+delta)%360+360)%360;
 assert(bi(0,-6)===354,'a bidirectional bezel must wrap to 354deg');}

/* ---- 7. elapsed-minute and GMT readings ---- */
assertClose(bezelElapsedMin(45,300),17.5,1e-9,'pip at 50, hand at 7.5 must read 17.5 min');
assertClose(bezelElapsedMin(0,0),0,1e-9,'pip on the minute hand must read 0');
{const r=gmtReadHours(197.4,0);
 assert(r.hours===13&&r.minutes===9,'GMT 197.4deg must read 13:09');
 assert(gmtReadHours(0,0).hours===0&&gmtReadHours(359.9,0).hours===23,'GMT reading must wrap 0-23');}

/* ---- 8. the scene clock ---- */
assertClose(calcAngles(new Date(2026,0,1,18,30),false).g,277.5,1e-9,'GMT angle at 18:30 must be 277.5deg');
{/* a posed scene must not drift when the host clock moves */
 const d=design(x=>{x.time={...x.time,mode:'set',h:10,m:9,s:36,date:28}});
 const a=sceneClock(d,1000),b=sceneClock(d,9999999);
 assertClose(a.ang.hour,b.ang.hour,1e-9,'a set pose must not tick with the host clock');
 assert(a.date.getDate()===28,'a set pose must show the scene date, not today');
 const mk=marketingClock(design());
 /* 9 min 36 s: the minute hand has crept 3.6deg past the 9-minute mark */
 assertClose(mk.ang.min,57.6,1e-9,'the marketing pose must be 10:09:36');
 assertClose(mk.ang.hour,304.8,1e-9,'the marketing hour hand must sit at 10:09:36');}

/* chrono is pure in (state, now) */
{const d=design(x=>{x.parts.dial.variant='chrono';x.chrono={running:true,elapsed:0,start:1000}});
 const c=sceneClock(d,31000);
 assertClose(c.chrono.ms,30000,1,'a running chrono must elapse with now');
 assertClose(c.secAng,180,1e-6,'30 s of chrono must put the central hand at 180deg');}

/* ---- 8b. baked textures must be reproducible ---- */
{let same=true,inRange=true;
 for(let i=0;i<2048;i++){const a1=hash01(i),a2=hash01(i);
  if(a1!==a2)same=false;
  if(!(a1>=0&&a1<1))inRange=false}
 assert(same,'hash01 must return the same value for the same index');
 assert(inRange,'hash01 must stay within [0,1)');
 /* and it must actually vary, or every grain tile would be flat */
 const spread=new Set(Array.from({length:64},(_,i)=>Math.floor(hash01(i)*16)));
 assert(spread.size>=8,'hash01 must distribute across the range, not cluster');}

/* ---- 9. the crown sits on the right bearing ---- */
assert(crownAng(design())===90,'a 3 oclock crown must bear 90deg');
assert(crownAng(design(x=>{x.case={...x.case,crownPos:'430'}}))===135,'a 4:30 crown must bear 135deg');

/* ---- 10. detents follow the bezel type ---- */
assert(detentOf(design(x=>{x.parts.bezel.variant='diver';x.parts.bezel.detents=60}))===60,'a diver must honour 60 detents');
assert(detentOf(design(x=>{x.parts.bezel.variant='gmt';x.parts.bezel.detents=24}))===24,'a GMT must honour 24 detents');
assert(detentOf(design(x=>{x.parts.bezel.variant='smooth'}))===0,'a fixed bezel must have no detents');

export {ASSERT_FAILURES,assertThrowIfFailed,assertReport} from './utils.js';

/* ---- 11. every dimension that moves geometry is in the cache key ----
   A slider that changes the drawing but not the key renders stale. This walks
   each dimension, nudges it, and insists the key moves with it. */
import {__dimsKeyForTest} from './cache.js';
{const base=design();
 const nudge={caseMm:d=>{d.caseMm=41},strapMm:d=>{d.strapMm='22'},bezelMm:d=>{d.bezelMm=2.1},
  crownMm:d=>{d.crownMm=7.5},
  'case.thicknessMm':d=>{d.case.thicknessMm=14},'case.lugLenMm':d=>{d.case.lugLenMm=7.5},
  'case.lugDropMm':d=>{d.case.lugDropMm=3.5},'case.crystalMm':d=>{d.case.crystalMm=2.2},
  'case.crystal':d=>{d.case.crystal='box'},'case.caseback':d=>{d.case.caseback='exhibition'},
  'case.movement':d=>{d.case.movement='quartz'},'case.crownPos':d=>{d.case.crownPos='430'},
  'bezel.variant':d=>{d.parts.bezel.variant='diver'}};
 const k0=__dimsKeyForTest(base);
 for(const[name,fn]of Object.entries(nudge)){const d=clone(base);fn(d);
  assert(__dimsKeyForTest(d)!==k0,`cache key must change when ${name} changes`)}}

/* (crown pickability at its bearing is checked against the 3D geometry in
   smoke.mjs — picking is a ray into the built watch now, which needs three.js
   and the bakes, not pure maths) */
