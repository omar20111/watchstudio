/* Ambient occlusion — the darkening where parts meet.

   Environment light reaches every surface equally, so an index sitting on the
   dial, a hand over it, a lug growing out of the case and the gaps between
   bracelet links all read as clean CG. Real crevices see less of the room.

   three's GTAO computes that from a depth/normal render, at half resolution for
   the live view. The result is multiplied onto the frame the renderer already
   drew, rather than moving the whole render into a post-processing chain:
   tone mapping, antialiasing and the transparent background stay exactly as
   they were, and the only cost is the AO passes themselves.

   GTAO renders its own depth/normal buffer by drawing every mesh with a plain
   material, so a few things are hidden from that one render: the crystal (a
   glass shell over the whole dial would hide everything beneath it), the lume
   and upload sheets (a flat plane with painted alpha would read as a solid
   66 mm square) and the invisible ground that only catches shadows. */
import {ShaderMaterial,CustomBlending,DstColorFactor,ZeroFactor,OneFactor,AddEquation} from 'three';
import {GTAOPass} from 'three/examples/jsm/postprocessing/GTAOPass.js';
import {FullScreenQuad} from 'three/examples/jsm/postprocessing/Pass.js';

/* in scene units: millimetres */
export const AO_SETTINGS={radius:1.6,distanceExponent:2,thickness:1.5,scale:1,samples:16,intensity:.72};

const hiddenFromAO=o=>{if(!o.isMesh)return false;
 if(o.userData.noAO)return true;
 const m=o.material;return !!(m&&(m.transmission>0||m.isShadowMaterial))};

export function createAO(renderer,scene,camera){
 const pass=new GTAOPass(scene,camera,64,64);
 pass.output=GTAOPass.OUTPUT.Off;                /* compute only; we composite */
 pass.updateGtaoMaterial(AO_SETTINGS);
 pass.updatePdMaterial({lumaPhi:10,depthPhi:2,normalPhi:3,radius:5,rings:2,samples:16});

 /* Multiply the denoised AO onto whatever is in the framebuffer, keeping alpha.
    The AO buffer is not antialiased, so at a silhouette the frame's edge pixel
    can sample the unoccluded side and trace a bright hairline around every hand
    and numeral. A small tent blur turns that hard step into the soft falloff a
    contact shadow has anyway. */
 const mul=new ShaderMaterial({
  uniforms:{tAO:{value:pass.pdRenderTarget.texture},intensity:{value:AO_SETTINGS.intensity},texel:{value:[1,1]}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'uniform sampler2D tAO;uniform float intensity;uniform vec2 texel;varying vec2 vUv;'+
   'float s(vec2 o){return texture2D(tAO,vUv+o*texel*1.5).r;}'+
   'void main(){float a=s(vec2(0.))*4.+(s(vec2(1.,0.))+s(vec2(-1.,0.))+s(vec2(0.,1.))+s(vec2(0.,-1.)))*2.'+
   '+s(vec2(1.,1.))+s(vec2(-1.,1.))+s(vec2(1.,-1.))+s(vec2(-1.,-1.));'+
   'gl_FragColor=vec4(vec3(mix(1.,clamp(a/16.,0.,1.),intensity)),1.);}',
  depthTest:false,depthWrite:false,transparent:true,
  blending:CustomBlending,blendEquation:AddEquation,blendSrc:DstColorFactor,blendDst:ZeroFactor,
  blendEquationAlpha:AddEquation,blendSrcAlpha:ZeroFactor,blendDstAlpha:OneFactor});
 const quad=new FullScreenQuad(mul);
 let sw=0,sh=0;
 const hidden=[];

 return{
  settings:AO_SETTINGS,
  /* after renderer.render(scene, cam) has drawn the frame into the canvas:
     `w`,`h` are drawing-buffer pixels, `scale` the AO resolution */
  apply(cam,w,h,scale=1){
   const tw=Math.max(1,Math.round(w*scale)),th=Math.max(1,Math.round(h*scale));
   if(tw!==sw||th!==sh){pass.setSize(tw,th);sw=tw;sh=th;mul.uniforms.texel.value=[1/tw,1/th]}
   if(pass.camera!==cam){pass.camera=cam;
    const persp=cam.isPerspectiveCamera?1:0;
    if(pass.gtaoMaterial.defines.PERSPECTIVE_CAMERA!==persp){pass.gtaoMaterial.defines.PERSPECTIVE_CAMERA=persp;pass.gtaoMaterial.needsUpdate=true}}
   scene.traverse(o=>{if(o.visible&&hiddenFromAO(o)){o.visible=false;hidden.push(o)}});
   try{pass.render(renderer,null,null)}
   finally{for(const o of hidden)o.visible=true;hidden.length=0}
   const target=renderer.getRenderTarget(),auto=renderer.autoClear;
   renderer.setRenderTarget(null);renderer.autoClear=false;
   quad.render(renderer);
   renderer.autoClear=auto;renderer.setRenderTarget(target&&null)},
  dispose(){pass.dispose();mul.dispose();quad.dispose()}}}
