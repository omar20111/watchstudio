/* A logo of the user's own: uploaded, printed, applied in metal, kept across a
   reload (the image vault), and removed. */
import path from 'node:path';
const logoMesh=p=>p.evaluate(()=>{const m=window.__watchView.watch.getObjectByName('logo');
 return m?{metal:m.material.metalness===1,verts:m.geometry.attributes.position.count}:null});
const openDial=p=>p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim().startsWith('Dial'));b&&b.click()});

export async function run({page,ready,until,press,present,expect,url,fixtures}){
 const p=await page();
 await p.goto(url);await ready(p);
 await openDial(p);
 await until(p,()=>!!document.querySelector('input[aria-label="Logo image file"]'),null,30000);
 await p.locator('input[aria-label="Logo image file"]').setInputFiles(path.join(fixtures,'logo.svg'));
 expect(await until(p,()=>!!window.__watchView.watch.getObjectByName('logo')),'an uploaded logo appears on the dial');
 const m1=await logoMesh(p);
 expect(m1&&!m1.metal,'printed by default');
 await present(p,'Logo style: Applied metal');
 await press(p,'Logo style: Applied metal');
 expect(await until(p,()=>{const m=window.__watchView.watch.getObjectByName('logo');return m&&m.material.metalness===1}),'Applied metal raises it in metal');
 const m2=await logoMesh(p);
 expect(m2&&m2.verts>200,`as a solid traced from the image (${m2&&m2.verts} vertices)`);
 await p.reload();await ready(p);
 expect(await until(p,()=>!!window.__watchView.watch.getObjectByName('logo')),'the logo survives a reload');
 await openDial(p);
 await present(p,'Remove logo');
 await press(p,'Remove logo');
 expect(await until(p,()=>!window.__watchView.watch.getObjectByName('logo')),'removing it takes it off the dial');
 expect(!p.errors.length,'no page errors '+JSON.stringify(p.errors.slice(0,3)))}
