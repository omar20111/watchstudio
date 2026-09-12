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
const {drProfile,drBack}=await import('./src/core/render/profile.js');
const L3=await import('./src/core/three/lathe.js');
const TR=await import('./src/core/three/tracer.js');

/* The tracer turns a baked silhouette into extruded hands and indices. The
   canvas mock draws nothing, so feed it a synthetic alpha field: a 60x30 px
   bar with a 20x10 px window cut out, plus a separate 10 px dot. */
{const W=1200,H=1200,a=new Uint8ClampedArray(W*H*4);
 const fill=(x0,y0,w,h,v)=>{for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++)a[(y*W+x)*4+3]=v};
 fill(600,300,60,30,255);fill(620,310,20,10,0);fill(400,700,10,10,255);
 const cv={width:W,height:H,getContext:()=>({getImageData:()=>({data:a})})};
 const loops=TR.traceLoops(cv);
 if(loops.length!==3)bad('tracer',`expected 3 loops (bar, window, dot), got ${loops.length}`);
 const shapes=TR.loopsToShapes(loops);
 if(shapes.length!==2)bad('tracer',`expected 2 solids, got ${shapes.length}`);
 const bar=shapes.find(s=>s.holes.length);
 if(!bar)bad('tracer','the window was not attached to the bar as a hole');
 else{const xs=bar.getPoints().map(p=>p.x),ys=bar.getPoints().map(p=>p.y);
  const wmm=Math.max(...xs)-Math.min(...xs),hmm=Math.max(...ys)-Math.min(...ys);
  if(Math.abs(wmm-60/PX)>.08||Math.abs(hmm-30/PX)>.08)bad('tracer',`bar traced ${wmm.toFixed(2)}x${hmm.toFixed(2)}mm, want ${(60/PX).toFixed(2)}x${(30/PX).toFixed(2)}`);
  /* 12 o'clock is +y: the bar sits above the dial centre (canvas y 300 < 600) */
  if(!(Math.min(...ys)>0))bad('tracer','traced shape is upside down (canvas up must be +y)')}
 const geo=TR.extrudeSilhouette(cv,{depth:.3,bevel:.04});
 if(!geo)bad('tracer','extrusion returned nothing');
 else{geo.computeBoundingBox();const bb=geo.boundingBox;
  if(Math.abs(bb.min.y)>1e-6||Math.abs(bb.max.y-.3)>1e-6)bad('tracer',`extrusion spans y ${bb.min.y.toFixed(3)}..${bb.max.y.toFixed(3)}, want 0..0.3`);
  geo.dispose()}}

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

let fails=0;
const bad=(name,msg)=>{fails++;console.log(`  FAIL  [${name}] ${msg}`)};

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

 /* the sheet's elevations must render too */
 try{const[cv,x]=M.mk(600);drProfile(x,d,{scale:.2,cx:300,cy:300});drBack(x,d,{scale:.2,cx:300,cy:300})}
 catch(e){bad(name,'profile/back threw: '+e.message)}

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

console.log(fails?`\nCOMBOS FAIL (${fails})`:'\nCOMBOS PASS');
if(fails)process.exit(1);
