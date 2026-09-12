/* A rendered view of the watch: renderer, studio, key light, cameras.

   Cameras
     front          orthographic, top-down, on the 1200 px sheet — the editing
                    view; 1 mm maps to exactly the pixels the 2D stage used, so
                    selection guides and part offsets line up with it
     three-quarter  perspective, orbitable
     side / back    orthographic elevations from 3 o'clock and from below
     profile        side above back, as one layout for the stage

   The watch is rebuilt only when its headKey changes; part transforms, the
   bezel angle and the clock are applied to the built watch every frame. */
import {WebGLRenderer,Scene,OrthographicCamera,PerspectiveCamera,DirectionalLight,Mesh,PlaneGeometry,
        ShadowMaterial,NeutralToneMapping,SRGBColorSpace,VSMShadowMap,Vector3,Vector2,Raycaster,Spherical} from 'three';
import {CAN,PX} from '../constants.js';
import {LIGHT} from '../render/material.js';
import {lugToLugOf,geoOf} from '../geometry.js';
import {headHeights,strapPath} from './lathe.js';
import {paintBackground} from '../../export/background.js';
import {sceneClock} from '../time.js';
import {buildHead,poseHead,applyPose,disposeHead,headKey,pickPart3D} from './watch.js';
import {studioEnvironment} from './studio.js';
import {webglState,markWebglFailed} from './support.js';

export const SHEET=CAN/PX;
export const CAMERAS=['front','three-quarter','profile'];

/* The profile layout: side elevation above the caseback, each at its own scale.
   Pure, so the stage can draw dimension callouts on exactly what is rendered.
   In the side view screen-right is 12 o'clock (-z); up is +y. */
export function profileLayout(w,h,d){
 const H=headHeights(d),gy=strapPath(d).groundY,rCase=geoOf(d).R/PX,l2l=lugToLugOf(d);
 const sideH=Math.round(h*.6),backH=h-sideH;
 const side={x:0,y:0,w,h:sideH,ppm:Math.min(w*.62/l2l,sideH*.78/(H.top-gy+4)),midY:(H.top+gy)/2,top:H.top,l2l};
 side.toScreen=(z,y)=>[side.w/2-z*side.ppm,side.h/2-(y-side.midY)*side.ppm];
 const back={x:0,y:sideH,w,h:backH,ppm:backH*.74/(rCase*2)};
 return{side,back}}

