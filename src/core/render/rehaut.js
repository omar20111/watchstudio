/* Rehaut — the angled flange between the bezel's inner edge and the dial.

   It is a cone sloping inward and down, so unlike the case chamfer it catches
   the key light on the FAR side. That inversion is the strongest single depth
   cue in a top-down watch photograph, and it is why the dial reads as sunk
   inside the case rather than printed level with the bezel.

   Drawn from the case's material; it is part of the case, not a separate
   user-editable component. */
import {C,METALS} from '../constants.js';
import {bevelGrad,ringPath,circGrain,seam} from './material.js';

export function drRehaut(ctx,o){const{rBezIn,dialR,rehautW}=o.g;
 if(rehautW<=1.5)return;
 const m=METALS[o.metal]||METALS.steel;
 const rIn=dialR-1.5;

 ctx.save();ringPath(ctx,C,C,rBezIn,rIn);ctx.clip();
 ctx.fillStyle=bevelGrad(ctx,m,C,C,{facing:'in',lo:.05,hi:1,tight:1.35,bias:.02});
 ctx.fillRect(C-rBezIn-2,C-rBezIn-2,rBezIn*2+4,rBezIn*2+4);
 /* the slope darkens toward the dial — it is falling away from the light */
 const sl=ctx.createRadialGradient(C,C,rIn,C,C,rBezIn);
 sl.addColorStop(0,'rgba(0,0,0,.42)');sl.addColorStop(.45,'rgba(0,0,0,.10)');
 sl.addColorStop(1,'rgba(255,255,255,.07)');
 ctx.fillStyle=sl;ctx.fillRect(C-rBezIn-2,C-rBezIn-2,rBezIn*2+4,rBezIn*2+4);
 if(o.finish==='brushed'){ctx.save();ctx.globalCompositeOperation='overlay';
  ctx.fillStyle=circGrain(ctx,rIn,rBezIn,.75);
  ctx.fillRect(C-rBezIn,C-rBezIn,rBezIn*2,rBezIn*2);ctx.restore()}
 ctx.restore();

 /* hairline where the flange meets the bezel, and the shadow it throws across
    the outer edge of the dial */
 seam(ctx,C,C,rBezIn-0.5,{dark:.34,lite:.22,w:1.6,side:-1});
 ctx.save();ctx.beginPath();ctx.arc(C,C,rIn+2,0,7);ctx.clip();
 const dg=ctx.createRadialGradient(C,C,rIn*0.9,C,C,rIn+2);
 dg.addColorStop(0,'rgba(0,0,0,0)');dg.addColorStop(1,'rgba(0,0,0,.34)');
 ctx.fillStyle=dg;ctx.fillRect(C-rIn-4,C-rIn-4,rIn*2+8,rIn*2+8);ctx.restore()}
