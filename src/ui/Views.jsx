/* Presentation modes: PRODUCT RENDER and DESIGN PRESENTATION.

   Both show the same 3D watch as the editor — the product view live and
   orbitable, the sheet as rendered stills. Nothing here writes to the design,
   so switching modes can never alter a project. */
import React from 'react';
import {CAN,PX,METALS} from '../core/constants.js';
import {VNAME} from '../core/parts.js';
import {geoOf,strapMmOf,caseThickOf,lugToLugOf,crownMmOf,crystalMmOf,caseOf,dialLayoutOf} from '../core/geometry.js';
import {marketingClock} from '../core/time.js';
import {useApp} from '../state/store.js';
import {useWatchView,RestoringNotice} from './WatchCanvas.jsx';
import {FlatWatch} from './FlatWatch.jsx';
import {renderStill} from '../core/three/view.js';
import {headKey} from '../core/three/watch.js';
import {hasStructuralUpload} from '../core/three/uploads.js';
import {useWebgl} from '../core/three/support.js';
import {flatCanvas} from '../export/flat.js';
import {useTwoFingers,useMedia} from './gestures.js';
import {PhotoOverlay} from './Photo.jsx';
import {SURFACES} from '../core/three/surfaces.js';
const {useEffect,useRef,useState}=React;

/* ---------------------------------------------------------------- product */

export function ProductRender(){const s=useApp();const d=s.d;
 const camera=hasStructuralUpload(d,s.customs)?'front':'three-quarter';
 const{host,canvas,view,redraw,box,gen,lost,flat}=useWatchView({camera,orbit:true});
 /* a pinch moves in closer for a look at the finish; it is this view's own
    framing, not the design's zoom */
 const[zoom,setZoom]=useState(1);const pinch0=useRef(1);
 useEffect(()=>{if(view.current){view.current.setFrame({zoom});redraw()}},[camera,gen,zoom]);
 useTwoFingers(host,{onStart:()=>{pinch0.current=zoom},onPinch:k=>setZoom(Math.min(3,Math.max(.6,pinch0.current*k)))},[gen]);
 const touchUI=useMedia('(pointer: coarse)');
 /* staging: the surface shows live; the blur is a lens, so only a photo has it */
 const pr=d.product||{surface:'studio',blur:'soft'};
 useEffect(()=>{if(view.current){view.current.setSurface(pr.surface);redraw()}},[pr.surface,gen]);
 const[photo,setPhoto]=useState(false);
 const setProduct=patch=>s.setD(n=>{n.product={...(n.product||{}),...patch}});
 return<div ref={host} className="flex-1 min-h-0 relative overflow-hidden"
  style={{background:'radial-gradient(115% 85% at 50% 8%, #4a4e56 0%, #2c2f35 46%, #141519 100%)',touchAction:'none'}}>
  {flat?<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
    <FlatWatch size={Math.max(220,Math.min(box.w*.78,box.h*.82))} label="Product render of the watch, flat 2D drawing"/></div>
   :<canvas ref={canvas} className="absolute inset-0 w-full h-full block" aria-label="Product render of the watch"/>}
  {lost&&<RestoringNotice/>}
  {!flat&&!photo&&<div className="absolute top-3 right-3 left-3 sm:left-auto flex flex-wrap justify-end items-center gap-1.5" style={{zIndex:50}}>
   <div role="group" aria-label="Surface" className="flex flex-wrap items-center gap-1 rounded-full bg-black/55 backdrop-blur border border-white/10 px-2 py-1">
    <span className="text-[10px] text-neutral-400 px-1">Surface</span>
    {SURFACES.map(([id,label])=><button key={id} className={`chip ${pr.surface===id?'on':''}`} aria-pressed={pr.surface===id}
     onClick={()=>setProduct({surface:id})}>{label}</button>)}</div>
   <div role="group" aria-label="Lens blur" className="flex items-center gap-1 rounded-full bg-black/55 backdrop-blur border border-white/10 px-2 py-1"
    title="How much of the watch falls out of focus in a photo">
    <span className="text-[10px] text-neutral-400 px-1">Blur</span>
    {[['off','Off'],['soft','Soft'],['strong','Strong']].map(([id,label])=><button key={id} className={`chip ${pr.blur===id?'on':''}`} aria-pressed={pr.blur===id}
     onClick={()=>setProduct({blur:id})}>{label}</button>)}</div>
   <button className="goldbtn" onClick={()=>setPhoto(true)} title="Path trace a photo-quality still of this view">📷 Photo</button>
  </div>}
  {photo&&<PhotoOverlay view={view} box={box} onClose={()=>{setPhoto(false);redraw()}}/>}
  <div className="absolute bottom-4 left-0 right-0 text-center text-[11px] tracking-[.24em] text-neutral-500 uppercase pointer-events-none">
   {s.projName} · {d.caseMm} mm · {(METALS[d.parts.case.metal]||{}).name}
  </div>
  {/* above the name line: the staging bar holds the top */}
  <div className="absolute bottom-10 left-0 right-0 text-center text-[10px] text-neutral-500 pointer-events-none">{flat?'Flat 2D drawing — turning the watch needs WebGL':touchUI?'Drag to turn the watch · pinch to zoom':'Drag to turn the watch'}</div>
 </div>}

