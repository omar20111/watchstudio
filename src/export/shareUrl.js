/* Share a design as a URL fragment.

   Images are deliberately excluded — they live in IndexedDB now and a photo
   would blow past every practical URL length limit. A shared link carries the
   design; the recipient sees the procedural parts.

   Encoding goes through TextEncoder/TextDecoder rather than escape/unescape:
   the old pair is deprecated, and it mangles anything outside Latin-1 — which
   includes the é in "Fumé" and any non-Latin dial text a user might type. */
import {SCHEMA_VERSION,hydrate,migrateProject} from '../state/store.js';
import {store} from '../state/store.js';
import {toast} from '../core/utils.js';

const b64url=bytes=>{let s='';for(const b of bytes)s+=String.fromCharCode(b);
 return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const unb64url=str=>{const s=str.replace(/-/g,'+').replace(/_/g,'/');
 const pad=s.length%4?'='.repeat(4-s.length%4):'';
 const bin=atob(s+pad);const out=new Uint8Array(bin.length);
 for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out};

const payloadOf=(d,name)=>JSON.stringify({app:'WatchStudio',schemaVersion:SCHEMA_VERSION,name,d:{...d,bgCustom:null,active:{}}});
const designOf=json=>{const o=migrateProject(JSON.parse(json));
 if(!o||!o.d||!o.d.parts)return null;
 return{d:hydrate(o.d,o.schemaVersion),name:o.name||'Shared watch'}};

/* `#w=`: the design as base64 JSON — every link made before compression, and
   the fallback where a browser has no CompressionStream */
export function encodeDesign(d,name){return b64url(new TextEncoder().encode(payloadOf(d,name)))}
export function decodeDesign(code){
 try{return designOf(new TextDecoder().decode(unb64url(code)))}
 catch(e){return null}}

/* `#z=`: the same JSON deflated first. A design's JSON is mostly repeated keys,
   so this is about a third of the length — short enough to fit in a QR code a
   phone can read off a laptop screen (the AR hand-off), and tidier to paste. */
const pipe=async(bytes,stream)=>new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
export const canCompress=()=>typeof CompressionStream!=='undefined'&&typeof DecompressionStream!=='undefined';
export async function encodeDesignCompact(d,name){
 return b64url(await pipe(new TextEncoder().encode(payloadOf(d,name)),new CompressionStream('deflate-raw')))}
export async function decodeDesignCompact(code){
 try{return designOf(new TextDecoder().decode(await pipe(unb64url(code),new DecompressionStream('deflate-raw'))))}
 catch(e){return null}}

export async function shareLink(){const st=store.getState();
 const base=location.origin+location.pathname;
 if(canCompress())try{return `${base}#z=${await encodeDesignCompact(st.d,st.projName)}`}catch(e){}
 return `${base}#w=${encodeDesign(st.d,st.projName)}`}

export async function copyShareLink(){
 const url=await shareLink();
 try{await navigator.clipboard.writeText(url);toast('Share link copied')}
 catch(e){
  /* clipboard is permission-gated; fall back to a selectable prompt so the
     link is still obtainable rather than silently lost */
  window.prompt('Copy this share link',url)}
 return url}

/* Read a shared design out of the URL on boot, if there is one. */
export async function readShareFromLocation(){
 const h=location.hash||'';
 const z=/[#&]z=([A-Za-z0-9\-_]+)/.exec(h);
 if(z&&canCompress())return decodeDesignCompact(z[1]);
 const m=/[#&]w=([A-Za-z0-9\-_]+)/.exec(h);
 return m?decodeDesign(m[1]):null}