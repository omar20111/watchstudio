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

/* options object passed to every part renderer */
export function procOpts(part,d,sub){const src=srcOf(part);const arch=caseOf(d);
 return{g:geoOf(d),arch,pushers:arch.pushers,...clone(d.parts[src]),which:sub,hand:sub,
  secColor:d.parts.hands.secColor,dialColor:d.parts.dial.color,
  frameMetal:d.parts.hands.metal,crownAng:crownAng(d),
  lume:d.parts[src].lume||d.parts.markers.lume}}
