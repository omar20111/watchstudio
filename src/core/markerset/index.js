/* Marker sets from PartStudio.

   PartStudio (a sibling site) is a workshop for designing one watch part in
   depth; its first part is hour markers. A marker set is a few index STYLES —
   outlines or numerals in real millimetres, a ground relief, a metal, lume —
   and twelve SLOTS saying which style sits at each hour.

   The files beside this one (model, outline, raster, relief, glyphs,
   placement) are PartStudio's src/core, copied unchanged so a set grinds into
   exactly the solids it was designed as. Change them there first, then copy.

   Here: reading a set out of a design, a PartStudio file or a link, and the
   measurements the rest of WatchStudio needs (how deep the indices reach, for
   the hour hand; where the ring is). A set lives in parts.markers.set and is
   shown while parts.markers.variant is 'partstudio'. */
import {normalizeDesign,INDEX_OUTER,clamp} from './model.js';

export const MARKERSET_VARIANT='partstudio';

/* the set as stored: normalized, ids kept, the ring as a share of the dial radius */
export function normalizeSet(raw){
 if(!raw||typeof raw!=='object'||!Array.isArray(raw.styles)||!raw.styles.length)return null;
 const d=normalizeDesign({name:raw.name,styles:raw.styles,slots:raw.slots});
 if(!d)return null;
 const r=+raw.ringRatio;
 return{name:d.name,styles:d.styles,slots:d.slots,ringRatio:Number.isFinite(r)?clamp(r,.5,.98):INDEX_OUTER}}

/* Normalizing makes new objects, and the 2D bakes, the 3D build and the hand
   lengths all ask for the set of one design: remember the last few by content. */
const memo=new Map();
export function markerSetOf(d){const m=d&&d.parts&&d.parts.markers;
 if(!m||m.variant!==MARKERSET_VARIANT||!m.set)return null;
 const key=JSON.stringify(m.set);
 if(memo.has(key))return memo.get(key);
 const set=normalizeSet(m.set);memo.set(key,set);if(memo.size>16)memo.delete(memo.keys().next().value);
 return set}

/* A PartStudio file: the "WatchStudio markers" export, or a whole PartStudio
   markers project (its dial size tells where its hour ring was). */
export function setFromPartStudio(o){
 if(!o||typeof o!=='object'||o.app!=='PartStudio')return null;
 if(o.set)return normalizeSet({name:o.name,...o.set});
 if(o.part==='markers'&&o.d&&Array.isArray(o.d.styles)){const dial=o.d.dial||{},R=(+dial.diameterMm||31)/2;
  return normalizeSet({name:o.d.name,styles:o.d.styles,slots:o.d.slots,ringRatio:dial.ringMm!=null?+dial.ringMm/R:INDEX_OUTER})}
 return null}

/* how far in from the ring the deepest index reaches, mm — the hour hand's
   tip belongs at the inner end of the hour markers */
export function setDepthMm(set){let deep=0;
 for(const s of set.styles){if(!set.slots.includes(s.id))continue;
  const len=s.kind==='numeral'?s.sizeMm:s.outline==='dot'?s.widthMm:s.lengthMm;
  if(len>deep)deep=len}
 return deep}

/* ---------------------------------------------------------------- links */

/* #m=<deflated JSON of a PartStudio markers file>: PartStudio's "Open in
   WatchStudio" puts the set on whatever watch the visitor has open. */
const unb64url=str=>{const s=str.replace(/-/g,'+').replace(/_/g,'/'),bin=atob(s+'='.repeat((4-s.length%4)%4));
 return Uint8Array.from(bin,c=>c.charCodeAt(0))};
export async function readMarkerSetLink(hash){
 const m=/[#&]m=([A-Za-z0-9\-_]+)/.exec(hash||'');
 if(!m||typeof DecompressionStream==='undefined')return null;
 try{const bytes=await new Response(new Blob([unb64url(m[1])]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
  return setFromPartStudio(JSON.parse(new TextDecoder().decode(bytes)))}
 catch(e){return null}}
