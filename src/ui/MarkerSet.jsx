/* Markers designed in PartStudio: import one, switch to it, remove it. */
import React from 'react';
import {store} from '../state/store.js';
import {toast} from '../core/utils.js';
import {MARKERSET_VARIANT,normalizeSet,setFromPartStudio} from '../core/markerset/index.js';
import {Section} from './primitives.jsx';

/* put a set on the open watch and show it: one undo step */
export function applyMarkerSet(set){
 store.get().upd(n=>{n.parts.markers.set=set;n.parts.markers.variant=MARKERSET_VARIANT;n.active.markers=null},'partstudio');
 store.get().select('markers');
 toast(`Markers “${set.name}” from PartStudio are on the dial`)}

export async function importMarkerSetFile(file){
 try{const set=setFromPartStudio(JSON.parse(await file.text()));
  if(!set)throw new Error('not a set');applyMarkerSet(set);return true}
 catch(e){toast('That file is not a PartStudio marker set');return false}}

export function PartStudioSection({d}){const p=d.parts.markers;
 const set=React.useMemo(()=>p.set?normalizeSet(p.set):null,[p.set]);
 const on=!!set&&p.variant===MARKERSET_VARIANT&&!d.active.markers;
 const file=React.useRef(null);
 const onFile=e=>{const f=e.target.files&&e.target.files[0];e.target.value='';if(f)importMarkerSetFile(f)};
 const count=set?set.slots.filter(Boolean).length:0;
 return<Section title="From PartStudio">
  {set&&<div className={`rounded-lg border ${on?'border-[#d4af37]/70':'border-white/10'} p-2 flex items-center gap-2`}>
   <div className="flex-1 min-w-0">
    <div className="text-[12px] truncate text-neutral-200">{set.name}</div>
    <div className="text-[10px] text-neutral-500">{set.styles.length} style{set.styles.length>1?'s':''} · {count} hour{count===1?'':'s'}</div></div>
   {on?<span className="chip on">In use</span>
    :<button className="btn" onClick={()=>store.get().upd(n=>{n.parts.markers.variant=MARKERSET_VARIANT;n.active.markers=null},'partstudio')}>Use</button>}
   <button className="btn" aria-label="Remove the PartStudio marker set" onClick={()=>store.get().upd(n=>{delete n.parts.markers.set;
    if(n.parts.markers.variant===MARKERSET_VARIANT)n.parts.markers.variant='batons'},'partstudio')}>✕</button></div>}
  <button className="btn w-full" onClick={()=>file.current.click()}>{set?'Import another marker set':'Import a marker set'} (.json)</button>
  <input ref={file} type="file" accept=".json,application/json" className="hidden" aria-label="PartStudio marker set file" onChange={onFile}/>
  <p className="text-[10px] text-neutral-500">Design the indices in PartStudio, then use Export → WatchStudio markers, or its Open in WatchStudio button. The set keeps its millimetre sizes on any case.</p>
 </Section>}
