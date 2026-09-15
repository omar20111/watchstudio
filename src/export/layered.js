/* Layered export — one ZIP holding every part's artwork as its own PNG, the
   rendered views, and the numbers behind them.

   This is the handoff format: a dial maker wants the dial, a case maker wants
   the case, and both want the spec to agree with what they are looking at.
   Everything is rendered from the SAME marketing clock, so the hands in the
   views and the hands in the per-part files cannot disagree. */
import {CAN} from '../core/constants.js';
import {geoOf,caseOf,thicknessStack,lugToLugMm,strapMmOf,crownMmOf,bezelMmOf,rehautMmOf,dialLayoutOf} from '../core/geometry.js';
import {buildLayers} from '../core/layers.js';
import {marketingClock} from '../core/time.js';
import {VNAME} from '../core/parts.js';
import {METALS,PX} from '../core/constants.js';
import {store,SCHEMA_VERSION} from '../state/store.js';
import {toast} from '../core/utils.js';
import {zip} from './zip.js';
import {loadImg} from './background.js';
import {sceneBlob3D,renderStill} from '../core/three/view.js';
import {hasStructuralUpload} from '../core/three/uploads.js';
import {webglState} from '../core/three/support.js';
import {flatBlob} from './flat.js';

const bytes=async blob=>blob?new Uint8Array(await blob.arrayBuffer()):new Uint8Array(0);
const enc=s=>new TextEncoder().encode(s);
const safe=s=>String(s).replace(/[^a-z0-9._-]+/gi,'_');

export function specData(d,name){
 const c=caseOf(d),st=thicknessStack(d),g=geoOf(d),P=d.parts;
 return{
  app:'WatchStudio',schemaVersion:SCHEMA_VERSION,name,
  dimensionsMm:{
   caseDiameter:+d.caseMm,caseThickness:c.thickness,lugToLug:lugToLugMm(d),
   lugWidth:strapMmOf(d),lugLength:c.lugLen,lugDrop:c.lugDrop,
   bezelWidth:bezelMmOf(d),rehautWidth:rehautMmOf(d),
   dialDiameter:+( (g.dialR*2/PX).toFixed(2) ),
   crystalHeight:c.crystalMm,crownDiameter:crownMmOf(d)},
  thicknessStackMm:st,
  feasible:c.feasible,minimumThicknessMm:c.minThickness,
  construction:{
   crystal:c.crystal,caseback:c.caseback,movement:c.movement,
   waterResistanceM:c.wrM,crownPosition:c.crownPos,pushers:c.pushers,
   caseShape:c.shape,bezelShape:c.bezelShape,caseSide:c.side,lugStyle:c.lugs,lugHoles:c.lugHoles,
   caseType:VNAME[P.case.variant]||P.case.variant,
   bezelType:VNAME[P.bezel.variant]||P.bezel.variant,
   bezelDetents:P.bezel.detents,bezelAction:P.bezel.dir==='bi'?'bidirectional':'unidirectional',
   strap:VNAME[P.strap.variant]||P.strap.variant,
   handSet:VNAME[P.hands.variant]||P.hands.variant,
   markers:VNAME[P.markers.variant]||P.markers.variant,
   dial:VNAME[P.dial.variant]||P.dial.variant,
   dateWindow:dialLayoutOf(d).date,chapterRing:P.dial.step==='stepped'?'stepped':'flat'},
  materials:{
   case:(METALS[P.case.metal]||{}).name,caseFinish:P.case.finish,
   bezel:(METALS[P.bezel.metal]||{}).name,bezelFinish:P.bezel.finish,
   hands:(METALS[P.hands.metal]||{}).name,crown:(METALS[P.crown.metal]||{}).name,
   dialColour:P.dial.color,lume:P.markers.lume,insert:P.bezel.insertColor}}}

