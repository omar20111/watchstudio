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
import {Group,CanvasTexture,MeshBasicMaterial,PlaneGeometry} from 'three';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {buildHead,applyPose,poseHead,disposeHead,PARTS3D} from '../core/three/watch.js';
import {sceneClock,marketingClock} from '../core/time.js';
import {store} from '../state/store.js';
import {toast} from '../core/utils.js';
import {specData} from './layered.js';

export const MM_TO_M=.001;

/* the posed watch, with any uploaded images loaded into it. `keepShadows`: leave
   the dial's contact shadows in (a glTF file: see portableShadows) */
export async function exportWatch(d,customs={},{keepShadows=false}={}){
 let w=buildHead(d,customs);
 for(let i=0;w.userData.pending&&i<3;i++){await w.userData.pending;disposeHead(w);w=buildHead(d,customs)}
 applyPose(w,d);
 poseHead(w,d.time&&d.time.mode==='set'?sceneClock(d,Date.now()):marketingClock(d));
 /* the dial's contact shadows stand in for light a rasteriser cannot resolve at
    that scale; a path tracer and a glTF viewer light the real thing */
 const drop=[];if(!keepShadows)w.traverse(o=>{if(o.userData&&o.userData.contactShadow)drop.push(o)});
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
  for(const k of['wrapS','wrapT','magFilter','minFilter','colorSpace','flipY','rotation','channel'])ct[k]=t[k];
  /* a tiled map (the strap grain) keeps its tiling: written as KHR_texture_transform */
  ct.repeat.copy(t.repeat);ct.offset.copy(t.offset);ct.center.copy(t.center);
  twins.set(t,ct);return ct};
 root.traverse(o=>{if(!o.isMesh)return;
  /* every generated map, not only normal maps: an engraved caseback's shade and
     roughness maps, a bezel insert's metal fill */
  for(const m of[].concat(o.material))for(const k of['map','normalMap','roughnessMap','metalnessMap','emissiveMap','aoMap','anisotropyMap'])if(m[k])m[k]=twin(m[k])});
 return()=>twins.forEach(t=>t.dispose())}

/* Tiling without the extension. The strap's grain, the Milanese weave, a NATO's
   webbing and a tapisserie dial are small normal maps repeated many times over
   their part's uv, and the repeat travelled as KHR_texture_transform — which a
   viewer is free to skip. One that did (Meshy's, seen here) stretched a single
   tile over the whole strap: leather read as blotchy wet hide. The repeat is
   written into the geometry instead, as a second uv set scaled and shifted just
   as the transform did (TEXCOORD_1, core glTF), with the map sampled from it and
   repeating by its wrap mode, which every viewer honours. Positive scales keep
   the tangents computed from the first uv set valid for the second. */
function bakedTiling(root){const twins=new Map();
 root.traverse(o=>{if(!o.isMesh)return;const g=o.geometry,uv=g.attributes.uv;
  for(const m of[].concat(o.material)){const t=m.normalMap;
   if(!t||!uv||t.channel!==0||(t.repeat.x===1&&t.repeat.y===1&&t.offset.x===0&&t.offset.y===0)||t.rotation!==0)continue;
   if(t.repeat.x<=0||t.repeat.y<=0)continue;
   const a=new Float32Array(uv.count*2);
   for(let i=0;i<uv.count;i++){a[i*2]=uv.getX(i)*t.repeat.x+t.offset.x;a[i*2+1]=uv.getY(i)*t.repeat.y+t.offset.y}
   g.setAttribute('uv1',new g.attributes.uv.constructor(a,2));
   let tw=twins.get(t);if(!tw){tw=t.clone();tw.repeat.set(1,1);tw.offset.set(0,0);tw.channel=1;tw.needsUpdate=true;twins.set(t,tw)}
   m.normalMap=tw}})}

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

/* Glass exports thin-walled: transmission with no KHR_materials_volume. With
   its real thickness a viewer bent the dial through the crystal by an offset,
   and with the glass also blended (fallbackGlass) the dial showed twice, the
   bent copy over the straight one — doubled hands and blurred printing. A real
   sapphire's offset is too small to see from the front; the website bends it by
   a fraction for the same reason (materials.js crystalMaterial). */
function thinWalledGlass(root){
 root.traverse(o=>{if(o.isMesh)for(const m of[].concat(o.material))if(m.transmission>0)m.thickness=0})}

/* The contact shadows under the hands and the applied indices, for a viewer.
   Most glTF viewers light a model with an environment map alone and draw no
   shadows, so without them the hands lie on the dial like a print. Each decal
   (contactShadow.js) is a dark picture on a plane the size of the sheet, blended
   with a custom blend that a file cannot carry: here it is cropped to where the
   shadow is, and made a plain unlit, alpha-blended sheet. */
function portableShadows(root){const out=[];
 root.traverse(o=>{if(o.isMesh&&o.userData&&o.userData.contactShadow)out.push(o)});
 for(const o of out){const m=o.material,cv=m.map&&m.map.image;
  let box=null;
  try{const W=cv.width,H=cv.height,a=cv.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H).data;let x0=W,y0=H,x1=-1,y1=-1;
   for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(a[(y*W+x)*4+3]>2){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
   if(x1>=0)box=[x0/W,y0/H,(x1+1)/W,(y1+1)/H]}catch(e){box=null}
  if(!box){o.parent&&o.parent.remove(o);continue}
  /* the plane faces up, its uv the sheet's: u across toward 3, v up toward 12 */
  o.geometry.computeBoundingBox();const bb=o.geometry.boundingBox,sw=bb.max.x-bb.min.x,sd=bb.max.z-bb.min.z;
  const[u0,t0,u1,t1]=box,w=(u1-u0)*sw,h=(t1-t0)*sd;
  const g=new PlaneGeometry(w,h);g.rotateX(-Math.PI/2);g.translate(bb.min.x+(u0+u1)/2*sw,bb.min.y,bb.min.z+(t0+t1)/2*sd);
  const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,u0+uv.getX(i)*(u1-u0),1-(t0+(1-uv.getY(i))*(t1-t0)));
  o.geometry.dispose();o.geometry=g;
  o.material=new MeshBasicMaterial({map:m.map,color:0x000000,transparent:true,opacity:m.opacity,depthWrite:false,name:'contact shadow'});m.dispose()}}

/* Glass for viewers without transmission. KHR_materials_transmission is an
   optional extension, and a viewer that skips it (Windows 3D Viewer, many web
   and AR viewers) draws the sapphire as what is left: an opaque white solid, a
   disc over the dial that hides the whole face. So the glass is also blended at
   a fifth of its colour: such a viewer shows a faint clear film with the dial
   under it, and one that refracts shows the refraction, faded the same way. */
const GLASS_ALPHA=.2;
function fallbackGlass(root){
 root.traverse(o=>{if(o.isMesh)for(const m of[].concat(o.material))if(m.transmission>0){m.transparent=true;m.opacity=GLASS_ALPHA}})}

/* glTF (JSON) or GLB (ArrayBuffer) of a design */
export async function designToGLTF(d,customs={},{name='WatchStudio watch',binary=true,maxTextureSize=2048}={}){
 const watch=await exportWatch(d,customs,{keepShadows:true});
 portableShadows(watch);
 stripBookkeeping(watch);
 bakedTiling(watch);
 const releaseMaps=drawableMaps(watch);
 portableTangents(watch);thinWalledGlass(watch);fallbackGlass(watch);
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
