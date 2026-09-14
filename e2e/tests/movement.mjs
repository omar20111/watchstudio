/* The movement behind an exhibition caseback: choosing Exhibition builds it,
   the Back camera turns the watch over to show it, its balance swings while it
   is in view, and the 3D model export still passes the Khronos validator with
   the movement inside. */
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

const panel=(p,name)=>p.evaluate(n=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim().startsWith(n));b&&b.click()},name);
const balanceAngle=p=>p.evaluate(()=>{let a=null;window.__watchView.watch.traverse(o=>{if(o.userData&&o.userData.spin==='balance')a=o.rotation.y});return a});

export async function run({page,ready,until,press,expect,url}){
 const validator=require('gltf-validator');
 const p=await page();
 await p.goto(url);await ready(p);

 await panel(p,'Case');
 await until(p,()=>!!document.querySelector('button[aria-label="Caseback: Exhibition"]'),null,30000);
 await press(p,'Caseback: Exhibition');
 expect(await until(p,()=>!!window.__watchView.watch.getObjectByName('movement'),null,120000),'Exhibition builds a movement behind the window');
 const parts=await p.evaluate(()=>{const n=new Set();window.__watchView.watch.getObjectByName('movement').traverse(o=>{if(o.isMesh)n.add(o.name.replace(/\d+$/,''))});return[...n]});
 for(const want of['movement:bridges','movement:plate','movement:balanceRim','movement:hairspring','movement:rotorRim','movement:jewel','movement:ratchet'])
  expect(parts.includes(want),`with its ${want.slice(9)}`);

 /* the Back camera turns the watch over; the balance swings while it is in view */
 await press(p,'Back',{within:'[aria-label="Camera"]'});
 expect(await until(p,()=>/back view/.test(document.querySelector('canvas[aria-label^="Watch"]').getAttribute('aria-label')||''),null,30000),'the Back camera is chosen');
 expect(await until(p,()=>window.__watchView.moving,null,30000),'the view knows the balance is moving in it');
 /* a software GPU draws a frame every second or two: wait for frames, not a fixed second */
 const seen=new Set([(await balanceAngle(p)).toFixed(3)]);
 for(let i=0;i<3;i++){const last=[...seen].pop();
  await until(p,a=>{let r=null;window.__watchView.watch.traverse(o=>{if(o.userData&&o.userData.spin==='balance')r=o.rotation.y});return r!=null&&r.toFixed(3)!==a},last,30000);
  seen.add((await balanceAngle(p)).toFixed(3))}
 expect(seen.size>=3,`the balance swings from frame to frame (${seen.size} positions)`);
 expect(await until(p,()=>/"camera":"back"/.test(localStorage.getItem('ws:auto')||''),null,20000),'the Back camera is saved');

 /* the model export carries the movement and still validates */
 const[dl]=await Promise.all([p.waitForEvent('download',{timeout:240000}),
  press(p,'Export a 3D model (GLB) for Blender, AR and other 3D apps')]);
 const chunks=[];for await(const ch of await dl.createReadStream())chunks.push(ch);
 const bytes=new Uint8Array(Buffer.concat(chunks));
 const report=await validator.validateBytes(bytes,{maxIssues:50});
 const{numErrors,numWarnings}=report.issues;
 const len=new DataView(bytes.buffer).getUint32(12,true),json=JSON.parse(Buffer.from(bytes.slice(20,20+len)).toString());
 expect((json.nodes||[]).some(n=>/^movement/.test(n.name||'')),'the GLB has the movement in it');
 expect(numErrors===0&&numWarnings===0,`and the Khronos validator passes it (${numErrors} errors, ${numWarnings} warnings${numErrors+numWarnings?': '+report.issues.messages.slice(0,3).map(m=>m.code+' '+m.pointer).join('; '):''})`);
 expect(!p.errors.length,'no page errors '+JSON.stringify(p.errors.slice(0,3)))}
