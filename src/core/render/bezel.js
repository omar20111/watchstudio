/* Bezel renderer: smooth / fluted / coin edge / diver / GMT / tachymeter.

   The bezel is a ring with real thickness sitting on the case seat: an outer
   polished chamfer, a grip edge on rotating types, the top face or insert, and
   an inner chamfer falling to the crystal. Markings are rotated to their own
   angle so they sit on the curve instead of being pasted flat across it. */
import {C,METALS} from '../constants.js';
import {clamp,lumOf,shade} from '../utils.js';
import {posAt} from '../geometry.js';
import {envGrad,envLevel,tone,bevelGrad,ringPath,seam,circGrain,microScratch,
        fresnelRim,applyFinish} from './material.js';

const band=(ctx,rOut,rIn,fill,extra)=>{ctx.save();ringPath(ctx,C,C,rOut,rIn);ctx.clip();
 ctx.fillStyle=fill;ctx.fillRect(C-rOut-2,C-rOut-2,rOut*2+4,rOut*2+4);
 if(extra)extra();ctx.restore()};

/* radial coin-edge grip on the flank of a rotating bezel */
function knurl(ctx,m,rOut,rIn,teeth){
 ctx.save();ringPath(ctx,C,C,rOut,rIn);ctx.clip();
 for(let i=0;i<teeth;i++){const a=i/teeth*Math.PI*2;
  const l=envLevel(m,a/(Math.PI*2)+.25);
  ctx.save();ctx.translate(C,C);ctx.rotate(a);
  ctx.fillStyle=tone(m,clamp(l*1.25+.05,0,1));
  ctx.fillRect(rIn-1,-Math.PI*rOut/teeth*0.52,rOut-rIn+2,Math.PI*rOut/teeth*0.52);
  ctx.fillStyle=tone(m,clamp(l*0.40,0,1));
  ctx.fillRect(rIn-1,0,rOut-rIn+2,Math.PI*rOut/teeth*0.50);
  ctx.restore()}
 ctx.restore()}

/* engraved, not printed: a cut groove with the lit lower lip of the cut */
function engrave(ctx,x0,y0,x1,y1,w,ink){
 ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);
 ctx.strokeStyle=ink;ctx.lineWidth=w;ctx.stroke()}

/* `o.which` splits the bake in two for rotating bezels:
     'insert' -> just the printed insert, which spins as a CSS transform
     anything else -> the metal ring it sits in, which does not move
   A fixed bezel (smooth/fluted/tachy) has no insert layer and bakes whole. */
/* The bezel's radial layout. Exported so the 3D lathe puts the grip, the insert
   and the inner chamfer at exactly the radii this drawing does. */
/* where a rotating insert's lume pip sits, on the sheet, and its sizes: the
   polished surround and the lume inside it */
export function bezelPipOf(g,variant){const{W,rTopOut,rInCham}=bezelRings(g,variant),rMid=(rTopOut-W*.03+rInCham)/2;
 const[x,y]=posAt(0,rMid-(variant==='gmt'?W*0.02:W*0.06));
 return{x,y,r:W*.19,lume:W*.13}}

export function bezelRings(g,variant){const{rBezOut,rBezIn}=g,W=rBezOut-rBezIn;
 const rot=variant==='diver'||variant==='gmt';
 /* the grip is on the bezel's outer FLANK, which from above is a thin ring — it
    must not eat the top face the insert printing has to live on */
 const rGripIn=rBezOut-W*(rot?0.15:variant==='coin'?0.2:0.11);
 return{W,rot,rGripIn,rTopOut:rGripIn,rInsOut:rGripIn-W*0.03,rInCham:rBezIn+W*0.10}}

