/* Hour markers: batons / dots / roman / arabic / minimal.

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
import {posAt} from '../geometry.js';
import {tone,litFace,castShadow,SHADOW} from './material.js';

/* recessed lume: bright where the wall catches light, shadowed under the far lip */
function lumeInset(ctx,w,h,lum){const g=ctx.createLinearGradient(0,-h/2,0,h/2);
 g.addColorStop(0,shade(lum,.30));g.addColorStop(.16,lum);
 g.addColorStop(.80,lum);g.addColorStop(1,'rgba(255,255,255,.42)');
 ctx.fillStyle=g;ctx.fillRect(-w/2,-h/2,w,h);
 ctx.strokeStyle='rgba(0,0,0,.30)';ctx.lineWidth=1;ctx.strokeRect(-w/2,-h/2,w,h)}

export function drMarkers(ctx,o){const r=o.g.dialR;const lum=o.lume||'#dff3e4';const rad=r*0.8;
 const m=METALS[o.frameMetal]||METALS.steel;
 const ink=lumOf(o.dialColor||'#16324f')>0.55?'#26282c':'#e9e4d6';
 const shape=o.mode==='shape',lumeOnly=o.mode==='lume';
 ctx.textAlign='center';ctx.textBaseline='middle';

 for(let h=0;h<12;h++){const deg=h*30,rad0=deg*Math.PI/180;const[x,y]=posAt(deg,rad);

  if(o.variant==='batons'||o.variant==='minimal'){
   const mini=o.variant==='minimal';
   if(mini&&h%3)continue;
   const len=r*(mini?0.075:0.17),w=r*(mini?0.055:0.052);
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
   const rr=r*0.052;
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

  else if(o.variant==='roman'||o.variant==='arabic'){
   if(lumeOnly)continue;                           /* applied numerals carry no lume */
   const RN=['XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI'];
   const txt=o.variant==='roman'?RN[h]:String(h===0?12:h);
   ctx.font=o.variant==='roman'?`${r*0.17}px Georgia, serif`:`700 ${r*0.19}px system-ui`;
   if(shape){ctx.fillStyle='#fff';ctx.fillText(txt,x,y);continue}
   /* applied numerals: a dark impression, then the metal face slightly proud */
   ctx.fillStyle='rgba(0,0,0,.34)';
   ctx.fillText(txt,x+SHADOW.dx*r*0.012,y+SHADOW.dy*r*0.012);
   ctx.fillStyle=o.frameMetal?tone(m,litFace(rad0-Math.PI/2)*0.5+0.42):ink;
   ctx.fillText(txt,x,y);
   ctx.fillStyle='rgba(255,255,255,.22)';
   ctx.fillText(txt,x-SHADOW.dx*r*0.004,y-SHADOW.dy*r*0.004)}}}
