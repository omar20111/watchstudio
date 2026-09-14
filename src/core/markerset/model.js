/* The marker design, as data.

   Everything is real millimetres, like WatchStudio: a design is a dial, a few
   marker STYLES, and twelve SLOTS saying which style sits at each hour. One style
   is usually the ordinary hour index and another the 12 o'clock one; a 3-6-9
   dial gives the quarters a numeral style.

   normalizeDesign() is the single gate every design passes through — a stored
   project, a shared link, an opened file — so the renderers can trust every
   number they read. */

export const SCHEMA=1;

/* What an index can be made of. `kind` picks the 3D material model: metal is a
   conductor, paint a flat printed ink (colour from style.paint), lume a block of
   luminous compound. Colours match WatchStudio's METALS so a marker designed
   here looks the same when it is placed on a watch there. */
export const MATERIALS={
 steel:{name:'Steel',kind:'metal',base:'#c9ced6',hi:'#f6f8fb',lo:'#767d88',rough:.12},
 white:{name:'White gold',kind:'metal',base:'#dfe2e6',hi:'#ffffff',lo:'#8d9299',rough:.1},
 gold:{name:'Yellow gold',kind:'metal',base:'#e3bf6e',hi:'#ffefb0',lo:'#9a752e',rough:.13},
 rose:{name:'Rose gold',kind:'metal',base:'#e0aa8c',hi:'#ffe3d1',lo:'#9c6a50',rough:.14},
 black:{name:'Black DLC',kind:'metal',base:'#43474d',hi:'#8a8f96',lo:'#1b1d20',rough:.34},
 blued:{name:'Blued steel',kind:'metal',base:'#2f4fa8',hi:'#8fb0ff',lo:'#15254f',rough:.16},
 paint:{name:'Printed',kind:'paint',base:'#f2efe6',hi:'#ffffff',lo:'#b9b5aa',rough:.5},
 lume:{name:'Solid lume',kind:'lume',base:'#e8f2df',hi:'#ffffff',lo:'#b8c4ae',rough:.6}};

export const FINISHES=['polished','brushed','frosted'];
export const OUTLINES=['baton','wedge','dagger','arrow','lozenge','dot','custom'];
export const ENDS=['flat','round','point'];
export const TOPS=['flat','bevel','facet','dome'];
export const NUMERAL_SYSTEMS=['arabic','roman','eastern'];
export const FONTS=['serif','sans','condensed','didone'];
export const DIAL_FINISHES=['sunburst','matte','gloss','grained'];
export const TRACKS=['railway','dots','none'];

/* luminous compounds, by the colour they show in daylight */
export const LUME_COLORS=[['#e8f2df','C3 green'],['#eef3f7','BGW9 blue'],['#f1e2bd','Vintage'],['#ffb14a','Orange']];

/* The dial's rings, in dial radii, shared with WatchStudio's geometry: the minute
   track runs in from TRACK_R and every index ends on INDEX_OUTER, so a style's
   length changes the index, never where the hour ring sits. */
export const TRACK_R=.965, INDEX_OUTER=.885;

let seq=0;
export const newId=()=>'s'+Date.now().toString(36)+(++seq).toString(36);

export const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
const num=(v,lo,hi,fb)=>{const n=+v;return Number.isFinite(n)?clamp(n,lo,hi):fb};
const pick=(v,list,fb)=>list.includes(v)?v:fb;
const hex=(v,fb)=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)?v.toLowerCase():fb;

export function defaultStyle(o={}){
 return normalizeStyle({id:newId(),name:'Hours',kind:'shape',outline:'baton',
  lengthMm:2.8,widthMm:.9,taper:1,outerEnd:'flat',innerEnd:'flat',cornerMm:.04,flip:false,
  points:[[0,1],[1,1]],count:1,gapMm:.35,
  numerals:'arabic',font:'sans',sizeMm:2.6,weight:700,upright:true,
  top:'bevel',heightMm:.32,bevel:.4,
  material:'steel',finish:'polished',paint:'#f2efe6',
  lume:'channel',lumeMarginMm:.06,lumeColor:'#e8f2df',...o})}

