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
        ShadowMaterial,NeutralToneMapping,SRGBColorSpace,VSMShadowMap,Vector3,Vector2,Raycaster,Spherical,Box3} from 'three';
import {CAN,PX} from '../constants.js';
import {LIGHT} from '../render/material.js';
import {lugToLugOf,geoOf} from '../geometry.js';
import {headHeights,strapPath} from './lathe.js';
import {paintBackground} from '../../export/background.js';
import {sceneClock} from '../time.js';
import {buildHead,poseHead,applyPose,disposeHead,headKey,pickPart3D} from './watch.js';
import {studioEnvironment} from './studio.js';
import {createAO} from './ao.js';
import {webglState,markWebglFailed} from './support.js';
import {surfaceMesh} from './surfaces.js';
import {renderLines} from '../../export/lineart.js';

export const SHEET=CAN/PX;
export const CAMERAS=['front','three-quarter','back','profile'];

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

/* aoScale: occlusion resolution relative to the canvas — half for live views,
   where it is recomputed every frame the hands move; full for stills */
export function createView(canvas,{preserveDrawingBuffer=false,aoScale=.5}={}){
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
 const KEY=[Math.cos(LIGHT.key)*55,85,Math.sin(LIGHT.key)*55];
 key.position.set(...KEY);
 key.castShadow=true;key.shadow.mapSize.set(2048,2048);
 Object.assign(key.shadow.camera,{left:-55,right:55,top:55,bottom:-55,near:1,far:300});
 key.shadow.radius=5;key.shadow.blurSamples=16;key.shadow.bias=-.0004;
 scene.add(key,key.target);

 /* Seen from below, the watch is turned over under the studio rather than lit
    from behind: the key light and the environment swing round the 12-6 axis
    to the viewer's side, so the caseback and the movement behind its window
    are lit the way the front is. Only for the render that looks up. */
 const underside=on=>{key.position.set(on?-KEY[0]:KEY[0],on?-KEY[1]:KEY[1],KEY[2]);
  scene.environmentRotation.set(0,0,on?Math.PI:0)};

 /* catches the watch's shadow on the table without drawing a table */
 const ground=new Mesh(new PlaneGeometry(260,260),new ShadowMaterial({opacity:.32}));
 ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
 /* the product render's surface (surfaces.js): when there is one it takes the
    shadow, and the shadow-only ground steps aside */
 let surface=null,surfaceId='none';
 const placeSurface=()=>{if(surface){scene.remove(surface);surface.geometry.dispose();surface.material.dispose();surface=null}
  if(watch&&surfaceId!=='none'){surface=surfaceMesh(surfaceId,watch.userData.groundY-.03);if(surface)scene.add(surface)}};
 const groundOn=d=>d.shadow!==false&&!surface;

 const front=new OrthographicCamera(-1,1,1,-1,.1,2000);   /* placed by aim() */
 const tq=new PerspectiveCamera(19,1,1,4000);
 const side=new OrthographicCamera(-1,1,1,-1,.1,2000);
 const back=new OrthographicCamera(-1,1,1,-1,.1,2000);back.up.set(0,0,-1);
 const target=new Vector3();
 /* three-quarter direction survives edits: only 'fit' puts it back */
 const orbit=new Spherical(1,(90-36)*Math.PI/180,28*Math.PI/180);

 let watch=null,built='',camera='front',w=1,h=1,pxPerMm=null,zoom=1,lastD=null,lastCustoms=null;
 /* the front camera swung off vertical, radians: x turns the watch about the
    screen's vertical axis, y about its horizontal one (the stage's tilt drag) */
 let tilt=[0,0];
 const ao=createAO(renderer,scene,front);let aoOn=true;const buf=new Vector2();
 let onDirty=null;

 const ortho=(cam,vw,vh,ppm,cx=0,cy=0)=>{const hw=vw/2/ppm,hh=vh/2/ppm;
  Object.assign(cam,{left:cx-hw,right:cx+hw,top:cy+hh,bottom:cy-hh});cam.updateProjectionMatrix()};

 const layout=()=>lastD&&profileLayout(w,h,lastD);

 const aim=()=>{if(!watch)return;const a=w/h;
  const ppm=pxPerMm||Math.min(w,h)/SHEET*zoom;
  ortho(front,w,h,ppm);
  /* level, this is straight down; tilted, the camera swings round the dial's
     centre, keeping 12 o'clock toward the top of the screen. Dragging right
     turns the watch right (the camera moves toward 9 o'clock); dragging down
     tips 12 o'clock toward the viewer. */
  const[tx,ty]=tilt;
  front.position.set(-Math.sin(tx)*Math.cos(ty),Math.cos(tx)*Math.cos(ty),-Math.sin(ty)).multiplyScalar(600).add(target);
  front.up.set(0,0,-1);front.lookAt(target);
  tq.aspect=a;tq.updateProjectionMatrix();
  orbit.radius=(SHEET*.58)/Math.tan(tq.fov*Math.PI/360)/Math.min(1,a)/zoom;
  tq.position.setFromSpherical(orbit).add(target);tq.lookAt(target);
  const H=watch.userData.heights;
  side.position.set(600,0,0);side.up.set(0,1,0);side.lookAt(0,0,0);
  back.position.set(0,-600,0);back.lookAt(0,0,0);
  if(camera==='side')ortho(side,w,h,Math.min(w*.8/lugToLugOf(lastD),h*.7/(H.top-watch.userData.groundY+4)),0,(H.top+watch.userData.groundY)/2);
  if(camera==='back')ortho(back,w,h,Math.min(w,h)*.8/(watch.userData.radii.rCase*2)*zoom);
  const L=camera==='profile'&&layout();
  if(L){ortho(side,L.side.w,L.side.h,L.side.ppm,0,L.side.midY);ortho(back,L.back.w,L.back.h,L.back.ppm)}};

 const cam=()=>camera==='three-quarter'?tq:camera==='side'?side:camera==='back'?back:front;

 /* Night: the studio goes down to a faint moonlight and the lume shows what it
    is for. Every material marked as lume (userData.lume: its colour) glows in
    that colour through its own texture, far brighter than anything the dim
    light can make; the rest of the watch is only just there. Its daylight
    emissive is kept aside and given back when the lights come on. */
 let night=false;const daylight=new WeakMap();
 const applyNight=()=>{scene.environmentIntensity=night?.035:1;key.intensity=night?.09:1.5;
  if(!watch)return;
  watch.traverse(o=>{const m=o.isMesh&&o.material;if(!m||!m.userData||!m.userData.lume||!m.emissive)return;
   if(!daylight.has(m))daylight.set(m,{emissive:m.emissive.getHex(),map:m.emissiveMap,i:m.emissiveIntensity});
   const day=daylight.get(m),hadMap=!!m.emissiveMap;
   if(night){m.emissive.set(m.userData.lume);m.emissiveMap=m.map||null;m.emissiveIntensity=2.6}
   else{m.emissive.setHex(day.emissive);m.emissiveMap=day.map;m.emissiveIntensity=day.i}
   if(hadMap!==!!m.emissiveMap)m.needsUpdate=true})};

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
    ground.position.y=watch.userData.groundY-.02;placeSurface();
    target.set(0,watch.userData.heights.dial,0);aim();
    if(watch.userData.pending)watch.userData.pending.then(()=>{built='';if(onDirty)onDirty()});
    /* a new watch's lume starts in daylight: light it again if it is night */
    if(night)applyNight()}
   if(!!d.night!==night){night=!!d.night;applyNight()}
   applyPose(watch,d);ground.visible=groundOn(d);
   return watch.userData.pending},
  /* would setDesign rebuild? (lets a caller throttle rebuilds but not poses) */
  stale(d,customs={}){return headKey(d,customs)!==built},
  pose(d){if(watch){applyPose(watch,d);ground.visible=groundOn(d)}},
  /* 'none' or a surface id; only the product render sets one */
  setSurface(id='none'){if(id===surfaceId)return;surfaceId=id;placeSurface();if(lastD)ground.visible=groundOn(lastD)},
  get surface(){return surface},
  setCamera(c){if(c===camera)return;camera=c;aim()},
  /* front: an explicit px-per-mm keeps the stage's overlay aligned; zoom scales
     the other cameras */
  setFrame({pxPerMm:p=null,zoom:z=1}={}){pxPerMm=p;zoom=z||1;aim()},
  fit(){orbit.set(1,(90-36)*Math.PI/180,28*Math.PI/180);aim()},
  setTilt(x=0,y=0){tilt=[x,y];aim()},
  get tilt(){return[...tilt]},
  /* the orbit controls moved the three-quarter camera: remember where */
  syncOrbit(){orbit.setFromVector3(tq.position.clone().sub(target))},
  resize(width,height,dpr=1){w=Math.max(1,Math.round(width));h=Math.max(1,Math.round(height));
   renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);
   /* What is seen through the crystal is a second render of everything opaque,
      sampled with a smoothing filter — so the dial reads softer than it is
      unless that render carries more pixels than the screen. Keeping it at about
      twice the CSS resolution sharpens an ordinary screen and asks nothing extra
      of a 2x one, which is already there. */
   renderer.transmissionResolutionScale=Math.min(2,Math.max(1,2/dpr));
   aim()},
  layout,
  /* ambient occlusion on or off, e.g. when a slow GPU cannot afford it live */
  setAO(on){aoOn=!!on},
  get aoOn(){return aoOn},
  render(clock){if(!watch)return;if(clock)poseHead(watch,clock);
   if(camera!=='profile'){renderer.setScissorTest(false);renderer.setViewport(0,0,w,h);
    underside(camera==='back');renderer.render(scene,cam());
    if(aoOn){renderer.getDrawingBufferSize(buf);ao.apply(cam(),buf.x,buf.y,aoScale)}
    underside(false);return}
   /* the profile is a measured technical drawing: no occlusion shading */
   const L=layout();renderer.setScissorTest(true);
   for(const[c,r]of[[side,L.side],[back,L.back]]){
    /* WebGL viewports count from the bottom */
    renderer.setViewport(r.x,h-r.y-r.h,r.w,r.h);renderer.setScissor(r.x,h-r.y-r.h,r.w,r.h);
    underside(c===back);renderer.render(scene,c);underside(false)}
   renderer.setScissorTest(false)},
  /* is something moving in view that the clock does not tick once a second — the
     balance behind an exhibition caseback, seen from below */
  /* night mode on (lume lit, studio dimmed), for the stage and for tests */
  get night(){return night},
  get moving(){if(!watch||camera!=='back')return false;let m=false;
   watch.traverse(o=>{const k=o.userData&&o.userData.spin;if(k==='balance'||k==='glide')m=true});return m},
  /* the design part under a canvas-relative point (px), or null */
  pick(x,y,sel){if(!watch||camera==='profile')return null;
   const rc=new Raycaster();rc.setFromCamera(new Vector2(x/w*2-1,-(y/h*2-1)),cam());
   return pickPart3D(watch,rc,sel)},
  /* Render one frame to `size` px square in tiles no larger than the GPU allows,
     handing each tile to `put(src,sx,sy,sw,sh,dx,dy)`. Occlusion is screen-space
     and looks past a tile's edge, so each tile is rendered with an overlap that
     is then cropped away — otherwise the seams between tiles show as light lines. */
  renderTiled(clock,size,put){
   const gl=renderer.getContext();
   const max=Math.min(4096,gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),renderer.capabilities.maxTextureSize);
   const pad=aoOn&&size>max?96:0,step=max-2*pad;
   const c=cam();w=h=size;aim();poseHead(watch,clock);
   renderer.setPixelRatio(1);
   for(let ty=0;ty<size;ty+=step)for(let tx=0;tx<size;tx+=step){
    const tw=Math.min(step,size-tx),th=Math.min(step,size-ty);
    const x0=Math.max(0,tx-pad),y0=Math.max(0,ty-pad),x1=Math.min(size,tx+tw+pad),y1=Math.min(size,ty+th+pad);
    renderer.setSize(x1-x0,y1-y0,false);
    c.setViewOffset(size,size,x0,y0,x1-x0,y1-y0);renderer.render(scene,c);
    if(aoOn)ao.apply(c,x1-x0,y1-y0,1);
    put(renderer.domElement,tx-x0,ty-y0,tw,th,tx,ty)}
   c.clearViewOffset()},
  dispose(){if(watch)disposeHead(watch);ao.dispose();env.dispose();renderer.dispose();watch=null}};
 return view}

