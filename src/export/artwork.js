/* Production artwork: the dial's printing, its cut-outs and applied parts, the
   bezel insert's engraving and the hands, as vector outlines in millimetres.

   Nothing is drawn twice. Each layer is the renderer's own drawing, baked alone
   in white at four times the sheet's resolution (72 px per mm) and traced back
   into outlines (core/three/tracer.js) — the way the 3D hands and indices are
   made — so the artwork is exactly what the watch shows:

     dial   print   the brand and the model line; the minute track and the
                    registers' scales; a logo printed in the dial's ink
            applied the hour indices and an applied logo (outlines to cut)
            cut     the dial's edge, the date window, the registers (milled)
     bezel  engraving on a rotating insert, or a fixed bezel's scale
     hands  hour, minute and seconds hands, each pointing to 12 from its pivot

   A logo printed in its original colours is not one ink: it is kept as a
   picture. Outlines are in mm from the dial centre, x to 3 o'clock, y to 6. */
import {C,PX,METALS} from '../core/constants.js';
import {geoOf,dialLayoutOf,dialTextOf,handLengthsOf,indexInnerOf,MINUTE_TRACK_R,DIAL_MM,SUBDIAL_DEPTH_MM,caseOf} from '../core/geometry.js';
import {DR,procOpts} from '../core/render/index.js';
import {bezelRings,bezelPipOf} from '../core/render/bezel.js';
import {traceLoops,simplifyLoop} from '../core/three/tracer.js';
import {logoOf,logoInk,logoBoxOf,logoImageOf,activeLogo} from '../core/logo.js';
import {lumOf} from '../core/utils.js';
import {VNAME} from '../core/parts.js';

const K=4;                                          /* bake resolution, times the sheet's */

/* Bake `draw` (sheet px drawing calls) over the square of half-size `half` px
   round the dial centre, and trace it. Returns loops in mm. */
function traced(draw,half){
 const size=Math.ceil(2*half*K),cv=document.createElement('canvas');cv.width=cv.height=size;
 const ctx=cv.getContext('2d',{willReadFrequently:true});
 ctx.setTransform(K,0,0,K,-(C-half)*K,-(C-half)*K);
 draw(ctx);
 /* within a hundredth of a millimetre of the traced edge (0.6 px at 72 px per mm) */
 const loops=traceLoops(cv).map(l=>simplifyLoop(l,.6));
 cv.width=cv.height=0;                             /* release the backing store now */
 return loops.filter(l=>l.length>=3).map(l=>l.map(([x,y])=>[+((x/K+C-half-C)/PX).toFixed(4),+((y/K+C-half-C)/PX).toFixed(4)]))}

