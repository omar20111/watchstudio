/* Headless combination check — run with: npm run combos

   Renders the six review combinations through the real renderers under the same
   canvas mocks the smoke test uses, and asserts the construction invariants that
   a top-down watch must satisfy: the radial stack has to stay strictly ordered,
   the lugs have to reach the stated lug-to-lug, and nothing may render outside
   the sheet. Catches component intersections and broken proportions without
   needing eyes on every permutation. */

function makeGrad(){return{addColorStop(){}}}
function makeCtx(cv){const base={canvas:cv};
 return new Proxy(base,{get(t,p){if(p in t)return t[p];
  if(p==='createLinearGradient'||p==='createRadialGradient'||p==='createConicGradient')return()=>makeGrad();
  if(p==='createPattern')return()=>({});
  if(p==='getImageData'||p==='createImageData')return(x,y,w,h)=>({data:new Uint8ClampedArray(Math.max(4,(w||1)*(h||1)*4)),width:w||1,height:h||1});
  if(p==='measureText')return()=>({width:0});
  const fn=()=>undefined;t[p]=fn;return fn},
 set(t,p,v){t[p]=v;return true}})}
function makeCanvas(){const cv={width:0,height:0,parentNode:null,style:{},toDataURL:()=>'data:image/png;base64,STUB'};
 cv.getContext=function(){return this.__ctx||(this.__ctx=makeCtx(this))};return cv}
function el(){return{style:{},setAttribute(){},appendChild(){},removeChild(){},remove(){},click(){},addEventListener(){},removeEventListener(){},contains:()=>false,closest:()=>null,querySelector:()=>null,querySelectorAll:()=>[]}}
globalThis.document={createElement:t=>t==='canvas'?makeCanvas():el(),getElementById:()=>el(),body:el(),addEventListener(){},removeEventListener(){}};
globalThis.window={addEventListener(){},removeEventListener(){}};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
globalThis.CanvasRenderingContext2D=class{};
globalThis.requestAnimationFrame=()=>0;globalThis.cancelAnimationFrame=()=>{};
globalThis.ResizeObserver=class{observe(){}disconnect(){}};
if(!globalThis.URL.createObjectURL)globalThis.URL.createObjectURL=()=>'blob:x';

const M=await import('./src/smokeExports.jsx');
const G=await import('./src/core/geometry.js');
const {PX,CAN,C}=await import('./src/core/constants.js');
const L3=await import('./src/core/three/lathe.js');
const TR=await import('./src/core/three/tracer.js');
const RL=await import('./src/core/three/relief.js');

let fails=0;
const bad=(name,msg)=>{fails++;console.log(`  FAIL  [${name}] ${msg}`)};

/* The tracer and the relief grind a baked silhouette into shaped hands and
   indices. The canvas mock draws nothing, so feed them synthetic alpha fields. */
const alphaCanvas=paint=>{const W=1200,H=1200,a=new Uint8ClampedArray(W*H*4);paint((x,y,v)=>{a[(y*W+x)*4+3]=v});
 return{width:W,height:H,getContext:()=>({getImageData:()=>({data:a})})}};
const rect=(set,x0,y0,w,h,v=255)=>{for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++)set(x,y,v)};

/* a 60x30 px bar with a 20x10 px window cut out, plus a separate 10 px dot */
{const cv=alphaCanvas(set=>{rect(set,600,300,60,30);rect(set,620,310,20,10,0);rect(set,400,700,10,10)});
 const loops=TR.traceLoops(cv);
 if(loops.length!==3)bad('tracer',`expected 3 loops (bar, window, dot), got ${loops.length}`);
 const rel=RL.reliefFromSilhouette(cv,{profile:'bevel',height:.3,edge:.1,bevel:.4});
 if(!rel)bad('relief','nothing built from the bar');
 else{const g=rel.geometry;g.computeBoundingBox();const bb=g.boundingBox,p=g.attributes.position;
  if(Math.abs(bb.min.y)>1e-6||bb.max.y>.3+1e-6||bb.max.y<.25)bad('relief',`bar spans y ${bb.min.y.toFixed(3)}..${bb.max.y.toFixed(3)}, want 0..~0.3`);
  /* the bar sits above the dial centre: canvas y 300..330 is z -16.7..-15 mm (12 o'clock is -z) */
  let zMin=1e9,zMax=-1e9,xMin=1e9,xMax=-1e9;
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);if(x<-1)continue;   /* the bar, not the dot at x=-11 mm */
   zMin=Math.min(zMin,z);zMax=Math.max(zMax,z);xMin=Math.min(xMin,x);xMax=Math.max(xMax,x)}
  if(!(zMax<-14.9&&zMin>-16.8))bad('relief',`bar at z ${zMin.toFixed(2)}..${zMax.toFixed(2)}, want -16.7..-15`);
  if(Math.abs((xMax-xMin)-60/PX)>.1)bad('relief',`bar is ${(xMax-xMin).toFixed(2)}mm wide, want ${(60/PX).toFixed(2)}`);
  /* nothing may be built inside the window */
  let inWindow=0;for(let i=0;i<p.count;i++){const x=p.getX(i)*PX+600,z=p.getZ(i)*PX+600;if(x>621&&x<639&&z>311&&z<319)inWindow++}
  if(inWindow)bad('relief',`${inWindow} vertices inside the bar's window`);
  const n=g.attributes.normal;let bad0=0;for(let i=0;i<n.count;i++)if(!Number.isFinite(n.getX(i))||Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)>1e-3)bad0++;
  if(bad0)bad('relief',`${bad0} bad normals`)}}

