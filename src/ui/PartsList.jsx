/* Left sidebar: parts list, themes & shuffle, scene settings. */
import React from 'react';
import {BG} from '../core/constants.js';
import {PARTS} from '../core/parts.js';
import {useApp,store} from '../state/store.js';
import {THEMES,shuffleInto} from '../state/themes.js';
import {ICONS} from './icons.jsx';
import {downscale} from '../core/utils.js';
const {useRef}=React;

export function PartsList(){const s=useApp();const d=s.d;const inp=useRef();
 return<div className="w-48 shrink-0 border-r border-white/10 bg-[#141519] p-2 flex flex-col gap-1 overflow-y-auto">
  <div className="text-[10px] uppercase tracking-widest text-neutral-500 px-1 pb-1">Parts</div>
  {PARTS.map(([id,label],i)=><button key={id} onClick={()=>s.select(id)}
   className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs border ${s.sel===id?'bg-[#d4af37]/15 border-[#d4af37]/50 text-[#e8c766]':'border-transparent text-neutral-300 hover:bg-white/5'}`}>
   <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" stroke="currentColor">{ICONS[id]}</svg>
   <span className="flex-1">{label}</span>
   {d.active[id]&&<span className="w-1.5 h-1.5 rounded-full bg-[#d4af37]" title="custom upload"/>}
   <span className="text-[9px] text-neutral-600">{i+1}</span></button>)}
  <div className="text-[10px] uppercase tracking-widest text-neutral-500 px-1 pt-3 pb-1">Themes</div>
  <div className="flex flex-wrap gap-1 px-1">
   {THEMES.map(t=><button key={t.id} className="chip" title="Apply theme" onClick={()=>store.get().upd(n=>{t.apply(n)},'theme')}>{t.name}</button>)}
   <button className="chip" title="Randomize everything" onClick={()=>store.get().upd(n=>{shuffleInto(n)},'shuffle')}>🎲 Shuffle</button></div>
  <div className="text-[10px] uppercase tracking-widest text-neutral-500 px-1 pt-3 pb-1">Scene</div>
  <div className="flex flex-wrap gap-1 px-1">{Object.entries(BG).map(([id,b])=>
   <button key={id} className={`chip ${d.bg===id?'on':''}`} onClick={()=>{if(b.upload){inp.current.click()}else s.setD(n=>{n.bg=id})}}>{b.label}</button>)}
   <input ref={inp} type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files[0];if(!f)return;
    /* A phone photo is several MB of base64. bgCustom lives inside the design,
       which is deep-cloned on every edit and kept 50 deep in undo history, so
       storing it raw blows the localStorage quota and silently kills autosave.
       Downscale to something a backdrop actually needs. */
    downscale(f,1600,.82).then(url=>s.setD(n=>{n.bgCustom=url;n.bg='wrist'}));e.target.value=''}}/>
   {d.bg==='wrist'&&!d.bgCustom&&<span className="text-[10px] text-neutral-500">drop a wrist photo…</span>}</div>
  <label className="flex items-center gap-2 text-[11px] text-neutral-400 px-1 pt-1"><input type="checkbox" checked={d.shadow} onChange={e=>s.setD(n=>{n.shadow=e.target.checked})}/>Drop shadow</label>
 </div>}
