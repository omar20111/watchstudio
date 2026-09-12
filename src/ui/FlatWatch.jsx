/* A live flat 2D drawing of the current design — the stand-in for the 3D view
   when the browser has no WebGL (see core/three/support.js).

   Like WatchCanvas, the loop reads the store directly so the hands move
   without re-rendering React. Without a GPU every drawImage is paid on the CPU,
   so the static stack is recomposed at most every 90 ms while a slider drags,
   and the hands redraw at 10 Hz rather than every frame. */
import React from 'react';
import {CAN} from '../core/constants.js';
import {store} from '../state/store.js';
import {sceneClock} from '../core/time.js';
import {prepareFlat,drawFlat} from '../export/flat.js';
const {useEffect,useRef}=React;

export function FlatWatch({size,label='Watch, flat 2D drawing',className='',style}){
 const cv=useRef(),dirty=useRef(true);

 /* backing store follows the displayed size and the screen's pixel density */
 useEffect(()=>{const c=cv.current;if(!c)return;
  const px=Math.min(2400,Math.max(1,Math.round(size*Math.min(2,window.devicePixelRatio||1))));
  if(c.width!==px){c.width=c.height=px}dirty.current=true},[size]);

 useEffect(()=>{let raf,alive=true,prep=null,forD=null,forC=null,busy=false,lastPrep=-1e9,lastDraw=-1e9;
  const loop=t=>{if(!alive)return;const st=store.getState();
   if((st.d!==forD||st.customs!==forC)&&!busy&&t-lastPrep>90){
    busy=true;lastPrep=t;const d=st.d,c=st.customs;
    prepareFlat(d,c).then(p=>{if(!alive)return;prep=p;forD=d;forC=c;dirty.current=true})
     .catch(e=>console.error('WatchStudio: flat drawing failed',e))
     .finally(()=>{busy=false})}
   const tm=st.d.time||{},ticking=tm.mode==='live'||!!(st.d.chrono&&st.d.chrono.running);
   const c=cv.current;
   if(prep&&c&&(dirty.current||(ticking&&t-lastDraw>100))){
    const ctx=c.getContext('2d'),k=c.width/CAN;
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,c.width,c.height);ctx.setTransform(k,0,0,k,0,0);
    drawFlat(ctx,prep,sceneClock(st.d,Date.now()),k);dirty.current=false;lastDraw=t}
   raf=requestAnimationFrame(loop)};
  raf=requestAnimationFrame(loop);
  return()=>{alive=false;cancelAnimationFrame(raf)}},[]);

 return<canvas ref={cv} role="img" aria-label={label} className={`block ${className}`} style={{width:size,height:size,...style}}/>}
