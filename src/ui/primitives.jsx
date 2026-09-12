/* Shared UI primitives: sliders, pickers, layer views, modal shell. */
import React from 'react';
import {METALS} from '../core/constants.js';
const {useEffect,useRef,useState}=React;

export const GOLD='#d4af37';

export function CanvasHost({cv}){const ref=useRef();useEffect(()=>{const el=ref.current;if(cv&&cv.parentNode!==el)el.appendChild(cv);return()=>{if(cv&&cv.parentNode===el)el.removeChild(cv)}},[cv]);return<div ref={ref} className="absolute inset-0 w-full h-full"/>}

const sameMedia=(a,b)=>a&&b&&((a.cv&&a.cv===b.cv)||(a.url&&a.url===b.url));

export function LayerView({cv,url,t,rot=0,k,z,o=1,filter,glow,tex:ttx}){
 const media=cv?{cv}:{url};
 const[st,setSt]=useState({cur:media,prev:null});
 useEffect(()=>{setSt(s=>sameMedia(s.cur,media)?s:{cur:media,prev:s.cur})},[cv,url]);
 useEffect(()=>{if(!st.prev)return;const id=setTimeout(()=>setSt(s=>({...s,prev:null})),450);return()=>clearTimeout(id)},[st.prev]);
 let f=filter&&filter!=='none'?filter:'';if(glow)f+=` drop-shadow(0 0 7px ${glow})`;
 const wrap={position:'absolute',inset:0,zIndex:z,pointerEvents:'none',isolation:'isolate',opacity:o,filter:f||undefined,
  transform:`translate(${t.x*k}px,${t.y*k}px) rotate(${rot+t.r}deg) scale(${t.s})`,transformOrigin:'50% 50%'};
 const node=(m,fading)=>{const stl={position:'absolute',inset:0};if(fading){stl.transition='opacity .4s';stl.opacity=0}
  return<div key={fading?'p':'c'} style={stl} className="absolute inset-0">
   {m.cv?<CanvasHost cv={m.cv}/>:<img src={m.url} className="w-full h-full" draggable="false" alt=""/>}
   {m.url&&ttx&&<div className="absolute inset-0" style={{mixBlendMode:'soft-light',backgroundImage:`url(${ttx})`,backgroundSize:'220px',opacity:.6,WebkitMaskImage:`url(${m.url})`,maskImage:`url(${m.url})`,WebkitMaskSize:'100% 100%',maskSize:'100% 100%'}}/>}
  </div>};
 return<div style={wrap}>{st.prev&&node(st.prev,true)}{node(st.cur,false)}</div>}

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

export function Modal({title,children,onClose}){return(
 <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <div className="w-[380px] max-w-[90vw] max-h-[80vh] overflow-auto rounded-xl border border-white/10 bg-[#1b1d23] shadow-2xl">
   <div className="flex items-center justify-between px-4 pt-4 pb-1">
    <div className="text-base font-semibold text-[#e8c766]" style={{fontFamily:'Georgia, serif'}}>{title}</div>
    <button className="btn" onClick={onClose}>✕</button></div>
   <div className="px-4 pb-4 pt-2">{children}</div>
  </div>
 </div>)}
