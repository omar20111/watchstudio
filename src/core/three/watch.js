/* The watch as a three.js scene graph.

   Shape comes from the millimetre geometry: metal is lathed or extruded from
   the same outlines the 2D renderers draw (lathe.js), hands and applied indices
   are ground from their traced silhouettes (relief.js). Colour comes from the
   existing renderers baked `flat` — pigment and printing with no painted light —
   so the dial, insert, strap and lume look as designed while all light and
   shadow is real.

   One group per design part (strap, case, crown, bezel, dial, markers, hands,
   crystal) carries `userData.part`, so picking and the part transforms address
   the same parts the panels do. */
import {Group,Mesh,CircleGeometry,RingGeometry,PlaneGeometry,CylinderGeometry,BoxGeometry,ExtrudeGeometry,Shape,Path,ShapeGeometry,Matrix4,
        BufferGeometry,BufferAttribute,Float32BufferAttribute,CanvasTexture,SRGBColorSpace,MeshPhysicalMaterial,MeshStandardMaterial,
        Color,Vector2,ClampToEdgeWrapping,TorusGeometry,BackSide} from 'three';
import {mergeVertices,mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {CAN,PX,C,METALS,STRAP_REACH_3D} from '../constants.js';
import {getProc,bakeSize} from '../cache.js';
import {caseOf,geoOf,outlinesOf,bezelRotatable,posAt,dialLayoutOf,DIAL_STEP_MM,SUBDIAL_DEPTH_MM,
        strapEndFactor,STRAP_TAIL_MM,STRAP_END_ROUND_MM,strapLengthsOf,strapReachPx,strapTaperEnd,buckleOf,
        HAND_LIFT_MM,DATE_WHEEL_DROP_MM,cyclopsOf,appliedHeightLimitOf,BRACELET_MM,STRAP_HOLES_MM} from '../geometry.js';
import {shade} from '../utils.js';
import {layerAngle} from '../layers.js';
import {headProfiles,lathe,knurledLathe,crownParts,strapPath,smoothstep} from './lathe.js';
import {caseHorns,crownGuards,holeGeometry,shapedProfile} from './casebody.js';
import {crossingAt} from '../caseshape.js';
import {metalMaterial,crystalMaterial,magnifier,paintedMaterial,softenKeyGlint,zoneFinish,withTangents,filteredNormals,brushedReflection} from './materials.js';
import {strapFinish} from '../parts.js';
import {reliefFromSilhouette} from './relief.js';
import {shadowDecal,shadowOffset} from './contactShadow.js';
import {tapisserieCell} from '../render/dial.js';
import {printedIndexInk} from '../render/markers.js';
import {markerSetOf} from '../markerset/index.js';
import {addMarkerSet} from './markerset.js';
import {logoSheet,logoOf,activeLogo} from '../logo.js';
import {applyWear,strapGrainMap,STRAP_GRAIN_MM,normalsFromHeight,dataTexture} from './wear.js';
import {bezelPipOf} from '../render/bezel.js';
import {anisotropyMap,stripeNormalMap,snailNormalMap} from './surface.js';
import {activeUpload,uploadCanvas} from './uploads.js';
import {CASEBACK_WINDOW} from '../render/caseback.js';
import {dialPlateCanvas} from '../dialbg.js';
import {buildMovement} from './movement.js';

/* The ground form of each index style (relief.js), heights in mm. `pocket` is
   the floor of the lume channel; numerals carry no lume. */
export const INDEX_FORM={
 batons:{profile:'bevel',height:.32,edge:.1,bevel:.42,pocket:.24},
 minimal:{profile:'bevel',height:.3,edge:.1,bevel:.42,pocket:.23},
 dots:{profile:'dome',height:.3,edge:.08,bevel:.9,pocket:.22},
 roman:{profile:'bevel',height:.2,edge:.07,bevel:.6},
 arabic:{profile:'bevel',height:.22,edge:.07,bevel:.55},
 eastern:{profile:'bevel',height:.22,edge:.07,bevel:.6},
 /* ground to a ridge along the wedge, like a dauphine hand */
 wedges:{profile:'roof',height:.34,edge:.06}};

/* A dauphine is two ground facets meeting at a ridge; batons and swords are
   bevelled with a flat top carrying the lume; a leaf is rounded. Hour hands
   stand slightly taller than minute hands. Every hand has a real side, a wall
   of 0.08-0.13 mm below its facets, which a polished edge needs to catch a line
   of light: without it a hand seen from low down is a sliver of paper. */
function handForm(variant,which){
 if(which==='sec')return{profile:'bevel',height:.16,edge:.08,bevel:.6};
 const tall=which==='hour'?.02:0;
 /* a dauphine keeps a low wall: the steeper its facets, the more one darkens as the other lights */
 if(variant==='dauphine')return{profile:'roof',height:.34+tall,edge:.07};
 if(variant==='leaf')return{profile:'dome',height:.3+tall,edge:.1,bevel:.85,pocket:.2+tall};
 /* shaped pilot hands: a narrow stem, so a shallow bevel keeps it from grinding to a knife edge */
 if(variant==='cathedral'||variant==='syringe'||variant==='arrow')return{profile:'bevel',height:.26+tall,edge:.12,bevel:.55,pocket:.19+tall};
 const bevel=variant==='sword'?.45:.4;
 return{profile:'bevel',height:.27+tall,edge:.13,bevel,pocket:.2+tall}}

/* How far a hand's tip is curved down toward the dial, mm. A hand is not a flat
   plate: it is pressed to a shallow curve so its tip follows the dial and its
   length catches the light along a curve rather than all at once. */
const HAND_CURVE={dauphine:.1,leaf:.1,cathedral:.06,syringe:.06,arrow:.06};
const handCurve=(variant,which)=>which==='sec'?0:(HAND_CURVE[variant]??.05);

/* Bend a hand (built flat, pointing toward 12, which is -z) down by `drop` mm at
   its tip, turning its normals with it. */
function curveHand(geo,drop){const p=geo.attributes.position,n=geo.attributes.normal;
 let L=0;for(let i=0;i<p.count;i++)L=Math.max(L,-p.getZ(i));
 if(!(L>.5)||!(drop>0))return geo;
 for(let i=0;i<p.count;i++){const z=p.getZ(i),t=Math.max(0,-z)/L;
  p.setY(i,p.getY(i)-drop*t*t);
  if(!n)continue;
  /* the surface now slopes by dy/dz along the hand: turn the normal by that much */
  const b=Math.atan2(-2*drop*z/(L*L),1),c=Math.cos(b),s=Math.sin(b),y=n.getY(i),zz=n.getZ(i);
  n.setY(i,y*c-zz*s);n.setZ(i,y*s+zz*c)}
 p.needsUpdate=true;if(n)n.needsUpdate=true;geo.computeBoundingSphere();return geo}

const SHEET=CAN/PX;                               /* the 1200 px sheet, in mm */
export const PARTS3D=['strap','case','crown','bezel','dial','markers','hands','crystal'];
const DIAL_FAMILY=['dial','markers','hands','crystal'];

/* one GPU texture per baked canvas: getProc hands back the same canvas for the
   same key, so an unchanged part never re-uploads */
const texOf=new WeakMap();
export function canvasTexture(cv,aniso=8){let t=texOf.get(cv);
 if(!t){t=new CanvasTexture(cv);t.colorSpace=SRGBColorSpace;t.anisotropy=aniso;texOf.set(cv,t)}
 return t}

/* Artwork seen up close — the dial's printing, the date, a bezel's scale — is
   baked for its own square of the sheet (cache.js getProc `res`), finer than the
   sheet's 18 px/mm: zoomed in on a large screen, a dial at 18 px/mm is
   magnified four times over and its printing goes soft. Three times finer, or
   twice on a device reporting little memory; never past 4096 px. `half` is the
   square's half-width in sheet px, centred on the dial. */
const ART_SCALE=typeof navigator!=='undefined'&&navigator.deviceMemory&&navigator.deviceMemory<=4?2:3;
const artRes=halfPx=>{const size=2*Math.ceil(halfPx+4);return{box:[C-size/2,C-size/2,size],k:Math.min(ART_SCALE,4096/size)}};

/* Hands and indices are solids traced from their silhouette bakes (relief.js).
   Traced from the sheet's 18 px/mm, a lume channel's rim and a facet's edge follow
   a 0.055 mm pixel grid, ragged up close; they are traced instead from a bake of
   only the part's own rectangle at twice that. The rectangle is read off the
   sheet bake, which their shadows are drawn from anyway. */
const SHAPE_SCALE=2;
const alphaBoxes=new WeakMap();
function alphaBox(cv){if(alphaBoxes.has(cv))return alphaBoxes.get(cv);let box=null;
 try{const W=cv.width,H=cv.height,a=cv.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H).data;let x0=W,y0=H,x1=-1,y1=-1;
  for(let y=0;y<H;y++){const row=y*W;for(let x=0;x<W;x++)if(a[(row+x)*4+3]>8){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}}
  if(x1>=0)box=[x0-6,y0-6,x1-x0+13,y1-y0+13]}catch(e){box=null}
 alphaBoxes.set(cv,box);return box}
/* An upload that is a shape on a transparent ground: something opaque, but
   less than a third of the sheet, and not reaching every edge of it */
const silhouettes=new WeakMap();
function uploadSilhouette(cv){if(silhouettes.has(cv))return silhouettes.get(cv);let ok=false;
 try{const W=cv.width,H=cv.height,a=cv.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H).data;let n=0;
  for(let i=3;i<a.length;i+=4)if(a[i]>128)n++;
  const box=alphaBox(cv);ok=n>40&&n<W*H/3&&!!box&&!(box[0]<=-5&&box[1]<=-5&&box[2]>=W+10&&box[3]>=H+10)}catch(e){ok=false}
 silhouettes.set(cv,ok);return ok}

function fineRelief(part,d,sub,lumed,form){const lo=getProc(part,d,sub,'shape'),box=alphaBox(lo);
 if(!box)return reliefFromSilhouette(lo,{...form,lume:lumed?getProc(part,d,sub,'lume'):null});
 const res={box,k:SHAPE_SCALE};
 return reliefFromSilhouette(getProc(part,d,sub,'shape',res),{...form,lume:lumed?getProc(part,d,sub,'lume',res):null,res})}

/* map a flat shape's xy onto the sheet, so a disc of radius dialR samples
   exactly the pixels the 2D dial painted at that radius; `span` is how many
   sheet px the uv's 0..1 covers, centred on the dial (a finer bake's square) */
const sheetUV=(geo,span=CAN)=>{const p=geo.attributes.position,uv=geo.attributes.uv,s=SHEET*span/CAN;
 for(let i=0;i<p.count;i++)uv.setXY(i,.5+p.getX(i)/s,.5+p.getY(i)/s);
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
 const lg=activeLogo(d,customs);if(lg)up.logo=lg.url;
 return JSON.stringify([d.caseMm,d.strapMm,d.bezelMm,d.crownMm,d.case,parts,up])}

/* ---------------------------------------------------------------- materials */

/* tapisserie pyramids as a normal map: 8 to a tile, laid on the dial's own grid */
let tapNormal=null;
const tapisserieNormalMap=()=>tapNormal||(tapNormal=normalsFromHeight(512,(x,y)=>{
 const fx=(x%64)/64,fy=(y%64)/64,dd=Math.max(Math.abs(fx-.5),Math.abs(fy-.5));return dd>.42?0:1-dd/.42},8));

/* Guilloché, engine-turned: fine concentric waves crossed by a hundred shallow
   spokes, as the 2D dial painted them in light and shade — here a relief, so the
   rings catch and lose the light as the watch turns instead of staying printed.
   A normal map over the plate's uv square (`span` sheet px, centred), with the
   height's gradient taken analytically: rings `r/n` px apart, the spokes fading
   out toward the pinion where they would crowd together. */
