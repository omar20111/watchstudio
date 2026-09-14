/* Marker outlines, in millimetres.

   A shape style is described by its RIGHT HALF: a list of [y, w] points, y the
   distance in from the index's outer end (the end on the hour ring) and w the
   half-width there. Mirrored, that is the whole outline, so every family — a
   tapered baton, a wedge, an arrow, a hand-drawn custom one — is symmetric about
   the line to the centre of the dial, as real applied indices are.

   The local frame of one index: x across it, y along it from the outer end (0)
   to the inner end (lengthMm), y pointing at the dial centre. Placing it at an
   hour is one rotation about the centre (see placement.js).

   Corners are then filleted: a `round` end is a full radius, other corners get
   the style's corner radius — a machined part never has a knife-sharp corner. */
import {clamp} from './model.js';

const lerp=(a,b,t)=>a+(b-a)*t;

/* the right half of a shape style, [[y, w]...] from the outer end inward */
export function halfProfile(s){
 const L=s.lengthMm,W=s.widthMm/2;
 let pts;
 const pointed=s.outerEnd==='point';
 switch(s.outline){
  case'wedge':{const p=Math.min(L*.3,W*1.6);
   pts=pointed?[[0,0],[p,W*(1-p/L)],[L,0]]:[[0,W],[L,0]];break}
  case'dagger':pts=[[0,pointed?0:W*.42],[L*.2,W],[L,0]];break;
  case'arrow':{const head=Math.min(L*.46,W*2.4),shaft=W*.4;
   /* barbs swept back past where the head meets the shaft */
   pts=[[0,0],[head,W],[head*.74,shaft],[L,shaft]];break}
  case'lozenge':pts=[[0,0],[L/2,W],[L,0]];break;
  case'custom':pts=s.points.map(([t,w])=>[t*L,w*W]);break;
  case'dot':return null;
  default:{/* baton: straight sides from the outer width to taper x that */
   const wi=W*s.taper,wAt=y=>lerp(W,wi,y/L);
   pts=[[0,W],[L,wi]];
   const pOut=Math.min(L*.42,W*2.2),pIn=Math.min(L*.42,Math.max(wi,W*.4)*2.2);
   if(s.outerEnd==='point')pts=[[0,0],[pOut,wAt(pOut)],...pts.slice(1)];
   if(s.innerEnd==='point')pts=[...pts.slice(0,-1),[L-pIn,wAt(L-pIn)],[L,0]]}}
 if(s.flip)pts=pts.map(([y,w])=>[L-y,w]).reverse();
 return pts}

/* Fillet every corner of a closed polygon. `radius(i)` is the wanted radius at
   vertex i; each is shrunk so neighbouring fillets never overlap. */
export function filletLoop(loop,radius,segPerRad=10){
 const n=loop.length,out=[];
 for(let i=0;i<n;i++){const P=loop[i],A=loop[(i-1+n)%n],B=loop[(i+1)%n];
  const ax=A[0]-P[0],ay=A[1]-P[1],bx=B[0]-P[0],by=B[1]-P[1];
  const la=Math.hypot(ax,ay),lb=Math.hypot(bx,by),r0=radius(i);
  if(r0<=1e-6||la<1e-9||lb<1e-9){out.push(P);continue}
  const ux=ax/la,uy=ay/la,vx=bx/lb,vy=by/lb;
  const cos=clamp(ux*vx+uy*vy,-1,1),ang=Math.acos(cos);   /* interior angle at P */
  if(ang>Math.PI-1e-3||ang<1e-3){out.push(P);continue}       /* straight through */
  const tanH=Math.tan(ang/2);
  let d=r0/tanH;d=Math.min(d,la*.5,lb*.5);const r=d*tanH;
  const bxs=ux+vx,bys=uy+vy,bl=Math.hypot(bxs,bys)||1;
  const cd=r/Math.sin(ang/2),cx=P[0]+bxs/bl*cd,cy=P[1]+bys/bl*cd;
  const t1=[P[0]+ux*d,P[1]+uy*d],t2=[P[0]+vx*d,P[1]+vy*d];
  let a1=Math.atan2(t1[1]-cy,t1[0]-cx),a2=Math.atan2(t2[1]-cy,t2[0]-cx);
  let sweep=a2-a1;while(sweep>Math.PI)sweep-=Math.PI*2;while(sweep<-Math.PI)sweep+=Math.PI*2;
  const steps=Math.max(2,Math.ceil(Math.abs(sweep)*segPerRad));
  for(let k=0;k<=steps;k++){const a=a1+sweep*k/steps;out.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r])}}
 return out}

