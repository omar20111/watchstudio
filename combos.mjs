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

const COMBOS=[
 ['steel case + leather strap',      d=>{d.parts.case.metal='steel';d.parts.case.finish='brushed';d.parts.strap.variant='leather'}],
 ['rose-gold case + leather strap',  d=>{d.parts.case.metal='rose';d.parts.case.finish='polished';d.parts.strap.variant='leather'}],
 ['diver bezel + steel bracelet',    d=>{d.parts.bezel.variant='diver';d.parts.strap.variant='steel';d.parts.case.variant='sport'}],
 ['GMT bezel + steel bracelet',      d=>{d.parts.bezel.variant='gmt';d.parts.strap.variant='steel'}],
 ['fluted bezel + dress dial',       d=>{d.parts.bezel.variant='fluted';d.parts.dial.variant='guilloche';d.parts.markers.variant='roman'}],
 ['domed crystal + polished case',   d=>{d.parts.crystal.variant='dome';d.parts.case.finish='polished';d.case.crystalMm=2.6},
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