const guillocheMaps=new Map();
function guillocheNormalMap(dialR,span){const key=Math.round(dialR)+':'+span;
 if(guillocheMaps.has(key))return guillocheMaps.get(key);
 const N=1024,n=Math.max(18,Math.round(dialR/5.5)),pitch=dialR/n,a1=pitch*.035,a2=dialR*.0006,S=100;
 const a=new Uint8Array(N*N*4);
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){
  const x=((i+.5)/N-.5)*span,y=((j+.5)/N-.5)*span,rho=Math.hypot(x,y)||1e-6,th=Math.atan2(y,x);
  const w=Math.min(1,Math.max(0,(rho/dialR-.1)/.15));
  const dr=-a1*(2*Math.PI/pitch)*Math.sin(2*Math.PI*rho/pitch),dt=-a2*w*S*Math.sin(S*th)/rho;
  const gx=dr*x/rho-dt*y/rho,gy=dr*y/rho+dt*x/rho,l=Math.hypot(gx,gy,1),o=(j*N+i)*4;
  a[o]=Math.round((-gx/l*.5+.5)*255);a[o+1]=Math.round((-gy/l*.5+.5)*255);a[o+2]=Math.round((1/l*.5+.5)*255);a[o+3]=255}
 const t=dataTexture(N,N,a);t.wrapS=t.wrapT=ClampToEdgeWrapping;
 guillocheMaps.set(key,t);if(guillocheMaps.size>4)guillocheMaps.delete(guillocheMaps.keys().next().value);return t}

function dialMaterial(map,p,dialR=null,span=CAN){
 const mat=new MeshPhysicalMaterial({map,metalness:0,roughness:.5});
 if(p.variant==='sunburst'){
  /* radial brushing: the highlight sweeps around the dial as the light moves */
  mat.roughness=.3;mat.anisotropy=.92;mat.anisotropyMap=anisotropyMap('circular')}
 else if(p.finish==='brushed'){mat.roughness=.38;mat.anisotropy=.7;mat.anisotropyMap=anisotropyMap('radial')}
 else if(p.variant==='matte'||p.variant==='chrono')mat.roughness=.82;
 else if(p.variant==='guilloche'){mat.roughness=.3;mat.clearcoat=.35;mat.clearcoatRoughness=.2;
  if(dialR){mat.normalMap=guillocheNormalMap(dialR,span);mat.normalScale=new Vector2(1,1);filteredNormals(mat,1)}}
 else if(p.variant==='fume'){mat.roughness=.28;mat.clearcoat=.6;mat.clearcoatRoughness=.08}
 /* enamel: a glassy glaze fired over the colour */
 else if(p.variant==='enamel'){mat.roughness=.07;mat.clearcoat=1;mat.clearcoatRoughness=.03}
 else if(p.variant==='tapisserie'&&dialR){mat.roughness=.42;
  /* the painting's grid starts at the centre in sheet px; the map's UVs run
     .5 + px/span, so a tile of 8 cells repeats span/(8 cells) times, shifted to land
     a cell corner on the centre */
  const t=tapisserieNormalMap().clone(),R=span/(8*tapisserieCell(dialR)),o=-((.5*R*8)%1)/8;
  t.repeat.set(R,R);t.offset.set(o,o);mat.normalMap=t;mat.normalScale=new Vector2(.9,.9)}
 if(p.finish==='polished'){mat.roughness=Math.min(mat.roughness,.2);mat.clearcoat=Math.max(mat.clearcoat,.5)}
 if(p.finish==='matte')mat.roughness=Math.max(mat.roughness,.85);
 return mat}

/* luminous compound: a faint self-glow only when "lights out" is on */
/* A rotating insert's engraving as surface detail. Its markings (the bezel's
   'shape' bake, white on nothing) are cut into the insert as grooves with
   sloped walls, and filled with a satin metal coat, as a ceramic insert's are.
   Returns a normal map, and a map with roughness in G and metalness in B, both
   on the sheet's UVs like the printed insert — or null where the bake cannot
   be read back. The sheet is a canvas, top row first; a DataTexture's first
   row is its bottom, so rows are read flipped. Cached per bake. `span`: the
   sheet px the bake covers, so a finer bake keeps the same groove in mm. */
const engravings=new WeakMap();
function engravingMaps(cv,span=CAN){if(engravings.has(cv))return engravings.get(cv);
 let out=null;
 try{const W=cv.width,k=W/span,px=cv.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,W).data;
  if(!px||px.length<W*W*4)throw new Error('no pixels');
  const a=new Float32Array(W*W);for(let y=0;y<W;y++)for(let x=0;x<W;x++)a[y*W+x]=px[((W-1-y)*W+x)*4+3]/255;
  /* a box blur twice over is close to a gaussian: the groove's walls slope over a few px */
  let b=a;for(let pass=0;pass<2;pass++){const t=new Float32Array(W*W),o=new Float32Array(W*W),R=Math.max(2,Math.round(2*k)),n=2*R+1;
   for(let y=0;y<W;y++){let s=0;for(let x=-R;x<=R;x++)s+=b[y*W+Math.min(W-1,Math.max(0,x))];
    for(let x=0;x<W;x++){t[y*W+x]=s/n;s+=b[y*W+Math.min(W-1,x+R+1)]-b[y*W+Math.max(0,x-R)]}}
   for(let x=0;x<W;x++){let s=0;for(let y=-R;y<=R;y++)s+=t[Math.min(W-1,Math.max(0,y))*W+x];
    for(let y=0;y<W;y++){o[y*W+x]=s/n;s+=t[Math.min(W-1,y+R+1)*W+x]-t[Math.max(0,y-R)*W+x]}}
   b=o}
  const normal=normalsFromHeight(W,(x,y)=>-b[y*W+x],1.8*k);
  const mr=new Uint8Array(W*W*4);
  for(let i=0;i<W*W;i++){const m=a[i];mr[i*4+1]=Math.round((.34+.18*m)*255);mr[i*4+2]=Math.round(.9*m*255);mr[i*4+3]=255}
  out={normal,mr:dataTexture(W,W,mr)}}
 catch(e){out=null}
 engravings.set(cv,out);return out}

/* Lettering cut into bare metal, as a caseback's engraving is: from the 'shape'
   bake (white on nothing) a normal map of grooves with sloped walls, a roughness
   map (the cut is matte against the finish: G is half on the surface and full in
   a groove, against a material roughness doubled) and a shade map darkening the
   groove's floor. On the sheet's uvs; `span` as engravingMaps. Cached per bake. */
const engravedMetal=new WeakMap();
function engravedMetalMaps(cv,span=CAN){if(engravedMetal.has(cv))return engravedMetal.get(cv);
 let out=null;
 try{const W=cv.width,k=W/span,px=cv.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,W).data;
  if(!px||px.length<W*W*4)throw new Error('no pixels');
  const a=new Float32Array(W*W);for(let y=0;y<W;y++)for(let x=0;x<W;x++)a[y*W+x]=px[((W-1-y)*W+x)*4+3]/255;
  let b=a;for(let pass=0;pass<1;pass++){const t=new Float32Array(W*W),o=new Float32Array(W*W),R=Math.max(1,Math.round(.8*k)),n=2*R+1;
   for(let y=0;y<W;y++){let s=0;for(let x=-R;x<=R;x++)s+=b[y*W+Math.min(W-1,Math.max(0,x))];
    for(let x=0;x<W;x++){t[y*W+x]=s/n;s+=b[y*W+Math.min(W-1,x+R+1)]-b[y*W+Math.max(0,x-R)]}}
   for(let x=0;x<W;x++){let s=0;for(let y=-R;y<=R;y++)s+=t[Math.min(W-1,Math.max(0,y))*W+x];
    for(let y=0;y<W;y++){o[y*W+x]=s/n;s+=t[Math.min(W-1,y+R+1)*W+x]-t[Math.max(0,y-R)*W+x]}}
   b=o}
  const normal=normalsFromHeight(W,(x,y)=>-b[y*W+x],1.4*k);
  const rough=new Uint8Array(W*W*4),shadeMap=new Uint8Array(W*W*4);
  for(let i=0;i<W*W;i++){const m=b[i];rough[i*4+1]=Math.round((.5+.5*m)*255);rough[i*4+3]=255;
   const g=Math.round((1-.5*m)*255);shadeMap[i*4]=shadeMap[i*4+1]=shadeMap[i*4+2]=g;shadeMap[i*4+3]=255}
  out={normal,rough:dataTexture(W,W,rough),shade:dataTexture(W,W,shadeMap)}}
 catch(e){out=null}
 engravedMetal.set(cv,out);return out}

/* A screw-down caseback's face: a turned disc, radius `rc`, with the six notches
   its wrench takes cut into it as pockets `depth` deep, where the 2D caseback
   painted dark bars (render/caseback.js). Shape space, face +z; the caller turns
   it face-down. Normals flat per face of each pocket. Returns the face and the
   pockets apart, so the pockets can be shaded as the recesses they are. */
function casebackFace(rc,R){
 const shape=new Shape();shape.absarc(0,0,rc,0,Math.PI*2,false);
 const r0=R*.66,r1=R*.76,hw=R*.03,depth=Math.min(.5,R*.025),rects=[];
 for(let i=0;i<6;i++){const a=i/6*Math.PI*2,ca=Math.cos(a),sa=Math.sin(a),P=(r,w)=>[ca*r-sa*w,sa*r+ca*w];
  const pts=[P(r0,-hw),P(r1,-hw),P(r1,hw),P(r0,hw)];rects.push(pts);
  const h=new Path();h.moveTo(...pts[0]);h.lineTo(...pts[3]);h.lineTo(...pts[2]);h.lineTo(...pts[1]);h.closePath();shape.holes.push(h)}
 const face=new ShapeGeometry(shape,96);
 const pos=[],idx=[];
 for(const pts of rects){const b=pos.length/3;
  for(const[x,y]of pts)pos.push(x,y,-depth);
  idx.push(b,b+1,b+2,b,b+2,b+3);
  for(let k=0;k<4;k++){const[x0,y0]=pts[k],[x1,y1]=pts[(k+1)%4],w=pos.length/3;
   pos.push(x0,y0,0,x1,y1,0,x1,y1,-depth,x0,y0,-depth);idx.push(w,w+1,w+2,w,w+2,w+3)}}
 const pockets=new BufferGeometry();pockets.setAttribute('position',new Float32BufferAttribute(pos,3));
 pockets.setAttribute('uv',new Float32BufferAttribute(new Float32Array(pos.length/3*2),2));pockets.setIndex(idx);pockets.computeVertexNormals();
 return{face,pockets}}

/* the brand engraved on a clasp's cover: dark cut letters, one texture per text */
const claspMarks=new Map();
function claspMarkMaterial(text){let t=claspMarks.get(text);
 if(!t){const cv=document.createElement('canvas');cv.width=512;cv.height=128;const x=cv.getContext('2d');
  x.fillStyle='rgba(25,27,31,.85)';x.textAlign='center';x.textBaseline='middle';x.font='600 64px Georgia, serif';
  /* long engravings are set smaller rather than run off the cover */
  const s=String(text).toUpperCase(),wd=x.measureText(s).width;if(wd>470)x.font=`600 ${Math.floor(64*470/wd)}px Georgia, serif`;
  x.fillText(s,256,66);t=new CanvasTexture(cv);t.colorSpace=SRGBColorSpace;claspMarks.set(text,t)}
 return new MeshStandardMaterial({map:t,transparent:true,alphaTest:.3,roughness:.6,metalness:0,depthWrite:false})}

function lumeMaterial(map,lume,glow){
 const mat=paintedMaterial(map,{alphaTest:.5,roughness:.62});
 /* marked, so night mode (view.js) can light it in its own colour */
 mat.userData.lume=lume||'#dff3e4';
 if(glow){mat.emissive=new Color(lume);mat.emissiveMap=map;mat.emissiveIntensity=.9}
 return mat}

