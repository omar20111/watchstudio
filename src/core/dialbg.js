/* A picture under the dial's printing.

   A part upload replaces a part with a flat photograph. A dial background is
   laid under the dial instead: the plate keeps its date window, its chapter
   step, its brand and model line and its minute track, and — because the
   picture is only the plate's colour — it keeps its finish too, so a sunburst
   or a lacquer still catches the light in 3D.

   The image lives in the upload vault under the pseudo-part 'dialbg' (store
   addUpload), like the logo, so it survives reloads and travels in project
   files. Its placing sits on the dial part: d.parts.dial.bg. */
import {CAN,C,PX} from './constants.js';
import {geoOf} from './geometry.js';
import {getProc} from './cache.js';

/* scale: how much larger than the dial the picture is drawn; rot in degrees;
   x and y move it, in dial radii */
export const BG_DEF=()=>({scale:1,rot:0,x:0,y:0});
export const dialBgOf=d=>({...BG_DEF(),...(((d.parts||{}).dial||{}).bg||{})});
export function activeDialBg(d,customs){const id=d.active&&d.active.dialbg,c=id&&customs&&customs.dialbg&&customs.dialbg[id];
 return c&&c.url?c:null}

const images=new Map();
function image(url){let e=images.get(url);
 if(!e){const img=new Image();e={img,ready:false,failed:false};
  e.promise=new Promise(res=>{img.onload=()=>{e.ready=true;res(true)};img.onerror=()=>{e.failed=true;res(false)}});
  img.src=url;images.set(url,e)}
 return e}

/* The dial's texture: the plate's colour, the picture over it, and the artwork
   (printing, window frame, track) over that — or just the artwork when there is
   no picture. A canvas, or a promise while the picture loads. */
const sheets=new Map();
export function dialPlateCanvas(d,customs,mode='flat',res=null){
 const art=getProc('dial',d,undefined,mode,res);
 const u=activeDialBg(d,customs);
 if(!u||mode!=='flat')return art;
 const e=image(u.url);
 if(!e.ready)return e.failed?art:e.promise;
 const B=dialBgOf(d),r=geoOf(d).dialR;
 const key=[u.url,B.scale,B.rot,B.x,B.y,d.parts.dial.color,r,art.width,art.__stamp||(art.__stamp=Math.random())].join('|');
 if(sheets.has(key))return sheets.get(key);
 /* the same square of the sheet, at the same scale, as the artwork */
 const cv=document.createElement('canvas');cv.width=cv.height=art.width;const x=cv.getContext('2d');
 if(res){const k=art.width/res.box[2];x.setTransform(k,0,0,k,-res.box[0]*k,-res.box[1]*k)}
 x.save();x.beginPath();x.arc(C,C,r,0,Math.PI*2);x.clip();
 x.fillStyle=d.parts.dial.color||'#16324f';x.fillRect(0,0,CAN,CAN);
 const iw=e.img.naturalWidth||e.img.width||1,ih=e.img.naturalHeight||e.img.height||1;
 const k=2*r/Math.min(iw,ih)*B.scale;
 x.translate(C+B.x*r,C+B.y*r);x.rotate(B.rot*Math.PI/180);
 x.drawImage(e.img,-iw*k/2,-ih*k/2,iw*k,ih*k);
 x.restore();
 x.setTransform(1,0,0,1,0,0);x.drawImage(art,0,0);
 sheets.set(key,cv);if(sheets.size>6)sheets.delete(sheets.keys().next().value);
 return cv}
