/* Technical line drawings of the built watch, for the tech pack.

   The drawing is the 3D head itself, seen orthographically from the front, the
   side (3 o'clock) or the back, so it has the proportions of the model and the
   exports and can never drift from them. Two passes on the GPU:

     1. every visible part is drawn with its surface direction as colour and
        its depth kept (MeshNormalMaterial into a target with a depth texture)
     2. a line is drawn wherever the outline ends, the surface folds (normals
        more than ~30 degrees apart across a pixel) or one part stands in front
        of another (a step in depth that is not just a sloping surface)

   The lines are thickened to a pen width in paper millimetres and the result is
   rendered at twice the output size and averaged down, so edges are smooth.

   What is left out: the strap (a separate supplier, and the drawing is of the
   head), anything drawn as a decal or glass (printing, lume, uploaded sheets;
   the crystal except in the side view, where its height matters), and the
   movement behind an exhibition back.

   Drawing coordinates are millimetres with u to the right and v down the page:
     front  u = x (toward 3 o'clock), v = z (toward 6 o'clock)
     side   seen from 3 o'clock: u = -z (12 o'clock on the right), v = -y
     back   u = -x (3 o'clock on the left, as turned over), v = z */
import {WebGLRenderTarget,DepthTexture,UnsignedIntType,NearestFilter,Scene,OrthographicCamera,MeshNormalMaterial,
        ShaderMaterial,Mesh,PlaneGeometry,Vector3,Box3,Color} from 'three';
import {poseHead} from '../core/three/watch.js';


/* world [x,y,z] -> drawing [u,v] */
export function toDrawing(view,[x,y,z]){
 return view==='side'?[-z,-y]:view==='back'?[-x,z]:[x,z]}

const CAMERA={front:{pos:[0,1,0],up:[0,0,-1]},side:{pos:[1,0,0],up:[0,1,0]},back:{pos:[0,-1,0],up:[0,0,-1]}};

const visibleChain=o=>{for(let n=o;n;n=n.parent)if(!n.visible)return false;return true};

/* what a drawing of `view` leaves out: seen from the back, everything inside
   the case (the movement, the dial and its parts, the crown's tube) so an
   exhibition window reads as a window */
const INSIDE=new Set(['movement','dial','hands','markers']);
function omitted(o,view){const m=o.material||{};
 if(view==='back'){if(o.name==='crownTube')return true;for(let n=o;n;n=n.parent)if(INSIDE.has(n.name)||(n.userData&&INSIDE.has(n.userData.part)))return true}
 if(/^crystal|^cyclops/.test(o.name))return view!=='side';
 return !!(m.transparent||m.alphaTest>0||m.transmission>0||(o.userData&&o.userData.contactShadow))}

const EDGE_FS=`
uniform sampler2D tNormal;uniform sampler2D tDepth;uniform vec2 texel;uniform float depthMm;uniform float stepMm;
varying vec2 vUv;
vec4 N(vec2 o){return texture2D(tNormal,vUv+o*texel);}
float D(vec2 o){return texture2D(tDepth,vUv+o*texel).x*depthMm;}
void main(){
 vec4 c=N(vec2(0.));float cov=c.a;
 float ink=0.;
 vec2 dirs[4];dirs[0]=vec2(1.,0.);dirs[1]=vec2(0.,1.);dirs[2]=vec2(1.,1.);dirs[3]=vec2(1.,-1.);
 vec3 n0=normalize(c.rgb*2.-1.);float d0=D(vec2(0.));
 for(int i=0;i<4;i++){vec2 o=dirs[i];
  vec4 a=N(o),b=N(-o);
  /* the outline: coverage changes across the pixel */
  ink=max(ink,abs(a.a-cov));ink=max(ink,abs(b.a-cov));
  if(cov>.5&&a.a>.5&&b.a>.5){
   vec3 na=normalize(a.rgb*2.-1.),nb=normalize(b.rgb*2.-1.);
   /* a fold: the surface turns sharply */
   float fold=max(1.-dot(n0,na),1.-dot(n0,nb));
   ink=max(ink,smoothstep(.11,.18,fold));
   /* a step: depth jumps more than a slope would carry it (second difference) */
   float da=D(o),db=D(-o),lap=abs(da+db-2.*d0);
   ink=max(ink,smoothstep(stepMm*.6,stepMm,lap));}}
 gl_FragColor=vec4(ink,cov,0.,1.);}`;

