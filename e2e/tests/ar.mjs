/* View in AR, on each route a device can offer: the QR hand-off from a computer
   (and the compact link it carries opening the design), Quick Look's USDZ at
   real size, and a WebXR session that is refused failing politely. The real AR
   viewers cannot run here: Quick Look and WebXR support are simulated, and the
   USDZ is checked as a file. */
import {unzipSync,strFromU8} from 'three/examples/jsm/libs/fflate.module.js';
const AR='View this watch in AR at real size';

export async function run({page,ready,until,press,present,expect,url}){
 /* the QR hand-off */
 {const p=await page({permissions:['clipboard-read','clipboard-write']});
  await p.goto(url);await ready(p);
  await press(p,'Heritage Diver');
  await press(p,AR);
  expect(await until(p,()=>!!document.querySelector('svg[aria-label="QR code linking to this design"]'),null,60000),'a computer gets a QR code');
  await present(p,'Copy link instead');
  await press(p,'Copy link instead');
  await until(p,()=>navigator.clipboard.readText().then(t=>/#z=/.test(t),()=>false),null,30000);
  const link=await p.evaluate(()=>navigator.clipboard.readText());
  expect(/#z=[A-Za-z0-9_-]+$/.test(link)&&link.length<1400,`the link is compact (${link.length} chars)`);
  expect(!p.errors.length,'no page errors '+JSON.stringify(p.errors.slice(0,3)));
  await p.context().close();
  const q=await page();
  await q.goto(url+link.slice(link.indexOf('#')));await ready(q);
  expect(await until(q,()=>{let f=false;window.__watchView.watch.traverse(o=>{if(o.name==='bezelIns')f=true});return f},null,120000),'the link opens the design (a diver, with its bezel insert)');
  await q.context().close()}

 /* Quick Look */
 {const p=await page({},{init:()=>{const sup=DOMTokenList.prototype.supports;
   DOMTokenList.prototype.supports=function(t){return t==='ar'?true:sup.call(this,t)};
   const click=HTMLAnchorElement.prototype.click;
   HTMLAnchorElement.prototype.click=function(){if(this.rel!=='ar')return click.call(this);
    window.__ql={hasImg:!!this.querySelector('img')};
    fetch(this.href).then(r=>r.arrayBuffer()).then(b=>{window.__qlBytes=Array.from(new Uint8Array(b))})}}});
  await p.goto(url);await ready(p);
  await press(p,AR);
  await present(p,'Open in AR');
  await press(p,'Open in AR');
  expect(await until(p,()=>!!window.__qlBytes,null,300000),'Open in AR builds a USDZ for Quick Look');
  const ql=await p.evaluate(()=>window.__ql),bytes=Uint8Array.from(await p.evaluate(()=>window.__qlBytes||[]));
  expect(ql&&ql.hasImg,'opened from a rel=ar link wrapping an image, as Quick Look requires');
  if(bytes.length){const files=unzipSync(bytes),names=Object.keys(files),usda=strFromU8(files['model.usda']||new Uint8Array());
   expect(names[0]==='model.usda',"model.usda is the archive's first file");
   expect(/metersPerUnit = 1/.test(usda)&&/preliminary:anchoring:type = "plane"/.test(usda),'metres, anchored to a table');
   const scale=/matrix4d xformOp:transform = \( \(([-\d.e]+)/.exec(usda);
   expect(scale&&Math.abs(+scale[1]-.001)<1e-9,'real size: scaled from millimetres to metres')}
  expect(!p.errors.length,'no page errors '+JSON.stringify(p.errors.slice(0,3)));
  await p.context().close()}

 /* WebXR, refused */
 {const p=await page({},{init:()=>{Object.defineProperty(navigator,'xr',{value:{isSessionSupported:async m=>m==='immersive-ar',
   requestSession:async()=>{throw new DOMException('no AR here','NotSupportedError')}}})}});
  await p.goto(url);await ready(p);
  await press(p,AR);
  await present(p,'Start AR');
  await press(p,'Start AR');
  expect(await until(p,()=>[...document.querySelectorAll('[role=status]')].some(s=>/AR could not start/.test(s.textContent)),null,60000),'a refused AR session explains itself');
  expect(!p.errors.filter(e=>!/AR session failed/.test(e)).length,'no unexpected page errors')}}
