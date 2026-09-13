/* The product render's staging and Photo: a surface appears under the live
   watch, and a photo starts path tracing with the live view paused beneath it.
   Converging a photo takes minutes on a software renderer, so it is not waited
   for here. */
export async function run({page,ready,until,press,present,expect,url}){
 const p=await page({viewport:{width:460,height:420}});
 await p.goto(url);await ready(p);
 await press(p,'Product render');
 await until(p,()=>!!document.querySelector('[aria-label="Surface"]')&&window.__watchView&&window.__watchView.watch,null,120000);
 await press(p,'Marble',{within:'[aria-label="Surface"]'});
 expect(await until(p,()=>window.__watchView.surface&&window.__watchView.surface.userData.surface==='marble'),'Marble lays a marble surface under the live watch');
 await press(p,'None',{within:'[aria-label="Surface"]'});
 expect(await until(p,()=>!window.__watchView.surface),'None removes it');
 await press(p,'Strong',{within:'[aria-label="Lens blur"]'});
 expect(await until(p,()=>/"product":\{[^}]*"blur":"strong"/.test(localStorage.getItem('ws:auto')||''),null,20000),'staging is saved with the design');
 await press(p,'📷 Photo');
 expect(await until(p,()=>{const s=document.querySelector('[role=status]');return s&&/Refining|Photo ready/.test(s.textContent)},null,240000),'Photo starts path tracing');
 expect(await p.evaluate(()=>window.__watchView.paused===true),'with the live view paused beneath it');
 await press(p,'Done');
 expect(await until(p,()=>window.__watchView.paused===false,null,60000),'Done resumes the live view');
 expect(!p.errors.length,'no page errors '+JSON.stringify(p.errors.slice(0,3)))}