/* A dauphine is two flat facets: ground against a straight edge, every point on
   a facet must share one normal. A long, thin, slightly slanted triangle is the
   hard case — its edges are the pixel staircases that used to ripple into ribs. */
{const tip=[600,200],base=[[585,500],[615,500]];
 const cv=alphaCanvas(set=>{for(let y=200;y<=500;y++){const t=(y-200)/300,hw=15*t;
  for(let x=Math.floor(600-hw)-1;x<=Math.ceil(600+hw)+1;x++){const cov=Math.max(0,Math.min(1,hw-Math.abs(x+.5-600)+.5));if(cov>0)set(x,y,Math.round(cov*255))}}});
 const rel=RL.reliefFromSilhouette(cv,{profile:'roof',height:.34,edge:.05});
 if(!rel)bad('relief','nothing built from the dauphine');
 else{const g=rel.geometry,p=g.attributes.position,n=g.attributes.normal;
  /* sample the left facet's top surface away from the rim, the ridge, the tip and the base */
  const nx=[];let ridge=0;
  for(let i=0;i<p.count;i++){const x=p.getX(i)*PX+600,y=p.getZ(i)*PX+600;
   if(n.getY(i)<.5)continue;                                  /* walls */
   const t=(y-200)/300,hw=15*t;
   /* at least 2.5 px from the ridge and from the rim, clear of the smoothing */
   if(y>260&&y<460&&x<600-Math.max(2.5,hw*.3)&&x>600-hw+2.5)nx.push(n.getX(i));
   if(Math.abs(y-400)<.01&&Math.abs(x-600)<.01)ridge=p.getY(i)}
  const mean=nx.reduce((a,b)=>a+b,0)/Math.max(1,nx.length),spread=Math.sqrt(nx.reduce((a,b)=>a+(b-mean)*(b-mean),0)/Math.max(1,nx.length));
  if(nx.length<40)bad('relief',`too few facet samples (${nx.length})`);
  if(spread>.01)bad('relief',`dauphine facet is not flat: normal x varies by ${spread.toFixed(4)} (ribs)`);
  /* two-thirds of the way to the base the ridge stands two-thirds of the way up */
  const want=.05+(.34-.05)*(10/15);
  if(Math.abs(ridge-want)>.03)bad('relief',`dauphine ridge at y=400 is ${ridge.toFixed(3)}mm high, want ~${want.toFixed(3)}mm`)}}

/* The 3D head must be built from the mm model, not beside it: its apex has to
   land on the stated thickness, its rings on geoOf's radii, and every profile
   has to be real numbers. This is the check the 2D profile view never had,
   which is how it drifted to its own 20/50/30 split. */
