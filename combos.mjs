/* Headless combination check — run with: npm run combos

   Renders the six review combinations through the real renderers under the same
   canvas mocks the smoke test uses, and asserts the construction invariants that
   a top-down watch must satisfy: the radial stack has to stay strictly ordered,
   the lugs have to reach the stated lug-to-lug, and nothing may render outside
   the sheet. Catches component intersections and broken proportions without
   needing eyes on every permutation. */

function makeGrad(){return{addColorStop(){}}}
function makeCtx(cv){const base={canvas:cv};
 return new Proxy(base,{get(t,p){if(p in t)return t[p];
  if(p==='createLinearGradient'||p==='createRadialGradient'||p==='createConicGradient')return()=>makeGrad();
  if(p==='createPattern')return()=>({});
  if(p==='getImageData'||p==='createImageData')return(x,y,w,h)=>({data:new Uint8ClampedArray(Math.max(4,(w||1)*(h||1)*4)),width:w||1,height:h||1});
  if(p==='measureText')return()=>({width:0});
  const fn=()=>undefined;t[p]=fn;return fn},
 set(t,p,v){t[p]=v;return true}})}
function makeCanvas(){const cv={width:0,height:0,parentNode:null,style:{},toDataURL:()=>'data:image/png;base64,STUB'};
 cv.getContext=function(){return this.__ctx||(this.__ctx=makeCtx(this))};return cv}
function el(){return{style:{},setAttribute(){},appendChild(){},removeChild(){},remove(){},click(){},addEventListener(){},removeEventListener(){},contains:()=>false,closest:()=>null,querySelector:()=>null,querySelectorAll:()=>[]}}
globalThis.document={createElement:t=>t==='canvas'?makeCanvas():el(),getElementById:()=>el(),body:el(),addEventListener(){},removeEventListener(){}};
globalThis.window={addEventListener(){},removeEventListener(){}};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
globalThis.CanvasRenderingContext2D=class{};
globalThis.requestAnimationFrame=()=>0;globalThis.cancelAnimationFrame=()=>{};
globalThis.ResizeObserver=class{observe(){}disconnect(){}};
if(!globalThis.URL.createObjectURL)globalThis.URL.createObjectURL=()=>'blob:x';

const M=await import('./src/smokeExports.jsx');
const G=await import('./src/core/geometry.js');
const {PX,CAN,C}=await import('./src/core/constants.js');
const L3=await import('./src/core/three/lathe.js');
const TR=await import('./src/core/three/tracer.js');
const RL=await import('./src/core/three/relief.js');
const {bakeSize}=await import('./src/core/cache.js');

let fails=0;
const bad=(name,msg)=>{fails++;console.log(`  FAIL  [${name}] ${msg}`)};

/* The tracer and the relief grind a baked silhouette into shaped hands and
   indices. The canvas mock draws nothing, so feed them synthetic alpha fields. */
const alphaCanvas=paint=>{const W=1200,H=1200,a=new Uint8ClampedArray(W*H*4);paint((x,y,v)=>{a[(y*W+x)*4+3]=v});
 return{width:W,height:H,getContext:()=>({getImageData:()=>({data:a})})}};
const rect=(set,x0,y0,w,h,v=255)=>{for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++)set(x,y,v)};

/* a 60x30 px bar with a 20x10 px window cut out, plus a separate 10 px dot */
{const cv=alphaCanvas(set=>{rect(set,600,300,60,30);rect(set,620,310,20,10,0);rect(set,400,700,10,10)});
 const loops=TR.traceLoops(cv);
 if(loops.length!==3)bad('tracer',`expected 3 loops (bar, window, dot), got ${loops.length}`);
 const rel=RL.reliefFromSilhouette(cv,{profile:'bevel',height:.3,edge:.1,bevel:.4});
 if(!rel)bad('relief','nothing built from the bar');
 else{const g=rel.geometry;g.computeBoundingBox();const bb=g.boundingBox,p=g.attributes.position;
  if(Math.abs(bb.min.y)>1e-6||bb.max.y>.3+1e-6||bb.max.y<.25)bad('relief',`bar spans y ${bb.min.y.toFixed(3)}..${bb.max.y.toFixed(3)}, want 0..~0.3`);
  /* the bar sits above the dial centre: canvas y 300..330 is z -16.7..-15 mm (12 o'clock is -z) */
  let zMin=1e9,zMax=-1e9,xMin=1e9,xMax=-1e9;
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);if(x<-1)continue;   /* the bar, not the dot at x=-11 mm */
   zMin=Math.min(zMin,z);zMax=Math.max(zMax,z);xMin=Math.min(xMin,x);xMax=Math.max(xMax,x)}
  if(!(zMax<-14.9&&zMin>-16.8))bad('relief',`bar at z ${zMin.toFixed(2)}..${zMax.toFixed(2)}, want -16.7..-15`);
  if(Math.abs((xMax-xMin)-60/PX)>.1)bad('relief',`bar is ${(xMax-xMin).toFixed(2)}mm wide, want ${(60/PX).toFixed(2)}`);
  /* nothing may be built inside the window */
  let inWindow=0;for(let i=0;i<p.count;i++){const x=p.getX(i)*PX+600,z=p.getZ(i)*PX+600;if(x>621&&x<639&&z>311&&z<319)inWindow++}
  if(inWindow)bad('relief',`${inWindow} vertices inside the bar's window`);
  const n=g.attributes.normal;let bad0=0;for(let i=0;i<n.count;i++)if(!Number.isFinite(n.getX(i))||Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)>1e-3)bad0++;
  if(bad0)bad('relief',`${bad0} bad normals`)}}

/* A dauphine is two flat facets: ground against a straight edge, every point on
   a facet must share one normal. A long, thin, slightly slanted triangle is the
   hard case — its edges are the pixel staircases that used to ripple into ribs. */
{const tip=[600,200],base=[[585,500],[615,500]];
 const cv=alphaCanvas(set=>{for(let y=200;y<=500;y++){const t=(y-200)/300,hw=15*t;
  for(let x=Math.floor(600-hw)-1;x<=Math.ceil(600+hw)+1;x++){const cov=Math.max(0,Math.min(1,hw-Math.abs(x+.5-600)+.5));if(cov>0)set(x,y,Math.round(cov*255))}}});
 const rel=RL.reliefFromSilhouette(cv,{profile:'roof',height:.34,edge:.05});
 if(!rel)bad('relief','nothing built from the dauphine');
 else{const g=rel.geometry,p=g.attributes.position,n=g.attributes.normal;
  /* sample the left facet's top surface away from the rim, the ridge, the tip and the base */
  const nx=[],rim=[];let ridge=0;
  for(let i=0;i<p.count;i++){const x=p.getX(i)*PX+600,y=p.getZ(i)*PX+600;
   if(n.getY(i)<.5)continue;                                  /* walls */
   const t=(y-200)/300,hw=15*t;
   /* at least 2.5 px from the ridge and from the rim, clear of the smoothing */
   if(y>260&&y<460&&x<600-Math.max(2.5,hw*.3)&&x>600-hw+2.5)nx.push(n.getX(i));
   /* ...and the rim itself, from the outline to 1.5 px in */
   if(y>260&&y<460&&x<600-Math.max(2.5,hw*.3)&&x>=600-hw-1e-6&&x<600-hw+1.5)rim.push(n.getX(i));
   if(Math.abs(y-400)<.01&&Math.abs(x-600)<.01)ridge=p.getY(i)}
  const meanOf=v=>v.reduce((a,b)=>a+b,0)/Math.max(1,v.length),spreadOf=v=>{const m=meanOf(v);return Math.sqrt(v.reduce((a,b)=>a+(b-m)*(b-m),0)/Math.max(1,v.length))};
  const mean=meanOf(nx),spread=spreadOf(nx);
  if(nx.length<40)bad('relief',`too few facet samples (${nx.length})`);
  if(spread>.01)bad('relief',`dauphine facet is not flat: normal x varies by ${spread.toFixed(4)} (ribs)`);
  /* The smoothing once averaged the first pixels in with a flat edge height
     outside, by however much of a pixel the slanted outline cut off: on a
     polished facet a row of dark notches along the rim. The rim has to lean
     like the facet it ends. */
  if(rim.length<40)bad('relief',`too few rim samples (${rim.length})`);
  if(Math.abs(meanOf(rim)-mean)>.01||spreadOf(rim)>.008)
   bad('relief',`dauphine rim is notched: normal x ${meanOf(rim).toFixed(4)} ± ${spreadOf(rim).toFixed(4)} against the facet's ${mean.toFixed(4)}`);
  /* two-thirds of the way to the base the ridge stands two-thirds of the way up */
  const want=.05+(.34-.05)*(10/15);
  if(Math.abs(ridge-want)>.03)bad('relief',`dauphine ridge at y=400 is ${ridge.toFixed(3)}mm high, want ~${want.toFixed(3)}mm`)}}

/* Every triangle of a ground hand or index faces the way its normals point:
   the top up, the walls out. The walls were once wound inward under outward
   normals, so the front-sided metal culled them from every side they are seen
   from. Each form the watch grinds, on outlines slanted across the pixel grid. */
{const poly=pts=>set=>{const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
  const inPoly=(x,y)=>{let c=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const[xi,yi]=pts[i],[xj,yj]=pts[j];
   if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c}return c};
  for(let y=Math.floor(Math.min(...ys))-1;y<=Math.ceil(Math.max(...ys))+1;y++)for(let x=Math.floor(Math.min(...xs))-1;x<=Math.ceil(Math.max(...xs))+1;x++){
   let cov=0;for(let sy=0;sy<4;sy++)for(let sx=0;sx<4;sx++)if(inPoly(x+(sx+.5)/4,y+(sy+.5)/4))cov++;
   if(cov)set(x,y,Math.round(cov/16*255))}};
 /* a shape along the dial's radius at `deg` clockwise from 12: [along, across] in px, along measured outward */
 const radial=(deg,pts,r0)=>{const a=deg*Math.PI/180,ux=Math.sin(a),uy=-Math.cos(a);
  return pts.map(([s,t])=>[600+(r0+s)*ux-t*uy,600+(r0+s)*uy+t*ux])};
 const dauphineAt=deg=>radial(deg,[[0,-9],[260,0],[0,9],[-30,0]],20);
 const wedgeAt=deg=>radial(deg,[[0,0],[60,-13],[60,13]],400);
 const batonAt=deg=>radial(deg,[[0,-7],[60,-7],[60,7],[0,7]],400);
 const facingAgainst=geo=>{const p=geo.attributes.position.array,N=geo.attributes.normal.array,ix=geo.index.array;let against=0,walls=0;
  for(let t=0;t<ix.length;t+=3){const a=ix[t]*3,b=ix[t+1]*3,c=ix[t+2]*3;
   const ux=p[b]-p[a],uy=p[b+1]-p[a+1],uz=p[b+2]-p[a+2],vx=p[c]-p[a],vy=p[c+1]-p[a+1],vz=p[c+2]-p[a+2];
   const sy=N[a+1]+N[b+1]+N[c+1];if(Math.abs(sy)<1e-6)walls++;
   if((uy*vz-uz*vy)*(N[a]+N[b]+N[c])+(uz*vx-ux*vz)*sy+(ux*vy-uy*vx)*(N[a+2]+N[b+2]+N[c+2])<0)against++}
  return{against,walls}};
 const CASES=[
  ['dauphine hand at 1:50',poly(dauphineAt(55)),{profile:'roof',height:.36,edge:.05}],
  ['wedge index at 2',poly(wedgeAt(60)),{profile:'roof',height:.34,edge:.06}],
  ['wedge index at 11:30',poly(wedgeAt(-15)),{profile:'roof',height:.34,edge:.06}],
  ['baton index at 1 with lume',poly(batonAt(30)),{profile:'bevel',height:.32,edge:.1,bevel:.42,pocket:.24},poly(radial(30,[[8,-3],[52,-3],[52,3],[8,3]],400))],
  ['leaf hand with lume',poly(radial(200,[[0,0],[120,-12],[240,0],[120,12]],20)),{profile:'dome',height:.3,edge:.05,bevel:.85,pocket:.2},poly(radial(200,[[40,0],[120,-6],[200,0],[120,6]],20))],
  ['dot index',set=>{for(let y=680;y<720;y++)for(let x=480;x<520;x++)set(x,y,Math.round(255*Math.max(0,Math.min(1,15.5-Math.hypot(x+.5-500,y+.5-700)))))},{profile:'dome',height:.3,edge:.08,bevel:.9}],
 ];
 for(const[name,paint,form,lume]of CASES){const cv=alphaCanvas(paint),rel=RL.reliefFromSilhouette(cv,{...form,lume:lume?alphaCanvas(lume):null});
  if(!rel){bad('relief',`nothing built from the ${name}`);continue}
  const{against,walls}=facingAgainst(rel.geometry);
  if(!walls)bad('relief',`the ${name} has no walls`);
  if(against)bad('relief',`${against} triangles of the ${name} face against their normals (${walls} wall triangles)`)}}

