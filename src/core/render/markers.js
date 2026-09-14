/* Hour markers: batons / dots / roman / arabic / eastern / wedges / minimal.

   Applied indices are solid metal blocks pinned to the dial, not printed
   shapes: each has bevelled flanks lit by the studio rig according to where it
   sits on the dial, a lume block recessed into it, and a small hard shadow on
   the dial beneath. An index at 4 o'clock therefore catches the light quite
   differently from one at 10, which is what stops them reading as flat SVG.

   In 3D they are real blocks: `shape` bakes each index's silhouette to be
   traced and extruded, and `lume` bakes the compound that sits in it. Both use
   the measurements below, so the solid and the painting agree. */
import {METALS} from '../constants.js';
import {lumOf,shade} from '../utils.js';
import {posAt,INDEX_OUTER,INDEX_DEPTH} from '../geometry.js';
import {tone,litFace,castShadow,SHADOW} from './material.js';
import {MARKERSET_VARIANT,markerSetOf} from '../markerset/index.js';
import {drMarkerSet} from './markerset.js';

/* recessed lume: bright where the wall catches light, shadowed under the far lip */
function lumeInset(ctx,w,h,lum){const g=ctx.createLinearGradient(0,-h/2,0,h/2);
 g.addColorStop(0,shade(lum,.30));g.addColorStop(.16,lum);
 g.addColorStop(.80,lum);g.addColorStop(1,'rgba(255,255,255,.42)');
 ctx.fillStyle=g;ctx.fillRect(-w/2,-h/2,w,h);
 ctx.strokeStyle='rgba(0,0,0,.30)';ctx.lineWidth=1;ctx.strokeRect(-w/2,-h/2,w,h)}

/* Eastern Arabic (Arabic-Indic) digits, the numerals of an "Arabic dial".
   Written most significant first, like any number, so twelve is ١٢. */
const EASTERN='٠١٢٣٤٥٦٧٨٩';
export const easternDigits=n=>String(n).replace(/\d/g,c=>EASTERN[+c]);
/* A face that carries them everywhere: Geeza Pro on Apple devices, Noto Naskh
   on Android, Segoe UI on Windows — each draws them as proper Arabic digits
   rather than a fallback's. */
const EASTERN_FONT='"Geeza Pro","Noto Naskh Arabic","Segoe UI",Tahoma,Arial,sans-serif';
const NUMERALS=['roman','arabic','eastern'];

/* Applied metal as dark as the dial vanishes into it: black DLC numerals on a
   black pilot's dial. Indices with no lume to carry them are printed in cream
   there instead, the way a maker would. null: apply the metal. */
export const UNLUMED_INDICES=['roman','arabic','eastern','wedges'];
export function printedIndexInk(variant,frameMetal,dialColor){const m=METALS[frameMetal]||METALS.steel;
 return UNLUMED_INDICES.includes(variant)&&lumOf(dialColor||'#16324f')<.3&&lumOf(m.base)<.4?'#e9e4d6':null}

/* Every style's indices end on one circle just inside the minute track and run
   inward from it by their own length, so changing the style changes the shape
   of the indices, never where the hour ring sits. Each style used to be centred
   on 0.8 r instead: short minimal bars and dots then sat further in than
   batons, and a numeral's reach depended on how wide its glyph was — 10 and
   VIII stood out past 1 and V. The ring clears a stepped dial's chapter step
   (0.915 r), so numerals no longer need moving in there. */
export {INDEX_OUTER};

/* The inked pixels of a numeral drawn centred on the origin (textAlign center,
   baseline middle), sampled every other pixel; null where nothing can be read
   back (a mocked canvas). Cached per font and text. */
