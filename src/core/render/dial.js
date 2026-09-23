/* Dial renderer: sunburst / matte / chrono / guilloché / fumé / enamel /
   tapisserie / sculpted + track + text. */
import {C,PX} from '../constants.js';
import {lumOf,lighten,shade} from '../utils.js';
import {posAt,MINUTE_TRACK_R,TRACK_TICK_PX,DIAL_MM} from '../geometry.js';
import {noiseFill} from '../textures.js';
import {circGrain,SHADOW} from './material.js';

/* The date wheel under the dial plate, in its own frame. Day k sits at the
   window angle plus (k-1) steps and is pre-rotated by the same amount: when the
   wheel turns back by (day-1) steps the day under the window reads upright. */
const WHEEL_STEP=360/31;
function drDateWheel(ctx,o){const L=o.layout,win=L&&L.win;if(!win)return;
 const dark=lumOf(o.color||'#16324f')<.5,paper=dark?'#131417':'#f2efe7',ink=dark?'#e9e6dc':'#1b1c1f';
 const cr=Math.hypot(win.x-C,win.y-C),span=Math.hypot(win.w,win.h)/2+win.frame*3;
 /* two separate subpaths: arcs chained in one path are joined by a straight
    line, which cut a wedge out of the ring right where a 4:30 window looks */
 ctx.save();ctx.beginPath();ctx.arc(C,C,cr+span,0,Math.PI*2);ctx.closePath();
 ctx.moveTo(C+Math.max(0,cr-span),C);ctx.arc(C,C,Math.max(0,cr-span),0,Math.PI*2);ctx.closePath();
 ctx.fillStyle=paper;ctx.fill('evenodd');
 ctx.fillStyle=ink;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`700 ${win.h*.72}px system-ui`;
 for(let k=1;k<=31;k++){const a=win.deg+(k-1)*WHEEL_STEP,[x,y]=posAt(a,cr);
  ctx.save();ctx.translate(x,y);ctx.rotate((k-1)*WHEEL_STEP*Math.PI/180);ctx.fillText(String(k),0,win.h*.04);ctx.restore()}
 ctx.restore()}

const roundRect=(ctx,x,y,w,h,rr)=>{ctx.beginPath();ctx.roundRect(x-w/2,y-h/2,w,h,rr)};

/* A sculpted dial's plates. Bands sweeping across the face, all struck on one
   centre well outside it, each standing over the plate below with a channel of
   fine ribs along its upper edge — an architect's dial rather than a printed
   one. The bands are described once, in sheet px, and used twice: the artwork
   paints them, and the shape bake raises the same outlines into real plates
   (three/watch.js), so the metal and the picture on it cannot drift apart. */
export function sculptedPlates(r){
 const P={x:C-r*1.28,y:C+r*1.62};                  /* the centre they curve about */
 return[0,1,2].map(i=>({P,R:r*(1.42+i*.74),w:r*(.52-i*.05),rib:r*.105}))}
const plateRing=(ctx,P,Ro,Ri)=>{ctx.beginPath();ctx.arc(P.x,P.y,Ro,0,Math.PI*2);
 ctx.arc(P.x,P.y,Math.max(0,Ri),0,Math.PI*2,true);ctx.closePath()};
/* the ribs across a channel: struck from the same centre, so they stand square
   to the band however it curves */
function ribs(ctx,P,Ro,Ri,col,r){const mid=(Ro+Ri)/2,step=Math.max(.5,DIAL_MM.rib)*PX/mid;
 ctx.save();ctx.strokeStyle=col;ctx.lineWidth=Math.max(1,DIAL_MM.rib*PX*.52);ctx.lineCap='butt';
 for(let a=0;a<Math.PI*2;a+=step){const c=Math.cos(a),si=Math.sin(a);
  ctx.beginPath();ctx.moveTo(P.x+c*Ri,P.y+si*Ri);ctx.lineTo(P.x+c*Ro,P.y+si*Ro);ctx.stroke()}
 ctx.restore()}

/* the apertures a plate must not cover: a date window and any register */
function cutApertures(ctx,L){ctx.save();ctx.globalCompositeOperation='destination-out';ctx.fillStyle='#000';
 for(const sd of (L&&L.subdials)||[]){ctx.beginPath();ctx.arc(sd.x,sd.y,sd.r+2,0,Math.PI*2);ctx.fill()}
 if(L&&L.win){const w=L.win;roundRect(ctx,w.x,w.y,w.w+2*w.frame+4,w.h+2*w.frame+4,w.rad+w.frame);ctx.fill()}
 ctx.restore()}

