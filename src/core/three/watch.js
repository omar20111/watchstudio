/* The watch head as a three.js scene graph.

   Shape comes from the millimetre geometry: metal is lathed (lathe.js), hands
   and applied indices are extruded from their traced silhouettes (tracer.js).
   Colour comes from the existing 2D renderers baked `flat` — pigment and
   printing with no painted light — so the dial, the insert and the lume look
   exactly as designed while all light and shadow is real. */
import {Group,Mesh,CircleGeometry,RingGeometry,PlaneGeometry,CylinderGeometry,BoxGeometry,
        CanvasTexture,SRGBColorSpace,MeshPhysicalMaterial,Color,Vector2} from 'three';
import {CAN,PX,C} from '../constants.js';
import {getProc} from '../cache.js';
import {caseOf,bezelRotatable,posAt} from '../geometry.js';
import {layerAngle} from '../layers.js';
import {headProfiles,lathe} from './lathe.js';
import {metalMaterial,crystalMaterial,paintedMaterial} from './materials.js';
import {extrudeSilhouette} from './tracer.js';
import {anisotropyMap,stripeNormalMap} from './surface.js';

const SHEET=CAN/PX;                               /* the 1200 px sheet, in mm */

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

/* how each dial surface scatters light */
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

export function buildHead(d,{aniso=8}={}){
 const{profiles:P,heights:H,radii:Rr}=headProfiles(d);
 const parts=d.parts,arch=caseOf(d),tex=cv=>canvasTexture(cv,aniso);
 const head=new Group();head.name='head';
 const add=(name,geo,mat,{cast=true,receive=true,to=head}={})=>{
  const m=new Mesh(geo,mat);m.name=name;m.castShadow=cast;m.receiveShadow=receive;to.add(m);return m};

 /* ---- case: turned flank, polished chamfer ---- */
 add('caseback',lathe(P.caseback),metalMaterial(parts.case.metal,'brushed'));
 add('flank',lathe(P.flank),metalMaterial(parts.case.metal,parts.case.finish));
 add('chamfer',lathe(P.chamfer),metalMaterial(parts.case.metal,'polished'));
 add('seat',lathe(P.seat),metalMaterial(parts.case.metal,parts.case.finish));
 add('rehaut',lathe(P.rehaut),metalMaterial(parts.case.metal,'brushed'));

 /* ---- bezel ---- */
 const bz=parts.bezel;
 const flankMat=metalMaterial(bz.metal,bz.finish);
 if(Rr.rotating){flankMat.normalMap=stripeNormalMap(110,'knurl');flankMat.normalScale=new Vector2(.9,.9)}
 add('bezelFlank',lathe(P.bezelFlank),flankMat);
 const topMat=metalMaterial(bz.metal,bz.finish);
 if(bz.variant==='fluted'){topMat.normalMap=stripeNormalMap(84,'flute');topMat.normalScale=new Vector2(1.4,1.4)}
 add('bezelTop',lathe(P.bezelTop),topMat);
 add('bezelInner',lathe(P.bezelInner),metalMaterial(bz.metal,'polished'));
 const ring=(r0,r1)=>faceUp(sheetUV(new RingGeometry(r0,r1,180,1)));
 if(bezelRotatable(d)){
  const ins=add('bezelIns',ring(Rr.rInCham,Rr.rInsOut),
   new MeshPhysicalMaterial({map:tex(getProc('bezel',d,'insert','flat')),roughness:.2,clearcoat:.7,clearcoatRoughness:.05}),{cast:false});
  ins.position.y=H.bezelTop+.012;ins.userData.spin='bezelIns'}
 else if(bz.variant==='tachy'){
  const pr=add('bezelPrint',ring(Rr.rInCham,Rr.rGripIn),paintedMaterial(tex(getProc('bezel',d,undefined,'print')),{alphaTest:.35,roughness:.6}),{cast:false});
  pr.position.y=H.bezelTop+.008}

 /* ---- dial ---- */
 const dial=add('dial',faceUp(sheetUV(new CircleGeometry(Rr.dialR,180))),dialMaterial(tex(getProc('dial',d,undefined,'flat')),parts.dial),{cast:false});
 dial.position.y=H.dial;

 /* ---- applied indices: solid, on the dial, with their lume laid in ---- */
 const mk=parts.markers,frame=parts.hands.metal;
 const idxH=mk.variant==='roman'||mk.variant==='arabic'?.2:mk.variant==='dots'?.24:.3;
 const idxGeo=extrudeSilhouette(getProc('markers',d,undefined,'shape'),{depth:idxH,bevel:.035});
 if(idxGeo){const m=add('markers',idxGeo,metalMaterial(frame,'polished'));m.position.y=H.dial}
 if(mk.variant!=='roman'&&mk.variant!=='arabic'){
  const lm=add('markersLume',faceUp(new PlaneGeometry(SHEET,SHEET)),lumeMaterial(tex(getProc('markers',d,undefined,'lume')),mk.lume,mk.glow),{cast:false});
  lm.position.y=H.dial+idxH+.004}

 /* ---- hands, each on its own arbor height, casting real shadows ---- */
 const hp=parts.hands,lift={hour:.28,min:.62,sec:.95},thick={hour:.26,min:.24,sec:.14};
 for(const k of['hour','min','sec']){
  const arbor=new Group();arbor.name=k;arbor.position.y=H.dial+lift[k];arbor.userData.spin=k;head.add(arbor);
  const geo=extrudeSilhouette(getProc('hands',d,k,'shape'),{depth:thick[k],bevel:k==='sec'?.025:.04});
  if(!geo)continue;
  const bodyMat=k==='sec'
   ?new MeshPhysicalMaterial({color:new Color(hp.secColor||'#e8482c'),roughness:.32,clearcoat:.6,clearcoatRoughness:.1})
   :metalMaterial(hp.metal,hp.finish);
  add(k+'Body',geo,bodyMat,{to:arbor,receive:false});
  if(k!=='sec'&&hp.variant!=='dauphine'){
   const lm=add(k+'Lume',faceUp(new PlaneGeometry(SHEET,SHEET)),lumeMaterial(tex(getProc('hands',d,k,'lume')),hp.lume,hp.glow),{to:arbor,cast:false,receive:false});
   lm.position.y=thick[k]+.004}
  if(k==='sec'){/* the pipe that holds the seconds hand, and its dark pinion */
   const cap=add('secCap',new CylinderGeometry(13/PX,13/PX,.22,40),metalMaterial(hp.metal,'polished'),{to:arbor});cap.position.y=thick[k]+.11;
   const pin=add('secPin',new CylinderGeometry(5/PX,5/PX,.06,24),new MeshPhysicalMaterial({color:0x1c1e22,roughness:.4}),{to:arbor,cast:false});pin.position.y=thick[k]+.25}}

 /* ---- chronograph registers: running seconds at 3, 12-hour at 6, 30-minute at 9 ---- */
 if(parts.dial.variant==='chrono'){const r=Rr.dialR*PX,rs=r*.2;
  for(const[deg,key]of[[90,'smallsec'],[180,'chHr'],[270,'chMin']]){
   const[px,py]=posAt(deg,r*.45),reg=new Group();reg.name='reg:'+key;
   reg.position.set((px-C)/PX,H.dial+.12,(py-C)/PX);reg.userData.spin=key;head.add(reg);
   const len=rs*.72/PX,w=Math.max(.12,len*.08);
   const hand=add(key+'Hand',new BoxGeometry(w,.08,len),metalMaterial(hp.metal,'polished'),{to:reg,receive:false});
   hand.position.z=-len/2+len*.12;
   add(key+'Hub',new CylinderGeometry(2.5*1.6/PX,2.5*1.6/PX,.14,20),metalMaterial(hp.metal,'polished'),{to:reg})}}

 /* ---- crystal ---- */
 const cr=add('crystal',lathe(P.crystal,180),
  crystalMaterial(parts.crystal.finish,parts.crystal.opacity,arch.crystalMm),{cast:false,receive:false});
 cr.renderOrder=10;

 head.userData={heights:H,radii:Rr};
 return head}

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
