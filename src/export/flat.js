/* The flat 2D drawing — what WatchStudio shows and exports when there is no WebGL.

   Every part renderer still paints its lit 2D artwork (the preset thumbnails
   and the layered export's per-part files use it), so this stacks those layers
   the way the 2D stage did before the 3D watch replaced it: each part's
   transform, the clock angle of the hands and bezel insert, metal tint filters,
   lume glow and crystal opacity.

   It is split so a live view can afford it on a machine with no GPU: everything
   under the hands is composed once per design (prepareFlat), and only the hands
   and the crystal are drawn per clock tick (drawFlat). No three.js in here. */
import {CAN} from '../core/constants.js';
import {geoOf} from '../core/geometry.js';
import {buildLayers,layerAngle} from '../core/layers.js';
import {DR,procOpts} from '../core/render/index.js';
import {sceneClock} from '../core/time.js';
import {loadImg,paintBackground} from './background.js';

/* hands (z 9-11) and the crystal (z 12) move with the clock or sit above what does */
const OVER_Z=9;

/* one layer onto a context already scaled to sheet units; `px` is output pixels
   per sheet pixel, because filter radii ignore the transform */
function drawLayer(ctx,l,clock,px){
 const t=l.t||{},rot=layerAngle(l.key,clock);
 ctx.save();ctx.globalAlpha=(l.o??1)*(t.o??1);
 let f=l.filter&&l.filter!=='none'?l.filter:'';
 if(l.glow)f+=` drop-shadow(0 0 ${7*px}px ${l.glow})`;
 if(f&&'filter'in ctx)ctx.filter=f;
 ctx.translate(CAN/2+(t.x||0),CAN/2+(t.y||0));ctx.rotate(((rot||0)+(t.r||0))*Math.PI/180);ctx.scale(t.s??1,t.s??1);
 ctx.drawImage(l.img,-CAN/2,-CAN/2,CAN,CAN);ctx.restore()}

/* Resolve every layer's picture and compose the static stack.
   mult > 1 re-renders the painted parts at that resolution instead of upscaling. */
export async function prepareFlat(d,customs={},{mult=1,shadow=d.shadow!==false}={}){
 const clock=sceneClock(d,Date.now());           /* only the bezel insert reads it here */
 const layers=[];
 for(const l of buildLayers(d,customs)){
  let img=l.cv;
  if(l.proc&&mult>1){const c=document.createElement('canvas');c.width=c.height=CAN*mult;
   const x=c.getContext('2d');x.scale(mult,mult);DR[l.proc[0]](x,procOpts(l.proc[0],d,l.proc[1]));img=c}
  else if(!img&&l.url){try{img=await loadImg(l.url)}catch(e){continue}}   /* a missing upload is skipped, not fatal */
  if(img)layers.push({...l,img})}
 const below=document.createElement('canvas');below.width=below.height=CAN*mult;
 const ctx=below.getContext('2d');ctx.scale(mult,mult);
 if(shadow){const g=geoOf(d);ctx.save();
  if('filter'in ctx)ctx.filter=`blur(${26*mult}px)`;
  ctx.fillStyle='rgba(0,0,0,.5)';ctx.beginPath();ctx.ellipse(CAN/2+10,CAN/2+16,g.R*1.02,g.R*.99,0,0,Math.PI*2);ctx.fill();ctx.restore()}
 for(const l of layers)if(l.z<OVER_Z)drawLayer(ctx,l,clock,mult);
 return{mult,below,over:layers.filter(l=>l.z>=OVER_Z)}}

/* draw a prepared design onto a context scaled to sheet units */
export function drawFlat(ctx,prep,clock,px=1){
 ctx.drawImage(prep.below,0,0,CAN,CAN);
 for(const l of prep.over)drawLayer(ctx,l,clock,px)}

/* a finished picture, `size` px square, optionally over the scene background */
export async function flatCanvas(d,customs,{size=CAN,clock,background=true,shadow}={}){
 const mult=Math.max(1,Math.ceil(size/CAN));
 const out=document.createElement('canvas');out.width=out.height=size;
 const ctx=out.getContext('2d');const k=size/CAN;ctx.scale(k,k);
 if(background)await paintBackground(ctx,d);
 const prep=await prepareFlat(d,customs,{mult,shadow});
 drawFlat(ctx,prep,clock||sceneClock(d,Date.now()),k);
 return out}

export async function flatBlob(d,customs,o={}){const cv=await flatCanvas(d,customs,o);
 return new Promise(r=>cv.toBlob(r,'image/png'))}
