/* LRU caches: full-size part canvases + preset thumbnails. */
import {CAN,STRAP_REACH_3D} from './constants.js';
import {clone,clamp,mk} from './utils.js';
import {frameBox} from './geometry.js';
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
  part==='hands'?d.parts.hands.secColor:0,part==='markers'?d.parts.hands.metal:0,part==='markers'?d.parts.dial.color:0])};

/* Most bakes are the 1200² sheet. A 3D strap runs far past the sheet edge as it
   curves away, so its flat bake is a tall canvas with the sheet centred in it. */
export const bakeSize=(part,mode)=>part==='strap'&&mode==='flat'?{w:CAN,h:2*STRAP_REACH_3D+120}:{w:CAN,h:CAN};

/* A 3D design holds about a dozen flat, shape and lume bakes; each 1200² canvas
   is 5.8 MB of backing store, so this keeps roughly two designs warm. */
const CACHE_MAX=32;
export function getProc(part,d,sub,mode){const key=procKey(part,d,sub,mode);
 if(cache.has(key)){const v=cache.get(key);cache.delete(key);cache.set(key,v);return v}
 const{w,h}=bakeSize(part,mode);
 const cv=document.createElement('canvas');cv.width=w;cv.height=h;const ctx=cv.getContext('2d');
 if(h!==CAN)ctx.translate(0,(h-CAN)/2);          /* the sheet stays centred */
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
