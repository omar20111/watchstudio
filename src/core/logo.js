/* A logo of the user's own on the dial.

   Unlike a part upload, which replaces a part with a flat picture, a logo is
   added to the procedural dial: drawn onto the 1200 px sheet at its place, then
   either printed (a decal on the dial, in its own colours or the dial's ink) or
   applied (traced and raised into polished metal, the way the numerals are).

   The image lives in the upload vault under the pseudo-part 'logo' (store
   addUpload), so it survives reloads and travels in project files like any
   upload; share links carry the design without it. The settings sit on the
   dial part: d.parts.dial.logo. */
import {CAN,C,PX} from './constants.js';
import {geoOf,dialLayoutOf,dialBoxesOf,indexInnerOf,HANDS_HUB_MM} from './geometry.js';
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

/* Where the logo goes and how big, in sheet px. It keeps the place asked for
   and the size asked for — made smaller, never moved, until it clears the
   dial's printing and date window (geometry.js dialBoxesOf), the registers and
   the hour indices, and leaves the hands' centre free (geometry.js CLEARANCES).
   `aspect` is the image's height over its width. `limitedBy` names what it was
   made smaller for, or is null. */
const LOGO_GAP_MM=.4,LOGO_MIN=.15;
export function logoBoxOf(d,aspect=1){const L=logoOf(d),r=geoOf(d).dialR,lay=dialLayoutOf(d),gap=LOGO_GAP_MM*PX;
 const cx=C,cy=C+L.y*r;
 let w0=r*L.size,h0=w0*aspect;if(h0>r*.42){h0=r*.42;w0=h0/aspect}
 const boxes=dialBoxesOf(d,gap),ringR=indexInnerOf(d)*r-gap;
 const circles=[...lay.subdials.map(s=>({kind:'register',x:s.x,y:s.y,r:s.r+gap})),{kind:'hands’ centre',x:C,y:C,r:HANDS_HUB_MM*PX}];
 const clash=k=>{const hw=w0*k/2,hh=h0*k/2,b={x0:cx-hw,x1:cx+hw,y0:cy-hh,y1:cy+hh};
  for(const o of boxes)if(b.x0<o.x1&&b.x1>o.x0&&b.y0<o.y1&&b.y1>o.y0)return o.kind;
  for(const c of circles){const nx=Math.max(b.x0,Math.min(c.x,b.x1)),ny=Math.max(b.y0,Math.min(c.y,b.y1));if(Math.hypot(nx-c.x,ny-c.y)<c.r)return c.kind}
  for(const[x,y]of[[b.x0,b.y0],[b.x1,b.y0],[b.x0,b.y1],[b.x1,b.y1]])if(Math.hypot(x-C,y-C)>ringR)return'hour markers';
  return null};
 let k=1,limitedBy=clash(1);
 if(limitedBy){let lo=LOGO_MIN,hi=1;
  if(clash(lo))k=lo;else{for(let i=0;i<24;i++){const m=(lo+hi)/2;if(clash(m))hi=m;else lo=m}k=lo}}
 return{x:cx,y:cy,w:w0*k,h:h0*k,scale:k,limitedBy,clear:!clash(k)}}

/* the logo's fitted box for the panel, once its image has loaded (else null) */
export function logoFitOf(d,customs){const u=activeLogo(d,customs);if(!u)return null;
 const e=image(u.url);if(!e.ready)return null;
 return logoBoxOf(d,(e.img.naturalHeight||e.img.height||150)/(e.img.naturalWidth||e.img.width||300))}

/* The logo on a transparent 1200² sheet at its place on the dial: a canvas, a
   promise while the image loads, or null when there is no logo. Its box is
   logoBoxOf's, so the printing, the date and the hands keep their room. */
const sheets=new Map();
export function logoSheet(d,customs){const u=activeLogo(d,customs);if(!u)return null;
 const L=logoOf(d),ink=L.color==='ink'?logoInk(d):null;
 const e=image(u.url);
 if(!e.ready)return e.failed?null:e.promise;
 const iw=e.img.naturalWidth||e.img.width||300,ih=e.img.naturalHeight||e.img.height||150;
 const B=logoBoxOf(d,ih/iw),{w,h}=B;
 const key=[u.url,B.x,B.y,w,h,ink||'original'].join('|');
 if(sheets.has(key))return sheets.get(key);
 const cv=document.createElement('canvas');cv.width=cv.height=CAN;const x=cv.getContext('2d');
 x.drawImage(e.img,B.x-w/2,B.y-h/2,w,h);
 if(ink){x.globalCompositeOperation='source-in';x.fillStyle=ink;x.fillRect(0,0,CAN,CAN);x.globalCompositeOperation='source-over'}
 sheets.set(key,cv);if(sheets.size>8)sheets.delete(sheets.keys().next().value);
 return cv}
