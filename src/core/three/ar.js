/* Augmented reality: the designed watch, at real size, in the room.

   Two routes, chosen by what the browser offers:
   - quicklook  Safari on iPhone and iPad. The watch is written as USDZ
                (export/usdz.js) and opened in Apple's AR viewer.
   - webxr      Chrome on Android with ARCore. An immersive-ar session runs in
                the page: the same watch, materials and wear the editor draws,
                placed with a tap on a detected surface, its hands keeping time.
   Anything else gets the QR hand-off to a phone (ui/ARModal.jsx).

   A WebXR session has to be requested inside the tap that asked for it, so the
   session starts first and the watch is built after it opens. */
import {WebGLRenderer,Scene,PerspectiveCamera,DirectionalLight,HemisphereLight,Group,Mesh,PlaneGeometry,RingGeometry,
        MeshBasicMaterial,ShadowMaterial,NeutralToneMapping,SRGBColorSpace,PCFSoftShadowMap,Vector3} from 'three';
import {studioEnvironment} from './studio.js';
import {poseHead,disposeHead} from './watch.js';
import {sceneClock} from '../time.js';

let support=null;
/* 'quicklook' | 'webxr' | null, probed once */
export function arSupport(){
 if(support)return support;
 support=(async()=>{
  if(typeof document==='undefined')return null;
  const a=document.createElement('a');
  if(a.relList&&a.relList.supports&&a.relList.supports('ar'))return'quicklook';
  try{if(navigator.xr&&await navigator.xr.isSessionSupported('immersive-ar'))return'webxr'}catch(e){}
  return null})();
 return support}

/* Quick Look opens from a link marked rel="ar" that wraps an image */
export function openQuickLook(bytes,name='watch'){
 const url=URL.createObjectURL(new Blob([bytes],{type:'model/vnd.usdz+zip'}));
 const a=document.createElement('a');a.rel='ar';a.href=url;a.download=`${name}.usdz`;
 a.appendChild(document.createElement('img'));document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),60000)}

/* Start an immersive-ar session. `overlay` is the element shown over the camera
   (status and the exit button); `build` resolves to the posed watch in mm;
   `onState` hears 'preparing' | 'searching' | 'ready' | 'placed'; `onEnd` runs
   once, however the session ends. Resolves to the XRSession. */
export async function startWebXR({overlay,build,design,onState=()=>{},onEnd=()=>{}}){
 const session=await navigator.xr.requestSession('immersive-ar',{requiredFeatures:['hit-test'],
  optionalFeatures:['dom-overlay'],domOverlay:{root:overlay}});
 onState('preparing');
 const canvas=document.createElement('canvas');
 const renderer=new WebGLRenderer({canvas,antialias:true,alpha:true});
 renderer.outputColorSpace=SRGBColorSpace;renderer.toneMapping=NeutralToneMapping;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=PCFSoftShadowMap;
 renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local');

 const scene=new Scene(),camera=new PerspectiveCamera();
 const env=studioEnvironment(renderer);scene.environment=env.texture;
 scene.add(new HemisphereLight(0xffffff,0x444444,.6));
 /* The watch is modelled in mm and sits under a 1/1000 holder. The key light
    rides in the holder (mm) so it turns with the watch, but a shadow camera's
    frustum is in world units, so that is sized in metres. */
 const holder=new Group();holder.scale.setScalar(.001);holder.visible=false;scene.add(holder);
 const key=new DirectionalLight(0xffffff,1.4);key.position.set(40,120,60);key.castShadow=true;
 key.shadow.mapSize.set(1024,1024);key.shadow.bias=-.0005;
 Object.assign(key.shadow.camera,{left:-.07,right:.07,top:.11,bottom:-.11,near:.005,far:.4});
 holder.add(key,key.target);
 const floor=new Mesh(new PlaneGeometry(260,260),new ShadowMaterial({opacity:.35}));
 floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;holder.add(floor);

 const reticle=new Mesh(new RingGeometry(.018,.022,40).rotateX(-Math.PI/2),new MeshBasicMaterial({color:0xe8c766}));
 reticle.matrixAutoUpdate=false;reticle.visible=false;scene.add(reticle);

 let watch=null,hitSource=null,placed=false,ended=false;
 const end=()=>{if(ended)return;ended=true;
  renderer.setAnimationLoop(null);if(hitSource)hitSource.cancel();
  if(watch)disposeHead(watch);env.dispose();renderer.dispose();onEnd()};
 session.addEventListener('end',end);

 try{
  await renderer.xr.setSession(session);
  hitSource=await session.requestHitTestSource({space:await session.requestReferenceSpace('viewer')});
  onState('searching');
  watch=await build();
  if(ended){disposeHead(watch);return session}
  /* rest the strap on the surface */
  watch.position.y=-watch.userData.groundY;holder.add(watch);
  watch.traverse(o=>{if(o.isMesh){o.castShadow=true}});
  onState(reticle.visible?'ready':'searching');
 }catch(e){session.end().catch(()=>{});throw e}

 /* a tap puts the watch where the ring is, turned so 6 o'clock faces you */
 const cam=new Vector3();
 session.addEventListener('select',()=>{if(!reticle.visible||!watch)return;
  holder.position.setFromMatrixPosition(reticle.matrix);
  renderer.xr.getCamera().getWorldPosition(cam);
  holder.rotation.set(0,Math.atan2(cam.x-holder.position.x,cam.z-holder.position.z),0);
  holder.visible=true;if(!placed){placed=true;onState('placed')}});

 let found=false;
 renderer.setAnimationLoop((t,frame)=>{
  if(frame&&hitSource){const hits=frame.getHitTestResults(hitSource);
   /* the ring stays after placing: tapping again moves the watch there */
   if(hits.length){const pose=hits[0].getPose(renderer.xr.getReferenceSpace());
    reticle.visible=true;reticle.matrix.fromArray(pose.transform.matrix);
    if(!found&&watch&&!placed){found=true;onState('ready')}}
   else reticle.visible=false}
  if(watch)poseHead(watch,sceneClock(design(),Date.now()));
  renderer.render(scene,camera)});
 return session}
