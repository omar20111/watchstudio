/* Side elevation and caseback, for the technical presentation sheet.

   These are true orthographic views built from the same mm dimensions as the
   front view, so the sheet stays consistent with the design: change the case
   thickness and the profile grows, change lug-to-lug and the horns reach
   further. Lighting is a simple overhead key, which is the convention for an
   industrial-design elevation. */
import {METALS,PX} from '../constants.js';
import {axisGrad,tone,circGrain,seam} from './material.js';
import {strapMmOf,caseThickOf,lugToLugOf,crystalMmOf,caseOf} from '../geometry.js';

const metalOf=d=>METALS[d.parts.case.metal]||METALS.steel;

/* vertical metal ramp: lit along the top edge, falling into shade underneath */
function wall(ctx,m,y0,y1,hi=.92,lo=.16){const g=ctx.createLinearGradient(0,y0,0,y1);
 g.addColorStop(0,tone(m,hi));g.addColorStop(.18,tone(m,hi*.72));
 g.addColorStop(.55,tone(m,Math.max(lo,hi*.34)));g.addColorStop(1,tone(m,lo));return g}

export function drProfile(ctx,d,o={}){const s=o.scale||1,cx=o.cx||0,cy=o.cy||0;
 const m=metalOf(d);
 const wCase=d.caseMm*PX*s, thick=caseThickOf(d)*PX*s;
 const l2l=lugToLugOf(d)*PX*s, sw=strapMmOf(d)*PX*s;
 const crysH=crystalMmOf(d)*PX*s;
 const bezH=thick*0.20, bandH=thick*0.50, backH=thick-bezH-bandH;
 const top=cy-thick/2;

 /* ---- lugs: sweep down and outward from the case band ---- */
 for(const sx of[-1,1]){ctx.beginPath();
  ctx.moveTo(cx+sx*wCase*0.46,top+bezH+bandH*0.15);
  ctx.quadraticCurveTo(cx+sx*l2l*0.48,top+bezH+bandH*0.45,cx+sx*l2l*0.5,top+thick*0.86);
  ctx.lineTo(cx+sx*l2l*0.5-sx*thick*0.14,top+thick*0.90);
  ctx.quadraticCurveTo(cx+sx*wCase*0.44,top+bezH+bandH*0.72,cx+sx*wCase*0.40,top+bezH+bandH*0.20);
  ctx.closePath();
  ctx.fillStyle=wall(ctx,m,top+bezH,top+thick*0.92,.86,.12);ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.45)';ctx.lineWidth=1.2*s*PX*0.06+0.6;ctx.stroke()}

 /* ---- strap leaving each lug ---- */
 for(const sx of[-1,1]){ctx.beginPath();
  ctx.moveTo(cx+sx*l2l*0.49,top+thick*0.70);
  ctx.quadraticCurveTo(cx+sx*l2l*0.78,top+thick*0.86,cx+sx*l2l*0.95,top+thick*1.34);
  ctx.lineTo(cx+sx*l2l*0.95-sx*sw*0.20,top+thick*1.40);
  ctx.quadraticCurveTo(cx+sx*l2l*0.74,top+thick*0.96,cx+sx*l2l*0.47,top+thick*0.84);
  ctx.closePath();
  const st=d.parts.strap;
  ctx.fillStyle=st.variant==='steel'?wall(ctx,METALS[st.metal]||m,top+thick*0.7,top+thick*1.4,.7,.12):(st.color||'#6b4a2f');
  ctx.fill();ctx.strokeStyle='rgba(0,0,0,.5)';ctx.lineWidth=1;ctx.stroke()}

 /* ---- caseback: shallow dome ---- */
 ctx.beginPath();
 ctx.moveTo(cx-wCase*0.46,top+bezH+bandH);
 ctx.quadraticCurveTo(cx,top+thick+backH*0.85,cx+wCase*0.46,top+bezH+bandH);
 ctx.closePath();
 ctx.fillStyle=wall(ctx,m,top+bezH+bandH,top+thick,.44,.06);ctx.fill();
 ctx.strokeStyle='rgba(0,0,0,.5)';ctx.lineWidth=1;ctx.stroke();

 /* ---- case band: the vertical flank, slightly barrelled ---- */
 ctx.beginPath();
 ctx.moveTo(cx-wCase*0.5,top+bezH);
 ctx.quadraticCurveTo(cx-wCase*0.52,top+bezH+bandH*0.5,cx-wCase*0.46,top+bezH+bandH);
 ctx.lineTo(cx+wCase*0.46,top+bezH+bandH);
 ctx.quadraticCurveTo(cx+wCase*0.52,top+bezH+bandH*0.5,cx+wCase*0.5,top+bezH);
 ctx.closePath();
 ctx.fillStyle=wall(ctx,m,top+bezH,top+bezH+bandH,.95,.10);ctx.fill();
 ctx.save();ctx.clip();
 ctx.globalCompositeOperation='overlay';
 ctx.fillStyle=circGrain(ctx,0,wCase*0.5,.5,cx,top+bezH+bandH*0.5);
 ctx.fillRect(cx-wCase,top,wCase*2,thick);ctx.restore();
 ctx.strokeStyle='rgba(0,0,0,.45)';ctx.lineWidth=1;ctx.stroke();

 /* ---- bezel ---- */
 ctx.beginPath();
 ctx.moveTo(cx-wCase*0.5,top+bezH);
 ctx.lineTo(cx-wCase*0.472,top);
 ctx.lineTo(cx+wCase*0.472,top);
 ctx.lineTo(cx+wCase*0.5,top+bezH);
 ctx.closePath();
 ctx.fillStyle=wall(ctx,m,top,top+bezH,1,.30);ctx.fill();
 ctx.strokeStyle='rgba(0,0,0,.42)';ctx.lineWidth=1;ctx.stroke();

 /* ---- crystal ---- */
 const cw=wCase*0.40;
 ctx.beginPath();ctx.moveTo(cx-cw,top);
 const shape=caseOf(d).crystal;
 if(shape==='flat')ctx.lineTo(cx-cw,top-crysH*0.45),ctx.lineTo(cx+cw,top-crysH*0.45);
 else if(shape==='box'){/* vertical walls and a flat top, eased at the corners */
  const h=top-crysH*0.9,rc=Math.min(cw*0.06,crysH*0.2);
  ctx.lineTo(cx-cw,h+rc);ctx.quadraticCurveTo(cx-cw,h,cx-cw+rc,h);
  ctx.lineTo(cx+cw-rc,h);ctx.quadraticCurveTo(cx+cw,h,cx+cw,h+rc)}
 else ctx.quadraticCurveTo(cx,top-crysH*2.1,cx+cw,top);
 ctx.lineTo(cx+cw,top);ctx.closePath();
 const cg=ctx.createLinearGradient(cx-cw,top-crysH*2,cx+cw,top);
 cg.addColorStop(0,'rgba(232,240,252,.72)');cg.addColorStop(.45,'rgba(200,214,232,.30)');
 cg.addColorStop(.7,'rgba(255,255,255,.62)');cg.addColorStop(1,'rgba(190,205,225,.34)');
 ctx.fillStyle=cg;ctx.fill();
 ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=1;ctx.stroke();

 seam(ctx,cx,top+bezH,wCase*0.5,{dark:0,lite:0,w:0});
 ctx.beginPath();ctx.moveTo(cx-wCase*0.5,top+bezH);ctx.lineTo(cx+wCase*0.5,top+bezH);
 ctx.strokeStyle='rgba(0,0,0,.42)';ctx.lineWidth=1.2;ctx.stroke()}

