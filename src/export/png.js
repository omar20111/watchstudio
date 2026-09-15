/* PNG export — the 3D scene re-rendered at the export resolution (never
   upscaled), in GPU-sized tiles when the image is larger than one render target.

   It takes a CLOCK rather than reading `new Date()` — that is what made two
   exports of the same posed design differ. The camera follows the stage: a
   three-quarter design exports three-quarter, anything else exports the front. */
import {CAN} from '../core/constants.js';
import {sceneClock} from '../core/time.js';
import {store} from '../state/store.js';
import {toast} from '../core/utils.js';
import {sceneBlob3D} from '../core/three/view.js';
import {hasStructuralUpload} from '../core/three/uploads.js';
import {webglState} from '../core/three/support.js';

export {loadImg,cover,paintBackground} from './background.js';

/* A 4-byte-per-pixel canvas at 8x is 9600² = 368 MB before the GPU tiles.
   Mid-range phones report deviceMemory 2-4 and simply die. Cap the multiplier
   rather than OOM. */
export function maxMult(){
 const mem=(typeof navigator!=='undefined'&&navigator.deviceMemory)||8;
 if(mem<=2)return 2;
 if(mem<=4)return 4;
 return 8}
export function capMult(mult){const cap=maxMult();
 if(mult<=cap)return{mult,capped:false};
 return{mult:cap,capped:true}}

export const exportCamera=(d,customs)=>d.camera==='three-quarter'&&!hasStructuralUpload(d,customs)?'three-quarter':'front';

/* a composed scene as a Blob, at `mult` resolution */
export function sceneBlob(d,customs,o={}){
 const {mult}=capMult(o.mult||1);
 return sceneBlob3D(d,customs,{size:CAN*mult,camera:o.camera||exportCamera(d,customs),clock:o.clock})}

export async function exportPNG(want){
 const s=store.getState(),d=s.d;
 if(!webglState().ok){toast('PNG export renders the watch in 3D, which needs WebGL');return}
 const {mult,capped}=capMult(want);
 if(capped)toast(`Exporting at ${mult}x — this device reports too little memory for ${want}x`);
 /* posed designs export from the scene clock; a live design is frozen at the
    instant the button was pressed so the file matches what was on screen */
 const clock=sceneClock(d,Date.now());
 let blob;
 try{blob=await sceneBlob(d,s.customs,{mult,clock})}
 catch(e){console.error('WatchStudio: PNG export failed',e)}
 if(!blob){toast('Export failed — the image was too large for this device');return}
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);
 a.download=`${s.projName.replace(/\s+/g,'_')}_${exportCamera(d,s.customs)}_${mult}x.png`;a.click();
 setTimeout(()=>URL.revokeObjectURL(a.href),4000)}
