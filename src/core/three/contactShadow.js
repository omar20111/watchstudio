/* Soft shadows of the hands and the applied indices on the dial.

   The key light's shadow map spans the whole watch and the table round it,
   about 11 cm, so the shadow of a hand a millimetre wide blurs away to a faint
   halo — and a hand with no shadow under it looks printed on the dial, not
   floating over it. These are drawn from each part's own silhouette instead:
   blurred by the penumbra a softbox throws at that height, offset away from the
   key light by that height, and laid on the dial as a darkening decal. A hand's
   decal turns with the hand while its offset keeps pointing away from the light
   (poseHead); the indices' stays put.

   Only the rasterised views draw them: the path tracer and a GLB have real
   light, so exportWatch removes every object marked userData.contactShadow. */
import {CanvasTexture,Mesh,MeshBasicMaterial,PlaneGeometry,SRGBColorSpace,CustomBlending,SrcAlphaFactor,OneMinusSrcAlphaFactor} from 'three';
import {LIGHT} from '../render/material.js';

const SIZE=768;
/* view.js puts the key light at (cos key, sin key) * 55 across and 85 up */
const KEY=[Math.cos(LIGHT.key),Math.sin(LIGHT.key)],RUN=55/85;
/* where a shadow falls, in the scene's x and z, for a part `h` mm above the dial */
export const shadowOffset=h=>[-KEY[0]*h*RUN,-KEY[1]*h*RUN];

/* three passes of a box blur approximate a Gaussian; alpha only */
function boxBlur(a,w,h,r){if(r<1)return a;const tmp=new Float32Array(a.length),n=2*r+1;
 for(let pass=0;pass<3;pass++){
  for(let y=0;y<h;y++){let s=0;const row=y*w;
   for(let x=-r;x<=r;x++)s+=a[row+Math.min(w-1,Math.max(0,x))];
   for(let x=0;x<w;x++){tmp[row+x]=s/n;s+=a[row+Math.min(w-1,x+r+1)]-a[row+Math.max(0,x-r)]}}
  for(let x=0;x<w;x++){let s=0;
   for(let y=-r;y<=r;y++)s+=tmp[Math.min(h-1,Math.max(0,y))*w+x];
   for(let y=0;y<h;y++){a[y*w+x]=s/n;s+=tmp[Math.min(h-1,y+r+1)*w+x]-tmp[Math.max(0,y-r)*w+x]}}}
 return a}

const cache=new WeakMap();
/* the silhouette canvas as a blurred shadow texture, cached per canvas and blur */
function shadowTexture(cv,radiusPx){let m=cache.get(cv);if(!m){m=new Map();cache.set(cv,m)}
 const key=radiusPx.toFixed(2);if(m.has(key))return m.get(key);
 const c=document.createElement('canvas');c.width=c.height=SIZE;const x=c.getContext('2d',{willReadFrequently:true});
 x.drawImage(cv,0,0,SIZE,SIZE);
 const img=x.getImageData(0,0,SIZE,SIZE),px=img.data,a=new Float32Array(SIZE*SIZE);
 for(let i=0;i<a.length;i++)a[i]=px[i*4+3]/255;
 boxBlur(a,SIZE,SIZE,Math.round(radiusPx));
 for(let i=0;i<a.length;i++){px[i*4]=px[i*4+1]=px[i*4+2]=0;px[i*4+3]=Math.round(a[i]*255)}
 x.putImageData(img,0,0);
 const t=new CanvasTexture(c);t.colorSpace=SRGBColorSpace;m.set(key,t);return t}

/* A decal the size of the sheet (`sheetMm` across), centred on the dial, casting
   the silhouette on `cv` from `heightMm` above it. Face up; its caller places it. */
export function shadowDecal(cv,{heightMm,sheetMm,opacity=.5}){
 /* a softbox's penumbra widens with height; a part touching the dial still has a soft edge */
 const penumbraMm=.1+.32*heightMm,tex=shadowTexture(cv,penumbraMm*SIZE/sheetMm/1.8);
 const geo=new PlaneGeometry(sheetMm,sheetMm);geo.rotateX(-Math.PI/2);
 /* Blended, but not `transparent`: three draws what is seen through the crystal
    from a pass of opaque objects only, and a transparent decal under the glass
    vanished. Custom blending keeps the alpha; renderOrder puts it after the dial. */
 const mesh=new Mesh(geo,new MeshBasicMaterial({map:tex,transparent:false,depthWrite:false,opacity,toneMapped:false,
  blending:CustomBlending,blendSrc:SrcAlphaFactor,blendDst:OneMinusSrcAlphaFactor,
  polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
 mesh.renderOrder=2;mesh.castShadow=mesh.receiveShadow=false;
 mesh.userData={noPick:true,noAO:true,contactShadow:true};
 return mesh}
