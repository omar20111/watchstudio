/* Crown renderer: tube, knurled barrel, chamfered end face.

   Sized from the real crown diameter rather than fixed pixels, so a 6.5 mm
   crown on a 40 mm case reads at the right scale. Seen from above the barrel
   is a cylinder lying on its side: bright along its upper shoulder, dark along
   the lower one, with the knurl teeth catching light on their top flanks. */
import {C,METALS} from '../constants.js';
import {crownAng} from '../geometry.js';
import {axisGrad,applyFinish,litFace,LIGHT} from './material.js';

export function drCrown(ctx,o){const{R,crownR}=o.g;const m=METALS[o.metal]||METALS.steel;
 /* The crown is drawn along the +x axis and then swung to its real bearing, so
    a 4:30 crown actually sits at 4:30 instead of the control being decorative.
    Everything below is unchanged; only the frame it lands in moves. */
 const bearing=(o.crownAng||90)-90;
 ctx.save();if(bearing)ctx.translate(C,C),ctx.rotate(bearing*Math.PI/180),ctx.translate(-C,-C);
 const sc=o.variant==='oversized'?1.22:1;
 const bh=crownR*2*sc, bw=crownR*1.5*sc;
 const xT=C+R-crownR*0.45, x=C+R+crownR*0.30;

 /* tube: the threaded stem the crown screws onto */
 ctx.fillStyle=axisGrad(ctx,m,0,C-bh*0.19,0,C+bh*0.19);
 ctx.fillRect(xT,C-bh*0.19,x-xT+2,bh*0.38);
 ctx.strokeStyle='rgba(0,0,0,.45)';ctx.lineWidth=1.4;
 ctx.strokeRect(xT,C-bh*0.19,x-xT+2,bh*0.38);

 /* barrel */
 const body=()=>{ctx.beginPath();ctx.roundRect(x,C-bh/2,bw,bh,Math.min(bw,bh)*0.17)};
 body();ctx.fillStyle=axisGrad(ctx,m,0,C-bh/2,0,C+bh/2);ctx.fill();

 ctx.save();body();ctx.clip();
 /* knurling: teeth run around the barrel, so in this view they are vertical
    ribs — each lit on its upper flank and shadowed on its lower */
 const teeth=Math.max(9,Math.round(bh/9));
 for(let i=0;i<teeth;i++){const y=C-bh/2+i*(bh/teeth);
  ctx.fillStyle=`rgba(0,0,0,${(.30+litFace(LIGHT.key+Math.PI)*.12).toFixed(3)})`;
  ctx.fillRect(x,y,bw,bh/teeth*0.42);
  ctx.fillStyle='rgba(255,255,255,.17)';
  ctx.fillRect(x,y+bh/teeth*0.42,bw,bh/teeth*0.20)}
 /* chamfered outer end face catches the key light */
 const eg=ctx.createLinearGradient(x+bw*0.72,0,x+bw,0);
 eg.addColorStop(0,'rgba(255,255,255,0)');eg.addColorStop(.55,'rgba(255,255,255,.22)');
 eg.addColorStop(1,'rgba(0,0,0,.34)');
 ctx.fillStyle=eg;ctx.fillRect(x+bw*0.7,C-bh/2,bw*0.3,bh);
 /* shoulder shading down the cylinder */
 const cg=ctx.createLinearGradient(0,C-bh/2,0,C+bh/2);
 cg.addColorStop(0,'rgba(0,0,0,.30)');cg.addColorStop(.22,'rgba(255,255,255,.20)');
 cg.addColorStop(.62,'rgba(0,0,0,.06)');cg.addColorStop(1,'rgba(0,0,0,.40)');
 ctx.fillStyle=cg;ctx.fillRect(x,C-bh/2,bw,bh);
 ctx.restore();

 body();ctx.strokeStyle='rgba(0,0,0,.5)';ctx.lineWidth=1.6;ctx.stroke();
 applyFinish(ctx,m,o.finish,{mode:'linear',cx:x+bw/2,cy:C,r1:bh/2,
  x0:x,y0:C-bh/2,x1:x,y1:C+bh/2,amt:.75,grain:.6,
  box:[xT-8,C-bh/2-8,(x+bw)-xT+18,bh+16]}); ctx.restore()}
