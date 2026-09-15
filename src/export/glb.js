/* 3D model export — the watch as a binary glTF (.glb).

   The model already exists: this is the same buildHead the editor renders, so
   Blender, a product renderer, a manufacturer's viewer or AR on a phone get the
   geometry, PBR materials (transmission for the sapphire, clearcoat, sheen,
   anisotropy for brushed and sunburst finishes) and the artwork as textures.

   - Real size. The watch is modelled in millimetres and glTF is metres, so the
     root is scaled 1/1000: a 40 mm case is 0.04 m, which is what AR viewers
     place on a wrist or a table.
   - Posed. Part offsets from the panels are applied; the hands read the set time
     for a posed design, and the classic 10:09 for a live one — a model frozen at
     whatever second the button was pressed is not a useful default.
   - One node per design part (strap, case, crown, bezel, dial, markers, hands,
     crystal), so the pieces stay separable downstream.
   - The design's spec (every dimension, construction and material) travels in
     the root node's extras.

   No WebGL needed: geometry is built on the CPU and textures are 2D canvases,
   so this works in the flat-drawing fallback too. */
import {Group,CanvasTexture} from 'three';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {buildHead,applyPose,poseHead,disposeHead,PARTS3D} from '../core/three/watch.js';
import {solidGlass} from '../core/three/materials.js';
import {sceneClock,marketingClock} from '../core/time.js';
import {store} from '../state/store.js';
import {toast} from '../core/utils.js';
import {specData} from './layered.js';

export const MM_TO_M=.001;

/* the posed watch, with any uploaded images loaded into it */
export async function exportWatch(d,customs={}){
 let w=buildHead(d,customs);
 for(let i=0;w.userData.pending&&i<3;i++){await w.userData.pending;disposeHead(w);w=buildHead(d,customs)}
 applyPose(w,d);
 poseHead(w,d.time&&d.time.mode==='set'?sceneClock(d,Date.now()):marketingClock(d));
 /* the dial's contact shadows stand in for light a rasteriser cannot resolve at
    that scale; a path tracer and a glTF viewer light the real thing */
 const drop=[];w.traverse(o=>{if(o.userData&&o.userData.contactShadow)drop.push(o)});
 for(const o of drop)if(o.parent){o.parent.remove(o);o.traverse(m=>{if(m.isMesh){m.geometry.dispose();m.material.dispose()}})}
 return w}

/* The exporter copies every userData into glTF extras. The editor's bookkeeping
   — part groups that reference each other, a pending Promise, picking canvases,
   cached opacities — is not model data, and the circular parts make it warn. */
function stripBookkeeping(root){
 root.traverse(o=>{o.userData={};
  if(o.isMesh)for(const m of[].concat(o.material))m.userData={}})}

/* GLTFExporter writes a DataTexture fine, except a normal map: glTF's green axis
   is the opposite of three's, so it redraws the map flipped — and a DataTexture
   has nothing drawable. The generated knurl and flute maps (surface.js) are
   DataTextures, and every crown has knurling, so without this every export
   threw. Swap in a canvas copy with the same pixels and sampler, on the export's
   own materials only. */
export function drawableMaps(root){const twins=new Map();
 const twin=t=>{if(!t||!t.image||t.image.data===undefined)return t;
  if(twins.has(t))return twins.get(t);
  const{data,width,height}=t.image,c=document.createElement('canvas');c.width=width;c.height=height;
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data),width,height),0,0);
  const ct=new CanvasTexture(c);
  for(const k of['wrapS','wrapT','magFilter','minFilter','colorSpace','flipY','rotation'])ct[k]=t[k];
  /* a tiled map (the strap grain) keeps its tiling: written as KHR_texture_transform */
  ct.repeat.copy(t.repeat);ct.offset.copy(t.offset);ct.center.copy(t.center);
  twins.set(t,ct);return ct};
 root.traverse(o=>{if(!o.isMesh)return;
  for(const m of[].concat(o.material))if(m.normalMap)m.normalMap=twin(m.normalMap)});
 return()=>twins.forEach(t=>t.dispose())}

