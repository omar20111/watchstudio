/* Part catalog: order, ids, variants and display names. */

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
 crystal:['dome','flat']};

export const VNAME={leather:'Leather',rubber:'Rubber',steel:'Bracelet',nato:'NATO',classic:'Classic',sport:'Sport / Guards',smooth:'Smooth',fluted:'Fluted',diver:'Diver',gmt:'GMT',tachy:'Tachymeter',sunburst:'Sunburst',matte:'Matte',chrono:'Chrono',guilloche:'Guilloché',fume:'Fumé',batons:'Batons',dots:'Dots',roman:'Roman',arabic:'Arabic',minimal:'Minimal',dauphine:'Dauphine',baton:'Baton',sword:'Sword',mercedes:'Mercedes',leaf:'Leaf',standard:'Standard',oversized:'Oversized',dome:'Domed',flat:'Flat'};
