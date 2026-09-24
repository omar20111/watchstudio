/* A photo of the product view: path traced from exactly the camera on screen,
   refining over a few hundred samples, saved as a PNG whenever it looks done.

   It draws on its own canvas over the live view, and the live view pauses
   underneath so the GPU works on the photo alone. The overlay takes the
   pointer: turning the watch mid-photo would only restart it.

   Where the browser cannot path trace (photo.js canPathTrace: Direct3D, the
   default on Windows), the photo is the live view's own frame made in full —
   every anti-aliasing sample, occlusion on — and is ready at once. */
import React from 'react';
import {store} from '../state/store.js';
import {toast} from '../core/utils.js';
import {sceneClock} from '../core/time.js';
import {createPhoto,canPathTrace,BLUR_FSTOP,PHOTO_SAMPLES} from '../core/three/photo.js';
const {useEffect,useRef,useState}=React;

/* a photo's pixel budget: the view's size at the screen's density, capped so a
   large display does not take minutes per image */
const MAX_PIXELS=2.6e6;

export function PhotoOverlay({view,box,onClose}){
 const cv=useRef(),photo=useRef(null);
 /* while a save reads the canvas back, refining waits: the readback queues
    behind the path tracer's work otherwise, and the file is one steady frame */
 const saving=useRef(false);
 const[status,setStatus]=useState('preparing');     /* preparing | rendering | done | failed */
 const[samples,setSamples]=useState(0);
 const[raster,setRaster]=useState(false);

 useEffect(()=>{const live=view.current;if(!live||!cv.current)return;
  let raf=0,dead=false;const st=store.getState(),d=st.d;
  live.paused=true;
  (async()=>{
   try{
    if(!canPathTrace(live.renderer)){setRaster(true);
     /* a watch just rebuilt may still be compiling: its frame comes once it has */
     while(live.compiling){await new Promise(r=>setTimeout(r,50));if(dead)return}
     await new Promise(r=>setTimeout(r,30));if(dead)return;
     /* drawn and copied in one go: the live canvas keeps no frame once shown */
     const src=live.renderer.domElement,out=cv.current,ao=live.aoOn,at=sceneClock(d,Date.now());
     out.width=src.width;out.height=src.height;
     live.setAO(true);live.render(at);while(live.refine(at));
     out.getContext('2d').drawImage(src,0,0);live.setAO(ao);
     setSamples(PHOTO_SAMPLES);setStatus('done');return}
    const dpr=Math.min(2,window.devicePixelRatio||1),px=box.w*box.h*dpr*dpr;
    const density=px>MAX_PIXELS?dpr*Math.sqrt(MAX_PIXELS/px):dpr;
    const gl=live.renderer.capabilities;
    /* The path tracer keeps every texture in one array at one size — about
       fifteen of them for a watch on a surface. At 2048 that is ~250 MB of GPU
       memory on top of the live view's; 1536 keeps the dial's printing crisp at
       a little over half that, and a phone gets 1024. */
    const coarse=matchMedia('(pointer: coarse)').matches;
    const p=photo.current=createPhoto(cv.current,{textureSize:coarse||gl.maxTextureSize<8192?1024:1536});
    p.resize(box.w,box.h,density);
    /* let the status paint before the scene build blocks the thread */
    await new Promise(r=>setTimeout(r,30));if(dead)return;
    const pr=d.product||{},wr=pr.wrist||{};
    await p.setDesign(d,st.customs,{surface:pr.surface||'studio',wrist:wr.on?wr.cm||17:0,tone:wr.tone||'medium',side:wr.side||'left'});if(dead)return;
    const cam=live.camera();
    p.setView({position:cam.position,target:live.target(),fov:cam.fov,aspect:box.w/box.h,fStop:BLUR_FSTOP[(d.product||{}).blur]??null});
    setStatus('rendering');
    const step=()=>{if(dead)return;
     if(saving.current){raf=setTimeout(()=>{raf=requestAnimationFrame(step)},100);return}
     const t0=performance.now();
     /* as many samples as fit in a frame, so the page stays responsive */
     do p.renderSample();while(performance.now()-t0<22&&p.samples<PHOTO_SAMPLES);
     setSamples(Math.floor(p.samples));
     if(p.samples>=PHOTO_SAMPLES){setStatus('done');return}
     /* a slow GPU spends whole frames on one sample: leave a gap between them,
        or taps on Save and Done wait behind the rendering */
     if(performance.now()-t0>120)raf=setTimeout(()=>{raf=requestAnimationFrame(step)},60);
     else raf=requestAnimationFrame(step)};
    raf=requestAnimationFrame(step)}
   catch(e){console.error('WatchStudio: photo failed',e);if(!dead)setStatus('failed')}})();
  return()=>{dead=true;cancelAnimationFrame(raf);clearTimeout(raf);
   if(photo.current){photo.current.dispose();photo.current=null}
   live.paused=false}},[]);

 useEffect(()=>{const k=e=>{if(e.key==='Escape'){e.stopPropagation();onClose()}};
  window.addEventListener('keydown',k,true);return()=>window.removeEventListener('keydown',k,true)},[]);

 const save=()=>{saving.current=true;cv.current.toBlob(b=>{saving.current=false;
  if(!b){toast('The photo could not be saved');return}
  const name=store.getState().projName.replace(/\s+/g,'_');
  const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`${name}_photo.png`;a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),6000);toast('Photo saved')},'image/png')};

 const pct=Math.round(samples/PHOTO_SAMPLES*100);
 return<div className="absolute inset-0" style={{zIndex:60,touchAction:'none'}} onPointerDown={e=>e.stopPropagation()}>
  <canvas ref={cv} className="absolute inset-0 w-full h-full block" aria-label={raster?'Photo of the watch':'Photo of the watch, path traced'}/>
  {status==='preparing'&&<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
   <div className="rounded-lg bg-black/70 border border-white/10 px-4 py-2 text-[12px] text-neutral-200">Setting up the photo…</div></div>}
  <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-2 whitespace-nowrap rounded-full bg-black/70 backdrop-blur border border-white/10 px-3 py-1.5 text-[11px] text-neutral-200">
   {status==='failed'
    ?<span className="text-amber-300">This device’s graphics can’t render a photo.</span>
    :<>
     {/* a fixed width, so the bar does not shift under the pointer as the count changes */}
     <span className="tabular-nums inline-block w-[6.5rem]" role="status" aria-live="polite">
      {status==='preparing'?'Preparing…':status==='done'?'Photo ready':`Refining… ${pct}%`}</span>
     {raster
      ?<span className="text-neutral-400 cursor-help" title="This browser draws 3D through Direct3D, where a ray-traced photo cannot be made; this is the live view rendered in full. For ray-traced photos in Chrome or Edge, set chrome://flags › Choose ANGLE graphics backend to OpenGL.">Fast render</span>
      :<span className="w-24 h-1.5 rounded-full bg-white/10 overflow-hidden" aria-hidden="true">
       <span className="block h-full bg-[#d4af37]" style={{width:`${pct}%`}}/></span>}
     <button className="goldbtn !py-1 !px-3" disabled={samples<8} onClick={save}>Save PNG</button>
    </>}
   <button className="btn" onClick={onClose}>Done</button>
  </div>
 </div>}
