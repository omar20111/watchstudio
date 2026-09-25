/* The device the watch is drawn on. A phone draws it a few hundred pixels
   across on the slowest processor the site runs on, so what is baked, traced
   and lit for it is only as fine as its screen shows (watch.js ART_SCALE and
   SHAPE_SCALE, studio.js studioEnvironment). A tablet counts as a computer. */
export const PHONE=typeof matchMedia==='function'&&matchMedia('(pointer: coarse)').matches
 &&typeof screen!=='undefined'&&Math.min(screen.width,screen.height)<600;
