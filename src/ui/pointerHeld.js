/* Whether a pointer is held down anywhere on the page: a slider being dragged.
   Work that a drag would otherwise repeat on every step (rebuilding the live
   watch, rendering the preset pictures) waits until the pointer is let go. */
let held=false;const waiting=[];
const up=()=>{held=false;for(const f of waiting.splice(0))f()};
if(typeof window!=='undefined'&&window.addEventListener){
 window.addEventListener('pointerdown',()=>{held=true},true);window.addEventListener('pointerup',up,true);
 window.addEventListener('pointercancel',up,true);window.addEventListener('blur',up)}
export const pointerHeld=()=>held;
/* resolves at once, or when the pointer is let go */
export const pointerFree=()=>held?new Promise(r=>waiting.push(r)):Promise.resolve();
