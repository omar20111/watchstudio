/* Two-finger touch gestures on a view: pinch to zoom, drag to tilt or pan.

   The browser's own handling has to be switched off on the view (touch-action:
   none, set by the caller's CSS): left on, a pinch zooms the whole page — the
   editor ends up magnified 3x and stays that way — and a two-finger drag
   scrolls it. iOS Safari also sends its proprietary gesture events, which are
   cancelled here too.

   A gesture locks into one mode once the fingers have clearly moved: 'pinch'
   when the spread changes first, 'pan' when they travel together first. So a
   pinch does not also tilt the watch, and a two-finger drag does not zoom it.
   One finger is left alone for the view's own dragging and orbiting. */
import React from 'react';
const {useEffect,useRef}=React;

const LOCK_PX=14;

export function useTwoFingers(ref,{onStart,onPinch,onPan,onEnd},deps=[]){
 const cb=useRef({});cb.current={onStart,onPinch,onPan,onEnd};
 useEffect(()=>{const el=ref.current;if(!el)return;
  const pts=new Map();let g=null;
  const read=()=>{const[a,b]=[...pts.values()];return{dist:Math.hypot(a.x-b.x,a.y-b.y),cx:(a.x+b.x)/2,cy:(a.y+b.y)/2}};
  const down=e=>{if(e.pointerType!=='touch')return;pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
   if(pts.size===2){const r=read();g={...r,mode:null};cb.current.onStart&&cb.current.onStart()}};
  const move=e=>{if(!pts.has(e.pointerId))return;pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
   if(!g||pts.size!==2)return;const r=read();
   const spread=Math.abs(r.dist-g.dist),travel=Math.hypot(r.cx-g.cx,r.cy-g.cy);
   if(!g.mode&&(spread>LOCK_PX||travel>LOCK_PX))g.mode=spread>=travel?'pinch':'pan';
   if(g.mode==='pinch'&&cb.current.onPinch)cb.current.onPinch(r.dist/Math.max(1,g.dist));
   if(g.mode==='pan'&&cb.current.onPan)cb.current.onPan(r.cx-g.cx,r.cy-g.cy)};
  const up=e=>{if(!pts.delete(e.pointerId))return;
   if(g&&pts.size<2){const mode=g.mode;g=null;cb.current.onEnd&&cb.current.onEnd(mode)}};
  const cancelGesture=e=>e.preventDefault();
  el.addEventListener('pointerdown',down,true);el.addEventListener('pointermove',move,true);
  el.addEventListener('pointerup',up,true);el.addEventListener('pointercancel',up,true);
  el.addEventListener('gesturestart',cancelGesture);el.addEventListener('gesturechange',cancelGesture);
  return()=>{el.removeEventListener('pointerdown',down,true);el.removeEventListener('pointermove',move,true);
   el.removeEventListener('pointerup',up,true);el.removeEventListener('pointercancel',up,true);
   el.removeEventListener('gesturestart',cancelGesture);el.removeEventListener('gesturechange',cancelGesture)}},deps);
 }

/* true while a media query matches, e.g. '(pointer: coarse)' for a touch screen */
export function useMedia(query){
 const get=()=>typeof matchMedia!=='undefined'&&matchMedia(query).matches;
 const[on,setOn]=React.useState(get);
 useEffect(()=>{if(typeof matchMedia==='undefined')return;const m=matchMedia(query),f=()=>setOn(m.matches);
  f();m.addEventListener('change',f);return()=>m.removeEventListener('change',f)},[query]);
 return on}
