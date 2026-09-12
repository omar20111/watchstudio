/* Small shared helpers — no DOM dependencies except mk() and toast(). */

export const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export const clone=o=>JSON.parse(JSON.stringify(o));
export const pick=a=>a[Math.random()*a.length|0];
export const normDeg=r=>((r+180)%360+360)%360-180;

/* color helpers (hex) */
export const hx=h=>{const n=parseInt(h.slice(1),16);return[n>>16&255,n>>8&255,n&255]};
export const mixc=(a,b,t)=>{const A=hx(a),B=hx(b);return'#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join('')};
export const lighten=(h,t)=>mixc(h,'#ffffff',t);
export const shade=(h,t)=>mixc(h,'#000000',t);
export const lumOf=h=>{try{const[r,g,b]=hx(h);return(0.2126*r+0.7152*g+0.0722*b)/255}catch(e){return 0}};

/* create a square offscreen canvas */
export const mk=size=>{const c=document.createElement('canvas');c.width=c.height=size;return[c,c.getContext('2d')]};

/* roundRect polyfill (old Safari) — call once at startup */
export function ensureRoundRect(){
 if(!CanvasRenderingContext2D.prototype.roundRect){
  CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h,r){
   r=Math.min(r,w/2,h/2);this.moveTo(x+r,y);this.arcTo(x+w,y,x+w,y+h,r);
   this.arcTo(x+w,y+h,x,y+h,r);this.arcTo(x,y+h,x,y,r);this.arcTo(x,y,x+w,y,r);
   this.closePath();return this};
 }
}

/* tiny toast notifications */
export function toast(msg){const el=document.createElement('div');el.textContent=msg;
 el.style.cssText='position:fixed;bottom:56px;left:50%;transform:translateX(-50%);background:#d4af37;color:#141414;font-size:12px;font-weight:600;padding:7px 14px;border-radius:999px;z-index:300;box-shadow:0 6px 24px rgba(0,0,0,.5);transition:opacity .4s';
 document.body.appendChild(el);setTimeout(()=>{el.style.opacity='0';setTimeout(()=>el.remove(),450)},1900)}

/* Read an image file down to a bounded size as a JPEG data URL. Anything that
   ends up inside the design state is cloned on every edit and persisted every
   autosave, so full-resolution camera output cannot go in there. */
export function downscale(file,max=1600,q=0.82){return new Promise(res=>{
 const rd=new FileReader();
 rd.onload=()=>{const im=new Image();
  im.onload=()=>{const k=Math.min(1,max/Math.max(im.width,im.height));
   if(k>=1)return res(rd.result);
   const c=document.createElement('canvas');
   c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);
   c.getContext('2d').drawImage(im,0,0,c.width,c.height);
   res(c.toDataURL('image/jpeg',q))};
  im.onerror=()=>res(rd.result);im.src=rd.result};
 rd.onerror=()=>res(null);rd.readAsDataURL(file)})}

/* Deterministic pseudo-random in [0,1) from an integer index.
   Anything that feeds a cached bake MUST use this instead of Math.random:
   baking the same part twice after a cache clear has to be pixel-identical,
   or LayerView cross-fades a layer against a shimmering copy of itself. */
export const hash01=i=>{const x=Math.sin((i+1)*12.9898)*43758.5453;return x-Math.floor(x)};

/* ---- boot assertion harness -----------------------------------------
   Collects instead of throwing at the first failure, so one run reports
   every broken invariant rather than only the earliest one. */
export const ASSERT_FAILURES=[];
export function assert(cond,msg){if(!cond)ASSERT_FAILURES.push(msg);return !!cond}
export function assertClose(a,b,tol,msg){return assert(Math.abs(a-b)<=tol,`${msg} (got ${a}, want ${b}±${tol})`)}
export function assertReport(){return ASSERT_FAILURES.slice()}
export function assertThrowIfFailed(){
 if(ASSERT_FAILURES.length)throw new Error('WatchStudio invariants failed:\n  - '+ASSERT_FAILURES.join('\n  - '));
 return true}