/* Portable tangents. three derives a tangent frame per pixel for normal maps and
   anisotropy (brushed metal, the sunburst dial); glTF viewers expect the file to
   carry one, and the Khronos validator rejects anisotropy without it. So each
   mesh that needs a frame gets TANGENT vectors computed from its UVs. A mesh with
   no UVs has no frame to compute: it keeps its roughness and loses only the
   directional streak. */
function portableTangents(root){
 root.traverse(o=>{if(!o.isMesh)return;
  const mats=[].concat(o.material);
  if(!mats.some(m=>m.normalMap||m.anisotropy>0))return;
  let g=o.geometry;
  if(!g.index&&g.attributes.uv&&g.attributes.normal){const idx=mergeVertices(g);g.dispose();o.geometry=g=idx}
  if(!(g.index&&g.attributes.uv&&g.attributes.normal)){
   for(const m of mats){m.anisotropy=0;m.anisotropyMap=null;m.normalMap=null}return}
  g.computeTangents();
  /* degenerate UVs (a lathe's pole, a collapsed triangle) give zero or NaN
     tangents; glTF requires unit length with w = ±1, so fall back to any
     direction perpendicular to the normal */
  const t=g.attributes.tangent,n=g.attributes.normal;
  for(let i=0;i<t.count;i++){let x=t.getX(i),y=t.getY(i),z=t.getZ(i);const l=Math.hypot(x,y,z);
   if(l>1e-8&&Number.isFinite(l)){x/=l;y/=l;z/=l}
   else{const nx=n.getX(i),ny=n.getY(i),nz=n.getZ(i),[ax,ay,az]=Math.abs(ny)<.9?[0,1,0]:[1,0,0];
    x=ay*nz-az*ny;y=az*nx-ax*nz;z=ax*ny-ay*nx;const k=Math.hypot(x,y,z);
    /* a vertex whose normal is itself unusable (only zero-area triangles touch it) takes any unit direction */
    if(k>1e-8&&Number.isFinite(k)){x/=k;y/=k;z/=k}else{x=1;y=0;z=0}}
   t.setXYZW(i,x,y,z,t.getW(i)<0?-1:1)}})}

/* The crystal and the cyclops are closed solids and export with
   KHR_materials_volume, so a glTF viewer refracts through them. A double-sided
   pane (the caseback window) is thin-walled glass: volume on a double-sided
   shell is exactly what the validator warns about. */
function thinWalledGlass(root){
 root.traverse(o=>{if(o.isMesh)for(const m of[].concat(o.material))if(m.transmission>0)m.thickness=solidGlass.get(m)||0})}

/* glTF (JSON) or GLB (ArrayBuffer) of a design */
export async function designToGLTF(d,customs={},{name='WatchStudio watch',binary=true,maxTextureSize=2048}={}){
 const watch=await exportWatch(d,customs);
 stripBookkeeping(watch);
 const releaseMaps=drawableMaps(watch);
 portableTangents(watch);thinWalledGlass(watch);
 const root=new Group();root.name=name;root.scale.setScalar(MM_TO_M);root.add(watch);
 root.userData={generator:'WatchStudio',units:'metres (modelled in millimetres)',parts:PARTS3D,spec:specData(d,name)};
 /* trs: separate translation/rotation/scale rather than one matrix, so a hand's
    turn is an editable (animatable) rotation in Blender, not baked into a matrix */
 try{return await new GLTFExporter().parseAsync(root,{binary,maxTextureSize,onlyVisible:true,trs:true})}
 finally{disposeHead(watch);releaseMaps()}}

export async function exportGLB(){
 const s=store.getState();
 toast('Building 3D model…');
 let buf;
 try{buf=await designToGLTF(s.d,s.customs,{name:s.projName})}
 catch(e){console.error('WatchStudio: GLB export failed',e);toast('3D model export failed');return}
 const blob=new Blob([buf],{type:'model/gltf-binary'});
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);
 a.download=`${s.projName.replace(/\s+/g,'_')}.glb`;a.click();
 setTimeout(()=>URL.revokeObjectURL(a.href),6000);
 toast(`3D model exported (${(blob.size/1048576).toFixed(1)} MB) — opens in Blender and AR viewers`)}
