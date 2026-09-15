/* Center stage: the 3D watch, direct manipulation, cameras, time & zoom bars.

   Front is the editing camera. It is orthographic on the 1200 px sheet at the
   same scale the 2D stage used, so the sheet-space maths below — selection
   guides, drag offsets, keyboard nudges — is unchanged; only "which part is
   under the pointer" moved from 2D hit boxes to a ray into the real geometry.
   Three-quarter orbits (and a click selects); profile is a measured drawing. */
import React from 'react';
import {C,CAN,BG} from '../core/constants.js';
import {clamp,normDeg} from '../core/utils.js';
import {frames,bezelRotatable,bezelRotOf,caseThickOf} from '../core/geometry.js';
import {LEATHER} from '../core/textures.js';
import {useSceneClock,fmtChrono} from '../core/time.js';
import {useApp,store,patchPartT} from '../state/store.js';
import {GOLD} from './primitives.jsx';
import {useWatchView,RestoringNotice} from './WatchCanvas.jsx';
import {NoWebgl} from './NoWebgl.jsx';
import {SHEET,profileLayout} from '../core/three/view.js';
import {hasStructuralUpload} from '../core/three/uploads.js';
import {webglState} from '../core/three/support.js';
import {useTwoFingers,useMedia} from './gestures.js';
const {useEffect,useMemo,useRef,useState}=React;

/* Right-drag (or Ctrl-drag) in the front view tilts the watch to look round it,
   up to TILT_MAX, and it eases back level on release: a glance, not a camera
   move, so editing never happens at an angle. */
const TILT_MAX=25*Math.PI/180,TILT_PER_PX=TILT_MAX/220,TILT_RETURN_MS=420;

/* The only part of the stage that has to re-render with the clock, kept in its
   own component so the rest of the stage does not re-render 60 times a second. */
function ChronoReadout(){const c=useSceneClock();
 return<span className="text-[10px] text-neutral-400 tabular-nums pl-1" aria-live="off">chrono {fmtChrono(c.chrono.ms)}</span>}

/* without 3D there is nothing to turn */
export const stageCamera=(d,customs)=>{
 if(!webglState().ok)return'front';
 const c=['front','three-quarter','back','profile'].includes(d.camera)?d.camera:'front';
 return(c==='three-quarter'||c==='back')&&hasStructuralUpload(d,customs)?'front':c};

