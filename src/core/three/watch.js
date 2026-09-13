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
import {Group,Mesh,CircleGeometry,RingGeometry,PlaneGeometry,CylinderGeometry,BoxGeometry,ExtrudeGeometry,Shape,Path,ShapeGeometry,Matrix4,
        BufferGeometry,Float32BufferAttribute,CanvasTexture,SRGBColorSpace,MeshPhysicalMaterial,MeshStandardMaterial,
        Color,Vector2} from 'three';
import {mergeVertices,mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {CAN,PX,C,METALS,STRAP_REACH_3D} from '../constants.js';
import {getProc,bakeSize} from '../cache.js';
import {caseOf,geoOf,bezelRotatable,posAt,dialLayoutOf,DIAL_STEP_MM,SUBDIAL_DEPTH_MM} from '../geometry.js';
import {shade} from '../utils.js';
import {layerAngle} from '../layers.js';
import {headProfiles,lathe,lugParts,guardShapes,crownParts,strapPath,smoothstep} from './lathe.js';
import {metalMaterial,crystalMaterial,paintedMaterial,softenKeyGlint} from './materials.js';
import {extrudeSilhouette} from './tracer.js';
import {anisotropyMap,stripeNormalMap,snailNormalMap} from './surface.js';
import {activeUpload,uploadCanvas} from './uploads.js';
import {CASEBACK_WINDOW} from '../render/caseback.js';

const SHEET=CAN/PX;                               /* the 1200 px sheet, in mm */
export const PARTS3D=['strap','case','crown','bezel','dial','markers','hands','crystal'];
const DIAL_FAMILY=['dial','markers','hands','crystal'];

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

/* Everything that changes the built geometry or its materials. Part transforms,
   the bezel's rotation, the view, the time and the backdrop are applied to a
   built watch without rebuilding it. */
export function headKey(d,customs){
 const parts={};for(const k in d.parts){const{t,tH,tM,tS,rot,...rest}=d.parts[k];parts[k]=rest}
 const up={};for(const p of PARTS3D){const u=activeUpload(d,customs,p);if(u)up[p]=u.url}
 return JSON.stringify([d.caseMm,d.strapMm,d.bezelMm,d.crownMm,d.case,parts,up])}

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
 /* `inset` samples the texture a little inside the drawn edge: the edge pixel
    itself is anti-aliased to half alpha, which the alpha test would punch
    through, striping the band's side walls */
 const vert=(s,x,side,inset=0)=>{const[along,yc,ang]=sp.pos(s);const sPx=(sp.start+s)*PX,w=widthAt(sPx);
  const xx=x*w/2,k=side==='top'?sp.T/2+dome*(1-x*x):-sp.T/2;
  const ca=Math.cos(ang),sa=Math.sin(ang);
  pos.push(xx,yc+ca*k,dir*(sp.start+along)-dir*sa*k);
  uv.push(.5+(xx-Math.sign(x)*inset)/SHEET,1-(C+dir*sPx+off)/Hc)};
 /* grid of (N+1) stations x cols; `flip` keeps every face pointing outward */
 const grid=(cols,fn,flip)=>{const base=pos.length/3;
  for(let i=0;i<=N;i++){const s=sA+(sB-sA)*i/N;for(let j=0;j<cols;j++)fn(s,j)}
  for(let i=0;i<N;i++)for(let j=0;j<cols-1;j++){const a=base+i*cols+j,b=a+cols,c=a+1,e=b+1;
   if(flip)idx.push(a,c,b,c,e,b);else idx.push(a,b,c,c,b,e)}};
 const up=dir>0;
 const edge=.35;
 grid(M+1,(s,j)=>vert(s,j/M*2-1,'top',j===0||j===M?edge:0),!up);
 grid(M+1,(s,j)=>vert(s,j/M*2-1,'bottom',j===0||j===M?edge:0),up);
 grid(2,(s,j)=>vert(s,1,j?'top':'bottom',edge),!up);
 grid(2,(s,j)=>vert(s,-1,j?'top':'bottom',edge),up);
 const geo=new BufferGeometry();
 geo.setAttribute('position',new Float32BufferAttribute(pos,3));geo.setAttribute('uv',new Float32BufferAttribute(uv,2));
 geo.setIndex(idx);geo.computeVertexNormals();
 return geo}

