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

/* A share link arrived while the visitor had a design of their own open. Keep
   theirs in Projects before replacing it — never replace it silently. */
export function SharedModal({shared,onClose}){const s=useApp();const[failed,setFailed]=useState(false);
 const open=force=>{const st=store.get();
  if(!force){const backup=st.uniqueProjectName(`${st.projName} (before shared link)`);
   if(!st.saveProject(backup)){setFailed(true);return}
   toast(`Your design was kept in Projects as "${backup}"`)}
  st.importState({d:shared.d,name:shared.name,customs:{}});onClose()};
 return<Modal title="Open a shared design?" onClose={onClose}>
  <p className="text-xs text-neutral-400 mb-3">This link contains <span className="text-neutral-200">“{shared.name}”</span>.
   Opening it replaces what is on screen; your current design, <span className="text-neutral-200">“{s.projName}”</span>, is saved to Projects first.</p>
  {failed&&<p role="alert" className="text-[11px] text-amber-300 mb-3">Your design could not be saved — browser storage is full.
   Export it from Projects first, or open the link anyway and lose it.</p>}
  <div className="flex gap-2">
   <button className="btn flex-1" onClick={onClose}>Keep my design</button>
   {failed?<button className="btn flex-1 text-red-400" onClick={()=>open(true)}>Open anyway</button>
    :<button className="goldbtn flex-1" onClick={()=>open(false)}>Open shared design</button>}</div>
 </Modal>}

export function ProjectsModal({onClose}){const[,force]=useState(0);const imp=useRef();
 /* delete is the one irreversible action here, so it takes a second click */
 const[confirm,setConfirm]=useState(null);
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
    {confirm===n
     ?<button className="btn text-red-300 border-red-400/60" autoFocus onBlur={()=>setConfirm(null)}
       onClick={()=>{store.get().delProject(n);setConfirm(null);force(x=>x+1)}}>Delete forever?</button>
     :<button className="btn text-red-400" aria-label={`Delete project ${n}`} onClick={()=>setConfirm(n)}>Delete</button>}</div></div>)}
  <div className="mt-3 flex gap-1.5">
   <button className="btn flex-1" onClick={exportProjectFile}>⤓ Export as file</button>
   <button className="btn flex-1" onClick={()=>imp.current.click()}>⤒ Import file</button>
   <input ref={imp} type="file" accept="application/json,.json" className="hidden"
    onChange={e=>{const f=e.target.files[0];if(f)importProjectFile(f,onClose);e.target.value=''}}/></div>
 </Modal>}