export function drBack(ctx,d,o={}){const s=o.scale||1,cx=o.cx||0,cy=o.cy||0;
 const m=metalOf(d);const R=d.caseMm*PX*s/2;
 ctx.beginPath();ctx.arc(cx,cy,R,0,7);
 ctx.fillStyle=axisGrad(ctx,m,cx-R,cy-R,cx+R,cy+R);ctx.fill();
 ctx.strokeStyle='rgba(0,0,0,.5)';ctx.lineWidth=1.4;ctx.stroke();
 /* knurled screw-down ring */
 ctx.save();ctx.beginPath();ctx.arc(cx,cy,R*0.84,0,7);ctx.clip();
 ctx.fillStyle=tone(m,.44);ctx.fillRect(cx-R,cy-R,R*2,R*2);
 const teeth=48;
 for(let i=0;i<teeth;i++){const a=i/teeth*Math.PI*2;
  ctx.save();ctx.translate(cx,cy);ctx.rotate(a);
  ctx.fillStyle=i%2?tone(m,.72):tone(m,.30);
  ctx.fillRect(R*0.72,-R*0.035,R*0.13,R*0.07);ctx.restore()}
 ctx.restore();
 ctx.beginPath();ctx.arc(cx,cy,R*0.70,0,7);
 ctx.fillStyle=axisGrad(ctx,m,cx-R*0.7,cy-R*0.7,cx+R*0.7,cy+R*0.7);ctx.fill();
 ctx.save();ctx.beginPath();ctx.arc(cx,cy,R*0.70,0,7);ctx.clip();
 ctx.globalCompositeOperation='overlay';
 ctx.fillStyle=circGrain(ctx,0,R*0.7,.8,cx,cy);ctx.fillRect(cx-R,cy-R,R*2,R*2);ctx.restore();
 ctx.strokeStyle='rgba(0,0,0,.42)';ctx.lineWidth=1.2;ctx.stroke();
 /* engraving band */
 ctx.save();ctx.translate(cx,cy);ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.fillStyle='rgba(0,0,0,.52)';ctx.font=`${R*0.10}px system-ui`;
 const c=caseOf(d);
 ctx.fillText((c.engraving||'WATCHSTUDIO').toUpperCase(),0,-R*0.34);
 ctx.fillText(`${d.caseMm} MM  ${c.wrM} M`,0,R*0.30);
 ctx.restore()}