/* ---------------------------------------------------------------- sheet */

const Row=({l,v})=><div className="flex justify-between gap-4 py-[3px] border-b border-black/10">
 <span className="text-neutral-500">{l}</span><span className="text-neutral-900 tabular-nums">{v}</span></div>;

/* a dimension callout: extension line, end ticks and the measurement */
function Dim({x1,y1,x2,y2,label,vertical}){
 const mx=(x1+x2)/2,my=(y1+y2)/2;
 return<g stroke="#6b7280" strokeWidth="1" fill="none">
  <line x1={x1} y1={y1} x2={x2} y2={y2}/>
  {vertical?<><line x1={x1-5} y1={y1} x2={x1+5} y2={y1}/><line x1={x2-5} y1={y2} x2={x2+5} y2={y2}/></>
   :<><line x1={x1} y1={y1-5} x2={x1} y2={y1+5}/><line x1={x2} y1={y2-5} x2={x2} y2={y2+5}/></>}
  <text x={vertical?x1-9:mx} y={vertical?my:y1-8} fill="#374151" stroke="none" fontSize="11"
   textAnchor={vertical?'end':'middle'} dominantBaseline={vertical?'middle':'auto'}
   fontFamily="ui-sans-serif, system-ui">{label}</text>
 </g>}

/* Stills for the sheet, rendered at 2x and re-rendered only when the design
   itself changes — a technical drawing does not tick, so these read the frozen
   marketing pose and never touch a live clock. */
function useSheetStills(d,customs){const[img,setImg]=useState({});const gl=useWebgl();
 const key=headKey(d,customs)+JSON.stringify([d.parts.hands,d.parts.bezel.rot,
  Object.fromEntries(Object.entries(d.parts).map(([k,p])=>[k,p.t]))]);
 useEffect(()=>{let alive=true;
  (async()=>{const clock=marketingClock(d);
   /* drawings on paper: no table, so no drop shadow */
   const dd={...d,shadow:false};
   /* No WebGL: the front elevation is the flat drawing; the side and caseback
      are only ever built in 3D, so they say so instead of spinning forever. */
   if(!gl.ok){const front=(await flatCanvas(dd,customs,{size:600,clock,background:false,shadow:false})).toDataURL('image/png');
    if(alive)setImg({front,side:'unavailable',back:'unavailable'});return}
   const url=async(camera,w,h)=>(await renderStill(dd,customs,{w,h,camera,clock})).toDataURL('image/png');
   try{
    const front=await url('front',600,600);if(!alive)return;setImg(o=>({...o,front}));
    const side=await url('side',680,440);if(!alive)return;setImg(o=>({...o,side}));
    const back=await url('back',440,440);if(!alive)return;setImg(o=>({...o,back}))}
   catch(e){console.error('WatchStudio: sheet render failed',e)}})();
  return()=>{alive=false}},[key,gl.ok]);
 return img}