/* The 3D head must be built from the mm model, not beside it: its apex has to
   land on the stated thickness, its rings on geoOf's radii, and every profile
   has to be real numbers. This is the check the 2D profile view never had,
   which is how it drifted to its own 20/50/30 split. */
function checkHead(name,d){
 const{profiles:P,heights:H,radii:R}=L3.headProfiles(d),arch=G.caseOf(d);
 if(Math.abs(H.top-arch.thickness)>1e-6)bad(name,`3D apex ${H.top.toFixed(3)}mm != case thickness ${arch.thickness}mm`);
 const rs=[['rCase',R.rCase],['rSeat',R.rSeat],['rBezOut',R.rBezOut],['rBezIn',R.rBezIn],['dialR',R.dialR]];
 for(let i=1;i<rs.length;i++)if(!(rs[i-1][1]>rs[i][1]))bad(name,`3D ${rs[i-1][0]} must exceed ${rs[i][0]}`);
 for(const[k,pts]of Object.entries(P)){
  if(pts.length<2)bad(name,`3D profile ${k} has ${pts.length} points`);
  if(pts.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0))bad(name,`3D profile ${k} has a bad point`)}
 const apex=P.crystal[P.crystal.length-1];
 if(apex.x!==0||Math.abs(apex.y-H.top)>1e-6)bad(name,`3D crystal apex at (${apex.x},${apex.y}), expected (0,${H.top})`);
 if(!(H.back<H.seat&&H.seat<H.bezelTop&&H.bezelTop<H.top))bad(name,'3D heights out of order');
 const rh=P.rehaut;if(!(rh[0].y>rh[1].y&&rh[0].x>rh[1].x))bad(name,'3D rehaut must fall inward to the dial');
 try{for(const pts of Object.values(P))L3.lathe(pts,24).dispose()}catch(e){bad(name,'3D lathe threw: '+e.message)}

 /* lugs reach the stated lug-to-lug, sit under the chamfer, and drop toward the tip */
 const lp=L3.lugParts(d);
 const zs=lp.shapes.flatMap(s=>s.getPoints().map(p=>Math.abs(p.y)));
 const tip=Math.max(...zs),l2l=G.lugToLugOf(d)/2;
 if(Math.abs(tip-l2l)>.35)bad(name,`3D lug tips at ${tip.toFixed(2)}mm, lug-to-lug says ${l2l.toFixed(2)}mm`);
 if(!(lp.top<H.seat&&lp.bottom>H.back&&lp.thick>1))bad(name,`3D lugs out of the band (${lp.bottom.toFixed(2)}..${lp.top.toFixed(2)})`);
 /* crown stands outside the case band, on the mid-case */
 const cp=L3.crownParts(d);
 if(!(cp.barrelX>R.rCase))bad(name,`3D crown barrel at ${cp.barrelX.toFixed(2)}mm is inside the case (${R.rCase.toFixed(2)})`);
 if(!(cp.axisY>H.back&&cp.axisY<H.seat))bad(name,'3D crown axis is off the mid-case');
 if(arch.pushers!==(cp.pushers.length===2))bad(name,'3D pushers do not follow the case setting');
 /* the strap leaves the spring bar continuously and comes to rest below the head */
 const sp=L3.strapPath(d);let prev=sp.pos(0);
 for(let s=.5;s<80;s+=.5){const q=sp.pos(s);
  if(Math.hypot(q[0]-prev[0],q[1]-prev[1])>.51)bad(name,`3D strap jumps at s=${s}`);prev=q}
 if(!(sp.groundY<0))bad(name,`3D strap rests at y=${sp.groundY.toFixed(2)}, above the caseback`)}

const COMBOS=[
 ['steel case + leather strap',      d=>{d.parts.case.metal='steel';d.parts.case.finish='brushed';d.parts.strap.variant='leather'}],
 ['rose-gold case + leather strap',  d=>{d.parts.case.metal='rose';d.parts.case.finish='polished';d.parts.strap.variant='leather'}],
 ['diver bezel + steel bracelet',    d=>{d.parts.bezel.variant='diver';d.parts.strap.variant='steel';d.parts.case.variant='sport'}],
 ['GMT bezel + steel bracelet',      d=>{d.parts.bezel.variant='gmt';d.parts.strap.variant='steel'}],
 ['fluted bezel + dress dial',       d=>{d.parts.bezel.variant='fluted';d.parts.dial.variant='guilloche';d.parts.markers.variant='roman'}],
 ['domed crystal + polished case',   d=>{d.case.crystal='dome';d.parts.case.finish='polished';d.case.crystalMm=2.6},
  /* the height has to reach the geometry, or this combo tests the default crystal */
  d=>Math.abs(G.crystalMmOf(d)-2.6)<1e-9||`crystal height ${G.crystalMmOf(d)}mm, expected 2.6mm`],
];


for(const[name,apply,check]of COMBOS){
 const d=M.clone(M.DEF);apply(d);
 if(check){const r=check(d);if(r!==true)bad(name,r)}
 let layers;
 try{layers=M.buildLayers(d,{})}catch(e){bad(name,'buildLayers threw: '+e.message);continue}
 if(!layers.length){bad(name,'no layers');continue}

 const g=G.geoOf(d);
 /* the construction stack must stay strictly ordered, or components intersect */
 const stack=[['dialR',g.dialR],['rBezIn',g.rBezIn],['rBezOut',g.rBezOut],['rSeat',g.rSeat],['rCase',g.rCase]];
 for(let i=1;i<stack.length;i++)
  if(!(stack[i][1]>stack[i-1][1]))bad(name,`${stack[i][0]} (${stack[i][1].toFixed(1)}) must exceed ${stack[i-1][0]} (${stack[i-1][1].toFixed(1)})`);
 if(g.rehautW<=0)bad(name,`rehaut collapsed to ${g.rehautW.toFixed(2)}px`);
 if(g.crystalR>g.rBezOut)bad(name,'crystal wider than the bezel outer edge');

 /* lugs must reach the stated lug-to-lug and stay on the sheet */
 const l2lPx=G.lugToLugOf(d)*PX;
 if(Math.abs((g.R+g.lugExt)*2-l2lPx)>1.5)bad(name,`lug span ${((g.R+g.lugExt)*2/PX).toFixed(1)}mm != lug-to-lug ${(l2lPx/PX).toFixed(1)}mm`);
 if(C+g.R+g.lugExt>CAN)bad(name,'lugs run off the 1200px sheet');
 const crownTip=C+g.R+g.crownR*1.8;
 if(crownTip>CAN)bad(name,`crown tip at ${crownTip.toFixed(0)}px exceeds the sheet`);

 /* every part's artwork must actually render (buildLayers bakes it) */
 for(const l of layers)if(!l.cv&&!l.url)bad(name,`${l.key} has no artwork`);

 checkHead(name,d);
 for(const crystal of['flat','dome','box']){const d2=M.clone(d);d2.case.crystal=crystal;checkHead(`${name} / ${crystal} crystal`,d2)}

 /* the whole 3D watch must build — every lathe, extrusion, strap and bake */
 try{const w=M.buildHead(d,{});if(!w.userData.groups.case.children.length)bad(name,'3D case built empty')}
 catch(e){bad(name,'3D build threw: '+e.message)}
 for(const cb of['solid','exhibition','engraved']){const d2=M.clone(d);d2.case.caseback=cb;d2.case.pushers=true;d2.parts.case.variant='sport';d2.case.crownPos='430';
  try{M.buildHead(d2,{})}catch(e){bad(name,`3D build (${cb} back, pushers, guards, 4:30) threw: ${e.message}`)}}

 console.log(`  ok    ${name} — ${layers.length} layers, dial ${(g.dialR*2/PX).toFixed(1)}mm, `+
  `bezel ${G.bezelMmOf(d)}mm, rehaut ${G.rehautMmOf(d)}mm, L2L ${G.lugToLugOf(d)}mm`);
}

/* straps are closed solids: faces out (a positive signed volume), the underside
   on the table and never through it, the tail narrowing to its tip, the buckle
   wider than the strap and past its end, each keeper round the strap */
const volumeOf=geo=>{const p=geo.attributes.position,ix=geo.index;let v=0;
 const n=ix?ix.count:p.count,at=i=>ix?ix.getX(i):i;
 for(let i=0;i<n;i+=3){const[a,b,c]=[at(i),at(i+1),at(i+2)];
  const ax=p.getX(a),ay=p.getY(a),az=p.getZ(a),bx=p.getX(b),by=p.getY(b),bz=p.getZ(b),cx=p.getX(c),cy=p.getY(c),cz=p.getZ(c);
  v+=(ax*(by*cz-bz*cy)-ay*(bx*cz-bz*cx)+az*(bx*cy-by*cx))/6}
 return v};
const boundsOf=(geo,keep=()=>true)=>{const p=geo.attributes.position,b={x0:1e9,x1:-1e9,y0:1e9,y1:-1e9,z0:1e9,z1:-1e9};
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);if(!keep(x,y,z))continue;
  b.x0=Math.min(b.x0,x);b.x1=Math.max(b.x1,x);b.y0=Math.min(b.y0,y);b.y1=Math.max(b.y1,y);b.z0=Math.min(b.z0,z);b.z1=Math.max(b.z1,z)}
 return b};
for(const variant of['leather','rubber','nato','mesh'])for(const caseMm of[34,40,46]){
 const d=M.clone(M.DEF);d.caseMm=caseMm;d.parts.strap.variant=variant;const tag=`strap ${variant}/${caseMm}`;
 let w;try{w=M.buildHead(d,{})}catch(e){bad(tag,'3D build threw: '+e.message);continue}
 const mesh=n=>w.getObjectByName(n),sp=L3.strapPath(d),wide=G.strapMmOf(d);
 const top=mesh('strap:top'),bottom=mesh('strap:bottom'),keepers=mesh('strap:keepers'),buckle=mesh('strap:buckle'),tongue=mesh('strap:tongue');
 if(!(top&&bottom&&keepers&&buckle&&tongue)){bad(tag,'strap, keepers, buckle or tongue missing');continue}
 for(const m of[top,bottom,keepers,buckle,tongue])if(!(volumeOf(m.geometry)>0))bad(tag,`${m.name} faces inward (volume ${volumeOf(m.geometry).toFixed(2)})`);
 const bt=boundsOf(top.geometry),bb=boundsOf(bottom.geometry);
 for(const[b,n]of[[bt,'top'],[bb,'bottom']])if(b.y0<sp.groundY-1e-3)bad(tag,`the ${n} strap sinks ${(sp.groundY-b.y0).toFixed(2)}mm into the table`);
 /* the painted taper starts inside the case, so at the spring bar it is a touch under the lug width */
 if(!(bt.x1-bt.x0<=wide+1e-3&&bt.x1-bt.x0>wide*.97))bad(tag,`strap ${(bt.x1-bt.x0).toFixed(2)}mm wide, lug width ${wide}mm`);
 const tail=boundsOf(bottom.geometry,(x,y,z)=>z>bb.z1-1);
 if(!(tail.x1-tail.x0<wide*.45))bad(tag,`the tail is ${(tail.x1-tail.x0).toFixed(2)}mm wide 1mm from its tip`);
 const bk=boundsOf(buckle.geometry);
 if(!(bk.x1-bk.x0>wide))bad(tag,'the buckle is narrower than the strap');
 if(!(bk.z0<bt.z0-5&&bk.z1>bt.z0))bad(tag,'the buckle does not start in the strap end and run past it');
 if(Math.abs(bk.y0-sp.groundY)>.05)bad(tag,`the buckle floats ${(bk.y0-sp.groundY).toFixed(2)}mm off the table`);
 const kb=boundsOf(keepers.geometry);
 if(!(kb.x1-kb.x0>wide*.86))bad(tag,'the keepers are narrower than the strap they hold');
 /* each piece as long as a strap is sold: the tail piece measured to its tip,
    the buckle piece to the end of its buckle, both from the spring bar */
 const SL=G.strapLengthsOf(d),zAt=s=>sp.start+sp.pos(s)[0];
 if(!(SL.short>=66&&SL.short<=80&&SL.long>=100&&SL.long<=128&&SL.long-SL.short>=30))bad(tag,`strap pieces ${SL.short}/${SL.long}mm are not a two-piece strap's lengths`);
 if(Math.abs(sp.start-G.springBarMm(d))>1e-9)bad(tag,'the strap does not start at the spring bar');
 if(Math.abs(bb.z1-zAt(SL.bottom))>.3)bad(tag,`the tail piece ends ${(bb.z1-zAt(SL.bottom)).toFixed(2)}mm off its ${SL.long}mm length`);
 if(Math.abs(-bk.z0-zAt(SL.top)-SL.buckle)>.6)bad(tag,`the buckle piece ends ${(-bk.z0-zAt(SL.top)-SL.buckle).toFixed(2)}mm off its ${SL.short}mm length`);
 for(const which of['top','bottom']){const tex=w.getObjectByName('strap:'+which).material.map.image;
  if(tex.height>4096)bad(tag,`the ${which} strap bake is ${tex.height}px tall, past a phone GPU's 4096`)}}
