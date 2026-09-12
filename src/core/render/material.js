/* Material engine — the shading model every part renderer shares.
   Reflections are built from gradients rather than raster tiles so they stay
   sharp when png.js re-renders the whole scene at 2x/4x. */
import {C,CAN} from '../constants.js';
import {clamp,mixc} from '../utils.js';
import {keepAlpha,noiseFill} from '../textures.js';

/* deterministic jitter — a part re-rendered after cache eviction must come back
   pixel-identical, or LayerView cross-fades it against a shimmering twin */
const JIT=Array.from({length:1024},(_,i)=>{const v=Math.sin((i+1)*12.9898)*43758.5453;return v-Math.floor(v)});
const jit=i=>JIT[(i%1024+1024)%1024];

/* Reflected light level around the part, 0 = 12 o'clock going clockwise.
   Softbox overhead, dark studio walls at 3 and 9, floor bounce at 6. */
const ENV={
 /* the dark bands have to go genuinely dark — a polished surface that never
    drops below mid-grey reads as painted metal, however bright its highlights */
 metal:[[0,1],[.04,.97],[.10,.68],[.16,.34],[.22,.11],[.28,.03],[.34,.10],[.40,.38],[.46,.64],[.50,.72],[.54,.64],[.60,.38],[.66,.14],[.72,.03],[.78,.11],[.84,.34],[.90,.68],[.96,.97],[1,1]],
 ceramic:[[0,1],[.03,.94],[.08,.62],[.16,.47],[.28,.42],[.42,.46],[.50,.52],[.58,.46],[.72,.42],[.84,.47],[.92,.62],[.97,.94],[1,1]],
 carbon:[[0,.84],[.08,.58],[.20,.40],[.30,.33],[.45,.41],[.50,.47],[.55,.41],[.70,.33],[.80,.40],[.92,.58],[1,.84]]};

/* light level -> body colour, four stops so the dark bands reach a true shadow */
const ramp=(m,l)=>l<.28?mixc(m.dk||m.lo,m.lo,l/.28)
 :l<.55?mixc(m.lo,m.base,(l-.28)/.27)
 :mixc(m.base,m.hi,(l-.55)/.45);

/* roughness flattens the bands toward mid-tone, reflectivity scales their spread */
export const tone=(m,l)=>ramp(m,clamp(.5+(l-.5)*(1-(m.rough??.15)*.7)*(m.refl??1),0,1));

/* the environment's light level at a turn fraction — lets faceted parts
   (flutes, bracelet links) each catch the studio at their own angle */
export function envLevel(m,t){const tab=ENV[m.kind]||ENV.metal,u=((t%1)+1)%1;
 for(let i=1;i<tab.length;i++)if(u<=tab[i][0]){const[o0,l0]=tab[i-1],[o1,l1]=tab[i];
  return l0+(l1-l0)*((u-o0)/(o1-o0||1))}
 return tab[tab.length-1][1]}

/* conic studio reflection — the body fill for round parts */
export function envGrad(ctx,m,ph=0,cx=C,cy=C){
 if(!ctx.createConicGradient)return axisGrad(ctx,m,cx-CAN*.4,cy-CAN*.4,cx+CAN*.4,cy+CAN*.4);
 const g=ctx.createConicGradient(-Math.PI/2+ph,cx,cy);
 for(const[o,l]of(ENV[m.kind]||ENV.metal))g.addColorStop(o,tone(m,l));
 return g}

/* asymmetric cylinder ramp for lugs, hands, bracelet links and the crown barrel */
const AXIS=[[0,.26],[.10,.50],[.22,.84],[.30,.97],[.40,.68],[.52,.40],[.64,.25],[.74,.34],[.86,.62],[.95,.82],[1,.52]];
export function axisGrad(ctx,m,x0,y0,x1,y1){const g=ctx.createLinearGradient(x0,y0,x1,y1);
 for(const[o,l]of AXIS)g.addColorStop(o,tone(m,l));return g}

