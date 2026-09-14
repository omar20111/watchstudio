/* Application store: design state, undo/redo with drag coalescing,
   autosave, named projects, import/export hydration. */
import React from 'react';
import {clone,toast,normDeg} from '../core/utils.js';
import {DEF_CASE,snapDetent,detentOf,bezelRotOf,bezelRotatable} from '../core/geometry.js';
import * as IMG from '../core/images.js';
const {useSyncExternalStore}=React;

export const TT=()=>({s:1,r:0,x:0,y:0,o:1});

/* Bump whenever the shape of a saved project changes; migrateProject walks
   old files forward rather than letting hydrate() silently drop what it does
   not recognise. */
export const SCHEMA_VERSION=7;

/* Flat dimensions that survive at the top level. Case ARCHITECTURE moved into
   the nested `case` object — see migrateProject for the v4 -> v5 move. */
export const DIMS=['caseMm','strapMm','bezelMm','crownMm'];

export const DEF={caseMm:40,strapMm:'auto',
 bezelMm:'auto',crownMm:'auto',
 case:DEF_CASE(),
 view:'edit',camera:'front',zoom:1,shadow:true,bg:'studio',bgCustom:null,active:{},
 /* the product render's staging: the surface the watch lies on, and how much a
    photo's lens blurs what is out of focus */
 product:{surface:'studio',blur:'soft'},
 chrono:{running:false,elapsed:0,start:0},
 time:{mode:'live',sweep:true,h:10,m:8,s:36,date:28,gmtOffsetH:0},
 parts:{
  strap:{variant:'leather',color:'#6b4a2f',stitch:'#e0cfa6',metal:'steel',finish:'none',t:TT()},
  case:{variant:'classic',metal:'steel',finish:'polished',t:TT()},
  crown:{variant:'standard',metal:'steel',finish:'polished',t:TT()},
  bezel:{variant:'smooth',metal:'steel',finish:'polished',insertColor:'#101318',rot:0,detents:120,dir:'ccw',t:TT()},
  /* date: none | 3 | 430 | 6 — a window onto a date wheel; step: flat | stepped chapter ring */
  dial:{variant:'sunburst',color:'#16324f',finish:'none',date:'3',step:'stepped',text:{top:'WatchStudio',bottom:'AUTOMATIC',font:'serif',color:'auto'},
   logo:{style:'print',color:'ink',size:.34,y:-.6},t:TT()},
  markers:{variant:'batons',lume:'#dff3e4',glow:false,t:TT()},
  hands:{variant:'dauphine',metal:'steel',finish:'polished',lume:'#dff3e4',glow:false,
   secColor:'#e8482c',tH:TT(),tM:TT(),tS:TT()},
  /* no `variant`: the crystal's shape is case.crystal (see migrateProject v6) */
  crystal:{finish:'polished',opacity:0.65,cyclops:false,t:TT()}}};

/* Walk an older saved project forward. Runs BEFORE hydrate so hydrate only
   ever sees current-shape input.
   v4 kept case architecture as flat 'auto' fields; v5 nests them. The old
   lug-to-lug number is preserved by inverting the lug-length formula, so a
   project saved at 50.4 mm still measures 50.4 mm after the move. */
