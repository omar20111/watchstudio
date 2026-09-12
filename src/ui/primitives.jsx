/* Shared UI primitives: sliders, pickers, modal shell. */
import React from 'react';
import {METALS} from '../core/constants.js';
const {useEffect,useRef,useState}=React;

export const GOLD='#d4af37';

export function Slider({label,min,max,step,val,onChange,fmt}){return<label className="block text-[11px] text-neutral-400 mb-1">
 <div className="flex justify-between"><span>{label}</span><span className="text-neutral-300 tabular-nums">{fmt?fmt(val):val}</span></div>
 <input type="range" className="w-full" min={min} max={max} step={step} value={val} onChange={e=>onChange(+e.target.value)}/></label>}

export function MetalRow({val,onChange}){return<div className="flex gap-1.5 flex-wrap">{Object.entries(METALS).map(([id,m])=>
 <button key={id} title={m.name} onClick={()=>onChange(id)} className={`w-7 h-7 rounded-full border-2 ${val===id?'border-[#d4af37]':'border-white/15'}`} style={{background:`linear-gradient(135deg, ${m.hi}, ${m.base} 45%, ${m.lo})`}}/>)}</div>}

export function FinishRow({val,onChange}){return<div className="flex gap-1">{['none','brushed','polished','matte'].map(f=>
 <button key={f} className={`chip capitalize ${val===f?'on':''}`} onClick={()=>onChange(f)}>{f}</button>)}</div>}

export function ColorField({label,val,onChange}){return<label className="flex items-center gap-2 text-[11px] text-neutral-400">{label}
 <input type="color" value={val} onChange={e=>onChange(e.target.value)}/><span className="text-neutral-500">{val}</span></label>}

export function Section({title,children}){return<div className="space-y-2"><div className="text-[10px] uppercase tracking-widest text-neutral-500">{title}</div>{children}</div>}

/* A dialog: announced as one, closes on Escape, keeps Tab inside itself, and
   hands focus back to whatever opened it. */
let modalSeq=0;
export function Modal({title,children,onClose}){const box=useRef();const[id]=useState(()=>'modal-title-'+(++modalSeq));
 useEffect(()=>{const prev=document.activeElement;const el=box.current;
  const first=el&&el.querySelector('[autofocus],input,button:not([aria-label="Close"]),select,textarea');
  (first||el)&&(first||el).focus();
  const key=e=>{if(e.key==='Escape'){e.stopPropagation();onClose();return}
   if(e.key!=='Tab'||!el)return;
   const f=[...el.querySelectorAll('button,input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x=>!x.disabled);
   if(!f.length)return;const a=f[0],z=f[f.length-1];
   if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}
   else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}};
  window.addEventListener('keydown',key,true);
  return()=>{window.removeEventListener('keydown',key,true);if(prev&&prev.focus)prev.focus()}},[]);
 return(
 <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <div ref={box} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}
   className="w-[380px] max-w-[90vw] max-h-[80vh] overflow-auto rounded-xl border border-white/10 bg-[#1b1d23] shadow-2xl outline-none">
   <div className="flex items-center justify-between px-4 pt-4 pb-1">
    <div id={id} className="text-base font-semibold text-[#e8c766]" style={{fontFamily:'Georgia, serif'}}>{title}</div>
    <button className="btn" aria-label="Close" onClick={onClose}>✕</button></div>
   <div className="px-4 pb-4 pt-2">{children}</div>
  </div>
 </div>)}

/* A value that only updates once it has stopped changing for `ms`. Preset
   thumbnails are full 1200² bakes; recomputing five of them on every tick of a
   dimension slider is what made dragging one stutter. */
export function useSettled(value,ms=220){const[v,setV]=useState(value);
 useEffect(()=>{if(v===value)return;const t=setTimeout(()=>setV(value),ms);return()=>clearTimeout(t)},[value]);
 return v}