/* the ring stack in canvas px — what a renderer would need to rebuild this */
export function geometryData(d){const g=geoOf(d);
 return{canvas:CAN,centre:[CAN/2,CAN/2],pxPerMm:PX,
  rings:{rCase:g.rCase,rSeat:g.rSeat,rBezOut:g.rBezOut,rBezIn:g.rBezIn,dialR:g.dialR,
   rehautW:g.rehautW,crystalR:g.crystalR,lugExt:g.lugExt,crownR:g.crownR,strapW:g.sw}}}

/* an orthographic elevation on drawing-paper ground */
async function elevation(d,customs,camera,w,h,clock){
 const im=await renderStill({...d,shadow:false},customs,{w,h,camera,clock});
 const cv=document.createElement('canvas');cv.width=w;cv.height=h;
 const x=cv.getContext('2d');x.fillStyle='#f3f2ef';x.fillRect(0,0,w,h);x.drawImage(im,0,0);
 return new Promise(res=>cv.toBlob(res,'image/png'))}

export async function exportLayered(){
 const s=store.getState(),d=s.d;
 toast('Building layered export…');
 const clock=marketingClock(d);
 const files=[];

 /* Every layer on its own transparent sheet, at 1:1 — including parts the
    user replaced with their own artwork. Skipping url-backed layers would
    quietly drop exactly the components someone customised. */
 const seen=new Set();
 for(const l of buildLayers(d,s.customs)){
  if(seen.has(l.key))continue;seen.add(l.key);
  const cv=document.createElement('canvas');cv.width=cv.height=CAN;
  const x=cv.getContext('2d');
  if(l.cv)x.drawImage(l.cv,0,0);
  else if(l.url){try{const im=await loadImg(l.url);x.drawImage(im,0,0,CAN,CAN)}
   catch(e){continue}}
  else continue;
  const b=await new Promise(r=>cv.toBlob(r,'image/png'));
  files.push({name:`parts/${safe(l.key)}.png`,data:await bytes(b)})}

 /* every camera at 2x, from the same clock as the parts. Without WebGL the only
    view is the flat front drawing; the parts, spec and geometry are unaffected. */
 const has3D=webglState().ok;
 if(has3D){
  const front=await sceneBlob3D(d,s.customs,{size:CAN*2,camera:'front',clock});
  files.push({name:'views/front@2x.png',data:await bytes(front)});
  if(!hasStructuralUpload(d,s.customs)){
   const tq=await sceneBlob3D(d,s.customs,{size:CAN*2,camera:'three-quarter',clock});
   files.push({name:'views/three-quarter@2x.png',data:await bytes(tq)})}
  files.push({name:'views/profile@2x.png',data:await bytes(await elevation(d,s.customs,'side',2800,1800,clock))});
  files.push({name:'views/caseback@2x.png',data:await bytes(await elevation(d,s.customs,'back',1800,1800,clock))})}
 else files.push({name:'views/front-2d@2x.png',data:await bytes(await flatBlob(d,s.customs,{size:CAN*2,clock}))});

 files.push({name:'spec.json',data:enc(JSON.stringify(specData(d,s.projName),null,2))});
 files.push({name:'geometry.json',data:enc(JSON.stringify(geometryData(d),null,2))});
 files.push({name:'README.txt',data:enc(
  `${s.projName}\nWatchStudio layered export\n\n`+
  `parts/     every component's artwork on its own transparent 1200x1200 sheet\n`+
  (has3D?`views/     rendered front, three-quarter, profile and caseback at 2x\n`
   :`views/     the flat 2D front drawing at 2x (this browser had no WebGL, so no 3D views)\n`)+
  `spec.json  every dimension in millimetres\n`+
  `geometry.json  the ring stack in canvas pixels (1 mm = ${PX} px)\n`)});

 /* a fixed date keeps the archive byte-identical for an unchanged design */
 const blob=zip(files,{date:new Date(2020,0,1)});
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);
 a.download=`${safe(s.projName)}_layered.zip`;a.click();
 setTimeout(()=>URL.revokeObjectURL(a.href),6000);
 toast(`Exported ${files.length} files`)}