export const loopsBox=loops=>{let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
 for(const l of loops)for(const[x,y]of l){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
 return x1<x0?null:{x0,y0,x1,y1}};

const mm=v=>v/PX;

export async function artworkOf(d,customs={}){
 const g=geoOf(d),P=d.parts,L=dialLayoutOf(d),r=g.dialR,T=dialTextOf(d);
 const dialCol=P.dial.color||'#16324f';
 const textInk=P.dial.text.color==='auto'?(lumOf(dialCol)>0.55?'#26282c':'#e9e4d6'):P.dial.text.color;
 const metal=id=>(METALS[id]||METALS.steel);
 const half=g.rBezOut+4;

 /* ---- dial ---- */
 const print=[],applied=[],pictures=[];
 const textLoops=traced(ctx=>DR.dial(ctx,{...procOpts('dial',d,undefined,'ink'),ink:'text'}),half);
 if(textLoops.length)print.push({id:'print-text',label:'Dial text',ink:textInk,loops:textLoops});
 const trackLoops=traced(ctx=>DR.dial(ctx,{...procOpts('dial',d,undefined,'ink'),ink:'track'}),half);
 if(trackLoops.length)print.push({id:'print-track',label:L.subdials.length?'Minute track and register scales':'Minute track',ink:'#ebecf0',loops:trackLoops});
 const lg=logoOf(d),img=activeLogo(d,customs)?await logoImageOf(d,customs):null;
 if(img){const B=logoBoxOf(d,(img.naturalHeight||img.height)/(img.naturalWidth||img.width));
  if(lg.style==='applied'){
   applied.push({id:'applied-logo',label:'Applied logo',metal:P.hands.metal,loops:traced(ctx=>{
    ctx.drawImage(img,B.x-B.w/2,B.y-B.h/2,B.w,B.h);ctx.globalCompositeOperation='source-in';ctx.fillStyle='#fff';ctx.fillRect(0,0,2*C,2*C)},half)})}
  else if(lg.color==='ink'){
   print.push({id:'print-logo',label:'Logo',ink:logoInk(d),loops:traced(ctx=>{
    ctx.drawImage(img,B.x-B.w/2,B.y-B.h/2,B.w,B.h);ctx.globalCompositeOperation='source-in';ctx.fillStyle='#fff';ctx.fillRect(0,0,2*C,2*C)},half)})}
  else{const s=8,cv=document.createElement('canvas');cv.width=Math.ceil(B.w/PX*s*10);cv.height=Math.ceil(B.h/PX*s*10);
   cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
   pictures.push({id:'print-logo',label:'Logo (original colours)',x:mm(B.x-C-B.w/2),y:mm(B.y-C-B.h/2),w:mm(B.w),h:mm(B.h),href:cv.toDataURL('image/png'),canvas:cv})}}
 const idxLoops=traced(ctx=>DR.markers(ctx,procOpts('markers',d,undefined,'shape')),half);
 if(idxLoops.length)applied.unshift({id:'applied-indices',label:`Hour indices (${VNAME[P.markers.variant]||P.markers.variant})`,metal:P.hands.metal,lume:P.markers.lume,loops:idxLoops});

 const cuts={edge:mm(r),
  window:L.win?{x:mm(L.win.x-C),y:mm(L.win.y-C),w:mm(L.win.w),h:mm(L.win.h),rad:mm(L.win.rad),frame:mm(L.win.frame),at:L.date}:null,
  registers:L.subdials.map(s=>({key:s.key,x:mm(s.x-C),y:mm(s.y-C),r:mm(s.r)})),
  step:L.stepped?mm(L.stepR):null};
 const dial={diameter:mm(r*2),color:dialCol,variant:P.dial.variant,finish:P.dial.finish,print,applied,pictures,cuts,
  measures:{indexOuter:mm(r*.885),indexInner:mm(indexInnerOf(d)*r),track:mm(r*MINUTE_TRACK_R),
   brand:P.dial.text.top?{text:P.dial.text.top,size:DIAL_MM.text.brand,y:mm(T.brand.y-C)}:null,
   line:P.dial.text.bottom?{text:P.dial.text.bottom,size:DIAL_MM.text.line,y:mm(T.line.y-C)}:null}};

 /* ---- bezel ---- */
 let bezel=null;const bz=P.bezel,rot=bz.variant==='diver'||bz.variant==='gmt';
 if(rot||bz.variant==='tachy'){const R=bezelRings(g,bz.variant);
  const loops=traced(ctx=>DR.bezel(ctx,rot?procOpts('bezel',d,'insert','shape'):procOpts('bezel',d,undefined,'print')),half);
  const pip=rot?bezelPipOf(g,bz.variant):null;
  bezel={kind:rot?'insert':'engraved',variant:bz.variant,outer:mm(rot?R.rInsOut:R.rGripIn),inner:mm(R.rInCham),
   color:rot?(bz.insertColor||(bz.variant==='gmt'?'#1c3f66':'#101318')):metal(bz.metal).base,
   engraving:{label:rot?'Engraved scale (filled)':'Engraved scale',ink:rot?'#c9ced6':'#2a2d33',loops},
   pip:pip?{x:mm(pip.x-C),y:mm(pip.y-C),r:mm(pip.r),lume:mm(pip.lume),color:P.markers.lume}:null,
   detents:bz.detents,action:bz.dir==='bi'?'bidirectional':'unidirectional'}}

 /* ---- hands, each pointing to 12 from its pivot ---- */
 const HL=handLengthsOf(d),hands=[];
 for(const k of['hour','min','sec']){
  const loops=traced(ctx=>DR.hands(ctx,procOpts('hands',d,k,'shape')),half);
  hands.push({key:k,label:k==='hour'?'Hour hand':k==='min'?'Minute hand':'Seconds hand',
   length:mm(HL[k]*r),metal:k==='sec'?null:P.hands.metal,color:k==='sec'?P.hands.secColor:metal(P.hands.metal).base,
   lume:k==='sec'?null:P.hands.lume,loops})}

 return{dial,bezel,hands,variant:{hands:VNAME[P.hands.variant]||P.hands.variant},case:caseOf(d)}}

/* ------------------------------------------------------------------ SVG */

const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const f=v=>+v.toFixed(3);
export const pathD=loops=>loops.map(l=>'M'+l.map(([x,y])=>`${f(x)} ${f(y)}`).join('L')+'Z').join('');
const layer=(id,label,body)=>`<g id="${id}" inkscape:groupmode="layer" inkscape:label="${esc(label)}">${body}</g>\n`;
const doc=(half,title,desc,body)=>`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${f(half*2)}mm" height="${f(half*2)}mm" viewBox="${f(-half)} ${f(-half)} ${f(half*2)} ${f(half*2)}">
<title>${esc(title)}</title>
<desc>${esc(desc)}</desc>
${body}</svg>\n`;
const CUT='fill="none" stroke="#e0301e" stroke-width="0.05"';

export function dialSVG(art,name){const D=art.dial,half=D.diameter/2+1;let b='';
 b+=layer('base',`Dial base (${D.variant}, ${D.color}) — reference only`,`<circle cx="0" cy="0" r="${f(D.diameter/2)}" fill="${D.color}"/>`);
 for(const p of D.print)b+=layer(p.id,`Print — ${p.label} (${p.ink})`,`<path fill-rule="evenodd" fill="${p.ink}" d="${pathD(p.loops)}"/>`);
 for(const p of D.pictures)b+=layer(p.id,`Print — ${p.label}`,`<image x="${f(p.x)}" y="${f(p.y)}" width="${f(p.w)}" height="${f(p.h)}" href="${p.href}"/>`);
 for(const a of D.applied)b+=layer(a.id,`Applied — ${a.label} (${(METALS[a.metal]||{}).name||a.metal})`,
  `<path fill-rule="evenodd" fill="#c9ced6" stroke="#1d1f23" stroke-width="0.03" d="${pathD(a.loops)}"/>`);
 let cut=`<circle cx="0" cy="0" r="${f(D.cuts.edge)}" ${CUT}/>`;
 const w=D.cuts.window;if(w)cut+=`<rect x="${f(w.x-w.w/2)}" y="${f(w.y-w.h/2)}" width="${f(w.w)}" height="${f(w.h)}" rx="${f(w.rad)}" ${CUT}><title>Date window ${f(w.w)} x ${f(w.h)} mm</title></rect>`;
 for(const s of D.cuts.registers)cut+=`<circle cx="${f(s.x)}" cy="${f(s.y)}" r="${f(s.r)}" ${CUT} stroke-dasharray="0.4 0.2"><title>Register, milled ${SUBDIAL_DEPTH_MM} mm</title></circle>`;
 if(D.cuts.step)cut+=`<circle cx="0" cy="0" r="${f(D.cuts.step)}" ${CUT} stroke-dasharray="0.8 0.3"><title>Chapter ring step</title></circle>`;
 cut+=`<path d="M-0.6 0H0.6M0 -0.6V0.6" ${CUT}/>`;
 b+=layer('cut','Cut and milled lines',cut);
 return doc(half,`${name} — dial artwork`,`Dial Ø${f(D.diameter)} mm at 1:1. Units mm, origin at the dial centre. Print layers are filled outlines in their ink; applied parts are outlines to cut; red lines are cut or milled. Made with WatchStudio.`,b)}


export function bezelSVG(art,name){const Z=art.bezel;if(!Z)return null;const half=Z.outer+1;let b='';
 b+=layer('base',`${Z.kind==='insert'?'Insert':'Bezel top'} (${Z.color}) — reference only`,
  `<path fill-rule="evenodd" fill="${Z.color}" d="M${f(Z.outer)} 0A${f(Z.outer)} ${f(Z.outer)} 0 1 0 ${f(-Z.outer)} 0A${f(Z.outer)} ${f(Z.outer)} 0 1 0 ${f(Z.outer)} 0ZM${f(Z.inner)} 0A${f(Z.inner)} ${f(Z.inner)} 0 1 1 ${f(-Z.inner)} 0A${f(Z.inner)} ${f(Z.inner)} 0 1 1 ${f(Z.inner)} 0Z"/>`);
 b+=layer('engraving',`${Z.engraving.label}`,`<path fill-rule="evenodd" fill="${Z.engraving.ink}" d="${pathD(Z.engraving.loops)}"/>`);
 if(Z.pip)b+=layer('pip','Lume pip',`<circle cx="${f(Z.pip.x)}" cy="${f(Z.pip.y)}" r="${f(Z.pip.r)}" fill="#c9ced6"/><circle cx="${f(Z.pip.x)}" cy="${f(Z.pip.y)}" r="${f(Z.pip.lume)}" fill="${Z.pip.color}"/>`);
 b+=layer('cut','Cut lines',`<circle cx="0" cy="0" r="${f(Z.outer)}" ${CUT}/><circle cx="0" cy="0" r="${f(Z.inner)}" ${CUT}/>`);
 return doc(half,`${name} — bezel ${Z.kind}`,`Bezel ${Z.kind}: outer Ø${f(Z.outer*2)} mm, inner Ø${f(Z.inner*2)} mm, at 1:1. Units mm, origin at the dial centre. Made with WatchStudio.`,b)}

/* the hands laid out side by side, each with its pivot at its own origin */
export function handsLayout(art){const out=[];let x=0;
 for(const h of art.hands){const box=loopsBox(h.loops);if(!box)continue;
  const wdt=box.x1-box.x0;out.push({...h,box,dx:x-box.x0});x+=wdt+3}
 return{items:out,width:Math.max(1,x-3)}}

export function handsSVG(art,name){const Lay=handsLayout(art);if(!Lay.items.length)return null;
 const top=Math.min(...Lay.items.map(h=>h.box.y0)),bot=Math.max(...Lay.items.map(h=>h.box.y1));
 const W=Lay.width+2,H=bot-top+2;let b='';
 for(const h of Lay.items)b+=layer(`hand-${h.key}`,`${h.label} — length ${f(h.length)} mm from the pivot`,
  `<g transform="translate(${f(h.dx)} 0)"><path fill-rule="evenodd" fill="${h.color}" stroke="#1d1f23" stroke-width="0.03" d="${pathD(h.loops)}"/>`+
  `<path d="M-0.4 0H0.4M0 -0.4V0.4" ${CUT}/></g>`);
 return`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${f(W)}mm" height="${f(H)}mm" viewBox="-1 ${f(top-1)} ${f(W)} ${f(H)}">
<title>${esc(name)} — hands</title>
<desc>Hands at 1:1, each pointing to 12; the red cross marks each pivot. Units mm. Made with WatchStudio.</desc>
${b}</svg>\n`}
