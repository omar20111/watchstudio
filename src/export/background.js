/* Scene backdrops painted into an export canvas — the same looks the stage
   shows behind the watch with CSS. */
import {CAN} from '../core/constants.js';
import {LEATHER} from '../core/textures.js';

export const loadImg=src=>new Promise((res,rej)=>{const i=new Image();i.crossOrigin='anonymous';i.onload=()=>res(i);i.onerror=rej;i.src=src});
export const cover=(ctx,im)=>{const s=Math.max(CAN/im.width,CAN/im.height);ctx.drawImage(im,(CAN-im.width*s)/2,(CAN-im.height*s)/2,im.width*s,im.height*s)};

export function paintBackground(ctx,d){
 if(d.bg==='transparent')return Promise.resolve();
 if(d.bg==='leather'){ctx.fillStyle=ctx.createPattern(LEATHER,'repeat');ctx.fillRect(0,0,CAN,CAN);return Promise.resolve()}
 if(d.bg==='wrist'&&d.bgCustom)return loadImg(d.bgCustom).then(im=>cover(ctx,im)).catch(()=>{});
 const gr=ctx.createRadialGradient(CAN/2,CAN*0.3,0,CAN/2,CAN/2,900);
 if(d.bg==='studio'){gr.addColorStop(0,'#43474e');gr.addColorStop(.6,'#2a2c31');gr.addColorStop(1,'#17181c')}
 else{gr.addColorStop(0,'#23252a');gr.addColorStop(.6,'#131418');gr.addColorStop(1,'#0a0b0d')}
 ctx.fillStyle=gr;ctx.fillRect(0,0,CAN,CAN);return Promise.resolve()}
