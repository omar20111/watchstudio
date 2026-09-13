/* Generated surface detail: small data textures instead of modelled micro-geometry.

   - anisotropyMap: the grain direction of a sunburst or circularly brushed dial,
     so the highlight sweeps across the dial the way a real one does, instead of
     a painted conic gradient pointing at an arbitrary angle.
   - stripeNormalMap: flutes on a bezel, knurling on a grip edge or a crown. The
     lathe's u runs once around the ring, so N stripes across u are N teeth.

   All deterministic, all tiny, all cached. */
import {DataTexture,RGBAFormat,LinearFilter,LinearMipmapLinearFilter,ClampToEdgeWrapping,RepeatWrapping,NoColorSpace} from 'three';

const tex=(w,h,fn,wrapS=ClampToEdgeWrapping)=>{const a=new Uint8Array(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const[r,g,b]=fn((x+.5)/w,(y+.5)/h),i=(y*w+x)*4;
  a[i]=Math.round(r*255);a[i+1]=Math.round(g*255);a[i+2]=Math.round(b*255);a[i+3]=255}
 const t=new DataTexture(a,w,h,RGBAFormat);t.colorSpace=NoColorSpace;
 t.magFilter=t.minFilter=LinearFilter;t.wrapS=wrapS;t.wrapT=ClampToEdgeWrapping;t.needsUpdate=true;return t};

const memo=new Map();
const once=(k,f)=>{if(!memo.has(k))memo.set(k,f());return memo.get(k)};

/* Direction in tangent space (u, v), centred on the sheet: 'radial' points away
   from the dial centre, 'circular' runs around it. In KHR_materials_anisotropy
   roughness rises ALONG this direction, so a highlight stretches along it:
   radial grooves (sunburst) want 'circular', turned grooves want 'radial'. */
export const anisotropyMap=kind=>once('aniso:'+kind,()=>tex(256,256,(u,v)=>{
 const dx=u-.5,dy=v-.5,l=Math.hypot(dx,dy)||1;
 let ax=dx/l,ay=dy/l;if(kind==='circular'){const t=ax;ax=-ay;ay=t}
 const s=Math.min(1,l/.02);                        /* no direction at the pinion */
 return[ax*.5+.5,ay*.5+.5,s]}));

/* Snailing: the fine concentric grooves turned into a chronograph register, for a
   disc whose own UVs run 0..1 across it. Each groove is a shallow sine; the
   normal leans out and in across it, which is what makes a register shimmer in
   rings as it turns to the light. */
export const snailNormalMap=(rings=16)=>once('snail:'+rings,()=>{const t=tex(512,512,(u,v)=>{
 const x=(u-.5)*2,y=(v-.5)*2,r=Math.hypot(x,y);
 if(r<1e-4||r>1)return[.5,.5,1];
 const s=Math.cos(r*rings*Math.PI*2)*.55;          /* slope across the groove */
 const nx=-s*x/r,ny=-s*y/r,nz=Math.sqrt(Math.max(0,1-nx*nx-ny*ny));
 return[nx*.5+.5,ny*.5+.5,nz*.5+.5]});
 /* fine grooves alias into fingerprint rings when a register is seen at a grazing
    angle; mipmaps and anisotropic filtering average them out instead */
 t.generateMipmaps=true;t.minFilter=LinearMipmapLinearFilter;t.anisotropy=8;return t});

/* N rounded (flute) or sharp (knurl) ridges around a lathe */
export const stripeNormalMap=(count,profile='flute')=>once(`stripe:${count}:${profile}`,()=>{
 const w=Math.max(512,Math.min(4096,count*12));
 return tex(w,2,u=>{const p=(u*count)%1;
  /* slope of the ridge profile across u */
  const s=profile==='knurl'?(p<.5?1:-1)*.9:-Math.sin(p*Math.PI*2)*.85;
  const nz=Math.sqrt(Math.max(0,1-s*s));return[s*.5+.5,.5,nz*.5+.5]},RepeatWrapping)});