export function migrateProject(o){
 if(!o||typeof o!=='object')return o;
 const p={...o},d=p.d&&typeof p.d==='object'?{...p.d}:null;
 if(!d)return p;
 /* Autosaves never carried a version before v6, so a missing one has to be
    inferred from shape rather than assumed to be 0 — assuming 0 re-ran the v4
    migration on every load. A nested `case` object only exists from v5 on. */
 const v=+p.schemaVersion||(d.case&&typeof d.case==='object'?5:0);
 if(v<5){
  const c={...DEF_CASE(),...(d.case||{})};
  const num=x=>{const n=+x;return Number.isFinite(n)?n:null};
  const thick=num(d.caseThickMm);if(thick!=null)c.thicknessMm=thick;
  const crys=num(d.crystalMm);if(crys!=null)c.crystalMm=crys;
  const l2l=num(d.lugToLugMm),cm=num(d.caseMm)||40;
  /* lugToLug = caseMm + 2*(lugLen*0.55)  ->  lugLen = (l2l-caseMm)/1.1 */
  if(l2l!=null&&l2l>cm)c.lugLenMm=Math.round(((l2l-cm)/1.1)*100)/100;
  d.case=c;
  delete d.caseThickMm;delete d.lugToLugMm;delete d.crystalMm;delete d.rehautMm;
 }
 /* v6: one field for the crystal's shape. v5 had two — case.crystal fed the
    thickness stack and parts.crystal.variant fed the drawing — and they drifted.
    The drawing is what the user designed by eye, so the old variant wins. */
 if(v<6&&d.parts&&d.parts.crystal){
  const parts={...d.parts},cr={...parts.crystal};
  if(['flat','dome','box'].includes(cr.variant))d.case={...DEF_CASE(),...(d.case||{}),crystal:cr.variant};
  delete cr.variant;parts.crystal=cr;d.parts=parts;
 }
 /* v7: dials gained a date window and a stepped chapter ring, both on by default
    for new designs. A design saved before then was drawn without either, so it
    keeps that look rather than silently growing a date window. */
 if(v<7&&d.parts&&d.parts.dial){
  const parts={...d.parts},dl={...parts.dial};
  if(dl.date==null)dl.date='none';
  if(dl.step==null)dl.step='flat';
  parts.dial=dl;d.parts=parts;
 }
 p.d=d;p.schemaVersion=SCHEMA_VERSION;return p}

/* merge a saved (possibly older) state on top of defaults.
   Every mutable nest is deep-copied: `upd` clones the whole design per edit,
   but anything that slipped in by reference here would be shared with the
   caller's object and the first in-place edit would corrupt history. */
export function hydrate(saved,schemaVersion){const d=clone(DEF);if(!saved)return d;
 const s=(migrateProject({d:saved,schemaVersion}).d)||saved;
 for(const k of DIMS)if(s[k]!=null)d[k]=s[k];
 d.bg=s.bg??d.bg;d.bgCustom=s.bgCustom??null;d.shadow=s.shadow!==false;
 d.view=s.view==='product'||s.view==='sheet'?s.view:'edit';
 d.camera=['profile','three-quarter','back'].includes(s.camera)?s.camera:'front';
 if(s.case)d.case={...d.case,...clone(s.case)};
 if(s.time)d.time={...d.time,...clone(s.time)};
 if(s.chrono)d.chrono={...d.chrono,...clone(s.chrono)};
 if(s.product)d.product={...d.product,...clone(s.product)};
 if(s.active)d.active=clone(s.active);
 for(const k in d.parts){if(s.parts&&s.parts[k])Object.assign(d.parts[k],clone(s.parts[k]))}
 /* fields earlier builds wrote but nothing ever read — drop them from old saves */
 for(const f of['hourVariant','minVariant','gmt','gmtColor','smallsec'])delete d.parts.hands[f];
 return d}

let pT;const loadAuto=()=>{try{const r=localStorage.getItem('ws:auto');return r?JSON.parse(r):null}catch(e){return null}};
/* Don't latch the warning off permanently: once quota is hit, every later edit
   is also unsaved, and a user who saw one toast an hour ago has no idea their
   work has stopped persisting. Re-warn, but not on every keystroke. */
let autoWarnedAt=0;
/* Only metadata is persisted. Blobs live in IndexedDB (core/images.js) — a
   data: URL in here is what used to blow the quota on the first upload. */
const strip=customs=>{const out={};
 for(const part in customs){out[part]={};
  for(const id in customs[part])out[part][id]={name:customs[part][id].name}}
 return out};
const writeAuto=get=>{
 try{localStorage.setItem('ws:auto',JSON.stringify({d:get().d,customs:strip(get().customs),name:get().projName,schemaVersion:SCHEMA_VERSION}))}
 catch(e){const now=Date.now();if(now-autoWarnedAt>30000){autoWarnedAt=now;
  toast('Browser storage is full — changes are NOT being saved')}}};
