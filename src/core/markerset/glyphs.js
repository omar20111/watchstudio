/* Numerals: glyphs baked into coverage fields.

   A numeral has no outline we can write down — it is whatever the font draws —
   so it is drawn once on a canvas and read back as a coverage field, in the same
   frame raster.js produces for outlines, and relief.js grinds it like any index.
   The faces are bundled (fonts.js) and loaded before anything reaches here.

   Size: `sizeMm` is the height of the TALLEST numeral in the set, measured on the
   ink, so 12 and 1 (or ١٢ and ٠) share one font size and a style reads as one
   set. Each glyph's field is centred on its own ink. */
import {fontStackOf,numeralText} from './model.js';
import {fieldFrame} from './raster.js';

const REF=100;
/* a document canvas where there is a document: it draws with the faces
   fonts.js added to document.fonts, which a worker's canvas may not see */
const newCanvas=(w,h)=>{if(typeof document!=='undefined'){const c=document.createElement('canvas');c.width=w;c.height=h;return c}
 return new OffscreenCanvas(w,h)};
let probe=null;
const probeCtx=()=>probe||(probe=newCanvas(8,8).getContext('2d'));

const fontOf=(style,px,txt)=>`${style.weight} ${px}px ${fontStackOf(style,txt)}`;

/* the ink box of `txt` at REF px, centred-alignment, alphabetic baseline */
function inkBox(style,txt){if(!txt)return{l:0,r:0,a:0,d:0};
 const c=probeCtx();c.font=fontOf(style,REF,txt);c.textAlign='center';c.textBaseline='alphabetic';
 const m=c.measureText(txt);
 const l=m.actualBoundingBoxLeft??m.width/2,r=m.actualBoundingBoxRight??m.width/2;
 const a=m.actualBoundingBoxAscent??REF*.72,d=m.actualBoundingBoxDescent??0;
 return{l,r,a,d}}

/* font size in mm, and where to put the text anchor so the ink is centred on 0,0 */
export function numeralMetrics(style,h){
 let refH=0;for(let k=0;k<12;k++){const b=inkBox(style,numeralText(style,k));refH=Math.max(refH,b.a+b.d)}
 const fontMm=REF*style.sizeMm/(refH||REF*.72),s=fontMm/REF;
 const txt=numeralText(style,h),b=inkBox(style,txt);
 return{txt,fontMm,family:fontStackOf(style,txt),weight:style.weight,
  /* anchor offset: text drawn at (ax, ay) has its ink centred on the origin */
  ax:-(b.r-b.l)/2*s,ay:(b.a-b.d)/2*s,
  box:{x0:-(b.l+b.r)/2*s,x1:(b.l+b.r)/2*s,y0:-(b.a+b.d)/2*s,y1:(b.a+b.d)/2*s}}}

const cache=new Map();
export function glyphField(style,h,ppmm){
 const m=numeralMetrics(style,h);
 const key=[m.txt,m.family,style.weight,m.fontMm.toFixed(4),ppmm].join('|');
 if(cache.has(key))return cache.get(key);
 /* measured boxes can clip a few fonts' overhangs: keep a margin round the ink */
 const pad=Math.max(.12,style.sizeMm*.08),b=m.box;
 const f=fieldFrame({x0:b.x0-pad,y0:b.y0-pad,x1:b.x1+pad,y1:b.y1+pad},ppmm);
 const cv=newCanvas(f.W,f.H),ctx=cv.getContext('2d',{willReadFrequently:true});
 ctx.font=fontOf(style,m.fontMm*ppmm,m.txt);ctx.textAlign='center';ctx.textBaseline='alphabetic';
 if('direction'in ctx)ctx.direction='ltr';
 ctx.fillStyle='#fff';
 /* sample (i, j) is the pixel centred on canvas (i + .5, j + .5) */
 if(m.txt)ctx.fillText(m.txt,m.ax*ppmm-f.ox+.5,m.ay*ppmm-f.oy+.5);
 const data=ctx.getImageData(0,0,f.W,f.H).data,alpha=new Float32Array(f.W*f.H);
 for(let k=0;k<alpha.length;k++)alpha[k]=data[k*4+3]/255;
 const out={...f,alpha};
 cache.set(key,out);if(cache.size>96)cache.delete(cache.keys().next().value);
 return out}