function strapMaterial(map,p){const v=p.variant;
 if(v==='steel')return new MeshPhysicalMaterial({map,color:0xffffff,metalness:1,roughness:.3,alphaTest:.5,
  envMapIntensity:(METALS[p.metal]||METALS.steel).refl??1});
 /* Milanese: a woven metal band; the bake carries the metal's colour, the
    normal map the weave that breaks its reflections into a soft shimmer. The
    colour is darkened for the gaps between the loops, which light barely
    reaches: without them a band too far away to show its weave reads as a
    plain sheet of steel. A little of the weave's spread becomes roughness as it
    blurs away (filteredNormals), so it keeps its satin look at any zoom.
    Its finish (parts.js strapFinish): satin by default, polished to a brighter
    shimmer, blasted flat, or brushed along the band's length. */
 if(v==='mesh'){const f=strapFinish(p).mesh;
  const mm=new MeshPhysicalMaterial({map,color:new Color(.6,.6,.6),metalness:1,alphaTest:.5,
   roughness:{polished:.3,brushed:.42,matte:.72}[f]??.5,envMapIntensity:(METALS[p.metal]||METALS.steel).refl??1});
  /* the strap's v runs along it (strapGeometry) */
  if(f==='brushed'){mm.anisotropy=.55;mm.anisotropyRotation=Math.PI/2;brushedReflection(mm)}
  mm.normalMap=strapNormalOf('mesh',map.image.height);mm.normalScale=new Vector2(1.3,1.3);return filteredNormals(mm,.15)}
 const mat=new MeshPhysicalMaterial({map,metalness:0,alphaTest:.5,
  roughness:v==='rubber'?.5:v==='nato'?.88:.62,
  sheen:v==='nato'||v==='leather'?.6:0,sheenRoughness:.7,sheenColor:new Color(p.color||'#6b4a2f').multiplyScalar(.6),
  clearcoat:v==='rubber'?.25:0,clearcoatRoughness:.4});
 /* the grain, tiled in millimetres: the strap's u spans the sheet across it and
    its v the tall flat bake along it (strapGeometry) */
 const kind=STRAP_GRAIN_MM[v]?v:'leather';
 mat.normalMap=strapNormalOf(kind,map.image.height);mat.normalScale=new Vector2(1,1).multiplyScalar(kind==='leather'?.55:kind==='nato'?.45:.3);
 return mat}
/* one grain texture per kind and bake height: each strap piece's bake is as
   tall as that piece is long */
const strapNormals=new Map();
const strapNormalOf=(kind,Hc)=>{const key=kind+':'+Hc;
 if(!strapNormals.has(key)){const tile=STRAP_GRAIN_MM[kind];
  const t=strapGrainMap(kind).clone();t.repeat.set(SHEET/tile,Hc/PX/tile);strapNormals.set(key,t)}
 return strapNormals.get(key)};

/* ---------------------------------------------------------------- strap */

/* A strap is a solid swept along strapPath and unrolled onto its flat bake:
   arc length along the strap is distance down the drawn strap, so stitching,
   edges and holes land where they were drawn.

   Its section is cut the way a strap is made: a flat underside lying on the
   path, rolled edges, a crowned top. Leather is padded where it leaves the lugs
   and thins toward its end; rubber is rounder; a NATO is flat webbing. The
   thickness grows up from the underside, so a strap lying on the table stays
   on it. The 12 o'clock strap is doubled over where it folds round the buckle's
   bar; the 6 o'clock strap narrows to its tail (strapEndFactor). */
const STRAP_FORM={
 leather:{pad:.4,crown:.12,edge:.72,roll:.5,taper:.28,inset:.2},
 rubber:{pad:.08,crown:.14,edge:.7,roll:.75,taper:.15,inset:.25},
 nato:{pad:0,crown:0,edge:1,roll:.5,taper:0,inset:.3},
 mesh:{pad:0,crown:.05,edge:.85,roll:.45,taper:0,inset:.3}};
/* section points: up each rolled edge, across the crown, across the underside */
const RING={edge:7,top:11,bottom:3},RING_N=2*RING.edge+RING.top+RING.bottom;

function strapForm(d,which){const sp=strapPath(d),widthAt=strapWidthAt(d,strapReachPx(d,which)),T=sp.T;
 const f=STRAP_FORM[d.parts.strap.variant]||STRAP_FORM.leather;
 /* each piece its own length past the spring bar (strapLengthsOf) */
 const sA=-1.2,sEnd=strapLengthsOf(d)[which];
 /* half-width a, crown and edge heights c and e above the underside k0, edge roll r */
 const at=(s,which)=>{const toTip=sEnd-s,endF=strapEndFactor(which,toTip);
  let b=T*(1-f.taper*smoothstep(0,sEnd,s));
  if(which==='top'){b*=1+.5*smoothstep(5,3.5,toTip);          /* the fold */
   b*=.4+.6*Math.sqrt(Math.max(0,(endF-.8)/.2))}                /* rounded over at the end */
  else b*=.7+.3*endF;
  const pad=f.pad*smoothstep(-1,5,s)*(1-smoothstep(10,42,s));
  const a=Math.max(1e-3,widthAt(s)/2*endF),c=b*(1+f.crown+pad),e=b*f.edge*(1+pad*.3);
  return{a,c,e,r:Math.min(e*f.roll,a*.45),k0:-T/2}};
 return{sp,f,sA,sEnd,at}}

/* the section as RING_N points (x across, k up from the path), anticlockwise
   seen from +z: up the right edge, over the crown, down the left, back under */
function strapRing({a,c,e,r,k0}){const pts=[],h=a-r,hh=Math.max(h,1e-4);
 for(let i=0;i<RING.edge;i++){const p=-Math.PI/2+Math.PI*i/(RING.edge-1);pts.push([h+r*Math.cos(p),k0+e/2+e/2*Math.sin(p)])}
 for(let i=1;i<=RING.top;i++){const x=h-2*h*i/(RING.top+1);pts.push([x,k0+e+(c-e)*(1-(x/hh)**2)])}
 for(let i=0;i<RING.edge;i++){const p=Math.PI/2+Math.PI*i/(RING.edge-1);pts.push([-h+r*Math.cos(p),k0+e/2+e/2*Math.sin(p)])}
 for(let i=1;i<=RING.bottom;i++)pts.push([-h+2*h*i/(RING.bottom+1),k0]);
 return pts}

/* the path's frame at arc length s, and a section point placed in it */
const pathFrame=(sp,s,dir)=>{const[along,y,ang]=sp.pos(s);return{y,z:dir*(sp.start+along),ang,ca:Math.cos(ang),sa:Math.sin(ang)}};
const onPath=(P,dir,x,k)=>[x,P.y+P.ca*k,P.z-dir*P.sa*k];
/* the same placement as a matrix, for solids built in section space */
const pathMatrix=(P,dir)=>new Matrix4().makeTranslation(0,P.y,P.z).multiply(new Matrix4().makeRotationX(-dir*P.ang));

function strapGeometry(d,dir){
 const which=dir<0?'top':'bottom',{sp,f,sA,sEnd,at}=strapForm(d,which);
 const{h:Hc,ty}=bakeSize('strap','flat',d,which),M=RING_N;
 const vAt=s=>1-(C+dir*(sp.start+s)*PX+ty)/Hc;
 /* stations even down the run, bunched toward the tip where the outline turns */
 const endLen=which==='bottom'?STRAP_TAIL_MM:5,st=[];
 for(let i=0;i<150;i++)st.push(sA+(sEnd-endLen-sA)*i/150);
 for(let i=0;i<=48;i++)st.push(sEnd-endLen*(1-i/48)**2);
 const pos=[],uv=[],idx=[];
 /* `inset` samples the texture just inside the drawn edge: the edge pixel is
    anti-aliased to half alpha, which the alpha test would punch through */
 const ringAt=s=>{const sec=at(s,which),P=pathFrame(sp,s,dir),v=vAt(s),lim=Math.max(0,sec.a-f.inset);
  for(const[x,k]of strapRing(sec)){pos.push(...onPath(P,dir,x,k));uv.push(.5+Math.max(-lim,Math.min(lim,x))/SHEET,v)}
  return sec};
 for(const s of st)ringAt(s);
 for(let i=0;i<st.length-1;i++)for(let j=0;j<M;j++){const a=i*M+j,b=i*M+(j+1)%M,c=a+M,e=b+M;
  if(dir>0)idx.push(a,b,c,b,e,c);else idx.push(a,c,b,b,c,e)}
 /* flat caps with their own edge vertices, so the cut end stays crisp instead of
    averaging into the sides; each faces away along the strap */
 const cap=(s,facePlusZ)=>{const base=pos.length/3,sec=ringAt(s),P=pathFrame(sp,s,dir);
  pos.push(...onPath(P,dir,0,sec.k0+sec.e/2));uv.push(.5,vAt(s));const ci=base+M;
  for(let j=0;j<M;j++){const a=base+j,b=base+(j+1)%M;if(facePlusZ)idx.push(ci,a,b);else idx.push(ci,b,a)}};
 cap(sA,dir<0);cap(sEnd,dir>0);
 const geo=new BufferGeometry();
 geo.setAttribute('position',new Float32BufferAttribute(pos,3));geo.setAttribute('uv',new Float32BufferAttribute(uv,2));
 geo.setIndex(idx);geo.computeVertexNormals();
 return geo}

/* Stitching as thread. The flat bake draws the stitches where a leather strap's
   run: twelve sheet px in from each edge, a stitch and a gap every 20 px, from
   just past the lugs to near the end. Painted, they were a dashed line pressed
   into the leather; here each is a slim spindle of thread lying in that channel,
   following the strap's crown and bend, standing proud and catching the light
   along its length. Where the tail narrows the rows stop before they meet. */
function strapStitches(d,dir){
 const which=dir<0?'top':'bottom',{sp,sEnd,at}=strapForm(d,which),g=geoOf(d);
 const inset=12/PX,pitch=20/PX,len=11/PX,rad=.12,ST=6,RN=6;
 const s0=(g.R*.55+6)/PX-sp.start,s1=sEnd-22/PX;
 /* the top of the section at x: over the rolled edges and the crown */
 const topAt=(sec,x)=>{const pts=strapRing(sec).slice(3,3+4+RING.top+4);
  for(let i=0;i<pts.length-1;i++){const[xa,ka]=pts[i],[xb,kb]=pts[i+1];
   if((x<=xa&&x>=xb)||(x>=xa&&x<=xb)){const t=(x-xa)/((xb-xa)||1e-9);return ka+(kb-ka)*t}}
  return sec.k0+sec.e/2};
 const pos=[],idx=[];
 for(const side of[-1,1])for(let s=s0;s+len<=s1;s+=pitch){
  if(at(s+len,which).a-inset<.9)break;
  const base=pos.length/3,C3=[],U=[];
  for(let q=0;q<=ST;q++){const ss=s+len*q/ST,sec=at(ss,which),x=side*(sec.a-inset),P=pathFrame(sp,ss,dir);
   C3.push(onPath(P,dir,x,topAt(sec,x)-rad*.3));U.push([0,P.ca,-dir*P.sa])}
  for(let q=0;q<=ST;q++){const a=C3[Math.max(0,q-1)],b=C3[Math.min(ST,q+1)];
   let T=[b[0]-a[0],b[1]-a[1],b[2]-a[2]];const tl=Math.hypot(...T)||1;T=T.map(v=>v/tl);
   const u=U[q],B=[T[1]*u[2]-T[2]*u[1],T[2]*u[0]-T[0]*u[2],T[0]*u[1]-T[1]*u[0]],bl=Math.hypot(...B)||1;
   const N=[B[1]*T[2]-B[2]*T[1],B[2]*T[0]-B[0]*T[2],B[0]*T[1]-B[1]*T[0]];
   const r=rad*Math.sqrt(Math.max(.08,Math.sin(Math.PI*q/ST)));
   for(let k=0;k<RN;k++){const ph=k/RN*Math.PI*2,cn=Math.cos(ph),sn=Math.sin(ph);
    pos.push(C3[q][0]+(N[0]*cn+B[0]/bl*sn)*r,C3[q][1]+(N[1]*cn+B[1]/bl*sn)*r,C3[q][2]+(N[2]*cn+B[2]/bl*sn)*r)}}
  for(let q=0;q<ST;q++)for(let k=0;k<RN;k++){const a=base+q*RN+k,b=base+q*RN+(k+1)%RN,c=a+RN,e=b+RN;idx.push(a,b,c,b,e,c)}
  const t0=pos.length/3;pos.push(...C3[0]);const t1=t0+1;pos.push(...C3[ST]);
  for(let k=0;k<RN;k++){idx.push(t0,base+(k+1)%RN,base+k);idx.push(t1,base+ST*RN+k,base+ST*RN+(k+1)%RN)}}
 if(!pos.length)return null;
 const geo=new BufferGeometry();geo.setAttribute('position',new Float32BufferAttribute(pos,3));
 geo.setIndex(idx);geo.computeVertexNormals();return geo}

