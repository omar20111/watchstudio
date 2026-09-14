/* Crystal renderer: flat, domed or box glass, highlights + AR coating tint.
   The shape comes from the case architecture (o.arch.crystal), the same field
   the thickness stack and the profile elevation read.
   Finish drives how much anti-reflective coating is on it: none = bare
   sapphire with strong white reflections, matte = heavily coated and almost
   invisible apart from the tell-tale blue-violet cast. */
import {C,PX} from '../constants.js';

const AR={none:1,brushed:.85,polished:.6,matte:.28};

export function drCrystal(ctx,o){const{crystalR,crystalH}=o.g;const r=crystalR;const W=ctx.canvas.width,H=ctx.canvas.height;
 const shape=(o.arch&&o.arch.crystal)||'dome';
 const k=AR[o.finish]??.75, dome=shape==='dome';
 ctx.save();ctx.beginPath();ctx.arc(C,C,r,0,7);ctx.clip();
 let g=ctx.createRadialGradient(C-r*0.38,C-r*0.42,0,C-r*0.38,C-r*0.42,r*1.15);
 g.addColorStop(0,`rgba(255,255,255,${((dome?0.3:0.12)*k).toFixed(3)})`);
 g.addColorStop(.5,`rgba(255,255,255,${(0.07*k).toFixed(3)})`);g.addColorStop(1,'rgba(255,255,255,0)');
 ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 if(dome){ctx.save();ctx.translate(C,C);ctx.rotate(-0.55);
  const g2=ctx.createLinearGradient(0,-r*0.5,0,r*0.5);
  g2.addColorStop(0,'rgba(255,255,255,0)');g2.addColorStop(.5,`rgba(255,255,255,${(0.1*k).toFixed(3)})`);g2.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=g2;ctx.fillRect(-r,-r*0.16,r*2,r*0.32);ctx.restore()}
 /* AR coatings scatter what little they reflect toward blue-violet */
 g=ctx.createRadialGradient(C+r*0.4,C+r*0.45,0,C+r*0.4,C+r*0.45,r);
 g.addColorStop(0,`rgba(${k<.5?150:130},${k<.5?140:170},255,${(0.1+(1-k)*0.07).toFixed(3)})`);
 g.addColorStop(1,'rgba(130,170,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 /* A domed crystal refracts at its outer edge: a compressed dark band where the
    glass turns away, then a bright meniscus right at the rim. Depth of the band
    follows the crystal height, so a flat sapphire barely shows one. */
 /* A box crystal's wall is vertical, so from above there is no gradual falloff:
    just a thin hard ring where the wall is seen edge-on, with the refraction
    shadow tucked inside it. */
 if(shape==='box'&&crystalH>0){const w=Math.min(.09,crystalH/(r*0.9));
  const e=ctx.createRadialGradient(C,C,r*(1-w),C,C,r);
  e.addColorStop(0,'rgba(0,0,0,0)');
  e.addColorStop(.30,'rgba(0,0,0,.34)');
  e.addColorStop(.62,`rgba(255,255,255,${(.42*k).toFixed(3)})`);
  e.addColorStop(.82,`rgba(255,255,255,${(.12*k).toFixed(3)})`);
  e.addColorStop(1,'rgba(0,0,0,.22)');
  ctx.fillStyle=e;ctx.fillRect(0,0,W,H)}
 else if(crystalH>0){const d=Math.min(.62,crystalH/(r*0.22));
  const e=ctx.createRadialGradient(C,C,r*(1-0.19*d),C,C,r);
  e.addColorStop(0,'rgba(0,0,0,0)');
  e.addColorStop(.36,`rgba(255,255,255,${(.05*d*k).toFixed(3)})`);
  e.addColorStop(.74,`rgba(0,0,0,${(.30*d).toFixed(3)})`);
  e.addColorStop(.93,`rgba(255,255,255,${(.34*d*k).toFixed(3)})`);
  e.addColorStop(1,`rgba(0,0,0,${(.18*d).toFixed(3)})`);
  ctx.fillStyle=e;ctx.fillRect(0,0,W,H)}
 ctx.restore();
 ctx.beginPath();ctx.arc(C,C,r-1.5,0,7);ctx.strokeStyle=`rgba(255,255,255,${(0.22*k+0.05).toFixed(3)})`;ctx.lineWidth=2.5;ctx.stroke();
 ctx.beginPath();ctx.arc(C,C,r-5,0,7);ctx.strokeStyle='rgba(0,0,0,.1)';ctx.lineWidth=4;ctx.stroke();
 /* the cyclops, seen from above: a bright rim where its wall catches the light
    and a glint on its crown. The 3D lens magnifies; the flat drawing cannot see
    the dial beneath its own layer, so it only marks the lens. */
 if(o.cyclops){const c=o.cyclops,x=C+c.x*PX,y=C+c.z*PX,w=c.A*2*PX,h=c.B*2*PX,rr=c.rc*PX;
  ctx.beginPath();ctx.roundRect(x-w/2,y-h/2,w,h,rr);
  ctx.fillStyle=`rgba(255,255,255,${(.05+.06*k).toFixed(3)})`;ctx.fill();
  ctx.strokeStyle=`rgba(255,255,255,${(.35*k+.15).toFixed(3)})`;ctx.lineWidth=2;ctx.stroke();
  const gl=ctx.createRadialGradient(x-w*.18,y-h*.2,0,x-w*.18,y-h*.2,h*.45);
  gl.addColorStop(0,`rgba(255,255,255,${(.5*k).toFixed(3)})`);gl.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=gl;ctx.fill()}}