/* ---------------------------------------------------------------- stills */

/* One offscreen view shared by the design sheet and every export, so a page of
   drawings costs one WebGL context rather than one per picture. */
let still=null;
function stillView(){if(still)return still;
 if(!webglState().ok)throw new Error('3D rendering needs WebGL, which this browser is not providing');
 const c=document.createElement('canvas');
 /* stills and exports take their occlusion at full resolution */
 try{still=createView(c,{preserveDrawingBuffer:true,aoScale:1})}
 catch(e){markWebglFailed('failed',e);throw e}
 /* a lost context cannot draw again: forget this view so the next still builds
    a fresh one (its GPU resources went with the context, so nothing to dispose) */
 c.addEventListener('webglcontextlost',()=>{still=null},{once:true});
 return still}

/* Stills take turns on the one view: a preset picture rendering in the panel
   must not swap the design out from under an export's frame, or the reverse. */
let turn=Promise.resolve();
const inTurn=fn=>{const r=turn.then(fn);turn=r.catch(()=>{});return r};

async function ready(v,d,customs){let p=v.setDesign(d,customs);
 /* uploads load asynchronously; wait, then rebuild with them in place */
 for(let i=0;p&&i<3;i++){await p;p=v.setDesign(d,customs)}}

/* A transparent still of the design. `camera` is front, three-quarter, side or
   back; front stills use the sheet scale so SVG dimension lines drawn at
   1 mm = size/SHEET px still land on the features. */
