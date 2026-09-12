/* Renderer registry + shared option builder. */
import {clone} from '../utils.js';
import {geoOf,crownAng,caseOf} from '../geometry.js';
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

export const DR={strap:drStrap,case:drCase,crown:drCrown,bezel:drBezel,rehaut:drRehaut,dial:drDial,markers:drMarkers,hands:drHand,crystal:drCrystal};

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
  secColor:d.parts.hands.secColor,dialColor:d.parts.dial.color,
  frameMetal:d.parts.hands.metal,crownAng:crownAng(d),
  lume:d.parts[src].lume||d.parts.markers.lume}}