/* the longest strap there can be still bakes within a phone's texture limit */
for(const variant of['classic','sport'])for(const strapMm of[12,'auto',26]){
 const d=M.clone(M.DEF);d.caseMm=46;d.case.lugLenMm=12;d.parts.case.variant=variant;d.strapMm=strapMm;
 for(const which of['top','bottom']){const{h}=bakeSize('strap','flat',d,which);
  if(h>4096)bad(`strap bake ${variant}/${strapMm}/${which}`,`${h}px tall, past 4096`)}}

/* wear: exposed metal wears and nothing under the crystal does; every brushed
   surface has UVs to grain along (without them the highlight blows out white);
   the generated tiles repeat without a seam */
{const W=await import('./src/core/three/wear.js');
 for(const finish of['polished','brushed','matte'])for(const wear of['new','light','worn']){
  const d=M.clone(M.DEF);d.parts.case.finish=finish;d.case.wear=wear;const tag=`wear ${finish}/${wear}`;
  let w;try{w=M.buildHead(d,{})}catch(e){bad(tag,'3D build threw: '+e.message);continue}
  let worn=0;
  for(const[part,g]of Object.entries(w.userData.groups))g.traverse(o=>{if(!o.isMesh)return;
   const key=o.material.customProgramCacheKey?o.material.customProgramCacheKey():'';
   if(key.includes('ws-wear')){worn++;if(['dial','markers','hands','crystal'].includes(part))bad(tag,`${o.name} under the crystal wears`)}
   if(o.material.anisotropy>0&&!o.geometry.attributes.uv)bad(tag,`${o.name} is brushed but has no UVs`)});
  if(worn<4)bad(tag,`only ${worn} meshes wear`)}
 /* the step across the tile edge against the step just inside it, across
    columns or (rows) across rows — the weave steps at every column by design */
 const seam=(t,ch,rows)=>{const{data,width:w,height:h}=t.image,px=(x,y)=>rows?data[(x*w+y)*4+ch]:data[(y*w+x)*4+ch];
  const n=rows?h:w;let edge=0,inner=0;
  for(let y=0;y<(rows?w:h);y++){const a=px(n-1,y),b=px(0,y),c=px(n-2,y);edge+=Math.abs(a-b);inner+=Math.abs(a-c)}
  return edge/Math.max(1,inner)};
 for(const[name,t,ch,rows]of[['wear haze',W.wearMap(),1],['grain',W.grainMap(),0],['leather',W.strapGrainMap('leather'),0],
  ['rubber',W.strapGrainMap('rubber'),0],['nato',W.strapGrainMap('nato'),1,true]])
  if(seam(t,ch,rows)>2.5)bad('wear textures',`${name} has a seam where it tiles (${seam(t,ch,rows).toFixed(2)}x the step inside)`)}

/* photo staging: every surface builds, its textures tile, and the path tracer's
   panorama is the same room the live views reflect — brightest at 12, with the
   softbox straight up and the dark background below the table's reach */
{const Sf=await import('./src/core/three/surfaces.js'),St=await import('./src/core/three/studio.js');
 /* The step across the tile's edge, against the largest step between any two
    neighbouring columns (rows) inside it: a woven or quantised pattern has
    steps of its own, and only an edge sharper than all of them is a seam. */
 const seam=(t,ch,rows)=>{const{data,width:w,height:h}=t.image;
  const px=(i,j)=>rows?data[(i*w+j)*4+ch]:data[(j*w+i)*4+ch],n=rows?h:w,m=rows?w:h;
  const step=(i0,i1)=>{let s=0;for(let j=0;j<m;j+=3)s+=Math.abs(px(i0,j)-px(i1,j));return s};
  let inner=0;for(let i=0;i<n-1;i++)inner=Math.max(inner,step(i,i+1));
  return step(n-1,0)/Math.max(1,inner)};
 const seamX=(t,ch)=>seam(t,ch,false),seamY=(t,ch)=>seam(t,ch,true);
 for(const id of Sf.SURFACE_IDS){const m=Sf.surfaceMesh(id,-5);
  if(id==='none'){if(m)bad('surfaces','"none" should build no mesh');continue}
  if(!m){bad('surfaces',`${id} built nothing`);continue}
  if(Math.abs(m.position.y+5)>1e-9)bad('surfaces',`${id} is not at the table height`);
  for(const[k,t]of[['colour',m.material.map],['normal',m.material.normalMap]]){
   const sx=seamX(t,0),sy=seamY(t,0);
   if(sx>1.25||sy>1.25)bad('surfaces',`${id} ${k} map has a seam where it tiles (${sx.toFixed(2)} / ${sy.toFixed(2)})`)}}
 const eq=St.studioEquirect(256,128),{data,width:w,height:h}=eq.image;
 const at=(u,v)=>data[(Math.min(h-1,Math.floor(v*h))*w+Math.min(w-1,Math.floor(u*w)))*4];
 /* three's equirect: u = atan2(z, x)/2pi + .5, so -z (12) is u=.25 and +z (6) is u=.75 */
 if(!(at(.25,.5)>at(.75,.5)))bad('studio panorama',`12 o'clock (${at(.25,.5).toFixed(2)}) should be brighter than 6 (${at(.75,.5).toFixed(2)})`);
 if(!(at(.5,.99)>1))bad('studio panorama',`straight up should see the softbox (${at(.5,.99).toFixed(2)})`);
 /* dark walls at 3 and 9 o'clock (+x is u=.5) */
 if(!(at(.5,.5)<at(.25,.5)))bad('studio panorama','3 o\'clock should be darker than 12');
 /* 30 degrees up falls between the horizon band's top and the softbox's rim: the dark room */
 if(!(at(.5,.5+30/180)<.05))bad('studio panorama',`the gap above the horizon should be dark (${at(.5,.5+30/180).toFixed(3)})`);
 /* a photo carries the wear as roughness: more wear, duller; the dial never */
 const Wr=await import('./src/core/three/wear.js');
 const rough=level=>{const d=M.clone(M.DEF);d.case.wear=level;d.parts.case.finish='polished';const w=M.buildHead(d,{});
  const flank=w.getObjectByName('flank'),dial=w.getObjectByName('dial');
  return[Wr.wearRoughness(flank.material),dial?Wr.wearRoughness(dial.material):0]};
 const[n,l,wo]=['new','light','worn'].map(rough);
 if(!(n[0]<l[0]&&l[0]<wo[0]))bad('photo wear',`flank roughness should rise with wear (${n[0].toFixed(3)}, ${l[0].toFixed(3)}, ${wo[0].toFixed(3)})`);
 if(n[1]||l[1]||wo[1])bad('photo wear','the dial should not wear in a photo')}

/* dimension sweep: extreme parameter values must not invert the stack or push
   a part off the sheet — these are exactly the corners the UI sliders allow */
for(const caseMm of[34,40,46])for(const bezelMm of[1.2,2.5,5.5]){
 const d=M.clone(M.DEF);d.caseMm=caseMm;d.bezelMm=bezelMm;
 const g=G.geoOf(d);
 if(!(g.rBezIn>g.dialR))bad(`sweep ${caseMm}/${bezelMm}`,'bezel swallowed the rehaut');
 if(!(g.rBezOut>g.rBezIn))bad(`sweep ${caseMm}/${bezelMm}`,'bezel inverted');
 for(const thicknessMm of[6,12,20]){const d2=M.clone(d);d2.case.thicknessMm=thicknessMm;checkHead(`sweep ${caseMm}/${bezelMm}/${thicknessMm}mm`,d2)}
}
for(const caseMm of[34,40,46])for(const crownMm of[3.5,6.5,10])for(const v of['standard','oversized']){
 const d=M.clone(M.DEF);d.caseMm=caseMm;d.crownMm=crownMm;d.parts.crown.variant=v;
 const g=G.geoOf(d),sc=v==='oversized'?1.22:1;
 const tip=C+g.R+g.crownR*0.30+g.crownR*1.5*sc;
 if(tip>CAN)bad(`crown ${caseMm}/${crownMm}/${v}`,`tip at ${tip.toFixed(0)}px runs off the ${CAN}px sheet`);
}
/* lug length is the v5 input (lug-to-lug is derived from it); sweep the slider's
   full 3-12 mm range, not the v4 top-level field nothing reads any more */
for(const caseMm of[34,40,46])for(const lugLenMm of[3,6.5,12]){
 const d=M.clone(M.DEF);d.caseMm=caseMm;d.case.lugLenMm=lugLenMm;
 const g=G.geoOf(d),tag=`lug ${caseMm}/${lugLenMm}`;
 const wantLen=Math.max(lugLenMm,G.lugLenMinOf(caseMm));
 if(G.caseOf(d).lugLen!==wantLen)bad(tag,`lug length ${G.caseOf(d).lugLen}mm, expected ${wantLen}mm`);
 if(C+g.R+g.lugExt>CAN)bad(tag,'lug tip runs off the sheet');
 if(Math.abs((g.R+g.lugExt)*2-G.lugToLugOf(d)*PX)>1.5)bad(tag,`lug span ${((g.R+g.lugExt)*2/PX).toFixed(1)}mm != lug-to-lug ${G.lugToLugOf(d)}mm`);
}

/* dial construction: a date window is cut through the plate, so it has to stay
   clear of the minute track (or the chapter step), of the registers and of the
   dial's edge; the wheel under it has to cover it; neighbouring days must not
   show in it; and the index it replaces has to be the one under it */