const circle=(cx,cy,r,n=64)=>Array.from({length:n},(_,i)=>{const a=i/n*Math.PI*2;return[cx+Math.sin(a)*r,cy-Math.cos(a)*r]});

/* The closed outline(s) of a shape style, [[x, y]...] per loop, in the local
   frame. Null for numerals, which are glyphs rather than outlines. */
export function outlineLoops(s){
 if(s.kind==='numeral')return null;
 const W=s.widthMm/2;
 let base;
 if(s.outline==='dot')base=circle(0,W,W);
 else{const half=halfProfile(s),L=s.lengthMm,eps=1e-6;
  const right=half.map(([y,w])=>[w,y]);
  const left=half.slice().reverse().filter(([,w])=>w>eps).map(([y,w])=>[-w,y]);
  /* the centre point of a pointed end belongs to both sides: keep it once */
  const loop=[...right,...left];
  const isEnd=(y,end)=>Math.abs(y-end)<1e-6;
  const outerEnd=s.flip?s.innerEnd:s.outerEnd,innerEnd=s.flip?s.outerEnd:s.innerEnd;
  base=filletLoop(loop,i=>{const[x,y]=loop[i],w=Math.abs(x);
   if(w<=eps)return s.cornerMm*.5;                          /* a point: just softened */
   if(isEnd(y,0)&&outerEnd==='round')return w;
   if(isEnd(y,L)&&innerEnd==='round')return w;
   return s.cornerMm})}
 if(s.count===2){const off=maxHalfWidth(base)+s.gapMm/2;
  return[base.map(([x,y])=>[x-off,y]),base.map(([x,y])=>[x+off,y])]}
 return[base]}

export const maxHalfWidth=loop=>loop.reduce((m,[x])=>Math.max(m,Math.abs(x)),0);

export function boundsOf(loops){let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
 for(const l of loops)for(const[x,y]of l){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
 return{x0,y0,x1,y1,w:x1-x0,h:y1-y0}}

/* signed area (shoelace), for tests and the spec sheet */
export const areaOf=loop=>{let a=0;for(let i=0;i<loop.length;i++){const[x1,y1]=loop[i],[x2,y2]=loop[(i+1)%loop.length];a+=x1*y2-x2*y1}return a/2};

export const svgPath=(loops,f=v=>v.toFixed(4))=>loops.map(l=>'M'+l.map(([x,y])=>f(x)+' '+f(y)).join('L')+'Z').join('');

/* The ground form of a style for relief.js, heights in mm. `edge` is where the
   flank stops and the top begins; `pocket` the floor of the lume channel. */
export function formOf(s){const h=s.heightMm,m=s.material;
 if(m==='paint')return{profile:'chamfer',height:h,edge:h*.85,bevel:.1,pocket:null,lumeTop:null};
 let f;
 if(s.top==='flat')f={profile:'chamfer',height:h,edge:h*.78,bevel:.08};
 else if(s.top==='facet')f={profile:'roof',height:h,edge:h*.22,bevel:1};
 else if(s.top==='dome')f={profile:'dome',height:h,edge:h*.24,bevel:Math.max(.3,s.bevel)};
 else f={profile:'chamfer',height:h,edge:h*.32,bevel:s.bevel};
 const lumed=s.lume==='channel'&&m!=='lume';
 const pocket=lumed?f.edge+(h-f.edge)*.3:null;
 return{...f,pocket,lumeTop:lumed?pocket+(h-pocket)*.62:null}}

/* The height across a section of the index at `d` mm in from its edge, with
   `maxD` the distance to its middle — the same curve relief.js grinds. */
export function sectionHeight(form,d,maxD){
 const span=form.profile==='roof'?maxD:Math.max(1e-6,maxD*form.bevel);
 const t=Math.min(1,Math.max(0,d/span));
 const ease=form.profile==='dome'?Math.sqrt(1-(1-t)*(1-t)):t;
 return form.edge+(form.height-form.edge)*ease}
