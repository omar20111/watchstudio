/* Reference renders — run with: npm run refs

   Starts a Vite dev server, drives the system Edge/Chrome through
   playwright-core, and writes one 1200x1200 PNG per theme (plus the default
   design) through the real export pipeline, frozen at the marketing pose.

   The headless tests mock the canvas and cannot see pixels. These images are
   the check that does: the baseline for judging a rendering change by eye, and
   for diffing one run against another. The 2D renderer these were first taken
   from lives on at commit 72093f6 (`git checkout 72093f6 && npm run refs`).

   Usage: node scripts/refs.mjs [--camera front|three-quarter|side|back]
                                [--out refs/<camera>] [--only diver,dress] */
import {createServer} from 'vite';
import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const arg=(k,fb)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:fb};
const camera=arg('--camera','front');
const out=resolve(arg('--out',`refs/${camera}`));
const only=arg('--only','')?arg('--only').split(','):null;

const server=await createServer({logLevel:'error',server:{port:5199,strictPort:false}});
await server.listen();
const url=server.resolvedUrls.local[0];

/* headless has no GPU; SwiftShader gives it a software WebGL */
let browser;
for(const channel of['msedge','chrome']){
 try{browser=await chromium.launch({channel,headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});break}catch(e){}}
if(!browser){await server.close();
 console.error('No Edge or Chrome found for playwright-core to drive.');process.exit(1)}

const page=await browser.newPage({viewport:{width:1400,height:900}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
/* a bare "404" console line doesn't say what was missing — record the URL
   instead, and ignore the favicon the page never declared */
page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(`${r.status()} ${r.url()}`)});
await page.goto(url);
await page.waitForSelector('#root canvas',{timeout:30000});

const shots=await page.evaluate(async({only,camera})=>{
 const {DEF}=await import('/src/state/store.js');
 const {THEMES}=await import('/src/state/themes.js');
 const {clone}=await import('/src/core/utils.js');
 const {marketingClock}=await import('/src/core/time.js');
 const {sceneBlob3D,renderStill}=await import('/src/core/three/view.js');
 const jobs=[{id:'default',apply:()=>{}},...THEMES];
 const res=[];
 for(const t of jobs){if(only&&!only.includes(t.id))continue;
  const d=clone(DEF);t.apply(d);d.bg='studio';d.shadow=true;
  const clock=marketingClock(d);
  let blob;
  if(camera==='side'||camera==='back'){
   const cv=await renderStill(d,{},{w:1200,h:camera==='side'?800:1200,camera,clock});
   blob=await new Promise(r=>cv.toBlob(r,'image/png'))}
  else blob=await sceneBlob3D(d,{},{camera,clock});
  const b64=await new Promise(r=>{const f=new FileReader();f.onload=()=>r(String(f.result).split(',')[1]);f.readAsDataURL(blob)});
  res.push({id:t.id,b64})}
 return res},{only,camera});

await mkdir(out,{recursive:true});
for(const s of shots){await writeFile(resolve(out,s.id+'.png'),Buffer.from(s.b64,'base64'));
 console.log('  wrote',s.id+'.png')}

await browser.close();await server.close();
if(errors.length){console.error('\nPage errors:\n  '+errors.join('\n  '));process.exit(1)}
console.log(`\nREFS ${shots.length} → ${out}`);
