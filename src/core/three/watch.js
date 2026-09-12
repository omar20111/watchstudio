/* The watch as a three.js scene graph.

   Shape comes from the millimetre geometry: metal is lathed or extruded from
   the same outlines the 2D renderers draw (lathe.js), hands and applied indices
   are extruded from their traced silhouettes (tracer.js). Colour comes from the
   existing renderers baked `flat` — pigment and printing with no painted light —
   so the dial, insert, strap and lume look as designed while all light and
   shadow is real.

   One group per design part (strap, case, crown, bezel, dial, markers, hands,
   crystal) carries `userData.part`, so picking and the part transforms address
   the same parts the panels do. */
import {Group,Mesh,CircleGeometry,RingGeometry,PlaneGeometry,CylinderGeometry,BoxGeometry,ExtrudeGeometry,
        BufferGeometry,Float32BufferAttribute,CanvasTexture,SRGBColorSpace,MeshPhysicalMaterial,Color,Vector2} from 'three';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {CAN,PX,C,METALS,STRAP_REACH_3D} from '../constants.js';
import {getProc} from '../cache.js';
import {caseOf,geoOf,bezelRotatable,posAt} from '../geometry.js';
import {layerAngle} from '../layers.js';
import {bakeSize} from '../cache.js';
import {headProfiles,lathe,lugParts,guardShapes,crownParts,strapPath,smoothstep} from './lathe.js';
import {metalMaterial,crystalMaterial,paintedMaterial} from './materials.js';
import {extrudeSilhouette} from './tracer.js';
import {anisotropyMap,stripeNormalMap} from './surface.js';
import {CASEBACK_WINDOW} from '../render/caseback.js';

const SHEET=CAN/PX;                               /* the 1200 px sheet, in mm */
export const PARTS3D=['strap','case','crown','bezel','dial','markers','hands','crystal'];

/* one GPU texture per baked canvas: getProc hands back the same canvas for the
   same key, so an unchanged part never re-uploads */
const texOf=new WeakMap();
export function canvasTexture(cv,aniso=8){let t=texOf.get(cv);
 if(!t){t=new CanvasTexture(cv);t.colorSpace=SRGBColorSpace;t.anisotropy=aniso;texOf.set(cv,t)}
 return t}

/* map a flat shape's xy onto the sheet, so a disc of radius dialR samples
   exactly the pixels the 2D dial painted at that radius */
const sheetUV=geo=>{const p=geo.attributes.position,uv=geo.attributes.uv;
 for(let i=0;i<p.count;i++)uv.setXY(i,.5+p.getX(i)/SHEET,.5+p.getY(i)/SHEET);
 uv.needsUpdate=true;return geo};
/* lay an xy shape face-up; canvas top (12 o'clock) lands on -z */
const faceUp=geo=>{geo.rotateX(-Math.PI/2);return geo};
/* smooth shading across an extrusion's bevels instead of flat facets */
const smooth=geo=>{geo.deleteAttribute('uv');geo.deleteAttribute('normal');const m=mergeVertices(geo,1e-4);m.computeVertexNormals();geo.dispose();return m};

function extrudeShapes(shapes,{bottom=0,thick=1,bevel=.3,segments=3}={}){
 const b=Math.min(bevel,thick*.3);
 const g=new ExtrudeGeometry(shapes,{depth:Math.max(.01,thick-2*b),bevelEnabled:true,bevelThickness:b,
  bevelSize:b,bevelOffset:-b,bevelSegments:segments,curveSegments:8,steps:1});
 g.translate(0,0,b);g.rotateX(-Math.PI/2);g.translate(0,bottom,0);return g}

/* ---------------------------------------------------------------- materials */

function dialMaterial(map,p){
 const mat=new MeshPhysicalMaterial({map,metalness:0,roughness:.5});
 if(p.variant==='sunburst'){
  /* radial brushing: the highlight sweeps around the dial as the light moves */
  mat.roughness=.3;mat.anisotropy=.92;mat.anisotropyMap=anisotropyMap('circular')}
 else if(p.finish==='brushed'){mat.roughness=.38;mat.anisotropy=.7;mat.anisotropyMap=anisotropyMap('radial')}
 else if(p.variant==='matte'||p.variant==='chrono')mat.roughness=.82;
 else if(p.variant==='guilloche'){mat.roughness=.34;mat.clearcoat=.35;mat.clearcoatRoughness=.2}
 else if(p.variant==='fume'){mat.roughness=.28;mat.clearcoat=.6;mat.clearcoatRoughness=.08}
 if(p.finish==='polished'){mat.roughness=Math.min(mat.roughness,.2);mat.clearcoat=Math.max(mat.clearcoat,.5)}
 if(p.finish==='matte')mat.roughness=Math.max(mat.roughness,.85);
 return mat}

