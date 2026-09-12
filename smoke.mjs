/* Headless smoke test — run with: npm run smoke
   Mocks the browser APIs the renderers need, then executes the same
   assertions used during the v3 single-file validation:
   layer building, themes, shuffle, hit-testing, all preset thumbnails,
   modals, spec/project export, and a full server render of <App/>. */

/* ---- browser mocks (must be set up before the app modules load) ---- */
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
if(!globalThis.URL.revokeObjectURL)globalThis.URL.revokeObjectURL=()=>{};

/* ---- load the app (dynamic import so mocks are in place first) ---- */
const React=(await import('react')).default;
const {renderToString}=await import('react-dom/server');
const M=await import('./src/smokeExports.jsx');

/* Every result below is asserted, not just printed: a smoke test that logs
   `center=null` and still says PASS is not a test. */
let fails=0;
const expect=(ok,msg)=>{if(!ok){fails++;console.log('  FAIL  '+msg)}};

const d0=M.clone(M.DEF);
const L=M.buildLayers(d0,{});
expect(L.length===12,`default design should build 12 layers, got ${L.length}`);
for(const t of M.THEMES){const n=M.clone(M.DEF);t.apply(n);
 expect(M.buildLayers(n,{}).length>=12,`theme "${t.name}" built too few layers`)}
const n2=M.clone(M.DEF);M.shuffleInto(n2);
expect(M.buildLayers(n2,{}).length>=12,'shuffled design built too few layers');
const st=M.store.getState();
const center=M.pickPart(M.C,M.C,st.d,st.sel);
const g=M.geoOf(st.d);
const crownHit=M.pickPart(M.C+g.R+30,M.C,st.d,st.sel);
const strapHit=M.pickPart(M.C,1100,st.d,st.sel);
const bezelHit=M.pickPart(M.C,M.C-(g.rBezOut+g.rBezIn)/2,st.d,'case');
const miss=M.pickPart(20,20,st.d,st.sel);
expect(center==='dial',`click at centre should pick dial, got ${center}`);
expect(crownHit==='crown',`click beside the case at 3h should pick crown, got ${crownHit}`);
expect(strapHit==='strap',`click at the bottom of the sheet should pick strap, got ${strapHit}`);
expect(bezelHit==='bezel',`click on the bezel ring should pick bezel, got ${bezelHit}`);
expect(miss===null,`click in the corner should pick nothing, got ${miss}`);
let thumbs=0;const want=Object.values(M.VARIANTS).reduce((a,v)=>a+v.length,0);
for(const part of Object.keys(M.VARIANTS))for(const v of M.VARIANTS[part]){
 expect(typeof M.getThumb(part,v,st.d)==='string',`thumbnail ${part}/${v} is not a data URL`);thumbs++}
expect(thumbs===want,`expected ${want} thumbnails, got ${thumbs}`);
const hy=M.hydrate({parts:{dial:{color:'#123456'}}});
expect(hy.parts.dial.color==='#123456','hydrate dropped a saved dial colour');
expect(hy.parts.case.metal===M.DEF.parts.case.metal,'hydrate did not fill unsaved fields from defaults');
const m1=renderToString(React.createElement(M.SaveModal,{onClose:()=>{}}));
const m2=renderToString(React.createElement(M.ProjectsModal,{onClose:()=>{}}));
expect(m1.length>0&&m2.length>0,'a modal rendered empty');
M.exportSpec();M.exportProjectFile();
console.log('EXTRAS layers='+L.length+' center='+center+' crown='+crownHit+' strap='+strapHit+' bezel='+bezelHit+' thumbs='+thumbs+' modalChars='+(m1.length+m2.length));

const out=renderToString(React.createElement(M.App));
expect(out.length>1000,`<App/> server render is suspiciously short (${out.length} chars)`);
console.log('RENDER-TO-STRING ('+out.length+' chars)');
console.log(fails?`SMOKE FAIL (${fails})`:'SMOKE PASS');
if(fails)process.exit(1);