/* a rounded rectangle centred on (cx, cy), traced into a Shape or a Path */
function roundRectPath(p,cx,cy,w,h,r){const x0=cx-w/2,x1=cx+w/2,y0=cy-h/2,y1=cy+h/2;r=Math.min(r,w/2,h/2);
 p.moveTo(x0+r,y0);p.lineTo(x1-r,y0);p.quadraticCurveTo(x1,y0,x1,y0+r);p.lineTo(x1,y1-r);p.quadraticCurveTo(x1,y1,x1-r,y1);
 p.lineTo(x0+r,y1);p.quadraticCurveTo(x0,y1,x0,y1-r);p.lineTo(x0,y0+r);p.quadraticCurveTo(x0,y0,x0+r,y0);return p}

/* ---------------------------------------------------------------- bracelet */

/* The strap's width at arc length s past the spring bar, mm — the taper every
   strap and bracelet shares with its flat bake. */
function strapWidthAt(d){const g=geoOf(d),sp=strapPath(d),s0px=g.R*.55;
 return s=>{const sPx=(sp.start+s)*PX,p=Math.min(1,Math.max(0,(sPx-s0px)/(STRAP_REACH_3D-s0px)));return g.sw*(1-.14*p)/PX}}

/* one link: a rounded block pw wide and pl long, t thick, centred on the origin,
   thickness along +y, length along z */
function linkBlock(pw,pl,t){const r=Math.min(.7,pw*.22,pl*.22),x=pw/2,z=pl/2;
 const sh=new Shape();
 sh.moveTo(-x+r,-z);sh.lineTo(x-r,-z);sh.quadraticCurveTo(x,-z,x,-z+r);sh.lineTo(x,z-r);sh.quadraticCurveTo(x,z,x-r,z);
 sh.lineTo(-x+r,z);sh.quadraticCurveTo(-x,z,-x,z-r);sh.lineTo(-x,-z+r);sh.quadraticCurveTo(-x,-z,-x+r,-z);
 const b=Math.min(.38,t*.18,pw*.2);
 const g=new ExtrudeGeometry(sh,{depth:Math.max(.05,t-2*b),bevelEnabled:true,bevelThickness:b,bevelSize:b*.8,bevelOffset:-b*.8,bevelSegments:3,curveSegments:4});
 g.translate(0,0,-t/2+b);g.rotateX(-Math.PI/2);return g}

/* A steel bracelet as solid links. Rows of three — two outer links and a centre
   link — follow the same path the strap does, each row a rigid block placed at
   its point along the curve, so the rows open up round the bend the way real
   links hinge. A dark pin under each joint is what the gaps between rows and
   between the pieces of a row show. The first row is a solid end link filling
   the space between the lugs. Rows are merged per material: a few meshes, not
   hundreds, and one node each in a GLB. */
function braceletParts(d,dir){
 const sp=strapPath(d),widthAt=strapWidthAt(d),T=sp.T;
 const w0=widthAt(0),pitch=Math.min(8,Math.max(5.2,w0*.36)),gap=Math.max(.18,pitch*.035);
 const sEnd=(STRAP_REACH_3D+26)/PX-sp.start;
 const place=(geo,s,xc=0)=>{const[along,yc,ang]=sp.pos(s);
  const m=new Matrix4().makeTranslation(0,yc,dir*(sp.start+along))
   .multiply(new Matrix4().makeRotationX(-dir*ang)).multiply(new Matrix4().makeTranslation(xc,0,0));
  geo.applyMatrix4(m);return geo};
 const outer=[],centre=[],pins=[];
 /* end link: full width, from under the lugs to the first joint */
 const e0=-1.2,e1=e0+pitch*.95;
 centre.push(place(linkBlock(widthAt((e0+e1)/2)*.98,e1-e0-gap,T*.96),(e0+e1)/2));
 for(let s=e1;s+pitch<sEnd;s+=pitch){
  const mid=s+pitch/2,w=widthAt(mid),pl=pitch-gap;
  const ow=w*.29,cw=w*.36,seam=(w-2*ow-cw)/2;
  outer.push(place(linkBlock(ow,pl,T*.9),mid,-(w/2-ow/2)));
  outer.push(place(linkBlock(ow,pl,T*.9),mid,w/2-ow/2));
  centre.push(place(linkBlock(cw,pl,T),mid,0));
  /* the pin at the joint behind this row, and the shadowed seams inside it */
  const pin=new CylinderGeometry(T*.3,T*.3,w*.96,10);pin.rotateZ(Math.PI/2);pin.translate(0,-T*.12,0);
  pins.push(place(pin,s));
  if(seam>.01){const bar=new BoxGeometry(seam+.3,T*.55,pl*.9);
   for(const sx of[-1,1]){const b2=bar.clone();b2.translate(sx*(cw/2+seam/2),-T*.12,0);pins.push(place(b2,mid))}bar.dispose()}}
 return{outer:mergeGeometries(outer),centre:mergeGeometries(centre),pins:mergeGeometries(pins.map(p=>p.index?p.toNonIndexed():p))}}