/* luminous compound: a faint self-glow only when "lights out" is on */
function lumeMaterial(map,lume,glow){
 const mat=paintedMaterial(map,{alphaTest:.5,roughness:.62});
 if(glow){mat.emissive=new Color(lume);mat.emissiveMap=map;mat.emissiveIntensity=.9}
 return mat}

function strapMaterial(map,p){const v=p.variant;
 if(v==='steel')return new MeshPhysicalMaterial({map,color:0xffffff,metalness:1,roughness:.3,alphaTest:.5,
  envMapIntensity:(METALS[p.metal]||METALS.steel).refl??1});
 return new MeshPhysicalMaterial({map,metalness:0,alphaTest:.5,
  roughness:v==='rubber'?.5:v==='nato'?.88:.62,
  sheen:v==='nato'||v==='leather'?.6:0,sheenRoughness:.7,sheenColor:new Color(p.color||'#6b4a2f').multiplyScalar(.6),
  clearcoat:v==='rubber'?.25:0,clearcoatRoughness:.4})}

/* ---------------------------------------------------------------- strap */

/* A strap is a band of real thickness following strapPath, unrolled onto its
   flat bake: arc length along the band is distance along the drawn strap, so
   the stitching, keepers and links land where they were drawn. */
function strapGeometry(d,dir){
 const sp=strapPath(d),g=geoOf(d);
 const{h:Hc}=bakeSize('strap','flat'),off=(Hc-CAN)/2;
 const s0px=g.R*.55,reachPx=STRAP_REACH_3D+26;
 const widthAt=sPx=>{const p=Math.min(1,Math.max(0,(sPx-s0px)/(STRAP_REACH_3D-s0px)));return g.sw*(1-.14*p)/PX};
 const v=d.parts.strap.variant,dome=v==='steel'?.25:v==='nato'?.05:sp.T*.16;
 const N=140,M=12,sA=-1.2,sB=reachPx/PX-sp.start;
 const pos=[],uv=[],idx=[];
 const vert=(s,x,side)=>{const[along,yc,ang]=sp.pos(s);const sPx=(sp.start+s)*PX,w=widthAt(sPx);
  const xx=x*w/2,k=side==='top'?sp.T/2+dome*(1-x*x):-sp.T/2;
  const ca=Math.cos(ang),sa=Math.sin(ang);
  pos.push(xx,yc+ca*k,dir*(sp.start+along)-dir*sa*k);
  uv.push(.5+xx/SHEET,1-(C+dir*sPx+off)/Hc)};
 /* grid of (N+1) stations x cols; `flip` keeps every face pointing outward */
 const grid=(cols,fn,flip)=>{const base=pos.length/3;
  for(let i=0;i<=N;i++){const s=sA+(sB-sA)*i/N;for(let j=0;j<cols;j++)fn(s,j)}
  for(let i=0;i<N;i++)for(let j=0;j<cols-1;j++){const a=base+i*cols+j,b=a+cols,c=a+1,e=b+1;
   if(flip)idx.push(a,c,b,c,e,b);else idx.push(a,b,c,c,b,e)}};
 const up=dir>0;
 grid(M+1,(s,j)=>vert(s,j/M*2-1,'top'),!up);
 grid(M+1,(s,j)=>vert(s,j/M*2-1,'bottom'),up);
 grid(2,(s,j)=>vert(s,1,j?'top':'bottom'),!up);
 grid(2,(s,j)=>vert(s,-1,j?'top':'bottom'),up);
 const geo=new BufferGeometry();
 geo.setAttribute('position',new Float32BufferAttribute(pos,3));geo.setAttribute('uv',new Float32BufferAttribute(uv,2));
 geo.setIndex(idx);geo.computeVertexNormals();
 return{geo,groundY:sp.groundY}}