let pGet=null;
const persist=get=>{clearTimeout(pT);pGet=get;pT=setTimeout(()=>{pT=null;writeAuto(get)},600)};
/* The debounce alone lost whatever was edited in the last 600 ms before the tab
   closed. pagehide also fires on mobile, where beforeunload often does not. */
export function flushAutosave(){if(pT==null||!pGet)return;clearTimeout(pT);pT=null;writeAuto(pGet)}
if(typeof window!=='undefined'&&window.addEventListener){
 window.addEventListener('pagehide',flushAutosave);window.addEventListener('beforeunload',flushAutosave)}

/* what makes one design different from another — not which view, zoom or
   backdrop it happens to be looked at through */
const designKey=d=>JSON.stringify({caseMm:d.caseMm,strapMm:d.strapMm,bezelMm:d.bezelMm,crownMm:d.crownMm,
 case:d.case,parts:d.parts,active:d.active});
const projectIndex=()=>{try{return JSON.parse(localStorage.getItem('ws:idx')||'[]')}catch(e){return[]}};

const initStore=(set,get)=>{const auto=loadAuto()||{};return{
 d:hydrate(auto.d,auto.schemaVersion),customs:auto.customs||{},projName:auto.name||'My Watch',
 sel:'case',past:[],future:[],_tag:null,_t:0,vault:{ok:true,message:null},
 select:p=>set({sel:p}),
 /* renaming used to write straight to the store, so the new name was lost on
    reload unless some other edit happened to trigger an autosave */
 rename(name){set({projName:name});persist(get)},
 /* true when there is something worth protecting before a share link replaces it */
 hasWork(){const s=get();
  return designKey(s.d)!==designKey(hydrate(null))||Object.values(s.customs).some(c=>Object.keys(c||{}).length)},
 uniqueProjectName(base){const idx=projectIndex();let n=base,k=2;while(idx.includes(n))n=`${base} ${k++}`;return n},
 upd(fn,tag){const s=get();const next=clone(s.d);fn(next);const now=Date.now();
  const past=(tag&&tag===s._tag&&now-s._t<900)?s.past:[...s.past.slice(-99),s.d];
  set({d:next,past,future:[],_tag:tag||null,_t:now});persist(get)},
 setD(fn){const s=get();const next=clone(s.d);fn(next);set({d:next});persist(get)},
 /* which view you are looking through is not part of the design — carry it
    across history so undo cannot teleport you out of a presentation mode */
 undo(){const s=get();if(!s.past.length)return;set({d:{...s.past[s.past.length-1],view:s.d.view},past:s.past.slice(0,-1),future:[s.d,...s.future].slice(0,100),_tag:null});persist(get)},
 redo(){const s=get();if(!s.future.length)return;set({d:{...s.future[0],view:s.d.view},future:s.future.slice(1),past:[...s.past.slice(-99),s.d],_tag:null});persist(get)},
 reset(){const s=get();set({d:{...clone(DEF),view:s.d.view},past:[...s.past.slice(-99),s.d],future:[],_tag:null});persist(get)},
 addUpload(part,name,url){const id='u'+Date.now().toString(36)+Math.floor(Math.random()*999);
  /* optimistic: show it immediately, then persist the blob to the vault */
  set(s=>({customs:{...s.customs,[part]:{...(s.customs[part]||{}),[id]:{name,url}}}}));
  get().upd(n=>{n.active[part]=id},'upload');
  IMG.save(id,url).then(ok=>{
   const u=ok?IMG.urlFor(id):null;
   if(u)set(s=>({customs:{...s.customs,[part]:{...(s.customs[part]||{}),[id]:{name,url:u}}}}));
   if(!ok)set({vault:IMG.vaultStatus()})})},
 setSource(part,id){get().upd(n=>{n.active[part]=id},'source')},
 /* Rotate the bezel to an absolute angle, honouring detents and direction.
    A diver ratchets counter-clockwise only: it must refuse to run backwards
    past 12, because elapsed dive time can never legitimately read LESS. */
 setBezelRot(deg,tag){const s=get();if(!bezelRotatable(s.d))return;
  const n=detentOf(s.d),dir=s.d.parts.bezel.dir==='ccw'?'ccw':'bi';
  const cur=bezelRotOf(s.d);
  let next=snapDetent(deg,n);
  if(dir==='ccw'){
   /* Shortest signed way round from cur to next. Angles run clockwise, so a
      counter-clockwise click is a NEGATIVE delta and that is the only one a
      diver's ratchet allows: turning it anticlockwise can only make elapsed
      time read longer. This used to forbid the negative delta instead, so the
      "CCW ratchet" only ever turned clockwise — the unsafe direction. */
   let delta=((next-cur+540)%360)-180;
   if(delta>1e-9)next=cur;
  }
  if(next===cur)return;
  get().upd(m=>{m.parts.bezel.rot=next},tag||'bezel');},
 nudgeBezel(dir){const s=get();if(!bezelRotatable(s.d))return;
  const n=detentOf(s.d),step=n>0?360/n:5;
  get().setBezelRot(bezelRotOf(s.d)+dir*step,'bezel')},
 resetBezel(){const s=get();if(!bezelRotatable(s.d))return;
  if(bezelRotOf(s.d)===0)return;
  get().upd(m=>{m.parts.bezel.rot=0},'bezelReset')},
 /* chronograph transport — pure state, the clock derives everything else */
 chronoToggle(){const s=get(),c=s.d.chrono||{};const now=Date.now();
  get().upd(m=>{m.chrono=c.running
   ?{running:false,elapsed:Math.max(0,now-(Number.isFinite(+c.start)?+c.start:now)),start:0}
   :{running:true,elapsed:0,start:now-(+c.elapsed||0)}},'chrono')},
 chronoReset(){get().upd(m=>{m.chrono={running:false,elapsed:0,start:0}},'chronoReset')},
 delUpload(part,id){set(s=>{const c={...(s.customs[part]||{})};delete c[id];return{customs:{...s.customs,[part]:c}}});
  IMG.release(id);IMG.del(id);
  if(get().d.active[part]===id)get().upd(n=>{n.active[part]=null})},
 /* Resolve every referenced blob from the vault after a reload or a project
    load. Anything that cannot be found is reported, not silently swallowed. */
 async rehydrateImages(){
  /* clear the sticky failure first, or the banner's Retry re-reads the old error
     and can never succeed */
  IMG.clearStatus();
  const c=get().customs,ids=[];
  for(const part in c)for(const id in c[part])ids.push(id);
  if(!ids.length){set({vault:IMG.vaultStatus()});return}
  const missing=await IMG.resolve(ids);
  const next={};
  for(const part in c){next[part]={};
   for(const id in c[part]){const u=IMG.urlFor(id);
    next[part][id]={...c[part][id],url:u||c[part][id].url||null,missing:!u&&!c[part][id].url}}}
  const st=IMG.vaultStatus();
  set({customs:next,vault:missing.length
   ?{ok:false,message:`${missing.length} uploaded image${missing.length>1?'s are':' is'} missing from the image vault`}
   :st})},
 /* strip() here too, not just in autosave: customs now carries blob: object
    URLs, which are dead the moment the page reloads. Writing them into a named
    project produced a project that loaded with every upload broken. The blobs
    themselves are already in the vault; loadProject resolves them back. */
 saveProject(name){const s=get();try{localStorage.setItem('ws:p:'+name,JSON.stringify({d:s.d,customs:strip(s.customs),name,ts:Date.now(),schemaVersion:SCHEMA_VERSION}));
  const idx=JSON.parse(localStorage.getItem('ws:idx')||'[]');if(!idx.includes(name))idx.push(name);
  localStorage.setItem('ws:idx',JSON.stringify(idx));set({projName:name});persist(get);return true}catch(e){toast('Browser storage is full — remove old projects/uploads.');return false}},
 loadProject(name){try{const r=JSON.parse(localStorage.getItem('ws:p:'+name)||'null');
  if(r){set({d:hydrate(r.d,r.schemaVersion),customs:r.customs||{},projName:name,past:[],future:[],_tag:null});
   /* resolve the blobs this project references out of the vault. Projects
      saved before the vault existed carry data: URLs inline; rehydrateImages
      keeps those as-is when the vault has no matching id. */
   get().rehydrateImages&&get().rehydrateImages();
   persist(get)}}catch(e){toast('Could not load project')}},
 dupProject(name){try{const r=JSON.parse(localStorage.getItem('ws:p:'+name)||'null');if(!r)return;
  const idx=JSON.parse(localStorage.getItem('ws:idx')||'[]');let n2=name+' copy',k=2;
  while(idx.includes(n2)){n2=name+' copy '+k++}
  localStorage.setItem('ws:p:'+n2,JSON.stringify({...r,name:n2,ts:Date.now()}));
  idx.push(n2);localStorage.setItem('ws:idx',JSON.stringify(idx))}catch(e){toast('Browser storage is full')}},
 delProject(name){const gone=[];
  try{const r=JSON.parse(localStorage.getItem('ws:p:'+name)||'null');
   if(r&&r.customs)for(const part in r.customs)for(const id in r.customs[part])gone.push(id)}catch(e){}
  localStorage.removeItem('ws:p:'+name);
  const idx=projectIndex().filter(n=>n!==name);localStorage.setItem('ws:idx',JSON.stringify(idx));
  /* A deleted project's images used to stay in IndexedDB forever. They are only
     garbage once nothing else points at them: another project (a duplicate
     shares ids), or the design that is open right now. */
  if(!gone.length)return;
  const live=new Set(),add=c=>{for(const part in(c||{}))for(const id in c[part])live.add(id)};
  add(get().customs);
  for(const n of idx){try{add(JSON.parse(localStorage.getItem('ws:p:'+n)||'{}').customs)}catch(e){}}
  for(const id of gone)if(!live.has(id)){IMG.release(id);IMG.del(id)}},
 /* both callers (project file, share link) have already run migrateProject, so
    an absent version means the design is current, not that it is v0 */
 importState(o){set({d:hydrate(o.d,o.schemaVersion??SCHEMA_VERSION),customs:o.customs||{},projName:o.name||'Imported watch',past:[],future:[],_tag:null});
  get().rehydrateImages&&get().rehydrateImages();persist(get)}}};