/* anisotropic graining: hundreds of gradient stops, so it survives export scaling */
export function circGrain(ctx,r0,r1,amt=1,cx=C,cy=C){
 const a=Math.max(0,r0),b=Math.max(a+1,r1);
 const g=ctx.createRadialGradient(cx,cy,a,cx,cy,b);
 const n=clamp(Math.round((b-a)/2.4),24,300);
 for(let i=0;i<=n;i++){const al=((.04+jit(i*7+1)*.10)*amt).toFixed(3);
  g.addColorStop(i/n,jit(i*7)>.5?`rgba(255,255,255,${al})`:`rgba(0,0,0,${al})`)}
 return g}

export function lineGrain(ctx,x0,y0,x1,y1,amt=1,n){const g=ctx.createLinearGradient(x0,y0,x1,y1);
 const N=n||clamp(Math.round(Math.hypot(x1-x0,y1-y0)/2.4),16,300);
 for(let i=0;i<=N;i++){const al=((.05+jit(i*13+3)*.11)*amt).toFixed(3);
  g.addColorStop(i/N,jit(i*13)>.5?`rgba(255,255,255,${al})`:`rgba(0,0,0,${al})`)}
 return g}

/* ---- unmasked passes: callers already hold a keepAlpha or a clip ---- */

/* cx/cy matter: a crown or a lug sits far off the canvas centre, and bands
   anchored at C simply miss it */
const specPass=(ctx,m,a=1,cx=C,cy=C)=>{ctx.save();ctx.translate(cx,cy);ctx.rotate(-.62);
 const k=(1-(m.rough??.15))*a;
 const band=(y,h,al)=>{const g=ctx.createLinearGradient(0,y-h,0,y+h);
  g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.5,`rgba(255,255,255,${al})`);g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=g;ctx.fillRect(-CAN,y-h,CAN*2,h*2)};
 band(-CAN*.13,CAN*.10,.15*k);band(CAN*.08,CAN*.038,.30*k);
 ctx.restore()};

/* Polished ANNULAR surfaces reflect the rig as tight lobes at the light angles,
   not as a soft band swept across the sheet. Broad linear bands are right for a
   hand or a crown barrel and wrong for a bezel — they just wash the ring out. */
const specRing=(ctx,m,o)=>{
 if(!ctx.createConicGradient)return specPass(ctx,m,o.amt,o.cx,o.cy);
 const sharp=1-(m.rough??.15),n=72;
 const lobe=(a,dir,p)=>Math.pow(Math.max(0,.5+.5*Math.cos(a-dir)),p);
 const g=ctx.createConicGradient(0,o.cx,o.cy);
 for(let i=0;i<=n;i++){const a=i/n*Math.PI*2;
  const v=(lobe(a,LIGHT.key,7)*.52+lobe(a,LIGHT.fill,11)*.28+lobe(a,LIGHT.rim,16)*.18)*sharp*o.amt;
  g.addColorStop(i/n,`rgba(255,255,255,${v.toFixed(3)})`)}
 ctx.save();ctx.fillStyle=g;ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);
 const d=ctx.createConicGradient(0,o.cx,o.cy);
 for(let i=0;i<=n;i++){const a=i/n*Math.PI*2;
  d.addColorStop(i/n,`rgba(0,0,0,${(lobe(a,LIGHT.key+Math.PI,3)*.26*sharp*o.amt).toFixed(3)})`)}
 ctx.fillStyle=d;ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);ctx.restore()};

const grainPass=(ctx,o)=>{ctx.save();ctx.globalCompositeOperation='overlay';
 ctx.fillStyle=o.mode==='linear'
  ?lineGrain(ctx,o.x0,o.y0,o.x1,o.y1,o.amt)
  :circGrain(ctx,o.r0,o.r1,o.amt,o.cx,o.cy);
 ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);ctx.restore()};

/* bead-blasted: collapse the reflection toward body colour, then bite with grain */
const mattePass=(ctx,m)=>{ctx.save();ctx.globalAlpha=.32;ctx.fillStyle=m.base;
 ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);ctx.restore()};