export function normalizeStyle(s={}){
 const outline=pick(s.outline,OUTLINES,'baton');
 /* kept in drawing order, not sorted: an arrow's barb runs back up the index */
 const pts=Array.isArray(s.points)?s.points.filter(p=>Array.isArray(p)&&p.length===2)
  .map(([t,w])=>[num(t,0,1,0),num(w,0,1,1)]).slice(0,24):[];
 return{id:typeof s.id==='string'&&s.id?s.id.slice(0,40):newId(),
  name:String(s.name??'Style').slice(0,32),
  kind:s.kind==='numeral'?'numeral':'shape',
  outline,
  lengthMm:num(s.lengthMm,.3,8,2.8),
  widthMm:num(s.widthMm,.2,4,.9),
  taper:num(s.taper,0,1.6,1),
  outerEnd:pick(s.outerEnd,ENDS,'flat'),innerEnd:pick(s.innerEnd,ENDS,'flat'),
  cornerMm:num(s.cornerMm,0,1,.04),
  flip:!!s.flip,
  points:pts.length>=2?pts:[[0,1],[1,1]],
  count:s.count==2?2:1,
  gapMm:num(s.gapMm,.05,2,.35),
  numerals:pick(s.numerals,NUMERAL_SYSTEMS,'arabic'),
  font:pick(s.font,FONTS,'sans'),
  sizeMm:num(s.sizeMm,.8,6,2.6),
  weight:+s.weight===400?400:700,
  upright:s.upright!==false,
  top:pick(s.top,TOPS,'bevel'),
  heightMm:num(s.heightMm,.02,1.2,.32),
  bevel:num(s.bevel,.05,1,.4),
  material:MATERIALS[s.material]?s.material:'steel',
  finish:pick(s.finish,FINISHES,'polished'),
  paint:hex(s.paint,'#f2efe6'),
  lume:s.lume==='channel'?'channel':'none',
  lumeMarginMm:num(s.lumeMarginMm,0,1,.06),
  lumeColor:hex(s.lumeColor,'#e8f2df')}}

export function defaultDial(o={}){
 return normalizeDial({diameterMm:31,color:'#18304d',finish:'sunburst',track:'railway',ringMm:null,trackInk:null,case:true,...o})}

export function normalizeDial(d={}){
 const diameterMm=num(d.diameterMm,16,50,31);
 return{diameterMm,
  color:hex(d.color,'#18304d'),
  finish:pick(d.finish,DIAL_FINISHES,'sunburst'),
  track:pick(d.track,TRACKS,'railway'),
  /* the circle the indices end on, as a radius in mm; null follows the dial */
  ringMm:d.ringMm==null?null:num(d.ringMm,diameterMm*.25,diameterMm*.5,diameterMm/2*INDEX_OUTER),
  trackInk:d.trackInk==null?null:hex(d.trackInk,null),
  case:d.case!==false}}

export const ringOf=dial=>dial.ringMm??dial.diameterMm/2*INDEX_OUTER;

/* relative luminance of a #rrggbb colour */
export const lumOf=hex=>{const n=parseInt(hex.slice(1),16),c=[n>>16&255,n>>8&255,n&255].map(v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)});
 return .2126*c[0]+.7152*c[1]+.0722*c[2]};
/* the minute track is printed dark on a light dial and cream on a dark one */
export const trackInkOf=dial=>dial.trackInk||(lumOf(dial.color)>.28?'#1c1e22':'#ebe7dc');

export function normalizeDesign(d){
 if(!d||typeof d!=='object')return null;
 const styles=(Array.isArray(d.styles)?d.styles:[]).slice(0,12).map(normalizeStyle);
 /* ids must be unique for slots to mean anything */
 const seen=new Set();for(const s of styles){while(seen.has(s.id))s.id=newId();seen.add(s.id)}
 if(!styles.length)styles.push(defaultStyle());
 const ids=new Set(styles.map(s=>s.id));
 const slots=Array.from({length:12},(_,h)=>{const v=Array.isArray(d.slots)?d.slots[h]:styles[0].id;
  return v===''||v===null?'':ids.has(v)?v:styles[0].id});
 return{v:SCHEMA,name:String(d.name??'Untitled markers').slice(0,60),
  dial:normalizeDial(d.dial),styles,slots}}

export const styleAt=(d,h)=>d.styles.find(s=>s.id===d.slots[h])||null;

/* ---------------------------------------------------------------- numerals */

const EASTERN='٠١٢٣٤٥٦٧٨٩';
export const easternDigits=n=>String(n).replace(/\d/g,c=>EASTERN[+c]);
const ROMAN=['XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI'];
export function numeralText(style,h){const n=h===0?12:h;
 return style.numerals==='roman'?ROMAN[h]:style.numerals==='eastern'?easternDigits(n):String(n)}

/* Each family is stacked with fallbacks that exist on Windows, macOS, iOS and
   Android, so a numeral is never drawn in a default face. Eastern Arabic digits
   need an Arabic face: Geeza Pro on Apple, Noto Naskh on Android, Segoe UI on
   Windows. */
export const FONT_STACKS={
 serif:'Georgia,"Times New Roman",Times,serif',
 sans:'"Helvetica Neue",Helvetica,Arial,system-ui,sans-serif',
 condensed:'"Arial Narrow","Roboto Condensed","Helvetica Neue Condensed",sans-serif-condensed,Arial,sans-serif',
 didone:'Didot,"Bodoni 72","Bodoni MT","Playfair Display",Georgia,serif'};
export const EASTERN_STACK='"Geeza Pro","Noto Naskh Arabic","Segoe UI",Tahoma,Arial,sans-serif';
export const fontStackOf=style=>style.numerals==='eastern'?EASTERN_STACK:FONT_STACKS[style.font];
