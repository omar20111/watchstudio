/* The watch as USDZ, for AR Quick Look on iPhone and iPad.

   Safari opens a USDZ in Apple's AR viewer, which places it on a table (or
   holds it in front of the camera) at real size. A design is built on the fly,
   so there is no file on a server to link to: the model is generated here, in
   the page, and handed to Quick Look as a blob — the way <model-viewer> does.

   Same watch as the GLB (exportWatch), with what USD Preview Surface cannot
   express swapped for what it can:
   - no transmission: the sapphire becomes a faint transparent glass
   - no anisotropy or sheen: brushed metal keeps its roughness, leather its colour
   - generated normal maps (knurling, strap grain) become drawable canvases
   The root is scaled to metres; USDZ is written with 1 unit = 1 metre. */
import {Group} from 'three';
import {USDZExporter} from 'three/examples/jsm/exporters/USDZExporter.js';
import {disposeHead} from '../core/three/watch.js';
import {exportWatch,drawableMaps,MM_TO_M} from './glb.js';

function quickLookMaterials(root){
 root.traverse(o=>{if(!o.isMesh)return;
  for(const m of[].concat(o.material)){
   if(m.transmission>0){m.transmission=0;m.transparent=true;m.opacity=.16;m.roughness=.05;m.metalness=0;m.color.set(0xffffff)}
   m.anisotropy=0;m.anisotropyMap=null}})}

/* USDZ bytes of a design, ready for Quick Look */
export async function designToUSDZ(d,customs={},{maxTextureSize=1536}={}){
 const watch=await exportWatch(d,customs);
 const release=drawableMaps(watch);
 quickLookMaterials(watch);
 /* Quick Look sets the model's origin on the table: lift the strap onto it */
 watch.position.y=-watch.userData.groundY;
 const root=new Group();root.name='WatchStudio';root.scale.setScalar(MM_TO_M);root.add(watch);
 root.updateMatrixWorld(true);
 try{return await new USDZExporter().parseAsync(root,{quickLookCompatible:true,maxTextureSize,
  ar:{anchoring:{type:'plane'},planeAnchoring:{alignment:'horizontal'}}})}
 finally{disposeHead(watch);release()}}
