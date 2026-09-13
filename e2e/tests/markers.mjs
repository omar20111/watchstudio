/* Hour markers of every style end on the same ring (render/markers.js
   INDEX_OUTER): switching style changes the indices' shape, never where the
   hour ring sits. Measured on the 3D indices themselves — the solid traced
   from each style's silhouette — hour by hour, in dial radii. */
/* Batons last: a new design already has them, and choosing the style it has
   would not rebuild the watch this waits for */
const STYLES=['Dots','Roman','Numerals','Arabic ١٢','Wedges','Minimal','Batons'];

/* outer reach of the indices around each hour, from the live mesh */
const reach=p=>p.evaluate(()=>{const w=window.__watchView.watch,m=w.getObjectByName('indices');if(!m)return null;
 const r=w.userData.radii.dialR,pos=m.geometry.attributes.position,out=new Array(12).fill(0);
 for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),d=Math.hypot(x,z)/r;if(d<.5)continue;
  /* 12 o'clock is -z, and hours run clockwise toward +x */
  const a=(Math.atan2(x,-z)*180/Math.PI+360)%360,h=Math.round(a/30)%12;
  if(Math.abs(((a-h*30+540)%360)-180)<20)out[h]=Math.max(out[h],d)}
 return out});

export async function run({page,ready,until,press,expect,url}){
 const p=await page();
 await p.goto(url);await ready(p);
 /* no date window, so every hour has its index */
 await p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim().startsWith('Dial'));b&&b.click()});
 await until(p,()=>!!document.querySelector('[aria-label="Date window"]'),null,30000);
 await press(p,'None',{within:'[aria-label="Date window"]'});
 await p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim().startsWith('Markers'));b&&b.click()});
 const all=[];
 for(const style of STYLES){
  const before=await p.evaluate(()=>window.__watchView.watch.uuid);
  await until(p,s=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===s),style,30000);
  await press(p,style);
  const rebuilt=await until(p,u=>window.__watchView.watch.uuid!==u&&!!window.__watchView.watch.getObjectByName('indices'),before,120000);
  const rs=rebuilt?(await reach(p)||[]).filter(v=>v>0):[];
  const lo=Math.min(...rs),hi=Math.max(...rs);
  expect(rs.length>=4&&lo>.865&&hi<.905,`${style}: every index ends on the ring (${rs.length?lo.toFixed(3)+'–'+hi.toFixed(3):'no indices'} r)`);
  all.push(...rs)}
 const lo=Math.min(...all),hi=Math.max(...all);
 expect(all.length&&hi-lo<.035,`all styles end within ${(hi-lo).toFixed(3)} r of each other`);
 expect(!p.errors.length,'no page errors '+JSON.stringify(p.errors.slice(0,3)))}