for(const caseMm of[34,40,46])for(const variant of['sunburst','chrono'])for(const date of['none','3','430','6'])for(const step of['flat','stepped']){
 const d=M.clone(M.DEF);d.caseMm=caseMm;Object.assign(d.parts.dial,{variant,date,step});
 const L=G.dialLayoutOf(d),tag=`dial ${caseMm}/${variant}/date ${date}/${step}`;
 if(variant==='chrono'&&date==='6'&&L.date!=='430')bad(tag,'a chronograph date at 6 should move to 4:30');
 if(L.subdials.length!==(variant==='chrono'?3:0))bad(tag,`expected ${variant==='chrono'?3:0} registers, got ${L.subdials.length}`);
 for(const sd of L.subdials)if(Math.hypot(sd.x-C,sd.y-C)+sd.r>=(step==='stepped'?L.stepR:L.r*.9))bad(tag,`the ${sd.key} register reaches the ${step==='stepped'?'chapter step':'minute track'}`);
 checkHead(tag,d);
 if(!L.win){if(date!=='none')bad(tag,'no window for a date');continue}
 const w=L.win,hx=w.w/2+w.frame,hy=w.h/2+w.frame;
 const corners=[[-1,-1],[1,-1],[-1,1],[1,1]].map(([sx,sy])=>[w.x+sx*hx,w.y+sy*hy]);
 const reach=Math.max(...corners.map(([x,y])=>Math.hypot(x-C,y-C)));
 const limit=step==='stepped'?L.stepR:L.r*.905;       /* long track ticks end at 0.908 r */
 if(reach>=limit)bad(tag,`window frame reaches ${(reach/L.r).toFixed(3)} r, past ${(limit/L.r).toFixed(3)} r`);
 for(const sd of L.subdials){
  const nx=Math.max(w.x-hx,Math.min(sd.x,w.x+hx)),ny=Math.max(w.y-hy,Math.min(sd.y,w.y+hy));
  if(Math.hypot(sd.x-nx,sd.y-ny)<=sd.r)bad(tag,`window overlaps the ${sd.key} register`)}
 const cr=Math.hypot(w.x-C,w.y-C),span=Math.hypot(w.w,w.h)/2+w.frame*3;
 const near=Math.min(...corners.map(([x,y])=>Math.hypot(x-C,y-C)));
 if(reach>cr+span||near<cr-span)bad(tag,'the date wheel does not cover the window');
 const want={'3':3,'6':6,'430':null}[L.date];
 if(w.skipHour!==want)bad(tag,`the window should replace index ${want}, replaces ${w.skipHour}`);
 /* the wheel's pitch against the window's extent along the wheel's travel there,
    less half a numeral (bold digits ~0.56 em wide each, ~0.72 em tall) */
 const pitch=cr*2*Math.PI/31,tx=Math.abs(Math.cos(w.deg*Math.PI/180)),ty=Math.abs(Math.sin(w.deg*Math.PI/180));
 const font=w.h*.72,halfTravel=tx*w.w/2+ty*w.h/2,glyphHalf=tx*font*.56+ty*font*.36;
 if(pitch-glyphHalf<=halfTravel)bad(tag,`neighbouring days would show (pitch ${pitch.toFixed(1)}px, window ${halfTravel.toFixed(1)}px)`);
}

/* finish zones: a brushed case, bezel and crown keep polished bevels; a polished
   one is polished and a blasted one blasted everywhere; the lugs' edges are
   their own faces, a real share of the lug and not all of it */
{const MT=await import('./src/core/three/materials.js');
 const ZONES={caseback:'turned',casebackRim:'bevel',flank:'surface',chamfer:'bevel',seat:'bevel',lugs:'surface',lugEdges:'bevel',
  guards:'surface',guardEdges:'bevel',pusherShoulder:'surface',pusherHead:'bevel',
  crownTube:'bevel',crownInner:'surface',crownSide:'surface',crownEnd:'bevel',
  bezelFlank:'surface',bezelEdge:'bevel',bezelTop:'surface',bezelInner:'bevel'};
 const WANT={polished:{surface:'polished',bevel:'polished',turned:'brushed'},brushed:{surface:'brushed',bevel:'polished',turned:'brushed'},
  matte:{surface:'matte',bevel:'matte',turned:'matte'}};
 for(const finish of['polished','brushed','matte'])for(const variant of['classic','sport']){
  const d=M.clone(M.DEF);Object.assign(d.parts.case,{finish,variant});d.parts.bezel.finish=finish;d.parts.crown.finish=finish;
  d.case.pushers=true;d.parts.bezel.variant='diver';
  const tag=`zones ${finish}/${variant}`;let w;try{w=M.buildHead(d,{})}catch(e){bad(tag,'3D build threw: '+e.message);continue}
  const seen=new Set();
  w.traverse(o=>{if(!o.isMesh||!(o.name in ZONES))return;seen.add(o.name);
   const got=MT.finishOf.get(o.material),want=WANT[finish][ZONES[o.name]];
   if(got!==want)bad(tag,`${o.name} is ${got}, a ${ZONES[o.name]} of a ${finish} part should be ${want}`)});
  for(const n of Object.keys(ZONES))if(!seen.has(n)&&!(n.startsWith('guard')&&variant!=='sport'))bad(tag,`no ${n} mesh`);
  const tris=n=>{let c=0;w.traverse(o=>{if(o.isMesh&&o.name===n)c+=o.geometry.index.count/3});return c};
  const share=tris('lugEdges')/(tris('lugs')+tris('lugEdges'));
  if(!(share>.1&&share<.8))bad(tag,`the lugs' edges are ${(share*100).toFixed(0)}% of the lug`)}}

/* dial elements at real sizes: a date window is the movement's aperture, never
   larger and only smaller where a small dial has no room; registers sit where
   the movement puts them and replace the indices they reach into; a chronograph
   date at 3 moves to 4:30 only where it cannot fit; the printing is at its size
   in mm and stays clear of registers and the window */
{const DM=G.DIAL_MM;
 for(const caseMm of[34,40,46])for(const variant of['sunburst','chrono'])for(const date of['none','3','430','6'])for(const step of['flat','stepped']){
  const d=M.clone(M.DEF);d.caseMm=caseMm;Object.assign(d.parts.dial,{variant,date,step});
  const L=G.dialLayoutOf(d),tag=`dial mm ${caseMm}/${variant}/date ${date}/${step}`,mm=v=>v/PX;
  if(L.win){const key=variant==='chrono'&&L.date==='3'?'chrono3':L.date,[mw,mh]=DM.date[key];
   if(mm(L.win.w)>mw+1e-9||mm(L.win.h)>mh+1e-9)bad(tag,`window ${mm(L.win.w).toFixed(2)}x${mm(L.win.h).toFixed(2)}mm, larger than the movement's ${mw}x${mh}mm`);
   if(caseMm===46&&(Math.abs(mm(L.win.w)-mw)>1e-9||Math.abs(mm(L.win.h)-mh)>1e-9))bad(tag,`window ${mm(L.win.w).toFixed(2)}x${mm(L.win.h).toFixed(2)}mm on a dial with room for ${mw}x${mh}mm`);
   if(!L.skipHours.includes(L.win.skipHour)&&L.win.skipHour!=null)bad(tag,'the date window does not replace its index')}
  if(variant==='chrono'){
   const rs=mm(L.subdials[0].r),dist=Math.hypot(L.subdials[0].x-C,L.subdials[0].y-C)/PX;
   if(caseMm>=40&&Math.abs(rs-DM.register.r)>1e-9)bad(tag,`registers ${(rs*2).toFixed(1)}mm across on a dial with room for ${DM.register.r*2}mm`);
   if(dist>DM.register.dist+1e-9)bad(tag,`registers ${dist.toFixed(1)}mm out, beyond the movement's ${DM.register.dist}mm`);
   if(!(dist*Math.SQRT2>2*rs))bad(tag,'neighbouring registers overlap');
   const reachesIndices=(dist+rs+.2)>G.indexInnerOf(d)*mm(L.r);
   if(reachesIndices!==[3,6,9].every(h=>L.skipHours.includes(h)))bad(tag,`indices at 3, 6 and 9 ${reachesIndices?'kept under':'left out beside'} the registers`);
   if(date==='3'){const room=(step==='stepped'?L.r*.915:L.r*.905)/PX-(dist+rs);
    if((L.date==='3')!==(room>=Math.min(DM.date.chrono3[0],L.r*.18/PX)+2*DM.date.frame+.6))bad(tag,`a chronograph date at 3 sits at ${L.date} with ${room.toFixed(2)}mm between register and track`)}}
  /* the printing */
  const T=G.dialTextOf(d);
  if(Math.abs(T.brand.size-DM.text.brand*PX)>1e-9||Math.abs(T.line.size-DM.text.line*PX)>1e-9)bad(tag,'dial text is not at its printed size');
  const boxes=[...L.subdials.map(s=>[s.x-s.r,s.x+s.r,s.y-s.r,s.y+s.r]),...(L.win?[[L.win.x-L.win.w/2-L.win.frame,L.win.x+L.win.w/2+L.win.frame,L.win.y-L.win.h/2-L.win.frame,L.win.y+L.win.h/2+L.win.frame]]:[])];
  for(const[n,t]of[['brand',T.brand],['model line',T.line]]){
   if(!(t.maxW>=3*PX))bad(tag,`the ${n} has only ${mm(t.maxW).toFixed(1)}mm to print in`);
   const tb=[C-t.maxW/2,C+t.maxW/2,t.y-t.size*.6,t.y+t.size*.6];
   for(const b of boxes)if(tb[0]<b[1]&&tb[1]>b[0]&&tb[2]<b[3]&&tb[3]>b[2])bad(tag,`the ${n} runs into a register or the date window`)}}}

/* the movement behind an exhibition caseback: inside the case between the
   caseback and the dial, wider than the window and no wider than the dial,
   clear of the sapphire window; a balance (or glide wheel) that swings, a
   rotor only where one winds it, a battery only in a quartz */
{const MV=await import('./src/core/three/movement.js');
 const within=(w,H,R,tag,g0top)=>{let y0=1e9,y1=-1e9,rad=0,n=0;w.updateMatrixWorld(true);
  w.getObjectByName('movement').traverse(o=>{if(!o.isMesh)return;const e=o.matrixWorld.elements,p=o.geometry.attributes.position;
   for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const X=e[0]*x+e[4]*y+e[8]*z+e[12],Y=e[1]*x+e[5]*y+e[9]*z+e[13],Z=e[2]*x+e[6]*y+e[10]*z+e[14];
    y0=Math.min(y0,Y);y1=Math.max(y1,Y);rad=Math.max(rad,Math.hypot(X,Z));n++}});
  if(!n){bad(tag,'the movement has no parts');return}
  if(y0<g0top-1e-6)bad(tag,`the movement reaches ${(g0top-y0).toFixed(2)}mm into the caseback window`);
  if(y0<H.back-1e-6)bad(tag,'the movement pokes out of the caseback');
  if(y1>H.dial-H.stack.dial+1e-6)bad(tag,`the movement stands ${(y1-(H.dial-H.stack.dial)).toFixed(2)}mm into the dial`);
  if(rad>R.dialR+1e-6)bad(tag,`the movement is ${(rad*2).toFixed(1)}mm across, wider than the ${(R.dialR*2).toFixed(1)}mm dial`)};
 for(const kind of['automatic','manual','spring','quartz'])for(const caseMm of[34,46]){
  const d=M.clone(M.DEF);d.caseMm=caseMm;Object.assign(d.case,{caseback:'exhibition',movement:kind});
  const tag=`movement ${kind}/${caseMm}`;let w;try{w=M.buildHead(d,{})}catch(e){bad(tag,'3D build threw: '+e.message);continue}
  const{heights:H,radii:R}=L3.headProfiles(d),L=MV.movementLayout(kind,H,R);
  if(!w.getObjectByName('movement')){bad(tag,'no movement behind the window');continue}
  const glass=w.getObjectByName('backGlass');
  if(!glass||!(volumeOf(glass.geometry)>0)){bad(tag,'the caseback window is not a closed sapphire solid');continue}
  glass.geometry.computeBoundingBox();
  within(w,H,R,tag,glass.geometry.boundingBox.max.y);
  if(!(L.r>L.rw))bad(tag,`the movement (${L.r.toFixed(1)}mm) is narrower than the window (${L.rw.toFixed(1)}mm)`);
  const spins=new Set();w.traverse(o=>{if(o.userData.spin)spins.add(o.userData.spin)});
  const wantSpin=kind==='spring'?'glide':kind==='quartz'?null:'balance';
  if(wantSpin&&!spins.has(wantSpin))bad(tag,`no ${wantSpin} turning`);
  if(!wantSpin&&(spins.has('balance')||spins.has('glide')))bad(tag,'a quartz movement with a balance');
  const has=n=>{let f=false;w.traverse(o=>{if(o.name===n)f=true});return f};
  if(has('rotor')!==(kind==='automatic'||kind==='spring'))bad(tag,`rotor ${has('rotor')?'on':'missing from'} a ${kind} movement`);
  if(has('movement:battery')!==(kind==='quartz'))bad(tag,'the battery belongs to a quartz movement only')}
 {const d=M.clone(M.DEF);d.case.caseback='solid';if(M.buildHead(d,{}).getObjectByName('movement'))bad('movement','a movement shows behind a solid caseback')}
 /* the beat: 28,800 an hour swings to full amplitude a sixteenth of a second in; 21,600 a twelfth */
 const A=G.movementAngles;
 if(Math.abs(A('automatic',1000/16).balance-G.BALANCE_AMPLITUDE_DEG)>1e-6||Math.abs(A('manual',1000/12).balance-G.BALANCE_AMPLITUDE_DEG)>1e-6)bad('beat','the balance does not beat at 28,800 / 21,600 vph');
 if(A('quartz',123).balance!==0||Math.abs(A('spring',1000/16).glide-180)>1e-6)bad('beat','a quartz swings, or a glide wheel does not turn 8 times a second')}

