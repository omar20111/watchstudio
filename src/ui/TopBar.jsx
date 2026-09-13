/* Top toolbar: project name, undo/redo, views, save/projects, exports.

   Everything fits in one row on a wide screen. As the screen narrows, actions
   move into a More menu rather than off the end of a sideways-scrolling bar,
   where on a phone most of them could not be found at all: the share and file
   exports first (below 1540 px), then AR, the 3D model and the PNGs (below
   1330 px), then saving, projects and reset (below 640 px). */
import React from 'react';
import {createPortal} from 'react-dom';
import {store,useApp} from '../state/store.js';
import {exportPNG} from '../export/png.js';
import {exportSpec} from '../export/spec.js';
import {exportLayered} from '../export/layered.js';
import {exportGLB} from '../export/glb.js';
import {copyShareLink} from '../export/shareUrl.js';
import {useMedia} from './gestures.js';
const {useEffect,useRef,useState}=React;

export function TopBar({onModal}){const s=useApp();
 const wide=useMedia('(min-width: 1541px)'),mid=useMedia('(min-width: 1330px)'),narrow=useMedia('(max-width: 640px)');
 const[menu,setMenu]=useState(null);             /* the More button's rect while open */
 const moreBtn=useRef();
 /* tier 'wide' leaves the row below 1540 px, 'mid' below 1330 px, 'narrow' below 640 px */
 const actions=[
  /* tier 'menu' never sits in the row */
  {tier:'menu',label:'Gallery',icon:'✦',run:()=>onModal('gallery'),aria:'Open the gallery of designs to start from'},
  {tier:'narrow',label:'Save',icon:'💾',run:()=>onModal('save'),cls:'text-[#e8c766]'},
  {tier:'narrow',label:'Projects',icon:'🗂',run:()=>onModal('projects')},
  {tier:'narrow',label:'Reset',icon:'⟲',run:()=>onModal('reset')},
  {tier:'wide',label:'Share',icon:'🔗',run:copyShareLink,aria:'Copy a share link for this design'},
  {tier:'wide',label:'Spec sheet',icon:'⤓',run:exportSpec,aria:'Export the spec sheet as text'},
  {tier:'wide',label:'Layered ZIP',icon:'⤓',run:exportLayered,aria:"Export every part's artwork and every view as a ZIP"},
  {tier:'mid',label:'View in AR',icon:'◎',run:()=>onModal('ar'),cls:'text-[#e8c766]',aria:'View this watch in AR at real size',
   title:'See it in your room at real size — on a phone, or scan a QR code from here'},
  {tier:'mid',label:'3D model',icon:'⤓',run:exportGLB,aria:'Export a 3D model (GLB) for Blender, AR and other 3D apps',
   title:'3D model (.glb) at real size, for Blender, AR viewers and product renderers'},
  {tier:'mid',label:'PNG 2×',icon:'⤓',run:()=>exportPNG(2),cls:'text-[#d4af37]',aria:'Export a 2x PNG'},
  {tier:'mid',label:'PNG 4×',icon:'⤓',run:()=>exportPNG(4),cls:'text-[#d4af37]',aria:'Export a 4x PNG'}];
 const inRow=a=>a.tier==='menu'?false:a.tier==='narrow'?!narrow:a.tier==='mid'?mid:wide;
 const hidden=actions.filter(a=>!inRow(a));
 const act=label=>actions.find(a=>a.label===label);
 const btn=a=><button key={a.label} className={`btn ${a.cls||''}`} aria-label={a.aria} title={a.title} onClick={a.run}>{a.icon} {a.label}</button>;
 const views=[['edit','Edit','Edit'],['product','Product render','Render'],['sheet','Design sheet','Sheet']];

 return<div className="h-12 shrink-0 flex items-center gap-2 px-3 border-b border-white/10 bg-[#16171b] overflow-x-auto whitespace-nowrap">
  <div className="flex items-center gap-2 mr-1 sm:mr-2 shrink-0"><div className="w-6 h-6 rounded-full border-2 border-[#d4af37] relative"><div className="absolute left-1/2 top-1/2 w-[2px] h-2 bg-[#d4af37] origin-bottom -translate-x-1/2 -translate-y-full rotate-[50deg]"/><div className="absolute left-1/2 top-1/2 w-[2px] h-2.5 bg-neutral-200 origin-bottom -translate-x-1/2 -translate-y-full -rotate-[60deg]"/></div>
   <span className="topbar-wordmark text-sm font-semibold tracking-wide">Watch<span className="text-[#d4af37]">Studio</span><span className="text-[10px] text-neutral-500 ml-1">v3</span></span></div>
  {/* on a phone there is no room for the name; Save names the project */}
  {!narrow&&<input className="bg-transparent border border-white/10 rounded px-2 py-1 text-xs w-32" aria-label="Project name" value={s.projName} onChange={e=>store.get().rename(e.target.value)}/>}
  <button className="btn" disabled={!s.past.length} onClick={s.undo} title="Undo (Ctrl+Z)" aria-label="Undo">↶{narrow?'':' Undo'}</button>
  <button className="btn" disabled={!s.future.length} onClick={s.redo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">↷{narrow?'':' Redo'}</button>
  {!narrow&&btn(act('Reset'))}
  <div className="flex items-center gap-1 ml-1 pl-2 border-l border-white/10">
   {views.map(([id,label,short])=>
    <button key={id} className={`chip ${s.d.view===id?'on':''}`} title={label} aria-label={label}
     onClick={()=>s.setD(n=>{n.view=id})}>{narrow?short:label}</button>)}
  </div>
  {!narrow&&<>{btn(act('Save'))}{btn(act('Projects'))}</>}
  <div className="flex-1"/>
  {actions.filter(a=>a.tier!=='narrow'&&a.tier!=='menu'&&inRow(a)).map(btn)}
  {hidden.length>0&&<button ref={moreBtn} className="btn shrink-0" aria-haspopup="menu" aria-expanded={!!menu} aria-label="More actions"
   onClick={()=>setMenu(m=>m?null:moreBtn.current.getBoundingClientRect())}>⋯{narrow?'':' More'}</button>}
  {menu&&<MoreMenu rect={menu} items={hidden} onClose={()=>setMenu(null)}/>}
 </div>}

/* The overflow actions, drawn at the page level: the toolbar scrolls sideways,
   which would clip a menu positioned inside it. */
function MoreMenu({rect,items,onClose}){const box=useRef();
 useEffect(()=>{const el=box.current;el&&el.querySelector('button')&&el.querySelector('button').focus();
  const key=e=>{if(e.key==='Escape'){e.stopPropagation();onClose()}};
  /* the More button toggles the menu itself: closing here as well would reopen it */
  const away=e=>{if(el&&!el.contains(e.target)&&!(e.target.closest&&e.target.closest('[aria-haspopup="menu"]')))onClose()};
  window.addEventListener('keydown',key,true);window.addEventListener('pointerdown',away,true);window.addEventListener('resize',onClose);
  return()=>{window.removeEventListener('keydown',key,true);window.removeEventListener('pointerdown',away,true);window.removeEventListener('resize',onClose)}},[]);
 const right=Math.max(8,window.innerWidth-rect.right);
 return createPortal(<div ref={box} role="menu" aria-label="More actions"
  className="fixed z-[95] min-w-[190px] rounded-lg border border-white/10 bg-[#1b1d23] shadow-2xl py-1"
  style={{top:rect.bottom+6,right}}>
  {items.map(a=><button key={a.label} role="menuitem" aria-label={a.aria} title={a.title}
   className={`w-full text-left px-3 py-2.5 text-[13px] hover:bg-white/10 focus:bg-white/10 outline-none ${a.cls||'text-neutral-200'}`}
   onClick={()=>{onClose();a.run()}}><span className="inline-block w-5 opacity-80">{a.icon}</span>{a.label}</button>)}
 </div>,document.body)}
