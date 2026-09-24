/* Photo: the product view path traced.

   The live views rasterise: reflections come from a prefiltered environment,
   shadows from a shadow map, occlusion from a screen-space pass. A photo follows
   light instead (three-gpu-pathtracer): the case reflects the strap and the
   strap the case, the crystal catches the room, shadows soften the way a real
   softbox makes them, and a lens puts the far strap out of focus. It converges
   over a few hundred samples — seconds on a desktop GPU — so it is a still, made
   on request from the product view's camera.

   The scene is the same watch (exportWatch), the same room (studioEquirect) and
   the key light as a real area light where the live view uses a point. */
import {WebGLRenderer,Scene,RectAreaLight,NeutralToneMapping,SRGBColorSpace,NoBlending} from 'three';
import {WebGLPathTracer,PhysicalCamera,GradientEquirectTexture,DenoiseMaterial} from 'three-gpu-pathtracer';
import {FullScreenQuad} from 'three/examples/jsm/postprocessing/Pass.js';
import {LIGHT} from '../render/material.js';
import {studioEquirect} from './studio.js';
import {disposeHead,poseHead} from './watch.js';
import {surfaceMesh} from './surfaces.js';
import {wristMesh} from './wrist.js';
import {wearRoughness} from './wear.js';
import {solidGlass} from './materials.js';
import {sceneClock} from '../time.js';
import {exportWatch} from '../../export/glb.js';

/* how far a photo's lens is opened for each blur setting (null: a pinhole) */
export const BLUR_FSTOP={off:null,soft:5.6,strong:2.2};
/* samples a photo converges to; it can be saved before then */
export const PHOTO_SAMPLES=320;

/* the parts a path tracer reads differently from a rasteriser */
function forPathTracing(watch){
 watch.traverse(o=>{if(!o.isMesh)return;const m=o.material;
  /* the crystal and the cyclops are closed solids, traced as real volumes of
     sapphire that bend light; a single-sided pane (the caseback window) is thin glass */
  if(m.transmission>0)m.thickness=solidGlass.get(m)||0;
  /* the wear shader does not run here: carry its average (wear.js) */
  m.roughness=Math.min(1,m.roughness+wearRoughness(m))});
 return watch}

let env=null;
export function createPhoto(canvas,{textureSize=2048}={}){
 const renderer=new WebGLRenderer({canvas,antialias:false,preserveDrawingBuffer:true});
 renderer.toneMapping=NeutralToneMapping;renderer.outputColorSpace=SRGBColorSpace;
 const pt=new WebGLPathTracer(renderer);
 Object.assign(pt,{renderDelay:0,fadeDuration:0,minSamples:1,dynamicLowRes:false,rasterizeScene:true});
 pt.tiles.set(2,2);pt.bounces=6;pt.transmissiveBounces=6;pt.filterGlossyFactor=.5;
 /* every texture in the scene is resampled to one size in a texture array */
 pt.textureSize.set(textureSize,textureSize);
 /* Denoised as it converges. A few dozen samples in, a path traced frame is
    speckled; an edge-preserving blur (Morrone's smart denoise) smooths the
    speckle where neighbours agree and leaves edges and printing alone. Its
    reach falls with the noise, as 1/sqrt(samples), to almost nothing by the time
    the photo is done, so a finished photo keeps its own fine detail. The
    accumulated samples are untouched: only what is shown and saved is filtered. */
 const denoise=new DenoiseMaterial({blending:NoBlending,premultipliedAlpha:renderer.getContextAttributes().premultipliedAlpha});
 const dq=new FullScreenQuad(denoise);let denoiseOn=true;
 pt.renderToCanvasCallback=(target,r,quad)=>{const auto=r.autoClear;r.autoClear=false;
  const n=Math.max(1,pt.samples),sigma=denoiseOn?4.5*Math.sqrt(6/n):0;
  if(sigma<.6)quad.render(r);
  else{denoise.map=target.texture;denoise.sigma=sigma;denoise.kSigma=1.5;denoise.threshold=.06+.14*Math.min(1,sigma/4.5);denoise.opacity=1;dq.render(r)}
  r.autoClear=auto};

 const scene=new Scene();env=env||studioEquirect();
 /* the room fills the shadows; the softbox makes them. The set (studio.js) is a
    dark room with a few bright lights, so it keeps the shadow at full strength */
 scene.environment=env;scene.environmentIntensity=1;
 /* the product view's backdrop, lighter above: behind the surface's faded rim */
 const backdrop=new GradientEquirectTexture(64);backdrop.topColor.set(0x3a3d44);backdrop.bottomColor.set(0x131418);backdrop.update();
 scene.background=backdrop;
 const camera=new PhysicalCamera(19,1,1,4000);
 /* the key as a softbox on the rig's bearing, facing the watch */
 const key=new RectAreaLight(0xffffff,5,90,90);
 key.position.set(Math.cos(LIGHT.key)*70,110,Math.sin(LIGHT.key)*70);key.lookAt(0,0,0);scene.add(key);
 let watch=null,surface=null;

 return{renderer,pathTracer:pt,scene,camera,
  get samples(){return pt.samples},
  get watch(){return watch},
  /* build the scene for a design, posed at `clock`, on a surface — or worn on a
     wrist of `wrist` cm (wrist.js), which the strap then wraps */
  async setDesign(d,customs={},{surface:surfaceId='none',clock=null,wrist=0,tone='medium',side='left'}={}){
   if(watch){scene.remove(watch);disposeHead(watch)}
   if(surface){scene.remove(surface);surface.geometry.dispose();surface.material.dispose();surface=null}
   const D=wrist?{...d,onWrist:wrist}:d;
   watch=forPathTracing(await exportWatch(D,customs));
   poseHead(watch,clock||sceneClock(d,Date.now()));scene.add(watch);
   surface=wrist?wristMesh(wrist,tone,side):surfaceMesh(surfaceId,watch.userData.groundY-.03);if(surface)scene.add(surface);
   /* the BVH is built on this thread: a worker would not survive the single-file
      build, and a watch is small enough to build in a moment */
   pt.setScene(scene,camera)},
  /* frame from a live camera: position, target and field of view */
  setView({position,target,fov=19,aspect,fStop=null}){
   camera.position.copy(position);camera.fov=fov;camera.aspect=aspect;camera.lookAt(target);
   camera.focusDistance=position.distanceTo(target);
   /* fStop null: a pinhole, everything sharp */
   camera.fStop=fStop||1e4;camera.apertureBlades=fStop?6:0;
   camera.updateProjectionMatrix();pt.setCamera(camera)},
  resize(w,h,dpr=1){renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);
   camera.aspect=w/h;camera.updateProjectionMatrix();pt.updateCamera()},
  renderSample(){pt.renderSample()},
  /* for comparing: show the frame with or without denoising */
  set denoise(on){denoiseOn=!!on},
  reset(){pt.reset()},
  dispose(){if(watch)disposeHead(watch);if(surface){surface.geometry.dispose();surface.material.dispose()}
   denoise.dispose();dq.dispose();
   backdrop.dispose();pt.dispose();renderer.dispose();renderer.forceContextLoss()}}}
