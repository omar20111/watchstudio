/* Shown in place of the watch when this browser cannot draw it in 3D: why, how
   to fix it, and a retry. The design itself is safe — it is saved as usual and
   comes back the moment 3D does. */
import React from 'react';
import {useWebgl,retryWebgl,WEBGL_MESSAGE} from '../core/three/support.js';
const {useState}=React;

export function NoWebgl({className=''}){const gl=useWebgl();const[tried,setTried]=useState(false);
 return<div role="status" className={`absolute inset-0 flex items-center justify-center p-6 ${className}`}>
  <div className="max-w-sm text-center space-y-3">
   <div className="text-3xl text-neutral-500" aria-hidden="true">◐</div>
   <h2 className="text-sm font-semibold text-neutral-200">The watch needs 3D graphics</h2>
   <p className="text-[12px] leading-5 text-neutral-400">{WEBGL_MESSAGE[gl.reason]||WEBGL_MESSAGE.failed} Turning on hardware
    acceleration in your browser settings, or opening WatchStudio in another browser, usually fixes it.
    Your design is saved and nothing is lost.</p>
   {tried&&<p className="text-[11px] text-amber-300">Still unavailable.</p>}
   <button className="btn" onClick={()=>setTried(!retryWebgl())}>Try again</button>
  </div></div>}