/* The holes down the 6 o'clock strap. The bake cuts each out (render/strap.js),
   which the strap's alpha test punches through its top and its underside; this
   is what a punched hole has besides: the wall of the cut, through the strap's
   thickness, facing into the hole — and on a NATO a metal eyelet, a rolled
   flange on each face. Each is placed on the strap's path at its hole, in the
   strap's own frame (pathMatrix), which near the tail lies flat on the table. */
function strapHoles(d){
 const{sp,sEnd,at}=strapForm(d,'bottom'),nato=d.parts.strap.variant==='nato',r=nato?.7:.78;
 const walls=[],eyelets=[];
 for(const mm of STRAP_HOLES_MM){const s=sEnd-mm;if(s<0)continue;
  const sec=at(s,'bottom'),top=sec.k0+sec.c,M=pathMatrix(pathFrame(sp,s,1),1);
  const w=new CylinderGeometry(r,r,top-sec.k0+.06,24,1,true);w.translate(0,(top+sec.k0)/2,0);w.applyMatrix4(M);walls.push(w);
  if(nato)for(const k of[top,sec.k0]){const e=new TorusGeometry(r+.16,.17,8,28);e.rotateX(Math.PI/2);e.translate(0,k,0);e.applyMatrix4(M);eyelets.push(e)}}
 const merge=list=>{if(!list.length)return null;const g=mergeGeometries(list);list.forEach(x=>x.dispose());return g};
 return{walls:merge(walls),eyelets:merge(eyelets)}}

/* Two keepers round the buckle strap: loops hugging its section with rounded
   rims, the fixed one just behind the fold and the floating one beyond it. */
function strapKeepers(d){
 const{sp,sEnd,at}=strapForm(d,'top'),out=[];
 for(const back of[8,17.5]){const s=sEnd-back,sec=at(s,'top'),len=3.6,g=.6,b=.28;
  const grow=k=>strapRing({a:sec.a+k,c:sec.c+2*k,e:sec.e+2*k,r:sec.r+k,k0:sec.k0-k}).map(([x,y])=>new Vector2(x,y));
  const sh=new Shape(grow(g));sh.holes.push(new Path(grow(.05)));
  const geo=new ExtrudeGeometry(sh,{depth:len-2*b,bevelEnabled:true,bevelThickness:b,bevelSize:.2,bevelOffset:-.2,bevelSegments:3,curveSegments:1});
  geo.translate(0,0,-(len-2*b)/2);
  const m=smooth(geo);m.applyMatrix4(pathMatrix(pathFrame(sp,s,-1),-1));out.push(m)}
 const k=mergeGeometries(out);out.forEach(g=>g.dispose());return k}

/* A tongue buckle on the 12 o'clock strap, lying unfastened: the frame's near
   bar hides in the strap's fold, the tongue hinges there and rests across the
   far bar. Built with u running away from the watch (-z), then placed on the
   path at the strap's end. */
function strapBuckle(d){
 const{sp,sEnd,at}=strapForm(d,'top'),sec=at(sEnd-6,'top');
 const{wire,L}=buckleOf(sec.a),W=2*sec.a+2*wire+.8,t=Math.min(1.9,sec.c*.8);
 const near=-wire*.7,far=near+L-wire,cu=(near+far)/2;
 const sh=roundRectPath(new Shape(),0,cu,W,L,wire*1.8);
 sh.holes.push(roundRectPath(new Path(),0,cu,W-2*wire,L-2*wire,wire*.7));
 /* extrudeShapes lays shape y along -z: u away from the watch */
 const frame=smooth(extrudeShapes([sh],{bottom:0,thick:t,bevel:.6,segments:4}));
 const tt=wire*.5,tl=far+wire*.35-near;
 const tongue=smooth(linkBlock(wire*.8,tl,tt));tongue.translate(0,t+tt/2-.12,-(near+tl/2));
 const m=pathMatrix(pathFrame(sp,sEnd,-1),-1).multiply(new Matrix4().makeTranslation(0,-sp.T/2,0));
 frame.applyMatrix4(m);tongue.applyMatrix4(m);
 return{frame,tongue}}

/* a rounded rectangle centred on (cx, cy), traced into a Shape or a Path */
function roundRectPath(p,cx,cy,w,h,r){const x0=cx-w/2,x1=cx+w/2,y0=cy-h/2,y1=cy+h/2;r=Math.min(r,w/2,h/2);
 p.moveTo(x0+r,y0);p.lineTo(x1-r,y0);p.quadraticCurveTo(x1,y0,x1,y0+r);p.lineTo(x1,y1-r);p.quadraticCurveTo(x1,y1,x1-r,y1);
 p.lineTo(x0+r,y1);p.quadraticCurveTo(x0,y1,x0,y1-r);p.lineTo(x0,y0+r);p.quadraticCurveTo(x0,y0,x0+r,y0);return p}

/* ---------------------------------------------------------------- bracelet */

/* The strap's width at arc length s past the spring bar, mm — the taper every
   strap and bracelet shares with its flat bake. */
function strapWidthAt(d,reach=STRAP_REACH_3D){const g=geoOf(d),sp=strapPath(d),s0px=g.R*.55;
 return s=>{const sPx=(sp.start+s)*PX,p=Math.min(1,Math.max(0,(sPx-s0px)/(reach-s0px)));return g.sw*(1-(1-strapTaperEnd)*p)/PX}}

/* one link: a rounded block pw wide and pl long, t thick, centred on the origin,
   thickness along +y, length along z */
function linkBlock(pw,pl,t){const r=Math.min(.7,pw*.22,pl*.22),x=pw/2,z=pl/2;
 const sh=new Shape();
 sh.moveTo(-x+r,-z);sh.lineTo(x-r,-z);sh.quadraticCurveTo(x,-z,x,-z+r);sh.lineTo(x,z-r);sh.quadraticCurveTo(x,z,x-r,z);
 sh.lineTo(-x+r,z);sh.quadraticCurveTo(-x,z,-x,z-r);sh.lineTo(-x,-z+r);sh.quadraticCurveTo(-x,-z,-x+r,-z);
 const b=Math.min(.38,t*.18,pw*.2);
 const g=new ExtrudeGeometry(sh,{depth:Math.max(.05,t-2*b),bevelEnabled:true,bevelThickness:b,bevelSize:b*.8,bevelOffset:-b*.8,bevelSegments:3,curveSegments:4});
 g.translate(0,0,-t/2+b);g.rotateX(-Math.PI/2);return g}

/* One bracelet link as a pillow: a rounded-rectangle block pw wide (x), pl long
   (z) and t thick (y), centred on the origin, every edge rounded, its top
   crowned across and a little along. A flat link top mirrors one patch of the
   studio and reads as a black or a white tile; crowned, it carries a gradient
   from light to dark the way a real link does. `slope` lowers the top toward
   +x (or -x if negative): an outer link falling away to the bracelet's edge.
   uv in mm, u across and v along, so the brushing grain runs along the bracelet. */
function pillowLink(pw,pl,t,{crown=.1,slope=0}={}){
 const r=Math.min(.32,t*.12,pw*.14,pl*.14),rb=r*.6,rc=Math.max(r+.05,Math.min(pw,pl)*.09),Q=7,S=6,E=4,I=9;
 const hx=pw/2-rc,hz=pl/2-rc,ol=[],corners=[[hx,hz,0],[-hx,hz,Math.PI/2],[-hx,-hz,Math.PI],[hx,-hz,Math.PI*1.5]];
 /* round each corner, then along the straight side to the next: points all the way
    round, so the crowned top is not spanned by long thin triangles that crease it */
 corners.forEach(([cx,cz,a0],ci)=>{
  for(let i=0;i<Q;i++){const a=a0+Math.PI/2*i/(Q-1),nx=Math.cos(a),nz=Math.sin(a);ol.push({x:cx+rc*nx,z:cz+rc*nz,nx,nz})}
  const[cx2,cz2]=corners[(ci+1)%4],a=a0+Math.PI/2,nx=Math.cos(a),nz=Math.sin(a),p0=[cx+rc*nx,cz+rc*nz],p1=[cx2+rc*nx,cz2+rc*nz];
  for(let i=1;i<S;i++){const k=i/S;ol.push({x:p0[0]+(p1[0]-p0[0])*k,z:p0[1]+(p1[1]-p0[1])*k,nx,nz})}})
 const top=(x,z)=>{const u=2*x/pw,v=2*z/pl;
  return t/2+crown*(1-u*u)*(1-.3*v*v)-(slope>0?slope*(u+1)/2:slope<0?-slope*(1-u)/2:0)};
 const inset=(p,dl)=>[p.x-dl*p.nx,p.z-dl*p.nz];
 const rings=[];
 /* underside: flat from the middle out to its rounded edge, round the edge, up the wall */
 for(let i=1;i<=I;i++){const k=i/I;rings.push(ol.map(p=>{const[x,z]=inset(p,rb);return[x*k,-t/2,z*k]}))}
 for(let i=1;i<=E;i++){const dl=rb*(1-i/E);rings.push(ol.map(p=>{const[x,z]=inset(p,dl);return[x,-t/2+rb-Math.sqrt(Math.max(0,rb*rb-(rb-dl)**2)),z]}))}
 /* over the top edge, then the crowned top in to its middle */
 for(let i=0;i<=E;i++){const dl=r*i/E;rings.push(ol.map(p=>{const[x,z]=inset(p,dl);return[x,top(x,z)-r+Math.sqrt(Math.max(0,r*r-(r-dl)**2)),z]}))}
 for(let i=1;i<I;i++){const k=1-i/I;rings.push(ol.map(p=>{const[x0,z0]=inset(p,r),x=x0*k,z=z0*k;return[x,top(x,z),z]}))}
 const pos=[],uv=[],idx=[],M=ol.length,V=(x,y,z)=>{pos.push(x,y,z);uv.push(x,z);return pos.length/3-1};
 const b0=V(0,-t/2,0),rid=rings.map(ring=>ring.map(p=>V(...p))),t0=V(0,top(0,0),0);
 for(let j=0;j<M;j++)idx.push(b0,rid[0][(j+1)%M],rid[0][j]);
 for(let i=0;i<rid.length-1;i++)for(let j=0;j<M;j++){const k=(j+1)%M,a=rid[i][j],b=rid[i][k],c=rid[i+1][j],e=rid[i+1][k];idx.push(a,b,c,b,e,c)}
 const last=rid[rid.length-1];for(let j=0;j<M;j++)idx.push(t0,last[j],last[(j+1)%M]);
 /* face it out of the metal: the top's middle fan must point up */
 const P=i=>[pos[i*3],pos[i*3+1],pos[i*3+2]],A=P(t0),B=P(last[0]),C=P(last[1]);
 const ny=(B[2]-A[2])*(C[0]-A[0])-(B[0]-A[0])*(C[2]-A[2]);
 if(ny<0)for(let i=0;i<idx.length;i+=3){const s=idx[i+1];idx[i+1]=idx[i+2];idx[i+2]=s}
 const g=new BufferGeometry();
 g.setAttribute('position',new Float32BufferAttribute(pos,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));
 g.setIndex(idx);g.computeVertexNormals();return g}

