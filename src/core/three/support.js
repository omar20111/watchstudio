/* Can this browser draw the 3D watch?

   three.js needs WebGL 2. Some browsers never have it (hardware acceleration
   switched off, remote desktops, locked-down or very old machines), and any
   browser can lose it mid-session when the GPU driver resets. Without this, the
   first renderer to fail threw into the error boundary, whose "Try again" just
   threw again.

   The answer is a small external store so the stage, the presentation views
   and the exports all switch to the flat 2D drawing together. `?2d` in the URL
   forces that path — for testing, and for anyone whose GPU misbehaves. */
import React from 'react';

let state=null;                                   /* {ok, reason} once probed */
const subs=new Set();
const emit=()=>subs.forEach(f=>f());

const forced=()=>{try{return typeof location!=='undefined'&&new URLSearchParams(location.search).has('2d')}catch(e){return false}};

function probe(){
 if(forced())return{ok:false,reason:'forced'};
 try{const c=document.createElement('canvas');
  const gl=c.getContext('webgl2');
  if(!gl)return{ok:false,reason:'unsupported'};
  /* give the probe's context back: browsers cap live contexts at ~16 */
  const lose=gl.getExtension&&gl.getExtension('WEBGL_lose_context');if(lose)lose.loseContext();
  return{ok:true,reason:null}}
 catch(e){return{ok:false,reason:'unsupported'}}}

export function webglState(){if(!state)state=probe();return state}

/* A renderer failed to start, or the GPU dropped its context and never gave it
   back. Switch every view to the flat drawing. */
export function markWebglFailed(reason='failed',err){
 if(err)console.warn('WatchStudio: 3D unavailable ('+reason+')',err);
 const s=webglState();if(!s.ok&&s.reason===reason)return;
 state={ok:false,reason};emit()}

/* re-probe — after the user turns hardware acceleration back on, say */
export function retryWebgl(){state=probe();emit();return state.ok}

export function useWebgl(){
 return React.useSyncExternalStore(f=>{subs.add(f);return()=>subs.delete(f)},webglState,webglState)}

export const WEBGL_MESSAGE={
 forced:'Showing the flat 2D drawing because the page was opened with ?2d.',
 unsupported:'This browser can’t draw 3D graphics (WebGL 2 is off or unavailable), so WatchStudio is showing a flat 2D drawing.',
 failed:'The 3D view couldn’t start on this device, so WatchStudio is showing a flat 2D drawing.',
 lost:'The graphics driver stopped responding and didn’t recover, so WatchStudio switched to a flat 2D drawing.'};
