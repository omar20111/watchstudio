/* PBR materials from the METALS table.

   METALS already carries the numbers a physically based material needs: `base`
   is the reflectance colour, `rough` the microfacet roughness, `refl` how
   strongly the studio shows in it, and `kind` whether it is a conductor. The
   2D engine had to fake what those mean with gradient contrast; here roughness
   genuinely widens and softens the highlight instead of only greying it. */
import {MeshPhysicalMaterial,MeshStandardMaterial,Color,DoubleSide} from 'three';
import {METALS} from '../constants.js';

/* how each finish moves the metal's own roughness */
const FINISH_ROUGH={polished:r=>Math.max(.05,r*.55),none:r=>Math.max(.05,r*.55),brushed:r=>Math.max(.26,r*1.6),matte:r=>Math.max(.5,r*2.2)};

export function metalMaterial(metalId,finish='polished',o={}){
 const m=METALS[metalId]||METALS.steel;
 const f=o.forceFinish||finish;
 const rough=(FINISH_ROUGH[f]||FINISH_ROUGH.polished)(m.rough??.15);
 const mat=new MeshPhysicalMaterial({color:new Color(m.base),roughness:rough,envMapIntensity:m.refl??1});
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

/* Sapphire. Transmission refracts whatever is rendered beneath it — dial, hands,
   rehaut — through the real surface, which is the depth cue no 2D layer can give. */
export function crystalMaterial(finish='polished',gloss=.65,crystalMm=1.6){
 /* bare sapphire reflects ~7.7% head-on (ior 1.77), which is exactly why real
    crystals are AR coated; the coating takes it to ~1%, leaving the Fresnel
    rise at the rim as the visible glass */
 const k=.22*(AR[finish]??.75)*(.4+gloss);
 /* `thickness` drives a screen-space refraction offset. The lathe is a single
    shell, so the full crystal height over-shifts at the grazing rim and draws
    ghost copies of the indices; a fraction of it keeps the visible bend without
    the doubling. */
 return new MeshPhysicalMaterial({color:0xffffff,metalness:0,roughness:.02,
  transmission:1,ior:1.77,thickness:Math.min(.35,crystalMm*.2),specularIntensity:Math.min(1,k),
  specularColor:new Color((AR[finish]??.75)<.5?'#b9c2ff':'#dfe6ff'),envMapIntensity:1,side:DoubleSide})}

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
 mat.onBeforeCompile=sh=>{sh.uniforms.uKeySpecular={value:scale};
  sh.fragmentShader='uniform float uKeySpecular;\n'+sh.fragmentShader.replace('#include <lights_fragment_end>',
   '#include <lights_fragment_end>\n\treflectedLight.directSpecular *= uKeySpecular;\n'+
   '#ifdef USE_CLEARCOAT\n\tclearcoatSpecularDirect *= uKeySpecular;\n#endif')};
 mat.customProgramCacheKey=()=>'ws-soft-key-glint';
 return mat}

/* printed or painted surfaces carrying a baked 2D canvas */
export function paintedMaterial(map,o={}){
 return new MeshStandardMaterial({map,roughness:o.roughness??.55,metalness:0,
  transparent:!!o.transparent,alphaTest:o.alphaTest??0,depthWrite:o.depthWrite??true})}
