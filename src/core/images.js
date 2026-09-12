/* Image vault.

   Uploaded part images and wrist photos are megabytes each. They used to be
   stringified into localStorage on every autosave, which meant the FIRST jpeg
   blew the ~5 MB quota, autosave died, and the user was told once — quietly —
   and then lost everything they did afterwards.

   Blobs live here in IndexedDB instead. State keeps only `{id, name}`; the
   object URL is resolved at boot and held in memory, never persisted.

   Every call resolves rather than rejects: a browser in private mode with IDB
   disabled must degrade to "images unavailable" with a visible banner, not to
   a crashed app. `vaultStatus()` is what the banner reads. */

const DB='watchstudio',STORE='images',VER=1;
let dbp=null,broken=null,dbOpen=false;

function open(){
 if(dbp)return dbp;
 dbp=new Promise(res=>{
  let req;
  try{req=indexedDB.open(DB,VER)}catch(e){broken='IndexedDB is unavailable in this browser context';return res(null)}
  req.onupgradeneeded=()=>{const db=req.result;
   if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE)};
  req.onsuccess=()=>{dbOpen=true;res(req.result)};
  req.onerror=()=>{broken='The image vault could not be opened';res(null)};
  req.onblocked=()=>{broken='The image vault is blocked by another tab';res(null)};
 });
 return dbp}

function tx(mode,fn){return open().then(db=>{
 if(!db)return null;
 return new Promise(res=>{
  let t;
  try{t=db.transaction(STORE,mode)}catch(e){broken='The image vault rejected a transaction';return res(null)}
  const req=fn(t.objectStore(STORE));
  t.oncomplete=()=>res(req?req.result:null);
  t.onerror=t.onabort=()=>{broken='An image could not be read or written';res(null)}})})}

export const put=(id,blob)=>tx('readwrite',s=>s.put(blob,id));
export const get=id=>tx('readonly',s=>s.get(id));
export const del=id=>tx('readwrite',s=>s.delete(id));
export const allKeys=()=>tx('readonly',s=>s.getAllKeys());

/* the object URLs handed to <img>. Runtime only — never serialised. */
const urls=new Map();
export const urlFor=id=>urls.get(id)||null;
export function holdURL(id,blob){
 const prev=urls.get(id);if(prev)URL.revokeObjectURL(prev);
 const u=URL.createObjectURL(blob);urls.set(id,u);return u}
export function release(id){const u=urls.get(id);if(u)URL.revokeObjectURL(u);urls.delete(id)}

/* dataURL <-> Blob, for project files that carry their images inline */
export async function toBlob(dataUrl){
 try{return await(await fetch(dataUrl)).blob()}catch(e){return null}}
export function toDataURL(blob){return new Promise(res=>{
 if(!blob)return res(null);
 const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>res(null);r.readAsDataURL(blob)})}

/* Store an upload and return the id the design will reference. */
export async function save(id,source){
 const blob=typeof source==='string'?await toBlob(source):source;
 if(!blob){broken='That image could not be read';return null}
 const ok=await put(id,blob);
 if(ok===null&&broken)return null;
 holdURL(id,blob);return id}

/* Resolve every id a design references. Returns the ids that are MISSING so
   the caller can tell the user which parts lost their artwork rather than
   silently drawing the procedural fallback and pretending nothing happened. */
export async function resolve(ids){
 const missing=[];
 for(const id of ids){
  if(urls.has(id))continue;
  const blob=await get(id);
  if(blob)holdURL(id,blob);else missing.push(id)}
 return missing}

export function vaultStatus(){return{ok:!broken,message:broken}}
/* A retry has to be able to succeed: forget the error, and if the database
   never opened (blocked by another tab, say), drop the cached failed open so
   the next call really tries again. */
export function clearStatus(){broken=null;if(!dbOpen)dbp=null}
