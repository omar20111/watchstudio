/* Right panel: presets, uploads, transforms and part styling. */
import React from 'react';
import {PARTS,VARIANTS,VNAME,variantOf,applyVariant,strapFinish} from '../core/parts.js';
import {strapMmOf,crownMmOf,bezelMmOf,bezelRangeOf,
        rehautMmOf,caseOf,thicknessStack,lugToLugMm,lugLenMinOf,detentOf,dialLayoutOf,caseLengthMm,lugsFitEnd,bezelFit} from '../core/geometry.js';
import {PresetThumb} from './PresetThumb.jsx';
import {store,useApp,TT} from '../state/store.js';
import {Slider,MetalRow,FinishRow,ColorField,Section,useSettled} from './primitives.jsx';
import {UploadZone} from './upload.jsx';
import {LogoControls} from './LogoControls.jsx';
import {PartStudioSection} from './MarkerSet.jsx';
import {DialFromPartStudio} from './DialFromPartStudio.jsx';

function TransformCtl({t,onChange}){return<div className="grid grid-cols-1 gap-0.5">
 <Slider label="Scale" min={0.3} max={2.5} step={0.01} val={t.s} fmt={v=>v.toFixed(2)} onChange={v=>onChange({s:v})}/>
 <Slider label="Rotation" min={-180} max={180} step={1} val={t.r} fmt={v=>v+'°'} onChange={v=>onChange({r:v})}/>
 <Slider label="Offset X" min={-300} max={300} step={1} val={t.x} onChange={v=>onChange({x:v})}/>
 <Slider label="Offset Y" min={-300} max={300} step={1} val={t.y} onChange={v=>onChange({y:v})}/>
 <Slider label="Opacity" min={0} max={1} step={0.01} val={t.o} fmt={v=>Math.round(v*100)+'%'} onChange={v=>onChange({o:v})}/></div>}

/* A cyclops sits on a flat crystal over a date window: without one of those
   the choice is shown but explains itself instead of doing nothing */
function CyclopsToggle({d,p,up}){const L=dialLayoutOf(d),c=caseOf(d);
 const why=!L.win?'Add a date window on the Dial panel first.':c.crystal==='dome'?'A cyclops needs a flat or box crystal.':null;
 return<div>
  <label className={`flex items-center gap-2 text-[11px] ${why?'text-neutral-600':'text-neutral-400'}`}>
   <input type="checkbox" disabled={!!why} checked={!!p.cyclops&&!why} onChange={e=>up({cyclops:e.target.checked},'cyclops')}/>Cyclops date magnifier</label>
  {why&&<p className="text-[10px] text-neutral-500">{why}</p>}</div>}

