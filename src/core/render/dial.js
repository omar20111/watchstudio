/* Dial renderer: sunburst / matte / chrono / guilloché / fumé + track + text. */
import {C} from '../constants.js';
import {lumOf,lighten,shade} from '../utils.js';
import {posAt} from '../geometry.js';
import {noiseFill} from '../textures.js';
import {circGrain,SHADOW} from './material.js';

export function drDial(ctx,o){const r=o.g.dialR;const col=o.color||'#16324f';
 const W=ctx.canvas.width,H=ctx.canvas.height;
 /* flat: pigment and printing only. The sunburst sweep, the highlight, the edge
    vignette and the text emboss are all light, and 3D lighting supplies them
    from the real surface — painting them too would light the dial twice. */
 const flat=o.mode==='flat';
 ctx.save();ctx.beginPath();ctx.arc(C,C,r,0,7);ctx.clip();
 ctx.fillStyle=col;ctx.fillRect(0,0,W,H);

 if(o.variant==='sunburst'){if(!flat&&ctx.createConicGradient){const g=ctx.createConicGradient(0.8,C,C);
   const st=[[0,'rgba(255,255,255,.20)'],[.25,'rgba(0,0,0,.16)'],[.5,'rgba(255,255,255,.20)'],[.75,'rgba(0,0,0,.16)'],[1,'rgba(255,255,255,.20)']];
   st.forEach(s=>g.addColorStop(...s));ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}
  for(let i=0;i<240;i++){const a=i*1.5*Math.PI/180;ctx.beginPath();ctx.moveTo(C,C);ctx.lineTo(C+r*Math.sin(a),C-r*Math.cos(a));
   ctx.strokeStyle=`rgba(255,255,255,${i%2?0.015:0.03})`;ctx.lineWidth=1;ctx.stroke()}}

 if(o.variant==='fume'){const fg=ctx.createRadialGradient(C,C,0,C,C,r);
  fg.addColorStop(0,lighten(col,.30));fg.addColorStop(.42,col);
  fg.addColorStop(.78,shade(col,.55));fg.addColorStop(1,shade(col,.84));
  ctx.fillStyle=fg;ctx.fillRect(0,0,W,H)}

 if(o.variant==='guilloche'){
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

 if(o.variant==='matte'||o.variant==='chrono')noiseFill(ctx,.07,'overlay');
 if(o.finish==='brushed'){ctx.save();ctx.globalCompositeOperation='overlay';
  ctx.fillStyle=circGrain(ctx,0,r,.8);ctx.fillRect(0,0,W,H);ctx.restore()}
 if(o.finish==='matte')noiseFill(ctx,.10,'overlay',.8);

 if(!flat&&o.finish!=='matte'){let g=ctx.createRadialGradient(C-r*0.4,C-r*0.42,0,C-r*0.4,C-r*0.42,r*1.5);
  g.addColorStop(0,`rgba(255,255,255,${o.finish==='polished'?.22:.15})`);g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}
 if(!flat){let g=ctx.createRadialGradient(C,C,r*0.62,C,C,r);
  g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.34)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}

 if(o.variant==='chrono'){for(const deg of[90,180,270]){const[x,y]=posAt(deg,r*0.45),rs=r*0.2;
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
  /* snailed sub-dial */
  const sg=ctx.createRadialGradient(x,y,0,x,y,rs);
  for(let i=0;i<=14;i++)sg.addColorStop(i/14,i%2?'rgba(255,255,255,.05)':'rgba(0,0,0,.06)');
  ctx.beginPath();ctx.arc(x,y,rs,0,7);ctx.fillStyle=sg;ctx.fill();
  for(let i=0;i<12;i++){const a=i*30*Math.PI/180;ctx.beginPath();ctx.moveTo(x+Math.sin(a)*rs*0.86,y-Math.cos(a)*rs*0.86);ctx.lineTo(x+Math.sin(a)*rs*0.72,y-Math.cos(a)*rs*0.72);ctx.strokeStyle='rgba(240,240,245,.7)';ctx.lineWidth=1.5;ctx.stroke()}
  /* the register hands: painted for the 2D drawing, real meshes in 3D */
  if(!flat){const ha=(deg+140)*Math.PI/180;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.sin(ha)*rs*0.7,y-Math.cos(ha)*rs*0.7);ctx.strokeStyle='rgba(240,240,245,.85)';ctx.lineWidth=2;ctx.stroke();
   ctx.beginPath();ctx.arc(x,y,2.5,0,7);ctx.fillStyle='#e8e8ea';ctx.fill()}}}

 if(o.text&&(o.text.top||o.text.bottom)){const t=o.text;
  const ink=t.color==='auto'?(lumOf(col)>0.55?'#26282c':'#e9e4d6'):t.color;
  ctx.textAlign='center';ctx.textBaseline='middle';
  const fnt=fs=>t.font==='serif'?`${fs}px Georgia, serif`:`600 ${fs}px system-ui`;
  try{ctx.letterSpacing=t.font==='caps'?'4px':'1px'}catch(e){}
  /* pad printing sits proud of the dial: a hairline shadow under it and a lit
     top edge, so the branding reads as applied ink rather than a text layer */
  const line=(s,fs,yy)=>{ctx.font=fnt(fs);
   if(!flat){ctx.fillStyle='rgba(0,0,0,.34)';ctx.fillText(s,C+SHADOW.dx*fs*0.07,yy+SHADOW.dy*fs*0.07)}
   ctx.fillStyle=ink;ctx.fillText(s,C,yy);
   if(!flat){ctx.fillStyle='rgba(255,255,255,.16)';ctx.fillText(s,C-SHADOW.dx*fs*0.03,yy-SHADOW.dy*fs*0.03)}};
  if(t.top)line(t.font==='caps'?t.top.toUpperCase():t.top,r*0.105,C-r*0.40);
  if(t.bottom)line(t.font==='caps'?t.bottom.toUpperCase():t.bottom,r*0.075,C+(o.variant==='chrono'?r*0.70:r*0.46));
  try{ctx.letterSpacing='0px'}catch(e){}}

 for(let i=0;i<60;i++){const a=i*6;const len=i%5?9:16;const[x0,y0]=posAt(a,r*0.965),[x1,y1]=posAt(a,r*0.965-len);
  ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.strokeStyle=`rgba(235,236,240,${i%5?0.55:0.85})`;ctx.lineWidth=i%5?1.5:2.5;ctx.stroke()}
 ctx.beginPath();ctx.arc(C,C,r*0.03,0,7);ctx.fillStyle='rgba(0,0,0,.55)';ctx.fill();
 ctx.restore();}