export function renderStill(d,customs,{w=CAN,h=w,camera='front',clock}={}){return inTurn(async()=>{
 const v=stillView();await ready(v,d,customs);
 v.setCamera(camera);v.resize(w,h,1);v.setFrame({pxPerMm:camera==='front'?Math.min(w,h)/SHEET:null,zoom:1});
 if(camera==='three-quarter')v.fit();
 v.render(clock||sceneClock(d,Date.now()));
 const out=document.createElement('canvas');out.width=w;out.height=h;out.getContext('2d').drawImage(v.renderer.domElement,0,0);
 return out})}

/* A preset's picture for the Presets row (ui/PresetThumb.jsx), as a data URL:
   the case face-on out to its lug tips, the crown close up from three-quarter.
   Rendered at twice the size and scaled down, so edges stay clean. */
export function presetStill(d,part,{size=120,clock}={}){return inTurn(async()=>{
 const v=stillView();await ready(v,d,{});
 const S=size*2;v.resize(S,S,1);
 try{
  if(part==='crown'){const c=new Box3().setFromObject(v.watch.getObjectByName('crown')).getCenter(new Vector3());
   v.setCamera('three-quarter');v.fit();v.orbit.phi=62*Math.PI/180;v.orbit.theta=60*Math.PI/180;
   v.target().copy(c);v.setFrame({pxPerMm:null,zoom:5})}
  else{const g=geoOf(d),r=(g.R+g.lugExt+14)/PX;
   v.setCamera('front');v.setFrame({pxPerMm:S/(2*r),zoom:1})}
  v.render(clock||sceneClock(d,Date.now()));
  const out=document.createElement('canvas');out.width=out.height=size;
  out.getContext('2d').drawImage(v.renderer.domElement,0,0,S,S,0,0,size,size);
  return out.toDataURL('image/png')}
 /* every other still frames from the centre */
 finally{v.target().set(0,0,0);v.fit()}})}

