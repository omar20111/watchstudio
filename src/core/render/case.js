/* Case renderer.

   Built as real construction rather than a disc: the lugs are separate horns
   with drilled holes, the case band is the vertical wall you see edge-on from
   above, and a polished chamfer steps up from the band to the bezel seat.
   Each of those surfaces carries its own finish — alternating brushed top and
   polished bevel is most of what makes a steel case read as machined. */
import {C,METALS} from '../constants.js';
import {envGrad,axisGrad,bevelGrad,tone,ringPath,seam,circGrain,lineGrain,microScratch,
        fresnelRim,castShadow,applyFinish} from './material.js';

/* fill an annulus through its own clip so each surface can carry its own grain */
function band(ctx,rOut,rIn,fill,extra){ctx.save();ringPath(ctx,C,C,rOut,rIn);ctx.clip();
 ctx.fillStyle=fill;ctx.fillRect(C-rOut-2,C-rOut-2,rOut*2+4,rOut*2+4);
 if(extra)extra();ctx.restore()}

export function drCase(ctx,o){const{R,sw,lugExt,rCase,rSeat,rBezOut,crownR}=o.g;
 const m=METALS[o.metal]||METALS.steel;
 const sport=o.variant==='sport';
 const lugW=R*(sport?0.17:0.135);
 const brushed=o.finish==='brushed'||o.finish==='matte';

 /* ---- lugs: drawn first so the case body overlaps their inner ends ----
    outer end is the true lug-to-lug radius; the inner end is buried well
    inside the case so the horn grows out of the band rather than butting it */
 const outer=R+lugExt, inner=R*0.42;
 /* A horn, not a post: broad where it leaves the case band, tapering and
    leaning outward to a rounded tip. Built in a local frame where +y runs
    toward the tip and +x points away from the strap. */
 const lugPath=(sx,sy,inset)=>{
  ctx.save();ctx.translate(C+sx*(sw*0.5+lugW*0.95),C);ctx.scale(sx,sy);
  const wb=lugW*2.0-inset*2,wt=lugW*1.10-inset*2,lean=lugW*0.12,yb=inner,yt=outer-inset;
  ctx.beginPath();
  ctx.moveTo(-wb/2,yb);
  ctx.quadraticCurveTo(-wt/2-lugW*0.10,(yb+yt)*0.55,lean-wt/2,yt-wt*0.44);
  ctx.quadraticCurveTo(lean,yt+wt*0.16,lean+wt/2,yt-wt*0.44);
  ctx.quadraticCurveTo(wb/2+lugW*0.06,(yb+yt)*0.55,wb/2,yb);
  ctx.closePath();ctx.restore()};

 for(const sy of[-1,1])for(const sx of[-1,1]){
  castShadow(ctx,()=>lugPath(sx,sy,0),{dist:5,alpha:.3});
  lugPath(sx,sy,0);
  /* a horn is a rounded bar: dark where it turns under on both edges, brightest
     across the crown of the curve — not the near-white the generic axis ramp gives */
  const lg=ctx.createLinearGradient(C+sx*(sw*0.5),0,C+sx*(sw*0.5+lugW*1.6),0);
  lg.addColorStop(0,tone(m,.26));lg.addColorStop(.34,tone(m,.60));
  lg.addColorStop(.70,tone(m,.80));lg.addColorStop(1,tone(m,.20));
  ctx.fillStyle=lg;ctx.fill();
  /* no full outline — a lug is part of the case, and a closed dark border is
     what makes it read as a separate object stuck on beside it */
  /* brushed top face, inset from the polished flanks */
  ctx.save();lugPath(sx,sy,lugW*0.22);ctx.clip();
  if(brushed){ctx.save();ctx.globalCompositeOperation='overlay';
   ctx.fillStyle=lineGrain(ctx,C,C-R-lugExt,C,C+R+lugExt,.85);
   ctx.fillRect(C-R*2,C-R*2,R*4,R*4);ctx.restore()}
  ctx.fillStyle='rgba(255,255,255,.05)';ctx.fillRect(C-R*2,C-R*2,R*4,R*4);ctx.restore();
  /* polished chamfer down the outer flank */
  ctx.save();lugPath(sx,sy,0);ctx.clip();
  const cg=ctx.createLinearGradient(C+sx*(sw*0.5),0,C+sx*(sw*0.5+lugW),0);
  cg.addColorStop(0,'rgba(0,0,0,.34)');cg.addColorStop(.26,'rgba(255,255,255,.10)');
  cg.addColorStop(.72,'rgba(255,255,255,0)');cg.addColorStop(.94,`rgba(255,255,255,${sx<0?.42:.20})`);
  cg.addColorStop(1,'rgba(0,0,0,.30)');
  ctx.fillStyle=cg;ctx.fillRect(C-R*2,C-R*2,R*4,R*4);ctx.restore();
  /* drilled lug hole, near the tip where the spring bar actually sits */
  const hx=C+sx*(sw*0.5+lugW*0.95),hy=C+sy*(outer-lugW*0.85);
  ctx.beginPath();ctx.arc(hx,hy,lugW*0.15,0,7);ctx.fillStyle='rgba(0,0,0,.62)';ctx.fill();
  ctx.beginPath();ctx.arc(hx,hy-1.2,lugW*0.15,Math.PI*0.15,Math.PI*0.85);
  ctx.strokeStyle='rgba(255,255,255,.22)';ctx.lineWidth=1.4;ctx.stroke()}

 /* ---- case body ---- */
 ctx.beginPath();ctx.arc(C,C,rCase,0,7);ctx.fillStyle=envGrad(ctx,m);ctx.fill();

 /* vertical case band: faces sideways, so it sits in shadow except where the
    key light grazes it */
 band(ctx,rCase,rSeat,bevelGrad(ctx,m,C,C,{facing:'out',lo:.04,hi:.72,tight:2.2}),()=>{
  ctx.save();ctx.globalCompositeOperation='overlay';
  ctx.fillStyle=circGrain(ctx,rSeat,rCase,.7);ctx.fillRect(C-rCase,C-rCase,rCase*2,rCase*2);ctx.restore()});

 /* polished chamfer stepping up to the bezel seat */
 band(ctx,rSeat,rBezOut,bevelGrad(ctx,m,C,C,{facing:'out',lo:.16,hi:1,tight:1.25,bias:.06}));

 /* the seat itself — mostly hidden under the bezel, brushed where it shows */
 band(ctx,rBezOut,rBezOut*0.9,bevelGrad(ctx,m,C,C,{facing:'out',lo:.12,hi:.8,tight:1.7}),()=>{
  if(brushed){ctx.save();ctx.globalCompositeOperation='overlay';
   ctx.fillStyle=circGrain(ctx,rBezOut*0.9,rBezOut,.8);
   ctx.fillRect(C-rBezOut,C-rBezOut,rBezOut*2,rBezOut*2);ctx.restore()}});

 /* ---- crown guards ----
    Sized from the real crown so they flank it. The crown barrel is a layer
    above the case, so guards drawn inside its footprint are simply painted
    over — they have to sit clear of |y| < crownR. */
 if(sport){const gi=crownR*0.86,go=crownR*1.95,gx=R+crownR*1.0;
  ctx.save();ctx.translate(C,C);
  for(const sy of[-1,1]){ctx.beginPath();
   ctx.moveTo(R*0.88,sy*go);
   ctx.quadraticCurveTo(gx*0.99,sy*go*0.92,gx,sy*gi);
   ctx.lineTo(R*0.94,sy*gi*0.86);ctx.closePath();
   ctx.fillStyle=axisGrad(ctx,m,R*0.86,0,gx+8,0);ctx.fill();
   ctx.strokeStyle='rgba(0,0,0,.45)';ctx.lineWidth=1.6;ctx.stroke()}
  ctx.restore()}

 /* ---- chronograph pushers ----
    Real components at 2 and 4 o'clock, flanking the crown bearing. Drawn here
    rather than in the crown layer because they are part of the case band. */
 if(o.pushers){const bear=(o.crownAng||90);
  for(const off of[-30,30]){const a=(bear+off)*Math.PI/180;
   ctx.save();ctx.translate(C,C);ctx.rotate(a-Math.PI/2);
   const pw=crownR*0.52,ph=crownR*0.86,px=R-2;
   /* shoulder */
   ctx.fillStyle=axisGrad(ctx,m,0,-ph*0.5,0,ph*0.5);
   ctx.fillRect(px-crownR*0.18,-ph*0.34,crownR*0.34,ph*0.68);
   /* pusher head */
   ctx.beginPath();ctx.roundRect(px+crownR*0.12,-ph/2,pw,ph,Math.min(pw,ph)*0.3);
   ctx.fillStyle=axisGrad(ctx,m,0,-ph/2,0,ph/2);ctx.fill();
   ctx.strokeStyle='rgba(0,0,0,.5)';ctx.lineWidth=1.4;ctx.stroke();
   /* lit top shoulder so it reads as a cylinder, not a tab */
   const g2=ctx.createLinearGradient(0,-ph/2,0,ph/2);
   g2.addColorStop(0,'rgba(0,0,0,.28)');g2.addColorStop(.24,'rgba(255,255,255,.22)');
   g2.addColorStop(1,'rgba(0,0,0,.34)');
   ctx.save();ctx.beginPath();ctx.roundRect(px+crownR*0.12,-ph/2,pw,ph,Math.min(pw,ph)*0.3);ctx.clip();
   ctx.fillStyle=g2;ctx.fillRect(px,-ph,pw*2,ph*2);ctx.restore();
   ctx.restore()}}

 /* ---- surface character ----
    The box must cover everything this renderer painted, not just the case
    circle: the horns reach R+lugExt and the sport guards R*1.10, and a box that
    stops at rCase cuts a dead-straight specular step part-way up each horn. */
 const reach=Math.max(rCase+lugExt,R*1.12,sw*0.5+lugW*1.95)+10;
 applyFinish(ctx,m,o.finish,{mode:'radial',r0:rBezOut*0.9,r1:rCase,amt:.85,grain:.8,
  box:[C-reach,C-reach,reach*2,reach*2]});
 ctx.save();ringPath(ctx,C,C,rCase,rBezOut*0.9);ctx.clip();
 microScratch(ctx,C,C,rBezOut*0.9,rCase,90,m.kind==='metal'?1:.45);
 ctx.restore();

 fresnelRim(ctx,C,C,rCase,m,.045);
 /* joint where the bezel drops onto the seat */
 seam(ctx,C,C,rBezOut,{dark:.55,lite:.22,w:2.4,side:1});
 seam(ctx,C,C,rSeat,{dark:.30,lite:.30,w:1.8,side:1});}
