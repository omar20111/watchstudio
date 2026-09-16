/* The crystal is a solid of sapphire whose underside clears the hands, and a
   cyclops can be set over the date: offered only on a flat or box crystal,
   built as a lens centred over the date window, and kept across a reload. */

/* world-space extents of named meshes (the watch lies level: nothing is tilted) */
const extents=(p,test)=>p.evaluate(src=>{const keep=new Function('o','return '+src);
 const w=window.__watchView.watch;w.updateMatrixWorld(true);
 const b={x0:1e9,x1:-1e9,y0:1e9,y1:-1e9,z0:1e9,z1:-1e9,n:0};
 w.traverse(o=>{if(!o.isMesh||!keep(o))return;const e=o.matrixWorld.elements,pos=o.geometry.attributes.position;
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
   const X=e[0]*x+e[4]*y+e[8]*z+e[12],Y=e[1]*x+e[5]*y+e[9]*z+e[13],Z=e[2]*x+e[6]*y+e[10]*z+e[14];
   b.x0=Math.min(b.x0,X);b.x1=Math.max(b.x1,X);b.y0=Math.min(b.y0,Y);b.y1=Math.max(b.y1,Y);b.z0=Math.min(b.z0,Z);b.z1=Math.max(b.z1,Z);b.n++}});
 return b},test);
/* the gap between the hands and the crystal straight above them: every sampled
   point of the hands, against the crystal's downward faces over that spot. The
   crystal's rim steps down below the hands' height, but outside the dial, where
   no hand reaches — so a lowest-point-against-highest-point test would be wrong. */
const clearance=p=>p.evaluate(()=>{const w=window.__watchView.watch;w.updateMatrixWorld(true);
 const world=(o,i)=>{const e=o.matrixWorld.elements,a=o.geometry.attributes.position,x=a.getX(i),y=a.getY(i),z=a.getZ(i);
  return[e[0]*x+e[4]*y+e[8]*z+e[12],e[1]*x+e[5]*y+e[9]*z+e[13],e[2]*x+e[6]*y+e[10]*z+e[14]]};
 const tris=[];
 w.traverse(o=>{if(!o.isMesh||o.name!=='crystal')return;const ix=o.geometry.index,n=ix?ix.count:o.geometry.attributes.position.count;
  for(let t=0;t<n;t+=3){const[a,b,c]=[0,1,2].map(k=>world(o,ix?ix.getX(t+k):t+k));
   const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
   const ny=u[2]*v[0]-u[0]*v[2],len=Math.hypot(u[1]*v[2]-u[2]*v[1],ny,u[0]*v[1]-u[1]*v[0]);
   if(len>1e-9&&ny/len<-.2)tris.push([a,b,c])}});
 const pts=[];
 /* the hands themselves: their lume and shadow decals are sheets laid over the
    dial, not metal that could touch the glass */
 w.traverse(o=>{if(!o.isMesh||o.userData.noPick)return;let q=o,inHands=false;while(q){if(q.name==='hands')inHands=true;q=q.parent}
  if(!inHands)return;const cnt=o.geometry.attributes.position.count,step=Math.max(1,Math.floor(cnt/400));
  for(let i=0;i<cnt;i+=step)pts.push(world(o,i))});
 let gap=1e9,hit=0;
 for(const[x,y,z]of pts){let above=1e9;
  for(const[a,b,c]of tris){const d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(d)<1e-12)continue;
   const l1=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d,l2=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d,l3=1-l1-l2;
   if(l1<-1e-6||l2<-1e-6||l3<-1e-6)continue;above=Math.min(above,l1*a[1]+l2*b[1]+l3*c[1])}
  if(above<1e9){hit++;gap=Math.min(gap,above-y)}}
 return{gap,hit,points:pts.length}});
const hasCyclops=()=>{let f=false;window.__watchView.watch.traverse(o=>{if(o.isMesh&&o.name==='cyclops')f=true});return f};
const panel=(p,name)=>p.evaluate(n=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim().startsWith(n));b&&b.click()},name);

export async function run({page,ready,until,press,expect,url}){
 const p=await page();
 await p.goto(url);await ready(p);

 /* a new design has a domed crystal: the cyclops is offered but explains itself */
 await panel(p,'Crystal');
 expect(await until(p,()=>[...document.querySelectorAll('label')].some(l=>/Cyclops/.test(l.textContent)),null,30000),'the Crystal panel offers a cyclops');
 expect(await p.evaluate(()=>{const i=[...document.querySelectorAll('label')].find(l=>/Cyclops/.test(l.textContent)).querySelector('input');
  return i.disabled&&/flat or box crystal/.test(document.body.textContent)}),'on a domed crystal it is disabled, and says why');

 /* the crystal is a solid clearing the hands: above every point of them there is glass, and a gap under it */
 const dome=await clearance(p);
 expect(dome.hit===dome.points&&dome.gap>0,`the domed crystal clears the hands everywhere (${dome.gap.toFixed(2)} mm at the closest, ${dome.hit}/${dome.points} points under glass)`);

 /* flat crystal, then the cyclops */
 await panel(p,'Case');
 await until(p,()=>!!document.querySelector('button[aria-label="Crystal: Flat"]'),null,30000);
 let uuid=await p.evaluate(()=>window.__watchView.watch.uuid);
 await press(p,'Crystal: Flat');
 expect(await until(p,u=>window.__watchView.watch.uuid!==u,uuid,120000),'Crystal: Flat rebuilds the watch');
 const flat=await clearance(p);
 expect(flat.hit===flat.points&&flat.gap>0,`the flat crystal clears the hands everywhere (${flat.gap.toFixed(2)} mm at the closest)`);
 const glass=await extents(p,"o.name==='crystal'");
 await panel(p,'Crystal');
 await until(p,()=>{const l=[...document.querySelectorAll('label')].find(l=>/Cyclops/.test(l.textContent));return l&&!l.querySelector('input').disabled},null,30000);
 uuid=await p.evaluate(()=>window.__watchView.watch.uuid);
 await p.evaluate(()=>[...document.querySelectorAll('label')].find(l=>/Cyclops/.test(l.textContent)).querySelector('input').click());
 expect(await until(p,hasCyclops,null,120000),'ticking Cyclops builds a lens');
 const lens=await extents(p,"o.name==='cyclops'"),frame=await extents(p,"o.name==='dateFrame'");
 const off=Math.hypot((lens.x0+lens.x1)/2-(frame.x0+frame.x1)/2,(lens.z0+lens.z1)/2-(frame.z0+frame.z1)/2);
 expect(off<.2,`the lens is centred over the date window (${off.toFixed(2)} mm off)`);
 expect(lens.x1-lens.x0>frame.x1-frame.x0&&lens.z1-lens.z0>frame.z1-frame.z0,'and covers it');
 expect(Math.abs(lens.y0-glass.y1)<.05||lens.y0>=glass.y0,'it sits on the crystal');
 expect(await until(p,()=>/"cyclops":true/.test(localStorage.getItem('ws:auto')||''),null,20000),'the cyclops is saved');
 await p.reload();await ready(p);
 expect(await until(p,hasCyclops,null,120000),'and survives a reload');
 expect(!p.errors.length,'no page errors '+JSON.stringify(p.errors.slice(0,3)))}
