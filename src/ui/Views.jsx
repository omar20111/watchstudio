/* Presentation modes: PRODUCT RENDER and DESIGN PRESENTATION.

   Both reuse the editing engine's layer stack unchanged — they only change what
   surrounds it. Nothing here writes to the design, so switching modes can never
   alter a project. */
import React from 'react';
import {CAN,PX,METALS} from '../core/constants.js';
import {VNAME} from '../core/parts.js';
import {geoOf,strapMmOf,caseThickOf,lugToLugOf,crownMmOf,crystalMmOf} from '../core/geometry.js';
import {buildLayers,layerAngle} from '../core/layers.js';
import {useSceneClock,marketingClock} from '../core/time.js';
import {drProfile,drBack} from '../core/render/profile.js';
import {useApp} from '../state/store.js';
import {LayerView} from './primitives.jsx';
const {useEffect,useMemo,useRef,useState}=React;

/* the composed watch, with no selection guides and no interaction */
export function WatchView({size,still}){const s=useApp();const d=s.d;
 const layers=useMemo(()=>buildLayers(d,s.customs),[d,s.customs]);
 /* a technical drawing does not tick — running the live clock behind it
    re-rendered every layer at 60 Hz for a static sheet */
 /* a technical drawing does not tick: the sheet reads the frozen marketing
    pose, so hands AND date agree and the page never re-renders on a clock */
 const live=useSceneClock();const clock=still?marketingClock(d):live;
 const k=size/CAN;
 const rotFor=key=>layerAngle(key,clock);
 return<div className="relative shrink-0" style={{width:size,height:size}}>
  {layers.map(l=>{const{key,...rest}=l;return<LayerView key={key} {...rest} rot={rotFor(key)} k={k}/>})}
 </div>}

function Canvas2D({draw,w,h,className,style}){const ref=useRef();
 useEffect(()=>{const c=ref.current;if(!c)return;const x=c.getContext('2d');
  x.clearRect(0,0,c.width,c.height);draw(x,c)},[draw,w,h]);
 return<canvas ref={ref} width={w} height={h} className={className} style={style}/>}

/* ---------------------------------------------------------------- product */

export function ProductRender(){const s=useApp();const d=s.d;
 const ref=useRef();const[box,setBox]=useState({w:900,h:700});
 useEffect(()=>{const ro=new ResizeObserver(e=>{const r=e[0].contentRect;setBox({w:r.width,h:r.height})});
  ro.observe(ref.current);return()=>ro.disconnect()},[]);
 const size=Math.max(220,Math.min(box.w*0.78,box.h*0.82));
 const g=geoOf(d);const k=size/CAN;
 return<div ref={ref} className="flex-1 min-h-0 relative flex items-center justify-center overflow-hidden"
  style={{background:'radial-gradient(115% 85% at 50% 8%, #4a4e56 0%, #2c2f35 46%, #141519 100%)'}}>
  {/* contact shadow: tight and dark directly under the caseback, spreading out */}
  <div className="absolute pointer-events-none" style={{
    left:'50%',top:'50%',width:2*g.R*k*1.06,height:2*g.R*k*0.30,
    transform:'translate(-50%,-50%) translateY('+(g.R*k*0.92)+'px)',
    background:'radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,.66) 0%, rgba(0,0,0,.30) 46%, rgba(0,0,0,0) 72%)',
    filter:'blur(10px)'}}/>
  <WatchView size={size}/>
  <div className="absolute bottom-4 left-0 right-0 text-center text-[11px] tracking-[.24em] text-neutral-500 uppercase">
   {s.projName} · {d.caseMm} mm · {(METALS[d.parts.case.metal]||{}).name}
  </div>
 </div>}

/* ------------------------------------------------------------------ sheet */

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

export function DesignSheet(){const s=useApp();const d=s.d;const P=d.parts;
 const size=300,pw=340,ph=220;
 const profile=useMemo(()=>(x,c)=>{const sc=(pw*0.82)/(lugToLugOf(d)*PX);
  drProfile(x,d,{scale:sc,cx:pw/2,cy:ph/2})},[d]);
 const back=useMemo(()=>(x,c)=>{const sc=(ph*0.74)/(d.caseMm*PX);
  drBack(x,d,{scale:sc,cx:pw/2,cy:ph/2})},[d]);
 const mm=v=>`${v} mm`;
 const dialMm=+(d.caseMm*0.78).toFixed(1);
 const g=geoOf(d);
 const bezelMm=+(((g.rBezOut-g.rBezIn)/PX)).toFixed(1);

 return<div className="flex-1 min-h-0 overflow-auto bg-[#f3f2ef] text-[#1b1d21]">
  <div className="mx-auto my-6 bg-white shadow-xl" style={{width:980,padding:'40px 44px'}}>
   <div className="flex items-baseline justify-between border-b-2 border-black pb-3">
    <div><div className="text-[22px] font-semibold tracking-tight" style={{fontFamily:'Georgia, serif'}}>{s.projName}</div>
     <div className="text-[11px] tracking-[.22em] uppercase text-neutral-500 mt-1">Concept development sheet</div></div>
    <div className="text-[11px] text-neutral-500 text-right leading-5">
     <div>Scale 1 mm = {PX} px</div><div>Sheet 1 / 1 · Rev A</div></div>
   </div>

   <div className="flex gap-8 mt-7">
    <div className="shrink-0">
     {(()=>{const X=92,Y=16;
      /* dimension lines must span the real feature, not the drawing box */
      const cx=X+size/2,cy=Y+size/2;
      const caseW=size*(d.caseMm*PX/CAN),l2lH=size*(lugToLugOf(d)*PX/CAN),lugW=size*(strapMmOf(d)*PX/CAN);
      return<svg width={size+150} height={size+92} className="block">
       <foreignObject x={X} y={Y} width={size} height={size}>
        <div style={{width:size,height:size}}><WatchView size={size} still/></div>
       </foreignObject>
       <Dim x1={cx-caseW/2} y1={Y+size+26} x2={cx+caseW/2} y2={Y+size+26} label={mm(d.caseMm)}/>
       <Dim x1={cx-lugW/2} y1={Y+size+56} x2={cx+lugW/2} y2={Y+size+56} label={mm(strapMmOf(d))}/>
       <Dim x1={X-34} y1={cy-l2lH/2} x2={X-34} y2={cy+l2lH/2} label={mm(lugToLugOf(d))} vertical/>
      </svg>})()}
     <div className="text-[10px] tracking-[.2em] uppercase text-neutral-500 text-center" style={{width:size+150}}>Front elevation</div>
    </div>

    <div className="flex-1 flex flex-col gap-6">
     <div>
      <Canvas2D draw={profile} w={pw} h={ph} className="block"/>
      <div className="text-[10px] tracking-[.2em] uppercase text-neutral-500">Side profile · {mm(caseThickOf(d))} thick</div>
     </div>
     <div>
      <Canvas2D draw={back} w={pw} h={ph} className="block"/>
      <div className="text-[10px] tracking-[.2em] uppercase text-neutral-500">Caseback</div>
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
     <Row l="Crystal" v={`${VNAME[P.crystal.variant]||P.crystal.variant} sapphire`}/>
     <Row l="Strap" v={`${VNAME[P.strap.variant]||P.strap.variant} · ${mm(strapMmOf(d))}`}/>
     <Row l="Hand set" v={VNAME[P.hands.variant]||P.hands.variant}/>
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