function checkHead(name,d){
 const{profiles:P,heights:H,radii:R}=L3.headProfiles(d),arch=G.caseOf(d);
 if(Math.abs(H.top-arch.thickness)>1e-6)bad(name,`3D apex ${H.top.toFixed(3)}mm != case thickness ${arch.thickness}mm`);
 const rs=[['rCase',R.rCase],['rSeat',R.rSeat],['rBezOut',R.rBezOut],['rBezIn',R.rBezIn],['dialR',R.dialR]];
 for(let i=1;i<rs.length;i++)if(!(rs[i-1][1]>rs[i][1]))bad(name,`3D ${rs[i-1][0]} must exceed ${rs[i][0]}`);
 for(const[k,pts]of Object.entries(P)){
  if(pts.length<2)bad(name,`3D profile ${k} has ${pts.length} points`);
  if(pts.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0))bad(name,`3D profile ${k} has a bad point`)}
 const apex=P.crystal[P.crystal.length-1];
 if(apex.x!==0||Math.abs(apex.y-H.top)>1e-6)bad(name,`3D crystal apex at (${apex.x},${apex.y}), expected (0,${H.top})`);
 if(!(H.back<H.seat&&H.seat<H.bezelTop&&H.bezelTop<H.top))bad(name,'3D heights out of order');
 const rh=P.rehaut;if(!(rh[0].y>rh[1].y&&rh[0].x>rh[1].x))bad(name,'3D rehaut must fall inward to the dial');
 try{for(const pts of Object.values(P))L3.lathe(pts,24).dispose()}catch(e){bad(name,'3D lathe threw: '+e.message)}

 /* lugs reach the stated lug-to-lug, sit under the chamfer, and drop toward the tip */
 const lp=L3.lugParts(d);
 const zs=lp.shapes.flatMap(s=>s.getPoints().map(p=>Math.abs(p.y)));
 const tip=Math.max(...zs),l2l=G.lugToLugOf(d)/2;
 if(Math.abs(tip-l2l)>.35)bad(name,`3D lug tips at ${tip.toFixed(2)}mm, lug-to-lug says ${l2l.toFixed(2)}mm`);
 if(!(lp.top<H.seat&&lp.bottom>H.back&&lp.thick>1))bad(name,`3D lugs out of the band (${lp.bottom.toFixed(2)}..${lp.top.toFixed(2)})`);
 /* crown stands outside the case band, on the mid-case */
 const cp=L3.crownParts(d);
 if(!(cp.barrelX>R.rCase))bad(name,`3D crown barrel at ${cp.barrelX.toFixed(2)}mm is inside the case (${R.rCase.toFixed(2)})`);
 if(!(cp.axisY>H.back&&cp.axisY<H.seat))bad(name,'3D crown axis is off the mid-case');
 if(arch.pushers!==(cp.pushers.length===2))bad(name,'3D pushers do not follow the case setting');
 /* the strap leaves the spring bar continuously and comes to rest below the head */
 const sp=L3.strapPath(d);let prev=sp.pos(0);
 for(let s=.5;s<80;s+=.5){const q=sp.pos(s);
  if(Math.hypot(q[0]-prev[0],q[1]-prev[1])>.51)bad(name,`3D strap jumps at s=${s}`);prev=q}
 if(!(sp.groundY<0))bad(name,`3D strap rests at y=${sp.groundY.toFixed(2)}, above the caseback`)}

const COMBOS=[
 ['steel case + leather strap',      d=>{d.parts.case.metal='steel';d.parts.case.finish='brushed';d.parts.strap.variant='leather'}],
 ['rose-gold case + leather strap',  d=>{d.parts.case.metal='rose';d.parts.case.finish='polished';d.parts.strap.variant='leather'}],
 ['diver bezel + steel bracelet',    d=>{d.parts.bezel.variant='diver';d.parts.strap.variant='steel';d.parts.case.variant='sport'}],
 ['GMT bezel + steel bracelet',      d=>{d.parts.bezel.variant='gmt';d.parts.strap.variant='steel'}],
 ['fluted bezel + dress dial',       d=>{d.parts.bezel.variant='fluted';d.parts.dial.variant='guilloche';d.parts.markers.variant='roman'}],
 ['domed crystal + polished case',   d=>{d.case.crystal='dome';d.parts.case.finish='polished';d.case.crystalMm=2.6},
  /* the height has to reach the geometry, or this combo tests the default crystal */
  d=>Math.abs(G.crystalMmOf(d)-2.6)<1e-9||`crystal height ${G.crystalMmOf(d)}mm, expected 2.6mm`],
];