export function Stage({onAR}){const s=useApp();const d=s.d;
 const structural=hasStructuralUpload(d,s.customs);
 const camera=stageCamera(d,s.customs);
 const innerRef=useRef();const drag=useRef(null);const down=useRef(null);
 const{host,canvas,view,box,redraw,gen,lost,noGL}=useWatchView({camera,orbit:true});
 const fit=Math.max(220,Math.min(box.w,box.h)-56);const size=fit*d.zoom;
 /* 1 mm = size/SHEET px: the sheet square below and the front camera agree */
 useEffect(()=>{if(view.current){view.current.setFrame({pxPerMm:size/SHEET,zoom:d.zoom});redraw()}},[size,d.zoom,camera,gen]);
 /* encoded once — this used to re-encode a 512² PNG on every render, 60 times a
    second while the seconds hand swept */
 const leather=useMemo(()=>LEATHER.toDataURL(),[]);
 const bg=BG[d.bg];const bgImg=d.bg==='wrist'?d.bgCustom:(d.bg==='leather'?leather:null);
 const t=d.time;

 /* pointer -> sheet px, through the sheet-sized square centred on the stage */
 const toSheet=e=>{const r=innerRef.current.getBoundingClientRect();const k=size/CAN;return[(e.clientX-r.left)/k,(e.clientY-r.top)/k]};
 /* a ray into the 3D watch; with no 3D there is nothing to pick */
 const pickAt=e=>{const st=store.getState();
  if(noGL)return null;
  if(!view.current||!canvas.current)return null;
  const r=canvas.current.getBoundingClientRect();
  return view.current.pick(e.clientX-r.left,e.clientY-r.top,st.sel)};
 const angleAt=(px,py)=>Math.atan2(py-C,px-C)*180/Math.PI;

 /* the tilt: where it is, the drag holding it, the ease bringing it back */
 const tilt=useRef({x:0,y:0,drag:null,raf:0});const[tilted,setTilted]=useState(false);
 const canTilt=camera==='front'&&!noGL;
 const setTilt=(x,y)=>{const T=tilt.current,r=Math.hypot(x,y),k=r>TILT_MAX?TILT_MAX/r:1;
  T.x=x*k;T.y=y*k;if(view.current){view.current.setTilt(T.x,T.y);redraw()}};
 const settle=()=>{const T=tilt.current;cancelAnimationFrame(T.raf);
  const x0=T.x,y0=T.y,t0=performance.now();
  const step=now=>{const p=Math.min(1,(now-t0)/TILT_RETURN_MS),k=(1-p)**3;setTilt(x0*k,y0*k);
   if(p<1)T.raf=requestAnimationFrame(step);else setTilted(false)};
  T.raf=requestAnimationFrame(step)};
 /* another camera, or a rebuilt view, starts level */
 useEffect(()=>{const T=tilt.current;cancelAnimationFrame(T.raf);T.drag=null;setTilt(0,0);setTilted(false)},[camera,gen]);
 useEffect(()=>()=>cancelAnimationFrame(tilt.current.raf),[]);

 const end=()=>{drag.current=null;if(host.current)host.current.style.cursor='default';
  if(tilt.current.drag){tilt.current.drag=null;settle()}};

 /* Two fingers: a pinch zooms the stage; a two-finger drag tilts the front view,
    the touch form of right-drag. If the first finger had already started moving
    a part, the second one means it was never a move: the part goes back. */
 const pinch=useRef(null);
 useTwoFingers(host,{
  onStart:()=>{const dg=drag.current,st=store.getState();
   if(dg&&dg.moved){if(dg.spin)st.setBezelRot(dg.rot0,'bezelDrag');else patchPartT(dg.part,{x:dg.x,y:dg.y,r:dg.r},'mv:'+dg.part)}
   drag.current=null;down.current=null;pinch.current={zoom:st.d.zoom};cancelAnimationFrame(tilt.current.raf)},
  onPinch:k=>{const z=clamp(+(pinch.current.zoom*k).toFixed(3),0.4,3);s.setD(n=>{n.zoom=z})},
  onPan:(dx,dy)=>{if(!canTilt)return;if(!tilted)setTilted(true);setTilt(dx*TILT_PER_PX,dy*TILT_PER_PX)},
  onEnd:mode=>{if(mode==='pan'&&canTilt)settle()}},[gen]);

 /* on a phone the hint sits under the camera chips and fades once read */
 const touchUI=useMedia('(pointer: coarse)'),narrow=useMedia('(max-width: 640px)');
 const[hintGone,setHintGone]=useState(false);
 useEffect(()=>{setHintGone(false);if(!narrow)return;const t=setTimeout(()=>setHintGone(true),7000);return()=>clearTimeout(t)},[camera,narrow]);

 /* the profile drawing's dimension callouts, drawn over exactly what is rendered */
 const overlay=useRef();
 useEffect(()=>{const c=overlay.current;if(!c||camera!=='profile')return;
  const dpr=Math.min(2,window.devicePixelRatio||1);c.width=box.w*dpr;c.height=box.h*dpr;
  const x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,box.w,box.h);
  const L=profileLayout(box.w,box.h,d),S=L.side,at=S.toScreen;
  x.strokeStyle='rgba(255,255,255,.34)';x.fillStyle='rgba(255,255,255,.72)';x.lineWidth=1;
  x.font='11px ui-sans-serif, system-ui';x.textAlign='center';
  const tick=(ax,ay,bx,by)=>{x.beginPath();x.moveTo(ax,ay);x.lineTo(bx,by);x.stroke()};
  /* thickness: caseback to crystal apex */
  const th=caseThickOf(d),[xr,y0]=at(-S.l2l/2-3,0),[,y1]=at(0,S.top);
  tick(xr,y0,xr,y1);tick(xr-5,y0,xr+5,y0);tick(xr-5,y1,xr+5,y1);
  x.save();x.translate(xr+16,(y0+y1)/2);x.rotate(-Math.PI/2);x.fillText(th.toFixed(1)+' mm',0,0);x.restore();
  /* lug-to-lug, above the crystal */
  const[xa,ya]=at(S.l2l/2,S.top+2.5),[xb]=at(-S.l2l/2,S.top+2.5);
  tick(xa,ya,xb,ya);tick(xa,ya-5,xa,ya+5);tick(xb,ya-5,xb,ya+5);
  x.fillText(S.l2l.toFixed(1)+' mm',(xa+xb)/2,ya-8);
  x.textAlign='left';x.fillStyle='rgba(255,255,255,.4)';x.font='10px ui-sans-serif, system-ui';
  x.fillText('SIDE ELEVATION · FROM 3 O’CLOCK',14,S.h-12);x.fillText('CASEBACK',14,L.back.y+18);
 },[camera,box,d]);

 return<div ref={host} className="relative flex-1 overflow-hidden select-none"
  /* touch-action none: the stage's gestures are its own, not the page's (gestures.js) */
  style={{backgroundImage:bgImg?`url(${bgImg})`:undefined,background:bgImg?undefined:bg.css,backgroundSize:bgImg?'cover':undefined,backgroundPosition:'center',touchAction:'none'}}
  onWheel={e=>{if(e.target.closest('[data-ui]'))return;
   if(e.shiftKey&&camera==='front'){const st=store.getState();const selP=st.sel;const p=st.d.parts[selP];
    const base=selP==='hands'&&!st.d.active.hands?p.tH:p.t;
    patchPartT(selP,{s:clamp(+(base.s*(e.deltaY>0?0.94:1.06)).toFixed(3),0.3,2.5)},'sc:'+selP);return}
   s.setD(n=>{n.zoom=clamp(n.zoom*(e.deltaY>0?0.92:1.08),0.4,3)})}}
  onContextMenu={e=>{if(canTilt&&!e.target.closest('[data-ui]'))e.preventDefault()}}
  onPointerDown={e=>{
   if(narrow)setHintGone(true);
   /* a second finger belongs to the two-finger gesture, not to a new drag */
   if(e.pointerType==='touch'&&!e.isPrimary)return;
   if(canTilt&&(e.button===2||(e.button===0&&e.ctrlKey))&&!e.target.closest('[data-ui]')){const T=tilt.current;
    cancelAnimationFrame(T.raf);T.drag={cx:e.clientX,cy:e.clientY,x:T.x,y:T.y};setTilted(true);
    e.currentTarget.setPointerCapture(e.pointerId);host.current.style.cursor='move';return}
   if(e.button!==0||e.target.closest('[data-ui]'))return;
   if(camera==='three-quarter'){down.current=[e.clientX,e.clientY];return}
   if(camera!=='front')return;
   const st=store.getState();const part=pickAt(e);if(!part)return;
   st.select(part);const[px,py]=toSheet(e);const p=st.d.parts[part];
   const base=part==='hands'&&!st.d.active.hands?p.tH:p.t;
   /* a rotating bezel turns when dragged — that is what the ring is for;
      Alt-drag still rotates any part, the bezel included */
   const spin=part==='bezel'&&bezelRotatable(st.d)&&!e.altKey;
   drag.current={part,px,py,x:base.x,y:base.y,r:base.r,alt:e.altKey,spin,rot0:bezelRotOf(st.d),a0:angleAt(px,py)};
   e.currentTarget.setPointerCapture(e.pointerId);host.current.style.cursor='grabbing'}}
  onPointerMove={e=>{const dg=drag.current,td=tilt.current.drag;
   if(td){setTilt(td.x+(e.clientX-td.cx)*TILT_PER_PX,td.y+(e.clientY-td.cy)*TILT_PER_PX);return}
   if(!dg){if(camera!=='front'||e.target.closest('[data-ui]'))return;
    host.current.style.cursor=pickAt(e)?'grab':'default';return}
   if(e.pointerType==='touch'&&!e.isPrimary)return;
   const[px,py]=toSheet(e);dg.moved=true;
   if(dg.spin){store.getState().setBezelRot(dg.rot0+normDeg(angleAt(px,py)-dg.a0),'bezelDrag');return}
   if(dg.alt||e.altKey){patchPartT(dg.part,{r:Math.round(normDeg(dg.r+angleAt(px,py)-dg.a0))},'rot:'+dg.part)}
   else patchPartT(dg.part,{x:clamp(Math.round(dg.x+px-dg.px),-300,300),y:clamp(Math.round(dg.y+py-dg.py),-300,300)},'mv:'+dg.part)}}
  onPointerUp={e=>{
   if(camera==='three-quarter'&&down.current){const[dx,dy]=down.current;down.current=null;
    /* a click, not an orbit: select what is under it */
    if(Math.hypot(e.clientX-dx,e.clientY-dy)<4){const part=pickAt(e);if(part)store.getState().select(part)}}
   end()}}
  /* a cancelled pointer (touch interrupted, browser gesture) used to leave the
     drag latched, so the part followed the cursor with no button held */
  onPointerCancel={end} onLostPointerCapture={end}>

  {/* at night the backdrop goes dark with the studio (view.js applyNight) */}
  {!noGL&&d.night&&<div className="absolute inset-0 pointer-events-none" style={{background:'radial-gradient(90% 80% at 50% 45%, rgba(8,12,18,.82) 0%, rgba(2,3,6,.94) 100%)'}}/>}
  {noGL?<NoWebgl/>:<canvas ref={canvas} className="absolute inset-0 w-full h-full block" aria-label={`Watch, ${camera} view`}/>}
  {lost&&<RestoringNotice/>}
  {camera==='profile'&&<canvas ref={overlay} className="absolute inset-0 w-full h-full pointer-events-none"/>}

  {/* the sheet: invisible in 3D, but it is the coordinate frame for guides and
      drags */}
  <div ref={innerRef} className="absolute pointer-events-none" style={{width:size,height:size,left:'50%',top:'50%',transform:'translate(-50%,-50%)'}}>
   {camera==='front'&&!tilted&&!noGL&&<svg viewBox="0 0 1200 1200" className="absolute inset-0 w-full h-full" style={{zIndex:40}}>
    {frames(s.sel,d).map((f,i)=>f.t==='p'
     ?<path key={i} d={f.d} fill="none" stroke={GOLD} strokeWidth="3" className="dashAnim" opacity=".85"/>
     :f.t==='c'
     ?<circle key={i} cx={C} cy={C} r={f.r} fill="none" stroke={GOLD} strokeWidth="3" className="dashAnim" opacity=".85"/>
     :<rect key={i} x={f.x} y={f.y} width={f.w} height={f.h} rx="14" fill="none" stroke={GOLD} strokeWidth="3" className="dashAnim" opacity=".85"
       transform={f.rot?`rotate(${f.rot} ${C} ${C})`:undefined}/>)}
   </svg>}
  </div>

  <div data-ui="1" className="stage-hint absolute top-3 left-3 text-[10px] text-neutral-400 bg-black/50 backdrop-blur px-2.5 py-1.5 rounded-lg border border-white/10"
   style={{zIndex:50,opacity:hintGone?0:1,transition:'opacity .5s',pointerEvents:hintGone?'none':undefined}} aria-hidden={hintGone||undefined}>
   {touchUI
    ?(noGL?'The watch needs 3D graphics'
     :camera==='front'?'Drag a part to move it · pinch to zoom · two fingers to tilt · drag a diver bezel to turn it'
     :camera==='three-quarter'?'Drag to turn · pinch to zoom · tap a part to select it'
     :camera==='back'?'The caseback, the watch turned over · pinch to zoom'
     :'Side elevation and caseback, measured')
    :(noGL?'The watch needs 3D graphics'
     :camera==='front'?'Drag part to move · Alt-drag rotate · drag a diver bezel to turn it · right-drag to tilt · Shift+scroll scale · arrows nudge · 1–8 select · V camera · Ctrl+Z undo'
     :camera==='three-quarter'?'Drag to orbit · click a part to select it · scroll to zoom · V camera'
     :camera==='back'?'The caseback, the watch turned over · scroll to zoom · V camera'
     :'Side elevation and caseback, measured · V camera')}</div>

  <div data-ui="1" role="group" aria-label="Camera" className="absolute top-3 right-3 flex items-center gap-1 bg-black/60 backdrop-blur px-2 py-1.5 rounded-full border border-white/10" style={{zIndex:50}}>
   {[['front','Front'],['three-quarter','¾'],['back','Back'],['profile','Side']].map(([id,label])=>{
    const off=noGL||((id==='three-quarter'||id==='back')&&structural);
    return<button key={id} className={`chip ${camera===id?'on':''}`} disabled={off} aria-pressed={camera===id}
     title={noGL?'Cameras need 3D graphics (WebGL), which this browser isn’t providing'
      :off?`An uploaded case, bezel, crown, hands or strap is a flat picture — it has no depth to turn, so the ${label} view is unavailable while one is in use`:id==='back'?'Back camera: the caseback, and the movement behind an exhibition window':`${label} camera`}
     style={off?{opacity:.35,cursor:'not-allowed'}:undefined}
     onClick={()=>s.setD(n=>{n.camera=id})}>{label}</button>})}
   {!noGL&&<button className={`chip ${d.night?'on':''}`} aria-pressed={!!d.night} title={d.night?'Lights on (N)':'Lights out: see the lume glow (N)'}
    onClick={()=>s.setD(n=>{n.night=!n.night})}>Night</button>}
   {camera==='three-quarter'&&<button className="chip" title="Reset the orbit" onClick={()=>{view.current&&view.current.fit();redraw();s.setD(n=>{n.zoom=1})}}>Reset</button>}
   {/* here as well as the toolbar: on a phone the toolbar's end is scrolled out of view */}
   {onAR&&<button className="chip" title="See it in your room at real size" aria-label="View in AR" onClick={onAR}>AR</button>}
  </div>

  {camera!=='profile'&&<div data-ui="1" className="stage-time absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 whitespace-nowrap bg-black/60 backdrop-blur px-2.5 py-1.5 rounded-full border border-white/10" style={{zIndex:50}}>
   <button className={`chip ${t.mode==='live'?'on':''}`} onClick={()=>s.setD(n=>{n.time.mode='live'})}>● Live</button>
   {t.mode==='live'&&<label className="stage-sweep text-[10px] text-neutral-400 flex items-center gap-1"><input type="checkbox" checked={t.sweep} onChange={e=>s.setD(n=>{n.time.sweep=e.target.checked})}/>sweep</label>}
   <button className={`chip ${t.mode==='set'&&t.h===10&&t.m===8?'on':''}`} onClick={()=>s.setD(n=>{n.time.mode='set';n.time.h=10;n.time.m=8;n.time.s=36})}>10:08</button>
   <button className={`chip ${t.mode==='set'&&!(t.h===10&&t.m===8)?'on':''}`} onClick={()=>s.setD(n=>{n.time.mode='set'})}>Set</button>
   {t.mode==='set'&&<span className="flex items-center gap-1 text-[10px] text-neutral-400">
    {['h','m','s'].map(u=><input key={u} type="number" aria-label={{h:'Hours',m:'Minutes',s:'Seconds'}[u]} className="w-11 bg-[#1b1c21] border border-white/10 rounded px-1" value={t[u]}
     onChange={e=>s.setD(n=>{n.time[u]=clamp(+e.target.value||0,0,u==='h'?23:59)})}/>)}
   </span>}
   {d.parts.dial.variant==='chrono'&&<ChronoReadout/>}
  </div>}

  {/* on a touch screen a pinch replaces the zoom steps; the level and Fit stay */}
  <div data-ui="1" className="stage-zoom absolute bottom-3 right-3 flex items-center gap-1 whitespace-nowrap bg-black/60 backdrop-blur px-2 py-1.5 rounded-full border border-white/10" style={{zIndex:50}}>
   {!touchUI&&<button className="btn" aria-label="Zoom out" onClick={()=>s.setD(n=>{n.zoom=clamp(n.zoom-0.15,0.4,3)})}>−</button>}
   <span className="text-[10px] w-9 text-center text-neutral-300">{Math.round(d.zoom*100)}%</span>
   {!touchUI&&<button className="btn" aria-label="Zoom in" onClick={()=>s.setD(n=>{n.zoom=clamp(n.zoom+0.15,0.4,3)})}>+</button>}
   <button className="btn" onClick={()=>s.setD(n=>{n.zoom=1})}>Fit</button>
  </div>
 </div>}