const inks=new Map();
function glyphInk(font,txt){const key=font+'|'+txt;if(inks.has(key))return inks.get(key);
 let pts=null;
 try{const probe=document.createElement('canvas').getContext('2d');probe.font=font;
  const fs=parseFloat(font.replace(/^\D*?(\d)/,'$1'))||40,w=Math.ceil((probe.measureText(txt).width||fs*2)+fs),h=Math.ceil(fs*2.2);
  const cv=document.createElement('canvas');cv.width=w;cv.height=h;const x=cv.getContext('2d',{willReadFrequently:true});
  x.font=font;x.textAlign='center';x.textBaseline='middle';if('direction'in x)x.direction='ltr';
  x.fillStyle='#fff';x.fillText(txt,w/2,h/2);
  const data=x.getImageData(0,0,w,h).data;pts=[];
  for(let j=0;j<h;j+=2)for(let i=0;i<w;i+=2)if(data[(j*w+i)*4+3]>110)pts.push([i-w/2,j-h/2]);
  if(!pts.length)pts=null}catch(e){pts=null}
 inks.set(key,pts);if(inks.size>80)inks.delete(inks.keys().next().value);
 return pts}

/* where to anchor a numeral so its farthest ink sits on the ring at rOut */
function numeralAnchor(ctx,txt,deg,rOut,r){const a=deg*Math.PI/180,ux=Math.sin(a),uy=-Math.cos(a);
 const pts=glyphInk(ctx.font,txt);
 if(pts){/* the farthest ink radius grows with the distance out: bisect for rOut */
  const far=c=>{let m=0;for(const[vx,vy]of pts){const d=Math.hypot(c*ux+vx,c*uy+vy);if(d>m)m=d}return m};
  let lo=0,hi=rOut;for(let i=0;i<22;i++){const mid=(lo+hi)/2;if(far(mid)>rOut)hi=mid;else lo=mid}
  return posAt(deg,lo)}
 const mt=ctx.measureText(txt),fs=parseFloat(ctx.font.replace(/^\D*?(\d)/,'$1'))||r*.19;
 const hw=(mt.width||fs*.55*txt.length)/2,hh=fs*.36;
 return posAt(deg,rOut-(Math.abs(ux)*hw+Math.abs(uy)*hh))}

