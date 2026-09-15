/* A preset's picture in the Presets row.

   Artwork parts show their painted bake (cache.js getThumb). The case and crown
   are solids, drawn only in 3D, so theirs are small stills of the design with
   that preset applied (view.js presetStill), rendered one at a time and kept;
   the last picture stays up while a changed design re-renders. A crystal is
   clear glass, which no picture of the whole watch tells apart, so it is drawn
   as its profile on the bezel. */
import React from 'react';
import {getThumb} from '../core/cache.js';
import {applyVariant} from '../core/parts.js';
import {clone} from '../core/utils.js';
import {marketingClock} from '../core/time.js';
import {headKey} from '../core/three/watch.js';
import {presetStill} from '../core/three/view.js';
import {webglState} from '../core/three/support.js';
const {useEffect,useState}=React;

const SOLID=['case','crown'];
const stills=new Map();                           /* key -> data URL, or the render on its way */
const variantDesign=(part,v,d)=>{const dv=clone(d);applyVariant(dv,part,v);dv.shadow=false;return dv};
const keyOf=(part,dv)=>part+'|'+headKey(dv,{});

function still(part,dv,key){
 if(!stills.has(key)){
  stills.set(key,presetStill(dv,part,{size:120,clock:marketingClock(dv)})
   .then(url=>{stills.set(key,url);return url},e=>{stills.delete(key);console.warn('WatchStudio: preset picture failed',e);return null}));
  if(stills.size>24)stills.delete(stills.keys().next().value)}
 return stills.get(key)}

function Solid({part,v,d}){const dv=variantDesign(part,v,d),key=keyOf(part,dv);
 const[url,setUrl]=useState(()=>typeof stills.get(key)==='string'?stills.get(key):null);
 useEffect(()=>{if(!webglState().ok)return;let alive=true;
  Promise.resolve(still(part,dv,key)).then(u=>{if(alive&&u)setUrl(u)});
  return()=>{alive=false}},[key]);
 return url?<img src={url} className="w-14 h-14 object-cover" alt={v}/>:<span className="block w-14 h-14" aria-label={v}/>}

const GLASS={flat:'M15 32 V29 H45 V32 Z',dome:'M15 32 V29 Q30 15 45 29 V32 Z',box:'M15 32 V20 Q15 17 18 17 H42 Q45 17 45 20 V32 Z'};
function Crystal({v}){
 return<svg viewBox="0 0 60 60" className="block w-14 h-14" role="img" aria-label={v}>
  <path d="M4 46 V35 H12 V32 H48 V35 H56 V46 Z" fill="#7d828b"/>
  <path d="M12 32 H48" stroke="#b9bec6" strokeWidth="1"/>
  <path d={GLASS[v]||GLASS.flat} fill="#a9cbe9" fillOpacity=".3" stroke="#d6e8f7" strokeWidth="1.2" strokeLinejoin="round"/>
 </svg>}

export function PresetThumb({part,v,d}){
 if(part==='crystal')return<Crystal v={v}/>;
 if(SOLID.includes(part))return<Solid part={part} v={v} d={d}/>;
 return<img src={getThumb(part,v,d)} className="w-14 h-14 object-cover" alt={v}/>}
