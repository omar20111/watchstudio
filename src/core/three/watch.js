/* The watch head as a three.js scene graph.

   Metal is lathed from lathe.js. Everything that is artwork rather than shape —
   dial, indices, bezel insert, hands — is the existing 2D bake applied as a
   texture: getProc already returns a 1200x1200 canvas on the same mm-per-pixel
   sheet, so a sheet-sized plane at the right height lines it up exactly.

   Spike limits, deliberately: lugs, strap and crown are not built yet, part
   transforms (offset/rotate/scale) are ignored, and the baked canvases still
   carry their own painted lighting underneath the real lighting. */
import {Group,Mesh,PlaneGeometry,CircleGeometry,RingGeometry,CanvasTexture,SRGBColorSpace,
        MeshDepthMaterial,RGBADepthPacking} from 'three';
import {CAN,PX} from '../constants.js';
import {getProc} from '../cache.js';
import {caseOf,bezelRotatable} from '../geometry.js';
import {layerAngle} from '../layers.js';
import {headProfiles,lathe} from './lathe.js';
import {metalMaterial,crystalMaterial,paintedMaterial} from './materials.js';

const SHEET=CAN/PX;                               /* the 1200 px sheet, in mm */

/* one GPU texture per baked canvas: getProc hands back the same canvas for the
   same key, so an unchanged part never re-uploads */
const texOf=new WeakMap();
function canvasTexture(cv,aniso){let t=texOf.get(cv);
 if(!t){t=new CanvasTexture(cv);t.colorSpace=SRGBColorSpace;t.anisotropy=aniso;texOf.set(cv,t)}
 return t}

/* map a flat shape's xy onto the sheet, so a disc of radius dialR samples
   exactly the pixels the 2D dial painted at that radius */
const sheetUV=geo=>{const p=geo.attributes.position,uv=geo.attributes.uv;
 for(let i=0;i<p.count;i++)uv.setXY(i,.5+p.getX(i)/SHEET,.5+p.getY(i)/SHEET);
 uv.needsUpdate=true;return geo};
/* lay an xy shape face-up; canvas top (12 o'clock) lands on -z */
const faceUp=geo=>{geo.rotateX(-Math.PI/2);return geo};

export function buildHead(d,{aniso=8}={}){
 const{profiles:P,heights:H,radii:Rr}=headProfiles(d);
 const parts=d.parts,arch=caseOf(d),tex=cv=>canvasTexture(cv,aniso);
 const head=new Group();head.name='head';
 const add=(name,geo,mat,{cast=true,receive=true}={})=>{
  const m=new Mesh(geo,mat);m.name=name;m.castShadow=cast;m.receiveShadow=receive;head.add(m);return m};

 /* case: a turned finish on the flank, a polished chamfer — the alternation that
    makes steel read as machined, now from real surface angles */
 add('caseback',lathe(P.caseback),metalMaterial(parts.case.metal,'brushed'));
 add('flank',lathe(P.flank),metalMaterial(parts.case.metal,parts.case.finish));
 add('chamfer',lathe(P.chamfer),metalMaterial(parts.case.metal,'polished'));
 add('seat',lathe(P.seat),metalMaterial(parts.case.metal,parts.case.finish));

 const bz=parts.bezel;
 add('bezelFlank',lathe(P.bezelFlank),metalMaterial(bz.metal,bz.finish));
 add('bezelTop',lathe(P.bezelTop),metalMaterial(bz.metal,bz.finish));
 add('bezelInner',lathe(P.bezelInner),metalMaterial(bz.metal,'polished'));
 add('rehaut',lathe(P.rehaut),metalMaterial(parts.case.metal,'brushed'));

 const dv=parts.dial.variant;
 const dial=add('dial',faceUp(sheetUV(new CircleGeometry(Rr.dialR,180))),
  paintedMaterial(tex(getProc('dial',d)),{roughness:dv==='sunburst'?.34:dv==='matte'||dv==='chrono'?.8:.5}),{cast:false});
 dial.position.y=H.dial;

 const sheet=()=>faceUp(new PlaneGeometry(SHEET,SHEET));
 const markers=add('markers',sheet(),paintedMaterial(tex(getProc('markers',d)),{alphaTest:.02,roughness:.38}),{cast:false});
 markers.position.y=H.dial+.04;

 if(bezelRotatable(d)){
  const ins=add('bezelIns',faceUp(sheetUV(new RingGeometry(Rr.rInCham,Rr.rInsOut,180,1))),
   paintedMaterial(tex(getProc('bezel',d,'insert')),{roughness:.22}),{cast:false});
  ins.position.y=H.bezelTop+.01;ins.userData.spin='bezelIns'}

 /* hands on the motion works, each at its own height, casting real shadows —
    the one thing the 2D hands could not do, because a baked shadow rotates
    with the canvas */
 const lift={hour:.3,min:.55,sec:.8};
 for(const k of['hour','min','sec']){const t=tex(getProc('hands',d,k));
  const m=add(k,sheet(),paintedMaterial(t,{alphaTest:.5,roughness:.3}),{cast:true,receive:false});
  m.customDepthMaterial=new MeshDepthMaterial({depthPacking:RGBADepthPacking,map:t,alphaTest:.5});
  m.position.y=H.dial+lift[k];m.userData.spin=k}

 const cr=add('crystal',lathe(P.crystal,180),
  crystalMaterial(parts.crystal.finish,parts.crystal.opacity,arch.crystalMm),{cast:false,receive:false});
 cr.renderOrder=10;

 head.userData={heights:H,radii:Rr};
 return head}

/* hands and the insert follow the scene clock through the same table the 2D
   stage and the exporter use */
export function poseHead(head,clock){
 head.traverse(o=>{const k=o.userData&&o.userData.spin;
  if(k)o.rotation.y=-layerAngle(k,clock)*Math.PI/180})}

export function disposeHead(head){
 head.traverse(o=>{if(!o.isMesh)return;o.geometry.dispose();
  if(o.customDepthMaterial)o.customDepthMaterial.dispose();
  /* textures belong to the canvas cache, not to this head */
  o.material.dispose()})}