/* the plates as a white silhouette for tracing: each band solid, its rib
   channel cut back out of it, and the ribs themselves standing in the channel */
function sculptedShape(ctx,o,r){const L=o.layout;
 ctx.save();dialClip(ctx,r,o.edge);
 for(const b of sculptedPlates(r)){
  ctx.fillStyle='#fff';plateRing(ctx,b.P,b.R,b.R-b.w);ctx.fill('evenodd');
  ctx.save();ctx.globalCompositeOperation='destination-out';ctx.fillStyle='#000';
  plateRing(ctx,b.P,b.R,b.R-b.rib);ctx.fill('evenodd');ctx.restore();
  ribs(ctx,b.P,b.R-PX*.06,b.R-b.rib+PX*.06,'#fff',r)}
 cutApertures(ctx,L);
 ctx.restore()}

/* one tapisserie pyramid, in sheet px: a little over a millimetre on a 40 mm
   watch. Shared with the 3D dial, whose normal map is laid on the same grid. */
export const tapisserieCell=()=>DIAL_MM.tapisserie*PX;

/* A register's hour scale: twelve ticks round its edge. */
function registerScale(ctx,sd,ink){const{x,y,r:rs}=sd;
 for(let i=0;i<12;i++){const a=i*30*Math.PI/180;ctx.beginPath();ctx.moveTo(x+Math.sin(a)*rs*0.86,y-Math.cos(a)*rs*0.86);ctx.lineTo(x+Math.sin(a)*rs*0.72,y-Math.cos(a)*rs*0.72);ctx.strokeStyle=ink;ctx.lineWidth=1.5;ctx.stroke()}}

/* The minute track: 60 ticks ending on the track ring, the fives longer. `ink`
   overrides the printed tint (null keeps it). */
/* the dial as a clip: its circle, or on a dial of the case's shape (geometry.js
   dialEdgeOf) its edge, a hair beyond so the flange's foot meets painted ground */