const PEN_FS=`
uniform sampler2D tEdge;uniform vec2 texel;uniform float radius;
varying vec2 vUv;
void main(){
 float ink=texture2D(tEdge,vUv).r;float cov=texture2D(tEdge,vUv).g;
 for(int i=0;i<16;i++){float a=float(i)*.3927;
  for(int k=1;k<=2;k++){vec2 o=vec2(cos(a),sin(a))*radius*float(k)/2.;
   ink=max(ink,texture2D(tEdge,vUv+o*texel).r*(1.-.25*float(k-1)));}}
 /* parts are a pale tone so a closed outline reads as solid; lines are black */
 float g=mix(mix(1.,.955,cov),0.,clamp(ink,0.,1.));
 gl_FragColor=vec4(g,g,g,1.);}`;
const VS='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';

/* Draw `watch` (already built and posed by its view) as a line drawing.
   ppm: output pixels per world mm; pen: line width in world mm.
   Returns {width,height,gray (Uint8Array, rows top first),u0,v0,u1,v1,ppm,extents}:
   extents holds the drawing-space box {u0,v0,u1,v1} of each of the head's part
   groups (case, bezel, crown, dial, hands...) and of each mesh in `names`. */
export function renderLines(renderer,watch,{view='front',ppm=24,pen=.12,clock=null,margin=1.5,names=[]}={}){
 if(clock)poseHead(watch,clock);
 watch.updateMatrixWorld(true);
 /* hide what the drawing leaves out, remembering what was visible */
 const G=watch.userData.groups||{},hidden=[];
 const hide=o=>{if(o.visible){o.visible=false;hidden.push(o)}};
 if(G.strap)hide(G.strap);
 watch.traverse(o=>{if(o.isMesh&&omitted(o,view))hide(o)});

 /* the drawing's extent: every visible mesh's box, in drawing space */
 const boxOf=root=>{let u0=1e9,v0=1e9,u1=-1e9,v1=-1e9;const b=new Box3(),p=new Vector3();
  root.traverse(o=>{if(!o.isMesh||!visibleChain(o))return;if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();
   b.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
   for(let i=0;i<8;i++){p.set(i&1?b.max.x:b.min.x,i&2?b.max.y:b.min.y,i&4?b.max.z:b.min.z);
    const[u,v]=toDrawing(view,[p.x,p.y,p.z]);u0=Math.min(u0,u);u1=Math.max(u1,u);v0=Math.min(v0,v);v1=Math.max(v1,v)}});
  return u1<u0?null:{u0,v0,u1,v1}};
 const all=boxOf(watch);
 /* the boxes of the head's parts and of any meshes asked for by name, while
    only what is drawn is visible */
 const extents={};
 for(const k of Object.keys(G))if(k!=='strap'){const b=boxOf(G[k]);if(b)extents[k]=b}
 for(const n of names){let found=null;watch.traverse(o=>{if(!found&&o.name===n)found=o});const b=found&&boxOf(found);if(b)extents[n]=b}
 const u0=all.u0-margin,v0=all.v0-margin,u1=all.u1+margin,v1=all.v1+margin;

 /* rendered at twice the output size, within what the GPU can hold */
 const maxTex=Math.min(renderer.capabilities.maxTextureSize||4096,8192);
 let ss=2,outW=Math.ceil((u1-u0)*ppm),outH=Math.ceil((v1-v0)*ppm);
 const fit=Math.min(1,maxTex/(outW*ss),maxTex/(outH*ss));
 if(fit<1){ppm*=fit;outW=Math.ceil((u1-u0)*ppm);outH=Math.ceil((v1-v0)*ppm)}
 const W=outW*ss,H=outH*ss,ippm=ppm*ss;

 const cam=new OrthographicCamera(u0,u0+W/ippm,-v0,-(v0+H/ippm),1,1000);
 const C=CAMERA[view];cam.position.set(...C.pos).multiplyScalar(500);cam.up.set(...C.up);cam.lookAt(0,0,0);cam.updateMatrixWorld(true);

 const rtOpts={minFilter:NearestFilter,magFilter:NearestFilter,depthBuffer:true};
 const rtN=new WebGLRenderTarget(W,H,{...rtOpts,depthTexture:new DepthTexture(W,H,UnsignedIntType)});
 const rtE=new WebGLRenderTarget(W,H,rtOpts),rtP=new WebGLRenderTarget(W,H,rtOpts);
 const scene=new Scene(),normalMat=new MeshNormalMaterial();scene.overrideMaterial=normalMat;
 const parent=watch.parent;scene.add(watch);
 const quadCam=new OrthographicCamera(-1,1,1,-1,0,1),quadGeo=new PlaneGeometry(2,2);
 const edgeMat=new ShaderMaterial({vertexShader:VS,fragmentShader:EDGE_FS,uniforms:{
  tNormal:{value:rtN.texture},tDepth:{value:rtN.depthTexture},texel:{value:[1/W,1/H]},depthMm:{value:999},
  /* a step of a tenth of a millimetre is a separate part standing in front */
  stepMm:{value:Math.max(.08,1.5/ippm)}}});
 const penMat=new ShaderMaterial({vertexShader:VS,fragmentShader:PEN_FS,uniforms:{
  tEdge:{value:rtE.texture},texel:{value:[1/W,1/H]},radius:{value:Math.max(.5,pen*ippm/2)}}});
 const quad=new Mesh(quadGeo,edgeMat),quadScene=new Scene();quadScene.add(quad);

 const prev={target:renderer.getRenderTarget(),alpha:renderer.getClearAlpha(),shadow:renderer.shadowMap.enabled,autoClear:renderer.autoClear};
 const prevColor=renderer.getClearColor(new Color());
 const pixels=new Uint8Array(W*H*4);
 try{
  renderer.shadowMap.enabled=false;renderer.autoClear=true;
  renderer.setClearColor(0x000000,0);
  renderer.setRenderTarget(rtN);renderer.clear();renderer.render(scene,cam);
  quad.material=edgeMat;renderer.setRenderTarget(rtE);renderer.render(quadScene,quadCam);
  quad.material=penMat;renderer.setRenderTarget(rtP);renderer.render(quadScene,quadCam);
  renderer.readRenderTargetPixels(rtP,0,0,W,H,pixels)}
 finally{
  renderer.setRenderTarget(prev.target);renderer.shadowMap.enabled=prev.shadow;renderer.autoClear=prev.autoClear;
  renderer.setClearColor(prevColor,prev.alpha);
  if(parent)parent.add(watch);
  for(const o of hidden)o.visible=true;
  rtN.depthTexture.dispose();rtN.dispose();rtE.dispose();rtP.dispose();normalMat.dispose();edgeMat.dispose();penMat.dispose();quadGeo.dispose()}

 /* averaged down to the output size, rows flipped to top first */
 const gray=new Uint8Array(outW*outH);
 for(let y=0;y<outH;y++)for(let x=0;x<outW;x++){let s=0;
  for(let j=0;j<ss;j++)for(let i=0;i<ss;i++)s+=pixels[((H-1-(y*ss+j))*W+(x*ss+i))*4];
  gray[y*outW+x]=Math.round(s/(ss*ss))}

 return{width:outW,height:outH,gray,u0,v0,u1:u0+outW/ppm,v1:v0+outH/ppm,ppm,extents,box:all}}
