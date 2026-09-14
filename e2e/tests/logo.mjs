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
 /* at the default size and place it would touch the brand text: it is shown smaller, and the panel says so */
 expect(await until(p,()=>[...document.querySelectorAll('[role=status]')].some(e=>/keep clear of the brand text/.test(e.textContent)),null,30000),
  'made smaller to clear the brand text, and the panel says so');
 await present(p,'Logo style: Applied metal');
 await press(p,'Logo style: Applied metal');
 expect(await until(p,()=>{const m=window.__watchView.watch.getObjectByName('logo');return m&&m.material.metalness===1}),'Applied metal raises it in metal');
 const m2=await logoMesh(p);
 expect(m2&&m2.verts>200,`as a solid traced from the image (${m2&&m2.verts} vertices)`);
 /* the hour hand sweeps over it: its top stays below the hour hand's arbor */
 const clear=await p.evaluate(()=>{const w=window.__watchView.watch;w.updateMatrixWorld(true);
  const m=w.getObjectByName('logo');let top=-1e9;const e=m.matrixWorld.elements,pos=m.geometry.attributes.position;
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);top=Math.max(top,e[1]*x+e[5]*y+e[9]*z+e[13])}
  let arbor=null;w.traverse(o=>{if(o.name==='hour'&&o.userData&&o.userData.spin==='hour'){const v=o.matrixWorld.elements;arbor=v[13]}});
  return{top,arbor}});
 expect(clear.arbor!=null&&clear.top<clear.arbor-.01,`the applied logo (${clear.top.toFixed(2)} mm) stands below the hour hand (${clear.arbor&&clear.arbor.toFixed(2)} mm)`);
 await p.reload();await ready(p);
 expect(await until(p,()=>!!window.__watchView.watch.getObjectByName('logo')),'the logo survives a reload');
 await openDial(p);
 await present(p,'Remove logo');
 await press(p,'Remove logo');
 expect(await until(p,()=>!window.__watchView.watch.getObjectByName('logo')),'removing it takes it off the dial');
 expect(!p.errors.length,'no page errors '+JSON.stringify(p.errors.slice(0,3)))}
