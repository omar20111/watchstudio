/* The editor on a desktop: the 3D watch builds, right-drag tilts and eases back,
   a left-drag still edits, and the case's Wear setting rebuilds and persists. */
export async function run({page,ready,until,press,expect,url}){
 const p=await page();
 await p.goto(url);await ready(p);
 const box=await p.locator('canvas[aria-label^="Watch"]').boundingBox();
 const cx=box.x+box.width/2,cy=box.y+box.height/2;
 const tilt=()=>p.evaluate(()=>Math.hypot(...window.__watchView.tilt));

 /* tilt */
 await p.mouse.move(cx+40,cy+40);await p.mouse.down({button:'right'});
 for(let i=1;i<=8;i++)await p.mouse.move(cx+40+i*14,cy+40+i*16);
 const t1=await tilt();
 expect(t1>.2&&t1<=25*Math.PI/180+1e-6,`right-drag tilts the watch (${(t1*180/Math.PI).toFixed(1)} deg, capped at 25)`);
 await p.mouse.up({button:'right'});
 expect(await until(p,()=>Math.hypot(...window.__watchView.tilt)<1e-6),'and it eases back level');

 /* a left-drag moves a part */
 await p.mouse.move(cx,cy-5);await p.mouse.down();
 for(let i=1;i<=6;i++)await p.mouse.move(cx+i*6,cy-5);
 await p.mouse.up();
 expect(await until(p,()=>!document.querySelector('button[aria-label="Undo"]').disabled,null,30000),'a left-drag edits (Undo is enabled)');
 expect(await tilt()<1e-6,'a left-drag does not tilt');
 await press(p,'Undo');

 /* wear */
 const uuid=await p.evaluate(()=>window.__watchView.watch.uuid);
 /* the drag selected the part under it: Wear lives in the case's panel */
 await p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim().startsWith('Case'));b&&b.click()});
 await until(p,()=>!!document.querySelector('button[aria-label="Wear: Worn"]'),null,60000);
 await press(p,'Wear: Worn');
 expect(await until(p,u=>window.__watchView.watch.uuid!==u,uuid),'Wear: Worn rebuilds the watch');
 const worn=await p.evaluate(()=>{let n=0;window.__watchView.watch.traverse(o=>{if(o.isMesh&&o.material.customProgramCacheKey&&o.material.customProgramCacheKey().includes('ws-wear'))n++});return n});
 expect(worn>=5,`exposed metal wears (${worn} meshes)`);

 /* the case's construction: side profile, lug style and drilled holes rebuild the one-piece case */
 const flank=()=>p.evaluate(()=>{const f=window.__watchView.watch.getObjectByName('flank'),a=f.geometry.attributes.position;let lo=1e9,hi=0;
  for(let i=0;i<a.count;i++){const r=Math.hypot(a.getX(i),a.getZ(i)),y=a.getY(i);if(y>1.4)lo=Math.min(lo,r),hi=Math.max(hi,r)}return hi-lo});
 const flat=await flank();
 for(const label of['Case side: Drum','Lugs: Twisted']){const u0=await p.evaluate(()=>window.__watchView.watch.uuid);
  await press(p,label);expect(await until(p,u=>window.__watchView.watch.uuid!==u,u0,120000),`${label} rebuilds the watch`)}
 expect((await flank())>flat+.2,'a drum side bows the case band out and in');
 const u1=await p.evaluate(()=>window.__watchView.watch.uuid);
 await p.evaluate(()=>{const l=[...document.querySelectorAll('label')].find(e=>/Drilled lug holes/.test(e.textContent));l&&l.querySelector('input').click()});
 expect(await until(p,u=>window.__watchView.watch.uuid!==u&&!!window.__watchView.watch.getObjectByName('lugHoles'),u1,120000),'Drilled lug holes puts bores through the lugs');
 expect(await until(p,()=>/"side":"drum"/.test(localStorage.getItem('ws:auto')||'')&&/"lugs":"twisted"/.test(localStorage.getItem('ws:auto')||'')&&/"lugHoles":true/.test(localStorage.getItem('ws:auto')||''),null,20000),'the case construction is saved');
 expect(await until(p,()=>/"wear":"worn"/.test(localStorage.getItem('ws:auto')||''),null,20000),'the Wear choice is saved');
 await p.reload();await ready(p);
 expect(await until(p,()=>/\bon\b/.test((document.querySelector('button[aria-label="Wear: Worn"]')||{}).className||''),null,60000),'and survives a reload');
 expect(!p.errors.length,'no page errors '+JSON.stringify(p.errors.slice(0,3)))}
