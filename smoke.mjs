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
/* a real in-memory store, so persistence is tested rather than discarded */
{const m=new Map();globalThis.localStorage={getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}}
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
/* ---- picking: a ray straight down into the built 3D watch ----
   sheet px -> mm on the dial plane; 12 o'clock is -z */
const pickAt=(watch,px,py,sel)=>{const rc=new M.Raycaster();
 rc.set(new M.Vector3((px-M.C)/M.PX,500,(py-M.C)/M.PX),new M.Vector3(0,-1,0));return M.pickPart3D(watch,rc,sel)};
const W0=M.buildHead(st.d,{});
const g=M.geoOf(st.d);
const center=pickAt(W0,M.C,M.C,'case');
const bezelHit=pickAt(W0,M.C,M.C-(g.rBezOut+g.rBezIn)/2,'case');
const lugHit=pickAt(W0,M.C+(g.sw*.5+g.R*.135*.95),M.C+(g.R+g.lugExt*.6),'dial');
const strapHit=pickAt(W0,M.C,M.C+g.R+g.lugExt+6*M.PX,'dial');
const miss=pickAt(W0,20,20,'dial');
expect(center==='dial',`click at centre should pick dial, got ${center}`);
expect(pickAt(W0,M.C,M.C,'hands')==='hands','clicking inside the dial should keep a selected hand selected');
expect(bezelHit==='bezel',`click on the bezel ring should pick bezel, got ${bezelHit}`);
expect(lugHit==='case',`click on a lug should pick the case, got ${lugHit}`);
expect(strapHit==='strap',`click past the lugs should pick the strap, got ${strapHit}`);
expect(miss===null,`click in the corner should pick nothing, got ${miss}`);
/* the crown is picked where it is built — at its bearing, not at 3 o'clock */
{const crownAt=(pos,deg)=>{const d=M.clone(M.DEF);d.case.crownPos=pos;const w=M.buildHead(d,{});
  const cp=M.crownParts(d),r=(cp.barrelX+g.crownR/M.PX*.6)*M.PX,a=deg*Math.PI/180;
  return pickAt(w,M.C+r*Math.sin(a),M.C-r*Math.cos(a),'case')};
 expect(crownAt('3',90)==='crown','a 3 o’clock crown must be pickable at 90deg');
 expect(crownAt('430',135)==='crown','a 4:30 crown must be pickable at 135deg');
 expect(crownAt('430',90)!=='crown','a 4:30 crown must NOT be pickable at 90deg')}
/* ---- transforms move the built watch without rebuilding it ---- */
{const d=M.clone(M.DEF),k0=M.headKey(d,{});
 d.parts.case.t.x=36;d.parts.hands.tM.r=90;d.parts.bezel.rot=30;d.zoom=2;d.camera='three-quarter';
 expect(M.headKey(d,{})===k0,'moving, rotating or zooming must not force a rebuild');
 M.applyPose(W0,d);const G=W0.userData.groups;
 expect(Math.abs(G.case.position.x-2)<1e-9,`a 36 px case offset should move the case 2 mm, moved ${G.case.position.x}`);
 const minHolder=G.hands.children.find(h=>h.name==='hand:min');
 expect(minHolder&&Math.abs(minHolder.rotation.y+Math.PI/2)<1e-9,'the minute hand transform must turn only the minute hand');
 d.case.thicknessMm=14;expect(M.headKey(d,{})!==k0,'a dimension change must rebuild')}
let thumbs=0;const want=Object.values(M.VARIANTS).reduce((a,v)=>a+v.length,0);
for(const part of Object.keys(M.VARIANTS))for(const v of M.VARIANTS[part]){
 expect(typeof M.getThumb(part,v,st.d)==='string',`thumbnail ${part}/${v} is not a data URL`);thumbs++}
expect(thumbs===want,`expected ${want} thumbnails, got ${thumbs}`);
const hy=M.hydrate({parts:{dial:{color:'#123456'}}});
expect(hy.parts.dial.color==='#123456','hydrate dropped a saved dial colour');
expect(hy.parts.case.metal===M.DEF.parts.case.metal,'hydrate did not fill unsaved fields from defaults');

/* ---- persistence round trips ----
   hydrate used to read a version nothing wrote, so every load re-ran the v4
   migration and overwrote case.crystal with the drawing's crystal preset. */
const rt=o=>JSON.parse(JSON.stringify(o));
{const bx=M.clone(M.DEF);bx.case.crystal='box';
 const h=M.hydrate(rt(bx),M.SCHEMA_VERSION);
 expect(M.caseOf(h).crystal==='box',`a saved box crystal reloaded as ${M.caseOf(h).crystal}`);
 const h2=M.hydrate(rt(h));
 expect(M.caseOf(h2).crystal==='box',`an unversioned current design lost its box crystal (${M.caseOf(h2).crystal})`)}
{/* v5 autosave: nested case, no version, and the stale second crystal field */
 const v5=M.clone(M.DEF);v5.case.crystal='box';v5.parts.crystal.variant='flat';
 const h=M.hydrate(rt(v5));
 expect(M.caseOf(h).crystal==='flat','v5 migration should keep the crystal that was drawn (flat)');
 expect(!('variant' in h.parts.crystal),'v6 still carries parts.crystal.variant after migration');
 expect(M.caseOf(M.hydrate(rt(h))).crystal==='flat','migrating twice changed the crystal')}
{/* v4 project: flat architecture fields, no version */
 const v4={caseMm:40,lugToLugMm:50.4,crystalMm:2.2,parts:{crystal:{variant:'flat'}}};
 const h=M.hydrate(rt(v4));
 expect(M.caseOf(h).crystal==='flat',`v4 crystal migrated to ${M.caseOf(h).crystal}`);
 expect(M.lugToLugOf(h)===50.4,`v4 lug-to-lug 50.4 became ${M.lugToLugOf(h)}`);
 expect(M.caseOf(h).crystalMm===2.2,`v4 crystal height 2.2 became ${M.caseOf(h).crystalMm}`)}
