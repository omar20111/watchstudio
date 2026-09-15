/* The artwork painters + their shared option builder.

   These paint the flat artwork the 3D watch is dressed in — dial, markers,
   hands, bezel, strap and caseback — as textures, as silhouettes to trace into
   solids, and as the per-part files of the layered export and the tech pack.
   The case, crown and crystal are solids, drawn only in 3D. */
import {clone} from '../utils.js';
import {geoOf,caseOf,outlinesOf,dialLayoutOf,dialDayOf,handLengthsOf,strapReachPx,dialTextOf} from '../geometry.js';
import {srcOf} from '../parts.js';
import {drStrap} from './strap.js';
import {drBezel} from './bezel.js';
import {drDial} from './dial.js';
import {drMarkers} from './markers.js';
import {drHand} from './hands.js';
import {drCaseback} from './caseback.js';

export const DR={strap:drStrap,bezel:drBezel,dial:drDial,markers:drMarkers,hands:drHand,caseback:drCaseback};

/* options object passed to every part renderer.

   `mode` picks what the bake is for:
     undefined -> the painted artwork, lit by the studio rig (preset thumbnails,
                  layered export artwork)
     'flat'    -> the same artwork with no painted light or shadow, for use as
                  a texture under real 3D lighting
     'shape'   -> an opaque white silhouette, traced into extruded geometry
     'lume'    -> only the luminous compound, laid over that geometry
     'print'   -> only printing/engraving, as a decal on a lathed surface */
export function procOpts(part,d,sub,mode){const src=srcOf(part);const arch=caseOf(d);
 return{g:geoOf(d),arch,...clone(d.parts[src]),which:sub,hand:sub,mode,
  /* the dial plate's layout (date window, registers, chapter step) and the day
     on its date wheel: the dial draws them, the markers make room for them */
  layout:dialLayoutOf(d),day:dialDayOf(d),
  /* the hands' lengths, set by the markers and the minute track they point at */
  handLen:src==='hands'?handLengthsOf(d):null,
  /* where a 3D strap piece ends, px from the centre */
  strapReach:src==='strap'&&mode==='flat'&&sub?strapReachPx(d,sub):null,
  /* the dial's printing at its sizes in mm (geometry.js dialTextOf) */
  printing:src==='dial'?dialTextOf(d):null,
  /* the bezel's outline as built: its shape, and how far it reaches toward 3 in mm */
  bezelOutline:src==='bezel'?(B=>({kind:B.kind,A0:B.A0}))(outlinesOf(d).bezel):null,
  secColor:d.parts.hands.secColor,dialColor:d.parts.dial.color,
  frameMetal:d.parts.hands.metal,
  lume:d.parts[src].lume||d.parts.markers.lume}}
