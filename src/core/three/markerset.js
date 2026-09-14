/* A PartStudio marker set as solids on the 3D dial.

   Each index is ground by PartStudio's relief from its millimetre outline (or
   its numeral's glyph) at its own resolution — finer than the 1200 px sheet the
   built-in marker styles are traced from — so a set looks here as it did in
   PartStudio. A style's solid is ground once and shared by every hour it sits
   at; the head gets its own copy, since disposing a watch disposes geometry. */
import {MeshPhysicalMaterial,MeshStandardMaterial,Color} from 'three';
import {styleAt,MATERIALS} from '../markerset/model.js';
import {outlineLoops,formOf,boundsOf} from '../markerset/outline.js';
import {rasterize,ppmmFor} from '../markerset/raster.js';
import {buildRelief} from '../markerset/relief.js';
import {glyphField} from '../markerset/glyphs.js';
import {placementOf} from '../render/markerset.js';
import {metalMaterial} from './materials.js';

const geometryKey=s=>JSON.stringify([s.kind,
 s.kind==='shape'?[s.outline,s.lengthMm,s.widthMm,s.taper,s.outerEnd,s.innerEnd,s.cornerMm,s.flip,s.outline==='custom'?s.points:0,s.count,s.gapMm]
  :[s.numerals,s.font,s.weight,s.sizeMm],
 s.top,s.heightMm,s.bevel,s.material==='paint'?'paint':s.material==='lume'?'lume':'metal',s.lume,s.lumeMarginMm]);

const cache=new Map();
function solidOf(s,h){const key=geometryKey(s)+(s.kind==='numeral'?'|'+h:'');
 if(cache.has(key)){const v=cache.get(key);cache.delete(key);cache.set(key,v);return v}
 let out=null;
 try{const form=formOf(s),opts={...form,lumeMarginMm:form.pocket!=null?s.lumeMarginMm:null};
  const field=s.kind==='numeral'?glyphField(s,h,ppmmFor(s.sizeMm,{target:190}))
   :(()=>{const loops=outlineLoops(s),b=boundsOf(loops);return rasterize(loops,ppmmFor(Math.max(b.w,b.h)))})();
  const r=buildRelief(field,opts);out=r&&{geometry:r.geometry,lume:r.lume||null}}
 catch(e){out=null}
 cache.set(key,out);
 while(cache.size>48){const[k,old]=cache.entries().next().value;cache.delete(k);if(old){old.geometry.dispose();old.lume?.dispose()}}
 return out}

/* PartStudio's materials in WatchStudio's metals (white gold and blued steel are
   steel recoloured); frosted is WatchStudio's matte */
const METAL_OF={steel:'steel',white:'steel',gold:'gold',rose:'rose',black:'black',blued:'steel'};
const FINISH_OF={polished:'polished',brushed:'brushed',frosted:'matte'};
function lumeMat(color,glow){const m=new MeshStandardMaterial({color:new Color(color),roughness:.62,metalness:0});
 if(glow){m.emissive=new Color(color);m.emissiveIntensity=.9}return m}
function bodyMat(s,glow){const M=MATERIALS[s.material];
 if(M.kind==='paint')return new MeshPhysicalMaterial({color:new Color(s.paint),metalness:0,roughness:.5,clearcoat:.35,clearcoatRoughness:.3});
 if(M.kind==='lume')return lumeMat(s.lumeColor,glow);
 const m=metalMaterial(METAL_OF[s.material]||'steel',FINISH_OF[s.finish]||'polished');
 if(s.material==='white'||s.material==='blued')m.color=new Color(M.base);
 return m}

/* Put the set's indices into `group` through the head's add(): the dial face at
   height y, its radius dialRmm; skipHour is the hour a date window replaces. */
export function addMarkerSet(set,{group,add,y,dialRmm,skipHour=null,glow=false}){
 const ring=dialRmm*set.ringRatio,mats=new Map();
 const mat=(s,lume)=>{const k=s.id+(lume?':lume':'');
  if(!mats.has(k))mats.set(k,lume?lumeMat(s.lumeColor,glow):bodyMat(s,glow));return mats.get(k)};
 let n=0;
 for(let h=0;h<12;h++){if(h===skipHour)continue;const s=styleAt(set,h);if(!s)continue;
  const sol=solidOf(s,h);if(!sol)continue;
  const p=placementOf(s,h,ring);
  const put=(geo,name,m,o)=>{const mesh=add(group,name,geo.clone(),m,o);mesh.position.set(p.x,y,p.z);mesh.rotation.y=p.rotY;mesh.userData.hour=h;return mesh};
  put(sol.geometry,'index:'+h,mat(s,false));n++;
  if(sol.lume)put(sol.lume,'indexLume:'+h,mat(s,true),{cast:false})}
 return n}
