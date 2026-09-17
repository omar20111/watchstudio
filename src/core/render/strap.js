/* Strap renderer: leather / rubber / steel bracelet / NATO.

   `flat` is the material without its painted light — no domed highlight, no
   rolled link shading, no shadow where the case overhangs — drawn much longer,
   for a 3D strap whose own curvature and the real case do that work. */
import {C,CAN,PX,METALS,STRAP_REACH_2D,STRAP_REACH_3D} from '../constants.js';
import {shade,lighten} from '../utils.js';
import {noiseFill} from '../textures.js';
import {strapEndFactor,strapTaperEnd,STRAP_TAIL_MM,STRAP_HOLES_MM} from '../geometry.js';
import {axisGrad,lineGrain,envLevel,tone} from './material.js';

export function drStrap(ctx,o){const{R,sw,lugExt}=o.g;const top=o.which==='top';const col=o.color||'#6b4a2f',st=o.stitch||'#e0cfa6',m=METALS[o.metal]||METALS.steel;
 const flat=o.mode==='flat',reach=flat?(o.strapReach||STRAP_REACH_3D):STRAP_REACH_2D;
 const y0=top?C-R*0.55:C+R*0.55, y1=top?C-reach:C+reach, dir=top?-1:1;
 /* A 3D strap (not a bracelet) is cut to the outline its mesh has: it ends at
    y1 in a tail or a squared buckle end. The 2D strap runs off the sheet under
    a rounded end nobody sees. */
 const shaped=flat&&o.variant!=='steel';
 const wAt=y=>{const p=Math.abs(y-y0)/Math.abs(y1-y0);
  return sw*(1-(1-strapTaperEnd)*p)*(shaped?strapEndFactor(o.which,Math.abs(y1-y)/PX):1)};
 const endLen=(top?2:STRAP_TAIL_MM+1)*PX;
 const path=()=>{ctx.beginPath();
  if(shaped){const ys=[];for(let i=0;i<=26;i++)ys.push(y0+(y1-dir*endLen-y0)*i/26);
   for(let i=1;i<=40;i++)ys.push(y1-dir*endLen*(1-i/40));
   ys.forEach((y,i)=>i?ctx.lineTo(C-wAt(y)/2,y):ctx.moveTo(C-wAt(y)/2,y));
   for(let i=ys.length-1;i>=0;i--)ctx.lineTo(C+wAt(ys[i])/2,ys[i]);ctx.closePath();return}
  const n=26;for(let i=0;i<=n;i++){const y=y0+(y1-y0)*i/n;const x=C-wAt(y)/2;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}
  ctx.quadraticCurveTo(C-wAt(y1)/2,y1+dir*26,C,y1+dir*26);ctx.quadraticCurveTo(C+wAt(y1)/2,y1+dir*26,C+wAt(y1)/2,y1);
  for(let i=n;i>=0;i--){const y=y0+(y1-y0)*i/n;ctx.lineTo(C+wAt(y)/2,y)}ctx.closePath()};
 /* sample a strap-long line densely where the outline turns, so it follows the tail */
 const along=(fn,from,to)=>{ctx.beginPath();const n=60;
  for(let i=0;i<=n;i++){const t=i/n,y=from+(to-from)*(shaped?1-(1-t)*(1-t):t);const x=fn(y);i?ctx.lineTo(x,y):ctx.moveTo(x,y)}};
 const yA=Math.min(y0,y1),yB=Math.max(y0,y1);
 path();

 if(o.variant==='steel'){ctx.fillStyle='#0e1013';ctx.fill();ctx.save();path();ctx.clip();
  /* Three-piece links. Each one is a little bar with a rolled top and bottom
     edge, so the row reads as a hinged component rather than a printed tile;
     the gap between rows carries the shadow the articulation would cast. */
  const pitch=36,linkH=30;
  for(let y=yA;y<yB;y+=pitch){const w=wAt(y);
   const l=envLevel(m,.08+((y-yA)/(yB-yA))*.34);
   const cell=(x,wd,pol)=>{
    ctx.beginPath();ctx.roundRect(x,y+2,wd,linkH,5);
    if(flat){ctx.fillStyle=pol?m.hi:(m.f0||m.base);ctx.fill();ctx.strokeStyle='rgba(0,0,0,.55)';ctx.lineWidth=1.4;ctx.stroke();return}
    /* across the link: dark at both rolled edges, bright over the crown */
    const g=ctx.createLinearGradient(0,y+2,0,y+2+linkH);
    const base=Math.min(1,l*(pol?1.12:.80));
    g.addColorStop(0,tone(m,Math.max(0,base*.34)));
    g.addColorStop(.20,tone(m,Math.min(1,base*1.28)));
    g.addColorStop(.58,tone(m,base));
    g.addColorStop(.88,tone(m,Math.max(0,base*.46)));
    g.addColorStop(1,tone(m,Math.max(0,base*.22)));
    ctx.fillStyle=g;ctx.fill();
    if(pol){/* polished centre link keeps a tight specular streak */
     const s=ctx.createLinearGradient(x,0,x+wd,0);
     s.addColorStop(0,'rgba(255,255,255,0)');s.addColorStop(.34,'rgba(255,255,255,.30)');
     s.addColorStop(.52,'rgba(255,255,255,.05)');s.addColorStop(1,'rgba(0,0,0,.20)');
     ctx.fillStyle=s;ctx.fill()}
    ctx.strokeStyle='rgba(0,0,0,.55)';ctx.lineWidth=1.4;ctx.stroke();
    ctx.beginPath();ctx.moveTo(x+4,y+4.2);ctx.lineTo(x+wd-4,y+4.2);
    ctx.strokeStyle='rgba(255,255,255,.30)';ctx.lineWidth=1;ctx.stroke()};
   cell(C-w/2+2,w*0.28,false);cell(C+w/2-2-w*0.28,w*0.28,false);cell(C-w*0.19,w*0.38,true);
   /* shadow in the articulation gap */
   if(flat)continue;
   const gg=ctx.createLinearGradient(0,y+2+linkH,0,y+pitch+2);
   gg.addColorStop(0,'rgba(0,0,0,.62)');gg.addColorStop(1,'rgba(0,0,0,.18)');
   ctx.fillStyle=gg;ctx.fillRect(C-w/2,y+2+linkH,w,pitch-linkH)}
  /* brushed link tops — cheap here because the strap path is already clipped */
  if(!flat){ctx.save();ctx.globalCompositeOperation='overlay';
   ctx.fillStyle=lineGrain(ctx,C-sw/2,0,C+sw/2,0,.7);ctx.fillRect(C-sw,yA,sw*2,yB-yA);ctx.restore()}
  noiseFill(ctx,.05,'overlay',.7);
  ctx.restore();}
 else{const g=ctx.createLinearGradient(C-sw/2,0,C+sw/2,0);
  if(o.variant==='rubber'){g.addColorStop(0,shade(col,.5));g.addColorStop(.15,col);g.addColorStop(.5,lighten(col,.1));g.addColorStop(.85,col);g.addColorStop(1,shade(col,.5))}
  else if(o.variant==='nato'){g.addColorStop(0,shade(col,.4));g.addColorStop(.5,col);g.addColorStop(1,shade(col,.4))}
  else{g.addColorStop(0,shade(col,.55));g.addColorStop(.1,shade(col,.12));g.addColorStop(.46,lighten(col,.16));g.addColorStop(.62,col);g.addColorStop(.9,shade(col,.2));g.addColorStop(1,shade(col,.55))}
  /* a flat strap is its dye; the rounding across its width is real geometry.
     A Milanese band is the metal itself. */
  const mesh=o.variant==='mesh';
  ctx.fillStyle=mesh?(flat?(m.f0||m.base):axisGrad(ctx,m,C-sw/2,0,C+sw/2,0)):flat?col:g;ctx.fill();
  ctx.save();path();ctx.clip();
  /* Milanese: a fine diagonal weave, crossed rows of tiny loops */
  if(mesh){ctx.lineWidth=1;const pitch=5;
   for(let k=-sw;k<(yB-yA)+sw;k+=pitch){ctx.beginPath();ctx.moveTo(C-sw,yA+k);ctx.lineTo(C+sw,yA+k+sw*2);
    ctx.strokeStyle=`rgba(0,0,0,${flat?.1:.18})`;ctx.stroke();
    ctx.beginPath();ctx.moveTo(C+sw,yA+k);ctx.lineTo(C-sw,yA+k+sw*2);ctx.strokeStyle=`rgba(255,255,255,${flat?.06:.12})`;ctx.stroke()}
   /* the two edges are folded over: a polished roll down each side */
   for(const s of[-1,1]){along(y=>C+s*Math.max(0,wAt(y)/2-3),y0-dir*20,y1);ctx.strokeStyle=flat?m.hi:tone(m,.9);ctx.lineWidth=5;ctx.stroke()}}
  if(o.variant==='leather'){
   /* coarse mottle for the hide, fine grain on top of it */
   noiseFill(ctx,.22,'multiply',3.2);noiseFill(ctx,.10,'overlay',.9);
   /* the strap is domed — a soft crown highlight down its length */
   if(!flat){const cg=ctx.createLinearGradient(C-sw/2,0,C+sw/2,0);
    cg.addColorStop(0,'rgba(255,255,255,0)');cg.addColorStop(.42,'rgba(255,255,255,.13)');
    cg.addColorStop(.58,'rgba(255,255,255,.05)');cg.addColorStop(1,'rgba(0,0,0,.16)');
    ctx.fillStyle=cg;ctx.fillRect(C-sw,yA,sw*2,yB-yA)}
   /* burnished edges */
   for(const s of[-1,1]){along(y=>C+s*Math.max(0,wAt(y)/2-2),y0-dir*20,y1);
    ctx.strokeStyle=shade(col,.6);ctx.lineWidth=5;ctx.stroke()}
   /* stitches sit in a recessed channel; round a tail the two rows meet */
   for(const s of[-1,1]){const line=inset=>along(y=>C+s*Math.max(0,wAt(y)/2-inset),y0+dir*6,y1-dir*(shaped?22:4));
    ctx.setLineDash([]);line(12);ctx.strokeStyle='rgba(0,0,0,.35)';ctx.lineWidth=7;ctx.stroke();
    /* the 3D strap lays thread in the channel (watch.js strapStitches) */
    if(flat)continue;
    ctx.setLineDash([11,9]);ctx.lineCap='round';
    line(12);ctx.strokeStyle=shade(st,.45);ctx.lineWidth=4;ctx.stroke();
    line(12.6);ctx.strokeStyle=st;ctx.lineWidth=2.6;ctx.stroke()}
   ctx.setLineDash([]);ctx.fillStyle=shade(col,.35);ctx.fillRect(C-sw/2,top?y0+dir*44:y0+dir*44-26,sw,26);}
  if(o.variant==='rubber'){noiseFill(ctx,.07,'overlay',.55);
   for(const s of[-1,1]){ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(C+s*sw*0.16-3,yA,6,yB-yA);ctx.fillStyle='rgba(255,255,255,.07)';ctx.fillRect(C+s*sw*0.16+3,yA,2,yB-yA)}
   if(!flat){const rg=ctx.createLinearGradient(C-sw/2,0,C+sw/2,0);
    rg.addColorStop(0,'rgba(255,255,255,0)');rg.addColorStop(.38,'rgba(255,255,255,.09)');rg.addColorStop(1,'rgba(0,0,0,.18)');
    ctx.fillStyle=rg;ctx.fillRect(C-sw,yA,sw*2,yB-yA)}}
  if(o.variant==='nato'){noiseFill(ctx,.20,'overlay',.8);
   /* webbing weave */
   ctx.save();ctx.globalAlpha=.16;for(let y=yA;y<yB;y+=7){ctx.fillStyle=y%14<7?'#ffffff':'#000000';ctx.fillRect(C-sw/2,y,sw,3.5)}ctx.restore();
   /* the tall flat canvas starts above the sheet, so stripe the strap's own span */
   for(const s of[-1,1]){ctx.fillStyle=st;if(flat)ctx.fillRect(C+s*sw*0.2-sw*0.065,yA-40,sw*0.13,yB-yA+80);else ctx.fillRect(C+s*sw*0.2-sw*0.065,0,sw*0.13,CAN)}
   for(const off of[36,74]){const y=top?y0-dir*off:y0+dir*off-14;ctx.fillStyle=flat?(m.f0||m.base):axisGrad(ctx,m,0,y,0,y+14);ctx.fillRect(C-sw/2-6,y,sw+12,14)}}
  /* the holes down the 6 o'clock strap: dark wells with a pressed rim, painted
     through both faces as a punched hole would show. A NATO's are eyelets. */
  if(shaped&&!top&&!mesh)for(const mm of STRAP_HOLES_MM){const y=y1-dir*mm*PX,r=(o.variant==='nato'?.7:.78)*PX;
   ctx.beginPath();ctx.arc(C,y,r+(o.variant==='nato'?4:2.5),0,Math.PI*2);
   ctx.fillStyle=o.variant==='nato'?(flat?(m.f0||m.base):m.base):shade(col,o.variant==='rubber'?.3:.45);ctx.fill();
   const hg=ctx.createRadialGradient(C,y-r*.25,r*.1,C,y,r);
   hg.addColorStop(0,'#050404');hg.addColorStop(.75,'#0d0a08');hg.addColorStop(1,shade(col,.7));
   ctx.beginPath();ctx.arc(C,y,r,0,Math.PI*2);ctx.fillStyle=hg;ctx.fill()}
  ctx.restore();}
 if(flat)return;
 /* the case overhangs the strap where it enters the lugs — without this the
    strap reads as sliding past the case instead of under it */
 ctx.save();path();ctx.clip();
 const ys=C+dir*R*0.80,ye=C+dir*(R+lugExt*1.3);
 const sg=ctx.createLinearGradient(0,ys,0,ye);
 sg.addColorStop(0,'rgba(0,0,0,.60)');sg.addColorStop(.40,'rgba(0,0,0,.30)');
 sg.addColorStop(1,'rgba(0,0,0,0)');
 ctx.fillStyle=sg;ctx.fillRect(C-sw,Math.min(ys,ye),sw*2,Math.abs(ye-ys));
 ctx.restore();
 path();ctx.strokeStyle='rgba(0,0,0,.45)';ctx.lineWidth=2.5;ctx.stroke();}
