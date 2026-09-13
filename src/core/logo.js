/* A logo of the user's own on the dial.

   Unlike a part upload, which replaces a part with a flat picture, a logo is
   added to the procedural dial: drawn onto the 1200 px sheet at its place, then
   either printed (a decal on the dial, in its own colours or the dial's ink) or
   applied (traced and raised into polished metal, the way the numerals are).

   The image lives in the upload vault under the pseudo-part 'logo' (store
   addUpload), so it survives reloads and travels in project files like any
   upload; share links carry the design without it. The settings sit on the
   dial part: d.parts.dial.logo. */
import {CAN,C} from './constants.js';
import {geoOf} from './geometry.js';
import {lumOf} from './utils.js';

export const LOGO_STYLES=[['print','Printed'],['applied','Applied metal']];
export const LOGO_COLOURS=[['ink','Dial ink'],['original','Original']];
/* size: width as a fraction of the dial radius; y: the centre's offset from the
   dial centre, in dial radii, negative toward 12 — above the brand text */
export const LOGO_DEF=()=>({style:'print',color:'ink',size:.34,y:-.6});
export const logoOf=d=>({...LOGO_DEF(),...(((d.parts||{}).dial||{}).logo||{})});

export function activeLogo(d,customs){
 const id=d.active&&d.active.logo,c=id&&customs&&customs.logo&&customs.logo[id];
 return c&&c.url?c:null}

const images=new Map();
function image(url){let e=images.get(url);
 if(!e){const img=new Image();e={img,ready:false,failed:false};
  e.promise=new Promise(res=>{img.onload=()=>{e.ready=true;res(true)};img.onerror=()=>{e.failed=true;res(false)}});
  img.src=url;images.set(url,e)}
 return e}

/* the dial ink a printed logo takes, by the dial's own lightness */
export const logoInk=d=>lumOf((d.parts.dial||{}).color||'#16324f')>.55?'#26282c':'#e9e4d6';

/* The logo on a transparent 1200² sheet at its place on the dial: a canvas, a
   promise while the image loads, or null when there is no logo. The height is
   capped so a tall mark cannot run into the hands' arbor. */
const sheets=new Map();
export function logoSheet(d,customs){const u=activeLogo(d,customs);if(!u)return null;
 const L=logoOf(d),r=geoOf(d).dialR,ink=L.color==='ink'?logoInk(d):null;
 const key=[u.url,L.size,L.y,ink||'original',r].join('|');
 if(sheets.has(key))return sheets.get(key);
 const e=image(u.url);
 if(!e.ready)return e.failed?null:e.promise;
 const iw=e.img.naturalWidth||e.img.width||300,ih=e.img.naturalHeight||e.img.height||150;
 let w=r*L.size,h=w*ih/iw;if(h>r*.42){h=r*.42;w=h*iw/ih}
 const cv=document.createElement('canvas');cv.width=cv.height=CAN;const x=cv.getContext('2d');
 x.drawImage(e.img,C-w/2,C+L.y*r-h/2,w,h);
 if(ink){x.globalCompositeOperation='source-in';x.fillStyle=ink;x.fillRect(0,0,CAN,CAN);x.globalCompositeOperation='source-over'}
 sheets.set(key,cv);if(sheets.size>8)sheets.delete(sheets.keys().next().value);
 return cv}