/* A steel bracelet as solid links. Rows of three — two outer links and a centre
   link — follow the same path the strap does, each row a rigid block placed at
   its point along the curve, so the rows open up round the bend the way real
   links hinge. A dark pin under each joint is what the gaps between rows and
   between the pieces of a row show. The first row is a solid end link filling
   the space between the lugs. Rows are merged per material: a few meshes, not
   hundreds, and one node each in a GLB. */
function braceletParts(d,dir){
 const sp=strapPath(d),T=sp.T,bottom=dir>0;
 /* each half its own length; the width tapers to where the bracelet ends, the clasp's end on the 6 o'clock half */
 const sEnd=BRACELET_MM[bottom?'bottom':'top'],widthAt=strapWidthAt(d,(sp.start+sEnd+(bottom?BRACELET_MM.clasp:0))*PX);
 const w0=widthAt(0),pitch=Math.min(8,Math.max(5.2,w0*.36)),gap=Math.max(.18,pitch*.035);
 const place=(geo,s,xc=0)=>{const[along,yc,ang]=sp.pos(s);
  const m=new Matrix4().makeTranslation(0,yc,dir*(sp.start+along))
   .multiply(new Matrix4().makeRotationX(-dir*ang)).multiply(new Matrix4().makeTranslation(xc,0,0));
  geo.applyMatrix4(m);return geo};
 const outer=[],centre=[],pins=[];
 /* end link: full width, from the case to the first joint, its inner edge cut to
    the case's curve so it closes the gap between the lugs as a fitted end link does.
    Cut in three like the rows — two outer pieces and a centre one on the same
    lines, each with its own rounded edges — so the centre row runs on to the case
    in its own finish. */
 const e1=pitch*.8,O=outlinesOf(d).case,integrated=caseOf(d).lugs==='integrated';
 /* against the case's outline, 0.3 mm clear (its top edge leans in as the link follows the strap's bend); on an integrated case
    it starts under the shoulder's end instead */
 const tipMm=(geoOf(d).R+geoOf(d).lugExt)/PX;
 {const smid=e1/2,x=w0*.98/2,n=20,sy=u=>-dir*(u-smid);
  const edge=xx=>integrated?tipMm+.12-sp.start:crossingAt(O.spec,O.A0,-Math.PI/2,Math.abs(xx),.3).s-sp.start;
  const t=T,b=Math.min(.38,t*.18),cw=w0*.36,seam=Math.max(.12,w0*.01);
  const piece=(xa,xb,to)=>{const sh=new Shape();sh.moveTo(xa,sy(edge(xa)));
   for(let i=1;i<=n;i++){const xx=xa+(xb-xa)*i/n;sh.lineTo(xx,sy(edge(xx)))}
   sh.lineTo(xb,sy(e1-gap/2));sh.lineTo(xa,sy(e1-gap/2));sh.closePath();
   const g=new ExtrudeGeometry(sh,{depth:Math.max(.05,t-2*b),bevelEnabled:true,bevelThickness:b,bevelSize:b*.8,bevelOffset:-b*.8,bevelSegments:3,curveSegments:4});
   g.translate(0,0,-t/2+b);g.rotateX(-Math.PI/2);to.push(place(g,smid))};
  piece(-x,-cw/2-seam/2,outer);piece(-cw/2+seam/2,cw/2-seam/2,centre);piece(cw/2+seam/2,x,outer);
  /* dark under the seams, as under a row's */
  for(const sx of[-1,1]){const a=edge(sx*cw/2),l=e1-gap/2-a;if(l<=.2)continue;
   const bar=new BoxGeometry(seam+.3,T*.55,l);bar.translate(sx*cw/2,-T*.12,sy(a+l/2));pins.push(place(bar,smid))}}
 let s=e1;
 for(;s+pitch<sEnd;s+=pitch){
  const mid=s+pitch/2,w=widthAt(mid),pl=pitch-gap;
  /* One height across the row, as a side view shows a real bracelet: the outer
     links fall away a little to the edges, and the centre link is crowned, only
     its middle standing proud of them and its edges dipping below, its underside
     flush with theirs — no second layer showing above or below. */
  const ow=w*.31,cw=w*.36,seam=(w-2*ow-cw)/2;
  outer.push(place(pillowLink(ow,pl,T,{crown:T*.05,slope:-T*.07}),mid,-(w/2-ow/2)));
  outer.push(place(pillowLink(ow,pl,T,{crown:T*.05,slope:T*.07}),mid,w/2-ow/2));
  centre.push(place(pillowLink(cw,pl,T*.93,{crown:T*.14}).translate(0,-T*.035,0),mid,0));
  /* the pin at the joint behind this row, and the shadowed seams inside it */
  const pin=new CylinderGeometry(T*.3,T*.3,w*.96,10);pin.rotateZ(Math.PI/2);pin.translate(0,-T*.12,0);
  pins.push(place(pin,s));
  if(seam>.01){const bar=new BoxGeometry(seam+.3,T*.55,pl*.9);
   for(const sx of[-1,1]){const b2=bar.clone();b2.translate(sx*(cw/2+seam/2),-T*.12,0);pins.push(place(b2,mid))}bar.dispose()}}
 /* the pin at the last joint */
 {const w=widthAt(s),pin=new CylinderGeometry(T*.3,T*.3,w*.96,10);pin.rotateZ(Math.PI/2);pin.translate(0,-T*.12,0);pins.push(place(pin,s))}
 /* the pillow links are indexed and the fitted end link an extrusion, which is not: index it so they merge */
 const indexed=g=>{if(!g.index)g.setIndex([...Array(g.attributes.position.count).keys()]);return g};
 const out={outer:mergeGeometries(outer.map(indexed)),centre:mergeGeometries(centre.map(indexed)),pins:mergeGeometries(pins.map(p=>p.index?p.toNonIndexed():p)),end:s};
 /* The 12 o'clock half ends in the bar the clasp locks onto, carried by a short
    end piece; the 6 o'clock half in a folding clasp lying closed: a cover plate
    over two blades, hinged to the last link. Both built along +z, then placed. */
 const lay=(geo,at)=>{geo.applyMatrix4(new Matrix4().makeScale(1,1,dir));if(dir<0){const ix=geo.index;if(ix){const a=ix.array;for(let i=0;i<a.length;i+=3){const t=a[i+1];a[i+1]=a[i+2];a[i+2]=t}}}return place(geo,at)};
 const w=widthAt(s);
 if(!bottom){const piece=linkBlock(w*.9,3.2,T*.8);piece.translate(0,0,1.6+gap);
  const bar=new CylinderGeometry(T*.32,T*.32,w*.98,20);bar.rotateZ(Math.PI/2);bar.translate(0,0,3.4+gap);
  out.claspEnd=mergeGeometries([lay(piece,s),lay(bar,s)].map(g=>g.index?g.toNonIndexed():g))}
 else{const L=BRACELET_MM.clasp,wc=w+.6;
  const rr=(ww,ll)=>roundRectPath(new Shape(),0,0,ww,ll,Math.min(1.4,ww*.2));
  /* the cover: extruded, its flat faces brushed and its bevel polished (bevelZones) */
  const cover=smooth(extrudeShapes([rr(wc,L)],{bottom:-T/2+T*.62,thick:T*.66,bevel:.35,segments:3}));
  cover.translate(0,0,L/2+gap);
  const blades=[1,.93].map((k,i)=>{const b=smooth(extrudeShapes([rr(wc-.9-i*.5,L*k)],{bottom:-T/2+i*T*.3,thick:T*.28,bevel:.1,segments:2}));b.translate(0,0,L*k/2+gap);return b});
  const knuckle=new CylinderGeometry(T*.38,T*.38,wc*.96,20);knuckle.rotateZ(Math.PI/2);knuckle.translate(0,-T*.05,gap+T*.2);
  out.clasp={cover:lay(cover,s),blades:mergeGeometries(blades.map(b=>lay(b,s)).map(g=>g.index?g.toNonIndexed():g)),knuckle:lay(knuckle,s),
   length:L,width:wc,top:-T/2+T*.62+T*.66,start:s}}
 return out}

/* ---------------------------------------------------------------- finish zones */

/* An extrusion's faces by what they are: its flat top and bottom and its straight
   sides are surface, the rounded band between them the bevel that takes a polish.
   Read from each triangle's facing on the straight extrusion, before it is bent.
   Returns index lists into the geometry. */
function bevelZones(geo){const p=geo.attributes.position,ix=geo.index.array,surface=[],bevel=[];
 for(let t=0;t<ix.length;t+=3){const a=ix[t],b=ix[t+1],c=ix[t+2];
  const ux=p.getX(b)-p.getX(a),uy=p.getY(b)-p.getY(a),uz=p.getZ(b)-p.getZ(a),vx=p.getX(c)-p.getX(a),vy=p.getY(c)-p.getY(a),vz=p.getZ(c)-p.getZ(a);
  const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,l=Math.hypot(nx,ny,nz);if(l<1e-12)continue;
  const up=Math.abs(ny/l);(up>.97||up<.03?surface:bevel).push(a,b,c)}
 return{surface,bevel}}
/* one zone of a geometry as its own geometry, on the same vertices and normals,
   so shading runs on unbroken across the line where the finish changes */
function zonePart(geo,index){const at=new Map(),order=[];
 const ix=index.map(i=>{let j=at.get(i);if(j==null){j=order.length;at.set(i,j);order.push(i)}return j});
 const g=new BufferGeometry();
 for(const k in geo.attributes){const a=geo.attributes[k],n=a.itemSize,arr=new a.array.constructor(order.length*n);
  order.forEach((i,o)=>{for(let c=0;c<n;c++)arr[o*n+c]=a.array[i*n+c]});
  g.setAttribute(k,new BufferAttribute(arr,n,a.normalized))}
 g.setIndex(ix);return g}

/* ---------------------------------------------------------------- cyclops */

/* The cyclops lens (geometry.js cyclopsOf) in its own frame: its base on y=0,
   centred over the date, x toward 3 o'clock. A spherical top over a rounded
   rectangle, meeting straight walls that are lowest at the corners, and a flat
   base bonded to the crystal. Three shells with their own normals, so the
   lens keeps its hard edge where the top meets the wall. */
function cyclopsGeometry({A,B,rc,R,rho,wall}){const M=72,N=12;
 const sd=(x,z)=>{const qx=Math.abs(x)-(A-rc),qz=Math.abs(z)-(B-rc);
  return Math.hypot(Math.max(qx,0),Math.max(qz,0))+Math.min(Math.max(qx,qz),0)-rc};
 /* the footprint's edge along each direction, found by bisection */
 const rim=[];for(let j=0;j<M;j++){const th=2*Math.PI*j/M,c=Math.cos(th),s=Math.sin(th);let lo=0,hi=rho+.01;
  for(let i=0;i<32;i++){const m=(lo+hi)/2;if(sd(m*c,m*s)<0)lo=m;else hi=m}rim.push([lo*c,lo*s])}
 const base=Math.sqrt(R*R-rho*rho),top=(x,z)=>Math.sqrt(Math.max(0,R*R-x*x-z*z))-base+wall;
 const pos=[],nrm=[],idx=[];
 const vtx=(x,y,z,nx,ny,nz)=>{pos.push(x,y,z);nrm.push(nx,ny,nz);return pos.length/3-1};
 const sphere=(x,z)=>[x/R,Math.sqrt(Math.max(0,R*R-x*x-z*z))/R,z/R];
 /* top: a fan at the centre, then rings out to the edge */
 const c0=vtx(0,top(0,0),0,0,1,0),rings=[];
 for(let i=1;i<=N;i++)rings.push(rim.map(([ex,ez])=>{const x=ex*i/N,z=ez*i/N;return vtx(x,top(x,z),z,...sphere(x,z))}));
 for(let j=0;j<M;j++){const k=(j+1)%M;idx.push(c0,rings[0][k],rings[0][j]);
  for(let i=0;i<N-1;i++){const a=rings[i][j],b=rings[i][k],c=rings[i+1][j],e=rings[i+1][k];idx.push(a,b,c,b,e,c)}}
 /* walls: straight down from the top's edge, facing out of the footprint */
 const h=1e-3,wt=[],wb=[];
 for(const[x,z]of rim){let nx=sd(x+h,z)-sd(x-h,z),nz=sd(x,z+h)-sd(x,z-h);const l=Math.hypot(nx,nz)||1;nx/=l;nz/=l;
  wt.push(vtx(x,top(x,z),z,nx,0,nz));wb.push(vtx(x,0,z,nx,0,nz))}
 for(let j=0;j<M;j++){const k=(j+1)%M;idx.push(wb[j],wt[j],wb[k],wt[j],wt[k],wb[k])}
 /* base, facing down onto the crystal */
 const b0=vtx(0,0,0,0,-1,0),bs=rim.map(([x,z])=>vtx(x,0,z,0,-1,0));
 for(let j=0;j<M;j++)idx.push(b0,bs[j],bs[(j+1)%M]);
 const geo=new BufferGeometry();
 geo.setAttribute('position',new Float32BufferAttribute(pos,3));geo.setAttribute('normal',new Float32BufferAttribute(nrm,3));
 geo.setIndex(idx);return geo}

