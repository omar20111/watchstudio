/* Outlines -> an anti-aliased coverage field, without a canvas.

   relief.js grinds a solid from a coverage field; outlines are exact, so they
   are scan-converted here rather than drawn on a 2D canvas. That keeps shape
   markers independent of the browser's rasteriser (and testable in node): the
   same style gives the same solid everywhere. Numerals are glyphs, so they are
   the one thing baked on a canvas (glyphs.js), into the same kind of field.

   A field: `alpha` (0..1, row major) of W x H samples at `ppmm` samples per mm.
   Sample (i, j) stands for the point x = (i + ox) / ppmm, y = (j + oy) / ppmm,
   and its value is the covered fraction of the pixel centred there. */
import {boundsOf} from './outline.js';

export const PAD=3;

export function fieldFrame(b,ppmm,pad=PAD){
 const ox=Math.floor(b.x0*ppmm)-pad,oy=Math.floor(b.y0*ppmm)-pad;
 return{ox,oy,W:Math.ceil(b.x1*ppmm)-ox+pad+1,H:Math.ceil(b.y1*ppmm)-oy+pad+1,ppmm}}

/* even-odd fill; SUB scanlines a pixel, exact horizontal coverage on each */
export function rasterize(loops,ppmm,SUB=5){
 const f=fieldFrame(boundsOf(loops),ppmm),{W,H,ox,oy}=f;
 const alpha=new Float32Array(W*H);
 const edges=[];
 for(const l of loops)for(let n=0;n<l.length;n++){const p=l[n],q=l[(n+1)%l.length];
  const ax=p[0]*ppmm-ox,ay=p[1]*ppmm-oy,bx=q[0]*ppmm-ox,by=q[1]*ppmm-oy;
  if(ay!==by)edges.push([ax,ay,bx,by])}
 const xs=[];
 for(let j=0;j<H;j++)for(let s=0;s<SUB;s++){
  const y=j-.5+(s+.5)/SUB;xs.length=0;
  for(const[ax,ay,bx,by]of edges)if((ay<=y)!==(by<=y))xs.push(ax+(y-ay)*(bx-ax)/(by-ay));
  xs.sort((a,b)=>a-b);
  for(let k=0;k+1<xs.length;k+=2){const xa=xs[k],xb=xs[k+1];
   for(let i=Math.max(0,Math.floor(xa+.5));i<=Math.min(W-1,Math.ceil(xb-.5));i++){
    const cov=Math.min(xb,i+.5)-Math.max(xa,i-.5);
    if(cov>0)alpha[j*W+i]+=cov/SUB}}}
 for(let k=0;k<alpha.length;k++)if(alpha[k]>1)alpha[k]=1;
 return{...f,alpha}}

/* samples per mm for a part this size: about 170 across its longest side, so a
   small dot and a long baton are ground to the same visual precision */
export const ppmmFor=(sizeMm,{target=170,lo=34,hi=90}={})=>Math.min(hi,Math.max(lo,target/Math.max(.2,sizeMm)));
