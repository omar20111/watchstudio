/* View in AR: the design at real size, in the room.

   What the dialog offers depends on the device (core/three/ar.js):
   - Android Chrome with ARCore: start a WebXR session here; tap a surface to
     place the watch, tap again to move it.
   - iPhone / iPad Safari: build a USDZ and open it in AR Quick Look.
   - A computer, or a phone browser without AR: a QR code of the share link, so
     the design opens on a phone in one scan. */
import React from 'react';
import {createPortal,flushSync} from 'react-dom';
import qrcode from 'qrcode-generator';
import {store,useApp} from '../state/store.js';
import {Modal} from './primitives.jsx';
import {arSupport,openQuickLook,startWebXR} from '../core/three/ar.js';
import {shareLink} from '../export/shareUrl.js';
import {exportWatch} from '../export/glb.js';
import {designToUSDZ} from '../export/usdz.js';
import {toast} from '../core/utils.js';
const {useEffect,useRef,useState}=React;

/* a QR code as SVG, or null when the text is too long to encode */
function QR({text,size=300}){
 let qr=null;try{qr=qrcode(0,'L');qr.addData(text,'Byte');qr.make()}catch(e){qr=null}
 if(!qr)return null;
 const n=qr.getModuleCount();let d='';
 for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(qr.isDark(r,c))d+=`M${c} ${r}h1v1h-1z`;
 return<svg role="img" aria-label="QR code linking to this design" width={size} height={size} viewBox={`-3 -3 ${n+6} ${n+6}`}
  shapeRendering="crispEdges" className="rounded-lg block mx-auto"><rect x="-3" y="-3" width={n+6} height={n+6} fill="#fff"/><path d={d} fill="#000"/></svg>}

const STATUS={preparing:'Starting AR…',searching:'Move your phone slowly to find a table or desk',
 ready:'Tap to place the watch',placed:'Tap elsewhere to move it · hold your wrist beside it to compare'};

export function ARModal({onClose}){const s=useApp();
 const[mode,setMode]=useState('probing');         /* probing | webxr | quicklook | none */
 const[link,setLink]=useState('');
 const[busy,setBusy]=useState(false);
 const[err,setErr]=useState('');
 const[xr,setXr]=useState(null);                   /* the live session's status, while one runs */
 const overlay=useRef(),session=useRef(null);
 const phone=typeof matchMedia!=='undefined'&&matchMedia('(pointer: coarse)').matches;
 const uploads=Object.values(s.d.active||{}).some(Boolean);

 useEffect(()=>{let live=true;
  arSupport().then(m=>{if(live)setMode(m||'none')});
  shareLink().then(l=>{if(live)setLink(l)});
  return()=>{live=false;if(session.current)session.current.end().catch(()=>{})}},[]);

 /* taps on the overlay's own buttons must not also place the watch */
 useEffect(()=>{const el=overlay.current;if(!el)return;
  const stop=e=>{if(e.target.closest('button'))e.preventDefault()};
  el.addEventListener('beforexrselect',stop);return()=>el.removeEventListener('beforexrselect',stop)},[mode]);

 const startXR=async()=>{setErr('');
  /* the overlay must be showing before the session asks for it, and the request
     must stay inside this tap */
  flushSync(()=>setXr('preparing'));
  try{session.current=await startWebXR({overlay:overlay.current,design:()=>store.getState().d,
   build:()=>{const st=store.getState();return exportWatch(st.d,st.customs)},
   onState:setXr,onEnd:()=>{session.current=null;setXr(null)}})}
  catch(e){console.error('WatchStudio: AR session failed',e);setXr(null);
   setErr('AR could not start on this device. Check that Google Play Services for AR is installed, and that the camera is allowed for this site.')}};

 const openQL=async()=>{setErr('');setBusy(true);
  try{const st=store.getState();
   openQuickLook(await designToUSDZ(st.d,st.customs),st.projName.replace(/\s+/g,'_'))}
  catch(e){console.error('WatchStudio: USDZ export failed',e);setErr('The AR model could not be built on this device.')}
  finally{setBusy(false)}};

 return<>
  <Modal title="View in AR" onClose={onClose}>
   {mode==='probing'&&<p className="text-[12px] text-neutral-400">Checking what this device supports…</p>}
   {(mode==='webxr'||mode==='quicklook')&&<div className="space-y-3 text-[12px] text-neutral-300">
    <p>See this watch in your room at its real size — {s.d.caseMm} mm across. Put it on a table, walk around it,
     and hold your wrist next to it.</p>
    {uploads&&<p className="text-[11px] text-amber-400">Uploaded images are shown as flat pictures in AR.</p>}
    {mode==='webxr'
     ?<button className="goldbtn w-full" onClick={startXR} disabled={!!xr}>Start AR</button>
     :<button className="goldbtn w-full" onClick={openQL} disabled={busy}>{busy?'Building the AR model…':'Open in AR'}</button>}
    {mode==='quicklook'&&<p className="text-[11px] text-neutral-500">Opens in Apple’s AR viewer. Building the model takes a few seconds.</p>}
   </div>}
   {mode==='none'&&<div className="space-y-3 text-[12px] text-neutral-300">
    {phone
     ?<p>This browser can’t show AR. On Android, open this page in Chrome (with Google Play Services for AR);
       on iPhone or iPad, open it in Safari.</p>
     :<>
      <p>AR needs a phone or tablet. Scan this with your phone’s camera to open this design there, then tap <b>View in AR</b>.</p>
      {link?(QR({text:link})||<p className="text-[11px] text-neutral-500">This design is too detailed for a QR code — copy the share link instead.</p>)
       :<p className="text-[11px] text-neutral-500">Making the link…</p>}
      <p className="text-[11px] text-neutral-500">Works with Chrome on Android and Safari on iPhone and iPad.
       {uploads&&' Uploaded images stay on this computer; the phone shows the built-in parts.'}</p>
      {link&&<button className="btn w-full" onClick={()=>navigator.clipboard.writeText(link).then(()=>toast('Link copied')).catch(()=>window.prompt('Copy this link',link))}>Copy link instead</button>}
     </>}
   </div>}
   {err&&<p role="status" className="mt-3 text-[11px] text-amber-400">{err}</p>}
  </Modal>
  {/* the WebXR DOM overlay: drawn over the camera view during a session */}
  {mode==='webxr'&&createPortal(
   <div ref={overlay} className="fixed inset-0 z-[200] pointer-events-none flex flex-col justify-between p-4"
    style={{display:xr?'flex':'none'}}>
    <div className="self-center mt-6 rounded-full bg-black/60 px-4 py-2 text-[13px] text-white text-center">{STATUS[xr]||''}</div>
    <button className="pointer-events-auto self-center mb-8 rounded-full bg-black/70 border border-white/20 px-6 py-3 text-white text-sm"
     onClick={()=>session.current&&session.current.end()}>Exit AR</button>
   </div>,document.body)}
 </>}
