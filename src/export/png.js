/* PNG export — re-renders vector parts at full resolution (no upsample blur).

   composeScene() is the single compositor: the stage, the spec card and the
   layered export all go through it, so what you see and what you export cannot
   diverge. It takes a CLOCK rather than reading `new Date()` — that is what
   made two exports of the same posed design differ. */
import {CAN} from '../core/constants.js';
import {geoOf} from '../core/geometry.js';
import {buildLayers,layerAngle} from '../core/layers.js';
import {DR,procOpts} from '../core/render/index.js';
import {LEATHER} from '../core/textures.js';
import {marketingClock,sceneClock} from '../core/time.js';
import {store} from '../state/store.js';
import {toast} from '../core/utils.js';

export const loadImg=src=>new Promise((res,rej)=>{const i=new Image();i.crossOrigin='anonymous';i.onload=()=>res(i);i.onerror=rej;i.src=src});
export const cover=(ctx,im)=>{const s=Math.max(CAN/im.width,CAN/im.height);ctx.drawImage(im,(CAN-im.width*s)/2,(CAN-im.height*s)/2,im.width*s,im.height*s)};

/* A 4-byte-per-pixel canvas at 8x is 9600² = 368 MB, and the browser needs a
   second one per procedural layer while it re-renders. Mid-range phones report
   deviceMemory 2-4 and simply die. Cap the multiplier rather than OOM. */
export function maxMult(){
 const mem=(typeof navigator!=='undefined'&&navigator.deviceMemory)||8;
 if(mem<=2)return 2;
 if(mem<=4)return 4;
 return 8}
export function capMult(mult){const cap=maxMult();
 if(mult<=cap)return{mult,capped:false};
 return{mult:cap,capped:true}}

export function paintBackground(ctx,d){
 if(d.bg==='transparent')return Promise.resolve();
 if(d.bg==='leather'){ctx.fillStyle=ctx.createPattern(LEATHER,'repeat');ctx.fillRect(0,0,CAN,CAN);return Promise.resolve()}
 if(d.bg==='wrist'&&d.bgCustom)return loadImg(d.bgCustom).then(im=>cover(ctx,im)).catch(()=>{});
 const gr=ctx.createRadialGradient(CAN/2,CAN*0.3,0,CAN/2,CAN/2,900);
 if(d.bg==='studio'){gr.addColorStop(0,'#43474e');gr.addColorStop(.6,'#2a2c31');gr.addColorStop(1,'#17181c')}
 else{gr.addColorStop(0,'#23252a');gr.addColorStop(.6,'#131418');gr.addColorStop(1,'#0a0b0d')}
 ctx.fillStyle=gr;ctx.fillRect(0,0,CAN,CAN);return Promise.resolve()}

/* Draw the whole watch into ctx, which must already be scaled by `mult`. */
export async function composeScene(ctx,d,customs,o={}){
 const mult=o.mult||1,clock=o.clock||sceneClock(d,Date.now()),g=geoOf(d);
 if(o.bg!==false)await paintBackground(ctx,d);
 if(d.shadow&&o.shadow!==false){ctx.save();ctx.filter=`blur(${26*mult}px)`;ctx.fillStyle='rgba(0,0,0,.5)';
  ctx.beginPath();ctx.ellipse(CAN/2+10,CAN/2+16,g.R*1.02,g.R*0.99,0,0,7);ctx.fill();ctx.restore()}
 for(const l of buildLayers(d,customs)){
  let im=l.cv;
  if(l.proc){/* re-render vector parts at full export resolution */
   const c2=document.createElement('canvas');c2.width=c2.height=CAN*mult;
   const x2=c2.getContext('2d');x2.scale(mult,mult);
   DR[l.proc[0]](x2,procOpts(l.proc[0],d,l.proc[1]));im=c2}
  else if(l.url){try{im=await loadImg(l.url)}catch(e){continue}}
  const rot=layerAngle(l.key,clock),t=l.t;
  ctx.save();ctx.globalAlpha=l.o??1;
  let f=(l.filter&&l.filter!=='none')?l.filter:'';
  /* ctx.filter radii are output-bitmap pixels and ignore the CTM */
  if(l.glow)f+=` drop-shadow(0 0 ${7*mult}px ${l.glow})`;
  if(f)ctx.filter=f;
  ctx.translate(CAN/2+t.x,CAN/2+t.y);ctx.rotate((rot+t.r)*Math.PI/180);ctx.scale(t.s,t.s);
  ctx.drawImage(im,-CAN/2,-CAN/2,CAN,CAN);ctx.restore()}
 return ctx}

/* a composed scene as a Blob, at `mult` resolution */
export async function sceneBlob(d,customs,o={}){
 const {mult}=capMult(o.mult||1);
 const cv=document.createElement('canvas');cv.width=cv.height=CAN*mult;
 const ctx=cv.getContext('2d');ctx.scale(mult,mult);
 await composeScene(ctx,d,customs,{...o,mult});
 return new Promise(res=>cv.toBlob(res,'image/png'))}

export async function exportPNG(want){
 const s=store.getState(),d=s.d;
 const {mult,capped}=capMult(want);
 if(capped)toast(`Exporting at ${mult}x — this device reports too little memory for ${want}x`);
 /* posed designs export from the scene clock; a live design is frozen at the
    instant the button was pressed so the file matches what was on screen */
 const clock=sceneClock(d,Date.now());
 const blob=await sceneBlob(d,s.customs,{mult,clock});
 if(!blob){toast('Export failed — the canvas was too large for this device');return}
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);
 a.download=`${s.projName.replace(/\s+/g,'_')}_${mult}x.png`;a.click();
 setTimeout(()=>URL.revokeObjectURL(a.href),4000)}

export {marketingClock};
