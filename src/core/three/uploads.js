/* Uploaded artwork in the 3D scene.

   An upload is a 1200² sheet-aligned image (upload.jsx fits it into the part's
   frame), so it drops onto the same sheet the procedural bakes use. The metal
   tint and finish texture the 2D layer applied with CSS are composited into
   the texture here instead.

   A flat picture of a dial, strap artwork or markers still reads correctly as a
   texture on the 3D part. A flat picture of a case, bezel, crown or hands has no
   depth to turn, so those are shown face-on and the three-quarter camera is
   withheld while one is active. */
import {CAN,MF} from '../constants.js';
import {tex as finishTex} from '../textures.js';

export const STRUCTURAL=['strap','case','crown','bezel','hands'];

export function activeUpload(d,customs,part){
 const id=d.active&&d.active[part];
 const c=id&&customs&&customs[part]&&customs[part][id];
 return c&&c.url?c:null}

export const hasStructuralUpload=(d,customs)=>STRUCTURAL.some(p=>activeUpload(d,customs,p));

const images=new Map();
function load(url){let e=images.get(url);
 if(!e){const img=new Image();e={img,ready:false,failed:false};
  e.promise=new Promise(res=>{img.onload=()=>{e.ready=true;res(true)};img.onerror=()=>{e.failed=true;res(false)}});
  img.src=url;images.set(url,e)}
 return e}

/* how each part's upload was dressed in 2D (layers.js) */
const DRESS={strap:{tint:true,finish:true},case:{tint:true,finish:true},crown:{tint:true},
 bezel:{tint:true,finish:true},hands:{tint:true},dial:{},markers:{},crystal:{}};

const baked=new Map();
/* The upload as a canvas texture source, or a promise while it (or its finish
   tile) is still loading. Cached per image, tint and finish. */
export function uploadCanvas(part,upload,p){
 const dress=DRESS[part]||{},filter=dress.tint?MF[p.metal]:'';
 const kind=dress.finish&&p.finish&&p.finish!=='none'?p.finish:'';
 const key=`${upload.url}|${filter}|${kind}`;
 if(baked.has(key))return baked.get(key);
 const img=load(upload.url),tile=kind?load(finishTex(kind)):null;
 if(!img.ready||(tile&&!tile.ready)){
  if(img.failed)return null;
  return Promise.all([img.promise,tile&&tile.promise])}
 const cv=document.createElement('canvas');cv.width=cv.height=CAN;const x=cv.getContext('2d');
 if(filter&&filter!=='none')x.filter=filter;
 x.drawImage(img.img,0,0,CAN,CAN);x.filter='none';
 if(tile){/* soft-light finish, masked to the artwork, as the CSS layer did */
  const t=document.createElement('canvas');t.width=t.height=CAN;const tx=t.getContext('2d');
  const pat=tx.createPattern(tile.img,'repeat');
  if(pat&&pat.setTransform&&typeof DOMMatrix!=='undefined')pat.setTransform(new DOMMatrix([220/256,0,0,220/256,0,0]));
  tx.fillStyle=pat;tx.fillRect(0,0,CAN,CAN);
  tx.globalCompositeOperation='destination-in';tx.drawImage(img.img,0,0,CAN,CAN);
  x.save();x.globalAlpha=.6;x.globalCompositeOperation='soft-light';x.drawImage(t,0,0);x.restore()}
 baked.set(key,cv);if(baked.size>24)baked.delete(baked.keys().next().value);
 return cv}