export function drMarkers(ctx,o){
 /* a set designed in PartStudio draws itself; without its data it stands in as batons */
 if(o.variant===MARKERSET_VARIANT){const set=markerSetOf({parts:{markers:o}});
  if(set)return drMarkerSet(ctx,o,set);o={...o,variant:'batons'}}
 const r=o.g.dialR;const lum=o.lume||'#dff3e4';
 const rOut=r*INDEX_OUTER;
 const m=METALS[o.frameMetal]||METALS.steel;
 const ink=lumOf(o.dialColor||'#16324f')>0.55?'#26282c':'#e9e4d6';
 const printed=printedIndexInk(o.variant,o.frameMetal,o.dialColor);
 const shape=o.mode==='shape',lumeOnly=o.mode==='lume';
 ctx.textAlign='center';ctx.textBaseline='middle';

 /* a date window takes the place of the index at its hour */
 const skip=o.layout&&o.layout.win?o.layout.win.skipHour:null;
 for(let h=0;h<12;h++){if(h===skip)continue;const deg=h*30,rad0=deg*Math.PI/180;

  if(o.variant==='batons'||o.variant==='minimal'){
   const mini=o.variant==='minimal';
   if(mini&&h%3)continue;
   const len=r*INDEX_DEPTH[mini?'minimal':'batons'],w=r*(mini?0.055:0.052);
   const[x,y]=posAt(deg,rOut-len/2);
   const block=(sx,sy,sw,sh)=>{ctx.save();ctx.translate(x,y);ctx.rotate(rad0);
    ctx.beginPath();ctx.rect(-sw/2+sx,-sh/2+sy,sw,sh);ctx.restore()};
   const bar=off=>{
    const bev=w*0.30;
    if(shape){block(off,0,w,len);ctx.fillStyle='#fff';ctx.fill();return}
    if(lumeOnly){ctx.save();ctx.translate(x,y);ctx.rotate(rad0);ctx.translate(off,0);ctx.fillStyle=lum;
     if(!mini)ctx.fillRect(-(w-bev*2.1)/2,-(len-w*0.34)/2,w-bev*2.1,len-w*0.34);
     else ctx.fillRect(-w*0.25,-len*0.3,w*0.5,len*0.6);
     ctx.restore();return}
    castShadow(ctx,()=>block(off,0,w,len),{dist:r*0.014,alpha:.34});
    /* body */
    ctx.save();ctx.translate(x,y);ctx.rotate(rad0);
    /* the two long flanks face tangentially: normal = index angle -/+ 90 deg */
    const nL=rad0-Math.PI/2-Math.PI/2,nR=rad0+Math.PI/2-Math.PI/2;
    ctx.fillStyle=tone(m,litFace(nL));ctx.fillRect(-w/2+off,-len/2,bev,len);
    ctx.fillStyle=tone(m,litFace(nR));ctx.fillRect(w/2-bev+off,-len/2,bev,len);
    /* top face sits between the two flank values */
    ctx.fillStyle=tone(m,(litFace(nL)+litFace(nR))/2*0.55+0.34);
    ctx.fillRect(-w/2+bev+off,-len/2,w-bev*2,len);
    ctx.strokeStyle='rgba(0,0,0,.45)';ctx.lineWidth=1.1;
    ctx.strokeRect(-w/2+off,-len/2,w,len);
    if(!mini){ctx.save();ctx.translate(off,0);lumeInset(ctx,w-bev*2.1,len-w*0.34,lum);ctx.restore()}
    else{ctx.save();ctx.translate(off,0);lumeInset(ctx,w*0.5,len*0.6,lum);ctx.restore()}
    ctx.restore()};
   if(h===0&&!mini){bar(-w*0.78);bar(w*0.78)}else bar(0)}

  else if(o.variant==='dots'){if(h%3&&h)continue;
   const rr=r*INDEX_DEPTH.dots/2;
   /* the triangle at 12 points out to the ring; the dots touch it */
   const[x,y]=posAt(deg,rOut-(h===0?rr*1.7:rr));
   const outline=()=>{ctx.beginPath();
    if(h===0){ctx.moveTo(x,y-rr*1.7);ctx.lineTo(x-rr*1.32,y+rr*0.95);ctx.lineTo(x+rr*1.32,y+rr*0.95);ctx.closePath()}
    else ctx.arc(x,y,rr,0,7)};
   const inset=fill=>{ctx.save();ctx.translate(x,y);
    if(h===0){ctx.beginPath();ctx.moveTo(0,-rr*1.05);ctx.lineTo(-rr*0.82,rr*0.6);ctx.lineTo(rr*0.82,rr*0.6);ctx.closePath()}
    else{ctx.beginPath();ctx.arc(0,0,rr*0.62,0,7)}
    fill();ctx.restore()};
   if(shape){outline();ctx.fillStyle='#fff';ctx.fill();continue}
   if(lumeOnly){inset(()=>{ctx.fillStyle=lum;ctx.fill()});continue}
   castShadow(ctx,outline,{dist:r*0.013,alpha:.34});
   outline();
   const g=ctx.createLinearGradient(x-rr,y-rr,x+rr,y+rr);
   g.addColorStop(0,tone(m,litFace(Math.PI*1.25)));g.addColorStop(1,tone(m,litFace(Math.PI*0.25)));
   ctx.fillStyle=g;ctx.fill();
   ctx.strokeStyle='rgba(0,0,0,.45)';ctx.lineWidth=1.1;ctx.stroke();
   if(h===0)inset(()=>{ctx.fillStyle=lum;ctx.fill();ctx.strokeStyle='rgba(0,0,0,.25)';ctx.lineWidth=.9;ctx.stroke()});
   else inset(()=>{const lg=ctx.createLinearGradient(0,-rr*0.62,0,rr*0.62);
    lg.addColorStop(0,shade(lum,.26));lg.addColorStop(.3,lum);lg.addColorStop(1,'rgba(255,255,255,.4)');
    ctx.fillStyle=lg;ctx.fill()})}

  /* Wedges: long applied indices tapering to a point toward the centre, ground
     into two facets along their length like a dauphine hand. Doubled at 12. */
  else if(o.variant==='wedges'){if(lumeOnly)continue;
   const len=r*INDEX_DEPTH.wedges,w=r*0.068;
   const[x,y]=posAt(deg,rOut-len/2);
   const wedge=(off,side)=>{ctx.save();ctx.translate(x,y);ctx.rotate(rad0);ctx.translate(off,0);ctx.beginPath();
    /* outer edge at -len/2 (toward the rim), point at +len/2 (toward the centre) */
    if(side<0){ctx.moveTo(-w/2,-len/2);ctx.lineTo(0,-len/2);ctx.lineTo(0,len/2)}
    else if(side>0){ctx.moveTo(0,-len/2);ctx.lineTo(w/2,-len/2);ctx.lineTo(0,len/2)}
    else{ctx.moveTo(-w/2,-len/2);ctx.lineTo(w/2,-len/2);ctx.lineTo(0,len/2)}
    ctx.closePath();ctx.restore()};
   const one=off=>{
    if(shape){wedge(off,0);ctx.fillStyle='#fff';ctx.fill();return}
    castShadow(ctx,()=>wedge(off,0),{dist:r*0.014,alpha:.34});
    const nL=rad0-Math.PI,nR=rad0;
    wedge(off,-1);ctx.fillStyle=printed||tone(m,litFace(nL)*.9+.08);ctx.fill();
    wedge(off,1);ctx.fillStyle=printed?shade(printed,.12):tone(m,litFace(nR)*.9+.08);ctx.fill();
    wedge(off,0);ctx.strokeStyle='rgba(0,0,0,.45)';ctx.lineWidth=1.1;ctx.stroke()};
   if(h===0){one(-w*0.62);one(w*0.62)}else one(0)}

  else if(NUMERALS.includes(o.variant)){
   if(lumeOnly)continue;                           /* applied numerals carry no lume */
   const RN=['XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI'];
   const n=h===0?12:h;
   const txt=o.variant==='roman'?RN[h]:o.variant==='eastern'?easternDigits(n):String(n);
   ctx.font=o.variant==='roman'?`${r*0.17}px Georgia, serif`
    :o.variant==='eastern'?`700 ${r*0.21}px ${EASTERN_FONT}`:`700 ${r*0.19}px system-ui`;
   if('direction'in ctx)ctx.direction='ltr';
   /* Place the glyph by its ink, not its text anchor: slide it along the hour's
      direction until its farthest inked pixel touches the ring. A numeral's box
      is no guide at the diagonals — VIII's corners are empty — so the ink
      itself is sampled; without pixels to read, the box stands in. */
   const[x,y]=numeralAnchor(ctx,txt,deg,rOut,r);
   if(shape){ctx.fillStyle='#fff';ctx.fillText(txt,x,y);continue}
   /* applied numerals: a dark impression, then the metal face slightly proud */
   ctx.fillStyle='rgba(0,0,0,.34)';
   ctx.fillText(txt,x+SHADOW.dx*r*0.012,y+SHADOW.dy*r*0.012);
   ctx.fillStyle=printed||(o.frameMetal?tone(m,litFace(rad0-Math.PI/2)*0.5+0.42):ink);
   ctx.fillText(txt,x,y);
   ctx.fillStyle='rgba(255,255,255,.22)';
   ctx.fillText(txt,x-SHADOW.dx*r*0.004,y-SHADOW.dy*r*0.004)}}}
