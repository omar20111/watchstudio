/* Markers designed in PartStudio: imported from its file, ground on the 3D dial
   (outlines and numerals, each index's outer end on the hour ring, the date
   window's hour left out), undone, and sent by link onto an open watch. */
import path from 'node:path';
import {readFile} from 'node:fs/promises';

const indices=p=>p.evaluate(()=>{const w=window.__watchView.watch,r=w.userData.radii.dialR,out=[];
 w.traverse(o=>{if(o.isMesh&&/^index:/.test(o.name))out.push({h:+o.name.slice(6),reach:Math.hypot(o.position.x,o.position.z)/r,verts:o.geometry.attributes.position.count})});
 return{list:out,lume:(()=>{let n=0;w.traverse(o=>{if(o.isMesh&&/^indexLume:/.test(o.name))n++});return n})(),builtIn:!!w.getObjectByName('indices')}});
const openMarkers=p=>p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim().startsWith('Markers'));b&&b.click()});

export async function run({page,ready,until,present,press,expect,url,fixtures}){
 const file=path.join(fixtures,'explorer.watchstudio-markers.json');
 const p=await page();
 await p.goto(url);await ready(p);
 await openMarkers(p);
 await until(p,()=>!!document.querySelector('input[aria-label="PartStudio marker set file"]'),null,30000);
 await p.locator('input[aria-label="PartStudio marker set file"]').setInputFiles(file);
 expect(await until(p,()=>{const w=window.__watchView.watch;return !!w.getObjectByName('index:0')&&!w.getObjectByName('indices')},null,180000),
  'importing a PartStudio file puts its indices on the dial in place of the batons');
 const a=await indices(p);
 const hours=a.list.map(i=>i.h).sort((x,y)=>x-y);
 /* a new design has a date window at 3, which takes that hour's index */
 expect(hours.length===11&&!hours.includes(3),`one index per hour except the date window's (${hours.join(' ')})`);
 const numerals=a.list.filter(i=>i.h===6||i.h===9);
 expect(numerals.length===2&&numerals.every(i=>i.verts>300),`the 6 and 9 are ground numerals (${numerals.map(i=>i.verts).join(', ')} vertices)`);
 expect(a.lume===9,`the eight batons and the triangle carry lume, the numerals none (${a.lume} fills)`);
 const at12=a.list.find(i=>i.h===0);
 expect(at12&&Math.abs(at12.reach-.885)<.002,`the 12 o'clock index's outer end is on the hour ring (${at12&&at12.reach.toFixed(4)} r)`);
 expect(await until(p,()=>!!document.querySelector('[aria-label="Use the PartStudio marker set"]')),'the set is offered among the marker presets');

 /* one undo takes it back off */
 await p.keyboard.press('Control+z');
 expect(await until(p,()=>!!window.__watchView.watch.getObjectByName('indices')&&!window.__watchView.watch.getObjectByName('index:0'),null,120000),'undo puts the batons back');

 /* a link from PartStudio's Open in WatchStudio, onto the watch already open */
 const code=await p.evaluate(async json=>{const bytes=new TextEncoder().encode(json);
  const out=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
  let s='';for(const b of out)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')},await readFile(file,'utf8'));
 expect(!p.errors.length,'no page errors '+JSON.stringify(p.errors.slice(0,3)));
 /* PartStudio opens the link in a new tab: a fresh page load (one software-
    rendered page at a time, or both crawl) */
 await p.context().close();
 const q=await page();
 await q.goto(url.replace(/#.*$/,'')+'#m='+code);await ready(q);
 expect(await until(q,()=>!!window.__watchView.watch.getObjectByName('index:0'),null,180000),'a PartStudio link opens with its markers on the watch');
 expect(await q.evaluate(()=>!location.hash),'and clears itself from the address');
 expect(!q.errors.length,'no page errors on the link '+JSON.stringify(q.errors.slice(0,3)))}