/* the crystal is a closed solid of sapphire: its underside clears the hands
   everywhere over the dial, it is never ground thinner than a crystal can be,
   and its rim rests above the rehaut. A cyclops sits on a flat top over the
   date, within the crystal, and magnifies it about 2.5x. */
for(const crystal of['flat','dome','box'])for(const bezel of['smooth','diver'])for(const caseMm of[34,46])
 for(const crystalMm of crystal==='flat'?[.6,1.1,2.5]:crystal==='box'?[2,5]:[.8,4]){
 const d=M.clone(M.DEF);d.caseMm=caseMm;d.parts.bezel.variant=bezel;Object.assign(d.case,{crystal,crystalMm});
 d.parts.dial.date='3';d.parts.crystal.cyclops=true;
 const tag=`crystal ${crystal} ${crystalMm}mm/${bezel}/${caseMm}`;
 const{heights:H,radii:R,crystal:CR}=L3.headProfiles(d);
 const outerAt=x=>{const o=CR.outer;for(let i=1;i<o.length;i++){const p=o[i-1],q=o[i];
  if((x-p.x)*(x-q.x)<=0&&p.x!==q.x)return p.y+(q.y-p.y)*(x-p.x)/(q.x-p.x)}return H.top};
 for(let x=0;x<=CR.rStep;x+=CR.rStep/40){const u=CR.under(x),handTop=H.dial+G.handsTopAt(x);
  if(u<handTop-1e-6)bad(tag,`the underside at ${x.toFixed(1)}mm is ${(handTop-u).toFixed(2)}mm into the hands`);
  if(!(outerAt(x)-u>.3))bad(tag,`the crystal is ${(outerAt(x)-u).toFixed(2)}mm thick at ${x.toFixed(1)}mm`)}
 if(!(CR.thickness>=.35&&CR.thickness<=1.2))bad(tag,`crystal ${CR.thickness.toFixed(2)}mm thick at its centre`);
 const rehautAt=x=>H.dial+(x-R.dialR)/(R.rBezIn-R.dialR)*(CR.c0-H.dial);
 if(!(CR.c0>rehautAt(CR.rStep)))bad(tag,'the crystal rim sinks into the rehaut');
 let w;try{w=M.buildHead(d,{})}catch(e){bad(tag,'3D build threw: '+e.message);continue}
 /* the group and the mesh are both named crystal: take the mesh */
 const meshNamed=n=>{let f=null;w.traverse(o=>{if(!f&&o.isMesh&&o.name===n)f=o});return f};
 const cm=meshNamed('crystal'),cy=meshNamed('cyclops');
 if(!(volumeOf(cm.geometry)>0))bad(tag,`the crystal is not a closed outward solid (volume ${volumeOf(cm.geometry).toFixed(2)})`);
 const spec=G.cyclopsOf(d);
 if(crystal==='dome'){if(cy||spec)bad(tag,'a domed crystal has no flat top for a cyclops');continue}
 if(!cy||!spec){bad(tag,'no cyclops over the date');continue}
 if(!(volumeOf(cy.geometry)>0))bad(tag,`the cyclops is not a closed outward solid (volume ${volumeOf(cy.geometry).toFixed(3)})`);
 if(Math.hypot(spec.x,spec.z)+spec.rho>R.rBezIn-.5)bad(tag,'the cyclops runs off the crystal\'s flat top');
 const L=G.dialLayoutOf(d);
 if(!(spec.A*2>L.win.w/PX&&spec.B*2>L.win.h/PX))bad(tag,'the cyclops is smaller than the window it magnifies');
 if(!(spec.mag>1.6&&spec.mag<=G.CYCLOPS_MAG+1e-9))bad(tag,`the cyclops magnifies ${spec.mag.toFixed(2)}x`);
 if(!(spec.height>.5&&spec.height<2.6))bad(tag,`the cyclops stands ${spec.height.toFixed(2)}mm tall`);
 if(Math.abs(cy.position.y-H.top)>1e-6)bad(tag,'the cyclops is not on the crystal')}
/* no date window, no cyclops */
{const d=M.clone(M.DEF);d.case.crystal='flat';d.parts.crystal.cyclops=true;d.parts.dial.date='none';
 if(G.cyclopsOf(d)||M.buildHead(d,{}).getObjectByName('cyclops'))bad('cyclops','a cyclops without a date window')}

/* hands point at what they read: the seconds hand to the outer end of the
   minute track, the minute hand into it, the hour hand to the inner end of the
   indices — and each is visibly shorter than the one above it */
for(const caseMm of[34,40,46])for(const variant of Object.keys(G.INDEX_DEPTH)){
 const d=M.clone(M.DEF);d.caseMm=caseMm;d.parts.markers.variant=variant;
 const h=G.handLengthsOf(d),r=G.geoOf(d).dialR,tag=`hands ${caseMm}/${variant}`;
 const trackIn=G.MINUTE_TRACK_R-G.TRACK_TICK_PX.minor/r,idxIn=G.INDEX_OUTER-G.INDEX_DEPTH[variant];
 if(!(h.sec>h.min&&h.min>h.hour))bad(tag,`lengths out of order: hour ${h.hour.toFixed(3)} min ${h.min.toFixed(3)} sec ${h.sec.toFixed(3)}`);
 if(h.sec>G.MINUTE_TRACK_R||h.sec<G.MINUTE_TRACK_R-4/r)bad(tag,`seconds hand ends at ${h.sec.toFixed(3)} r, not at the track's edge ${G.MINUTE_TRACK_R} r`);
 if(h.min<=trackIn||h.min>=G.MINUTE_TRACK_R)bad(tag,`minute hand ends at ${h.min.toFixed(3)} r, outside the minute track ${trackIn.toFixed(3)}-${G.MINUTE_TRACK_R} r`);
 if(h.hour>h.min*.8+1e-9)bad(tag,`hour hand ${(h.hour/h.min*100).toFixed(0)}% of the minute hand`);
 if(h.hour<Math.min(idxIn,h.min*.8)-.001)bad(tag,`hour hand ends at ${h.hour.toFixed(3)} r, short of the indices at ${idxIn.toFixed(3)} r`);
 if(h.hour>G.INDEX_OUTER-.01)bad(tag,`hour hand reaches ${h.hour.toFixed(3)} r, across the indices`);
}

/* a marker set from PartStudio: read from its file, drawn in every bake mode,
   ground on the 3D dial with each index's outer end on the hour ring, making
   room for a date window, reaching the hour hand — and a design whose set is
   missing or broken falls back to batons rather than an empty dial */
{const MS=await import('./src/core/markerset/index.js'),{getProc}=await import('./src/core/cache.js');
 const file={app:'PartStudio',kind:'watchstudio-markers',version:1,name:'Test set',set:{ringRatio:.885,
  styles:[{id:'a',name:'Hours',outline:'baton',lengthMm:3,widthMm:1,lume:'channel'},{id:'b',name:'12',outline:'wedge',lengthMm:2.6,widthMm:2.4,lume:'none'}],
  slots:['b','a','a','a','a','a','a','a','a','a','a','a']}};
 const set=MS.setFromPartStudio(file);
 if(!set||set.styles.length!==2||set.slots[0]!=='b')bad('partstudio','a PartStudio file is not read as its set');
 const project=MS.setFromPartStudio({app:'PartStudio',part:'markers',d:{name:'P',dial:{diameterMm:30,ringMm:12},styles:file.set.styles,slots:file.set.slots}});
 if(!project||Math.abs(project.ringRatio-.8)>1e-9)bad('partstudio','a PartStudio project does not keep its hour ring');
 if(MS.setFromPartStudio({app:'WatchStudio',d:{}})||MS.setFromPartStudio({app:'PartStudio',set:{styles:[]}}))bad('partstudio','something that is not a set was accepted');
 for(const date of['none','3']){const tag=`partstudio date ${date}`;
  const d=M.clone(M.DEF);d.parts.markers.variant='partstudio';d.parts.markers.set=set;d.parts.dial.date=date;
  try{M.buildLayers(d,{});for(const mode of[undefined,'flat','shape','lume'])getProc('markers',d,undefined,mode)}
  catch(e){bad(tag,'2D bake threw: '+e.message)}
  let w;try{w=M.buildHead(d,{})}catch(e){bad(tag,'3D build threw: '+e.message);continue}
  const idx=[],lume=[];w.traverse(o=>{if(o.isMesh&&/^index:/.test(o.name))idx.push(o);if(o.isMesh&&/^indexLume:/.test(o.name))lume.push(o)});
  const want=date==='3'?11:12;
  if(idx.length!==want)bad(tag,`${idx.length} indices ground, expected ${want}`);
  if(lume.length!==want-1)bad(tag,`${lume.length} lume fills, expected ${want-1} (the 12 o'clock wedge has none)`);
  const ring=G.geoOf(d).dialR/PX*.885,at12=idx.find(o=>o.name==='index:0');
  if(!at12||Math.abs(-at12.position.z-ring)>1e-6||Math.abs(at12.position.x)>1e-6)bad(tag,'the 12 o\'clock index is not on the hour ring');
  for(const o of idx){const b=o.geometry.boundingBox||(o.geometry.computeBoundingBox(),o.geometry.boundingBox);
   if(!(b.max.y>.2&&b.min.y===0))bad(tag,`${o.name} is not a solid standing on the dial`)}
  const h=G.handLengthsOf(d),inner=.885-3/(G.geoOf(d).dialR/PX);
  if(h.hour>.885-.01||h.hour<Math.min(inner,h.min*.8)-.001)bad(tag,`hour hand ends at ${h.hour.toFixed(3)} r, not at the set's inner ends ${inner.toFixed(3)} r`)}
 for(const broken of[null,{styles:'x'},{styles:[]}]){const d=M.clone(M.DEF);d.parts.markers.variant='partstudio';d.parts.markers.set=broken;
  /* (the silhouette bake is blank under these canvas mocks, so the batons are
     checked by what they set: the hour hand's length) */
  try{M.buildHead(d,{});getProc('markers',d);
   const b=M.clone(M.DEF);b.parts.markers.variant='batons';
   if(G.handLengthsOf(d).hour!==G.handLengthsOf(b).hour)bad('partstudio broken','a broken set is not measured as batons')}
  catch(e){bad('partstudio broken','a broken set threw: '+e.message)}}}