export function createView(canvas,{preserveDrawingBuffer=false}={}){
 const renderer=new WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer});
 renderer.setClearColor(0x000000,0);
 renderer.outputColorSpace=SRGBColorSpace;
 renderer.toneMapping=NeutralToneMapping;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=VSMShadowMap;

 const scene=new Scene();
 const env=studioEnvironment(renderer);scene.environment=env.texture;

 /* the key light sits on the 2D rig's bearing (LIGHT.key, canvas radians) so
    shadows fall the way every existing drawing already assumes */
 const key=new DirectionalLight(0xffffff,1.5);
 key.position.set(Math.cos(LIGHT.key)*55,85,Math.sin(LIGHT.key)*55);
 key.castShadow=true;key.shadow.mapSize.set(2048,2048);
 Object.assign(key.shadow.camera,{left:-55,right:55,top:55,bottom:-55,near:1,far:300});
 key.shadow.radius=5;key.shadow.blurSamples=16;key.shadow.bias=-.0004;
 scene.add(key,key.target);

 /* catches the watch's shadow on the table without drawing a table */
 const ground=new Mesh(new PlaneGeometry(260,260),new ShadowMaterial({opacity:.32}));
 ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);

 const front=new OrthographicCamera(-1,1,1,-1,.1,2000);
 front.position.set(0,600,0);front.up.set(0,0,-1);front.lookAt(0,0,0);
 const tq=new PerspectiveCamera(19,1,1,4000);
 const side=new OrthographicCamera(-1,1,1,-1,.1,2000);
 const back=new OrthographicCamera(-1,1,1,-1,.1,2000);back.up.set(0,0,-1);
 const target=new Vector3();
 /* three-quarter direction survives edits: only 'fit' puts it back */
 const orbit=new Spherical(1,(90-36)*Math.PI/180,28*Math.PI/180);

 let watch=null,built='',camera='front',w=1,h=1,pxPerMm=null,zoom=1,lastD=null,lastCustoms=null;
 let onDirty=null;

 const ortho=(cam,vw,vh,ppm,cx=0,cy=0)=>{const hw=vw/2/ppm,hh=vh/2/ppm;
  Object.assign(cam,{left:cx-hw,right:cx+hw,top:cy+hh,bottom:cy-hh});cam.updateProjectionMatrix()};

 const layout=()=>lastD&&profileLayout(w,h,lastD);

 const aim=()=>{if(!watch)return;const a=w/h;
  const ppm=pxPerMm||Math.min(w,h)/SHEET*zoom;
  ortho(front,w,h,ppm);
  tq.aspect=a;tq.updateProjectionMatrix();
  orbit.radius=(SHEET*.58)/Math.tan(tq.fov*Math.PI/360)/Math.min(1,a)/zoom;
  tq.position.setFromSpherical(orbit).add(target);tq.lookAt(target);
  const H=watch.userData.heights;
  side.position.set(600,0,0);side.up.set(0,1,0);side.lookAt(0,0,0);
  back.position.set(0,-600,0);back.lookAt(0,0,0);
  if(camera==='side')ortho(side,w,h,Math.min(w*.8/lugToLugOf(lastD),h*.7/(H.top-watch.userData.groundY+4)),0,(H.top+watch.userData.groundY)/2);
  if(camera==='back')ortho(back,w,h,Math.min(w,h)*.8/(watch.userData.radii.rCase*2));
  const L=camera==='profile'&&layout();
  if(L){ortho(side,L.side.w,L.side.h,L.side.ppm,0,L.side.midY);ortho(back,L.back.w,L.back.h,L.back.ppm)}};

 const cam=()=>camera==='three-quarter'?tq:camera==='side'?side:camera==='back'?back:front;

 const view={
  renderer,scene,
  camera:cam,target:()=>target,orbit,
  get watch(){return watch},
  /* set once: called when an upload finishes loading and the watch needs a rebuild */
  onDirty(fn){onDirty=fn},
  setDesign(d,customs={}){lastD=d;lastCustoms=customs;
   const k=headKey(d,customs);
   if(k!==built){built=k;
    if(watch){scene.remove(watch);disposeHead(watch)}
    watch=buildHead(d,customs,{aniso:renderer.capabilities.getMaxAnisotropy()});scene.add(watch);
    /* the watch rests on its strap, so the table is wherever the strap lands */
    ground.position.y=watch.userData.groundY-.02;
    target.set(0,watch.userData.heights.dial,0);aim();
    if(watch.userData.pending)watch.userData.pending.then(()=>{built='';if(onDirty)onDirty()})}
   applyPose(watch,d);ground.visible=d.shadow!==false;
   return watch.userData.pending},
  /* would setDesign rebuild? (lets a caller throttle rebuilds but not poses) */
  stale(d,customs={}){return headKey(d,customs)!==built},
  pose(d){if(watch){applyPose(watch,d);ground.visible=d.shadow!==false}},
  setCamera(c){if(c===camera)return;camera=c;aim()},
  /* front: an explicit px-per-mm keeps the stage's overlay aligned; zoom scales
     the other cameras */
  setFrame({pxPerMm:p=null,zoom:z=1}={}){pxPerMm=p;zoom=z||1;aim()},
  fit(){orbit.set(1,(90-36)*Math.PI/180,28*Math.PI/180);aim()},
  /* the orbit controls moved the three-quarter camera: remember where */
  syncOrbit(){orbit.setFromVector3(tq.position.clone().sub(target))},
  resize(width,height,dpr=1){w=Math.max(1,Math.round(width));h=Math.max(1,Math.round(height));
   renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);aim()},
  layout,
  render(clock){if(!watch)return;if(clock)poseHead(watch,clock);
   if(camera!=='profile'){renderer.setScissorTest(false);renderer.setViewport(0,0,w,h);renderer.render(scene,cam());return}
   const L=layout();renderer.setScissorTest(true);
   for(const[c,r]of[[side,L.side],[back,L.back]]){
    /* WebGL viewports count from the bottom */
    renderer.setViewport(r.x,h-r.y-r.h,r.w,r.h);renderer.setScissor(r.x,h-r.y-r.h,r.w,r.h);renderer.render(scene,c)}
   renderer.setScissorTest(false)},
  /* the design part under a canvas-relative point (px), or null */
  pick(x,y,sel){if(!watch||camera==='profile')return null;
   const rc=new Raycaster();rc.setFromCamera(new Vector2(x/w*2-1,-(y/h*2-1)),cam());
   return pickPart3D(watch,rc,sel)},
  /* render one frame to `size` px square in tiles no larger than the GPU allows,
     handing each tile to `put(sourceCanvas,x,y)` */
  renderTiled(clock,size,put){
   const gl=renderer.getContext();
   const max=Math.min(4096,gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),renderer.capabilities.maxTextureSize);
   const c=cam();w=h=size;aim();poseHead(watch,clock);
   for(let ty=0;ty<size;ty+=max)for(let tx=0;tx<size;tx+=max){
    const tw=Math.min(max,size-tx),th=Math.min(max,size-ty);
    renderer.setPixelRatio(1);renderer.setSize(tw,th,false);
    c.setViewOffset(size,size,tx,ty,tw,th);renderer.render(scene,c);put(renderer.domElement,tx,ty)}
   c.clearViewOffset()},
  dispose(){if(watch)disposeHead(watch);env.dispose();renderer.dispose();watch=null}};
 return view}

