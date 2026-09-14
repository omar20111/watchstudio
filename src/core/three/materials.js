/* PBR materials from the METALS table.

   METALS already carries the numbers a physically based material needs: `base`
   is the reflectance colour, `rough` the microfacet roughness, `refl` how
   strongly the studio shows in it, and `kind` whether it is a conductor. The
   2D engine had to fake what those mean with gradient contrast; here roughness
   genuinely widens and softens the highlight instead of only greying it. */
import {MeshPhysicalMaterial,MeshStandardMaterial,Color,DoubleSide,FrontSide,ShaderChunk} from 'three';
import {SAPPHIRE_IOR} from '../geometry.js';
import {METALS} from '../constants.js';

/* how each finish moves the metal's own roughness */
const FINISH_ROUGH={polished:r=>Math.max(.05,r*.55),none:r=>Math.max(.05,r*.55),brushed:r=>Math.max(.26,r*1.6),matte:r=>Math.max(.5,r*2.2)};

/* the finish a metal material was made with, for wear.js (kept off userData,
   which a GLB export would write into the file) */
export const finishOf=new WeakMap();

/* Several edits to one material's shaders (the soft key glint, wear) compose
   here: each is added once under a key, and the program cache key names them
   all so materials with different edits never share a compiled program. The
   list lives in the closure, so a cloned material keeps working. */
const hookLists=new WeakMap();
export function addShaderHook(mat,key,fn){let list=hookLists.get(mat);
 if(!list){const l=list=[];hookLists.set(mat,l);
  mat.onBeforeCompile=sh=>{for(const h of l)h.fn(sh)};
  mat.customProgramCacheKey=()=>l.map(h=>h.key).join('|')}
 const at=list.findIndex(h=>h.key===key);
 if(at>=0)list[at]={key,fn};else list.push({key,fn});
 mat.needsUpdate=true;return mat}

export function metalMaterial(metalId,finish='polished',o={}){
 const m=METALS[metalId]||METALS.steel;
 const f=o.forceFinish||finish;
 const rough=(FINISH_ROUGH[f]||FINISH_ROUGH.polished)(m.rough??.15);
 const mat=new MeshPhysicalMaterial({color:new Color(m.base),roughness:rough,envMapIntensity:m.refl??1});
 finishOf.set(mat,f);
 if(m.kind==='metal'){mat.metalness=1;
  /* circular graining: the lathe's u runs around the ring, so anisotropy along the
     tangent streaks the highlight around the bezel the way a turned finish does */
  if(f==='brushed'){mat.anisotropy=.85;mat.anisotropyRotation=0}}
 /* white ceramic: a bright diffuse body under a thin gloss. Full environment
    strength on both flattens it to paper white seen from above. */
 else if(m.kind==='ceramic'){mat.metalness=0;mat.roughness=.42;mat.clearcoat=.8;mat.clearcoatRoughness=.05;mat.envMapIntensity=.55;
  mat.color=new Color(m.base).multiplyScalar(.9)}
 else{/* forged carbon: a dark dielectric under a lacquer coat */
  mat.metalness=.15;mat.roughness=.55;mat.clearcoat=.6;mat.clearcoatRoughness=.12}
 return mat}

/* AR coating strength by finish, as in render/crystal.js */
const AR={none:1,brushed:.85,polished:.6,matte:.28};

/* the real thickness of a solid glass part, for the renderers that trace light
   through it (the path tracer, a glTF viewer); kept off userData, which a GLB
   export would write into the file */
export const solidGlass=new WeakMap();

/* Sapphire. Transmission refracts whatever is rendered beneath it — dial, hands,
   rehaut — through the real surface, which is the depth cue no 2D layer can give. */
export function crystalMaterial(finish='polished',gloss=.65,{solid=0}={}){
 /* bare sapphire reflects ~7.7% head-on (ior 1.77), which is exactly why real
    crystals are AR coated; the coating takes it to ~1%, leaving the Fresnel
    rise at the rim as the visible glass */
 const k=.22*(AR[finish]??.75)*(.4+gloss);
 /* A solid crystal (lathe.js crystalSolid) is a closed volume: its front faces
    are the glass, and `thickness` is its real thickness, which bends what is
    seen through it. The rasteriser only bends by an offset in screen space, and
    a full millimetre of it smears what lies behind edges (a date window drawn
    in steps, indices kinked), so it bends by a fraction; solidGlass keeps the
    real figure for the path tracer and the GLB. A thin pane (the caseback
    window) is a double-sided sheet with a small offset. */
 const mat=new MeshPhysicalMaterial({color:0xffffff,metalness:0,roughness:.02,
  transmission:1,ior:SAPPHIRE_IOR,thickness:solid?Math.min(.25,solid*.25):.2,specularIntensity:Math.min(1,k),
  specularColor:new Color((AR[finish]??.75)<.5?'#b9c2ff':'#dfe6ff'),envMapIntensity:1,side:solid?FrontSide:DoubleSide});
 if(solid)solidGlass.set(mat,solid);
 return mat}

