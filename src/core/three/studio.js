/* The studio, as geometry.

   material.js describes its rig as a lookup table (ENV) of brightness against
   the direction a surface faces: bright toward 12, dark walls at 3 and 9, a
   floor bounce at 6. That table describes a real room, so this builds the room
   and prefilters it into an environment map:

   - a horizon band whose brightness around the ring IS envLevel(). A 45 degree
     chamfer seen from above reflects the horizon, so it gets exactly the light
     the 2D bevels were tuned to — but from its real angle, not a gradient stop.
   - a soft, graded overhead box. Flat top faces reflect straight up into it.
     Its edges fall off smoothly: a hard-edged panel draws a hard line across a
     domed crystal.
   - a dark floor, which is what a vertical flank reflects.

   No HDRI file — two small generated textures — so the single-file build stays
   small. Canvas convention carries over: -z is 12 o'clock, +x is 3. */
import {Scene,Color,Mesh,CylinderGeometry,CircleGeometry,MeshBasicMaterial,BackSide,DoubleSide,
        DataTexture,RGBAFormat,LinearFilter,RepeatWrapping,PMREMGenerator} from 'three';
import {envLevel} from '../render/material.js';

const METAL_ENV={kind:'metal'};
const smooth=(e0,e1,x)=>{const t=Math.min(1,Math.max(0,(x-e0)/(e1-e0)));return t*t*(3-2*t)};

function dataTex(w,h,fn){const a=new Uint8Array(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const v=Math.round(Math.min(1,Math.max(0,fn(x/(w-1),y/(h-1))))*255),i=(y*w+x)*4;
  a[i]=a[i+1]=a[i+2]=v;a[i+3]=255}
 const t=new DataTexture(a,w,h,RGBAFormat);t.magFilter=t.minFilter=LinearFilter;t.wrapS=RepeatWrapping;t.needsUpdate=true;return t}

export function buildStudio(){
 const env=new Scene();env.background=new Color(0x020203);

 /* CylinderGeometry puts u=0 at +z (6 o'clock) and runs through +x (3), so the
    clockwise-from-12 turn fraction ENV is indexed by is (0.5 - u) */
 const band=dataTex(512,64,(u,v)=>envLevel(METAL_ENV,.5-u)*(.25+.75*smooth(0,.5,v)*smooth(1,.5,v)));
 const horizon=new Mesh(new CylinderGeometry(100,100,90,128,1,true),
  new MeshBasicMaterial({map:band,side:BackSide,color:new Color(1,1,1).multiplyScalar(2.2)}));
 horizon.position.y=0;env.add(horizon);       /* spans roughly +-24 degrees of elevation */

 /* overhead softbox: bright core, long smooth falloff, core pulled well toward
    12. Rotated face-up, the texture's v runs toward +z (6 o'clock), so a small
    v is the 12 side. A core straight overhead makes every upward-facing gloss
    surface reflect the same peak and read as flat white; angled, a crown barrel
    or a ceramic case gets a lit shoulder falling away toward 6. */
 const box=dataTex(256,256,(u,v)=>{const dx=(u-.5)/.5,dz=(v-.22)/.55;
  return Math.pow(1-smooth(.15,1,Math.hypot(dx,dz)),1.6)});
 const top=new Mesh(new CircleGeometry(95,96),
  /* bright enough to model polished metal, not so bright that anything glossy
     seen straight down — a white ceramic case, a crown's end — clips to white */
  new MeshBasicMaterial({map:box,side:DoubleSide,color:new Color(1,1,1).multiplyScalar(2.3)}));
 top.rotation.x=Math.PI/2;top.position.y=70;env.add(top);

 /* table: a pale sweep bouncing light back up. A case flank is vertical, so from
    any raised camera it reflects the floor — a dark floor turns steel into a
    brown plastic puck. Brightest near the head, falling off with distance. */
 const sweep=dataTex(256,256,(u,v)=>.35+.65*(1-smooth(.1,1,Math.hypot(u-.5,v-.5)/.5)));
 const floor=new Mesh(new CircleGeometry(160,64),
  new MeshBasicMaterial({map:sweep,color:new Color(1,1,1).multiplyScalar(.62),side:DoubleSide}));
 floor.rotation.x=-Math.PI/2;floor.position.y=-30;env.add(floor);
 return env}

export function studioEnvironment(renderer){
 const pm=new PMREMGenerator(renderer);
 const rt=pm.fromScene(buildStudio(),.01,.1,500);
 pm.dispose();return rt}
