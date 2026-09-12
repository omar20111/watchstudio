/* A rendered view of the head: renderer, studio, key light, cameras.

   'front' is orthographic and framed on the same 1200 px sheet the 2D stage
   uses, so the two can be laid over each other. 'three-quarter' is the camera
   the 2D engine could not have. */
import {WebGLRenderer,Scene,OrthographicCamera,PerspectiveCamera,DirectionalLight,Mesh,PlaneGeometry,
        ShadowMaterial,NeutralToneMapping,SRGBColorSpace,VSMShadowMap,Vector3} from 'three';
import {CAN,PX} from '../constants.js';
import {LIGHT} from '../render/material.js';
import {paintBackground} from '../../export/png.js';
import {sceneClock} from '../time.js';
import {buildHead,poseHead,disposeHead} from './watch.js';
import {studioEnvironment} from './studio.js';

const SHEET=CAN/PX;

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

 /* catches the head's shadow on the table without drawing a table */
 const ground=new Mesh(new PlaneGeometry(240,240),new ShadowMaterial({opacity:.45}));
 ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);

 const front=new OrthographicCamera(-1,1,1,-1,.1,1000);
 front.position.set(0,300,0);front.up.set(0,0,-1);front.lookAt(0,0,0);
 const tq=new PerspectiveCamera(19,1,1,4000);
 const target=new Vector3();

 let head=null,view='front',w=1,h=1;
 const aim=()=>{const a=w/h,half=SHEET/2;
  const hh=a<1?half/a:half;
  Object.assign(front,{left:-hh*a,right:hh*a,top:hh,bottom:-hh});front.updateProjectionMatrix();
  tq.aspect=a;tq.updateProjectionMatrix();
  /* from 5 o'clock, 36 degrees above the dial, far enough back for the strap */
  const el=36*Math.PI/180,az=28*Math.PI/180,dist=(SHEET*.58)/Math.tan(tq.fov*Math.PI/360)/Math.min(1,a);
  tq.position.set(target.x+Math.sin(az)*Math.cos(el)*dist,target.y+Math.sin(el)*dist,target.z+Math.cos(az)*Math.cos(el)*dist);
  tq.lookAt(target)};

 return{
  renderer,scene,
  camera:()=>view==='front'?front:tq,
  target:()=>target,
  setDesign(d){if(head){scene.remove(head);disposeHead(head)}
   head=buildHead(d,{aniso:renderer.capabilities.getMaxAnisotropy()});scene.add(head);
   /* the watch rests on its strap, so the table is wherever the strap lands */
   ground.position.y=head.userData.groundY-.02;
   target.set(0,head.userData.heights.dial,0);aim()},
  setView(v){view=v==='three-quarter'?'three-quarter':'front';aim()},
  resize(width,height,dpr=1){w=Math.max(1,width);h=Math.max(1,height);
   renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);aim()},
  render(clock){if(head&&clock)poseHead(head,clock);
   renderer.render(scene,view==='front'?front:tq)},
  dispose(){if(head)disposeHead(head);env.dispose();renderer.dispose()}}}

/* One frame of a design, composed over the scene background, as a PNG Blob —
   the 3D counterpart of png.js sceneBlob, used by `npm run refs`. */
export async function sceneBlob3D(d,{size=CAN,view='front',clock}={}){
 const gl=document.createElement('canvas');
 const v=createView(gl,{preserveDrawingBuffer:true});
 v.resize(size,size,1);v.setDesign(d);v.setView(view);
 v.render(clock||sceneClock(d,Date.now()));
 const out=document.createElement('canvas');out.width=out.height=size;
 const ctx=out.getContext('2d');ctx.save();ctx.scale(size/CAN,size/CAN);
 await paintBackground(ctx,d);ctx.restore();ctx.drawImage(gl,0,0);
 v.dispose();
 return new Promise(r=>out.toBlob(r,'image/png'))}