const dialClip=(ctx,r,edge)=>{ctx.beginPath();
 if(!edge)ctx.arc(C,C,r,0,7);
 else{for(let i=0;i<=180;i++){const[x,y]=posAt(i*2,edge(i*2)+3);i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath()}
 ctx.clip()};

/* the minute track: on a shaped dial each tick keeps its place relative to the
   edge at its own angle, so the track runs round the dial's shape */
function printTrack(ctx,r,trackIn,ink,edge=null){
 for(let i=0;i<60;i++){const a=i*6,R=(edge?edge(a):r)*MINUTE_TRACK_R;const len=Math.min(i%5?TRACK_TICK_PX.minor:TRACK_TICK_PX.major,R-trackIn);const[x0,y0]=posAt(a,R),[x1,y1]=posAt(a,R-len);
  ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.strokeStyle=ink||`rgba(235,236,240,${i%5?0.55:0.85})`;ctx.lineWidth=i%5?1.5:2.5;ctx.stroke()}}

/* The brand and the model line. style: 'lit' pad printing with its hairline
   shadow and lit edge, 'flat' the ink alone, 'ink' solid white for tracing. */
export function printText(ctx,o,r,col,style){const t=o.text;if(!t||!(t.top||t.bottom))return;
 const inkCol=style==='ink'?'#fff':t.color==='auto'?(lumOf(col)>0.55?'#26282c':'#e9e4d6'):t.color,lit=style==='lit';
 ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
 const fnt=fs=>t.font==='serif'?`${fs}px Georgia, serif`:`600 ${fs}px system-ui`;
 try{ctx.letterSpacing=t.font==='caps'?'4px':'1px'}catch(e){}
 /* pad printing sits proud of the dial: a hairline shadow under it and a lit
    top edge, so the branding reads as applied ink rather than a text layer */
 const line=(s,{size,y:yy,maxW})=>{let fs=size;ctx.font=fnt(fs);
  /* Arabic is a joined script: letter spacing pulls its letters apart */
  if(/[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/.test(s))try{ctx.letterSpacing='0px'}catch(e){}
  /* printed at its size in mm, smaller only if the dial has no room for it */
  const wd=ctx.measureText(s).width;if(wd>maxW){fs*=maxW/wd;ctx.font=fnt(fs)}
  if(lit){ctx.fillStyle='rgba(0,0,0,.34)';ctx.fillText(s,C+SHADOW.dx*fs*0.07,yy+SHADOW.dy*fs*0.07)}
  ctx.fillStyle=inkCol;ctx.fillText(s,C,yy);
  if(lit){ctx.fillStyle='rgba(255,255,255,.16)';ctx.fillText(s,C-SHADOW.dx*fs*0.03,yy-SHADOW.dy*fs*0.03)}};
 /* sizes and places from geometry.js dialTextOf, handed in by procOpts */
 const T=DIAL_MM.text,TX=o.printing||{brand:{size:T.brand*PX,y:C-r*.4,maxW:r*1.1},line:{size:T.line*PX,y:C+r*.46,maxW:r}};
 if(t.top)line(t.font==='caps'?t.top.toUpperCase():t.top,TX.brand);
 if(t.bottom)line(t.font==='caps'?t.bottom.toUpperCase():t.bottom,TX.line);
 try{ctx.letterSpacing='0px'}catch(e){}
 ctx.restore()}

export function drDial(ctx,o){const r=o.g.dialR;const col=o.color||'#16324f';
 const W=ctx.canvas.width,H=ctx.canvas.height,L=o.layout||{};
 if(o.which==='dateWheel')return drDateWheel(ctx,o);
 /* ink: one printed layer alone, in solid white on nothing, to be traced into
    vector artwork (export/artwork.js): o.ink is 'text' (the brand and the model
    line) or 'track' (the minute track and the registers' scales) */
 if(o.mode==='shape'){if(o.variant==='sculpted')sculptedShape(ctx,o,r);return}
 if(o.mode==='ink'){
  if(o.ink==='text')printText(ctx,o,r,col,'ink');
  else if(o.ink==='track'){printTrack(ctx,r,L.stepped?L.stepR+3:0,'#fff',o.edge);for(const sd of L.subdials||[])registerScale(ctx,sd,'#fff')}
  return}
 /* flat: pigment and printing only. The sunburst sweep and its spokes, the
    guilloché's rings, a brushed grain, the highlight, the edge vignette and the
    text emboss are all light, and 3D lighting supplies them from the real
    surface (an anisotropy or a normal map) — painting them too would light the
    dial twice and leave lines that stay put as the watch turns. */
 const flat=o.mode==='flat';
 /* a background picture (core/dialbg.js) is the plate's ground in the 3D
    texture: the colour and the pattern are left out, the printing stays */
 const ground=!(flat&&o.bgOn);
 ctx.save();dialClip(ctx,r,o.edge);
 if(ground){ctx.fillStyle=col;ctx.fillRect(0,0,W,H)}

 if(ground&&o.variant==='sunburst'){if(!flat&&ctx.createConicGradient){const g=ctx.createConicGradient(0.8,C,C);
   const st=[[0,'rgba(255,255,255,.20)'],[.25,'rgba(0,0,0,.16)'],[.5,'rgba(255,255,255,.20)'],[.75,'rgba(0,0,0,.16)'],[1,'rgba(255,255,255,.20)']];
   st.forEach(s=>g.addColorStop(...s));ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}
  if(!flat)for(let i=0;i<240;i++){const a=i*1.5*Math.PI/180;ctx.beginPath();ctx.moveTo(C,C);ctx.lineTo(C+r*Math.sin(a),C-r*Math.cos(a));
   ctx.strokeStyle=`rgba(255,255,255,${i%2?0.015:0.03})`;ctx.lineWidth=1;ctx.stroke()}}

 if(ground&&o.variant==='fume'){const fg=ctx.createRadialGradient(C,C,0,C,C,r);
  fg.addColorStop(0,lighten(col,.30));fg.addColorStop(.42,col);
  fg.addColorStop(.78,shade(col,.55));fg.addColorStop(1,shade(col,.84));
  ctx.fillStyle=fg;ctx.fillRect(0,0,W,H)}

 if(ground&&o.variant==='guilloche'&&!flat){
  /* engine turning: regular rings crossed by fine spokes reads as hobnail */
  const n=Math.max(18,Math.round(r/5.5)),rg=ctx.createRadialGradient(C,C,0,C,C,r);
  for(let i=0;i<=n;i++)rg.addColorStop(i/n,i%2?'rgba(255,255,255,.11)':'rgba(0,0,0,.14)');
  ctx.fillStyle=rg;ctx.fillRect(0,0,W,H);
  ctx.lineWidth=1;
  for(let i=0;i<200;i++){const a=i*1.8*Math.PI/180;ctx.beginPath();ctx.moveTo(C,C);
   ctx.lineTo(C+r*Math.sin(a),C-r*Math.cos(a));
   ctx.strokeStyle=i%2?'rgba(255,255,255,.055)':'rgba(0,0,0,.07)';ctx.stroke()}
  const cg=ctx.createRadialGradient(C,C,0,C,C,r*.18);
  cg.addColorStop(0,'rgba(0,0,0,.22)');cg.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=cg;ctx.fillRect(0,0,W,H)}

 /* grand feu enamel: one deep, even glaze. Its depth is the gloss the 3D
    material gives it; the 2D drawing only suggests the pool of light in it */
 if(ground&&o.variant==='enamel'&&!flat){const eg=ctx.createRadialGradient(C,C-r*.25,0,C,C,r);
  eg.addColorStop(0,lighten(col,.07));eg.addColorStop(.7,col);eg.addColorStop(1,shade(col,.12));
  ctx.fillStyle=eg;ctx.fillRect(0,0,W,H)}

 /* tapisserie: a grid of small square pyramids. The grooves between them are
    ink in every mode; the lit and shaded facets are light, painted only for the
    2D drawing — in 3D a normal map on the same grid does that */
 if(ground&&o.variant==='tapisserie'){const cell=tapisserieCell(r);
  const n=Math.ceil(r/cell)+1;
  if(!flat)for(let i=-n;i<n;i++)for(let j=-n;j<n;j++){const x=C+i*cell,y=C+j*cell;
   ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+cell,y);ctx.lineTo(x+cell/2,y+cell/2);ctx.closePath();ctx.fillStyle='rgba(255,255,255,.09)';ctx.fill();
   ctx.beginPath();ctx.moveTo(x,y+cell);ctx.lineTo(x+cell,y+cell);ctx.lineTo(x+cell/2,y+cell/2);ctx.closePath();ctx.fillStyle='rgba(0,0,0,.12)';ctx.fill()}
  ctx.strokeStyle=flat?'rgba(0,0,0,.2)':'rgba(0,0,0,.28)';ctx.lineWidth=Math.max(1,cell*.1);
  for(let i=-n;i<=n;i++){ctx.beginPath();ctx.moveTo(C+i*cell,C-r);ctx.lineTo(C+i*cell,C+r);ctx.stroke();
   ctx.beginPath();ctx.moveTo(C-r,C+i*cell);ctx.lineTo(C+r,C+i*cell);ctx.stroke()}}

 /* sculpted: the plates in their own shades of the dial's colour, their ribbed
    channels in the accent metal. The plate edges' light and shadow are painted
    only for the 2D drawing; in 3D the plates are real and the studio lights
    them. */
 if(ground&&o.variant==='sculpted'){const A=o.accent||'#b5a24a';
  for(let i=0;i<3;i++){const b=sculptedPlates(r)[i];
   ctx.fillStyle=i===1?shade(col,.14):lighten(col,.07+i*.10);plateRing(ctx,b.P,b.R,b.R-b.w);ctx.fill('evenodd');
   if(!flat){ctx.strokeStyle='rgba(255,255,255,.22)';ctx.lineWidth=Math.max(1,PX*.06);
    ctx.beginPath();ctx.arc(b.P.x,b.P.y,b.R-b.w,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle='rgba(0,0,0,.30)';ctx.lineWidth=Math.max(1,PX*.10);
    ctx.beginPath();ctx.arc(b.P.x,b.P.y,b.R-b.w-PX*.09,0,Math.PI*2);ctx.stroke()}
   /* the channel floor, then the ribs standing in it */
   ctx.fillStyle=shade(col,.45);plateRing(ctx,b.P,b.R,b.R-b.rib);ctx.fill('evenodd');
   ribs(ctx,b.P,b.R-PX*.06,b.R-b.rib+PX*.06,A,r);
   if(!flat){ctx.save();ctx.globalCompositeOperation='multiply';
    plateRing(ctx,b.P,b.R,b.R-b.rib);ctx.fillStyle='rgba(0,0,0,.18)';ctx.fill('evenodd');ctx.restore()}}}

 if(ground&&(o.variant==='matte'||o.variant==='chrono'))noiseFill(ctx,.07,'overlay');
 if(o.finish==='brushed'&&!flat){ctx.save();ctx.globalCompositeOperation='overlay';
  ctx.fillStyle=circGrain(ctx,0,r,.8);ctx.fillRect(0,0,W,H);ctx.restore()}
 if(o.finish==='matte')noiseFill(ctx,.10,'overlay',.8);

 if(!flat&&o.finish!=='matte'){let g=ctx.createRadialGradient(C-r*0.4,C-r*0.42,0,C-r*0.4,C-r*0.42,r*1.5);
  g.addColorStop(0,`rgba(255,255,255,${o.finish==='polished'?.22:.15})`);g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}
 if(!flat){let g=ctx.createRadialGradient(C,C,r*0.62,C,C,r);
  g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.34)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}

 /* the registers where the layout (and the 3D plate) puts them */
 if(o.variant==='chrono'&&L){for(const sd of L.subdials||[]){const{x,y,deg}=sd,rs=sd.r;
  /* sub-dials are milled into the dial plate: a shadowed wall on the light side
     and a lit wall opposite is what gives them their depth */
  if(!flat){const wall=ctx.createRadialGradient(x,y,rs*0.72,x,y,rs*1.06);
   wall.addColorStop(0,'rgba(0,0,0,0)');wall.addColorStop(1,'rgba(0,0,0,.34)');
   ctx.beginPath();ctx.arc(x,y,rs*1.06,0,7);ctx.fillStyle=wall;ctx.fill()}
  ctx.beginPath();ctx.arc(x,y,rs,0,7);ctx.fillStyle='rgba(0,0,0,.3)';ctx.fill();
  if(!flat){const lip=ctx.createLinearGradient(x-rs,y-rs,x+rs,y+rs);
   lip.addColorStop(0,'rgba(0,0,0,.5)');lip.addColorStop(.5,'rgba(255,255,255,.10)');
   lip.addColorStop(1,'rgba(255,255,255,.34)');
   ctx.beginPath();ctx.arc(x,y,rs,0,7);ctx.strokeStyle=lip;ctx.lineWidth=2.4;ctx.stroke()}
  /* snailed sub-dial — painted for the 2D drawing; in 3D the grooves are a normal
     map on a register milled into the plate, which catches real light */
  if(!flat){const sg=ctx.createRadialGradient(x,y,0,x,y,rs);
   for(let i=0;i<=14;i++)sg.addColorStop(i/14,i%2?'rgba(255,255,255,.05)':'rgba(0,0,0,.06)');
   ctx.beginPath();ctx.arc(x,y,rs,0,7);ctx.fillStyle=sg;ctx.fill()}
  registerScale(ctx,sd,'rgba(240,240,245,.7)');
  /* the register hands: painted for the 2D drawing, real meshes in 3D */
  if(!flat){const ha=(deg+140)*Math.PI/180;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.sin(ha)*rs*0.7,y-Math.cos(ha)*rs*0.7);ctx.strokeStyle='rgba(240,240,245,.85)';ctx.lineWidth=2;ctx.stroke();
   ctx.beginPath();ctx.arc(x,y,2.5,0,7);ctx.fillStyle='#e8e8ea';ctx.fill()}}}

 printText(ctx,o,r,col,flat?'flat':'lit');

 /* on a stepped dial the minute track lives on the chapter ring, outside the step */
 const trackIn=L.stepped?L.stepR+3:0;
 if(L.stepped&&!flat){/* 2D: the step's shadowed wall and lit lip */
  ctx.beginPath();ctx.arc(C,C,L.stepR,0,7);ctx.strokeStyle='rgba(0,0,0,.30)';ctx.lineWidth=3;ctx.stroke();
  ctx.beginPath();ctx.arc(C,C,L.stepR+2,0,7);ctx.strokeStyle='rgba(255,255,255,.16)';ctx.lineWidth=1.2;ctx.stroke()}
 printTrack(ctx,r,trackIn,null,o.edge);
 /* the date window, painted: in 3D it is an aperture onto a real wheel */
 if(L.win&&!flat){const w=L.win,dark=lumOf(col)<.5;
  roundRect(ctx,w.x,w.y,w.w+w.frame*2,w.h+w.frame*2,w.rad+w.frame);ctx.fillStyle='rgba(205,208,214,.95)';ctx.fill();
  roundRect(ctx,w.x,w.y,w.w,w.h,w.rad);ctx.fillStyle=dark?'#131417':'#f2efe7';ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.35)';ctx.lineWidth=1.2;ctx.stroke();
  ctx.fillStyle=dark?'#e9e6dc':'#1b1c1f';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font=`700 ${w.h*.72}px system-ui`;ctx.fillText(String(o.day||1),w.x,w.y+w.h*.04)}
 ctx.beginPath();ctx.arc(C,C,DIAL_MM.pinion*PX,0,7);ctx.fillStyle='rgba(0,0,0,.55)';ctx.fill();
 ctx.restore();}