/* A technical line drawing of a design from the front, side or back
   (export/lineart.js), on the still view's renderer. */
export function lineDrawing(d,customs,opts={}){return inTurn(async()=>{
 const v=stillView();await ready(v,d,customs);
 return renderLines(v.renderer,v.watch,opts)})}

/* A frame of a design composed over its scene background, as a PNG Blob, at any
   size: large exports are rendered in GPU-sized tiles. */
export function sceneBlob3D(d,customs,{size=CAN,camera='front',clock,background=true}={}){return inTurn(async()=>{
 const v=stillView();await ready(v,d,customs);
 const out=document.createElement('canvas');out.width=out.height=size;
 const ctx=out.getContext('2d');
 if(background){ctx.save();ctx.scale(size/CAN,size/CAN);await paintBackground(ctx,d);ctx.restore()}
 v.setCamera(camera==='profile'?'front':camera);v.setFrame({pxPerMm:camera==='three-quarter'?null:size/SHEET,zoom:1});
 if(camera==='three-quarter')v.fit();
 v.renderTiled(clock||sceneClock(d,Date.now()),size,(src,sx,sy,sw,sh,dx,dy)=>ctx.drawImage(src,sx,sy,sw,sh,dx,dy,sw,sh));
 return new Promise(r=>out.toBlob(r,'image/png'))})}
