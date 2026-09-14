/* LRU caches: full-size part canvases + preset thumbnails. */
import {C,CAN,STRAP_REACH_3D} from './constants.js';
import {clone,clamp,mk} from './utils.js';
import {frameBox,dialDayOf,strapReachPx} from './geometry.js';
import {srcOf,applyVariant} from './parts.js';
import {DR,procOpts} from './render/index.js';

/* Every part's geometry derives from the mm dimensions, so all of them belong
   in the key — a dimension that moves the drawing but not the key renders
   stale the moment its slider moves. Case architecture is nested now, and
   assertions.js walks each field to prove none was forgotten. */
const dimsKey=d=>{const c=d.case||{};
 return[d.caseMm,d.strapMm,d.bezelMm,d.crownMm,
  c.thicknessMm,c.lugLenMm,c.lugDropMm,c.crystalMm,c.crystal,c.caseback,c.movement,c.crownPos,c.pushers,
  /* geoOf widens the bezel for rotating types, which moves rBezIn — so every
     part that meets the bezel keys on the variant, not just the bezel does */
  d.parts.bezel.variant].join('|')};

const cache=new Map();
/* everything procOpts feeds a renderer, so the key moves whenever the bake would */
const procKey=(part,d,sub,mode)=>{const p=d.parts[srcOf(part)];
 return JSON.stringify([part,sub,mode||'',dimsKey(d),p.variant,p.metal,p.finish,p.color,p.stitch,p.lume,p.insertColor,part==='bezel'?d.parts.markers.lume:0,part==='dial'?p.text:0,
  part==='hands'?d.parts.hands.secColor:0,part==='markers'?d.parts.hands.metal:0,part==='markers'?d.parts.dial.color:0,
  /* the caseback prints the engraving and the water resistance, which no other bake reads */
  part==='caseback'?[(d.case||{}).engraving,(d.case||{}).wrM]:0,
  /* the dial draws its date window, registers and chapter step; a painted dial
     also prints today's date in the window. Markers leave out the index a date
     window replaces, which depends on the dial's variant too. */
  part==='dial'?[p.date,p.step,mode==='flat'?0:dialDayOf(d)]:0,
  part==='markers'?[d.parts.dial.date,d.parts.dial.variant,d.parts.dial.step]:0,
  /* an hour hand is as long as the markers it reaches are deep */
  part==='hands'?d.parts.markers.variant:0,
  /* a 3D strap is cut to its length from the spring bar, which a sport case's
     broader lugs move */
  part==='strap'&&mode==='flat'?d.parts.case.variant:0,
  /* the cyclops sits over the date window, wherever the dial puts one */
  part==='crystal'?[p.cyclops,d.parts.dial.date,d.parts.dial.variant,d.parts.dial.step]:0])};

/* Most bakes are the 1200² sheet. A 3D strap runs far past the sheet edge as it
   curves away, so its flat bake is a tall canvas reaching from just past the
   sheet's centre to the strap's end; `ty` moves sheet coordinates into it. Each
   piece has its own, so the long piece stays within a phone GPU's 4096 px. */
export const STRAP_BAKE_MARGIN=60;
export function bakeSize(part,mode,d,sub){
 if(!(part==='strap'&&mode==='flat'))return{w:CAN,h:CAN,ty:0};
 const reach=d&&sub?strapReachPx(d,sub):STRAP_REACH_3D,h=Math.ceil(reach)+2*STRAP_BAKE_MARGIN;
 return{w:CAN,h,ty:sub==='top'?h-STRAP_BAKE_MARGIN-C:STRAP_BAKE_MARGIN-C}}

/* A 3D design holds about a dozen flat, shape and lume bakes; each 1200² canvas
   is 5.8 MB of backing store, so this keeps roughly two designs warm. */
const CACHE_MAX=32;
export function getProc(part,d,sub,mode){const key=procKey(part,d,sub,mode);
 if(cache.has(key)){const v=cache.get(key);cache.delete(key);cache.set(key,v);return v}
 const{w,h,ty}=bakeSize(part,mode,d,sub);
 /* shape and lume bakes exist to be read back (relief.js): keep their pixels in
    CPU memory, or every readback waits on a copy back from the GPU */
 const cv=document.createElement('canvas');cv.width=w;cv.height=h;
 const ctx=cv.getContext('2d',mode==='shape'||mode==='lume'?{willReadFrequently:true}:undefined);
 if(ty)ctx.translate(0,ty);
 DR[part](ctx,procOpts(part,d,sub,mode));
 cache.set(key,cv);if(cache.size>CACHE_MAX)cache.delete(cache.keys().next().value);return cv}

/* A preset thumbnail is the design with that preset applied, baked through the
   same procOpts as the stage. It used to build its own option object, which
   lacked pushers and the crown bearing — so case thumbnails never showed chrono
   pushers the stage was drawing. */
const THUMB_SUB={strap:'bottom',hands:'hour'};
const tcache=new Map();
export function getThumb(part,variant,d){const dv=clone(d);applyVariant(dv,part,variant);
 const sub=THUMB_SUB[part];
 const key=procKey(part,dv,sub);
 if(tcache.has(key))return tcache.get(key);
 const[cv,ctx]=mk(CAN);DR[part](ctx,procOpts(part,dv,sub));const b=frameBox(part,dv);
 const t=document.createElement('canvas');t.width=t.height=120;const tx=t.getContext('2d');
 tx.drawImage(cv,clamp(b[0],0,CAN),clamp(b[1],0,CAN),clamp(b[2],1,CAN),clamp(b[3],1,CAN),0,0,120,120);
 const url=t.toDataURL();tcache.set(key,url);if(tcache.size>90)tcache.delete(tcache.keys().next().value);return url}

/* exposed so assertions.js can prove every dimension is covered */
export const __dimsKeyForTest=dimsKey;