for(const[name,apply,check]of COMBOS){
 const d=M.clone(M.DEF);apply(d);
 if(check){const r=check(d);if(r!==true)bad(name,r)}
 let layers;
 try{layers=M.buildLayers(d,{})}catch(e){bad(name,'buildLayers threw: '+e.message);continue}
 if(!layers.length){bad(name,'no layers');continue}

 const g=G.geoOf(d);
 /* the construction stack must stay strictly ordered, or components intersect */
 const stack=[['dialR',g.dialR],['rBezIn',g.rBezIn],['rBezOut',g.rBezOut],['rSeat',g.rSeat],['rCase',g.rCase]];
 for(let i=1;i<stack.length;i++)
  if(!(stack[i][1]>stack[i-1][1]))bad(name,`${stack[i][0]} (${stack[i][1].toFixed(1)}) must exceed ${stack[i-1][0]} (${stack[i-1][1].toFixed(1)})`);
 if(g.rehautW<=0)bad(name,`rehaut collapsed to ${g.rehautW.toFixed(2)}px`);
 if(g.crystalR>g.rBezOut)bad(name,'crystal wider than the bezel outer edge');

 /* lugs must reach the stated lug-to-lug and stay on the sheet */
 const l2lPx=G.lugToLugOf(d)*PX;
 if(Math.abs((g.R+g.lugExt)*2-l2lPx)>1.5)bad(name,`lug span ${((g.R+g.lugExt)*2/PX).toFixed(1)}mm != lug-to-lug ${(l2lPx/PX).toFixed(1)}mm`);
 if(C+g.R+g.lugExt>CAN)bad(name,'lugs run off the 1200px sheet');
 const crownTip=C+g.R+g.crownR*1.8;
 if(crownTip>CAN)bad(name,`crown tip at ${crownTip.toFixed(0)}px exceeds the sheet`);

 /* every procedural layer must actually render */
 for(const l of layers){if(!l.proc)continue;
  try{M.getProc(l.proc[0],d,l.proc[1])}catch(e){bad(name,`${l.proc[0]} renderer threw: ${e.message}`)}}

 checkHead(name,d);
 for(const crystal of['flat','dome','box']){const d2=M.clone(d);d2.case.crystal=crystal;checkHead(`${name} / ${crystal} crystal`,d2)}

 /* the whole 3D watch must build — every lathe, extrusion, strap and bake */
 try{const w=M.buildHead(d,{});if(!w.userData.groups.case.children.length)bad(name,'3D case built empty')}
 catch(e){bad(name,'3D build threw: '+e.message)}
 for(const cb of['solid','exhibition','engraved']){const d2=M.clone(d);d2.case.caseback=cb;d2.case.pushers=true;d2.parts.case.variant='sport';d2.case.crownPos='430';
  try{M.buildHead(d2,{})}catch(e){bad(name,`3D build (${cb} back, pushers, guards, 4:30) threw: ${e.message}`)}}

 console.log(`  ok    ${name} — ${layers.length} layers, dial ${(g.dialR*2/PX).toFixed(1)}mm, `+
  `bezel ${G.bezelMmOf(d)}mm, rehaut ${G.rehautMmOf(d)}mm, L2L ${G.lugToLugOf(d)}mm`);
}

/* dimension sweep: extreme parameter values must not invert the stack or push
   a part off the sheet — these are exactly the corners the UI sliders allow */
for(const caseMm of[34,40,46])for(const bezelMm of[1.2,2.5,5.5]){
 const d=M.clone(M.DEF);d.caseMm=caseMm;d.bezelMm=bezelMm;
 const g=G.geoOf(d);
 if(!(g.rBezIn>g.dialR))bad(`sweep ${caseMm}/${bezelMm}`,'bezel swallowed the rehaut');
 if(!(g.rBezOut>g.rBezIn))bad(`sweep ${caseMm}/${bezelMm}`,'bezel inverted');
 for(const thicknessMm of[6,12,20]){const d2=M.clone(d);d2.case.thicknessMm=thicknessMm;checkHead(`sweep ${caseMm}/${bezelMm}/${thicknessMm}mm`,d2)}
}
for(const caseMm of[34,40,46])for(const crownMm of[3.5,6.5,10])for(const v of['standard','oversized']){
 const d=M.clone(M.DEF);d.caseMm=caseMm;d.crownMm=crownMm;d.parts.crown.variant=v;
 const g=G.geoOf(d),sc=v==='oversized'?1.22:1;
 const tip=C+g.R+g.crownR*0.30+g.crownR*1.5*sc;
 if(tip>CAN)bad(`crown ${caseMm}/${crownMm}/${v}`,`tip at ${tip.toFixed(0)}px runs off the ${CAN}px sheet`);
}
/* lug length is the v5 input (lug-to-lug is derived from it); sweep the slider's
   full 3-12 mm range, not the v4 top-level field nothing reads any more */
