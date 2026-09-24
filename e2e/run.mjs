/* Browser checks — run with: npm run e2e  (builds first)

   The node tests (npm test) run the renderers under canvas mocks: they prove the
   geometry, the state and the file formats, but nothing is ever drawn or touched.
   These drive the real single-file build in a real browser, with WebGL, pointer
   and touch input, file uploads and downloads — the things that broke silently
   before: a pinch that zoomed the page instead of the watch, a brushed lug that
   rendered white, a button pushed off the end of the toolbar.

   The build is served from memory and opened with ?e2e, which exposes the live
   3D view as window.__watchView for the checks to inspect.

   Browser: E2E_CHANNEL (chrome, msedge, chromium), else Edge on Windows and
   Chrome elsewhere. WebGL comes from SwiftShader, a software renderer, so every
   frame takes seconds: checks wait on conditions, never on frame counts, and a
   click on a busy page is dispatched rather than waited on.

   Only some checks: E2E_ONLY=touch,logo  */
import {chromium} from 'playwright-core';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const here=path.dirname(fileURLToPath(import.meta.url));
const html=await readFile(path.join(here,'..','dist','index.html')).catch(()=>null);
if(!html){console.error('e2e: dist/index.html is missing — run `npm run build` first');process.exit(1)}

const server=http.createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const URL0=`http://127.0.0.1:${server.address().port}/?e2e`;

const channel=process.env.E2E_CHANNEL||(process.platform==='win32'?'msedge':'chrome');
const launch=()=>chromium.launch({channel:channel==='chromium'?undefined:channel,headless:true,
 /* CI runners have no GPU and run Chrome without its user-namespace sandbox */
 args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist',...(process.env.CI?['--no-sandbox']:[])]});
let browser=await launch();

/* A page can hang for good under SwiftShader (seen at a reload: an evaluate that
   never returns, for hours). A suite not finished in SUITE_S seconds fails as
   timed out and its browser is swapped for a fresh one, so the retry and the
   suites after it still run. The slowest suite takes about eight minutes on a
   laptop. */
const SUITE_S=+process.env.E2E_SUITE_S||720;
const inTime=(promise,ms)=>Promise.race([promise,new Promise(r=>setTimeout(()=>r('late'),ms))]);

const SUITES=['welcome','editor','markers','partstudio','crystal','movement','night','touch','logo','ar','photo','glb','techpack'];
const only=(process.env.E2E_ONLY||'').split(',').filter(Boolean);
const suites=only.length?SUITES.filter(s=>only.includes(s)):SUITES;

/* a fresh page; `firstVisit` leaves the welcome gallery to appear */
async function page(ctxOpts={},{firstVisit=false,init}={}){
 const c=await browser.newContext({viewport:{width:1400,height:900},acceptDownloads:true,...ctxOpts});
 await c.addInitScript(()=>{window.__E2E__=true});
 if(!firstVisit)await c.addInitScript(()=>{try{localStorage.setItem('ws:welcomed','1')}catch(e){}});
 if(init)await c.addInitScript(init);
 const p=await c.newPage();p.errors=[];
 p.on('pageerror',e=>p.errors.push(e.message));
 p.on('console',m=>{if(m.type()==='error')p.errors.push(m.text().slice(0,300))});
 p.on('crash',()=>p.errors.push('page crashed'));
 return p}
const ready=(p,timeout=180000)=>p.waitForFunction(()=>window.__watchView&&window.__watchView.watch,null,{timeout});
/* wait for a condition in the page; resolves true/false instead of throwing */
const until=(p,fn,arg,timeout=90000)=>p.waitForFunction(fn,arg,{timeout,polling:500}).then(()=>true,()=>false);
/* Click a button (or menu item) by its accessible label or its text, from inside
   the page. Locator actions poll the DOM against a 30 s budget, which a page
   busy drawing SwiftShader frames can outlast; this waits its turn instead.
   `within` scopes it to a container selector. Resolves whether it found one. */
const press=(p,name,{within,role}={})=>p.evaluate(({name,within,role})=>{
 const root=within?document.querySelector(within):document;if(!root)return false;
 const els=[...root.querySelectorAll(role==='menuitem'?'[role=menuitem]':'button')];
 const el=els.find(e=>e.getAttribute('aria-label')===name)||els.find(e=>e.textContent.trim()===name);
 if(!el)return false;el.click();return true},{name,within,role});
/* wait until a button with this label or text exists */
const present=(p,name,timeout=60000)=>until(p,n=>[...document.querySelectorAll('button,[role=menuitem]')].some(e=>e.getAttribute('aria-label')===n||e.textContent.trim()===n),name,timeout);

let failed=0;
for(const name of suites){
 const mod=await import(`./tests/${name}.mjs`);
 for(let attempt=1;attempt<=2;attempt++){
  const fails=[],notes=[];
  const expect=(ok,msg)=>{notes.push(`    ${ok?'ok  ':'FAIL'}  ${msg}`);if(!ok)fails.push(msg)};
  const t0=Date.now();let timer,hung=false;
  const running=mod.run({browser,page,ready,until,press,present,expect,url:URL0,fixtures:path.join(here,'fixtures')});
  running.catch(()=>{});                /* a hung run rejects later, when its browser is closed */
  const limit=new Promise((_,no)=>{timer=setTimeout(()=>{hung=true;no(new Error(`timed out after ${SUITE_S} s`))},SUITE_S*1000)});
  try{await Promise.race([running,limit])}
  catch(e){fails.push(String(e.message||e).split('\n')[0]);notes.push(`    FAIL  threw: ${String(e.message||e).split('\n')[0]}`)}
  finally{clearTimeout(timer);
   const closed=await inTime(Promise.all(browser.contexts().map(c=>c.close().catch(()=>{}))),20000);
   if(hung||closed==='late'){await inTime(browser.close().catch(()=>{}),20000);browser=await launch()}}
  const secs=((Date.now()-t0)/1000).toFixed(0);
  if(!fails.length||attempt===2){
   console.log(`${fails.length?'FAIL':'ok  '}  ${name} (${secs} s${attempt>1?', second attempt':''})`);
   for(const n of notes)console.log(n);
   /* on GitHub the job log needs a signed-in admin to read; annotations are
      public, so each failed check is also written as one */
   if(fails.length&&process.env.GITHUB_ACTIONS)for(const f of fails)console.log(`::error title=e2e ${name}::${String(f).replace(/[\r\n%]/g,' ').slice(0,400)}`);
   if(fails.length)failed++;break}
  console.log(`retry ${name}: ${fails[0]}`)}}

await inTime(browser.close().catch(()=>{}),20000);server.close();
console.log(failed?`E2E FAIL (${failed} of ${suites.length})`:`E2E PASS (${suites.length})`);
process.exit(failed?1:0);
