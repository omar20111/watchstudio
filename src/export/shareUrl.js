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

export function encodeDesign(d,name){
 const payload={app:'WatchStudio',schemaVersion:SCHEMA_VERSION,name,d:{...d,bgCustom:null,active:{}}};
 return b64url(new TextEncoder().encode(JSON.stringify(payload)))}

export function decodeDesign(code){
 try{const json=new TextDecoder().decode(unb64url(code));
  const o=migrateProject(JSON.parse(json));
  if(!o||!o.d||!o.d.parts)return null;
  return{d:hydrate(o.d,o.schemaVersion),name:o.name||'Shared watch'}}
 catch(e){return null}}

export function shareLink(){const st=store.getState();
 const code=encodeDesign(st.d,st.projName);
 const base=location.origin+location.pathname;
 return `${base}#w=${code}`}

export async function copyShareLink(){
 const url=shareLink();
 try{await navigator.clipboard.writeText(url);toast('Share link copied')}
 catch(e){
  /* clipboard is permission-gated; fall back to a selectable prompt so the
     link is still obtainable rather than silently lost */
  window.prompt('Copy this share link',url)}
 return url}

/* Read a shared design out of the URL on boot, if there is one. */
export function readShareFromLocation(){
 const m=/[#&]w=([A-Za-z0-9\-_]+)/.exec(location.hash||'');
 if(!m)return null;
 return decodeDesign(m[1])}
