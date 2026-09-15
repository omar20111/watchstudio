/* A PartStudio marker set on the 1200 px sheet.

   The 3D watch grinds a set with PartStudio's own relief (three/markerset.js);
   this draws the same outlines and numerals for everything that is still a
   painting — the preset thumbnail, the dial texture, the layered export — in
   each bake mode drMarkers is asked for. Indices sit where PartStudio put them:
   outer end on the hour ring, pointing at the centre; numerals by their ink. */
import {C,PX} from '../constants.js';
import {shade} from '../utils.js';
import {SHADOW} from './material.js';
import {styleAt,MATERIALS} from '../markerset/model.js';
import {outlineLoops,formOf} from '../markerset/outline.js';
import {placeShape,placeNumeral} from '../markerset/placement.js';
import {numeralMetrics,glyphField} from '../markerset/glyphs.js';
import {inkPoints} from '../markerset/relief.js';

export const bodyColorOf=s=>{const M=MATERIALS[s.material];return M.kind==='paint'?s.paint:M.kind==='lume'?s.lumeColor:M.base};

/* how far in from the edge the lume starts: the bevel's span, then the rim
   (as PartStudio's drawing works it out) */
export function lumeInsetMm(s){const f=formOf(s);if(f.pocket==null)return null;
 const maxD=s.kind==='numeral'?s.sizeMm*.07:s.outline==='dot'?s.widthMm/2
  :['wedge','lozenge','dagger','arrow'].includes(s.outline)?Math.min(s.widthMm,s.lengthMm)*.3:Math.min(s.widthMm,s.lengthMm)/2;
 return(f.profile==='roof'?0:maxD*f.bevel)+s.lumeMarginMm}

/* a numeral's inked points, for placing it by its ink; none where nothing can
   be drawn and read back */
const inks=new Map();
export function inkOf(s,h){const key=JSON.stringify([s.numerals,s.font,s.arabicFont,s.weight,s.sizeMm,s.romanFour,s.numerals==='text'?s.texts[h]:0,h]);
 if(!inks.has(key)){let pts=null;try{pts=inkPoints(glyphField(s,h,28))}catch(e){pts=null}
  inks.set(key,pts);if(inks.size>96)inks.delete(inks.keys().next().value)}
 return inks.get(key)}

export function placementOf(s,h,ringMm){
 return s.kind==='numeral'?placeNumeral(h,ringMm,inkOf(s,h),s.orient):placeShape(h,ringMm)}

export function drMarkerSet(ctx,o,set){
 const ringMm=o.g.dialR/PX*set.ringRatio,mode=o.mode;
 /* the hours a date window or a register takes (geometry.js dialLayoutOf) */
 const skip=new Set(o.layout?o.layout.skipHours||[]:[]);
 for(let h=0;h<12;h++){if(skip.has(h))continue;const s=styleAt(set,h);if(!s)continue;
  const M=MATERIALS[s.material],body=bodyColorOf(s),p=placementOf(s,h,ringMm);
  const at=(shadow=0)=>{ctx.translate(C+p.x*PX+SHADOW.dx*shadow,C+p.z*PX+SHADOW.dy*shadow);ctx.rotate(-p.rotY)};
  if(s.kind==='numeral'){const m=numeralMetrics(s,h);
   const text=(fill,shadow=0)=>{ctx.save();at(shadow);ctx.font=`${m.weight} ${m.fontMm*PX}px ${m.family}`;
    ctx.textAlign='center';ctx.textBaseline='alphabetic';if('direction'in ctx)ctx.direction='ltr';
    ctx.fillStyle=fill;ctx.fillText(m.txt,m.ax*PX,m.ay*PX);ctx.restore()};
   if(mode==='shape'){text('#fff');continue}
   if(mode==='lume'){if(M.kind==='lume')text(s.lumeColor);continue}
   if(!mode)text('rgba(0,0,0,.34)',s.heightMm*PX*.9);
   text(body);
   if(!mode&&M.kind==='metal')text('rgba(255,255,255,.18)',-PX*.05);
   continue}
  const loops=outlineLoops(s),inset=lumeInsetMm(s);
  const path=()=>{ctx.beginPath();for(const l of loops){l.forEach(([x,y],i)=>i?ctx.lineTo(x*PX,y*PX):ctx.moveTo(x*PX,y*PX));ctx.closePath()}};
  /* the lume inside its channel: fill the outline, then take back a band the
     width of the bevel and rim all round it */
  const lume=cut=>{if(inset==null)return;ctx.save();path();ctx.clip();ctx.fillStyle=s.lumeColor;ctx.fill();
   ctx.lineWidth=inset*2*PX;ctx.lineJoin='round';
   if(cut){ctx.globalCompositeOperation='destination-out';ctx.strokeStyle='#000'}else ctx.strokeStyle=body;
   ctx.stroke();ctx.restore()};
  if(mode==='shape'){ctx.save();at();path();ctx.fillStyle='#fff';ctx.fill();ctx.restore();continue}
  if(mode==='lume'){ctx.save();at();if(M.kind==='lume'){path();ctx.fillStyle=s.lumeColor;ctx.fill()}else lume(true);ctx.restore();continue}
  if(!mode){ctx.save();at(Math.max(1.5,s.heightMm*PX*.9));path();ctx.fillStyle='rgba(0,0,0,.34)';ctx.fill();ctx.restore()}
  ctx.save();at();path();
  if(!mode&&M.kind==='metal'){const w=s.widthMm*PX,g=ctx.createLinearGradient(-w,0,w,0);
   g.addColorStop(0,M.hi);g.addColorStop(.5,M.base);g.addColorStop(1,M.lo);ctx.fillStyle=g}
  else ctx.fillStyle=body;
  ctx.fill();lume(false);
  if(!mode){path();ctx.strokeStyle=M.kind==='metal'?'rgba(0,0,0,.45)':shade(body,.25);ctx.lineWidth=1.1;ctx.stroke()}
  ctx.restore()}}
