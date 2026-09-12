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
   nothing.

   No WebGL, or a renderer that fails to start, and the hook creates nothing:
   callers read `flat` and show the 2D drawing instead. If the GPU drops the
   context the loop stops and `lost` is set; when the browser restores it the
   view is rebuilt from scratch (`gen` bumps), and if it never comes back every
   view switches to the flat drawing. */
import React from 'react';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {store} from '../state/store.js';
import {sceneClock} from '../core/time.js';
import {createView} from '../core/three/view.js';
import {useWebgl,markWebglFailed} from '../core/three/support.js';
const {useEffect,useRef,useState}=React;

/* how long a lost context may take to come back before we give up on 3D */
const RESTORE_WAIT_MS=6000;
const dprOf=()=>Math.min(2,window.devicePixelRatio||1);

export function useWatchView({camera='front',orbit=false}={}){
 const gl=useWebgl();
 const host=useRef(),canvas=useRef(),view=useRef(null),dirty=useRef(true);
 const[box,setBox]=useState({w:900,h:700});
 const[gen,setGen]=useState(0);
 const[lost,setLost]=useState(false);

 /* the host is measured whether or not there is a 3D view: the flat drawing
    is sized from it too */
 useEffect(()=>{const ro=new ResizeObserver(e=>{const r=e[0].contentRect;
   setBox({w:r.width,h:r.height});
   if(view.current){view.current.resize(r.width,r.height,dprOf());dirty.current=true}});
  ro.observe(host.current);return()=>ro.disconnect()},[]);

 useEffect(()=>{if(!gl.ok)return;const cvs=canvas.current;if(!cvs)return;
  let v;
  try{v=createView(cvs)}catch(e){markWebglFailed('failed',e);return}
  view.current=v;dirty.current=true;
  /* dev only: the live view, for the console and the browser checks */
  if(import.meta.env&&import.meta.env.DEV)window.__watchView=v;
  const r=host.current.getBoundingClientRect();v.resize(r.width,r.height,dprOf());
  let raf=null,lastD=null,lastC=null,lastBuild=-1e9,lastDraw=-1e9,giveUp=null;
  v.onDirty(()=>{lastD=null;dirty.current=true});   /* an upload finished loading */
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

  const onLost=e=>{e.preventDefault();cancelAnimationFrame(raf);raf=null;setLost(true);
   giveUp=setTimeout(()=>markWebglFailed('lost'),RESTORE_WAIT_MS)};
  const onRestored=()=>{clearTimeout(giveUp);setLost(false);setGen(g=>g+1)};
  cvs.addEventListener('webglcontextlost',onLost);cvs.addEventListener('webglcontextrestored',onRestored);

  return()=>{cancelAnimationFrame(raf);clearTimeout(giveUp);
   cvs.removeEventListener('webglcontextlost',onLost);cvs.removeEventListener('webglcontextrestored',onRestored);
   v.dispose();view.current=null;
   if(import.meta.env&&import.meta.env.DEV&&window.__watchView===v)window.__watchView=null}},[gl.ok,gen]);

 /* the caller frames the camera (setFrame) in its own effect, after this one */
 useEffect(()=>{const v=view.current;if(v){v.setCamera(camera);dirty.current=true}},[camera,gen,gl.ok]);

 useEffect(()=>{const v=view.current;if(!v||!orbit||camera!=='three-quarter')return;
  const c=new OrbitControls(v.camera(),canvas.current);
  c.target.copy(v.target());c.enablePan=false;c.enableZoom=false;c.maxPolarAngle=Math.PI*.495;c.rotateSpeed=.7;
  c.addEventListener('change',()=>{v.syncOrbit();dirty.current=true});c.update();
  return()=>c.dispose()},[camera,orbit,gen,gl.ok]);

 /* callers changing the frame or orbit from outside mark the view for a redraw */
 const redraw=()=>{dirty.current=true};
 return{host,canvas,view,box,redraw,gen,lost,flat:!gl.ok}}

/* shown over a view while the browser brings a dropped GPU context back */
export const RestoringNotice=()=><div role="status" className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{zIndex:55}}>
 <div className="text-[11px] text-neutral-300 bg-black/70 border border-white/10 rounded-lg px-3 py-2">Graphics were reset by the browser — restoring the 3D view…</div></div>;