export function Controls(){const s=useApp();const d=s.d;const part=s.sel;const p=d.parts[part];const customs=(s.customs[part]||{});
 const thumbD=useSettled(d);
 const up=(patch,tag)=>s.upd(n=>{Object.assign(n.parts[part],patch)},tag||('ctl:'+part));
 const upT=(key,patch,tag)=>s.upd(n=>{Object.assign(n.parts[part][key],patch)},tag||('t:'+part+key));
 return<div className="w-[340px] shrink-0 border-l border-white/10 bg-[#141519] overflow-y-auto p-3 space-y-4">
  <div className="flex items-baseline justify-between"><h2 className="text-sm font-semibold text-[#d4af37]">{PARTS.find(x=>x[0]===part)[1]}</h2>
   <span className="text-[10px] text-neutral-500">{d.active[part]?'custom upload':'preset: '+(VNAME[variantOf(part,d)]||variantOf(part,d))}</span></div>
  <Section title="Presets"><div className="flex gap-2 flex-wrap">
   {VARIANTS[part].map(v=>
    <button key={v} title={VNAME[v]||v} onClick={()=>s.upd(n=>applyVariant(n,part,v),'ctl:'+part)} className="flex flex-col items-center gap-0.5">
     <span className={`block rounded-lg overflow-hidden border-2 ${!d.active[part]&&variantOf(part,d)===v?'border-[#d4af37]':'border-white/10'} bg-[#1d1e23]`}>
      <PresetThumb part={part} v={v} d={thumbD}/></span>
     <span className="text-[9px] text-neutral-500">{VNAME[v]||v}</span></button>)}
   {/* a marker set imported from PartStudio sits with the presets */}
   {part==='markers'&&p.set&&<button title={`PartStudio: ${p.set.name||'marker set'}`} aria-label="Use the PartStudio marker set"
    onClick={()=>s.upd(n=>{n.parts.markers.variant='partstudio';n.active.markers=null},'ctl:markers')} className="flex flex-col items-center gap-0.5">
    <span className={`block rounded-lg overflow-hidden border-2 ${!d.active.markers&&p.variant==='partstudio'?'border-[#d4af37]':'border-white/10'} bg-[#1d1e23]`}>
     <PresetThumb part="markers" v="partstudio" d={thumbD}/></span>
    <span className="text-[9px] text-neutral-500">PartStudio</span></button>}
   {Object.entries(customs).map(([id,cu])=>
    <div key={id} className={`relative rounded-lg border-2 ${d.active[part]===id?'border-[#d4af37]':'border-white/10'}`}>
     <button onClick={()=>s.setSource(part,id)} title={cu.name} aria-label={`Use upload ${cu.name}`}>
      {/* rehydrateImages flags a blob the vault no longer has; an <img> with no
          src just shows a broken-image icon */}
      {cu.url?<img src={cu.url} className="w-14 h-14 object-contain bg-[#1d1e23]" alt=""/>
       :<span className="w-14 h-14 flex items-center justify-center text-center text-[9px] leading-tight text-amber-300/80 bg-[#1d1e23]">image<br/>missing</span>}</button>
     <button onClick={()=>s.delUpload(part,id)} aria-label={`Delete upload ${cu.name}`} className="absolute -top-1.5 -right-1.5 bg-red-900 rounded-full w-4 h-4 text-[9px] leading-4">✕</button>
    </div>)}
  </div>
  {d.active[part]&&<button className="btn" onClick={()=>s.setSource(part,null)}>← Back to preset</button>}</Section>
  {part==='markers'&&<PartStudioSection d={d}/>}
  <Section title="Upload"><UploadZone part={part}/></Section>
  <Section title="Transform / Alignment">
   {part==='hands'&&!d.active.hands? <div className="space-y-2">
     {[['tH','Hour'],['tM','Minute'],['tS','Second']].map(([k,l])=><div key={k} className="border border-white/10 rounded p-1.5">
      <div className="text-[10px] text-neutral-500 mb-1">{l} hand</div><TransformCtl t={p[k]} onChange={patch=>upT(k,patch,'t:'+k)}/></div>)}
    </div>
   : <TransformCtl t={p.t} onChange={patch=>upT('t',patch)}/>}
   <button className="btn w-full" onClick={()=>{if(part==='hands'&&!d.active.hands)up({tH:TT(),tM:TT(),tS:TT()});else up({t:TT()})}}>⤢ Reset transform</button>
   <p className="text-[10px] text-neutral-500">Tip: drag the part directly on the canvas · Alt-drag rotates · Shift+scroll scales</p></Section>
  {['strap','case','crown','bezel','hands'].includes(part)&&
   <Section title="Metal"><MetalRow val={p.metal} onChange={v=>up({metal:v})}/>{d.active[part]&&<p className="text-[10px] text-neutral-500">applied as tint filter on uploads</p>}</Section>}
  {['strap','case','crown','bezel','hands','dial','crystal'].includes(part)&&
   <Section title="Finish"><FinishRow val={p.finish||'none'} onChange={v=>up({finish:v})}/>
    {['case','crown','bezel'].includes(part)&&p.finish==='brushed'&&<p className="text-[10px] text-neutral-500">Brushed on the flat surfaces, polished on the bevelled edges — the way a sport case is finished.</p>}
    {part==='strap'&&<p className="text-[10px] text-neutral-500">{strapFinish(p).note}</p>}</Section>}
  {part==='case'&&(()=>{const c=caseOf(d),st=thicknessStack(d);
   const setc=(patch,tag)=>s.upd(n=>{n.case={...n.case,...patch}},tag||'case');
   /* `off`: choices that cannot be had here, each with the reason */
   const Pick=({label,val,opts,onPick,tag,off={}})=><div className="flex items-center justify-between gap-2 text-[11px] text-neutral-400">
     <span>{label}</span><div className="flex gap-1 flex-wrap justify-end">{opts.map(([v,t])=>
      <button key={v} className={`chip ${val===v?'on':''}`} aria-label={`${label}: ${t}`} disabled={!!off[v]} title={off[v]||undefined}
       style={off[v]?{opacity:.35,cursor:'not-allowed'}:undefined} onClick={()=>onPick(v)}>{t}</button>)}</div></div>;
   return<Section title="Case Architecture">
    <Slider label="Thickness" min={6} max={20} step={0.1} val={c.thickness}
     fmt={v=>v.toFixed(1)+' mm'} onChange={v=>setc({thicknessMm:v},'thk')}/>
    {!c.feasible&&<p className="text-[10px] text-amber-400" role="status">
      Raised to {c.minThickness.toFixed(1)} mm — a {c.movement} movement with this crystal,
      bezel and caseback cannot fit in {c.requested.toFixed(1)} mm.</p>}
    <div className="text-[10px] text-neutral-500 leading-5">
     caseback {st.caseback.toFixed(1)} · band {st.band.toFixed(2)} · movement {st.movement.toFixed(1)}
     · dial {st.dial.toFixed(1)} · bezel {st.bezel.toFixed(1)} · crystal {st.crystal.toFixed(1)}
     <span className="text-neutral-400"> = {st.total.toFixed(2)} mm</span></div>
    <Slider label="Lug length" min={lugLenMinOf(d.caseMm)} max={12} step={0.1} val={c.lugLen}
     fmt={v=>v.toFixed(1)+' mm'} onChange={v=>setc({lugLenMm:v},'lug')}/>
    <Slider label="Lug drop" min={0} max={6} step={0.1} val={c.lugDrop}
     fmt={v=>v.toFixed(1)+' mm'} onChange={v=>setc({lugDropMm:v},'drop')}/>
    <Pick label="Case shape" val={c.shape} opts={[['round','Round'],['cushion','Cushion'],['octagon','Octagon'],['square','Square'],['tonneau','Tonneau']]}
     onPick={v=>setc({shape:v},'shape')}/>
    {c.shape==='tonneau'&&<p className="text-[10px] text-neutral-500">{(+d.caseMm).toFixed(1)} mm across, {caseLengthMm(d).toFixed(1)} mm from 12 to 6.</p>}
    {(()=>{const why=k=>bezelFit(d,k).fits?null:`A ${k} bezel this size would cut into the crystal opening on a ${c.shape} case`;
     const off={octagon:why('octagon'),square:why('square')};
     return<><Pick label="Bezel shape" val={c.bezelShape} opts={[['round','Round'],['octagon','Octagon'],['square','Square']]} off={off}
      onPick={v=>setc({bezelShape:v},'bshape')}/>
      {off[c.bezelShape]&&<p className="text-[10px] text-amber-400/90">{off[c.bezelShape]}, so it is built round. A square or cushion case, or a wider bezel, makes room for it.</p>}</>})()}
    <Pick label="Case side" val={c.side} opts={[['straight','Straight'],['drum','Drum'],['sloped','Sloped'],['stepped','Stepped']]}
     onPick={v=>setc({side:v},'side')}/>
    <Pick label="Lugs" val={c.lugs} opts={[['straight','Straight'],['twisted','Twisted'],['hooded','Hooded'],['integrated','Integrated']]}
     onPick={v=>setc({lugs:v},'lugs')}/>
    {(f=>!f.ok&&<p className="text-[10px] text-amber-400/90">This tonneau’s ends are {f.endMm.toFixed(1)} mm across and the {c.lugs==='integrated'?'shoulder':'lugs'} for a {strapMmOf(d)} mm strap need {f.needMm.toFixed(1)} mm, so {c.lugs==='integrated'?'it runs':'they sit'} out onto its rounded corners. A narrower strap or a larger case keeps {c.lugs==='integrated'?'it':'them'} on the end.</p>)(lugsFitEnd(d))}
    <label className="flex items-center gap-2 text-[11px] text-neutral-400">
     <input type="checkbox" checked={c.lugHoles&&c.lugs!=='integrated'} disabled={c.lugs==='integrated'} onChange={e=>setc({lugHoles:e.target.checked},'holes')}/>
     Drilled lug holes</label>
    <Slider label="Crystal height" min={c.crystal==='flat'?0.6:c.crystal==='box'?2:0.8}
     max={c.crystal==='flat'?2.5:c.crystal==='box'?5:4} step={0.1} val={c.crystalMm}
     fmt={v=>v.toFixed(1)+' mm'} onChange={v=>setc({crystalMm:v},'cry')}/>
    <Pick label="Crystal" val={c.crystal} opts={[['flat','Flat'],['dome','Domed'],['box','Box']]}
     onPick={v=>setc({crystal:v},'crys')}/>
    <Pick label="Caseback" val={c.caseback} opts={[['solid','Solid'],['exhibition','Exhibition'],['engraved','Engraved']]}
     onPick={v=>setc({caseback:v},'back')}/>
    <Pick label="Movement" val={c.movement} opts={[['automatic','Auto'],['manual','Manual'],['quartz','Quartz'],['spring','Spring']]}
     onPick={v=>setc({movement:v},'mvt')}/>
    <Pick label="Crown at" val={c.crownPos} opts={[['3','3 o’clock'],['430','4:30']]}
     onPick={v=>setc({crownPos:v},'cpos')}/>
    <Pick label="Wear" val={c.wear} opts={[['new','New'],['light','Light'],['worn','Worn']]}
     onPick={v=>setc({wear:v},'wear')}/>
    <Pick label="Water resist" val={String(c.wrM)} opts={[['30','30 m'],['100','100 m'],['200','200 m'],['300','300 m'],['1000','1000 m']]}
     onPick={v=>setc({wrM:+v},'wr')}/>
    <label className="flex items-center gap-2 text-[11px] text-neutral-400">
     <input type="checkbox" checked={c.pushers} onChange={e=>setc({pushers:e.target.checked},'push')}/>
     Chronograph pushers at 2 and 4</label>
    <input className="tin" placeholder="Caseback engraving" value={c.engraving}
     aria-label="Caseback engraving" onChange={e=>setc({engraving:e.target.value},'eng')}/>
    <div className="text-[10px] text-neutral-500">Lug-to-lug {lugToLugMm(d).toFixed(1)} mm · derived from lug length, not assumed.</div>
   </Section>})()}
  {part==='case'&&<Section title="Case Dimensions">
   <Slider label="Diameter" min={34} max={46} step={0.5} val={d.caseMm} fmt={v=>v+' mm'} onChange={v=>s.upd(n=>{n.caseMm=v},'mm')}/>
   {/* range must match geoOf's own clamp (0.34..0.88 of the bezel+rehaut span)
       or the top of the track is inert and the thumb springs back */}
   <Slider label="Bezel width" min={+bezelRangeOf(d)[0].toFixed(1)} max={+bezelRangeOf(d)[1].toFixed(1)} step={0.1} val={bezelMmOf(d)} fmt={v=>v.toFixed(1)+' mm'} onChange={v=>s.upd(n=>{n.bezelMm=v},'bez')}/>
   <Slider label="Crown diameter" min={3.5} max={10} step={0.1} val={crownMmOf(d)} fmt={v=>v.toFixed(1)+' mm'} onChange={v=>s.upd(n=>{n.crownMm=v},'crn')}/>
   <div className="flex items-center justify-between text-[10px] text-neutral-500 pt-1">
    <span>Dial Ø {(d.caseMm*0.78).toFixed(1)} mm · rehaut {rehautMmOf(d).toFixed(1)} mm</span>
    <button className="btn" onClick={()=>s.upd(n=>{n.bezelMm='auto';n.crownMm='auto'},'dimreset')}>Auto</button></div>
   <p className="text-[10px] text-neutral-500">Everything downstream — lugs, rehaut, crystal, crown — is derived from these.</p></Section>}
  {part==='strap'&&<Section title="Strap">
   <div className="flex items-center gap-2 text-[11px] text-neutral-400">Lug width
    <select className="bg-[#1b1c21] border border-white/10 rounded px-1 py-0.5" value={d.strapMm} onChange={e=>s.upd(n=>{n.strapMm=e.target.value==='auto'?'auto':+e.target.value},'sw')}>
     <option value="auto">Auto ({strapMmOf(d)} mm)</option><option value="18">18 mm</option><option value="20">20 mm</option><option value="22">22 mm</option></select></div>
   <ColorField label="Strap color" val={p.color} onChange={v=>up({color:v},'col')}/>
   <ColorField label="Stitching" val={p.stitch} onChange={v=>up({stitch:v},'st')}/></Section>}
  {part==='bezel'&&(p.variant==='diver'||p.variant==='gmt')&&!d.active.bezel&&
   <Section title="Bezel Insert"><ColorField label="Insert" val={p.insertColor} onChange={v=>up({insertColor:v},'ins')}/>
    <div className="flex items-center justify-between text-[11px] text-neutral-400">
     <span>Detents</span><div className="flex gap-1">
      {(p.variant==='gmt'?[24,120]:[60,120]).map(n=>
       <button key={n} className={`chip ${detentOf(d)===n?'on':''}`} aria-label={`${n} detents per revolution`}
        onClick={()=>up({detents:n},'det')}>{n}</button>)}</div></div>
    <div className="flex items-center justify-between text-[11px] text-neutral-400">
     <span>Action</span><div className="flex gap-1">
      <button className={`chip ${p.dir!=='bi'?'on':''}`} aria-label="Counter-clockwise ratchet"
       onClick={()=>up({dir:'ccw'},'dir')}>CCW ratchet</button>
      <button className={`chip ${p.dir==='bi'?'on':''}`} aria-label="Bidirectional bezel"
       onClick={()=>up({dir:'bi'},'dir')}>Bidirectional</button></div></div>
    <div className="flex items-center justify-between text-[11px] text-neutral-400">
     <span>Rotation {Math.round(p.rot||0)}&deg;</span>
     <div className="flex gap-1">
      <button className="btn" aria-label="Rotate bezel one detent anticlockwise" onClick={()=>s.nudgeBezel(-1)}>&larr;</button>
      <button className="btn" aria-label="Rotate bezel one detent clockwise" onClick={()=>s.nudgeBezel(1)}>&rarr;</button>
      <button className="btn" aria-label="Reset bezel to 12" onClick={()=>s.resetBezel()}>Reset</button></div></div>
    <p className="text-[10px] text-neutral-500">Drag the ring on the canvas, or use &larr; &rarr; with the bezel selected. 0 resets.</p>
   </Section>}
  {part==='dial'&&p.variant==='chrono'&&<Section title="Chronograph">
   <div className="flex items-center gap-2">
    <button className="btn flex-1" aria-label={d.chrono&&d.chrono.running?'Stop chronograph':'Start chronograph'}
     onClick={()=>s.chronoToggle()}>{d.chrono&&d.chrono.running?'■ Stop':'▶ Start'}</button>
    <button className="btn flex-1" aria-label="Reset chronograph" onClick={()=>s.chronoReset()}>↺ Reset</button></div>
   <p className="text-[10px] text-neutral-500">Space starts and stops, R resets. The central seconds hand becomes the chrono seconds.</p>
  </Section>}
  {part==='dial'&&!d.active.dial&&<Section title="Dial Construction">
   {(()=>{const chrono=p.variant==='chrono',at=dialLayoutOf(d).date;
    return<>
    <div className="flex items-center justify-between gap-2 text-[11px] text-neutral-400" role="group" aria-label="Date window">
     <span>Date window</span><div className="flex gap-1">{[['none','None'],['3','3'],['430','4:30'],['6','6']].map(([v,t])=>{
      const off=chrono&&v==='6';
      return<button key={v} className={`chip ${at===v?'on':''}`} disabled={off} aria-pressed={at===v}
       title={off?'A chronograph’s 6 o’clock register and model line leave no room — its date sits at 4:30':v==='none'?'No date':v==='430'?'Date window at 4:30':`Date window at ${t} o’clock`}
       style={off?{opacity:.35,cursor:'not-allowed'}:undefined} onClick={()=>up({date:v},'date')}>{t}</button>})}</div></div>
    {chrono&&p.date==='3'&&at==='430'&&<p className="text-[10px] text-neutral-500">On a dial this size the running-seconds register leaves no room for a window at 3, so the date sits at 4:30.</p>}
    <div className="flex items-center justify-between gap-2 text-[11px] text-neutral-400" role="group" aria-label="Chapter ring">
     <span>Chapter ring</span><div className="flex gap-1">{[['flat','Flat'],['stepped','Stepped']].map(([v,t])=>
      <button key={v} className={`chip ${(p.step||'flat')===v?'on':''}`} aria-pressed={(p.step||'flat')===v} onClick={()=>up({step:v},'step')}>{t}</button>)}</div></div>
    <p className="text-[10px] text-neutral-500">The window is cut through the dial onto a turning date wheel, and replaces the index at its hour. A stepped dial sinks the centre below the minute track.{chrono?' Registers are milled into the dial.':''}</p></>})()}
  </Section>}
  {part==='dial'&&<Section title="Dial Color"><div className="flex gap-1.5 mb-1">{['#16324f','#101214','#e8e6e0','#1d3a2a','#4a1f24','#d9c6a5','#0d3a2b','#1c3f66'].map(c=>
   <button key={c} className="w-6 h-6 rounded-full border border-white/20" style={{background:c}} onClick={()=>up({color:c})}/>)}</div>
   <ColorField label="Custom" val={p.color} onChange={v=>up({color:v},'dc')}/></Section>}
  {part==='dial'&&!d.active.dial&&<DialFromPartStudio/>}
  {part==='dial'&&!d.active.dial&&<Section title="Logo"><LogoControls/></Section>}
  {part==='dial'&&<Section title="Dial Text / Branding">
   <input className="tin" placeholder="Top (12h) — brand name" value={p.text.top} onChange={e=>up({text:{...p.text,top:e.target.value}},'txt')}/>
   <input className="tin" placeholder="Bottom (6h) — model line" value={p.text.bottom} onChange={e=>up({text:{...p.text,bottom:e.target.value}},'txt')}/>
   <div className="flex gap-1">{['serif','sans','caps'].map(f=>
    <button key={f} className={`chip ${p.text.font===f?'on':''}`} onClick={()=>up({text:{...p.text,font:f}},'font')}>{f}</button>)}</div>
   <div className="flex items-center gap-2">
    <button className={`chip ${p.text.color==='auto'?'on':''}`} onClick={()=>up({text:{...p.text,color:'auto'}},'tcol')}>Auto ink</button>
    {p.text.color!=='auto'&&<input type="color" value={p.text.color} onChange={e=>up({text:{...p.text,color:e.target.value}},'tcol')}/>}</div></Section>}
  {['markers','hands'].includes(part)&&<Section title="Lume">
   {/* a PartStudio set brings each style's own compound colour */}
   {!(part==='markers'&&p.variant==='partstudio')&&<ColorField label="Lume color" val={p.lume} onChange={v=>up({lume:v},'lume')}/>}
   <label className="flex items-center gap-2 text-[11px] text-neutral-400"><input type="checkbox" checked={p.glow} onChange={e=>up({glow:e.target.checked})}/>Glow (lights out)</label>
   {part==='hands'&&<ColorField label="Second hand" val={p.secColor} onChange={v=>up({secColor:v},'sec')}/>}</Section>}
  {part==='crystal'&&<Section title="Crystal"><Slider label="Gloss" min={0} max={1} step={0.01} val={p.opacity} fmt={v=>Math.round(v*100)+'%'} onChange={v=>up({opacity:v},'cry')}/>
   <CyclopsToggle d={d} p={p} up={up}/></Section>}
 </div>}
