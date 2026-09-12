/* A live 3D view of the current design, for the editor and the product view.

   The render loop reads the store directly rather than through React, so the
   hands sweep and a dragged part follows the pointer without re-rendering the
   component tree. Part transforms are applied every frame they change; the
   watch itself is only rebuilt when something that changes its geometry or
   materials changes, and at most every ~90 ms while a slider is dragged.

   It draws only when something changed — an edit, a resize, an orbit, a
   loaded upload — or when the clock moves the hands: every frame for a sweeping
   seconds hand, five times a second for a ticking one, never for a posed watch.
   A physically lit scene is expensive on a laptop GPU; an idle stage costs
   nothing. */
import React from 'react';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {store} from '../state/store.js';
import {sceneClock} from '../core/time.js';
import {createView} from '../core/three/view.js';
const {useEffect,useRef,useState}=React;

export function useWatchView({camera='front',orbit=false}={}){
 const host=useRef(),canvas=useRef(),view=useRef(null),dirty=useRef(true);
 const[box,setBox]=useState({w:900,h:700});

 useEffect(()=>{const v=createView(canvas.current);view.current=v;
  /* dev only: the live view, for the console and the browser checks */
  if(import.meta.env&&import.meta.env.DEV)window.__watchView=v;
  let raf,lastD=null,lastC=null,lastBuild=-1e9,lastDraw=-1e9;
  v.onDirty(()=>{lastD=null;dirty.current=true});   /* an upload finished loading */
  const ro=new ResizeObserver(e=>{const r=e[0].contentRect;
   v.resize(r.width,r.height,Math.min(2,window.devicePixelRatio||1));setBox({w:r.width,h:r.height});dirty.current=true});
  ro.observe(host.current);
  const loop=t=>{const st=store.getState();
   if(st.d!==lastD||st.customs!==lastC){dirty.current=true;
    if(v.stale(st.d,st.customs)&&t-lastBuild<90)v.pose(st.d);
    else{v.setDesign(st.d,st.customs);lastBuild=t;lastD=st.d;lastC=st.customs}}
   const tm=st.d.time||{},running=!!(st.d.chrono&&st.d.chrono.running);
   const ticking=tm.mode==='live'||running,smooth=ticking&&(tm.sweep||running);
   if(dirty.current||smooth||(ticking&&t-lastDraw>200)){
    v.render(sceneClock(st.d,Date.now()));dirty.current=false;lastDraw=t}
   raf=requestAnimationFrame(loop)};
  raf=requestAnimationFrame(loop);
  return()=>{cancelAnimationFrame(raf);ro.disconnect();v.dispose();view.current=null}},[]);

 /* the caller frames the camera (setFrame) in its own effect, after this one */
 useEffect(()=>{const v=view.current;if(v){v.setCamera(camera);dirty.current=true}},[camera]);

 useEffect(()=>{const v=view.current;if(!v||!orbit||camera!=='three-quarter')return;
  const c=new OrbitControls(v.camera(),canvas.current);
  c.target.copy(v.target());c.enablePan=false;c.enableZoom=false;c.maxPolarAngle=Math.PI*.495;c.rotateSpeed=.7;
  c.addEventListener('change',()=>{v.syncOrbit();dirty.current=true});c.update();
  return()=>c.dispose()},[camera,orbit]);

 /* callers changing the frame or orbit from outside mark the view for a redraw */
 const redraw=()=>{dirty.current=true};
 return{host,canvas,view,box,redraw}}