/* ---------------------------------------------------------------- stills */

/* One offscreen view shared by the design sheet and every export, so a page of
   drawings costs one WebGL context rather than one per picture. */
let still=null;
function stillView(){if(still)return still;
 if(!webglState().ok)throw new Error('3D rendering needs WebGL, which this browser is not providing');
 const c=document.createElement('canvas');
 try{still=createView(c,{preserveDrawingBuffer:true})}
 catch(e){markWebglFailed('failed',e);throw e}
 /* a lost context cannot draw again: forget this view so the next still builds
    a fresh one (its GPU resources went with the context, so nothing to dispose) */
 c.addEventListener('webglcontextlost',()=>{still=null},{once:true});
 return still}

async function ready(v,d,customs){let p=v.setDesign(d,customs);
 /* uploads load asynchronously; wait, then rebuild with them in place */
 for(let i=0;p&&i<3;i++){await p;p=v.setDesign(d,customs)}}

/* A transparent still of the design. `camera` is front, three-quarter, side or
   back; front stills use the sheet scale so SVG dimension lines drawn at
   1 mm = size/SHEET px still land on the features. */
export async function renderStill(d,customs,{w=CAN,h=w,camera='front',clock}={}){
 const v=stillView();await ready(v,d,customs);
 v.setCamera(camera);v.resize(w,h,1);v.setFrame({pxPerMm:camera==='front'?Math.min(w,h)/SHEET:null,zoom:1});
 if(camera==='three-quarter')v.fit();
 v.render(clock||sceneClock(d,Date.now()));
 const out=document.createElement('canvas');out.width=w;out.height=h;out.getContext('2d').drawImage(v.renderer.domElement,0,0);
 return out}

/* A frame of a design composed over its scene background, as a PNG Blob, at any
   size: large exports are rendered in GPU-sized tiles. */
export async function sceneBlob3D(d,customs,{size=CAN,camera='front',clock,background=true}={}){
 const v=stillView();await ready(v,d,customs);
 const out=document.createElement('canvas');out.width=out.height=size;
 const ctx=out.getContext('2d');
 if(background){ctx.save();ctx.scale(size/CAN,size/CAN);await paintBackground(ctx,d);ctx.restore()}
 v.setCamera(camera==='profile'?'front':camera);v.setFrame({pxPerMm:camera==='three-quarter'?null:size/SHEET,zoom:1});
 if(camera==='three-quarter')v.fit();
 v.renderTiled(clock||sceneClock(d,Date.now()),size,(src,x,y)=>ctx.drawImage(src,x,y));
 return new Promise(r=>out.toBlob(r,'image/png'))}