const flakePass=(ctx,r,cx,cy)=>{ctx.save();
 for(let i=0;i<520;i++){const a=jit(i*3)*Math.PI*2,rr=Math.sqrt(jit(i*3+1))*r;
  const t=jit(i*11),w=14+jit(i*3+2)*40,h=5+jit(i*5)*13;
  ctx.save();ctx.translate(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr);ctx.rotate(jit(i*7)*Math.PI);
  ctx.fillStyle=t>.82?`rgba(196,202,210,${(.10+jit(i*13)*.17).toFixed(3)})`
   :t>.5?`rgba(118,125,134,${(.06+jit(i*17)*.10).toFixed(3)})`
   :`rgba(8,9,11,${(.10+jit(i*19)*.20).toFixed(3)})`;
  ctx.fillRect(-w/2,-h/2,w,h);ctx.restore()}
 ctx.restore()};

const glossPass=(ctx,r,cx,cy)=>{const g=ctx.createRadialGradient(cx-r*.42,cy-r*.5,0,cx-r*.42,cy-r*.5,r*1.2);
 g.addColorStop(0,'rgba(255,255,255,.46)');g.addColorStop(.26,'rgba(255,255,255,.13)');g.addColorStop(1,'rgba(255,255,255,0)');
 ctx.save();ctx.fillStyle=g;ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);ctx.restore()};

/* Every surface pass for one part, under a single alpha mask — masking is the
   expensive step, so finish, material character and grain all share one. */
export function applyFinish(ctx,m,finish,o={}){
 const p={mode:'radial',r0:0,r1:CAN*.45,cx:C,cy:C,amt:1,grain:1,...o};
 if(p.mode==='linear'){if(p.x0==null)p.x0=p.cx-p.r1;if(p.y0==null)p.y0=p.cy;if(p.x1==null)p.x1=p.cx+p.r1;if(p.y1==null)p.y1=p.cy}
 /* everything here is confined to the part's own bounds: the mask copies only
    that region and the clip keeps each full-canvas fill from rasterising the
    other 90% of the sheet */
 const pad=8,box=p.box||[p.cx-p.r1-pad,p.cy-p.r1-pad,(p.r1+pad)*2,(p.r1+pad)*2];
 keepAlpha(ctx,()=>{
  ctx.save();
  /* clipRing confines the passes to an annulus — a bezel's finish belongs on its
     metal, not on the printed insert sitting inside the same bounding box */
  if(p.clipRing)ringPath(ctx,p.cx,p.cy,p.clipRing[0],p.clipRing[1]);
  else{ctx.beginPath();ctx.rect(box[0],box[1],box[2],box[3])}
  ctx.clip();
  if(m.kind==='carbon')flakePass(ctx,p.r1,p.cx,p.cy);
  if(finish==='brushed')grainPass(ctx,p);
  else if(finish==='polished'){if(p.mode==='linear')specPass(ctx,m,p.amt,p.cx,p.cy);else specRing(ctx,m,p)}
  else if(finish==='matte')mattePass(ctx,m);
  if(m.kind==='ceramic'&&finish!=='matte')glossPass(ctx,p.r1,p.cx,p.cy);
  noiseFill(ctx,finish==='matte'?.11:m.kind==='carbon'?.05:.035,'overlay',p.grain);
  ctx.restore()},box)}

/* ---------------------------------------------------------------------------
   Studio rig. One key light that every component is lit by — chamfers on the
   case, bezel, rehaut and hands all peak at the same angle, which is what makes
   separately-drawn parts read as one manufactured object.
   Angles are canvas radians: 0 = 3 o'clock, increasing clockwise.
--------------------------------------------------------------------------- */
export const LIGHT={key:-2.30,fill:0.86,rim:1.75};
/* shadows fall away from the key light */
export const SHADOW={dx:Math.cos(LIGHT.key+Math.PI),dy:Math.sin(LIGHT.key+Math.PI)};

export const ringPath=(ctx,cx,cy,rOut,rIn)=>{ctx.beginPath();
 ctx.arc(cx,cy,rOut,0,Math.PI*2);ctx.arc(cx,cy,Math.max(0,rIn),0,Math.PI*2,true);ctx.closePath()};

/* An annular chamfer is a cone frustum: its brightness around the ring follows
   the angle between the surface normal and each light. facing:'in' flips the
   peak — an inward-sloping flange (a rehaut) lights up on the side AWAY from
   the key, which is exactly how a real rehaut reads. */