/* ---------------------------------------------------------------- head */

export function buildHead(d,customs={},{aniso=8}={}){
 const{profiles:P,heights:H,radii:Rr}=headProfiles(d);
 const parts=d.parts,arch=caseOf(d),tex=cv=>canvasTexture(cv,aniso);
 const watch=new Group();watch.name='watch';
 const G={};for(const p of PARTS3D){G[p]=new Group();G[p].name=p;G[p].userData.part=p;watch.add(G[p])}
 const add=(to,name,geo,mat,{cast=true,receive=true,noPick=false}={})=>{
  const m=new Mesh(geo,mat);m.name=name;m.castShadow=cast;m.receiveShadow=receive;
  /* noPick sheets are painted decals (lume) floating on a solid: they must not
     be clicked, nor read as solid planes by the occlusion pass */
  if(noPick){m.userData.noPick=true;m.userData.noAO=true}to.add(m);return m};
 const sheet=()=>faceUp(new PlaneGeometry(SHEET,SHEET));

 /* An uploaded part is shown face-on at its own height. Returns the mesh, or
    null while the image is still loading — the procedural part stands in until
    it arrives and `pending` tells the view to rebuild then. */
 const pending=[];
 const uploaded=(part,to,y,extra={})=>{const u=activeUpload(d,customs,part);if(!u)return null;
  const src=uploadCanvas(part,u,parts[part]);
  if(!src)return null;
  if(src instanceof Promise){pending.push(src);return null}
  const map=tex(src);
  const mat=new MeshStandardMaterial({map,roughness:.5,metalness:0,alphaTest:.5,...extra});
  const m=add(to,'upload:'+part,sheet(),mat,{cast:true});m.position.y=y;m.userData.alphaCanvas=src;m.userData.noAO=true;
  return m};

 const cp=crownParts(d),sp=strapPath(d);
 const groundY=sp.groundY;

 /* ---- strap ---- */
 if(!uploaded('strap',G.strap,sp.pos(0)[1]+sp.T/2))
  if(parts.strap.variant==='steel'){const st=parts.strap;
   /* brushed along the bracelet's length: the grain runs across the links' v, not u.
      A polished centre link is a touch less than mirror: at a true mirror polish
      each link reflects one dark studio wall and reads as a black tile. */
   const brushed=()=>Object.assign(metalMaterial(st.metal,'brushed'),{anisotropyRotation:Math.PI/2});
   for(const[dir,which]of[[-1,'top'],[1,'bottom']]){const b=braceletParts(d,dir);
    add(G.strap,'bracelet:'+which+':outer',b.outer,brushed());
    add(G.strap,'bracelet:'+which+':centre',b.centre,st.finish==='polished'?Object.assign(metalMaterial(st.metal,'polished'),{roughness:.14}):brushed());
    add(G.strap,'bracelet:'+which+':pins',b.pins,new MeshPhysicalMaterial({color:0x1c1e22,metalness:.7,roughness:.55}),{cast:false})}}
  else for(const[dir,which]of[[-1,'top'],[1,'bottom']])
   add(G.strap,'strap:'+which,strapGeometry(d,dir),strapMaterial(tex(getProc('strap',d,which,'flat')),parts.strap));

 /* ---- case: turned flank, polished chamfer, horns, caseback ---- */
 const cm=parts.case;
 if(!uploaded('case',G.case,H.seat)){
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
  /* pushers are part of the case band */
  for(const pu of cp.pushers){const grp=new Group();grp.position.y=cp.axisY;grp.rotation.y=-(pu.bearing-90)*Math.PI/180;G.case.add(grp);
   const sh=new CylinderGeometry(pu.shoulder.r,pu.shoulder.r,pu.shoulder.x1-pu.shoulder.x0,24);sh.rotateZ(Math.PI/2);sh.translate((pu.shoulder.x0+pu.shoulder.x1)/2,0,0);
   add(grp,'pusherShoulder',sh,metalMaterial(cm.metal,cm.finish));
   const r=pu.head.r,L=pu.head.len,e=Math.min(.3,r*.25),Vv=(x,y)=>new Vector2(x,y);
   const hd=lathe([Vv(pu.shoulder.r,0),Vv(r-e,0),Vv(r,e),Vv(r,L-e),Vv(r-e,L),Vv(0,L)],48);
   hd.rotateZ(-Math.PI/2);hd.translate(pu.head.x0,0,0);
   add(grp,'pusherHead',hd,metalMaterial(cm.metal,'polished'))}}

 /* ---- crown: tube, knurled barrel, domed end, swung to its bearing ---- */
 if(!uploaded('crown',G.crown,cp.axisY+cp.tube.r*5)){
  const cr=parts.crown,grp=new Group();grp.position.y=cp.axisY;grp.rotation.y=-(cp.bearing-90)*Math.PI/180;G.crown.add(grp);
  const tube=new CylinderGeometry(cp.tube.r,cp.tube.r,cp.tube.x1-cp.tube.x0,32);tube.rotateZ(Math.PI/2);tube.translate((cp.tube.x0+cp.tube.x1)/2,0,0);
  add(grp,'crownTube',tube,metalMaterial(cr.metal,'polished'));
  const along=pts=>{const g=lathe(pts,72);g.rotateZ(-Math.PI/2);g.translate(cp.barrelX,0,0);return g};
  add(grp,'crownInner',along(cp.inner),metalMaterial(cr.metal,cr.finish));
  const knurl=metalMaterial(cr.metal,cr.finish);knurl.normalMap=stripeNormalMap(cp.teeth,'knurl');knurl.normalScale=new Vector2(1,1);
  add(grp,'crownSide',along(cp.side),knurl);
  add(grp,'crownEnd',along(cp.end),metalMaterial(cr.metal,'polished'))}

 /* ---- bezel ---- */
 const bz=parts.bezel;
 if(!uploaded('bezel',G.bezel,H.bezelTop+.02)){
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
    /* anodised or ceramic: a light coat only — a strong clearcoat mirrors the
       overhead softbox and turns a black insert grey */
    new MeshPhysicalMaterial({map:tex(getProc('bezel',d,'insert','flat')),roughness:.34,clearcoat:.22,clearcoatRoughness:.18}),{cast:false});
   ins.position.y=H.bezelTop+.012;ins.userData.spin='bezelIns'}
  else if(bz.variant==='tachy'){
   const pr=add(G.bezel,'bezelPrint',ring(Rr.rInCham,Rr.rGripIn),paintedMaterial(tex(getProc('bezel',d,undefined,'print')),{alphaTest:.35,roughness:.6}),{cast:false});
   pr.position.y=H.bezelTop+.008}}

 /* ---- dial ----
    A plate, not a disc. Its centre is sunk below a chapter ring on a stepped
    dial; chronograph registers are milled into it; a date window is cut through
    it onto a wheel below. The plate's outline comes from dialLayoutOf, the same
    layout the 2D dial is painted from, so apertures and artwork agree. */
 const DL=dialLayoutOf(d),dialUpload=!!activeUpload(d,customs,'dial');
 /* the plate's centre height: indices and registers are measured from it */
 const Hc=H.dial-(!dialUpload&&DL.stepped?DIAL_STEP_MM:0);
 const mmX=px=>(px-C)/PX,mmY=py=>-(py-C)/PX;         /* sheet px -> shape xy (y toward 12) */
 {const du=activeUpload(d,customs,'dial');let src=du&&uploadCanvas('dial',du,parts.dial);
  if(src instanceof Promise){pending.push(src);src=null}
  if(dialUpload||src){
   const mat=src?new MeshStandardMaterial({map:tex(src),roughness:.5}):dialMaterial(tex(getProc('dial',d,undefined,'flat')),parts.dial);
   const dial=add(G.dial,'dial',faceUp(sheetUV(new CircleGeometry(Rr.dialR,180))),mat,{cast:false});
   dial.position.y=H.dial}
  else{const mat=dialMaterial(tex(getProc('dial',d,undefined,'flat')),parts.dial);
   const plateR=DL.stepped?DL.stepR/PX:Rr.dialR;
   const outline=new Shape();outline.absarc(0,0,plateR,0,Math.PI*2,false);
   for(const sd of DL.subdials){const h=new Path();h.absarc(mmX(sd.x),mmY(sd.y),sd.r/PX,0,Math.PI*2,true);outline.holes.push(h)}
   if(DL.win)outline.holes.push(roundRectPath(new Path(),mmX(DL.win.x),mmY(DL.win.y),DL.win.w/PX,DL.win.h/PX,DL.win.rad/PX));
   const plate=add(G.dial,'dial',faceUp(sheetUV(new ShapeGeometry(outline,48))),mat,{cast:false});
   plate.position.y=Hc;
   /* the wall of any recess is the plate's own metal, seen in its own shade */
   const wallMat=()=>new MeshPhysicalMaterial({color:new Color(shade(parts.dial.color||'#16324f',.35)),roughness:.6});
   if(DL.stepped){
    const ring=add(G.dial,'chapterRing',faceUp(sheetUV(new RingGeometry(plateR,Rr.dialR,180,1))),mat,{cast:false});
    ring.position.y=H.dial;
    /* the step faces the centre: top to bottom, so the lathe's normals point in */
    add(G.dial,'chapterStep',lathe([new Vector2(plateR,H.dial),new Vector2(plateR,Hc)],180),wallMat(),{cast:false})}
   /* registers: a floor below the plate with snailed grooves, and a wall down to it */
   for(const sd of DL.subdials){const x=mmX(sd.x),y=mmY(sd.y),rs=sd.r/PX;
    const floor=new CircleGeometry(rs,96);floor.translate(x,y,0);sheetUV(floor);
    /* uv1 runs 0..1 across the register itself, for its concentric grooves */
    {const p=floor.attributes.position,u1=new Float32Array(p.count*2);
     for(let i=0;i<p.count;i++){u1[i*2]=.5+(p.getX(i)-x)/(2*rs);u1[i*2+1]=.5+(p.getY(i)-y)/(2*rs)}
     floor.setAttribute('uv1',new Float32BufferAttribute(u1,2))}
    const fm=dialMaterial(mat.map,parts.dial);fm.normalMap=snailNormalMap(16);fm.normalMap.channel=1;fm.normalScale=new Vector2(.55,.55);
    const f=add(G.dial,'register:'+sd.key,faceUp(floor),fm,{cast:false});f.position.y=Hc-SUBDIAL_DEPTH_MM;
    const wall=lathe([new Vector2(rs,Hc),new Vector2(rs,Hc-SUBDIAL_DEPTH_MM)],96);wall.translate(x,0,-y);
    add(G.dial,'registerWall:'+sd.key,wall,wallMat(),{cast:false})}
   /* date: a polished frame lining the aperture, and the wheel turning below */
   if(DL.win){const w=DL.win,wx=mmX(w.x),wy=mmY(w.y),ww=w.w/PX,wh=w.h/PX,wr=w.rad/PX,b=w.frame/PX;
    const wheelY=Hc-.45;
    const frameShape=roundRectPath(new Shape(),wx,wy,ww+2*b,wh+2*b,wr+b);
    frameShape.holes.push(roundRectPath(new Path(),wx,wy,ww,wh,wr));
    const top=Hc+.1,depth=top-wheelY-.05;
    const fg=new ExtrudeGeometry(frameShape,{depth:Math.max(.05,depth-.06),bevelEnabled:true,bevelThickness:.03,bevelSize:.03,bevelOffset:-.03,bevelSegments:2,curveSegments:6});
    faceUp(fg);
    const fr=add(G.dial,'dateFrame',fg,metalMaterial(parts.hands.metal,'polished'),{cast:false});fr.position.y=wheelY+.05;
    const cr=Math.hypot(w.x-C,w.y-C),span=Math.hypot(w.w,w.h)/2+w.frame*3;
    const wheel=add(G.dial,'dateWheel',faceUp(sheetUV(new RingGeometry(Math.max(0,cr-span)/PX,(cr+span)/PX,160,1))),
     paintedMaterial(tex(getProc('dial',d,'dateWheel','flat')),{roughness:.5}),{cast:false});
    wheel.position.y=wheelY;wheel.userData.spin='dateWheel'}}}
 /* chronograph registers: running seconds at 3, 12-hour at 6, 30-minute at 9 */
 if(parts.dial.variant==='chrono'&&!dialUpload){const r=Rr.dialR*PX,rs=r*.2,hp=parts.hands;
  for(const[deg,key]of[[90,'smallsec'],[180,'chHr'],[270,'chMin']]){
   const[px,py]=posAt(deg,r*.45),reg=new Group();reg.name='reg:'+key;
   reg.position.set((px-C)/PX,Hc-SUBDIAL_DEPTH_MM+.12,(py-C)/PX);reg.userData.spin=key;G.dial.add(reg);
   const len=rs*.72/PX,w=Math.max(.12,len*.08);
   const hand=add(reg,key+'Hand',new BoxGeometry(w,.08,len),metalMaterial(hp.metal,'polished'),{receive:false});
   hand.position.z=-len/2+len*.12;
   add(reg,key+'Hub',new CylinderGeometry(4/PX,4/PX,.14,20),metalMaterial(hp.metal,'polished'))}}

 /* ---- applied indices: solid, on the dial, with their lume laid in ---- */
 const mk=parts.markers,frame=parts.hands.metal;
 if(!uploaded('markers',G.markers,H.dial+.05,mk.glow?{emissive:new Color(mk.lume),emissiveIntensity:.5}:{})){
  const idxH=mk.variant==='roman'||mk.variant==='arabic'?.2:mk.variant==='dots'?.24:.3;
  const idxGeo=extrudeSilhouette(getProc('markers',d,undefined,'shape'),{depth:idxH,bevel:.035});
  if(idxGeo){const m=add(G.markers,'indices',idxGeo,metalMaterial(frame,'polished'));m.position.y=Hc}
  if(mk.variant!=='roman'&&mk.variant!=='arabic'){
   const lm=add(G.markers,'indicesLume',sheet(),lumeMaterial(tex(getProc('markers',d,undefined,'lume')),mk.lume,mk.glow),{cast:false,noPick:true});
   lm.position.y=Hc+idxH+.004}}

 /* ---- hands: each on its own arbor height; `hand:*` carries its transform,
    the arbor inside it turns with the clock ---- */
 const hp=parts.hands;
 {const holder=new Group();holder.name='hand:upload';G.hands.add(holder);
  if(!uploaded('hands',holder,H.dial+.7)){G.hands.remove(holder);
   const lift={hour:.28,min:.62,sec:.95},thick={hour:.26,min:.24,sec:.14};
   for(const k of['hour','min','sec']){
    const hold=new Group();hold.name='hand:'+k;G.hands.add(hold);
    const arbor=new Group();arbor.name=k;arbor.position.y=H.dial+lift[k];arbor.userData.spin=k;hold.add(arbor);
    const geo=extrudeSilhouette(getProc('hands',d,k,'shape'),{depth:thick[k],bevel:k==='sec'?.025:.04});
    if(!geo)continue;
    const bodyMat=k==='sec'
     ?new MeshPhysicalMaterial({color:new Color(hp.secColor||'#e8482c'),roughness:.32,clearcoat:.6,clearcoatRoughness:.1})
     :metalMaterial(hp.metal,hp.finish);
    add(arbor,k+'Body',geo,bodyMat,{receive:false});
    if(k!=='sec'&&hp.variant!=='dauphine'){
     const lm=add(arbor,k+'Lume',sheet(),lumeMaterial(tex(getProc('hands',d,k,'lume')),hp.lume,hp.glow),{cast:false,receive:false,noPick:true});
     lm.position.y=thick[k]+.004}
    if(k==='sec'){/* the pipe that holds the seconds hand, and its dark pinion */
     const cap=add(arbor,'secCap',new CylinderGeometry(13/PX,13/PX,.22,40),metalMaterial(hp.metal,'polished'));cap.position.y=thick[k]+.11;
     const pin=add(arbor,'secPin',new CylinderGeometry(5/PX,5/PX,.06,24),new MeshPhysicalMaterial({color:0x1c1e22,roughness:.4}),{cast:false});pin.position.y=thick[k]+.25}}}}

 /* ---- crystal ---- */
 if(!uploaded('crystal',G.crystal,H.top+.02,{transparent:true,opacity:parts.crystal.opacity,alphaTest:0,depthWrite:false})){
  const cr=add(G.crystal,'crystal',lathe(P.crystal,180),
   crystalMaterial(parts.crystal.finish,parts.crystal.opacity,arch.crystalMm),{cast:false,receive:false});
  cr.renderOrder=10}

 /* every surface: the key light's point glint scaled to its polish (materials.js) */
 watch.traverse(o=>{if(o.isMesh)softenKeyGlint(o.material)});

 watch.userData={heights:H,radii:Rr,groundY,groups:G,
  pending:pending.length?Promise.all(pending):null};
 return watch}

