/* Center stage: layered canvas watch, direct manipulation, time & zoom bars. */
import React from 'react';
import {C,CAN,BG} from '../core/constants.js';
import {clamp,normDeg} from '../core/utils.js';
import {geoOf,frames,pickPart} from '../core/geometry.js';
import {buildLayers,layerAngle} from '../core/layers.js';
import {drProfile,drBack} from '../core/render/profile.js';
import {lugToLugOf,caseThickOf} from '../core/geometry.js';
import {PX} from '../core/constants.js';
import {useSceneClock} from '../core/time.js';
import {LEATHER} from '../core/textures.js';
import {useApp,store,patchPartT} from '../state/store.js';
import {GOLD,LayerView} from './primitives.jsx';
const {useEffect,useMemo,useRef,useState}=React;

export function Stage(){const s=useApp();const d=s.d;const g=geoOf(d);
 const ref=useRef();const innerRef=useRef();const drag=useRef(null);
 const[box,setBox]=useState({w:900,h:700});
 useEffect(()=>{const ro=new ResizeObserver(e=>{const r=e[0].contentRect;setBox({w:r.width,h:r.height})});ro.observe(ref.current);return()=>ro.disconnect()},[]);
 const fit=Math.max(220,Math.min(box.w,box.h)-56);const size=fit*d.zoom;const k=size/CAN;
 const clock=useSceneClock();
 const layers=useMemo(()=>buildLayers(d,s.customs),[d,s.customs]);
 const bg=BG[d.bg];const bgImg=d.bg==='wrist'?d.bgCustom:(d.bg==='leather'?LEATHER.toDataURL():null);
 const rotFor=key=>layerAngle(key,clock);
 const t=d.time;
 /* The second camera. It reads the same millimetre geometry as the front view
    and the spec sheet, so the three can never disagree. Only front and profile
    are offered: a three-quarter view faked without a projection model would
    look worse than either, so it is deliberately not built. */
 const camera=d.camera==='profile'?'profile':'front';
 const profRef=useRef();
 useEffect(()=>{if(camera!=='profile')return;const c=profRef.current;if(!c)return;
  const x=c.getContext('2d');x.clearRect(0,0,c.width,c.height);
  const sc=(c.width*0.62)/(lugToLugOf(d)*PX);
  drProfile(x,d,{scale:sc,cx:c.width/2,cy:c.height*0.42});
  drBack(x,d,{scale:(c.height*0.26)/(d.caseMm*PX),cx:c.width/2,cy:c.height*0.80});
  /* dimension callouts, in mm, on the drawing itself */
  x.save();x.strokeStyle='rgba(255,255,255,.34)';x.fillStyle='rgba(255,255,255,.7)';
  x.lineWidth=1;x.font='11px ui-sans-serif, system-ui';x.textAlign='center';
  const th=caseThickOf(d),halfT=th*PX*sc/2,cy=c.height*0.42;
  const xr=c.width/2+lugToLugOf(d)*PX*sc/2+26;
  x.beginPath();x.moveTo(xr,cy-halfT);x.lineTo(xr,cy+halfT);
  x.moveTo(xr-5,cy-halfT);x.lineTo(xr+5,cy-halfT);
  x.moveTo(xr-5,cy+halfT);x.lineTo(xr+5,cy+halfT);x.stroke();
  x.save();x.translate(xr+16,cy);x.rotate(-Math.PI/2);x.fillText(th.toFixed(1)+' mm',0,0);x.restore();
  const l2l=lugToLugOf(d),yb=cy+halfT+34,hw=l2l*PX*sc/2;
  x.beginPath();x.moveTo(c.width/2-hw,yb);x.lineTo(c.width/2+hw,yb);
  x.moveTo(c.width/2-hw,yb-5);x.lineTo(c.width/2-hw,yb+5);
  x.moveTo(c.width/2+hw,yb-5);x.lineTo(c.width/2+hw,yb+5);x.stroke();
  x.fillText(l2l.toFixed(1)+' mm',c.width/2,yb-9);x.restore()},[camera,d,box]);

 const toCanvas=e=>{const r=innerRef.current.getBoundingClientRect();return[(e.clientX-r.left)/k,(e.clientY-r.top)/k]};
 return<div ref={ref} className="relative flex-1 overflow-hidden select-none"
  style={{backgroundImage:bgImg?`url(${bgImg})`:undefined,background:bg.css,backgroundSize:bgImg?'cover':undefined,backgroundPosition:'center'}}
  onWheel={e=>{if(e.shiftKey){const st=store.getState();const selP=st.sel;const p=st.d.parts[selP];
    const base=selP==='hands'&&!st.d.active.hands?p.tH:p.t;
    patchPartT(selP,{s:clamp(+(base.s*(e.deltaY>0?0.94:1.06)).toFixed(3),0.3,2.5)},'sc:'+selP);return}
   s.setD(n=>{n.zoom=clamp(n.zoom*(e.deltaY>0?0.92:1.08),0.4,3)})}}
  onPointerDown={e=>{if(e.button!==0)return;if(e.target.closest('[data-ui]'))return;
   const[px,py]=toCanvas(e);if(px<0||px>CAN||py<0||py>CAN)return;
   const st=store.getState();const part=pickPart(px,py,st.d,st.sel);if(!part)return;
   st.select(part);const p=st.d.parts[part];const base=part==='hands'&&!st.d.active.hands?p.tH:p.t;
   drag.current={part,px,py,x:base.x,y:base.y,r:base.r,alt:e.altKey};
   e.currentTarget.setPointerCapture(e.pointerId);
   if(innerRef.current)innerRef.current.style.cursor='grabbing'}}
  onPointerMove={e=>{const dg=drag.current;
   if(!dg){const[px,py]=toCanvas(e);
    if(px>=0&&px<=CAN&&py>=0&&py<=CAN&&pickPart(px,py,store.getState().d,store.getState().sel)){if(innerRef.current)innerRef.current.style.cursor='grab'}
    else if(innerRef.current)innerRef.current.style.cursor='default';return}
   const[px,py]=toCanvas(e);
   if(dg.alt||e.altKey){const a0=Math.atan2(dg.py-C,dg.px-C),a1=Math.atan2(py-C,px-C);
    patchPartT(dg.part,{r:Math.round(normDeg(dg.r+(a1-a0)*180/Math.PI))},'rot:'+dg.part)}
   else patchPartT(dg.part,{x:clamp(Math.round(dg.x+px-dg.px),-300,300),y:clamp(Math.round(dg.y+py-dg.py),-300,300)},'mv:'+dg.part)}}
  onPointerUp={()=>{drag.current=null;if(innerRef.current)innerRef.current.style.cursor='default'}}>
  {d.shadow&&<div className="absolute rounded-full pointer-events-none" style={{left:'50%',top:'50%',width:2*g.R*k,height:2*g.R*k,transform:'translate(-50%,-47%)',boxShadow:'0 16px 55px rgba(0,0,0,.55), 0 5px 20px rgba(0,0,0,.5)'}}/>}
  {camera==='profile'&&<canvas ref={profRef} width={Math.max(320,Math.round(box.w))} height={Math.max(260,Math.round(box.h))}
    className="absolute inset-0 w-full h-full" aria-label="Side profile and caseback elevation"/>}
  <div ref={innerRef} className="absolute" style={{width:size,height:size,left:'50%',top:'50%',transform:'translate(-50%,-50%)',
    display:camera==='profile'?'none':undefined}}>
   {layers.map(l=>{const{key,...rest}=l;return<LayerView key={key} {...rest} rot={rotFor(key)} k={k}/>})}
   <svg viewBox="0 0 1200 1200" className="absolute inset-0 w-full h-full pointer-events-none" style={{zIndex:40}}>
    {frames(s.sel,d).map((f,i)=>f.t==='c'
     ?<circle key={i} cx={C} cy={C} r={f.r} fill="none" stroke={GOLD} strokeWidth="3" className="dashAnim" opacity=".85"/>
     :<rect key={i} x={f.x} y={f.y} width={f.w} height={f.h} rx="14" fill="none" stroke={GOLD} strokeWidth="3" className="dashAnim" opacity=".85"/>)}
   </svg>
  </div>
  <div data-ui="1" className="absolute top-3 left-3 text-[10px] text-neutral-400 bg-black/50 backdrop-blur px-2.5 py-1.5 rounded-lg border border-white/10" style={{zIndex:50}}>
   Drag part to move · Alt-drag rotate · Shift+scroll scale · arrows nudge · [ ] rotate · 1–8 select · F fit · Ctrl+Z undo</div>
  <div data-ui="1" className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/60 backdrop-blur px-2.5 py-1.5 rounded-full border border-white/10" style={{zIndex:50}}>
   <button className={`chip ${t.mode==='live'?'on':''}`} onClick={()=>s.setD(n=>{n.time.mode='live'})}>● Live</button>
   {t.mode==='live'&&<label className="text-[10px] text-neutral-400 flex items-center gap-1"><input type="checkbox" checked={t.sweep} onChange={e=>s.setD(n=>{n.time.sweep=e.target.checked})}/>sweep</label>}
   <button className={`chip ${t.mode==='set'&&t.h===10&&t.m===8?'on':''}`} onClick={()=>s.setD(n=>{n.time.mode='set';n.time.h=10;n.time.m=8;n.time.s=36})}>10:08</button>
   <button className={`chip ${t.mode==='set'&&!(t.h===10&&t.m===8)?'on':''}`} onClick={()=>s.setD(n=>{n.time.mode='set'})}>Set</button>
   {t.mode==='set'&&<span className="flex items-center gap-1 text-[10px] text-neutral-400">
    {['h','m','s'].map(u=><input key={u} type="number" className="w-11 bg-[#1b1c21] border border-white/10 rounded px-1" value={t[u]}
     onChange={e=>s.setD(n=>{n.time[u]=clamp(+e.target.value||0,0,u==='h'?23:59)})}/>)}
   </span>}
  </div>
  <div data-ui="1" className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/60 backdrop-blur px-2 py-1.5 rounded-full border border-white/10" style={{zIndex:50}}>
   <button className="btn" onClick={()=>s.setD(n=>{n.zoom=clamp(n.zoom-0.15,0.4,3)})}>−</button>
   <span className="text-[10px] w-9 text-center text-neutral-300">{Math.round(d.zoom*100)}%</span>
   <button className="btn" onClick={()=>s.setD(n=>{n.zoom=clamp(n.zoom+0.15,0.4,3)})}>+</button>
   <button className="btn" onClick={()=>s.setD(n=>{n.zoom=1})}>Fit</button>
  </div>
 </div>}