/* ---- the diver's ratchet turns anticlockwise only ---- */
{const S=M.store.get();S.upd(n=>{n.parts.bezel.variant='diver';n.parts.bezel.dir='ccw';n.parts.bezel.detents=60;n.parts.bezel.rot=0},'t');
 M.store.get().nudgeBezel(-1);
 expect(M.store.get().d.parts.bezel.rot===354,`an anticlockwise click on a CCW ratchet should land on 354deg, got ${M.store.get().d.parts.bezel.rot}`);
 M.store.get().nudgeBezel(1);
 expect(M.store.get().d.parts.bezel.rot===354,'a CCW ratchet must refuse a clockwise click');
 M.store.get().upd(n=>{n.parts.bezel.dir='bi'},'t');M.store.get().nudgeBezel(1);
 expect(M.store.get().d.parts.bezel.rot===0,'a bidirectional bezel must turn clockwise too');
 M.store.get().reset()}
/* ---- autosave and projects ---- */
{const S=M.store.get();
 expect(!S.hasWork(),'a fresh session reports work worth protecting');
 S.rename('Renamed watch');M.flushAutosave();
 const a=JSON.parse(localStorage.getItem('ws:auto')||'null');
 expect(a&&a.name==='Renamed watch','renaming the project was not autosaved');
 expect(a&&a.schemaVersion===M.SCHEMA_VERSION,'autosave does not record its schema version');
 S.upd(n=>{n.parts.dial.color='#223344'},'t');M.flushAutosave();
 expect(M.store.get().hasWork(),'an edited design is not reported as work to protect before a share link');
 expect(JSON.parse(localStorage.getItem('ws:auto')).d.parts.dial.color==='#223344','flushAutosave did not write the pending edit');
 const nm=M.store.get().uniqueProjectName('Renamed watch');expect(nm==='Renamed watch','unique name changed a free name');
 M.store.get().saveProject('Renamed watch');
 expect(M.store.get().uniqueProjectName('Renamed watch')==='Renamed watch 2','uniqueProjectName would overwrite an existing project');
 M.store.get().delProject('Renamed watch');
 expect(!JSON.parse(localStorage.getItem('ws:idx')).includes('Renamed watch'),'delProject left the project in the index');
 M.store.get().reset();M.flushAutosave()}
const m1=renderToString(React.createElement(M.SaveModal,{onClose:()=>{}}));
const m2=renderToString(React.createElement(M.ProjectsModal,{onClose:()=>{}}));
expect(m1.length>0&&m2.length>0,'a modal rendered empty');
M.exportSpec();M.exportProjectFile();
console.log('EXTRAS layers='+L.length+' center='+center+' lug='+lugHit+' strap='+strapHit+' bezel='+bezelHit+' thumbs='+thumbs+' modalChars='+(m1.length+m2.length));

const out=renderToString(React.createElement(M.App));
expect(out.length>1000,`<App/> server render is suspiciously short (${out.length} chars)`);
console.log('RENDER-TO-STRING ('+out.length+' chars)');

/* ---- no WebGL: the flat 2D drawing takes over ----
   Before this, a browser without WebGL 2 threw into the error boundary and its
   "Try again" threw again. */
{expect(M.webglState().ok,'the mocked browser should report WebGL as available');
 const d=M.clone(M.DEF),clock=M.sceneClock(d,0);
 const prep=await M.prepareFlat(d,{});
 expect(prep.below.width===M.CAN,`the flat static stack should be ${M.CAN}px, got ${prep.below.width}`);
 const over=prep.over.map(l=>l.key).join(',');
 expect(over==='hour,min,sec,crystal',`only the hands and crystal should draw per tick, got ${over}`);
 const[,ctx]=M.mk(600);let threw=null;try{M.drawFlat(ctx,prep,clock,.5)}catch(e){threw=e}
 expect(!threw,'drawFlat threw: '+(threw&&threw.message));
 expect((await M.prepareFlat(d,{},{mult:2})).below.width===M.CAN*2,'a 2x flat export should re-render at 2400px');
 const tq=M.clone(M.DEF);tq.camera='three-quarter';
 expect(M.stageCamera(tq,{})==='three-quarter','with WebGL the stage keeps a three-quarter camera');
 M.markWebglFailed('lost');
 expect(!M.webglState().ok&&M.webglState().reason==='lost','markWebglFailed did not switch views to the flat drawing');
 expect(M.stageCamera(tq,{})==='front','without WebGL the stage must fall back to the front camera');
 expect(M.exportCamera(tq,{})==='front-2d','without WebGL the PNG export must be the flat front drawing');
 const flatOut=renderToString(React.createElement(M.App));
 expect(/graphics driver stopped responding/.test(flatOut),'the app does not explain why the watch went flat');
 expect(M.retryWebgl()&&M.webglState().ok,'retryWebgl did not restore 3D once WebGL was available again')}
console.log(fails?`SMOKE FAIL (${fails})`:'SMOKE PASS');
if(fails)process.exit(1);
