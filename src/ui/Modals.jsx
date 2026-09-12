/* Save / Projects modals (reset confirm lives in App). */
import React from 'react';
import {store,useApp} from '../state/store.js';
import {toast} from '../core/utils.js';
import {exportProjectFile,importProjectFile} from '../export/projectFile.js';
import {Modal} from './primitives.jsx';
const {useRef,useState}=React;

export function SaveModal({onClose}){const s=useApp();const[name,setName]=useState(s.projName);
 const save=()=>{if(name.trim()){if(store.get().saveProject(name.trim()))toast('Saved "'+name.trim()+'"')}onClose()};
 return<Modal title="Save project" onClose={onClose}>
  <label className="block text-[11px] text-neutral-400 mb-1">Project name
   <input className="tin mt-1" value={name} autoFocus onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')save()}}/></label>
  <button className="goldbtn w-full mt-3" onClick={save}>Save project</button>
 </Modal>}

export function ProjectsModal({onClose}){const[,force]=useState(0);const imp=useRef();
 const idx=(()=>{try{return JSON.parse(localStorage.getItem('ws:idx')||'[]')}catch(e){return[]}})();
 const rows=idx.map(n=>{try{const r=JSON.parse(localStorage.getItem('ws:p:'+n)||'{}');return{n,ts:r.ts||0}}catch(e){return{n,ts:0}}});
 return<Modal title="Saved projects" onClose={onClose}>
  {rows.length===0&&<p className="text-xs text-neutral-500">No saved projects yet.</p>}
  {rows.map(({n,ts})=><div key={n} className="mb-2 rounded-lg border border-white/10 p-2.5">
   <div className="flex items-baseline justify-between"><div className="text-[13px]">{n}</div>
    <div className="text-[10px] text-neutral-500">{ts?new Date(ts).toLocaleDateString():''}</div></div>
   <div className="mt-1.5 flex gap-1.5">
    <button className="btn flex-1" onClick={()=>{store.get().loadProject(n);onClose()}}>Load</button>
    <button className="btn" onClick={()=>{store.get().dupProject(n);force(x=>x+1)}}>Duplicate</button>
    <button className="btn text-red-400" onClick={()=>{store.get().delProject(n);force(x=>x+1)}}>Delete</button></div></div>)}
  <div className="mt-3 flex gap-1.5">
   <button className="btn flex-1" onClick={exportProjectFile}>⤓ Export as file</button>
   <button className="btn flex-1" onClick={()=>imp.current.click()}>⤒ Import file</button>
   <input ref={imp} type="file" accept="application/json,.json" className="hidden"
    onChange={e=>{const f=e.target.files[0];if(f)importProjectFile(f,onClose);e.target.value=''}}/></div>
 </Modal>}