export function bevelGrad(ctx,m,cx,cy,o={}){
 const{facing='out',lo=.08,hi=.99,tight=1.5,bias=0,n=48}=o;
 if(!ctx.createConicGradient)return axisGrad(ctx,m,cx-CAN*.2,cy-CAN*.2,cx+CAN*.2,cy+CAN*.2);
 const flip=facing==='in'?Math.PI:0;
 const g=ctx.createConicGradient(0,cx,cy);
 for(let i=0;i<=n;i++){const a=i/n*Math.PI*2;
  const lobe=(dir,p)=>Math.pow(Math.max(0,.5+.5*Math.cos(a-(dir+flip))),p);
  const lev=lo+(hi-lo)*clamp(lobe(LIGHT.key,tight)*.74+lobe(LIGHT.fill,2)*.26+lobe(LIGHT.rim,4)*.17,0,1)+bias;
  g.addColorStop(i/n,tone(m,clamp(lev,0,1)))}
 return g}

/* Brightness of a flat face whose outward normal points along `nrm` (radians).
   Lets small faceted parts — index bevels, hand flanks — be lit by the same rig
   as the big annular surfaces, so an applied marker at 4 o'clock catches the
   light differently from one at 10. */
export const litFace=nrm=>{const l=(a,p)=>Math.pow(Math.max(0,.5+.5*Math.cos(nrm-a)),p);
 return clamp(l(LIGHT.key,1.6)*.78+l(LIGHT.fill,2)*.26+l(LIGHT.rim,3)*.12,0,1)};

/* A machined joint between two components: a dark groove with the lit edge of
   the upper part just inside it. Parts that merely abut look printed. */
export function seam(ctx,cx,cy,r,o={}){const{dark=.5,lite=.26,w=2.2,side=1}=o;
 ctx.save();
 ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.strokeStyle=`rgba(0,0,0,${dark})`;ctx.lineWidth=w;ctx.stroke();
 ctx.beginPath();ctx.arc(cx,cy,r+side*w*0.8,0,Math.PI*2);
 ctx.strokeStyle=`rgba(255,255,255,${lite})`;ctx.lineWidth=w*0.55;ctx.stroke();
 ctx.restore()}

/* Fine curved scratches following the turning direction. Real polished steel is
   never optically perfect and this is most of why it stops looking like plastic. */
export function microScratch(ctx,cx,cy,r0,r1,count=110,amt=1){
 ctx.save();ctx.lineCap='round';
 for(let i=0;i<count;i++){
  const rr=r0+jit(i*5)*(r1-r0),a0=jit(i*5+1)*Math.PI*2,len=.015+jit(i*5+2)*.10;
  const al=((.07+jit(i*5+4)*.09)*amt).toFixed(3);
  ctx.beginPath();ctx.arc(cx,cy,rr,a0,a0+len);
  ctx.strokeStyle=jit(i*5+3)>.5?`rgba(0,0,0,${al})`:`rgba(255,255,255,${al})`;
  ctx.lineWidth=.5+jit(i*7)*.8;ctx.stroke()}
 ctx.restore()}

/* Shadow a component casts onto whatever sits beneath it. drawPath() must build
   the path only — this fills it, offset along the key light. */
export function castShadow(ctx,drawPath,o={}){const{dist=6,alpha=.36,blur=0,spread=1}=o;
 ctx.save();
 if(blur&&('filter'in ctx))ctx.filter=`blur(${blur}px)`;
 ctx.translate(SHADOW.dx*dist,SHADOW.dy*dist);
 if(spread!==1){ctx.translate(C,C);ctx.scale(spread,spread);ctx.translate(-C,-C)}
 ctx.fillStyle=`rgba(0,0,0,${alpha})`;drawPath();ctx.fill();
 ctx.restore()}

/* grazing-angle rim: bright right at the edge, shaded just inside it, which is
   what reads as a polished chamfer */
export function fresnelRim(ctx,cx,cy,r,m,w=.055){
 const g=ctx.createRadialGradient(cx,cy,r*(1-w*3),cx,cy,r);
 g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(.42,'rgba(0,0,0,.20)');
 g.addColorStop(.88,`rgba(255,255,255,${(.16+(m.refl??1)*.18).toFixed(3)})`);
 g.addColorStop(1,'rgba(255,255,255,.05)');
 ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();ctx.restore()}
