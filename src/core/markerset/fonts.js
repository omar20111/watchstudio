/* The numeral faces, bundled.

   A numeral is whatever its font draws, so a system font makes the same design a
   different index on every device: Georgia or Garamond, Segoe UI's Arabic digits
   on Windows and Geeza Pro's on an iPhone. These faces travel with the site —
   only the files numerals need (Latin, or Arabic script) — and are loaded before
   anything measures or grinds a glyph. All SIL Open Font License 1.1, from
   Fontsource; see fonts/LICENSES.txt.

   Browser only: node never imports this. */
const FILES={
 'PS Garamond':[[400,new URL('./fonts/eb-garamond-latin-400-normal.woff2',import.meta.url).href],[700,new URL('./fonts/eb-garamond-latin-700-normal.woff2',import.meta.url).href]],
 'PS Inter':[[400,new URL('./fonts/inter-latin-400-normal.woff2',import.meta.url).href],[700,new URL('./fonts/inter-latin-700-normal.woff2',import.meta.url).href]],
 'PS Condensed':[[400,new URL('./fonts/roboto-condensed-latin-400-normal.woff2',import.meta.url).href],[700,new URL('./fonts/roboto-condensed-latin-700-normal.woff2',import.meta.url).href]],
 'PS Playfair':[[400,new URL('./fonts/playfair-display-latin-400-normal.woff2',import.meta.url).href],[700,new URL('./fonts/playfair-display-latin-700-normal.woff2',import.meta.url).href]],
 /* Amiri's Arabic file is the largest: its bold serves both weights */
 'PS Amiri':[['400 700',new URL('./fonts/amiri-arabic-700-normal.woff2',import.meta.url).href]],
 'PS Kufi':[[400,new URL('./fonts/reem-kufi-arabic-400-normal.woff2',import.meta.url).href],[700,new URL('./fonts/reem-kufi-arabic-700-normal.woff2',import.meta.url).href]],
 'PS Vazirmatn':[[400,new URL('./fonts/vazirmatn-arabic-400-normal.woff2',import.meta.url).href],[700,new URL('./fonts/vazirmatn-arabic-700-normal.woff2',import.meta.url).href]]};

let loading=null;
/* resolves when every face is ready (or has failed: its system fallback then draws) */
export function loadFonts(){
 if(loading)return loading;
 if(typeof FontFace==='undefined'||typeof document==='undefined'||!document.fonts)return loading=Promise.resolve(false);
 const faces=[];
 for(const[family,files]of Object.entries(FILES))for(const[weight,url]of files){
  const f=new FontFace(family,`url(${url})`,{weight:String(weight),display:'block'});
  document.fonts.add(f);faces.push(f.load().catch(()=>null))}
 return loading=Promise.all(faces).then(r=>r.every(Boolean))}

/* @font-face rules with the files inside, for an SVG that leaves the site */
export async function fontFaceCSS(families){
 const rules=[];
 for(const family of families){const files=FILES[family];if(!files)continue;
  for(const[weight,url]of files){
   try{const buf=new Uint8Array(await(await fetch(url)).arrayBuffer());let s='';for(const b of buf)s+=String.fromCharCode(b);
    rules.push(`@font-face{font-family:"${family}";font-weight:${weight};src:url(data:font/woff2;base64,${btoa(s)}) format("woff2")}`)}
   catch(e){}}}
 return rules.join('')}

export const FONT_FAMILIES=Object.keys(FILES);
