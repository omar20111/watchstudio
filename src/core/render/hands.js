/* Hands renderer: dauphine / baton / sword / mercedes / leaf + second hand. */
import {C,METALS} from '../constants.js';
import {axisGrad,envGrad,tone,applyFinish} from './material.js';

/* Hands sit clear of the dial on the motion works, so they throw a real shadow.
   A hand canvas is cached once and rotated by CSS, so any lateral offset baked
   in here rotates with the hand — for half the dial that would put the shadow
   on the lit side and contradict the studio rig every other component obeys.
   So this is a contact shadow: no direction, just the hand's own silhouette
   spread slightly and softened, which is what a component lying close to the
   dial actually casts under a broad softbox. */
const handShadow=(ctx,build,len)=>{ctx.save();
 if('filter'in ctx)ctx.filter=`blur(${Math.max(2,len*0.018)}px)`;
 ctx.translate(C,C);ctx.scale(1.012,1.012);ctx.translate(-C,-C+len*0.012);
 ctx.fillStyle='rgba(0,0,0,.30)';build();ctx.fill();ctx.restore()};

/* lume is a filled compound, not paint — give it a soft body and a lit top edge */
function lumeFill(ctx,x0,y0,x1,y1,lum){const g=ctx.createLinearGradient(x0,y0,x1,y1);
 g.addColorStop(0,lum);g.addColorStop(.55,lum);g.addColorStop(1,'rgba(0,0,0,.18)');return g}

export function drHand(ctx,o){const r=o.g.dialR;const m=METALS[o.metal]||METALS.steel;const t=o.hand;const lum=o.lume||'#dff3e4';
 const len=t==='hour'?r*0.55:t==='min'?r*0.80:r*0.90;
 const tail=t==='sec'?r*0.22:r*0.07;
 if(t==='sec'){const col=o.secColor||'#e8482c';
  handShadow(ctx,()=>{ctx.beginPath();ctx.roundRect(C-2.6,C-len,5.2,len+tail,2.6)},len);
  ctx.strokeStyle=col;ctx.lineWidth=4;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(C,C+tail);ctx.lineTo(C,C-len);ctx.stroke();
  ctx.beginPath();ctx.arc(C,C+tail*0.62,10,0,7);ctx.fillStyle=col;ctx.fill();
  ctx.beginPath();ctx.arc(C,C,13,0,7);ctx.fillStyle=envGrad(ctx,m);ctx.fill();
  ctx.beginPath();ctx.arc(C,C,5,0,7);ctx.fillStyle='#1c1e22';ctx.fill();return}
 const w=t==='hour'?len*0.115:len*0.085, tipY=C-len, bY=C+tail;
 handShadow(ctx,()=>{ctx.beginPath();ctx.roundRect(C-w*0.66,tipY,w*1.32,bY-tipY,w*0.62)},len);
 const facet=(x0,x1,l0,l1)=>{const g=ctx.createLinearGradient(x0,0,x1,0);
  g.addColorStop(0,tone(m,l0));g.addColorStop(1,tone(m,l1));return g};
 if(o.variant==='dauphine'){
  const L=()=>{ctx.beginPath();ctx.moveTo(C,tipY);ctx.lineTo(C-w,bY-len*0.1);ctx.lineTo(C,bY);ctx.closePath()};
  const Rr=()=>{ctx.beginPath();ctx.moveTo(C,tipY);ctx.lineTo(C+w,bY-len*0.1);ctx.lineTo(C,bY);ctx.closePath()};
  /* two ground facets meeting at the ridge — one to the light, one away */
  L();ctx.fillStyle=facet(C-w,C,.93,.62);ctx.fill();
  Rr();ctx.fillStyle=facet(C,C+w,.34,.13);ctx.fill();
  ctx.beginPath();ctx.moveTo(C,tipY);ctx.lineTo(C,bY);ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=1.5;ctx.stroke();
  L();ctx.strokeStyle='rgba(0,0,0,.4)';ctx.lineWidth=1.5;ctx.stroke();Rr();ctx.stroke();}
 else if(o.variant==='leaf'){
  const wb=t==='hour'?len*0.17:len*0.13;
  const leaf=(ww,y0,y1)=>{ctx.beginPath();ctx.moveTo(C,y0);ctx.quadraticCurveTo(C-ww,(y0+y1)/2,C,y1);ctx.quadraticCurveTo(C+ww,(y0+y1)/2,C,y0);ctx.closePath()};
  leaf(wb,bY,tipY);ctx.fillStyle=axisGrad(ctx,m,C-wb,0,C+wb,0);ctx.fill();ctx.strokeStyle='rgba(0,0,0,.4)';ctx.lineWidth=1.5;ctx.stroke();
  leaf(wb*0.42,bY-len*0.12,tipY+len*0.14);ctx.fillStyle=lumeFill(ctx,C-wb*.42,0,C+wb*.42,0,lum);ctx.fill();}
 else if(o.variant==='mercedes'&&t==='hour'){
  const ww=len*0.13,cy=C-len*0.70,cr=len*0.135;
  ctx.beginPath();ctx.roundRect(C-ww/2,cy,ww,len*0.70+tail,ww/2);ctx.fillStyle=axisGrad(ctx,m,C-ww/2,0,C+ww/2,0);ctx.fill();ctx.strokeStyle='rgba(0,0,0,.4)';ctx.lineWidth=1.5;ctx.stroke();
  ctx.beginPath();ctx.moveTo(C-ww*0.45,cy-cr*0.4);ctx.lineTo(C,tipY);ctx.lineTo(C+ww*0.45,cy-cr*0.4);ctx.closePath();ctx.fillStyle=axisGrad(ctx,m,C-ww*.45,0,C+ww*.45,0);ctx.fill();ctx.strokeStyle='rgba(0,0,0,.4)';ctx.stroke();
  ctx.beginPath();ctx.arc(C,cy,cr,0,7);ctx.fillStyle=lumeFill(ctx,C,cy-cr,C,cy+cr,lum);ctx.fill();ctx.strokeStyle=axisGrad(ctx,m,C-cr,0,C+cr,0);ctx.lineWidth=5;ctx.stroke();
  for(const a of[-90,30,150]){const ra=a*Math.PI/180;ctx.beginPath();ctx.moveTo(C,cy);ctx.lineTo(C+Math.cos(ra)*cr,cy+Math.sin(ra)*cr);ctx.strokeStyle=axisGrad(ctx,m,C-cr,0,C+cr,0);ctx.lineWidth=3.5;ctx.stroke()}}
 else{const tw=o.variant==='sword'||o.variant==='mercedes'?w*1.5:w;
  ctx.beginPath();ctx.roundRect(C-tw/2,tipY,tw,bY-tipY,tw/2);ctx.fillStyle=axisGrad(ctx,m,C-tw/2,0,C+tw/2,0);ctx.fill();ctx.strokeStyle='rgba(0,0,0,.4)';ctx.lineWidth=1.5;ctx.stroke();
  ctx.beginPath();ctx.roundRect(C-w*0.28,tipY+len*0.1,w*0.56,(bY-tipY)*0.62,3);ctx.fillStyle=lumeFill(ctx,C-w*.28,0,C+w*.28,0,lum);ctx.fill();}
 applyFinish(ctx,m,o.finish,{mode:'linear',cx:C,cy:C,r1:len,x0:C-w*1.6,y0:C,x1:C+w*1.6,y1:C,amt:.65,grain:.5});}