/* clearances. Height: every applied index stands lower than the hands that
   sweep over its inner end — built-in styles by their ground form, a PartStudio
   set ground from a 1.2 mm design by the solid it becomes. Place: a logo is only
   ever made smaller, and then clears the printing, the date window, the
   registers, the hour indices and the hands' centre. Pose: the seconds hand in a
   posed picture crosses no printing and no date window. */
{const W=await import('./src/core/three/watch.js'),LG=await import('./src/core/logo.js'),TM=await import('./src/core/time.js');
 for(const caseMm of[34,40,46])for(const step of['flat','stepped'])for(const variant of Object.keys(G.INDEX_DEPTH)){
  const d=M.clone(M.DEF);d.caseMm=caseMm;d.parts.dial.step=step;d.parts.markers.variant=variant;
  const lim=G.appliedHeightLimitOf(d),rMm=G.geoOf(d).dialR/PX,inner=G.indexInnerOf(d)*rMm;
  /* indices stand on the sunk centre of a stepped dial, the hands' lifts are from its chapter ring */
  const h=(W.INDEX_FORM[variant]||W.INDEX_FORM.batons).height-(step==='stepped'?G.DIAL_STEP_MM:0);
  if(h>lim(inner)+1e-9)bad(`clearance ${caseMm}/${step}/${variant}`,`indices ${h.toFixed(2)}mm tall where the hands above allow ${lim(inner).toFixed(2)}mm`)}
 {const MS=await import('./src/core/markerset/index.js');
  const set=MS.setFromPartStudio({app:'PartStudio',kind:'watchstudio-markers',version:1,name:'Tall',set:{ringRatio:.885,
   styles:[{id:'a',name:'Hours',outline:'baton',lengthMm:3,widthMm:1,heightMm:1.2,lume:'none'}],slots:Array(12).fill('a')}});
  const d=M.clone(M.DEF);d.parts.markers.variant='partstudio';d.parts.markers.set=set;d.parts.dial.date='none';
  const w=M.buildHead(d,{});w.updateMatrixWorld(true);const H=w.userData.heights,lim=G.appliedHeightLimitOf(d),rMm=G.geoOf(d).dialR/PX;
  let n=0;w.traverse(o=>{if(!(o.isMesh&&/^index:/.test(o.name)))return;n++;
   o.geometry.computeBoundingBox();const top=o.position.y+o.geometry.boundingBox.max.y-H.dial,allow=lim(rMm*.885-3);
   if(top>allow+1e-3)bad('clearance partstudio',`${o.name} stands ${top.toFixed(2)}mm, the hands allow ${allow.toFixed(2)}mm`)});
  if(n!==12)bad('clearance partstudio',`${n} indices ground from the tall set`)}
 const boxesOf=(d,pad)=>{const L=G.dialLayoutOf(d),T=G.dialTextOf(d),t=d.parts.dial.text,o=[];
  if(t.top)o.push({k:'brand',y0:T.brand.y-T.brand.size*.6-pad,y1:T.brand.y+T.brand.size*.6+pad,x0:-1e9,x1:1e9});
  if(t.bottom)o.push({k:'line',y0:T.line.y-T.line.size*.6-pad,y1:T.line.y+T.line.size*.6+pad,x0:-1e9,x1:1e9});
  if(L.win){const v=L.win;o.push({k:'window',x0:v.x-v.w/2-v.frame-pad,x1:v.x+v.w/2+v.frame+pad,y0:v.y-v.h/2-v.frame-pad,y1:v.y+v.h/2+v.frame+pad})}
  return o};
 for(const caseMm of[34,46])for(const variant of['sunburst','chrono'])for(const date of['none','3','6'])for(const text of[true,false])
 for(const size of[.34,1.1])for(const y of[-.6,-.3,.45])for(const aspect of[1,.25]){
  const d=M.clone(M.DEF);d.caseMm=caseMm;Object.assign(d.parts.dial,{variant,date,logo:{style:'print',color:'ink',size,y}});
  if(!text)d.parts.dial.text={...d.parts.dial.text,top:'',bottom:''};
  const tag=`logo ${caseMm}/${variant}/date ${date}/${text?'text':'no text'}/size ${size}/y ${y}/aspect ${aspect}`;
  const B=LG.logoBoxOf(d,aspect),r=G.geoOf(d).dialR,L=G.dialLayoutOf(d);
  if(B.scale>1+1e-9)bad(tag,'the logo was made larger');
  if(!B.limitedBy&&B.scale!==1)bad(tag,'the logo was made smaller with nothing in its way');
  if(!B.clear)continue;
  const b={x0:B.x-B.w/2,x1:B.x+B.w/2,y0:B.y-B.h/2,y1:B.y+B.h/2};
  for(const o of boxesOf(d,.39*PX))if(b.x0<o.x1&&b.x1>o.x0&&b.y0<o.y1&&b.y1>o.y0)bad(tag,`the logo runs into the ${o.k}`);
  for(const s of[...L.subdials,{x:C,y:C,r:G.HANDS_HUB_MM*PX-1e-6}]){const nx=Math.max(b.x0,Math.min(s.x,b.x1)),ny=Math.max(b.y0,Math.min(s.y,b.y1));
   if(Math.hypot(nx-s.x,ny-s.y)<s.r)bad(tag,'the logo runs into a register or the hands\' centre')}
  for(const[x,yy]of[[b.x0,b.y0],[b.x1,b.y0],[b.x0,b.y1],[b.x1,b.y1]])if(Math.hypot(x-C,yy-C)>G.indexInnerOf(d)*r)bad(tag,'the logo reaches under the hour indices')}
 {const d=M.clone(M.DEF);d.parts.dial.date='none';d.parts.dial.text={...d.parts.dial.text,top:'',bottom:''};d.parts.dial.logo={size:.3,y:-.55};
  if(LG.logoBoxOf(d,.5).scale!==1)bad('logo','a small logo with room around it was resized')}
 for(const caseMm of[34,40,46])for(const variant of['sunburst','chrono'])for(const date of['none','3','430','6']){
  const d=M.clone(M.DEF);d.caseMm=caseMm;Object.assign(d.parts.dial,{variant,date});d.parts.dial.text={...d.parts.dial.text,bottom:'AUTOMATIC CHRONOMETER'};
  const s=G.marketingSecondsOf(d),clock=TM.marketingClock(d);
  if(variant!=='chrono'&&Math.abs(clock.ang.sec-s*6)>1e-9)bad(`pose ${caseMm}/${variant}/${date}`,'the posed picture does not use the clear second');
  const r=G.geoOf(d).dialR,len=G.handLengthsOf(d).sec*r,a=s*6*Math.PI/180,ux=Math.sin(a),uy=-Math.cos(a);
  /* the printing at its estimated width and the window, from dialBoxesOf; the hand sampled here on its own */
  const boxes=G.dialBoxesOf(d,.19*PX).map(o=>({...o,k:o.kind}));
  let hit=null;for(let t=-r*.22;t<=len;t+=.1*PX){const x=C+ux*t,yy=C+uy*t;for(const o of boxes)if(x>o.x0&&x<o.x1&&yy>o.y0&&yy<o.y1)hit=o.k}
  /* a design can leave no clear second: then only the fallback is allowed */
  if(hit&&s!==G.MARKETING_SECONDS[0])bad(`pose ${caseMm}/${variant}/${date}`,`the seconds hand at ${s}s crosses the ${hit}`)}}

/* a rotating insert's scale is engraved (a normal map and a metal fill map on
   its own UVs) and its lume pip stands proud in a setting that turns with it */
for(const variant of['diver','gmt']){const d=M.clone(M.DEF);d.parts.bezel.variant=variant;const tag=`insert ${variant}`;
 let w;try{w=M.buildHead(d,{})}catch(e){bad(tag,'3D build threw: '+e.message);continue}
 const ins=w.getObjectByName('bezelIns');
 if(!ins){bad(tag,'no insert');continue}
 if(!(ins.material.normalMap&&ins.material.metalnessMap&&ins.material.roughnessMap===ins.material.metalnessMap))bad(tag,'the insert\'s scale is not engraved and filled');
 const pip=ins.getObjectByName('bezelPip'),lume=ins.getObjectByName('bezelPipLume');
 if(!(pip&&lume))bad(tag,'no raised lume pip on the insert');
 else{lume.geometry.computeBoundingBox();pip.geometry.computeBoundingBox();
  if(!(lume.geometry.boundingBox.max.y>pip.geometry.boundingBox.max.y))bad(tag,'the lume pip does not stand above its setting');
  if(!(lume.geometry.boundingBox.max.z<0))bad(tag,'the pip is not at 12 o\'clock');
  if(!lume.material.userData.lume)bad(tag,'the pip\'s lume is not marked as lume')}}

/* night mode lights what is marked as lume: the indices' lume, the hands' lume
   and a rotating insert's pip, each in its own colour — and nothing else */
{const d=M.clone(M.DEF);d.parts.bezel.variant='diver';d.parts.hands.variant='sword';d.parts.markers.lume='#9fd8ff';
 const w=M.buildHead(d,{}),lume=new Map();
 w.traverse(o=>{if(o.isMesh&&o.material.userData&&o.material.userData.lume)lume.set(o.name,o.material.userData.lume)});
 for(const n of['indicesLume','bezelPipLume'])if(!lume.has(n))bad('night',`${n} is not marked as lume`);
 /* (hands are ground from their baked silhouette, blank under these mocks: their lume is checked in e2e/tests/night.mjs) */
 if(lume.get('indicesLume')!=='#9fd8ff')bad('night',`the indices glow ${lume.get('indicesLume')}, not their lume colour`);
 for(const n of lume.keys())if(!/Lume$/.test(n))bad('night',`${n} is marked as lume`)}

/* the tech pack's PDF writer: every cross-reference offset lands on its object,
   brackets and backslashes are escaped, WinAnsi characters are written as
   their bytes, and text is measured with Helvetica's own widths (the centring
   and right-aligning of every label depends on that) */
{const PDF=await import('./src/export/pdf.js');
 const doc=PDF.createPDF({title:'Check'}),pg=doc.page(297,210);
 pg.text(10,10,'Ø40.0 — (a\\b)',{size:9});pg.rect(10,20,50,30,{stroke:'#000'});pg.shape([[[0,0],[5,0],[5,5]]],{fill:'#123456'});
 doc.page(210,297).circle(50,50,10,{stroke:'#f00',dash:[1,1]});
 const bytes=await doc.bytes(),x=PDF.pdfOffsets(bytes),raw=Buffer.from(bytes).toString('latin1');
 if(!x.startOk||x.entries.length<8||!x.entries.every(e=>e.ok))bad('pdf',`cross-reference offsets are wrong: ${JSON.stringify(x.entries.filter(e=>!e.ok))}`);
 if(!raw.startsWith('%PDF-1.4')||!/\/Count 2/.test(raw))bad('pdf','not a two-page PDF');
 const w=PDF.textWidth('WatchStudio',10);
 if(Math.abs(w-5669/1000*10/(72/25.4))>1e-9)bad('pdf',`Helvetica width of "WatchStudio" at 10 pt is ${w.toFixed(3)} mm, want ${(5669/100/(72/25.4)).toFixed(3)}`);
 if(PDF.encodable('ساعة')||!PDF.encodable('Ø×°—’'))bad('pdf','WinAnsi coverage is misjudged: Arabic must go to the picture fallback, Ø×°—’ must not')}

