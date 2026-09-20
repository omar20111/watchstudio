/* Caseback artwork, on the shared 1200² sheet at the case's own size.

   This is what used to be drawn separately as the "back elevation" for the
   presentation sheet. It is now the texture on the underside of the 3D case,
   so the back view is the same object as every other view.

     solid       brushed centre, knurled screw-down ring, small engraving
     engraved    the same with the engraving large and central
     exhibition  (flat) the movement seen through the sapphire window;
                 the ring and window themselves are geometry

   `flat` omits painted light; the 3D caseback is lit for real. `shape` is the
   engraving alone, white on nothing, which the 3D caseback cuts into its metal;
   its notches there are geometry. */
import {C,PX,METALS} from '../constants.js';
import {tone,circGrain} from './material.js';

export const CASEBACK_WINDOW=.58;                /* exhibition window, as a fraction of the case radius */

function movement(ctx,R){const r=R*CASEBACK_WINDOW;
 ctx.save();ctx.beginPath();ctx.arc(C,C,r,0,7);ctx.clip();
 /* rhodium-plated plate with Côtes de Genève */
 ctx.fillStyle='#b9bcc1';ctx.fillRect(C-r,C-r,r*2,r*2);
 const stripe=r*.16;
 ctx.save();ctx.translate(C,C);ctx.rotate(-.35);
 for(let i=-8;i<8;i++){const g=ctx.createLinearGradient(0,i*stripe,0,(i+1)*stripe);
  g.addColorStop(0,'#9ea2a8');g.addColorStop(.5,'#d8dbdf');g.addColorStop(1,'#9ea2a8');
  ctx.fillStyle=g;ctx.fillRect(-r*1.5,i*stripe,r*3,stripe)}
 ctx.restore();
 /* balance wheel and its cock */
 const bx=C-r*.42,by=C+r*.28,br=r*.24;
 ctx.fillStyle='#5b5f66';ctx.beginPath();ctx.arc(bx,by,br*1.12,0,7);ctx.fill();
 ctx.strokeStyle='#d9b45a';ctx.lineWidth=r*.035;ctx.beginPath();ctx.arc(bx,by,br,0,7);ctx.stroke();
 for(let k=0;k<3;k++){const a=k*2.094;ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(bx+Math.cos(a)*br,by+Math.sin(a)*br);ctx.stroke()}
 ctx.strokeStyle='#8c9097';ctx.lineWidth=r*.01;for(let k=1;k<5;k++){ctx.beginPath();ctx.arc(bx,by,br*k*.17,0,7);ctx.stroke()}
 /* jewels */
 ctx.fillStyle='#a3162a';
 for(const[jx,jy]of[[bx,by],[C+r*.18,C-r*.3],[C+r*.46,C+r*.1],[C-r*.05,C+r*.52],[C,C]]){
  ctx.beginPath();ctx.arc(jx,jy,r*.028,0,7);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.55)';ctx.beginPath();ctx.arc(jx-r*.008,jy-r*.008,r*.009,0,7);ctx.fill();ctx.fillStyle='#a3162a'}
 /* winding rotor: a half-disc across the top */
 ctx.fillStyle='#caa24e';ctx.beginPath();ctx.moveTo(C,C);ctx.arc(C,C,r*.96,Math.PI*1.08,Math.PI*1.92);ctx.closePath();ctx.fill();
 ctx.fillStyle='rgba(70,48,10,.55)';ctx.font=`600 ${r*.075}px Georgia, serif`;ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.fillText('AUTOMATIC',C,C-r*.62);
 ctx.fillStyle='#e5e7ea';ctx.beginPath();ctx.arc(C,C,r*.08,0,7);ctx.fill();
 ctx.restore()}

export function drCaseback(ctx,o){
 const m=METALS[o.metal]||METALS.steel;const R=o.g.R;const c=o.arch;
 const flat=o.mode==='flat';
 if(c.caseback==='exhibition'){movement(ctx,R);return}
 if(o.mode==='shape'){ctx.save();ctx.beginPath();ctx.arc(C,C,R*.64,0,7);ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();ctx.restore();
  engraving(ctx,c,R,'#fff');return}
 /* brushed centre */
 ctx.save();ctx.beginPath();ctx.arc(C,C,R*.8,0,7);ctx.fillStyle=flat?(m.f0||m.base):tone(m,.62);ctx.fill();
 ctx.clip();ctx.globalCompositeOperation='overlay';ctx.fillStyle=circGrain(ctx,0,R*.8,.8);ctx.fillRect(C-R,C-R,R*2,R*2);ctx.restore();
 /* screw-down ring notches */
 ctx.save();for(let i=0;i<6;i++){const a=i/6*Math.PI*2;ctx.save();ctx.translate(C,C);ctx.rotate(a);
  ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(R*.66,-R*.03,R*.1,R*.06);ctx.restore()}ctx.restore();
 ctx.beginPath();ctx.arc(C,C,R*.64,0,7);ctx.strokeStyle='rgba(0,0,0,.35)';ctx.lineWidth=2;ctx.stroke();
 engraving(ctx,c,R,'rgba(20,22,26,.72)')}

/* The engraving, up to four lines of it: a name, then a dedication, a material,
   a limited edition's number — what a caseback carries. The first line is the
   title, cut larger; the rest follow in a smaller face, and the watch's own
   line (movement, size, depth) sits under them all. */
export const ENGRAVING_LINES=4;
export const engravingLines=c=>{const l=String(c.engraving==null?'WATCHSTUDIO':c.engraving)
  .split(/\r?\n/).map(x=>x.trim().toUpperCase().slice(0,24)).filter(Boolean).slice(0,ENGRAVING_LINES);
 return l.length?l:['WATCHSTUDIO']};
function engraving(ctx,c,R,fill){
 ctx.save();ctx.translate(C,C);ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=fill;
 const big=c.caseback==='engraved',lines=engravingLines(c),rest=lines.length-1;
 const title=R*(big?.14:.075),small=R*(big?.062:.05);
 /* the block sits about the middle: the more lines, the higher it starts */
 let y=(big?-R*.08:-R*.34)-rest*small*.7;
 /* a line longer than the back is wide is cut smaller, not run off the edge */
 const fit=(txt,size,font)=>{let px=size;for(let i=0;i<6;i++){ctx.font=font(px);
   if(ctx.measureText(txt).width<=R*1.15)break;px*=.86}
  ctx.fillText(txt,0,y)};
 fit(lines[0],title,px=>`600 ${px}px Georgia, serif`);
 for(const l of lines.slice(1)){y+=title*.62+small*.5;fit(l,small,px=>`500 ${px}px system-ui`)}
 y+=small*1.9;
 ctx.font=`500 ${R*.055}px system-ui`;
 ctx.fillText(`${c.movement.toUpperCase()} · ${(R*2/PX).toFixed(0)} MM · ${c.wrM} M`,0,Math.max(y,big?R*.14:R*.34));
 if(!big&&!rest){ctx.font=`500 ${R*.045}px system-ui`;ctx.fillText('SAPPHIRE CRYSTAL · STAINLESS',0,R*.44)}
 ctx.restore()}