/* ---------------------------------------------------------------- head */

export function buildHead(d,{aniso=8}={}){
 const{profiles:P,heights:H,radii:Rr}=headProfiles(d);
 const parts=d.parts,arch=caseOf(d),tex=cv=>canvasTexture(cv,aniso);
 const watch=new Group();watch.name='watch';
 const G={};for(const p of PARTS3D){G[p]=new Group();G[p].name=p;G[p].userData.part=p;watch.add(G[p])}
 const add=(to,name,geo,mat,{cast=true,receive=true}={})=>{
  const m=new Mesh(geo,mat);m.name=name;m.castShadow=cast;m.receiveShadow=receive;to.add(m);return m};

 /* ---- strap ---- */
 let groundY=0;
 for(const[dir,which]of[[-1,'top'],[1,'bottom']]){
  const{geo,groundY:gy}=strapGeometry(d,dir);groundY=gy;
  add(G.strap,'strap:'+which,geo,strapMaterial(tex(getProc('strap',d,which,'flat')),parts.strap))}

 /* ---- case: turned flank, polished chamfer, horns, caseback ---- */
 const cm=parts.case;
 add(G.case,'caseback',lathe(P.caseback),metalMaterial(cm.metal,'brushed'));
 add(G.case,'flank',lathe(P.flank),metalMaterial(cm.metal,cm.finish));
 add(G.case,'chamfer',lathe(P.chamfer),metalMaterial(cm.metal,'polished'));
 add(G.case,'seat',lathe(P.seat),metalMaterial(cm.metal,cm.finish));
 add(G.case,'rehaut',lathe(P.rehaut),metalMaterial(cm.metal,'brushed'));
 const lp=lugParts(d);
 const lugGeo=smooth(extrudeShapes(lp.shapes,{bottom:lp.bottom,thick:lp.thick,bevel:.45,segments:4}));
 {const p=lugGeo.attributes.position;
  for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)-lp.drop*smoothstep(lp.z0,lp.z1,Math.abs(p.getZ(i))));
  lugGeo.computeVertexNormals()}
 add(G.case,'lugs',lugGeo,metalMaterial(cm.metal,cm.finish));
 const cp=crownParts(d);
 const guards=guardShapes(d);
 if(guards.length){const gh=Math.min(H.seat-H.back-.6,Rr.rCase*.34);
  add(G.case,'guards',smooth(extrudeShapes(guards,{bottom:cp.axisY-gh/2,thick:gh,bevel:.35})),metalMaterial(cm.metal,cm.finish))}
 /* the caseback face: engraving, or the movement behind a sapphire window */
 const backTex=tex(getProc('caseback',d,undefined,'flat'));
 const faceDown=geo=>{geo.rotateX(Math.PI/2);geo.rotateY(Math.PI);return geo};
 if(arch.caseback==='exhibition'){const rw=Rr.rCase*CASEBACK_WINDOW;
  const mv=add(G.case,'movement',faceDown(sheetUV(new CircleGeometry(rw,96))),paintedMaterial(backTex,{roughness:.35}),{cast:false});
  mv.position.y=H.back*.55-.01;
  const glass=add(G.case,'backGlass',faceDown(new CircleGeometry(rw,96)),crystalMaterial('polished',.5,1),{cast:false,receive:false});
  glass.position.y=.02}
 else{const face=add(G.case,'backFace',faceDown(sheetUV(new CircleGeometry(Rr.rCase*.8,120))),
   Object.assign(metalMaterial(cm.metal,'brushed'),{map:backTex,color:new Color(0xffffff)}),{cast:false});
  face.position.y=-.003}

 /* ---- pushers: part of the case band ---- */
 for(const pu of cp.pushers){const grp=new Group();grp.position.y=cp.axisY;grp.rotation.y=-(pu.bearing-90)*Math.PI/180;G.case.add(grp);
  const sh=new CylinderGeometry(pu.shoulder.r,pu.shoulder.r,pu.shoulder.x1-pu.shoulder.x0,24);sh.rotateZ(Math.PI/2);sh.translate((pu.shoulder.x0+pu.shoulder.x1)/2,0,0);
  add(grp,'pusherShoulder',sh,metalMaterial(cm.metal,cm.finish));
  const r=pu.head.r,L=pu.head.len,e=Math.min(.3,r*.25),Vv=(x,y)=>new Vector2(x,y);
  const hd=lathe([Vv(pu.shoulder.r,0),Vv(r-e,0),Vv(r,e),Vv(r,L-e),Vv(r-e,L),Vv(0,L)],48);
  hd.rotateZ(-Math.PI/2);hd.translate(pu.head.x0,0,0);
  add(grp,'pusherHead',hd,metalMaterial(cm.metal,'polished'))}

 /* ---- crown: tube, knurled barrel, domed end, swung to its bearing ---- */
 {const cr=parts.crown,grp=new Group();grp.position.y=cp.axisY;grp.rotation.y=-(cp.bearing-90)*Math.PI/180;G.crown.add(grp);
  const tube=new CylinderGeometry(cp.tube.r,cp.tube.r,cp.tube.x1-cp.tube.x0,32);tube.rotateZ(Math.PI/2);tube.translate((cp.tube.x0+cp.tube.x1)/2,0,0);
  add(grp,'crownTube',tube,metalMaterial(cr.metal,'polished'));
  const along=pts=>{const g=lathe(pts,72);g.rotateZ(-Math.PI/2);g.translate(cp.barrelX,0,0);return g};
  add(grp,'crownInner',along(cp.inner),metalMaterial(cr.metal,cr.finish));
  const knurl=metalMaterial(cr.metal,cr.finish);knurl.normalMap=stripeNormalMap(cp.teeth,'knurl');knurl.normalScale=new Vector2(1,1);
  add(grp,'crownSide',along(cp.side),knurl);
  add(grp,'crownEnd',along(cp.end),metalMaterial(cr.metal,'polished'))}

 /* ---- bezel ---- */
 const bz=parts.bezel;
 const flankMat=metalMaterial(bz.metal,bz.finish);
 if(Rr.rotating){flankMat.normalMap=stripeNormalMap(110,'knurl');flankMat.normalScale=new Vector2(.9,.9)}
 add(G.bezel,'bezelFlank',lathe(P.bezelFlank),flankMat);
 const topMat=metalMaterial(bz.metal,bz.finish);
 if(bz.variant==='fluted'){topMat.normalMap=stripeNormalMap(84,'flute');topMat.normalScale=new Vector2(1.4,1.4)}
 add(G.bezel,'bezelTop',lathe(P.bezelTop),topMat);
 add(G.bezel,'bezelInner',lathe(P.bezelInner),metalMaterial(bz.metal,'polished'));
 const ring=(r0,r1)=>faceUp(sheetUV(new RingGeometry(r0,r1,180,1)));
 if(bezelRotatable(d)){
  const ins=add(G.bezel,'bezelIns',ring(Rr.rInCham,Rr.rInsOut),
   new MeshPhysicalMaterial({map:tex(getProc('bezel',d,'insert','flat')),roughness:.2,clearcoat:.7,clearcoatRoughness:.05}),{cast:false});
  ins.position.y=H.bezelTop+.012;ins.userData.spin='bezelIns'}
 else if(bz.variant==='tachy'){
  const pr=add(G.bezel,'bezelPrint',ring(Rr.rInCham,Rr.rGripIn),paintedMaterial(tex(getProc('bezel',d,undefined,'print')),{alphaTest:.35,roughness:.6}),{cast:false});
  pr.position.y=H.bezelTop+.008}

 /* ---- dial ---- */
 const dial=add(G.dial,'dial',faceUp(sheetUV(new CircleGeometry(Rr.dialR,180))),dialMaterial(tex(getProc('dial',d,undefined,'flat')),parts.dial),{cast:false});
 dial.position.y=H.dial;
 /* chronograph registers: running seconds at 3, 12-hour at 6, 30-minute at 9 */
 if(parts.dial.variant==='chrono'){const r=Rr.dialR*PX,rs=r*.2,hp=parts.hands;
  for(const[deg,key]of[[90,'smallsec'],[180,'chHr'],[270,'chMin']]){
   const[px,py]=posAt(deg,r*.45),reg=new Group();reg.name='reg:'+key;
   reg.position.set((px-C)/PX,H.dial+.12,(py-C)/PX);reg.userData.spin=key;G.dial.add(reg);
   const len=rs*.72/PX,w=Math.max(.12,len*.08);
   const hand=add(reg,key+'Hand',new BoxGeometry(w,.08,len),metalMaterial(hp.metal,'polished'),{receive:false});
   hand.position.z=-len/2+len*.12;
   add(reg,key+'Hub',new CylinderGeometry(4/PX,4/PX,.14,20),metalMaterial(hp.metal,'polished'))}}

 /* ---- applied indices: solid, on the dial, with their lume laid in ---- */
 const mk=parts.markers,frame=parts.hands.metal;
 const idxH=mk.variant==='roman'||mk.variant==='arabic'?.2:mk.variant==='dots'?.24:.3;
 const idxGeo=extrudeSilhouette(getProc('markers',d,undefined,'shape'),{depth:idxH,bevel:.035});
 if(idxGeo){const m=add(G.markers,'indices',idxGeo,metalMaterial(frame,'polished'));m.position.y=H.dial}
 if(mk.variant!=='roman'&&mk.variant!=='arabic'){
  const lm=add(G.markers,'indicesLume',faceUp(new PlaneGeometry(SHEET,SHEET)),lumeMaterial(tex(getProc('markers',d,undefined,'lume')),mk.lume,mk.glow),{cast:false});
  lm.position.y=H.dial+idxH+.004}

 /* ---- hands: each on its own arbor height; `hand:*` carries its transform,
    the arbor inside it turns with the clock ---- */
 const hp=parts.hands,lift={hour:.28,min:.62,sec:.95},thick={hour:.26,min:.24,sec:.14};
 for(const k of['hour','min','sec']){
  const holder=new Group();holder.name='hand:'+k;G.hands.add(holder);
  const arbor=new Group();arbor.name=k;arbor.position.y=H.dial+lift[k];arbor.userData.spin=k;holder.add(arbor);
  const geo=extrudeSilhouette(getProc('hands',d,k,'shape'),{depth:thick[k],bevel:k==='sec'?.025:.04});
  if(!geo)continue;
  const bodyMat=k==='sec'
   ?new MeshPhysicalMaterial({color:new Color(hp.secColor||'#e8482c'),roughness:.32,clearcoat:.6,clearcoatRoughness:.1})
   :metalMaterial(hp.metal,hp.finish);
  add(arbor,k+'Body',geo,bodyMat,{receive:false});
  if(k!=='sec'&&hp.variant!=='dauphine'){
   const lm=add(arbor,k+'Lume',faceUp(new PlaneGeometry(SHEET,SHEET)),lumeMaterial(tex(getProc('hands',d,k,'lume')),hp.lume,hp.glow),{cast:false,receive:false});
   lm.position.y=thick[k]+.004}
  if(k==='sec'){/* the pipe that holds the seconds hand, and its dark pinion */
   const cap=add(arbor,'secCap',new CylinderGeometry(13/PX,13/PX,.22,40),metalMaterial(hp.metal,'polished'));cap.position.y=thick[k]+.11;
   const pin=add(arbor,'secPin',new CylinderGeometry(5/PX,5/PX,.06,24),new MeshPhysicalMaterial({color:0x1c1e22,roughness:.4}),{cast:false});pin.position.y=thick[k]+.25}}

 /* ---- crystal ---- */
 const cr=add(G.crystal,'crystal',lathe(P.crystal,180),
  crystalMaterial(parts.crystal.finish,parts.crystal.opacity,arch.crystalMm),{cast:false,receive:false});
 cr.renderOrder=10;

 watch.userData={heights:H,radii:Rr,groundY,groups:G};
 return watch}

/* hands, registers and the insert follow the scene clock through the same table
   the exporter uses */
export function poseHead(head,clock){
 head.traverse(o=>{const k=o.userData&&o.userData.spin;
  if(k)o.rotation.y=-layerAngle(k,clock)*Math.PI/180})}

export function disposeHead(head){
 head.traverse(o=>{if(!o.isMesh)return;o.geometry.dispose();
  if(o.customDepthMaterial)o.customDepthMaterial.dispose();
  /* textures belong to the canvas cache and surface.js, not to this head */
  o.material.dispose()})}
