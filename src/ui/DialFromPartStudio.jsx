/* A dial designed in PartStudio: import the file, and the background picture
   it brings (which can also be added here on its own). */
import React from 'react';
import {store,useApp} from '../state/store.js';
import {toast} from '../core/utils.js';
import {Slider,Section} from './primitives.jsx';
import {BG_DEF,dialBgOf,activeDialBg} from '../core/dialbg.js';
import {normalizeSet} from '../core/markerset/index.js';
import {applyMarkerSet} from './MarkerSet.jsx';
const {useRef}=React;

const PATTERNS=['sunburst','matte','chrono','guilloche','fume','enamel','tapisserie'];
const FINISHES=['none','brushed','polished','matte'];
const DATES=['none','3','430','6'];
const FONTS=['serif','sans','caps'];
const pick=(v,list,fb)=>list.includes(v)?v:fb;
const hex=(v,fb)=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)?v.toLowerCase():fb;
const num=(v,lo,hi,fb)=>{const n=+v;return Number.isFinite(n)?Math.min(hi,Math.max(lo,n)):fb};

/* Put a PartStudio dial file on the watch: the plate and its printing, the
   pictures it carries, and the marker set when it brought one. */
export async function applyDialFile(o){
 if(!o||o.app!=='PartStudio'||o.kind!=='watchstudio-dial'||!o.dial)throw new Error('not a dial');
 const p=o.dial,t=p.text||{},l=p.logo||{},b=p.bg||{},img=o.images||{};
 store.get().upd(n=>{const D=n.parts.dial;
  D.variant=pick(p.variant,PATTERNS,D.variant);D.color=hex(p.color,D.color);D.finish=pick(p.finish,FINISHES,D.finish);
  D.date=pick(String(p.date),DATES,D.date);D.step=p.step==='stepped'?'stepped':'flat';
  D.text={top:String(t.top??'').slice(0,40),bottom:String(t.bottom??'').slice(0,40),font:pick(t.font,FONTS,'serif'),
   color:t.color==='auto'||t.color==null?'auto':hex(t.color,'auto')};
  D.logo={style:l.style==='applied'?'applied':'print',color:l.color==='original'?'original':'ink',
   size:num(l.size,.1,1.1,.34),y:num(l.y,-.75,.75,-.6)};
  D.bg={...BG_DEF(),scale:num(b.scale,.5,4,1),rot:num(b.rot,-180,180,0),x:num(b.x,-.6,.6,0),y:num(b.y,-.6,.6,0)};
  if(!img.background)n.active.dialbg=null;
  if(!img.logo)n.active.logo=null},'dialfile');
 if(img.background&&img.background.data)store.get().addUpload('dialbg',img.background.name||'background',img.background.data);
 if(img.logo&&img.logo.data)store.get().addUpload('logo',img.logo.name||'logo',img.logo.data);
 const set=o.markers&&normalizeSet(o.markers);
 if(set)applyMarkerSet(set);
 else if(o.markersPreset==='batons')store.get().upd(n=>{n.parts.markers.variant='batons'},'dialfile');
 store.get().select('dial');
 toast(`Dial “${String(o.name||'from PartStudio').slice(0,40)}” is on the watch`);
 return true}

export function DialFromPartStudio(){const s=useApp(),d=s.d;
 const B=dialBgOf(d),bg=activeDialBg(d,s.customs),bgId=d.active.dialbg;
 const dialFile=useRef(),bgFile=useRef();
 const setBg=(patch,tag)=>s.upd(n=>{n.parts.dial.bg={...dialBgOf(n),...patch}},tag||'dialbg');
 const onDial=async e=>{const f=e.target.files&&e.target.files[0];e.target.value='';if(!f)return;
  try{await applyDialFile(JSON.parse(await f.text()))}catch(err){toast('That file is not a PartStudio dial')}};
 const onPicture=e=>{const f=e.target.files&&e.target.files[0];e.target.value='';if(!f)return;
  const rd=new FileReader();rd.onload=()=>s.addUpload('dialbg',f.name,rd.result);rd.readAsDataURL(f)};
 return<Section title="Background & PartStudio">
  <input ref={dialFile} type="file" accept=".json,application/json" className="hidden" aria-label="PartStudio dial file" onChange={onDial}/>
  <input ref={bgFile} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" aria-label="Dial background image file" onChange={onPicture}/>
  <button className="btn w-full" onClick={()=>dialFile.current.click()}>Import a dial from PartStudio (.json)</button>
  {bg
   ?<>
     <div className="flex items-center gap-2">
      <img src={bg.url} alt="" className="w-12 h-12 object-cover rounded bg-[#1d1e23] border border-white/10"/>
      <div className="flex-1 min-w-0 text-[11px] text-neutral-300 truncate" title={bg.name}>{bg.name}</div>
      <button className="btn" onClick={()=>bgFile.current.click()}>Replace</button>
      <button className="btn text-red-400" aria-label="Remove the background picture" onClick={()=>s.delUpload('dialbg',bgId)}>✕</button></div>
     <Slider label="Zoom" min={.5} max={4} step={.01} val={B.scale} fmt={v=>v.toFixed(2)+'×'} onChange={v=>setBg({scale:v},'bgScale')}/>
     <Slider label="Turn" min={-180} max={180} step={1} val={B.rot} fmt={v=>v+'°'} onChange={v=>setBg({rot:v},'bgRot')}/>
     <Slider label="Move across" min={-.6} max={.6} step={.01} val={B.x} fmt={v=>v.toFixed(2)} onChange={v=>setBg({x:v},'bgX')}/>
     <Slider label="Move up / down" min={-.6} max={.6} step={.01} val={B.y} fmt={v=>v.toFixed(2)} onChange={v=>setBg({y:v},'bgY')}/>
     <p className="text-[10px] text-neutral-500">The picture is the plate's colour: the date window, the chapter step, the printing and the finish are still the dial's own.</p>
    </>
   :<><button className="btn w-full" onClick={()=>bgFile.current.click()}
      onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f){const rd=new FileReader();rd.onload=()=>s.addUpload('dialbg',f.name,rd.result);rd.readAsDataURL(f)}}}>＋ Background picture (PNG, JPG, SVG)</button>
     <p className="text-[10px] text-neutral-500">Laid under the dial's printing, keeping its finish — unlike an upload, which replaces the whole dial.</p></>}
 </Section>}