/* A magnifier in the rasteriser: the transmission pass samples the frame behind
   the glass at the refracted point, so scaling those samples about the point
   the lens looks at enlarges it `mag` times. That point is where the line of
   sight through the lens's crown lands on the plane it focuses on, `depth` mm
   below its base: the ray through a lens's centre is not turned by the lens,
   only bent by Snell's law into the sapphire (the lens, `top` mm tall, and the
   crystal under it, `glass` mm) and back out across the air gap below. Straight
   below when seen from above, further along the dial as the watch tilts, as a
   real cyclops does. The path tracer needs none of this: it refracts through
   the real lens. */
export function magnifier(mat,{depth,mag,top,glass}){
 return addShaderHook(mat,'ws-magnifier',sh=>{
  Object.assign(sh.uniforms,{uLensDepth:{value:depth},uLensMag:{value:mag},uLensTop:{value:top},uLensGlass:{value:glass}});
  sh.fragmentShader=sh.fragmentShader.replace('#include <transmission_pars_fragment>',
   'uniform float uLensDepth;\nuniform float uLensMag;\nuniform float uLensTop;\nuniform float uLensGlass;\n'+
   ShaderChunk.transmission_pars_fragment.replaceAll('refractionCoords /= 2.0;',
    /* the lens's crown and the point it looks at, both on screen: what is under
       the crown shows the focus, and offsets from the crown are shrunk `mag` times */
    'refractionCoords /= 2.0;\n\t\t\t{ vec3 crown = vec3( 0.0, uLensTop, 0.0 );\n'+
    '\t\t\t  vec3 camL = ( inverse( modelMatrix ) * vec4( cameraPosition, 1.0 ) ).xyz;\n'+
    '\t\t\t  vec3 dir = normalize( crown - camL );\n'+
    '\t\t\t  float si = length( dir.xz ), sg = si / '+SAPPHIRE_IOR.toFixed(3)+';\n'+
    '\t\t\t  float ti = si / max( - dir.y, 1e-3 ), tg = sg / sqrt( max( 1.0 - sg * sg, 1e-6 ) );\n'+
    '\t\t\t  vec2 across = si > 1e-5 ? dir.xz / si : vec2( 0.0 );\n'+
    '\t\t\t  vec2 off = across * ( ( uLensTop + uLensGlass ) * tg + max( uLensDepth - uLensGlass, 0.0 ) * ti );\n'+
    '\t\t\t  vec4 fc = projMatrix * viewMatrix * ( modelMatrix * vec4( off.x, - uLensDepth, off.y, 1.0 ) );\n'+
    '\t\t\t  vec4 cc = projMatrix * viewMatrix * ( modelMatrix * vec4( crown, 1.0 ) );\n'+
    '\t\t\t  refractionCoords = ( fc.xy / fc.w * 0.5 + 0.5 ) + ( refractionCoords - ( cc.xy / cc.w * 0.5 + 0.5 ) ) / uLensMag; }'))})}

/* The key light is a point source. On a mirror polish its specular reflection
   is a tiny hot dot — a camera flash — where a studio photograph shows the
   softbox, which the environment map already reflects. The key stays for its
   shadows and its diffuse fill; only its point reflection is scaled down, fully
   on glass and more the smoother a surface is. Rougher surfaces keep it, where
   it is a broad, believable highlight. */
const ramp=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};
export function softenKeyGlint(mat){
 if(!(mat&&mat.isMeshStandardMaterial))return mat;
 const scale=mat.transmission>0?0:.2+.8*ramp(.06,.35,mat.roughness);
 return addShaderHook(mat,'ws-soft-key-glint',sh=>{sh.uniforms.uKeySpecular={value:scale};
  sh.fragmentShader='uniform float uKeySpecular;\n'+sh.fragmentShader.replace('#include <lights_fragment_end>',
   '#include <lights_fragment_end>\n\treflectedLight.directSpecular *= uKeySpecular;\n'+
   '#ifdef USE_CLEARCOAT\n\tclearcoatSpecularDirect *= uKeySpecular;\n#endif')})}

/* printed or painted surfaces carrying a baked 2D canvas */
export function paintedMaterial(map,o={}){
 return new MeshStandardMaterial({map,roughness:o.roughness??.55,metalness:0,
  transparent:!!o.transparent,alphaTest:o.alphaTest??0,depthWrite:o.depthWrite??true})}
