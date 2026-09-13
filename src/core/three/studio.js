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
        DataTexture,RGBAFormat,FloatType,LinearFilter,RepeatWrapping,ClampToEdgeWrapping,EquirectangularReflectionMapping,PMREMGenerator} from 'three';
import {envLevel} from '../render/material.js';

const METAL_ENV={kind:'metal'};
const smooth=(e0,e1,x)=>{const t=Math.min(1,Math.max(0,(x-e0)/(e1-e0)));return t*t*(3-2*t)};

/* The room, as data: each surface's size and place, its brightness pattern in
   its own texture coordinates, and its gain. buildStudio makes meshes of it for
   the live views' prefiltered environment; studioEquirect casts rays into the
   same shapes for the path tracer, which needs a panorama. One description, so
   the photo is lit by exactly the room the editor is. */
const STUDIO={
 background:0x020203,
 /* CylinderGeometry puts u=0 at +z (6 o'clock) and runs through +x (3), so the
    clockwise-from-12 turn fraction ENV is indexed by is (0.5 - u) */
 horizon:{radius:100,height:90,gain:2.2,         /* spans roughly +-24 degrees of elevation */
  fn:(u,v)=>envLevel(METAL_ENV,.5-u)*(.25+.75*smooth(0,.5,v)*smooth(1,.5,v))},
 /* overhead softbox: bright core, long smooth falloff, core pulled well toward
    12. Rotated face-up, the texture's v runs toward +z (6 o'clock), so a small
    v is the 12 side. A core straight overhead makes every upward-facing gloss
    surface reflect the same peak and read as flat white; angled, a crown barrel
    or a ceramic case gets a lit shoulder falling away toward 6. Bright enough to
    model polished metal, not so bright that anything glossy seen straight down
    — a white ceramic case, a crown's end — clips to white. */
 top:{y:70,radius:95,gain:2.3,
  fn:(u,v)=>{const dx=(u-.5)/.5,dz=(v-.22)/.55;return Math.pow(1-smooth(.15,1,Math.hypot(dx,dz)),1.6)}},
 /* table: a pale sweep bouncing light back up. A case flank is vertical, so from
    any raised camera it reflects the floor — a dark floor turns steel into a
    brown plastic puck. Brightest near the head, falling off with distance. */
 floor:{y:-30,radius:160,gain:.62,
  fn:(u,v)=>.35+.65*(1-smooth(.1,1,Math.hypot(u-.5,v-.5)/.5))}};

function dataTex(w,h,fn){const a=new Uint8Array(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const v=Math.round(Math.min(1,Math.max(0,fn(x/(w-1),y/(h-1))))*255),i=(y*w+x)*4;
  a[i]=a[i+1]=a[i+2]=v;a[i+3]=255}
 const t=new DataTexture(a,w,h,RGBAFormat);t.magFilter=t.minFilter=LinearFilter;t.wrapS=RepeatWrapping;t.needsUpdate=true;return t}

export function buildStudio(){const S=STUDIO;
 const env=new Scene();env.background=new Color(S.background);
 const horizon=new Mesh(new CylinderGeometry(S.horizon.radius,S.horizon.radius,S.horizon.height,128,1,true),
  new MeshBasicMaterial({map:dataTex(512,64,S.horizon.fn),side:BackSide,color:new Color(1,1,1).multiplyScalar(S.horizon.gain)}));
 env.add(horizon);
 const top=new Mesh(new CircleGeometry(S.top.radius,96),
  new MeshBasicMaterial({map:dataTex(256,256,S.top.fn),side:DoubleSide,color:new Color(1,1,1).multiplyScalar(S.top.gain)}));
 top.rotation.x=Math.PI/2;top.position.y=S.top.y;env.add(top);
 const floor=new Mesh(new CircleGeometry(S.floor.radius,64),
  new MeshBasicMaterial({map:dataTex(256,256,S.floor.fn),color:new Color(1,1,1).multiplyScalar(S.floor.gain),side:DoubleSide}));
 floor.rotation.x=-Math.PI/2;floor.position.y=S.floor.y;env.add(floor);
 return env}

/* The same room as an equirectangular panorama, seen from its centre: for each
   direction, the nearest of the three surfaces and its brightness there. Linear
   float radiance, in three's equirect layout (u from atan2(z, x), v from up). */
export function studioEquirect(w=1024,h=512){const S=STUDIO,H=S.horizon,T=S.top,F=S.floor;
 const bg=new Color(S.background),data=new Float32Array(w*h*4);
 for(let j=0;j<h;j++){const lat=((j+.5)/h-.5)*Math.PI,dy=Math.sin(lat),cl=Math.cos(lat);
  for(let i=0;i<w;i++){const lon=((i+.5)/w-.5)*Math.PI*2,dx=Math.cos(lon)*cl,dz=Math.sin(lon)*cl;
   let best=Infinity,val=-1;
   /* the band: a cylinder around y */
   if(cl>1e-6){const t=H.radius/cl,y=dy*t;
    if(Math.abs(y)<=H.height/2&&t<best){best=t;
     const u=((Math.atan2(dx,dz)/(Math.PI*2))%1+1)%1;val=H.gain*H.fn(u,(y+H.height/2)/H.height)}}
   /* the softbox overhead and the table below, discs facing the centre */
   for(const[disc,flip]of[[T,1],[F,-1]]){if(dy*disc.y<=0)continue;const t=disc.y/dy;if(t>=best)continue;
    const x=dx*t,z=dz*t;if(Math.hypot(x,z)>disc.radius)continue;best=t;
    val=disc.gain*disc.fn((x/disc.radius+1)/2,(flip*z/disc.radius+1)/2)}
   const o=(j*w+i)*4;
   if(val<0){data[o]=bg.r;data[o+1]=bg.g;data[o+2]=bg.b}else data[o]=data[o+1]=data[o+2]=val;
   data[o+3]=1}}
 const t=new DataTexture(data,w,h,RGBAFormat,FloatType);
 t.mapping=EquirectangularReflectionMapping;t.wrapS=RepeatWrapping;t.wrapT=ClampToEdgeWrapping;
 t.magFilter=t.minFilter=LinearFilter;t.needsUpdate=true;return t}

export function studioEnvironment(renderer){
 const pm=new PMREMGenerator(renderer);
 const rt=pm.fromScene(buildStudio(),.01,.1,500);
 pm.dispose();return rt}