/* ---------------------------------------------------------------- head */

export function buildHead(d,customs={},{aniso=8}={}){
 const{profiles:P,heights:H,radii:Rr,crystal:CR}=headProfiles(d);
 const parts=d.parts,arch=caseOf(d),tex=cv=>canvasTexture(cv,aniso);
 const watch=new Group();watch.name='watch';
 const G={};for(const p of PARTS3D){G[p]=new Group();G[p].name=p;G[p].userData.part=p;watch.add(G[p])}
 const add=(to,name,geo,mat,{cast=true,receive=true,noPick=false}={})=>{
  withTangents(geo,mat);
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
  /* Uploaded hands and indices, drawn on a transparent ground, are traced into
     solids the way the built-in ones are (relief.js), wearing the picture on
     top, with a soft shadow under them: a hand stands over the dial instead of
     lying on it as a picture. A picture with no transparent ground (a photo)
     would trace to a slab the size of the sheet, so it stays a flat sheet. */
  const solid=(part==='hands'||part==='markers')&&uploadSilhouette(src);
  if(solid){const rel=reliefFromSilhouette(src,{profile:'bevel',height:part==='hands'?.22:.3,edge:.07,bevel:.35});
   if(rel){const mat=new MeshStandardMaterial({map,roughness:.45,metalness:0,...extra});delete mat.alphaTest;
    const m=add(to,'upload:'+part,rel.geometry,mat,{cast:true});m.position.y=y-(part==='hands'?.35:.05);m.userData.alphaCanvas=src;
    const h=part==='hands'?.6:.25,sd=shadowDecal(src,{heightMm:h,sheetMm:SHEET,opacity:.5}),[dx,dz]=shadowOffset(h);
    sd.position.set(dx,H.dial+.01,dz);G.dial.add(sd);
    return m}}
  const mat=new MeshStandardMaterial({map,roughness:.5,metalness:0,alphaTest:.5,...extra});
  const m=add(to,'upload:'+part,sheet(),mat,{cast:true});m.position.y=y;m.userData.alphaCanvas=src;m.userData.noAO=true;
  return m};

 const cp=crownParts(d),sp=strapPath(d);
 const groundY=sp.groundY;

 /* ---- strap ---- */
 if(!uploaded('strap',G.strap,sp.pos(0)[1]+sp.T/2))
  if(parts.strap.variant==='steel'){const st=parts.strap,sf=strapFinish(st);
   /* Each piece in its finish (parts.js strapFinish). Brushed along the
      bracelet's length: the grain runs across the links' v, not u. Polished is a
      touch less than mirror: at a true mirror polish each link reflects one dark
      studio wall and reads as a black tile. The clasp's bevel and hinge are
      polished unless the whole bracelet is blasted. */
   const fin=f=>f==='brushed'?Object.assign(metalMaterial(st.metal,'brushed'),{anisotropyRotation:Math.PI/2})
    :f==='matte'?metalMaterial(st.metal,'matte'):Object.assign(metalMaterial(st.metal,'polished'),{roughness:.14});
   const edge=()=>metalMaterial(st.metal,sf.links==='matte'?'matte':'polished');
   for(const[dir,which]of[[-1,'top'],[1,'bottom']]){const b=braceletParts(d,dir);
    add(G.strap,'bracelet:'+which+':outer',b.outer,fin(sf.links));
    add(G.strap,'bracelet:'+which+':centre',b.centre,fin(sf.centre));
    add(G.strap,'bracelet:'+which+':pins',b.pins,new MeshPhysicalMaterial({color:0x1c1e22,metalness:.7,roughness:.55}),{cast:false});
    if(b.claspEnd)add(G.strap,'bracelet:top:claspEnd',b.claspEnd,fin(sf.clasp));
    if(b.clasp){const c=b.clasp,z=bevelZones(c.cover);
     /* finished along its length like the links, its bevel polished, the brand engraved on it */
     add(G.strap,'bracelet:clasp',zonePart(c.cover,z.surface),fin(sf.clasp));
     add(G.strap,'bracelet:claspEdges',zonePart(c.cover,z.bevel),edge());c.cover.dispose();
     add(G.strap,'bracelet:claspBlades',c.blades,fin(sf.clasp));
     add(G.strap,'bracelet:claspHinge',c.knuckle,edge());
     const mark=add(G.strap,'bracelet:claspMark',faceUp(new PlaneGeometry(c.width*.62,c.width*.62*.25)),claspMarkMaterial((d.case&&d.case.engraving)||'WATCHSTUDIO'),{cast:false,receive:false,noPick:true});
     mark.rotation.y=Math.PI/2;mark.position.set(0,sp.pos(c.start+c.length/2)[1]+c.top+.004,sp.start+sp.pos(c.start+c.length/2)[0])}}}
  else{const st=parts.strap;
   for(const[dir,which]of[[-1,'top'],[1,'bottom']])
    {add(G.strap,'strap:'+which,strapGeometry(d,dir),strapMaterial(tex(getProc('strap',d,which,'flat')),st));
     const sg=st.variant==='leather'&&strapStitches(d,dir);
     if(sg)add(G.strap,'strap:'+which+':stitches',sg,new MeshPhysicalMaterial({color:new Color(st.stitch||'#e0cfa6'),roughness:.72,
      sheen:.5,sheenRoughness:.6,sheenColor:new Color(st.stitch||'#e0cfa6')}),{cast:false})}
   if(st.variant!=='mesh'){const ho=strapHoles(d),col=st.color||'#6b4a2f';
    /* the cut edge of the leather or rubber, facing into the hole */
    if(ho.walls)add(G.strap,'strap:holeWalls',ho.walls,st.variant==='nato'?Object.assign(metalMaterial(st.metal==='ceramic'?'steel':st.metal==='carbon'?'black':(st.metal||'steel'),'polished'),{side:BackSide})
     :new MeshStandardMaterial({color:new Color(shade(col,st.variant==='rubber'?.35:.55)),roughness:.85,metalness:0,side:BackSide}),{cast:false});
    if(ho.eyelets)add(G.strap,'strap:eyelets',ho.eyelets,metalMaterial(st.metal==='ceramic'?'steel':st.metal==='carbon'?'black':(st.metal||'steel'),'polished'),{cast:false})}
   /* hardware in the strap's own metal; a ceramic or carbon watch still wears a
      steel or black buckle */
   const hw=st.metal==='ceramic'?'steel':st.metal==='carbon'?'black':(st.metal||'steel');
   const col=st.color||'#6b4a2f';
   /* the buckle and metal keepers in the strap's finish (parts.js strapFinish).
      Brushed where the part has a uv to run the grain along; a solid without one
      (withTangents) falls back to satin. */
   const hf=strapFinish(st).hardware;
   const hwMat=(polishedRough)=>hf==='polished'?Object.assign(metalMaterial(hw,'polished'),{roughness:polishedRough}):metalMaterial(hw,hf);
   add(G.strap,'strap:keepers',strapKeepers(d),st.variant==='nato'||st.variant==='mesh'?hwMat(.34)
    :new MeshPhysicalMaterial({color:new Color(st.variant==='leather'?shade(col,.18):col),metalness:0,
      roughness:st.variant==='rubber'?.5:.62,sheen:st.variant==='rubber'?0:.6,sheenRoughness:.7,
      sheenColor:new Color(col).multiplyScalar(.6),clearcoat:st.variant==='rubber'?.25:0,clearcoatRoughness:.4}));
   const bk=strapBuckle(d),rough=Math.max(.16,(METALS[hw]||METALS.steel).rough??0);
   add(G.strap,'strap:buckle',bk.frame,hwMat(rough));
   add(G.strap,'strap:tongue',bk.tongue,hwMat(rough))}

 /* ---- case: turned flank, polished chamfer, horns, caseback ----
    Each face takes its zone's finish (materials.js zoneFinish): the case's own
    finish on its surfaces, a polish on its bevels. */
 const cm=parts.case,caseMat=zone=>metalMaterial(cm.metal,zoneFinish(cm.finish,zone));
 /* A shaped case or bezel (caseshape.js) sweeps its profiles round its outline;
    a round one turns them. The caseback, the rehaut and the crystal stay round,
    and the seat and the bezel's top morph from the outline to the round opening. */
 const OL=outlinesOf(d),shaped=OL.case.kind!=='round'||OL.bezel.kind!=='round';
 const prof=(pts,shapeAt)=>shaped?shapedProfile(pts,shapeAt,OL):lathe(pts);
 if(!uploaded('case',G.case,H.seat)){
  if(arch.caseback==='exhibition')add(G.case,'caseback',lathe(P.caseback),caseMat('turned'));
  else{
   /* turned in circles (an anisotropy map round the centre, as the plate's uvs
      are the sheet's), notched, and engraved into the metal at twice the sheet */
   const back=caseMat('turned'),bres=artRes(Rr.rCase*.8*PX),eres={...bres,k:Math.min(2,bres.k)};
   back.anisotropyMap=anisotropyMap('circular');
   const eng=engravedMetalMaps(getProc('caseback',d,undefined,'shape',eres),eres.box[2]);
   if(eng){back.normalMap=eng.normal;back.roughnessMap=eng.rough;back.roughness=Math.min(1,back.roughness*2);back.map=eng.shade}
   const{face,pockets}=casebackFace(Rr.rCase*.8,geoOf(d).R/PX);
   for(const g of[face,pockets]){sheetUV(g,eres.box[2]);g.rotateX(Math.PI/2);g.rotateY(Math.PI)}
   add(G.case,'caseback',face,back);
   /* a slot's walls and floor see little of the room: the case metal, darker and blasted */
   const slot=metalMaterial(cm.metal,'matte');slot.color.multiplyScalar(.45);
   add(G.case,'casebackNotches',pockets,slot,{cast:false})}
  add(G.case,'casebackRim',lathe(P.casebackRim),caseMat('bevel'));
  add(G.case,'flank',prof(P.flank,i=>({from:i===0?'round':'case'})),caseMat('surface'));
  /* the broken edges either side of the chamfer (lathe.js headProfiles), polished */
  add(G.case,'flankEdge',prof(P.flankEdge,()=>({from:'case'})),caseMat('bevel'));
  add(G.case,'chamfer',prof(P.chamfer,()=>({from:'case'})),caseMat('bevel'));
  add(G.case,'chamferEdge',prof(P.chamferEdge,()=>({from:'case'})),caseMat('bevel'));
  /* round a turned case the seat is a narrow polished step; on a shaped case it is
     the broad top between the outline and the bezel, and takes the case's finish */
  add(G.case,'seat',prof(P.seat,i=>({from:i===0?'case':'bezel'})),caseMat(OL.case.kind==='round'?'bevel':'surface'));
  add(G.case,'rehaut',lathe(P.rehaut),metalMaterial(cm.metal,'brushed'));
  /* the lugs and crown guards grow out of the case (casebody.js): each is one
     solid with its bevels as their own faces, merged into one mesh per zone */
  const zoneMesh=(parts,zone)=>mergeGeometries(parts.map(p=>zonePart(p.geometry,p[zone])).filter(g=>g.index.count));
  const horns=caseHorns(d);
  add(G.case,'lugs',zoneMesh(horns.parts,'surface'),caseMat('surface'));
  add(G.case,'lugEdges',zoneMesh(horns.parts,'bevel'),caseMat('bevel'));
  for(const p of horns.parts)p.geometry.dispose();
  if(horns.holes.length)add(G.case,'lugHoles',mergeGeometries(horns.holes.map(holeGeometry)),
   new MeshPhysicalMaterial({color:0x111215,metalness:.2,roughness:.7}),{cast:false});
  const guards=crownGuards(d);
  if(guards.length){add(G.case,'guards',zoneMesh(guards,'surface'),caseMat('surface'));
   add(G.case,'guardEdges',zoneMesh(guards,'bevel'),caseMat('bevel'));for(const p of guards)p.geometry.dispose()}
  /* the caseback face: engraving, or the movement behind a sapphire window */
  const faceDown=geo=>{geo.rotateX(Math.PI/2);geo.rotateY(Math.PI);return geo};
  if(arch.caseback==='exhibition'){const rw=Rr.rCase*CASEBACK_WINDOW;
   /* the movement itself (movement.js), and a solid sapphire window set just
      inside the caseback's face */
   G.case.add(buildMovement(arch.movement,H,Rr,{engrave:arch.engraving}));
   const g0=.1,g1=Math.min(H.back-.15,g0+1),Vv=(x,y)=>new Vector2(x,y);
   const glass=add(G.case,'backGlass',lathe([Vv(0,g0),Vv(rw,g0),Vv(rw,g1),Vv(0,g1)],96),
    crystalMaterial('polished',.5,{solid:g1-g0}),{cast:false,receive:false});
   glass.renderOrder=10}
  /* pushers are part of the case band */
  for(const pu of cp.pushers){const grp=new Group();grp.position.y=cp.axisY;grp.rotation.y=-(pu.bearing-90)*Math.PI/180;G.case.add(grp);
   const sh=new CylinderGeometry(pu.shoulder.r,pu.shoulder.r,pu.shoulder.x1-pu.shoulder.x0,24);sh.rotateZ(Math.PI/2);sh.translate((pu.shoulder.x0+pu.shoulder.x1)/2,0,0);
   add(grp,'pusherShoulder',sh,caseMat('surface'));
   const r=pu.head.r,L=pu.head.len,e=Math.min(.3,r*.25),Vv=(x,y)=>new Vector2(x,y);
   const hd=lathe([Vv(pu.shoulder.r,0),Vv(r-e,0),Vv(r,e),Vv(r,L-e),Vv(r-e,L),Vv(0,L)],48);
   hd.rotateZ(-Math.PI/2);hd.translate(pu.head.x0,0,0);
   add(grp,'pusherHead',hd,caseMat('bevel'))}}

 /* ---- crown: tube, knurled barrel, domed end, swung to its bearing ---- */
 if(!uploaded('crown',G.crown,cp.axisY+cp.tube.r*5)){
  const cr=parts.crown,crownMat=zone=>metalMaterial(cr.metal,zoneFinish(cr.finish,zone)),grp=new Group();grp.position.y=cp.axisY;grp.rotation.y=-(cp.bearing-90)*Math.PI/180;G.crown.add(grp);
  const tube=new CylinderGeometry(cp.tube.r,cp.tube.r,cp.tube.x1-cp.tube.x0,32);tube.rotateZ(Math.PI/2);tube.translate((cp.tube.x0+cp.tube.x1)/2,0,0);
  add(grp,'crownTube',tube,crownMat('bevel'));
  const along=pts=>{const g=lathe(pts,72);g.rotateZ(-Math.PI/2);g.translate(cp.barrelX,0,0);return g};
  add(grp,'crownInner',along(cp.inner),crownMat('surface'));
  /* knurled: teeth cut into the barrel, a little under a third of their pitch deep */
  const side=knurledLathe(cp.side,cp.teeth,Math.PI*2*cp.side[0].x/cp.teeth*.3);side.rotateZ(-Math.PI/2);side.translate(cp.barrelX,0,0);
  add(grp,'crownSide',side,crownMat('surface'));
  add(grp,'crownEnd',along(cp.end),crownMat('bevel'))}

 /* ---- bezel ---- */
 const bz=parts.bezel,bezelMat=zone=>metalMaterial(bz.metal,zoneFinish(bz.finish,zone));
 if(!uploaded('bezel',G.bezel,H.bezelTop+.02)){
  /* a rotating bezel's grip and a coin edge, cut into a round bezel's flank; a
     shaped bezel keeps them as a pattern on its surface */
  const flankMat=bezelMat('surface'),teeth=Rr.rotating?110:bz.variant==='coin'?220:0;
  let flank;
  if(teeth&&OL.bezel.kind==='round')flank=knurledLathe(P.bezelFlank,teeth,Math.PI*2*Rr.rBezOut/teeth*(Rr.rotating?.26:.24));
  else{flank=prof(P.bezelFlank,()=>({from:'bezel'}));
   if(teeth){flankMat.normalMap=stripeNormalMap(teeth,'knurl');flankMat.normalScale=new Vector2(.9,.9)}}
  add(G.bezel,'bezelFlank',flank,flankMat);
  add(G.bezel,'bezelEdge',prof(P.bezelEdge,()=>({from:'bezel'})),bezelMat('bevel'));
  const topMat=bezelMat('surface');
  if(bz.variant==='fluted'){topMat.normalMap=stripeNormalMap(84,'flute');topMat.normalScale=new Vector2(1.4,1.4)}
  /* an octagonal bezel's top runs from its octagon at the grip to the round insert or opening */
  add(G.bezel,'bezelTop',prof(P.bezelTop,(i,p)=>({from:'bezel',to:'round',t:Math.min(1,Math.max(0,(Rr.rGripIn-p.x)/Math.max(1e-6,Rr.rGripIn-Rr.rInCham)))})),topMat);
  add(G.bezel,'bezelInner',lathe(P.bezelInner),bezelMat('bevel'));
  const bres=artRes(Math.max(Rr.rInsOut||0,Rr.rGripIn||0,Rr.rInCham||0)*PX);
  const ring=(r0,r1)=>faceUp(sheetUV(new RingGeometry(r0,r1,180,1),bres.box[2]));
  if(bezelRotatable(d)){
   /* anodised or ceramic: a light coat only — a strong clearcoat mirrors the
      overhead softbox and turns a black insert grey */
   const insMat=new MeshPhysicalMaterial({map:tex(getProc('bezel',d,'insert','flat',bres)),roughness:.34,clearcoat:.22,clearcoatRoughness:.18});
   /* the scale engraved into it and filled with metal: its relief at twice the
      sheet's resolution (its blur and normals are worked out on the CPU, once per bezel design) */
   const eres={...bres,k:Math.min(2,bres.k)},eng=engravingMaps(getProc('bezel',d,'insert','shape',eres),eres.box[2]);
   if(eng){insMat.normalMap=eng.normal;insMat.normalScale=new Vector2(1,1);
    insMat.roughnessMap=insMat.metalnessMap=eng.mr;insMat.roughness=1;insMat.metalness=1}
   const ins=add(G.bezel,'bezelIns',ring(Rr.rInCham,Rr.rInsOut),insMat,{cast:false});
   ins.position.y=H.bezelTop+.012;ins.userData.spin='bezelIns';
   /* the lume pip at zero stands proud in a polished setting, and turns with the insert */
   {const pip=bezelPipOf(geoOf(d),bz.variant),x=(pip.x-C)/PX,z=(pip.y-C)/PX,ro=pip.r/PX,rl=pip.lume/PX,Vv=(a,b)=>new Vector2(a,b);
    const cup=lathe([Vv(ro,0),Vv(ro,.18),Vv(ro-.06,.26),Vv(rl,.26),Vv(rl,.14)],48);cup.translate(x,0,z);
    add(ins,'bezelPip',cup,metalMaterial(bz.metal,'polished'),{receive:false});
    const dome=[];for(let i=0;i<=10;i++){const t=i/10;dome.push(Vv(rl*Math.cos(t*Math.PI/2),.14+.2*Math.sin(t*Math.PI/2)))}
    dome[10]=Vv(0,.34);const lm=lathe(dome,40);lm.translate(x,0,z);
    const lumeMat=new MeshStandardMaterial({color:new Color(parts.markers.lume||'#dff3e4'),roughness:.55,metalness:0});
    lumeMat.userData.lume=parts.markers.lume||'#dff3e4';
    add(ins,'bezelPipLume',lm,lumeMat,{cast:false,receive:false})}}
  else if(bz.variant==='tachy'){
   const pr=add(G.bezel,'bezelPrint',ring(Rr.rInCham,Rr.rGripIn),paintedMaterial(tex(getProc('bezel',d,undefined,'print',bres)),{alphaTest:.35,roughness:.6}),{cast:false});
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
  /* the plate wears its artwork, over a background picture where one is set */
  const dres=artRes(Rr.dialR*PX),dspan=dres.box[2];
  let plateArt=dialPlateCanvas(d,customs,'flat',dres);
  if(plateArt instanceof Promise){pending.push(plateArt);plateArt=getProc('dial',d,undefined,'flat',dres)}
  if(dialUpload||src){
   const mat=src?new MeshStandardMaterial({map:tex(src),roughness:.5}):dialMaterial(tex(plateArt),parts.dial,Rr.dialR*PX,dspan);
   const dial=add(G.dial,'dial',faceUp(sheetUV(new CircleGeometry(Rr.dialR,180),src?CAN:dspan)),mat,{cast:false});
   dial.position.y=H.dial}
  else{const mat=dialMaterial(tex(plateArt),parts.dial,Rr.dialR*PX,dspan);
   const plateR=DL.stepped?DL.stepR/PX:Rr.dialR;
   const outline=new Shape();outline.absarc(0,0,plateR,0,Math.PI*2,false);
   for(const sd of DL.subdials){const h=new Path();h.absarc(mmX(sd.x),mmY(sd.y),sd.r/PX,0,Math.PI*2,true);outline.holes.push(h)}
   if(DL.win)outline.holes.push(roundRectPath(new Path(),mmX(DL.win.x),mmY(DL.win.y),DL.win.w/PX,DL.win.h/PX,DL.win.rad/PX));
   const plate=add(G.dial,'dial',faceUp(sheetUV(new ShapeGeometry(outline,48),dspan)),mat,{cast:false});
   plate.position.y=Hc;
   /* the wall of any recess is the plate's own metal, seen in its own shade */
   const wallMat=()=>new MeshPhysicalMaterial({color:new Color(shade(parts.dial.color||'#16324f',.35)),roughness:.6});
   if(DL.stepped){
    const ring=add(G.dial,'chapterRing',faceUp(sheetUV(new RingGeometry(plateR,Rr.dialR,180,1),dspan)),mat,{cast:false});
    ring.position.y=H.dial;
    /* the step faces the centre: top to bottom, so the lathe's normals point in */
    add(G.dial,'chapterStep',lathe([new Vector2(plateR,H.dial),new Vector2(plateR,Hc)],180),wallMat(),{cast:false})}
   /* registers: a floor below the plate with snailed grooves, and a wall down to it */
   for(const sd of DL.subdials){const x=mmX(sd.x),y=mmY(sd.y),rs=sd.r/PX;
    const floor=new CircleGeometry(rs,96);floor.translate(x,y,0);sheetUV(floor,dspan);
    /* uv1 runs 0..1 across the register itself, for its concentric grooves */
    {const p=floor.attributes.position,u1=new Float32Array(p.count*2);
     for(let i=0;i<p.count;i++){u1[i*2]=.5+(p.getX(i)-x)/(2*rs);u1[i*2+1]=.5+(p.getY(i)-y)/(2*rs)}
     floor.setAttribute('uv1',new Float32BufferAttribute(u1,2))}
    /* grooves about a quarter of a millimetre apart, however big the register */
    const fm=dialMaterial(mat.map,parts.dial);fm.normalMap=snailNormalMap(Math.max(8,Math.round(rs/.25)));fm.normalMap.channel=1;fm.normalScale=new Vector2(.55,.55);
    const f=add(G.dial,'register:'+sd.key,faceUp(floor),fm,{cast:false});f.position.y=Hc-SUBDIAL_DEPTH_MM;
    const wall=lathe([new Vector2(rs,Hc),new Vector2(rs,Hc-SUBDIAL_DEPTH_MM)],96);wall.translate(x,0,-y);
    add(G.dial,'registerWall:'+sd.key,wall,wallMat(),{cast:false})}
   /* date: a polished frame lining the aperture, and the wheel turning below */
   if(DL.win){const w=DL.win,wx=mmX(w.x),wy=mmY(w.y),ww=w.w/PX,wh=w.h/PX,wr=w.rad/PX,b=w.frame/PX;
    const wheelY=Hc-DATE_WHEEL_DROP_MM;
    const frameShape=roundRectPath(new Shape(),wx,wy,ww+2*b,wh+2*b,wr+b);
    frameShape.holes.push(roundRectPath(new Path(),wx,wy,ww,wh,wr));
    const top=Hc+.1,depth=top-wheelY-.05;
    const fg=new ExtrudeGeometry(frameShape,{depth:Math.max(.05,depth-.06),bevelEnabled:true,bevelThickness:.03,bevelSize:.03,bevelOffset:-.03,bevelSegments:2,curveSegments:6});
    faceUp(fg);
    const fr=add(G.dial,'dateFrame',fg,metalMaterial(parts.hands.metal,'polished'),{cast:false});fr.position.y=wheelY+.05;
    const cr=Math.hypot(w.x-C,w.y-C),span=Math.hypot(w.w,w.h)/2+w.frame*3;
    const wres=artRes(cr+span);
    const wheel=add(G.dial,'dateWheel',faceUp(sheetUV(new RingGeometry(Math.max(0,cr-span)/PX,(cr+span)/PX,160,1),wres.box[2])),
     paintedMaterial(tex(getProc('dial',d,'dateWheel','flat',wres)),{roughness:.5}),{cast:false});
    wheel.position.y=wheelY;wheel.userData.spin='dateWheel'}}}
 /* chronograph registers: running seconds at 3, 12-hour at 6, 30-minute at 9 */
 if(parts.dial.variant==='chrono'&&!dialUpload){const hp=parts.hands;
  /* on the registers the layout placed, sized in mm (geometry.js DIAL_MM) */
  for(const{key,x:px,y:py,r:rs}of DL.subdials){
   const reg=new Group();reg.name='reg:'+key;
   reg.position.set((px-C)/PX,Hc-SUBDIAL_DEPTH_MM+.12,(py-C)/PX);reg.userData.spin=key;G.dial.add(reg);
   const len=rs*.72/PX,w=Math.max(.12,len*.08);
   const hand=add(reg,key+'Hand',new BoxGeometry(w,.08,len),metalMaterial(hp.metal,'polished'),{receive:false});
   hand.position.z=-len/2+len*.12;
   add(reg,key+'Hub',new CylinderGeometry(4/PX,4/PX,.14,20),metalMaterial(hp.metal,'polished'))}}

 /* ---- applied indices: ground metal on the dial, lume set into a channel ----
    Each style's form (relief.js): batons bevelled to a flat top, dots domed,
    numerals with bevelled strokes. The lume decal sits at the channel floor, so
    it shows only inside the pocket the relief cut for it. */
 const mk=parts.markers,frame=parts.hands.metal,mset=markerSetOf(d);
 if(!uploaded('markers',G.markers,H.dial+.05,mk.glow?{emissive:new Color(mk.lume),emissiveIntensity:.5}:{})){
  /* a set designed in PartStudio, ground from its own millimetre outlines */
  if(mset)addMarkerSet(mset,{group:G.markers,add,y:Hc,dialRmm:Rr.dialR,skipHour:DL.win?DL.win.skipHour:null,skipHours:DL.skipHours,glow:mk.glow,
   /* no taller than the hands passing over it allow, measured from where it stands */
   heightLimitAt:(lim=>rho=>lim(rho)+(H.dial-Hc))(appliedHeightLimitOf(d))});
  else{
  const form=INDEX_FORM[mk.variant]||INDEX_FORM.batons,lumed=form.pocket!=null;
  const lumeCv=lumed?getProc('markers',d,undefined,'lume'):null;
  const rel=fineRelief('markers',d,undefined,lumed,form);
  const printed=printedIndexInk(mk.variant,frame,parts.dial.color);
  if(rel){const m=add(G.markers,'indices',rel.geometry,printed?new MeshPhysicalMaterial({color:new Color(printed),metalness:0,roughness:.5,clearcoat:.35,clearcoatRoughness:.3})
   :metalMaterial(frame,'polished'));m.position.y=Hc;
   /* an applied index stands on the dial, so it throws a short soft shadow (contactShadow.js) */
   if(!printed){const h=form.height*.75,sd=shadowDecal(getProc('markers',d,undefined,'shape'),{heightMm:h,sheetMm:SHEET,opacity:.5}),[dx,dz]=shadowOffset(h);
    sd.position.set(dx,Hc+.008,dz);G.markers.add(sd)}}
  if(lumed){
   const lm=add(G.markers,'indicesLume',sheet(),lumeMaterial(tex(lumeCv),mk.lume,mk.glow),{cast:false,noPick:true});
   lm.position.y=Hc+form.pocket+.004}}}

 /* ---- the user's logo (logo.js): printed as a decal on the dial, or traced
    and raised in the hands' metal like an applied index ---- */
 {const ls=logoSheet(d,customs);
  if(ls instanceof Promise)pending.push(ls);
  else if(ls){const L=logoOf(d);
   if(L.style==='applied'){const rel=reliefFromSilhouette(ls,{profile:'bevel',height:.16,edge:.05,bevel:.5});
    if(rel){const m=add(G.dial,'logo',rel.geometry,metalMaterial(parts.hands.metal,'polished'));m.position.y=Hc}}
   else{const m=add(G.dial,'logo',sheet(),paintedMaterial(tex(ls),{alphaTest:.4,roughness:.45}),{cast:false,noPick:true});
    m.position.y=Hc+.006}}}

 /* ---- hands: each on its own arbor height; `hand:*` carries its transform,
    the arbor inside it turns with the clock ---- */
 const hp=parts.hands;
 {const holder=new Group();holder.name='hand:upload';G.hands.add(holder);
  if(!uploaded('hands',holder,H.dial+.7)){G.hands.remove(holder);
   const lift=HAND_LIFT_MM;
   for(const k of['hour','min','sec']){
    const hold=new Group();hold.name='hand:'+k;G.hands.add(hold);
    const arbor=new Group();arbor.name=k;arbor.position.y=H.dial+lift[k];arbor.userData.spin=k;hold.add(arbor);
    const form=handForm(hp.variant,k),lumed=form.pocket!=null;
    const lumeCv=lumed?getProc('hands',d,k,'lume'):null;
    const rel=fineRelief('hands',d,k,lumed,form);
    if(!rel)continue;
    const curve=handCurve(hp.variant,k);curveHand(rel.geometry,curve);
    const bodyMat=k==='sec'
     ?new MeshPhysicalMaterial({color:new Color(hp.secColor||'#e8482c'),roughness:.32,clearcoat:.6,clearcoatRoughness:.1})
     :metalMaterial(hp.metal,hp.finish);
    add(arbor,k+'Body',rel.geometry,bodyMat,{receive:false});
    /* its soft shadow on the dial (contactShadow.js): turning with the hand on its
       own arbor, its offset kept pointing away from the light by poseHead */
    {const h=lift[k]+form.height*.6,sArbor=new Group();sArbor.name=k+'Shadow';
     sArbor.userData={spin:k,shadowOf:h,contactShadow:true};hold.add(sArbor);
     const sd=shadowDecal(getProc('hands',d,k,'shape'),{heightMm:h,sheetMm:SHEET,opacity:k==='sec'?.52:.68});
     sd.position.y=Hc+.012;sArbor.add(sd)}
    if(lumed){
     /* the lume rides the hand's curve, so it needs a sheet with rows to bend */
     const ls=curve>0?faceUp(new PlaneGeometry(SHEET,SHEET,1,96)):sheet();
     if(curve>0)curveHand(ls,curve);
     const lm=add(arbor,k+'Lume',ls,lumeMaterial(tex(lumeCv),hp.lume,hp.glow),{cast:false,receive:false,noPick:true});
     lm.position.y=form.pocket+.004}
    if(k==='sec'){/* the pipe that holds the seconds hand, and its dark pinion */
     const cap=add(arbor,'secCap',new CylinderGeometry(13/PX,13/PX,.22,40),metalMaterial(hp.metal,'polished'));cap.position.y=form.height+.11;
     const pin=add(arbor,'secPin',new CylinderGeometry(5/PX,5/PX,.06,24),new MeshPhysicalMaterial({color:0x1c1e22,roughness:.4}),{cast:false});pin.position.y=form.height+.25}}}}

 /* ---- crystal ---- */
 if(!uploaded('crystal',G.crystal,H.top+.02,{transparent:true,opacity:parts.crystal.opacity,alphaTest:0,depthWrite:false})){
  const faces=CR.faces.filter(f=>f.some((p,i)=>i&&p.distanceTo(f[i-1])>1e-6)).map(f=>lathe(f,180));
  const cr=add(G.crystal,'crystal',mergeGeometries(faces),
   crystalMaterial(parts.crystal.finish,parts.crystal.opacity,{solid:CR.thickness}),{cast:false,receive:false});
  faces.forEach(f=>f.dispose());
  cr.renderOrder=10;
  /* the cyclops over the date: its lens looks at the date wheel below it */
  const cy=cyclopsOf(d);
  if(cy){const lens=add(G.crystal,'cyclops',cyclopsGeometry(cy),
    magnifier(crystalMaterial(parts.crystal.finish,parts.crystal.opacity,{solid:cy.height}),{depth:cy.depth,mag:cy.mag,top:cy.height,glass:CR.thickness}),{cast:false,receive:false});
   lens.position.set(cy.x,H.top,cy.z);lens.renderOrder=11}}

 /* A brushed finish streaks along the UV tangent, and the smoothed extrusions
    (lugs, crown guards) carry no UVs: with no tangent the highlight broke into
    a flat white. Give them a brushing frame instead — u along the case's 12–6
    axis, which is how a lug top is grained, tipped slightly by height so the
    lug's end faces still have a direction. */
 watch.traverse(o=>{if(!(o.isMesh&&o.material.anisotropy>0)||o.geometry.attributes.uv)return;
  const p=o.geometry.attributes.position,uv=new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++){uv[i*2]=p.getZ(i)+.08*p.getY(i);uv[i*2+1]=p.getX(i)+p.getY(i)}
  o.geometry.setAttribute('uv',new Float32BufferAttribute(uv,2))});

 /* every surface: the key light's point glint scaled to its polish (materials.js);
    exposed metal also wears (wear.js) — what sits under the crystal stays new */
 const level=arch.wear;
 /* a Milanese band is woven, not a surface to scuff: haze on it reads as stains */
 for(const p of['case','bezel','crown','strap'])G[p].traverse(o=>{if(o.isMesh&&!o.userData.noPick&&!(parts.strap.variant==='mesh'&&/^strap:(top|bottom)$/.test(o.name)))applyWear(o,level)});
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
  if(k)o.rotation.y=-layerAngle(k,clock)*Math.PI/180;
  /* a hand's shadow turns with the hand but falls away from the light: its offset
     is the world offset turned back by the hand's turn (and the layer's) */
  if(o.userData&&o.userData.shadowOf!=null&&o.children[0]){const[dx,dz]=shadowOffset(o.userData.shadowOf);
   const phi=o.rotation.y+(o.parent?o.parent.rotation.y:0),c=Math.cos(phi),s=Math.sin(phi);
   o.children[0].position.x=dx*c-dz*s;o.children[0].position.z=dx*s+dz*c}})}

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
