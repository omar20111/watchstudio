/* Night mode: the Night button (and N) dims the studio and lights every lume
   material in its own colour; turning it off gives the daylight look back, and
   the choice is saved with the design. */
const lumeState=p=>p.evaluate(()=>{const v=window.__watchView;let n=0,lit=0,dark=0;
 v.watch.traverse(o=>{const m=o.isMesh&&o.material;if(!m||!m.userData||!m.userData.lume||!m.emissive)return;n++;
  if(m.emissiveIntensity>2&&m.emissive.getHex()!==0)lit++;else dark++});
 return{night:v.night,n,lit,dark,env:v.scene.environmentIntensity}});

export async function run({page,ready,until,press,expect,url}){
 const p=await page();
 await p.goto(url);await ready(p);
 /* a diver: lume in the indices, both hands and the bezel's pip */
 await press(p,'Heritage Diver');
 const lumeNames=()=>p.evaluate(()=>{const n=new Set();window.__watchView.watch.traverse(o=>{if(o.isMesh&&o.material.userData&&o.material.userData.lume)n.add(o.name)});return[...n].sort()});
 await until(p,()=>{const n=new Set();window.__watchView.watch.traverse(o=>{if(o.isMesh&&o.material.userData&&o.material.userData.lume)n.add(o.name)});
  return n.has('hourLume')&&n.has('minLume')&&n.has('bezelPipLume')},null,120000);
 const names=await lumeNames(),day=await lumeState(p);
 expect(['hourLume','minLume','bezelPipLume'].every(n=>names.includes(n))&&!day.night,`the diver has lume in its hands, indices and bezel pip (${names.join(', ')}), and it is day`);

 await press(p,'Night',{within:'[aria-label="Camera"]'});
 expect(await until(p,()=>window.__watchView.night===true,null,30000),'the Night button turns the lights out');
 const night=await lumeState(p);
 expect(night.lit===night.n,`every lume material glows (${night.lit} of ${night.n})`);
 expect(night.env<.1,`the studio is dimmed (environment ${night.env})`);
 expect(await until(p,()=>/"night":true/.test(localStorage.getItem('ws:auto')||''),null,20000),'night is saved with the design');

 await p.keyboard.press('n');
 expect(await until(p,()=>window.__watchView.night===false,null,30000),'N turns the lights back on');
 const back=await lumeState(p);
 expect(back.lit===0&&back.env===1,`the lume and the studio are back to daylight (${back.lit} still lit, environment ${back.env})`);
 expect(!p.errors.length,'no page errors '+JSON.stringify(p.errors.slice(0,3)))}
