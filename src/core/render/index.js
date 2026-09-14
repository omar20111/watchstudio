/* Renderer registry + shared option builder. */
import {clone} from '../utils.js';
import {geoOf,crownAng,caseOf,dialLayoutOf,dialDayOf,handLengthsOf,strapReachPx,cyclopsOf,dialTextOf} from '../geometry.js';
import {srcOf} from '../parts.js';
import {drStrap} from './strap.js';
import {drCase} from './case.js';
import {drCrown} from './crown.js';
import {drBezel} from './bezel.js';
import {drRehaut} from './rehaut.js';
import {drDial} from './dial.js';
import {drMarkers} from './markers.js';
import {drHand} from './hands.js';
import {drCrystal} from './crystal.js';
import {drCaseback} from './caseback.js';

export const DR={strap:drStrap,case:drCase,crown:drCrown,bezel:drBezel,rehaut:drRehaut,dial:drDial,markers:drMarkers,hands:drHand,crystal:drCrystal,caseback:drCaseback};

/* options object passed to every part renderer.

   `mode` picks what the bake is for:
     undefined -> the painted 2D drawing, lit by the studio rig (thumbnails,
                  layered export artwork)
     'flat'    -> the same artwork with no painted light or shadow, for use as
                  a texture under real 3D lighting
     'shape'   -> an opaque white silhouette, traced into extruded geometry
     'lume'    -> only the luminous compound, laid over that geometry
     'print'   -> only printing/engraving, as a decal on a lathed surface */
export function procOpts(part,d,sub,mode){const src=srcOf(part);const arch=caseOf(d);
 return{g:geoOf(d),arch,pushers:arch.pushers,...clone(d.parts[src]),which:sub,hand:sub,mode,
  /* the dial plate's layout (date window, registers, chapter step) and the day
     on its date wheel: the dial draws them, the markers make room for them */
  layout:dialLayoutOf(d),day:dialDayOf(d),
  /* the hands' lengths, set by the markers and the minute track they point at */
  handLen:src==='hands'?handLengthsOf(d):null,
  /* where a 3D strap piece ends, px from the centre */
  strapReach:src==='strap'&&mode==='flat'&&sub?strapReachPx(d,sub):null,
  cyclops:src==='crystal'?cyclopsOf(d):null,
  /* the dial's printing at its sizes in mm (geometry.js dialTextOf) */
  printing:src==='dial'?dialTextOf(d):null,
  secColor:d.parts.hands.secColor,dialColor:d.parts.dial.color,
  frameMetal:d.parts.hands.metal,crownAng:crownAng(d),
  lume:d.parts[src].lume||d.parts.markers.lume}}
