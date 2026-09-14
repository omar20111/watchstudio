/* Part catalog: order, ids, variants and display names. */
import {caseOf} from './geometry.js';

export const PARTS=[['strap','Strap'],['case','Case'],['bezel','Bezel'],['dial','Dial'],['markers','Markers'],['hands','Hands'],['crown','Crown'],['crystal','Crystal']];

/* layers drawn from another part's material — not user-selectable components */
export const PART_SRC={rehaut:'case',caseback:'case'};
export const srcOf=p=>PART_SRC[p]||p;

export const VARIANTS={
 strap:['leather','rubber','steel','nato','mesh'],
 case:['classic','sport'],
 bezel:['smooth','fluted','coin','diver','gmt','tachy'],
 dial:['sunburst','matte','chrono','guilloche','fume','enamel','tapisserie'],
 markers:['batons','dots','roman','arabic','eastern','wedges','minimal'],
 hands:['dauphine','baton','sword','mercedes','leaf','cathedral','syringe','arrow'],
 crown:['standard','oversized'],
 crystal:['flat','dome','box']};

export const VNAME={leather:'Leather',rubber:'Rubber',steel:'Bracelet',nato:'NATO',mesh:'Milanese',classic:'Classic',sport:'Sport / Guards',smooth:'Smooth',fluted:'Fluted',coin:'Coin edge',diver:'Diver',gmt:'GMT',tachy:'Tachymeter',sunburst:'Sunburst',matte:'Matte',chrono:'Chrono',guilloche:'Guilloché',fume:'Fumé',enamel:'Enamel',tapisserie:'Tapisserie',batons:'Batons',dots:'Dots',roman:'Roman',arabic:'Numerals',eastern:'Arabic ١٢',partstudio:'PartStudio set',wedges:'Wedges',minimal:'Minimal',dauphine:'Dauphine',baton:'Baton',sword:'Sword',mercedes:'Mercedes',leaf:'Leaf',cathedral:'Cathedral',syringe:'Syringe',arrow:'Broad arrow',standard:'Standard',oversized:'Oversized',flat:'Flat',dome:'Domed',box:'Box'};

/* The value a preset row shows as selected, and what clicking a preset writes.
   A crystal's shape is case architecture — it sits in the thickness stack — so
   its presets read and write case.crystal. There is no second crystal-shape
   field to drift out of step with it. */
export const variantOf=(part,d)=>part==='crystal'?caseOf(d).crystal:d.parts[part].variant;
export function applyVariant(n,part,v){
 if(part==='crystal')n.case={...n.case,crystal:v};
 else n.parts[part].variant=v}
