/* The dial's logo: add one, choose printed or applied metal, its colour, size
   and place, or take it away (core/logo.js). */
import React from 'react';
import {useApp} from '../state/store.js';
import {Slider} from './primitives.jsx';
import {LOGO_STYLES,LOGO_COLOURS,logoOf,activeLogo,logoFitOf} from '../core/logo.js';
const {useRef,useState}=React;

/* read a picked file as a data URL; with keyWhite, near-white pixels become
   transparent so a logo saved on a white background sits on the dial */
function readLogo(file,keyWhite,cb){const rd=new FileReader();
 rd.onload=()=>{if(!keyWhite||file.type==='image/svg+xml'){cb(rd.result);return}
  const img=new Image();img.onload=()=>{const cv=document.createElement('canvas');cv.width=img.naturalWidth;cv.height=img.naturalHeight;
   const x=cv.getContext('2d');x.drawImage(img,0,0);const id=x.getImageData(0,0,cv.width,cv.height),px=id.data;
   for(let i=0;i<px.length;i+=4)if(px[i]>235&&px[i+1]>235&&px[i+2]>235)px[i+3]=0;
   x.putImageData(id,0,0);cb(cv.toDataURL('image/png'))};img.src=rd.result};
 rd.readAsDataURL(file)}

export function LogoControls(){const s=useApp(),d=s.d,L=logoOf(d),logo=activeLogo(d,s.customs),id=d.active.logo;
 /* how the logo fits the dial (logo.js logoBoxOf): smaller than asked where it would run into something */
 const fit=logoFitOf(d,s.customs);
 const inp=useRef();const[keyWhite,setKeyWhite]=useState(false);
 const set=(patch,tag)=>s.upd(n=>{n.parts.dial.logo={...logoOf(n),...patch}},tag||'logo');
 const pick=f=>{if(!f)return;readLogo(f,keyWhite,url=>s.addUpload('logo',f.name,url))};
 const Chips=({label,opts,val,onPick})=><div className="flex items-center justify-between gap-2 text-[11px] text-neutral-400">
  <span>{label}</span><div className="flex gap-1 flex-wrap justify-end">{opts.map(([v,t])=>
   <button key={v} className={`chip ${val===v?'on':''}`} aria-pressed={val===v} aria-label={`Logo ${label.toLowerCase()}: ${t}`} onClick={()=>onPick(v)}>{t}</button>)}</div></div>;
 return<div className="space-y-2">
  <input ref={inp} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" aria-label="Logo image file"
   onChange={e=>{pick(e.target.files[0]);e.target.value=''}}/>
  {!logo
   ?<>
     <button className="btn w-full" onClick={()=>inp.current.click()}
      onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();pick(e.dataTransfer.files[0])}}>＋ Add your logo (PNG, SVG or JPG)</button>
     <label className="flex items-center gap-2 text-[11px] text-neutral-400">
      <input type="checkbox" checked={keyWhite} onChange={e=>setKeyWhite(e.target.checked)}/>Remove a white background</label>
     <p className="text-[10px] text-neutral-500">A transparent PNG or an SVG works best. It is printed on the dial or raised in metal.</p>
    </>
   :<>
     <div className="flex items-center gap-2">
      <img src={logo.url} alt="" className="w-12 h-12 object-contain rounded bg-[#1d1e23] border border-white/10"/>
      <div className="flex-1 min-w-0 text-[11px] text-neutral-300 truncate" title={logo.name}>{logo.name}</div>
      <button className="btn" onClick={()=>inp.current.click()}>Replace</button>
      <button className="btn text-red-400" aria-label="Remove logo" onClick={()=>s.delUpload('logo',id)}>✕</button></div>
     <Chips label="Style" opts={LOGO_STYLES} val={L.style} onPick={v=>set({style:v})}/>
     {L.style==='print'&&<Chips label="Colour" opts={LOGO_COLOURS} val={L.color} onPick={v=>set({color:v})}/>}
     <Slider label="Size" min={0.1} max={1.1} step={0.01} val={L.size} fmt={v=>Math.round(v*100)+'%'} onChange={v=>set({size:v},'logoSize')}/>
     <Slider label="Position" min={-0.75} max={0.75} step={0.01} val={-L.y} fmt={v=>v>0.02?'toward 12':v<-0.02?'toward 6':'centre'} onChange={v=>set({y:-v},'logoY')}/>
     {fit&&fit.limitedBy&&<p className="text-[10px] text-amber-300/80" role="status">
      {fit.clear?`Shown at ${Math.round(fit.scale*100)}% of this size, to keep clear of the ${fit.limitedBy}.`
       :`Too close to the ${fit.limitedBy} to fit here — move it toward 12 or 6.`}</p>}
     {d.parts.dial.text&&d.parts.dial.text.top&&
      <button className="btn w-full" onClick={()=>s.upd(n=>{n.parts.dial.text={...n.parts.dial.text,top:''};n.parts.dial.logo={...logoOf(n),y:-.42}},'logoBrand')}>
       Use the logo in place of the brand text</button>}
     {L.style==='applied'&&<p className="text-[10px] text-neutral-500">Applied in the hands’ metal. Fine lines raise best when the logo is large.</p>}
    </>}
 </div>}
