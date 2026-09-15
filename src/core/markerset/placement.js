/* Where an index sits on the dial.

   Dial plane: x toward 3 o'clock, z toward 6 o'clock, y up out of the dial (the
   three.js scene uses exactly this, so 12 o'clock is -z). An hour's angle runs
   clockwise from 12. */

/* a shape's local origin (the middle of its outer end) goes on the hour ring and
   its local +y, turned by rotY about the dial's axis, points at the centre */
export function placeShape(h,ringR){const a=h*Math.PI/6;
 return{x:ringR*Math.sin(a),z:-ringR*Math.cos(a),rotY:-a}}

/* A numeral is placed by its ink, not its text box: upright, it slides along
   the hour's direction until its farthest inked point touches the ring (VIII's
   box corners are empty, so a box would stand it too far in at the diagonals);
   radial, it turns with the hour and the top of its ink touches the ring;
   readable, the numerals from 4 to 8 turn the other way round, so they read
   right way up, and the foot of their ink touches the ring instead.
   `ink`: glyph-centred points in mm, x right, y down. `orient` is 'upright',
   'radial' or 'readable' (or, from older callers, true for upright). */
export function placeNumeral(h,ringR,ink,orient){const a=h*Math.PI/6,ux=Math.sin(a),uy=-Math.cos(a);
 const mode=orient===true||orient==null?'upright':orient===false?'radial':orient;
 const turned=mode==='readable'&&h>=4&&h<=8;
 if(!ink||!ink.length){const c=ringR*.85;return{x:c*ux,z:c*uy,rotY:mode==='upright'?0:turned?Math.PI-a:-a}}
 if(mode!=='upright'){let minY=0,maxY=0;for(const p of ink){if(p[1]<minY)minY=p[1];if(p[1]>maxY)maxY=p[1]}
  const c=turned?ringR-maxY:ringR+minY;return{x:c*ux,z:c*uy,rotY:turned?Math.PI-a:-a}}
 const far=c=>{let m=0;for(const[vx,vy]of ink){const d=Math.hypot(c*ux+vx,c*uy+vy);if(d>m)m=d}return m};
 let lo=0,hi=ringR;
 for(let i=0;i<30;i++){const mid=(lo+hi)/2;if(far(mid)>ringR)hi=mid;else lo=mid}
 return{x:lo*ux,z:lo*uy,rotY:0}}

/* the 2D equivalent for SVG drawings: a transform placing a local-frame outline */
export function svgTransformOf(p){return`translate(${p.x.toFixed(4)} ${p.z.toFixed(4)}) rotate(${(-p.rotY*180/Math.PI).toFixed(4)})`}
