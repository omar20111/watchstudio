/* Part catalog: order, ids, variants and display names. */
import {caseOf} from './geometry.js';

export const PARTS=[['strap','Strap'],['case','Case'],['bezel','Bezel'],['dial','Dial'],['markers','Markers'],['hands','Hands'],['crown','Crown'],['crystal','Crystal']];

/* layers drawn from another part's material — not user-selectable components */
export const PART_SRC={rehaut:'case'};
export const srcOf=p=>PART_SRC[p]||p;

export const VARIANTS={
 strap:['leather','rubber','steel','nato'],
 case:['classic','sport'],
 bezel:['smooth','fluted','diver','gmt','tachy'],
 dial:['sunburst','matte','chrono','guilloche','fume'],
 markers:['batons','dots','roman','arabic','minimal'],
 hands:['dauphine','baton','sword','mercedes','leaf'],
 crown:['standard','oversized'],
 crystal:['flat','dome','box']};

export const VNAME={leather:'Leather',rubber:'Rubber',steel:'Bracelet',nato:'NATO',classic:'Classic',sport:'Sport / Guards',smooth:'Smooth',fluted:'Fluted',diver:'Diver',gmt:'GMT',tachy:'Tachymeter',sunburst:'Sunburst',matte:'Matte',chrono:'Chrono',guilloche:'Guilloché',fume:'Fumé',batons:'Batons',dots:'Dots',roman:'Roman',arabic:'Arabic',minimal:'Minimal',dauphine:'Dauphine',baton:'Baton',sword:'Sword',mercedes:'Mercedes',leaf:'Leaf',standard:'Standard',oversized:'Oversized',flat:'Flat',dome:'Domed',box:'Box'};

/* The value a preset row shows as selected, and what clicking a preset writes.
   A crystal's shape is case architecture — it sits in the thickness stack — so
   its presets read and write case.crystal. There is no second crystal-shape
   field to drift out of step with it. */
export const variantOf=(part,d)=>part==='crystal'?caseOf(d).crystal:d.parts[part].variant;
export function applyVariant(n,part,v){
 if(part==='crystal')n.case={...n.case,crystal:v};
 else n.parts[part].variant=v}
