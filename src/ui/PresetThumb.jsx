/* A preset's picture in the Presets row.

   Every part's picture is a small still of the design with that preset applied
   (view.js presetStill), framed on the part and rendered one at a time and kept;
   the last picture stays up while a changed design re-renders. They were the 2D
   painter's bakes for the artwork parts, lit in a way the 3D watch is not, so a
   dial or a strap picked from them looked different on the watch; the painted
   bake is still what shows where there is no WebGL. A crystal is clear glass,
   which no picture of the whole watch tells apart, so it is drawn as its profile
   on the bezel. */
import React from 'react';
import {getThumb} from '../core/cache.js';
import {applyVariant} from '../core/parts.js';
import {clone} from '../core/utils.js';
import {marketingClock} from '../core/time.js';
import {headKey} from '../core/three/watch.js';
import {presetStill} from '../core/three/view.js';
import {webglState} from '../core/three/support.js';
import {pointerFree} from './pointerHeld.js';
const {useEffect,useState,useRef}=React;

const SOLID=['case','crown','dial','markers','hands','bezel','strap'];
const stills=new Map();                           /* key -> data URL, or the render on its way */
/* Pictures render one after another. While a design is being edited its keys
   change faster than the pictures come, so a picture whose key is no longer on
   screen when its turn comes is skipped rather than rendered for nothing. None
   renders while a slider is held, either: each is a build of its own, and one
   per step froze the drag. */
const wanted=new Map();let chain=Promise.resolve();
const variantDesign=(part,v,d)=>{const dv=clone(d);applyVariant(dv,part,v);dv.shadow=false;return dv};
const keyOf=(part,dv)=>part+'|'+headKey(dv,{});

function still(part,dv,key){
 if(!stills.has(key)){
  const job=chain.then(pointerFree).then(()=>wanted.get(key)?presetStill(dv,part,{size:120,clock:marketingClock(dv)}):null)
   .then(url=>{if(url)stills.set(key,url);else stills.delete(key);return url},e=>{stills.delete(key);console.warn('WatchStudio: preset picture failed',e);return null});
  chain=job.then(()=>{},()=>{});stills.set(key,job);
  if(stills.size>90)stills.delete(stills.keys().next().value)}
 return stills.get(key)}

/* is the element on screen? A panel slid away in a drawer (a phone's), or
   scrolled out of sight, asks for no pictures: each is a build of its own, and
   on a phone they had taken seconds at startup and after every edit behind a
   closed drawer. Where there is no IntersectionObserver, always. */
function useOnScreen(ref){const[on,setOn]=useState(typeof IntersectionObserver==='undefined');
 useEffect(()=>{if(typeof IntersectionObserver==='undefined'||!ref.current)return;
  const io=new IntersectionObserver(es=>setOn(es.some(e=>e.isIntersecting)));io.observe(ref.current);return()=>io.disconnect()},[]);
 return on}

function Solid({part,v,d}){const dv=variantDesign(part,v,d),key=keyOf(part,dv),el=useRef(null),shown=useOnScreen(el);
 const[url,setUrl]=useState(()=>typeof stills.get(key)==='string'?stills.get(key):null);
 useEffect(()=>{if(!webglState().ok||!shown)return;let alive=true;
  wanted.set(key,(wanted.get(key)||0)+1);
  Promise.resolve(still(part,dv,key)).then(u=>{if(alive&&u)setUrl(u)});
  return()=>{alive=false;const n=(wanted.get(key)||1)-1;if(n>0)wanted.set(key,n);else wanted.delete(key)}},[key,shown]);
 /* one element throughout, so what is watched for being on screen stays in the page */
 return<span ref={el} className="block w-14 h-14" aria-label={url?undefined:v}>{url&&<img src={url} className="w-14 h-14 object-cover" alt={v}/>}</span>}

const GLASS={flat:'M15 32 V29 H45 V32 Z',dome:'M15 32 V29 Q30 15 45 29 V32 Z',box:'M15 32 V20 Q15 17 18 17 H42 Q45 17 45 20 V32 Z'};
function Crystal({v}){
 return<svg viewBox="0 0 60 60" className="block w-14 h-14" role="img" aria-label={v}>
  <path d="M4 46 V35 H12 V32 H48 V35 H56 V46 Z" fill="#7d828b"/>
  <path d="M12 32 H48" stroke="#b9bec6" strokeWidth="1"/>
  <path d={GLASS[v]||GLASS.flat} fill="#a9cbe9" fillOpacity=".3" stroke="#d6e8f7" strokeWidth="1.2" strokeLinejoin="round"/>
 </svg>}

/* A case or crown drawn as an outline, where the 3D pictures cannot be had in
   good time: drawn in software, each took seconds in a context of its own,
   and held up the page — a drag on the stage waited behind it for half a minute. */
function Outline({part,v}){const guards=part==='case'&&v==='sport',big=part==='crown'&&v==='oversized';
 return<svg viewBox="0 0 60 60" className="block w-14 h-14" role="img" aria-label={v}>
  {part==='case'?<>
   <path d="M22 6h16l2 10H20zM20 44h20l-2 10H22z" fill="#7d828b"/>
   <circle cx="30" cy="30" r="17" fill="#9aa0a8" stroke="#c9ced6" strokeWidth="1.5"/>
   <circle cx="30" cy="30" r="12" fill="#1b2a44"/>
   <rect x="46" y="27" width="5" height="6" rx="1" fill="#b9bec6"/>
   {guards&&<path d="M45 21l5 4v10l-5 4z" fill="#7d828b"/>}</>
  :<>
   <rect x="10" y="26" width="16" height="8" fill="#7d828b"/>
   <rect x="24" y={big?16:20} width={big?24:18} height={big?28:20} rx="3" fill="#b9bec6" stroke="#dde1e6" strokeWidth="1"/>
   {[...Array(big?7:5)].map((_,i)=><path key={i} d={`M${27+i*(big?3:3.2)} ${big?17:21}v${big?26:18}`} stroke="#8a9098" strokeWidth="1"/>)}</>}
 </svg>}

export function PresetThumb({part,v,d}){
 if(part==='crystal')return<Crystal v={v}/>;
 /* where there is no 3D, or only software drawing it (a picture a second), the
    artwork parts show their painted bakes and the case and crown an outline */
 const gl=webglState();
 if(SOLID.includes(part)&&gl.ok&&!gl.software)return<Solid part={part} v={v} d={d}/>;
 if(part==='case'||part==='crown')return<Outline part={part} v={v}/>;
 return<img src={getThumb(part,v,d)} className="w-14 h-14 object-cover" alt={v}/>}