/* ---------------------------------------------------------------- pose */

const T0={s:1,r:0,x:0,y:0,o:1};
/* Offset, rotation, scale and opacity from the part panels, applied about the
   dial centre exactly as the 2D layers were. Cheap: no rebuild. */
export function applyPose(watch,d){
 const G=watch.userData.groups,P=d.parts;
 const place=(obj,t)=>{t=t||T0;
  obj.position.set((+t.x||0)/PX,0,(+t.y||0)/PX);obj.rotation.y=-(+t.r||0)*Math.PI/180;obj.scale.setScalar(+t.s||1);
  const o=t.o==null?1:+t.o;
  obj.traverse(m=>{if(!m.isMesh)return;const mat=m.material;
   if(mat.userData.baseOpacity==null){mat.userData.baseOpacity=mat.opacity;mat.userData.baseTransparent=mat.transparent}
   const want=mat.userData.baseTransparent||o<1;
   if(mat.transparent!==want){mat.transparent=want;mat.needsUpdate=true}
   mat.opacity=mat.userData.baseOpacity*o})};
 for(const p of PARTS3D){if(p==='hands')continue;place(G[p],P[p]&&P[p].t)}
 for(const h of G.hands.children){
  const k=h.name.slice(5);place(h,k==='hour'?P.hands.tH:k==='sec'?P.hands.tS:P.hands.tM)}}