/* tachymeter scale, engraved into a fixed bezel's top face */
function tachyScale(ctx,m,rTopOut,rInCham,W){
 const pin=lumOf(m.base)>0.5?'#15181c':'#dfe3e8',rm=(rTopOut+rInCham)/2;
 for(let i=0;i<120;i++){const a=i*3;const[x0,y0]=posAt(a,rTopOut-4),[x1,y1]=posAt(a,rTopOut-4-W*(i%5?0.12:0.22));
  engrave(ctx,x0,y0,x1,y1,i%5?1.4:2.4,pin)}
 ctx.fillStyle=pin;ctx.font=`700 ${W*0.30}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';
 for(const v of[60,65,70,75,80,85,90,95,100,110,120,130,140,150,160,170,180,190,200,225,250,300,400]){
  const deg=(360*60/v)%360;const[x,y]=posAt(deg,rm-W*0.04);
  ctx.save();ctx.translate(x,y);ctx.rotate(deg*Math.PI/180);ctx.fillText(String(v),0,0);ctx.restore()}}

export function drBezel(ctx,o){const{rBezOut,rBezIn}=o.g;
 const m=METALS[o.metal]||METALS.steel;
 const{W,rot,rGripIn,rTopOut,rInCham}=bezelRings(o.g,o.variant);
 const flat=o.mode==='flat';
 /* print: just the engraving of a fixed bezel, as a decal for the lathed ring */
 if(o.mode==='print'){if(o.variant==='tachy'&&o.which!=='insert')tachyScale(ctx,m,rTopOut,rInCham,W);return}

 const rotating=o.variant==='diver'||o.variant==='gmt';
 const wantInsert=o.which==='insert';
 if(!rotating&&wantInsert)return;                 /* fixed bezel: no insert layer */

 if(rotating&&!wantInsert){
  /* THE RING. Chamfer, grip and the recess the insert drops into all belong
     here — none of it may spin, so none of it may be baked into the insert. */
  band(ctx,rBezOut,rGripIn,bevelGrad(ctx,m,C,C,{facing:'out',lo:.10,hi:1,tight:1.2,bias:.05}));
  knurl(ctx,m,rBezOut-1,rGripIn+1,110);
  const rInsOut=rTopOut-W*0.03;
  band(ctx,rTopOut,rInsOut,tone(m,.28));
  band(ctx,rInsOut,rInCham,tone(m,.10));          /* dark recess floor */
  band(ctx,rInCham,rBezIn,bevelGrad(ctx,m,C,C,{facing:'in',lo:.06,hi:.92,tight:1.4}));
  ctx.save();ringPath(ctx,C,C,rBezOut,rGripIn);ctx.clip();
  microScratch(ctx,C,C,rGripIn,rBezOut,45,m.kind==='metal'?.8:.35);ctx.restore();
  applyFinish(ctx,m,o.finish,{r0:rGripIn,r1:rBezOut,amt:.8,grain:.7,clipRing:[rBezOut,rGripIn]});
  fresnelRim(ctx,C,C,rBezOut,m,.05);
  seam(ctx,C,C,rBezIn,{dark:.58,lite:.20,w:2.2,side:1});
  return}

 if(!wantInsert){/* fixed bezel: chamfer and grip bake with the rest */
  band(ctx,rBezOut,rGripIn,bevelGrad(ctx,m,C,C,{facing:'out',lo:.10,hi:1,tight:1.2,bias:.05}));
  if(rot)knurl(ctx,m,rBezOut-1,rGripIn+1,110);
  /* coin edge: finer knurling round a fixed ring, like the milled rim of a coin */
  else if(o.variant==='coin')knurl(ctx,m,rBezOut-1,rGripIn+1,200)}

 if(rotating){
  /* shape: only the engraved markings, white on nothing — the 3D insert cuts
     them into its surface (three/watch.js engravingMaps) */
  const engr=o.mode==='shape';
  const ins=o.insertColor||(o.variant==='gmt'?'#1c3f66':'#101318');
  const rInsOut=rTopOut-W*0.03,rInsIn=rInCham;
  /* only the insert disc itself — the metal rim around it lives on the ring */
  if(!engr)band(ctx,rInsOut,rInsIn,ins,()=>{
   /* A GMT insert is split day/night at the 6 and 18 marks. With 24 at twelve
      o'clock those fall at the 3 and 9 positions, so the division is horizontal
      and the night half is the bottom one. */
   if(o.variant==='gmt'){ctx.save();ctx.beginPath();ctx.moveTo(C,C);
    ctx.arc(C,C,rInsOut+2,0,Math.PI);ctx.closePath();
    ctx.fillStyle=shade(ins,.55);ctx.fill();ctx.restore()}
   if(flat)return;                                /* the sheen is light, not ink */
   const g=ctx.createLinearGradient(C-rInsOut,C-rInsOut,C+rInsOut*.5,C+rInsOut);
   g.addColorStop(0,'rgba(255,255,255,.20)');g.addColorStop(.32,'rgba(255,255,255,.04)');
   g.addColorStop(.64,'rgba(0,0,0,.24)');g.addColorStop(1,'rgba(255,255,255,.10)');
   ctx.fillStyle=g;ctx.fillRect(C-rInsOut,C-rInsOut,rInsOut*2,rInsOut*2)});
  /* inner shadow so the insert sits in a recess */
  if(!flat&&!engr){ctx.save();ringPath(ctx,C,C,rInsOut,rInsIn);ctx.clip();
   const sg=ctx.createRadialGradient(C,C,rInsIn,C,C,rInsOut);
   sg.addColorStop(0,'rgba(0,0,0,.45)');sg.addColorStop(.18,'rgba(0,0,0,0)');
   sg.addColorStop(.84,'rgba(0,0,0,0)');sg.addColorStop(1,'rgba(0,0,0,.42)');
   ctx.fillStyle=sg;ctx.fillRect(C-rInsOut,C-rInsOut,rInsOut*2,rInsOut*2);ctx.restore()}

  const pin=engr?'#fff':lumOf(ins)>0.5?'#15181c':'#e9ecef';
  const rMid=(rInsOut+rInsIn)/2;
  if(o.variant==='gmt'){
   for(let h=0;h<24;h++){const a=h*15;const[x0,y0]=posAt(a,rInsOut-3),[x1,y1]=posAt(a,rInsOut-3-W*(h%2?0.14:0.22));
    engrave(ctx,x0,y0,x1,y1,h%2?1.6:2.6,pin)}
   ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`700 ${W*0.42}px system-ui`;
   for(let h=0;h<24;h+=2){const a=h*15;const[x,y]=posAt(a,rMid-W*0.06);
    ctx.save();ctx.translate(x,y);ctx.rotate(a*Math.PI/180);ctx.fillStyle=pin;
    ctx.fillText(h===0?'24':String(h),0,0);ctx.restore()}}
  else{
   for(let i=0;i<60;i++){const a=i*6;const[x0,y0]=posAt(a,rInsOut-3),[x1,y1]=posAt(a,rInsOut-3-W*(i%5?0.16:0.30));
    engrave(ctx,x0,y0,x1,y1,i%5?1.8:3.4,pin)}
   ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`700 ${W*0.54}px system-ui`;
   for(const v of[10,20,30,40,50]){const a=v*6;const[x,y]=posAt(a,rMid-W*0.02);
    ctx.save();ctx.translate(x,y);ctx.rotate(a*Math.PI/180);ctx.fillStyle=pin;
    ctx.fillText(String(v),0,0);ctx.restore()}}
  /* lume pip in a polished metal surround (in 3D a raised mesh: bezelPipOf) */
  if(engr)return;
  const[px,py]=posAt(0,rMid-(o.variant==='gmt'?W*0.02:W*0.06));
  ctx.beginPath();ctx.arc(px,py,W*0.19,0,7);ctx.fillStyle=flat?m.base:tone(m,.86);ctx.fill();
  if(!flat){ctx.strokeStyle='rgba(0,0,0,.5)';ctx.lineWidth=1.4;ctx.stroke()}
  ctx.beginPath();ctx.arc(px,py,W*0.13,0,7);
  if(flat)ctx.fillStyle=o.lume||'#dff3e4';
  else{const lg=ctx.createLinearGradient(px,py-W*0.13,px,py+W*0.13);
   lg.addColorStop(0,'rgba(255,255,255,.55)');lg.addColorStop(.3,o.lume||'#dff3e4');
   lg.addColorStop(1,shade(o.lume||'#dff3e4',.3));ctx.fillStyle=lg}
  ctx.fill();
  return}                                          /* insert layer ends here */

 if(o.variant==='fluted'){const N=84;
  for(let i=0;i<N;i++){const a0=i/N*Math.PI*2,a1=(i+1)/N*Math.PI*2;
   ctx.beginPath();ctx.arc(C,C,rTopOut,a0,a1);ctx.arc(C,C,rInCham,a1,a0,true);ctx.closePath();
   const l=envLevel(m,(a0+a1)/2/(Math.PI*2)+.25);
   ctx.fillStyle=tone(m,clamp(i%2?l*0.40:l*1.35+.08,0,1));ctx.fill()}}

 else{/* smooth + tachymeter share a plain machined top face */
  band(ctx,rTopOut,rInCham,envGrad(ctx,m),()=>{
   /* even a polished bezel keeps faint concentric turning marks from machining */
   ctx.save();ctx.globalCompositeOperation='overlay';
   ctx.fillStyle=circGrain(ctx,rInCham,rTopOut,o.finish==='brushed'?.95:.30);
   ctx.fillRect(C-rTopOut,C-rTopOut,rTopOut*2,rTopOut*2);ctx.restore()});
  if(o.variant==='tachy')tachyScale(ctx,m,rTopOut,rInCham,W)}

 /* inner chamfer falling away to the crystal */
 band(ctx,rInCham,rBezIn,bevelGrad(ctx,m,C,C,{facing:'in',lo:.06,hi:.92,tight:1.4}));

 /* The Finish control has to reach every variant, not just the plain top face:
    on a diver or GMT it belongs on the metal grip ring and the chamfers, never
    on the printed insert; on a fluted bezel it rides the flutes. */
 if(rot)applyFinish(ctx,m,o.finish,{r0:rGripIn,r1:rBezOut,amt:.8,grain:.7,clipRing:[rBezOut,rGripIn]});
 else if(o.variant==='fluted')applyFinish(ctx,m,o.finish,{r0:rInCham,r1:rTopOut,amt:.7,grain:.8,clipRing:[rTopOut,rInCham]});
 applyFinish(ctx,m,o.finish,{r0:rBezIn,r1:rInCham,amt:.6,grain:.7,clipRing:[rInCham,rBezIn]});

 ctx.save();ringPath(ctx,C,C,rBezOut,rGripIn);ctx.clip();
 microScratch(ctx,C,C,rGripIn,rBezOut,45,m.kind==='metal'?.8:.35);ctx.restore();

 fresnelRim(ctx,C,C,rBezOut,m,.05);
 seam(ctx,C,C,rBezIn,{dark:.58,lite:.20,w:2.2,side:1});}
