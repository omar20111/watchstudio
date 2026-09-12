/* Reference renders — run with: npm run refs

   Starts a Vite dev server, drives the system Edge/Chrome through
   playwright-core, and writes one 1200x1200 PNG per theme (plus the default
   design) through the real export compositor, frozen at the marketing pose so
   two runs of the same code produce the same files.

   The headless tests mock the canvas, so a renderer that draws nothing passes
   them. These images are the only check that looks at pixels: the baseline for
   judging a renderer change by eye, and for diffing one run against another.

   Usage: node scripts/refs.mjs [--out refs/2d] [--only diver,dress]
                                [--renderer 2d|3d] [--view front|three-quarter] */
import {createServer} from 'vite';
import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const arg=(k,fb)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:fb};
const renderer=arg('--renderer','2d');
const view=arg('--view','front');
const out=resolve(arg('--out',renderer==='3d'?`refs/3d-${view}`:'refs/2d'));
const only=arg('--only','')?arg('--only').split(','):null;

const server=await createServer({logLevel:'error',server:{port:5199,strictPort:false}});
await server.listen();
const url=server.resolvedUrls.local[0];

let browser;
/* headless has no GPU; SwiftShader gives it a software WebGL. Only for 3D, so
   the 2D references keep rasterising exactly as they did at the baseline. */
const args=renderer==='3d'?['--enable-unsafe-swiftshader','--use-angle=swiftshader']:[];
for(const channel of['msedge','chrome']){
 try{browser=await chromium.launch({channel,headless:true,args});break}catch(e){}}
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

const shots=await page.evaluate(async({only,renderer,view})=>{
 const {DEF}=await import('/src/state/store.js');
 const {THEMES}=await import('/src/state/themes.js');
 const {clone}=await import('/src/core/utils.js');
 const {sceneBlob}=await import('/src/export/png.js');
 const {marketingClock}=await import('/src/core/time.js');
 const three=renderer==='3d'?await import('/src/core/three/view.js'):null;
 const jobs=[{id:'default',apply:()=>{}},...THEMES];
 const res=[];
 for(const t of jobs){if(only&&!only.includes(t.id))continue;
  const d=clone(DEF);t.apply(d);d.bg='studio';d.shadow=true;
  const clock=marketingClock(d);
  const blob=three?await three.sceneBlob3D(d,{view,clock}):await sceneBlob(d,{},{mult:1,clock});
  const b64=await new Promise(r=>{const f=new FileReader();f.onload=()=>r(String(f.result).split(',')[1]);f.readAsDataURL(blob)});
  res.push({id:t.id,b64})}
 return res},{only,renderer,view});

await mkdir(out,{recursive:true});
for(const s of shots){await writeFile(resolve(out,s.id+'.png'),Buffer.from(s.b64,'base64'));
 console.log('  wrote',s.id+'.png')}

await browser.close();await server.close();
if(errors.length){console.error('\nPage errors:\n  '+errors.join('\n  '));process.exit(1)}
console.log(`\nREFS ${shots.length} → ${out}`);