/* The case in one piece (casebody.js): for every side profile, lug style,
   drilled or not, classic or sport, small or large —
   - the lugs stand off the strap by LUG_CLEAR_MM, so the pair is as far apart
     as the lug width, and their tips reach the lug-to-lug
   - they rise out of the chamfer but never above the bezel seat
   - their top faces point up (the solids are not built inside out)
   - holes exist only when drilled, a hooded pair leaves a tunnel for the strap
   - the band keeps rCase as its widest radius, and a sloped or drum side is
     drawn in where it should be */
{const CB=await import('./src/core/three/casebody.js');
 for(const side of G.CASE_SIDES)for(const lugs of G.LUG_STYLES)for(const holes of[false,true])for(const variant of['classic','sport'])for(const caseMm of[34,46]){
  if(holes&&(variant==='sport'||caseMm===34)&&side!=='straight')continue;   /* keep the sweep to a few seconds */
  const d=M.clone(M.DEF);d.caseMm=caseMm;d.parts.case.variant=variant;Object.assign(d.case,{side,lugs,lugHoles:holes});
  const tag=`case ${side}/${lugs}${holes?'/drilled':''}/${variant}/${caseMm}`;
  let w;try{w=M.buildHead(d,{})}catch(e){bad(tag,'3D build threw: '+e.message);continue}
  const H=w.userData.heights,Rr=w.userData.radii,lp=L3.lugParts(d),byName=n=>{let f=null;w.traverse(o=>{if(!f&&o.isMesh&&o.name===n)f=o});return f};
  const lugsMesh=byName('lugs'),edges=byName('lugEdges');
  if(!lugsMesh||!edges){bad(tag,'no lug meshes');continue}
  const p=lugsMesh.geometry.attributes.position,nrm=lugsMesh.geometry.attributes.normal;
  let minX=1e9,maxZ=0,maxY=-1e9,topN=null,hoodMin=1e9,hoodMax=-1e9;
  const xi=G.strapMmOf(d)/2+G.LUG_CLEAR_MM;
  for(let i=0;i<p.count;i++){const x=Math.abs(p.getX(i)),y=p.getY(i),z=Math.abs(p.getZ(i));
   if(z>Rr.rCase+.6&&z<lp.z1-.5){if(lugs==='hooded'&&x<xi-.2){hoodMin=Math.min(hoodMin,y);hoodMax=Math.max(hoodMax,y)}else minX=Math.min(minX,x)}
   maxZ=Math.max(maxZ,z);if(y>maxY){maxY=y;topN=nrm.getY(i)}}
  if(lugs!=='hooded'&&lugs!=='integrated'&&Math.abs(minX-xi)>.06)bad(tag,`lug inner faces at ±${minX.toFixed(2)}mm, the strap needs ±${xi.toFixed(2)}mm`);
  if(Math.abs(maxZ-G.lugToLugOf(d)/2)>.3)bad(tag,`lug tips at ${maxZ.toFixed(2)}mm, lug-to-lug says ${(G.lugToLugOf(d)/2).toFixed(2)}mm`);
  if(maxY>H.seat+1e-6)bad(tag,`a lug stands ${(maxY-H.seat).toFixed(2)}mm above the bezel seat`);
  if(!(topN>.3))bad(tag,`the lugs' highest point faces ${topN&&topN.toFixed(2)} (down or sideways): built inside out`);
  /* every normal a unit vector: a zero one (a vertex only zero-area triangles
     touch) breaks the GLB's tangents and the Khronos validator rejects it */
  for(const m of[lugsMesh,edges,byName('guards'),byName('guardEdges')].filter(Boolean)){const a=m.geometry.attributes.normal;let badN=0;
   for(let i=0;i<a.count;i++){const l=Math.hypot(a.getX(i),a.getY(i),a.getZ(i));if(!(Math.abs(l-1)<1e-3))badN++}
   if(badN)bad(tag,`${badN} ${m.name} normals are not unit length`)}
  if(!!byName('lugHoles')!==(holes&&lugs!=='integrated'))bad(tag,holes?'no drilled holes':'holes nobody asked for');
  if(lugs==='hooded'&&!(hoodMax-hoodMin<1.9&&hoodMax>-1e9))bad(tag,`the hood is ${(hoodMax-hoodMin).toFixed(2)}mm deep: no tunnel for the strap`);
  if(!!byName('guards')!==(variant==='sport'))bad(tag,'crown guards do not follow the sport case');
  const B=L3.bandOf(d);let rMax=0,rMin=1e9;for(let i=0;i<=20;i++){const r=B.radiusAt(B.y0+(B.y1-B.y0)*i/20);rMax=Math.max(rMax,r);rMin=Math.min(rMin,r)}
  if(Math.abs(rMax-Rr.rCase)>1e-6)bad(tag,`the band's widest radius is ${rMax.toFixed(3)}, not the case's ${Rr.rCase.toFixed(3)}`);
  if(side==='straight'&&rMin<Rr.rCase-1e-6)bad(tag,'a straight side is not straight');
  if(side==='sloped'&&!(B.radiusAt(B.y0)<B.radiusAt(B.y1)-.2))bad(tag,'a sloped side is not drawn in toward the caseback');
  if(side==='drum'&&!(B.radiusAt((B.y0+B.y1)/2)>B.radiusAt(B.y1)+.1&&B.radiusAt((B.y0+B.y1)/2)>B.radiusAt(B.y0)+.1))bad(tag,'a drum side does not bow out');
  if(side!=='straight'&&rMin<Rr.rCase-1.01)bad(tag,`the side profile cuts ${(Rr.rCase-rMin).toFixed(2)}mm in`)}}

/* Shaped cases and bezels, and integrated ones (caseshape.js, casebody.js):
   - the flank's top ring lies on the case's outline, a flat facing 12
   - a shaped bezel sits as far inside the case's outline as a round one does,
     its flats clear of the crystal opening, and its top arrives round at the
     insert or opening
   - a tonneau, at its shortest, usual and longest, is as long as caseLengthMm
     says, and its lugs reach the stated lug-to-lug
   - the crown stands outside the outline along its bearing, even at a
     cushion's corner
   - an integrated shoulder is solid across the strap plus a wall, and the strap
     or bracelet leaves it flush with its top
   - every normal of the swept parts is a unit vector */
{const CS=await import('./src/core/caseshape.js');
 const pts=(w,n)=>{const out=[];w.traverse(o=>{if(!o.isMesh||o.name!==n)return;w.updateMatrixWorld(true);const a=o.geometry.attributes.position,e=o.matrixWorld.elements;
  for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i),z=a.getZ(i);out.push([e[0]*x+e[4]*y+e[8]*z+e[12],e[1]*x+e[5]*y+e[9]*z+e[13],e[2]*x+e[6]*y+e[10]*z+e[14]])}});return out};
 for(const shape of G.CASE_SHAPES)for(const tl of shape==='tonneau'?CS.TONNEAU_RANGE.concat(CS.TONNEAU_LENGTH):[null])for(const bezelShape of G.BEZEL_SHAPES)for(const lugs of G.LUG_STYLES)for(const [variant,crownPos,strap] of[['classic','3','leather'],['sport','430','steel']]){
  const d=M.clone(M.DEF);Object.assign(d.case,{shape,bezelShape,lugs,crownPos});d.parts.case.variant=variant;d.parts.strap.variant=strap;
  if(tl)d.case.tonneauLen=tl;
  if(variant==='sport')d.parts.bezel.variant='diver';
  const tag=`shape ${shape}${tl?' x'+tl:''}/${bezelShape}/${lugs}/${variant}/${strap}`;
  let w;try{w=M.buildHead(d,{})}catch(e){bad(tag,'3D build threw: '+e.message);continue}
  const O=G.outlinesOf(d),H=w.userData.heights,Rr=w.userData.radii;
  const flank=pts(w,'flank');if(!flank.length){bad(tag,'no flank');continue}
  const yTop=Math.max(...flank.map(p=>p[1]));let off=0;
  for(const p of flank)if(Math.abs(p[1]-yTop)<1e-4)off=Math.max(off,Math.abs(CS.insetOf(O.case.spec,O.case.A0,p[0],p[2])-(Rr.rCase-L3.bandOf(d).radiusAt(yTop))));
  if(off>.02)bad(tag,`the flank's top ring is ${off.toFixed(3)}mm off the case's outline`);
  const bez=pts(w,'bezelFlank'),gap=Rr.rCase-Rr.rBezOut;
  const bezIn=Math.min(...bez.map(p=>CS.insetOf(O.case.spec,O.case.A0,p[0],p[2])));
  if(bezIn<gap-2e-3)bad(tag,`the bezel stands ${(gap-bezIn).toFixed(3)}mm nearer the case's edge than a round bezel does`);
  const bezNear=Math.min(...bez.map(p=>Math.hypot(p[0],p[2])));
  if(bezNear<Rr.rBezIn+.3)bad(tag,`the bezel's flank comes within ${bezNear.toFixed(2)}mm of the centre, into the crystal opening (${Rr.rBezIn.toFixed(2)}mm)`);
  if(G.bezelFit(d,bezelShape).fits!==(O.bezel.kind===bezelShape))bad(tag,'the bezel is built '+O.bezel.kind+' though '+bezelShape+(G.bezelFit(d,bezelShape).fits?' fits':' does not fit'));
  const len=2*Math.max(...flank.map(p=>Math.abs(p[2])));
  if(Math.abs(len-G.caseLengthMm(d))>.08)bad(tag,`the case is ${len.toFixed(2)}mm from 12 to 6, not the ${G.caseLengthMm(d)}mm stated`);
  if(lugs==='straight'){const tipZ=Math.max(...pts(w,'lugs').map(p=>Math.abs(p[2])));
   if(Math.abs(2*tipZ-G.lugToLugMm(d))>.35)bad(tag,`the lugs reach ${(2*tipZ).toFixed(2)}mm tip to tip, not the ${G.lugToLugMm(d)}mm lug-to-lug`)}
  /* the innermost ring of the bezel's top: the vertices at the height of its closest point */
  const top=pts(w,'bezelTop'),rOf=p=>Math.hypot(p[0],p[2]),pin=top.reduce((a,p)=>rOf(p)<rOf(a)?p:a),ring=top.filter(p=>Math.abs(p[1]-pin[1])<1e-4&&rOf(p)<rOf(pin)+1);
  const inner=Math.min(...ring.map(rOf)),innerMax=Math.max(...ring.map(rOf));
  /* A bezel that follows the case keeps the case's shape at the opening, so
     its innermost ring is not round: it stands an even distance inside the
     case's outline instead. Every other bezel comes back to a circle there,
     which is what a flat insert and a turned crystal need. */
  /* an insert (a dive or GMT ring, an engraved tachymeter) is flat, and needs
     its round seat whatever the bezel's shape */
  const insert=G.bezelRotatable(d)||d.parts.bezel.variant==='tachy';
  if(O.bezel.kind==='case'&&!insert){const ins=ring.map(p=>CS.insetOf(O.bezel.spec,O.bezel.A0,p[0],p[2]));
   const wander=Math.max(...ins)-Math.min(...ins);
   if(wander>.08)bad(tag,`the opening wanders ${wander.toFixed(2)}mm from the bezel's outline`)}
  else if(insert&&innerMax-inner>.05)bad(tag,`the bezel's top is not round where it meets the insert (${inner.toFixed(2)}..${innerMax.toFixed(2)}mm)`);
  const cp=L3.crownParts(d),reach=CS.extentAlong(O.case.spec,O.case.A0,(cp.bearing-90)*Math.PI/180);
  if(!(cp.barrelX>reach))bad(tag,`the crown's barrel at ${cp.barrelX.toFixed(2)}mm is inside the case's outline (${reach.toFixed(2)}mm) along its bearing`);
  /* (a round case's profiles are three's own lathes; the swept ones are checked) */
  for(const n of[...(shape==='round'&&O.bezel.kind==='round'?[]:['flank','flankEdge','chamfer','chamferEdge','seat','bezelFlank','bezelEdge','bezelTop']),'lugs','lugEdges']){let badN=0;
   w.traverse(o=>{if(!o.isMesh||o.name!==n)return;const a=o.geometry.attributes.normal;for(let i=0;i<a.count;i++)if(!(Math.abs(Math.hypot(a.getX(i),a.getY(i),a.getZ(i))-1)<1e-3))badN++});
   if(badN)bad(tag,`${badN} ${n} normals are not unit length`)}
  if(lugs==='integrated'){const tip=(G.geoOf(d).R+G.geoOf(d).lugExt)/PX,near=(p,z0,z1)=>Math.abs(p[2])>z0&&Math.abs(p[2])<z1&&Math.abs(p[0])<3;
   const sh=[...pts(w,'lugs'),...pts(w,'lugEdges')];
   const halfW=Math.max(...sh.filter(p=>Math.abs(p[2])>tip-.8).map(p=>Math.abs(p[0])));
   if(!(halfW>G.strapMmOf(d)/2+.9))bad(tag,`the shoulder is ${(halfW*2).toFixed(1)}mm wide, no wider than the strap`);
   /* at its end, where the strap meets it: the top falls toward the end, so measure the last .3mm */
   const shTop=Math.max(...sh.filter(p=>near(p,tip-.3,tip)).map(p=>p[1]));
   const straps=[];w.traverse(o=>{if(o.isMesh&&/^strap|^bracelet/.test(o.name))straps.push(...pts(w,o.name))});
   const stTop=Math.max(...straps.filter(p=>near(p,tip+.2,tip+2)).map(p=>p[1]));
   if(!(Math.abs(stTop-shTop)<.25))bad(tag,`the ${strap} leaves the shoulder ${(stTop-shTop).toFixed(2)}mm off flush`)}}}

