/* Procedural textures: grain, leather backdrop, finish overlays.

   Every generator here feeds a CACHED bake, so none may draw on an entropy
   source: re-baking a part after a cache eviction has to produce
   pixel-identical output, or LayerView cross-fades the layer against a
   shimmering copy of itself. hash01(i) is the deterministic substitute, and
   CI greps this directory to keep it that way. */
import {hash01} from './utils.js';

export const NOISE=(()=>{const c=document.createElement('canvas');c.width=c.height=160;const x=c.getContext('2d');const d=x.createImageData(160,160);for(let i=0;i<d.data.length;i+=4){const v=110+hash01(i)*90|0;d.data[i]=v;d.data[i+1]=v;d.data[i+2]=v;d.data[i+3]=255}x.putImageData(d,0,0);return c})();

/* Run fn, then re-mask so nothing leaks outside the already-painted pixels.
   Scratch canvases are pooled by nesting depth, and `box` narrows the copy to
   the part's own bounds — a crown masking the whole 1200² canvas was the single
   biggest cost in a re-render. Pixels outside the box are left untouched. */
const scratch=[];let depth=0;
const cl=(v,a,b)=>Math.min(b,Math.max(a,v));
export function keepAlpha(ctx,fn,box){const W=ctx.canvas.width,H=ctx.canvas.height;
 /* box arrives in user space; png.js renders under ctx.scale(mult), so map it
    to device pixels and put it back with the transform reset */
 /* Map all four corners through the FULL matrix, not just the scale: a caller
    that rotates the context (the crown swings to its bearing) otherwise gets a
    box mapped as if it were axis-aligned, which collapsed to zero width and
    threw InvalidStateError out of drawImage. */
 const m=ctx.getTransform&&ctx.getTransform();
 let x=0,y=0,w=W,h=H;
 if(box){
  const a=m?m.a:1,b=m?m.b:0,c2=m?m.c:0,dd=m?m.d:1,e=m?m.e:0,f=m?m.f:0;
  const px=(u,v)=>[a*u+c2*v+e,b*u+dd*v+f];
  const[x0,y0]=px(box[0],box[1]),[x1,y1]=px(box[0]+box[2],box[1]),
        [x2,y2]=px(box[0],box[1]+box[3]),[x3,y3]=px(box[0]+box[2],box[1]+box[3]);
  const lo=(p,q,r,t)=>Math.min(p,q,r,t),hi=(p,q,r,t)=>Math.max(p,q,r,t);
  const bx=Math.floor(lo(x0,x1,x2,x3)),by=Math.floor(lo(y0,y1,y2,y3));
  const bw=Math.ceil(hi(x0,x1,x2,x3))-bx,bh=Math.ceil(hi(y0,y1,y2,y3))-by;
  x=cl(bx,0,W);y=cl(by,0,H);
  /* the clamp bounds themselves must stay ordered, or Math.min/max invert and
     hand back a zero-size scratch canvas */
  w=cl(bw,1,Math.max(1,W-x));h=cl(bh,1,Math.max(1,H-y));
  if(w<1||h<1)return fn()}
 let t=scratch[depth];if(!t){t=document.createElement('canvas');scratch[depth]=t}
 const tx=t.getContext('2d');
 if(t.width!==w||t.height!==h){t.width=w;t.height=h}else tx.clearRect(0,0,w,h);
 tx.drawImage(ctx.canvas,x,y,w,h,0,0,w,h);
 depth++;try{fn()}finally{depth--}
 ctx.save();if(ctx.setTransform)ctx.setTransform(1,0,0,1,0,0);
 ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
 ctx.globalCompositeOperation='destination-in';ctx.drawImage(t,x,y);ctx.restore()}

/* grain stays the same physical size no matter what scale png.js exports at */
function fixedPattern(ctx,img,scale){const p=ctx.createPattern(img,'repeat');
 if(p&&p.setTransform&&typeof DOMMatrix!=='undefined'){const t=ctx.getTransform&&ctx.getTransform();
  const k=t&&t.a?Math.hypot(t.a,t.b)||1:1;const s=scale/k;p.setTransform(new DOMMatrix([s,0,0,s,0,0]))}
 return p}

/* unmasked — callers that already hold a keepAlpha/clip use this directly */
export function noiseFill(ctx,a=0.06,mode='overlay',scale=1){ctx.save();ctx.globalAlpha=a;ctx.globalCompositeOperation=mode;ctx.fillStyle=fixedPattern(ctx,NOISE,scale);ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);ctx.restore()}

/* procedural leather mat backdrop (512² tile) */
export const LEATHER=(()=>{const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');
 x.fillStyle='#4a3220';x.fillRect(0,0,512,512);
 let k=0;const rnd=()=>hash01(k++);
 for(let i=0;i<60;i++){x.strokeStyle=`rgba(20,10,4,${0.05+rnd()*0.1})`;x.lineWidth=1+rnd()*3;x.beginPath();let px=rnd()*512,py=rnd()*512;x.moveTo(px,py);for(let j=0;j<6;j++){px+=(rnd()-0.5)*120;py+=(rnd()-0.5)*120;x.quadraticCurveTo(px+(rnd()-0.5)*40,py+(rnd()-0.5)*40,px,py)}x.stroke()}
 x.globalAlpha=.18;x.drawImage(NOISE,0,0,512,512);x.globalAlpha=1;
 const g=x.createRadialGradient(256,200,60,256,256,420);g.addColorStop(0,'rgba(255,230,190,.12)');g.addColorStop(1,'rgba(0,0,0,.4)');x.fillStyle=g;x.fillRect(0,0,512,512);return c})();

/* finish textures applied to uploaded images (soft-light overlay, masked) */
const TEXC={};
export function tex(kind){if(TEXC[kind])return TEXC[kind];const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
 if(kind==='brushed'){x.fillStyle='#808080';x.fillRect(0,0,256,256);for(let i=0;i<700;i++){const y=hash01(i*2)*256,v=128+(hash01(i*2+1)*100-50)|0;x.strokeStyle=`rgba(${v},${v},${v},.5)`;x.beginPath();x.moveTo(0,y);x.lineTo(256,y);x.stroke()}}
 if(kind==='matte'){x.drawImage(NOISE,0,0,256,256)}
 if(kind==='polished'){const g=x.createLinearGradient(0,0,256,256);g.addColorStop(0,'#404040');g.addColorStop(.45,'#c0c0c0');g.addColorStop(.55,'#ffffff');g.addColorStop(.65,'#c0c0c0');g.addColorStop(1,'#404040');x.fillStyle=g;x.fillRect(0,0,256,256)}
 const u=c.toDataURL();TEXC[kind]=u;return u}
