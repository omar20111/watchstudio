/* 3D spike stage — dev builds only (see the toggle in Stage.jsx).

   Renders the lathed head through core/three/view.js against the same scene
   background as the 2D stage. Front is orthographic on the 1200 px sheet so it
   lines up with the 2D drawing; three-quarter can be orbited with the mouse. */
import React from 'react';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {useApp,store} from '../state/store.js';
import {BG} from '../core/constants.js';
import {sceneClock} from '../core/time.js';
import {createView} from '../core/three/view.js';
const {useEffect,useRef}=React;

export default function Stage3D({view}){const s=useApp();const d=s.d;
 const host=useRef(),cv=useRef(),vr=useRef();

 useEffect(()=>{const v=createView(cv.current);vr.current=v;let raf;
  const ro=new ResizeObserver(e=>{const r=e[0].contentRect;v.resize(r.width,r.height,window.devicePixelRatio||1)});
  ro.observe(host.current);
  /* the clock is read per frame, not through React, so hands sweep without
     re-rendering the component tree */
  const loop=()=>{v.render(sceneClock(store.getState().d,Date.now()));raf=requestAnimationFrame(loop)};loop();
  return()=>{cancelAnimationFrame(raf);ro.disconnect();v.dispose();vr.current=null}},[]);

 useEffect(()=>{vr.current&&vr.current.setDesign(d)},[d]);

 useEffect(()=>{const v=vr.current;if(!v)return;v.setView(view);
  if(view!=='three-quarter')return;
  const c=new OrbitControls(v.camera(),cv.current);
  c.target.copy(v.target());c.enablePan=false;c.minDistance=70;c.maxDistance=500;
  c.maxPolarAngle=Math.PI*0.49;c.update();
  return()=>c.dispose()},[view,d]);

 return<div ref={host} data-ui="1" className="absolute inset-0" style={{background:BG[d.bg].css,zIndex:45}}
  onWheel={e=>e.stopPropagation()}>
  <canvas ref={cv} className="block w-full h-full" aria-label="3D watch head (spike)"/>
  <div className="absolute bottom-14 left-1/2 -translate-x-1/2 text-[10px] text-amber-200/80 bg-black/55 px-2.5 py-1 rounded whitespace-nowrap">
   3D spike · case, bezel, rehaut &amp; crystal are lathed from the mm geometry · dial, indices &amp; hands are the 2D bakes as textures · no lugs, strap or crown yet
  </div>
 </div>}
