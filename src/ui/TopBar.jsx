/* Top toolbar: project name, undo/redo, save/projects, exports. */
import React from 'react';
import {store,useApp} from '../state/store.js';
import {exportPNG} from '../export/png.js';
import {exportSpec} from '../export/spec.js';
import {exportLayered} from '../export/layered.js';
import {copyShareLink} from '../export/shareUrl.js';

export function TopBar({onModal}){const s=useApp();
 return<div className="h-12 shrink-0 flex items-center gap-2 px-3 border-b border-white/10 bg-[#16171b] overflow-x-auto whitespace-nowrap">
  <div className="flex items-center gap-2 mr-2"><div className="w-6 h-6 rounded-full border-2 border-[#d4af37] relative"><div className="absolute left-1/2 top-1/2 w-[2px] h-2 bg-[#d4af37] origin-bottom -translate-x-1/2 -translate-y-full rotate-[50deg]"/><div className="absolute left-1/2 top-1/2 w-[2px] h-2.5 bg-neutral-200 origin-bottom -translate-x-1/2 -translate-y-full -rotate-[60deg]"/></div>
   <span className="text-sm font-semibold tracking-wide">Watch<span className="text-[#d4af37]">Studio</span><span className="text-[10px] text-neutral-500 ml-1">v3</span></span></div>
  <input className="bg-transparent border border-white/10 rounded px-2 py-1 text-xs w-32" value={s.projName} onChange={e=>store.set({projName:e.target.value})}/>
  <button className="btn" disabled={!s.past.length} onClick={s.undo} title="Ctrl+Z">↶ Undo</button>
  <button className="btn" disabled={!s.future.length} onClick={s.redo} title="Ctrl+Shift+Z">↷ Redo</button>
  <button className="btn" onClick={()=>onModal('reset')}>⟲ Reset</button>
  <div className="flex items-center gap-1 ml-1 pl-2 border-l border-white/10">
   {[['edit','Edit'],['product','Product render'],['sheet','Design sheet']].map(([id,label])=>
    <button key={id} className={`chip ${s.d.view===id?'on':''}`} title={label}
     onClick={()=>s.setD(n=>{n.view=id})}>{label}</button>)}
  </div>
  <button className="btn text-[#e8c766]" onClick={()=>onModal('save')}>💾 Save</button>
  <button className="btn" onClick={()=>onModal('projects')}>🗂 Projects</button>
  <div className="flex-1"/>
  <button className="btn" aria-label="Copy a share link for this design" onClick={copyShareLink}>🔗 Share</button>
  <button className="btn" aria-label="Export the spec sheet as text" onClick={exportSpec}>⤓ Spec sheet</button>
  <button className="btn" aria-label="Export every layer and both cameras as a ZIP" onClick={exportLayered}>⤓ Layered ZIP</button>
  <button className="btn text-[#d4af37]" aria-label="Export a 2x PNG" onClick={()=>exportPNG(2)}>⤓ PNG 2×</button>
  <button className="btn text-[#d4af37]" aria-label="Export a 4x PNG" onClick={()=>exportPNG(4)}>⤓ PNG 4×</button>
 </div>}