export const store=(()=>{let st;const subs=new Set();const get=()=>st;const set=p=>{st=Object.assign({},st,typeof p==='function'?p(st):p);subs.forEach(f=>f())};const api={set,setState:set,get,getState:get,subscribe:f=>{subs.add(f);return()=>subs.delete(f)}};st=initStore(set,get);return api})();

export const useApp=()=>useSyncExternalStore(store.subscribe,store.getState,store.getState);

/* shared transform patcher (panel sliders, canvas drag, keyboard nudge).
   For the hands group (no custom upload), the hour hand is the reference:
   apply each changed key as a DELTA to the minute/second hands too, so
   moving/rotating the whole assembly preserves any per-hand offset the
   user dialed in individually instead of snapping all three together. */
export function patchPartT(part,patch,tag){store.get().upd(n=>{const p=n.parts[part];
 if(part==='hands'&&!n.active.hands){const base=p.tH,tM={...p.tM},tS={...p.tS};
  for(const k in patch){const delta=patch[k]-base[k];
   tM[k]=k==='r'?normDeg(tM[k]+delta):tM[k]+delta;
   tS[k]=k==='r'?normDeg(tS[k]+delta):tS[k]+delta}
  p.tH=Object.assign({},base,patch);p.tM=tM;p.tS=tS}
 else p.t=Object.assign({},p.t,patch)},tag)}
