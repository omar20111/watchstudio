/* The first minute: a gallery of finished designs to start from, then three
   short steps — case, dial, strap — with the full editor always one click away.

   Shown to a first-time visitor who arrives with no design of their own and no
   share link; anyone can reopen it from the ⋯ menu (Gallery). The gallery's
   pictures are real renders of each theme, made one at a time in the
   background so the page stays responsive; the flat drawing stands in where
   there is no WebGL. */
import React from 'react';
import {store,useApp,DEF} from '../state/store.js';
import {THEMES} from '../state/themes.js';
import {clone} from '../core/utils.js';
import {METALS} from '../core/constants.js';
import {VARIANTS,VNAME} from '../core/parts.js';
import {marketingClock} from '../core/time.js';
import {renderStill} from '../core/three/view.js';
import {webglState} from '../core/three/support.js';
import {flatCanvas} from '../export/flat.js';
const {useEffect,useRef,useState}=React;

const WELCOMED='ws:welcomed';
/* first visit, nothing of their own, not arriving on a shared design */
export function shouldWelcome(){
 try{if(localStorage.getItem(WELCOMED))return false}catch(e){}
 if(typeof location!=='undefined'&&/[#&][wz]=/.test(location.hash||''))return false;
 return !store.get().hasWork()}
export const markWelcomed=()=>{try{localStorage.setItem(WELCOMED,'1')}catch(e){}};

const themeDesign=t=>{const d=clone(DEF);t.apply(d);d.time={...d.time,mode:'set',h:10,m:8,s:36};return d};

/* renders of every theme, filled in one at a time; kept for the session */
const stills=new Map();
function useThemeStills(){const[,tick]=useState(0);
 useEffect(()=>{let alive=true;
  (async()=>{for(const t of THEMES){if(!alive)return;if(stills.has(t.id))continue;
   const d=themeDesign(t);
   try{const cv=webglState().ok
     ?await renderStill(d,{},{w:320,h:320,camera:'three-quarter',clock:marketingClock(d)})
     :await flatCanvas(d,{},{size:320,background:false});
    stills.set(t.id,cv.toDataURL('image/png'))}
   catch(e){stills.set(t.id,null)}
   if(alive)tick(x=>x+1);
   /* let the page breathe between renders */
   await new Promise(r=>setTimeout(r,30))}})();
  return()=>{alive=false}},[]);
 return stills}

export function Welcome({onClose,onStart}){
 const imgs=useThemeStills(),box=useRef();
 useEffect(()=>{box.current&&box.current.focus();
  const k=e=>{if(e.key==='Escape'){e.stopPropagation();onClose()}};
  window.addEventListener('keydown',k,true);return()=>window.removeEventListener('keydown',k,true)},[]);
 /* the watch as pictured: a theme applied to a fresh design, not layered over
    whatever was there (undo brings the old one back) */
 const choose=t=>{store.get().upd(n=>{const b=clone(DEF);if(t)t.apply(b);
   Object.assign(n,{caseMm:b.caseMm,strapMm:b.strapMm,bezelMm:b.bezelMm,crownMm:b.crownMm,case:b.case,parts:b.parts,active:{}})},t?'theme':'blank');
  markWelcomed();onStart()};
 return<div className="fixed inset-0 z-[110] overflow-y-auto bg-[#0e0f12]/[.97]" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
  {/* focused so Escape and Tab start here; the global focus ring is for keyboard moves, not this */}
  <div ref={box} tabIndex={-1} className="max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-12" style={{outline:'none'}}>
   <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
    <div>
     <h1 id="welcome-title" className="text-2xl sm:text-3xl text-[#e8c766]" style={{fontFamily:'Georgia, serif'}}>Design your own watch</h1>
     <p className="text-[13px] text-neutral-400 mt-2 max-w-xl">Start from one of these, or from a blank watch. Every part — case, dial, hands, strap — can be changed, and you can see it in 3D, take photos and place it in your room in AR.</p></div>
    <div className="flex gap-2">
     <button className="btn" onClick={()=>choose(null)}>Start blank</button>
     <button className="btn" onClick={()=>{markWelcomed();onClose()}}>Skip to the editor</button></div></div>
   <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" aria-label="Designs to start from">
    {THEMES.map(t=>{const src=imgs.get(t.id),d=themeDesign(t);
     return<li key={t.id}><button onClick={()=>choose(t)} aria-label={`Start from ${t.name}`}
      className="group w-full text-left rounded-xl overflow-hidden border border-white/10 hover:border-[#d4af37]/70 focus-visible:border-[#d4af37] bg-[#16171b]">
      <span className="block aspect-square" style={{background:'radial-gradient(115% 85% at 50% 8%, #4a4e56 0%, #2c2f35 46%, #141519 100%)'}}>
       {src?<img src={src} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"/>
        :<span className="w-full h-full flex items-center justify-center text-[11px] text-neutral-500">{src===null?'':'Rendering…'}</span>}</span>
      <span className="block px-2.5 py-2">
       <span className="block text-[12px] text-neutral-100">{t.name}</span>
       <span className="block text-[10px] text-neutral-500">{d.caseMm} mm · {(METALS[d.parts.case.metal]||{}).name}</span></span>
     </button></li>})}
   </ul>
  </div>
 </div>}

/* ---------------------------------------------------------------- quick start */

const Chips=({label,opts,val,onPick})=><div role="group" aria-label={label} className="flex flex-wrap gap-1">{opts.map(([v,t])=>
 <button key={v} className={`chip ${val===v?'on':''}`} aria-pressed={val===v} onClick={()=>onPick(v)}>{t}</button>)}</div>;
const Swatches=({label,colors,val,onPick})=><div role="group" aria-label={label} className="flex flex-wrap gap-1.5">{colors.map(c=>
 <button key={c} aria-label={`${label} ${c}`} aria-pressed={val===c} onClick={()=>onPick(c)}
  className={`w-7 h-7 rounded-full border-2 ${val===c?'border-[#d4af37]':'border-white/15'}`} style={{background:c}}/>)}</div>;
const Label=({children})=><div className="text-[10px] uppercase tracking-widest text-neutral-500 mt-3 mb-1.5">{children}</div>;

const STEPS=['Case','Dial','Strap'];
export function QuickStart({onClose}){const s=useApp(),d=s.d,P=d.parts;const[step,setStep]=useState(0);
 const upd=(fn,tag)=>s.upd(fn,tag);
 const metals=Object.entries(METALS).map(([id,m])=>[id,m.name]);
 const finishLeft=()=>{onClose()};
 /* a region, not a dialog: the editor's shortcuts stay live beside it */
 return<div role="region" aria-label="Quick start" className="absolute z-[80] left-2 right-2 bottom-2 sm:left-3 sm:right-auto sm:bottom-auto sm:top-14 sm:w-[340px] max-h-[62%] sm:max-h-[calc(100%-5rem)] overflow-y-auto rounded-xl border border-white/10 bg-[#16171b]/95 backdrop-blur shadow-2xl p-3">
  <div className="flex items-center justify-between">
   <ol className="flex items-center gap-1 text-[11px]" aria-label="Steps">{STEPS.map((n,i)=>
    <li key={n}><button className={`chip ${i===step?'on':''}`} aria-current={i===step?'step':undefined} onClick={()=>setStep(i)}>{i+1} · {n}</button></li>)}</ol>
   <button className="btn" aria-label="Close quick start" onClick={finishLeft}>✕</button></div>
  {step===0&&<>
   <Label>Metal</Label>
   <Chips label="Metal" opts={metals} val={P.case.metal} onPick={v=>upd(n=>{for(const k of['case','bezel','crown'])n.parts[k].metal=v;
    if(!['ceramic','carbon'].includes(v))n.parts.hands.metal=v},'qs:metal')}/>
   <Label>Size · {d.caseMm} mm</Label>
   <input type="range" min={34} max={46} step={0.5} value={d.caseMm} aria-label="Case size in millimetres" className="w-full"
    onChange={e=>upd(n=>{n.caseMm=+e.target.value},'qs:mm')}/>
   <Label>Bezel</Label>
   <Chips label="Bezel" opts={VARIANTS.bezel.map(v=>[v,VNAME[v]||v])} val={P.bezel.variant} onPick={v=>upd(n=>{n.parts.bezel.variant=v},'qs:bezel')}/>
  </>}
  {step===1&&<>
   <Label>Dial</Label>
   <Chips label="Dial style" opts={VARIANTS.dial.map(v=>[v,VNAME[v]||v])} val={P.dial.variant} onPick={v=>upd(n=>{n.parts.dial.variant=v},'qs:dial')}/>
   <Label>Colour</Label>
   <Swatches label="Dial colour" colors={['#16324f','#101214','#e8e6e0','#f1ece0','#1d3a2a','#4a1f24','#c2ab80','#1f3d73']} val={P.dial.color} onPick={c=>upd(n=>{n.parts.dial.color=c},'qs:dialc')}/>
   <Label>Hour markers</Label>
   <Chips label="Hour markers" opts={VARIANTS.markers.map(v=>[v,VNAME[v]||v])} val={P.markers.variant} onPick={v=>upd(n=>{n.parts.markers.variant=v},'qs:markers')}/>
   <Label>Hands</Label>
   <Chips label="Hands" opts={VARIANTS.hands.map(v=>[v,VNAME[v]||v])} val={P.hands.variant} onPick={v=>upd(n=>{n.parts.hands.variant=v},'qs:hands')}/>
  </>}
  {step===2&&<>
   <Label>Strap</Label>
   <Chips label="Strap" opts={VARIANTS.strap.map(v=>[v,VNAME[v]||v])} val={P.strap.variant} onPick={v=>upd(n=>{n.parts.strap.variant=v},'qs:strap')}/>
   {['leather','rubber','nato'].includes(P.strap.variant)&&<><Label>Colour</Label>
    <Swatches label="Strap colour" colors={['#6b4a2f','#3b2416','#2b2118','#15161a','#1d3a2a','#16324f','#c96a2b','#e6e3dc']} val={P.strap.color} onPick={c=>upd(n=>{n.parts.strap.color=c},'qs:strapc')}/></>}
  </>}
  <div className="flex items-center justify-between gap-2 mt-4">
   <button className="btn" disabled={step===0} onClick={()=>setStep(step-1)}>Back</button>
   {step<STEPS.length-1
    ?<button className="goldbtn" onClick={()=>setStep(step+1)}>Next: {STEPS[step+1]}</button>
    :<button className="goldbtn" onClick={finishLeft}>Done — open the full editor</button>}</div>
  <p className="text-[10px] text-neutral-500 mt-2">Everything else — hands’ lume, text, your logo, the case’s thickness — is in the full editor.</p>
 </div>}
