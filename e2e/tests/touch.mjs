/* A phone: the top bar fits, a pinch zooms the watch and never the page, two
   fingers tilt it, and a second finger landing mid-drag puts a part back. */
export async function run({page,ready,until,press,expect,url}){
 const p=await page({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const cdp=await p.context().newCDPSession(p);
 const touch=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map(([x,y,id])=>({x,y,id}))});
 await p.goto(url);await ready(p);
 const box=await p.locator('canvas[aria-label^="Watch"]').boundingBox();
 const cx=box.x+box.width/2,cy=box.y+box.height/2;
 const zoom=()=>p.evaluate(()=>+document.querySelector('.stage-zoom span').textContent.replace('%',''));
 const pageScale=()=>p.evaluate(()=>visualViewport.scale);

 const lay=await p.evaluate(()=>{const bar=document.querySelector('.h-12'),t=document.querySelector('.stage-time').getBoundingClientRect(),z=document.querySelector('.stage-zoom').getBoundingClientRect();
  return{overflow:bar.scrollWidth-bar.clientWidth,overlap:!(t.right<=z.left||z.right<=t.left)}});
 expect(lay.overflow<=1,`the top bar fits (${lay.overflow}px over)`);
 expect(!lay.overlap,'the time and zoom bars do not overlap');

 await touch('touchStart',[[cx-40,cy,1],[cx+40,cy,2]]);
 for(let i=1;i<=8;i++)await touch('touchMove',[[cx-40-i*9,cy,1],[cx+40+i*9,cy,2]]);
 await touch('touchEnd',[]);
 expect(await until(p,()=>+document.querySelector('.stage-zoom span').textContent.replace('%','')>=180,null,30000),`a pinch zooms the watch (${await zoom()}%)`);
 expect(Math.abs(await pageScale()-1)<1e-3,'the page itself does not zoom');
 await press(p,'Fit');

 await touch('touchStart',[[cx-40,cy,1],[cx+40,cy,2]]);
 for(let i=1;i<=8;i++)await touch('touchMove',[[cx-40+i*10,cy+i*12,1],[cx+40+i*10,cy+i*12,2]]);
 expect(await until(p,()=>Math.hypot(...window.__watchView.tilt)>.1,null,20000),'two fingers dragged together tilt it');
 await touch('touchEnd',[]);
 expect(await until(p,()=>Math.hypot(...window.__watchView.tilt)<1e-6),'and it eases back level');

 const pos=()=>p.evaluate(()=>{const g=window.__watchView.watch.userData.groups.dial;return[+g.position.x.toFixed(2),+g.position.z.toFixed(2)]});
 const x0=cx+box.width*.12,before=await pos();
 await touch('touchStart',[[x0,cy,1]]);for(let i=1;i<=5;i++)await touch('touchMove',[[x0+i*8,cy+i*6,1]]);
 await until(p,b=>{const g=window.__watchView.watch.userData.groups.dial;return g.position.x!==b[0]},before,20000);
 await touch('touchStart',[[x0+40,cy+30,1],[x0-60,cy+30,2]]);await touch('touchMove',[[x0+41,cy+31,1],[x0-61,cy+31,2]]);
 await touch('touchEnd',[]);
 expect(await until(p,b=>{const g=window.__watchView.watch.userData.groups.dial;return +g.position.x.toFixed(2)===b[0]&&+g.position.z.toFixed(2)===b[1]},before,20000),
  'a second finger landing mid-drag puts the part back');
 expect(!p.errors.length,'no page errors '+JSON.stringify(p.errors.slice(0,3)))}