const Pending=({w,h})=><div style={{width:w,height:h}} className="flex items-center justify-center text-[10px] text-neutral-400 bg-neutral-100">rendering…</div>;
const Unavailable=({w,h})=><div style={{width:w,height:h}} className="flex items-center justify-center text-center px-6 text-[10px] leading-4 text-neutral-500 bg-neutral-100">
 This view is built in 3D and needs WebGL, which this browser isn’t providing.</div>;
/* a still, a placeholder while it renders, or a note that it cannot be rendered here */
const Still=({src,w,h,alt})=>src==='unavailable'?<Unavailable w={w} h={h}/>:src?<img src={src} width={w} height={h} alt={alt} className="block"/>:<Pending w={w} h={h}/>;

export function DesignSheet(){const s=useApp();const d=s.d;const P=d.parts;
 const size=300,pw=340,ph=220;
 const img=useSheetStills(d,s.customs);
 const mm=v=>`${v} mm`;
 const dialMm=+(d.caseMm*0.78).toFixed(1);
 const g=geoOf(d);
 const bezelMm=+(((g.rBezOut-g.rBezIn)/PX)).toFixed(1);

 /* the sheet is a fixed 980 px page; on a narrower screen it is shown whole,
    scaled to the width like a document preview, instead of cut off at the side */
 const wrap=useRef();const[fitK,setFitK]=useState(1);
 useEffect(()=>{const el=wrap.current;if(!el||typeof ResizeObserver==='undefined')return;
  const ro=new ResizeObserver(([e])=>setFitK(Math.min(1,Math.max(.3,(e.contentRect.width-16)/980))));
  ro.observe(el);return()=>ro.disconnect()},[]);

 return<div ref={wrap} className="flex-1 min-h-0 overflow-auto bg-[#f3f2ef] text-[#1b1d21]">
  <div className="mx-auto my-6 bg-white shadow-xl" style={{width:980,padding:'40px 44px',zoom:fitK<1?fitK:undefined}}>
   <div className="flex items-baseline justify-between border-b-2 border-black pb-3">
    <div><div className="text-[22px] font-semibold tracking-tight" style={{fontFamily:'Georgia, serif'}}>{s.projName}</div>
     <div className="text-[11px] tracking-[.22em] uppercase text-neutral-500 mt-1">Concept development sheet</div></div>
    <div className="text-[11px] text-neutral-500 text-right leading-5">
     <div>Scale 1 mm = {PX} px</div><div>Sheet 1 / 1 · Rev A</div></div>
   </div>

   <div className="flex gap-8 mt-7">
    <div className="shrink-0">
     {(()=>{const X=92,Y=16;
      /* the front still is framed at 1 mm = size/SHEET px, so these lines
         span the real features */
      const cx=X+size/2,cy=Y+size/2;
      const caseW=size*(d.caseMm*PX/CAN),l2lH=size*(lugToLugOf(d)*PX/CAN),lugW=size*(strapMmOf(d)*PX/CAN);
      return<svg width={size+150} height={size+92} className="block">
       {img.front?<image href={img.front} x={X} y={Y} width={size} height={size}/>
        :<foreignObject x={X} y={Y} width={size} height={size}><Pending w={size} h={size}/></foreignObject>}
       <Dim x1={cx-caseW/2} y1={Y+size+26} x2={cx+caseW/2} y2={Y+size+26} label={mm(d.caseMm)}/>
       <Dim x1={cx-lugW/2} y1={Y+size+56} x2={cx+lugW/2} y2={Y+size+56} label={mm(strapMmOf(d))}/>
       <Dim x1={X-34} y1={cy-l2lH/2} x2={X-34} y2={cy+l2lH/2} label={mm(lugToLugOf(d))} vertical/>
      </svg>})()}
     <div className="text-[10px] tracking-[.2em] uppercase text-neutral-500 text-center" style={{width:size+150}}>Front elevation</div>
    </div>

    <div className="flex-1 flex flex-col gap-6">
     <div>
      <Still src={img.side} w={pw} h={ph} alt="Side elevation"/>
      <div className="text-[10px] tracking-[.2em] uppercase text-neutral-500">Side profile · {mm(caseThickOf(d))} thick</div>
     </div>
     <div>
      <Still src={img.back} w={ph} h={ph} alt="Caseback"/>
      <div className="text-[10px] tracking-[.2em] uppercase text-neutral-500">Caseback · {caseOf(d).caseback}</div>
     </div>
    </div>
   </div>

   <div className="grid grid-cols-3 gap-x-10 mt-8 text-[12px]">
    <div>
     <div className="text-[10px] tracking-[.2em] uppercase text-neutral-500 mb-1">Dimensions</div>
     <Row l="Case diameter" v={mm(d.caseMm)}/>
     <Row l="Case thickness" v={mm(caseThickOf(d))}/>
     <Row l="Lug to lug" v={mm(lugToLugOf(d))}/>
     <Row l="Lug width" v={mm(strapMmOf(d))}/>
     <Row l="Bezel width" v={mm(bezelMm)}/>
     <Row l="Dial diameter" v={mm(dialMm)}/>
     <Row l="Crystal height" v={mm(crystalMmOf(d))}/>
     <Row l="Crown diameter" v={mm(crownMmOf(d))}/>
    </div>
    <div>
     <div className="text-[10px] tracking-[.2em] uppercase text-neutral-500 mb-1">Materials &amp; finish</div>
     <Row l="Case" v={`${(METALS[P.case.metal]||{}).name} · ${P.case.finish}`}/>
     <Row l="Bezel" v={`${(METALS[P.bezel.metal]||{}).name} · ${P.bezel.finish}`}/>
     <Row l="Crown" v={`${(METALS[P.crown.metal]||{}).name} · ${P.crown.finish}`}/>
     <Row l="Hands" v={`${(METALS[P.hands.metal]||{}).name} · ${P.hands.finish}`}/>
     <Row l="Dial" v={`${VNAME[P.dial.variant]||P.dial.variant} · ${P.dial.color}`}/>
     <Row l="Markers" v={VNAME[P.markers.variant]||P.markers.variant}/>
     <Row l="Lume" v={P.markers.lume}/>
    </div>
    <div>
     <div className="text-[10px] tracking-[.2em] uppercase text-neutral-500 mb-1">Construction</div>
     <Row l="Case type" v={VNAME[P.case.variant]||P.case.variant}/>
     <Row l="Bezel type" v={VNAME[P.bezel.variant]||P.bezel.variant}/>
     {P.bezel.variant==='diver'||P.bezel.variant==='gmt'?<Row l="Insert" v={P.bezel.insertColor}/>:null}
     <Row l="Crystal" v={`${VNAME[caseOf(d).crystal]} sapphire`}/>
     <Row l="Strap" v={`${VNAME[P.strap.variant]||P.strap.variant} · ${mm(strapMmOf(d))}`}/>
     <Row l="Hand set" v={VNAME[P.hands.variant]||P.hands.variant}/>
     <Row l="Date / chapter ring" v={`${(at=>at==='none'?'none':at==='430'?'4:30':at+' o’clock')(dialLayoutOf(d).date)} · ${P.dial.step==='stepped'?'stepped':'flat'}`}/>
     <Row l="Dial text" v={[P.dial.text.top,P.dial.text.bottom].filter(Boolean).join(' / ')||'—'}/>
    </div>
   </div>

   <div className="mt-7 pt-3 border-t border-black/15 text-[10px] text-neutral-500 leading-5">
    All dimensions in millimetres. Proportions derived from the case diameter; lug, bezel and
    rehaut geometry scale with it. Drawing is a design concept, not a manufacturing drawing —
    tolerances, movement fitting and water resistance to be specified with the case maker.
   </div>
  </div>
 </div>}