for(const caseMm of[34,40,46])for(const lugLenMm of[3,6.5,12]){
 const d=M.clone(M.DEF);d.caseMm=caseMm;d.case.lugLenMm=lugLenMm;
 const g=G.geoOf(d),tag=`lug ${caseMm}/${lugLenMm}`;
 const wantLen=Math.max(lugLenMm,G.lugLenMinOf(caseMm));
 if(G.caseOf(d).lugLen!==wantLen)bad(tag,`lug length ${G.caseOf(d).lugLen}mm, expected ${wantLen}mm`);
 if(C+g.R+g.lugExt>CAN)bad(tag,'lug tip runs off the sheet');
 if(Math.abs((g.R+g.lugExt)*2-G.lugToLugOf(d)*PX)>1.5)bad(tag,`lug span ${((g.R+g.lugExt)*2/PX).toFixed(1)}mm != lug-to-lug ${G.lugToLugOf(d)}mm`);
}

/* dial construction: a date window is cut through the plate, so it has to stay
   clear of the minute track (or the chapter step), of the registers and of the
   dial's edge; the wheel under it has to cover it; neighbouring days must not
   show in it; and the index it replaces has to be the one under it */
for(const caseMm of[34,40,46])for(const variant of['sunburst','chrono'])for(const date of['none','3','430','6'])for(const step of['flat','stepped']){
 const d=M.clone(M.DEF);d.caseMm=caseMm;Object.assign(d.parts.dial,{variant,date,step});
 const L=G.dialLayoutOf(d),tag=`dial ${caseMm}/${variant}/date ${date}/${step}`;
 if(variant==='chrono'&&date==='6'&&L.date!=='430')bad(tag,'a chronograph date at 6 should move to 4:30');
 if(L.subdials.length!==(variant==='chrono'?3:0))bad(tag,`expected ${variant==='chrono'?3:0} registers, got ${L.subdials.length}`);
 for(const sd of L.subdials)if(Math.hypot(sd.x-C,sd.y-C)+sd.r>=(step==='stepped'?L.stepR:L.r*.9))bad(tag,`the ${sd.key} register reaches the ${step==='stepped'?'chapter step':'minute track'}`);
 checkHead(tag,d);
 if(!L.win){if(date!=='none')bad(tag,'no window for a date');continue}
 const w=L.win,hx=w.w/2+w.frame,hy=w.h/2+w.frame;
 const corners=[[-1,-1],[1,-1],[-1,1],[1,1]].map(([sx,sy])=>[w.x+sx*hx,w.y+sy*hy]);
 const reach=Math.max(...corners.map(([x,y])=>Math.hypot(x-C,y-C)));
 const limit=step==='stepped'?L.stepR:L.r*.905;       /* long track ticks end at 0.908 r */
 if(reach>=limit)bad(tag,`window frame reaches ${(reach/L.r).toFixed(3)} r, past ${(limit/L.r).toFixed(3)} r`);
 for(const sd of L.subdials){
  const nx=Math.max(w.x-hx,Math.min(sd.x,w.x+hx)),ny=Math.max(w.y-hy,Math.min(sd.y,w.y+hy));
  if(Math.hypot(sd.x-nx,sd.y-ny)<=sd.r)bad(tag,`window overlaps the ${sd.key} register`)}
 const cr=Math.hypot(w.x-C,w.y-C),span=Math.hypot(w.w,w.h)/2+w.frame*3;
 const near=Math.min(...corners.map(([x,y])=>Math.hypot(x-C,y-C)));
 if(reach>cr+span||near<cr-span)bad(tag,'the date wheel does not cover the window');
 const want={'3':3,'6':6,'430':null}[L.date];
 if(w.skipHour!==want)bad(tag,`the window should replace index ${want}, replaces ${w.skipHour}`);
 /* the wheel's pitch against the window's extent along the wheel's travel there,
    less half a numeral (bold digits ~0.56 em wide each, ~0.72 em tall) */
 const pitch=cr*2*Math.PI/31,tx=Math.abs(Math.cos(w.deg*Math.PI/180)),ty=Math.abs(Math.sin(w.deg*Math.PI/180));
 const font=w.h*.72,halfTravel=tx*w.w/2+ty*w.h/2,glyphHalf=tx*font*.56+ty*font*.36;
 if(pitch-glyphHalf<=halfTravel)bad(tag,`neighbouring days would show (pitch ${pitch.toFixed(1)}px, window ${halfTravel.toFixed(1)}px)`);
}

console.log(fails?`\nCOMBOS FAIL (${fails})`:'\nCOMBOS PASS');
if(fails)process.exit(1);