/* hands, registers and the insert follow the scene clock through the same table
   the exporter uses */
export function poseHead(head,clock){
 head.traverse(o=>{const k=o.userData&&o.userData.spin;
  if(k)o.rotation.y=-layerAngle(k,clock)*Math.PI/180})}

/* ---------------------------------------------------------------- picking */

const visible=o=>{for(let n=o;n;n=n.parent)if(!n.visible)return false;return true};
export function pickables(watch){const out=[];
 watch.traverse(o=>{if(o.isMesh&&!o.userData.noPick&&visible(o))out.push(o)});return out}
const partOf=o=>{for(let n=o;n;n=n.parent)if(n.userData&&n.userData.part)return n.userData.part;return null};
/* an uploaded sheet is only solid where its artwork is */
const opaqueAt=(cv,uv)=>{if(!uv)return true;
 try{const x=Math.min(cv.width-1,Math.max(0,Math.floor(uv.x*cv.width))),y=Math.min(cv.height-1,Math.max(0,Math.floor((1-uv.y)*cv.height)));
  return cv.getContext('2d').getImageData(x,y,1,1).data[3]>40}catch(e){return true}};

/* The part under a ray, with the same rule the 2D stage had: anything inside the
   dial — dial, indices, hands, crystal — keeps whichever of those is selected,
   so clicking the dial area does not steal the selection from the hands. */
export function pickPart3D(watch,raycaster,sel){
 /* rays test world matrices, which are otherwise only refreshed by a render —
    a pose applied since then (or a watch never drawn) would pick stale places */
 watch.updateMatrixWorld(true);
 for(const h of raycaster.intersectObjects(pickables(watch),false)){
  if(h.object.userData.alphaCanvas&&!opaqueAt(h.object.userData.alphaCanvas,h.uv))continue;
  const part=partOf(h.object);if(!part)continue;
  if(DIAL_FAMILY.includes(part))return DIAL_FAMILY.includes(sel)?sel:'dial';
  return part}
 return null}

export function disposeHead(head){
 head.traverse(o=>{if(!o.isMesh)return;o.geometry.dispose();
  if(o.customDepthMaterial)o.customDepthMaterial.dispose();
  /* textures belong to the canvas cache, uploads.js and surface.js */
  o.material.dispose()})}