/* a bracelet: its end links close up to the case without entering it, the
   6 o'clock half ends in a folding clasp lying on the table at the stated
   length, the 12 o'clock half in the bar the clasp locks onto */
for(const caseMm of[34,46]){const d=M.clone(M.DEF);d.caseMm=caseMm;d.parts.strap.variant='steel';const tag='bracelet '+caseMm;
 let w;try{w=M.buildHead(d,{})}catch(e){bad(tag,'3D build threw: '+e.message);continue}
 const sp=L3.strapPath(d),R=G.geoOf(d).R/PX,meshes=n=>{const o=[];w.traverse(m=>{if(m.isMesh&&m.name===n)o.push(m)});return o};
 for(const n of['bracelet:clasp','bracelet:claspEdges','bracelet:claspBlades','bracelet:claspHinge','bracelet:top:claspEnd'])if(!meshes(n).length)bad(tag,'no '+n);
 let inside=0,closest=1e9;
 for(const which of['top','bottom'])for(const m of[...meshes('bracelet:'+which+':centre'),...meshes('bracelet:'+which+':outer')]){const p=m.geometry.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),y=p.getY(i);if(Math.abs(z)>R+4)continue;const r=Math.hypot(x,z);
   if(y>sp.groundY+.2&&r<R+.05)inside++;if(Math.abs(x)<1)closest=Math.min(closest,Math.abs(z)-R)}}
 if(inside)bad(tag,`${inside} end link vertices inside the case`);
 if(!(closest<1.2))bad(tag,`the end links stop ${closest.toFixed(2)}mm short of the case`);
 const clasp=meshes('bracelet:clasp')[0];if(clasp){const b=boundsOf(clasp.geometry);
  /* the cover rides on its blades: the lowest blade is what lies on the table */
  const bl=meshes('bracelet:claspBlades')[0],bb=bl&&boundsOf(bl.geometry);
  if(!bb||Math.abs(bb.y0-sp.groundY)>.6)bad(tag,`the clasp does not lie on the table (${bb?(bb.y0-sp.groundY).toFixed(2):'?'}mm)`);
  if(bb&&!(b.y0>bb.y0))bad(tag,'the clasp cover is not above its blades');
  const want=sp.start+sp.pos(G.BRACELET_MM.bottom)[0]+G.BRACELET_MM.clasp;
  if(Math.abs(b.z1-want)>8)bad(tag,`the clasp ends at ${b.z1.toFixed(1)}mm, the bracelet should end near ${want.toFixed(1)}mm`);
  if(!(b.z0>0))bad(tag,'the clasp is not on the 6 o\'clock half')}}

/* an open heart: the aperture and its collar inside the plate, clear of the
   hands' centre and the printing, which keeps its size; no date wheel running
   under it; its index left out where it reaches the ring. What it shows lies
   between the dial and the movement below, and beats. Never on a quartz. */
{const MV=await import('./src/core/three/movement.js');const mm=px=>px/PX;
 for(const caseMm of[34,38,42,46])for(const shape of['round','cushion'])for(const step of['stepped','flat']){
  const d=M.clone(M.DEF);d.caseMm=caseMm;d.case.shape=shape;Object.assign(d.parts.dial,{step,complication:'heart',date:'3'});
  const tag=`open heart ${caseMm}mm ${shape} ${step}`,L=G.dialLayoutOf(d),h=L.heart;
  if(!h){bad(tag,'no aperture');continue}
  if(L.date!=='none')bad(tag,`a date window at ${L.date} over the date wheel's path under the heart`);
  const dist=Math.hypot(h.x-C,h.y-C),limit=L.stepped?L.stepR:L.r*.905;
  if(dist+h.r+h.frame>limit+1e-6)bad(tag,`the collar reaches ${mm(dist+h.r+h.frame-limit).toFixed(2)}mm past the plate`);
  if(mm(dist-h.r-h.frame)<1.2)bad(tag,`the aperture comes within ${mm(dist-h.r-h.frame).toFixed(2)}mm of the hands' centre`);
  if(mm(h.r)<2.5)bad(tag,`the aperture is only ${mm(2*h.r).toFixed(1)}mm across`);
  const reaches=dist+h.r+h.frame+.2*PX>G.indexInnerOf(d)*L.r;
  if(reaches!==L.skipHours.includes(9))bad(tag,`the index at 9 ${reaches?'kept under':'left out beside'} the aperture`);
  const T=G.dialTextOf(d);
  for(const[n,t]of[['brand',T.brand],['model line',T.line]]){
   if(!(t.maxW>=Math.min(8,mm(L.r)*.6)*PX))bad(tag,`the ${n} has only ${mm(t.maxW).toFixed(1)}mm to print in`);
   const nx=Math.max(C-t.maxW/2,Math.min(h.x,C+t.maxW/2)),ny=Math.max(t.y-t.size*.6,Math.min(h.y,t.y+t.size*.6));
   if(Math.hypot(nx-h.x,ny-h.y)<h.r+h.frame)bad(tag,`the ${n} runs into the aperture`)}}
 for(const kind of['automatic','manual','spring'])for(const caseMm of[34,46]){
  const d=M.clone(M.DEF);d.caseMm=caseMm;Object.assign(d.case,{caseback:'exhibition',movement:kind});d.parts.dial.complication='heart';
  const tag=`open heart ${kind}/${caseMm}`;let w;try{w=M.buildHead(d,{})}catch(e){bad(tag,'3D build threw: '+e.message);continue}
  const{heights:H,radii:R}=L3.headProfiles(d),Lm=MV.movementLayout(kind,H,R);
  const heart=w.getObjectByName('openHeart');if(!heart){bad(tag,'nothing under the aperture');continue}
  let y0=1e9,y1=-1e9;w.updateMatrixWorld(true);
  heart.traverse(o=>{if(!o.isMesh)return;const e=o.matrixWorld.elements,p=o.geometry.attributes.position;
   for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),Y=e[1]*x+e[5]*y+e[9]*z+e[13];y0=Math.min(y0,Y);y1=Math.max(y1,Y)}});
  if(y1>H.dial-.05)bad(tag,`the open heart stands ${(y1-H.dial).toFixed(2)}mm up to the dial's face`);
  if(y0<Lm.yT+1e-6)bad(tag,`the open heart reaches ${(Lm.yT-y0).toFixed(2)}mm into the movement`);
  let spin=null;heart.traverse(o=>{if(o.userData.spin)spin=o.userData.spin});
  if(spin!==(kind==='spring'?'glide':'balance'))bad(tag,`the heart shows ${spin||'nothing'} turning`);
  /* seen from the back, the movement's balance is the one the aperture shows: under it, as big */
  const mv=w.getObjectByName('movement'),mb=mv&&mv.getObjectByName('balance'),hb=heart.getObjectByName('balance');
  if(!mb||!hb){bad(tag,'a balance is missing');continue}
  const P=o=>{o.updateWorldMatrix(true,false);return[o.matrixWorld.elements[12],o.matrixWorld.elements[14]]},[mx,mz]=P(mb),[hx,hz]=P(hb);
  if(Math.hypot(mx-hx,mz-hz)>1e-6)bad(tag,`the movement's balance is ${Math.hypot(mx-hx,mz-hz).toFixed(2)}mm from the one the heart shows`);
  const rimR=b=>{const g=b.getObjectByName(b.children[0].name).geometry;g.computeBoundingBox();return g.boundingBox.max.x};
  if(Math.abs(rimR(mb)-rimR(hb))>1e-6)bad(tag,'the balance behind the window is not the size of the one in the heart')}
 {const d=M.clone(M.DEF);d.case.movement='quartz';d.parts.dial.complication='heart';
  if(G.dialLayoutOf(d).heart||M.buildHead(d,{}).getObjectByName('openHeart'))bad('open heart quartz','a quartz movement shows a balance')}}

/* a curved tonneau: its ends come down by the drop asked for and its middle
   stays where it was; its bent surfaces keep unit normals; the strap leaves
   the lugs as much lower as the case is there. Only a tonneau whose bezel is not
   of its own shape curves at all. */
{const pts=(w,n)=>{const out=[];w.updateMatrixWorld(true);w.traverse(o=>{if(!o.isMesh||o.name!==n)return;const a=o.geometry.attributes.position,e=o.matrixWorld.elements;
  for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i),z=a.getZ(i);out.push([e[0]*x+e[4]*y+e[8]*z+e[12],e[1]*x+e[5]*y+e[9]*z+e[13],e[2]*x+e[6]*y+e[10]*z+e[14]])}});return out};
 const top=(w,n,zMin)=>{let y=-1e9;w.updateMatrixWorld(true);w.traverse(o=>{if(!o.isMesh||o.name!==n)return;const a=o.geometry.attributes.position,e=o.matrixWorld.elements;
  for(let i=0;i<a.count;i++){const x=a.getX(i),yy=a.getY(i),z=a.getZ(i),Z=e[2]*x+e[6]*yy+e[10]*z+e[14];if(Math.abs(Z)>=zMin)y=Math.max(y,e[1]*x+e[5]*yy+e[9]*z+e[13])}});return y};
 for(const tl of[1.1,1.45])for(const bend of[1,2.5])for(const[lugs,strap]of[['straight','leather'],['integrated','steel']]){
  const flat=M.clone(M.DEF);Object.assign(flat.case,{shape:'tonneau',tonneauLen:tl,lugs});flat.parts.strap.variant=strap;
  const d=M.clone(flat);d.case.bend=bend;
  const tag=`curved tonneau x${tl} ${bend}mm ${lugs}/${strap}`;
  let w,w0;try{w=M.buildHead(d,{});w0=M.buildHead(flat,{})}catch(e){bad(tag,'3D build threw: '+e.message);continue}
  const B=G.caseBendOf(d);if(!B){bad(tag,'no bend');continue}
  /* vertex by vertex against the flat case: each has come down by exactly bendAt where it is */
  let err=0,far=0;for(const n of['flank','chamfer','lugs','caseback']){const a=pts(w,n),a0=pts(w0,n);
   if(a.length!==a0.length){bad(tag,`${n} has ${a.length} vertices bent, ${a0.length} flat`);continue}
   for(let i=0;i<a.length;i++){err=Math.max(err,Math.abs((a0[i][1]-a[i][1])+G.bendAt(B,a0[i][2])));far=Math.max(far,Math.abs(a0[i][2]))}}
  if(err>1e-4)bad(tag,`the case comes down ${err.toFixed(4)}mm off its curve`);
  if(!(far>B.z1-.5))bad(tag,'no case vertex reaches the ends');
  if(Math.abs(top(w,'bezelTop',0)-top(w0,'bezelTop',0))>1e-6)bad(tag,'the bezel moved: the middle is not flat');
  const nonUnit=w=>{let n=0;w.getObjectByName('case').traverse(o=>{if(!o.isMesh||!o.geometry.attributes.normal)return;const a=o.geometry.attributes.normal;
   for(let i=0;i<a.count;i++)if(!(Math.abs(Math.hypot(a.getX(i),a.getY(i),a.getZ(i))-1)<1e-3))n++});return n};
  if(nonUnit(w)>nonUnit(w0))bad(tag,`bending left ${nonUnit(w)-nonUnit(w0)} case normals not unit length`);
  const sp=L3.strapPath(d),sp0=L3.strapPath(flat),lower=sp0.pos(0)[1]-sp.pos(0)[1],wantS=-G.bendAt(B,sp.start);
  if(Math.abs(lower-wantS)>1e-6)bad(tag,`the strap leaves ${lower.toFixed(2)}mm lower, the lugs are ${wantS.toFixed(2)}mm lower`)}
 for(const[shape,bezelShape]of[['cushion','round'],['tonneau','case'],['round','round']]){const d=M.clone(M.DEF);Object.assign(d.case,{shape,bezelShape,bend:2});
  if(G.caseBendOf(d))bad(`curve ${shape}/${bezelShape}`,'a case that cannot curve is curved')}}

console.log(fails?`\nCOMBOS FAIL (${fails})`:'\nCOMBOS PASS');
if(fails)process.exit(1);
