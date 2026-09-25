/* The studio: a watch photographer's set, as light arriving from every direction.

   Polished steel has no colour of its own to speak of; it looks like steel
   because of what it reflects — crisp bright shapes against dark ones. So the
   set is built for the reflections, the way a watch is lit for a catalogue:

   - a dark room, so edges and flanks have something dark to fall away into
   - an overhead softbox pulled toward 12: the case top, the dial and the
     crystal reflect it, soft-edged so a domed crystal carries a gradient.
     Brightest in its middle and falling well off toward its edges, and split
     by a black flag across it a little toward 12: without them a brushed
     bracelet reflects one even sheet of light, and a real one is shaped by
     the darker bands a photographer sets into its reflection
   - two tall strip lights, at 2 and 10 o'clock: the thin bright lines down a
     chamfer, a bezel's edge, a crown's barrel
   - a lit backdrop rising behind the watch toward 12, with a crisp horizon
     line where table meets backdrop
   - white bounce cards stood on the table at 4 and 7:30, dark table between:
     a case's side seen from above reflects the table, so the cards are the
     bright bands down a polished flank and the dark table the band between
   - a dim fill card by the camera toward 6: a polished link or facet turned to
     face the viewer finds a faint grey there instead of the black of the room,
     and shades across its crown rather than reading as a black tile

   One function of direction describes it all. The live views prefilter it into
   an environment map; the path tracer (photo.js) reads the same panorama, so a
   photo is lit by exactly the room the editor is. Directions are in the scene
   frame: x toward 3 o'clock, y up, z toward 6. No image files. */
import {DataTexture,DataUtils,RGBAFormat,FloatType,HalfFloatType,LinearFilter,RepeatWrapping,ClampToEdgeWrapping,
        EquirectangularReflectionMapping,PMREMGenerator} from 'three';
import {PHONE} from './device.js';

const TAU=Math.PI*2,DEG=Math.PI/180;
const smooth=(e0,e1,x)=>{const t=Math.min(1,Math.max(0,(x-e0)/(e1-e0)));return t*t*(3-2*t)};
/* 1 between a and b, feathered over f either side */
const band=(x,a,b,f)=>smooth(a-f,a+f,x)*(1-smooth(b-f,b+f,x));
const wrapPi=a=>{a=(a+Math.PI)%TAU;return(a<0?a+TAU:a)-Math.PI};

export const SET={
 room:.012,
 /* overhead softbox, in the ceiling plane (x/y, z/y): -z is toward 12 */
 /* falloff: how much dimmer its edges are than its middle; gap: the flag, a band
    of the ceiling plane's v, and how much light it takes out */
 softbox:{u:[-1,1],v:[-1.35,.42],feather:.34,L:2.6,falloff:.55,gap:{v:-.25,w:.22,feather:.08,depth:.85}},
 /* tall strips: azimuth clockwise from 12, half-width and elevation span */
 /* wide enough, and soft-edged enough, that blurring them for rougher metal
    keeps them smooth: a thin, very bright strip broke up into blotches there */
 strips:[{az:60,hw:7,el:[-2,68],L:2.2,feather:3.5},{az:300,hw:6,el:[-2,60],L:1.7,feather:3.5}],
 /* the fill card by the camera, in the strips' terms */
 fill:{az:180,hw:45,el:[14,62],L:.12,feather:12},
 /* the backdrop's glow above the horizon, strongest toward 12, and its line */
 backdrop:{L:.9,side:.1,height:26},horizon:{L:.35,width:1.4},
 /* the table, dark, a little lighter toward the horizon; cards stood on it */
 table:{L:.07,nearHorizon:.1},
 cards:[{az:105,hw:30,el:[-74,-6],L:1.0},{az:205,hw:22,el:[-70,-8],L:.8},{az:305,hw:16,el:[-60,-10],L:.45}]};

export function radianceAt(x,y,z,S=SET){
 const el=Math.asin(Math.max(-1,Math.min(1,y))),az=Math.atan2(x,-z),eld=el/DEG;
 let L=S.room;
 if(el<0){const T=S.table;
  L=T.L+T.nearHorizon*(1-smooth(0,14,-eld));
  for(const c of S.cards)L+=c.L*band(Math.abs(wrapPi(az-c.az*DEG))/DEG,-1e9,c.hw,7)*band(eld,c.el[0],c.el[1],5)}
 else{const B=S.backdrop,toward12=(1+Math.cos(az))/2;
  L+=(B.side+(B.L-B.side)*toward12*toward12)*(1-smooth(0,B.height,eld));
  for(const s of[...S.strips,S.fill])L+=s.L*band(Math.abs(wrapPi(az-s.az*DEG))/DEG,-1e9,s.hw,s.feather)*band(eld,s.el[0],s.el[1],s.feather);
  if(y>.25){const b=S.softbox,u=x/y,v=z/y;
   const inside=band(u,b.u[0],b.u[1],b.feather)*band(v,b.v[0],b.v[1],b.feather);
   /* a real softbox is brightest in its middle */
   const cu=(b.u[0]+b.u[1])/2,cv=(b.v[0]+b.v[1])/2,hu=(b.u[1]-b.u[0])/2,hv=(b.v[1]-b.v[0])/2;
   const g=b.gap,flag=1-g.depth*band(v,g.v-g.w/2,g.v+g.w/2,g.feather);
   L+=b.L*inside*flag*((1-b.falloff)+b.falloff*(1-Math.min(1,Math.hypot((u-cu)/hu,(v-cv)/hv))))}}
 /* the line where table meets backdrop, all the way round */
 L+=S.horizon.L*band(eld,-S.horizon.width/2,S.horizon.width/2,.5);
 return L}

/* The set as an equirectangular panorama in three's layout (u from atan2(z, x),
   v up), linear radiance: full float for the path tracer, half float for the
   live prefilter (half float filters linearly on every WebGL 2 device). */
export function studioEquirect(w=1024,h=512,{half=false}={}){
 const data=half?new Uint16Array(w*h*4):new Float32Array(w*h*4),one=half?DataUtils.toHalfFloat(1):1;
 for(let j=0;j<h;j++){const lat=((j+.5)/h-.5)*Math.PI,dy=Math.sin(lat),cl=Math.cos(lat);
  for(let i=0;i<w;i++){const lon=((i+.5)/w-.5)*TAU,dx=Math.cos(lon)*cl,dz=Math.sin(lon)*cl;
   const v=radianceAt(dx,dy,dz),o=(j*w+i)*4,c=half?DataUtils.toHalfFloat(v):v;
   data[o]=data[o+1]=data[o+2]=c;data[o+3]=one}}
 const t=new DataTexture(data,w,h,RGBAFormat,half?HalfFloatType:FloatType);
 t.mapping=EquirectangularReflectionMapping;t.wrapS=RepeatWrapping;t.wrapT=ClampToEdgeWrapping;
 t.magFilter=t.minFilter=LinearFilter;t.needsUpdate=true;return t}

/* on a phone at half the size: a fifth of the time to draw, and the prefilter
   softens it for all but a mirror polish anyway */
export function studioEnvironment(renderer){
 const pm=new PMREMGenerator(renderer),eq=PHONE?studioEquirect(512,256,{half:true}):studioEquirect(1024,512,{half:true});
 const rt=pm.fromEquirectangular(eq);
 eq.dispose();pm.dispose();return rt}
