/* 3D print export — the watch as a 3MF, one solid object per part, in mm.

   The 3D model is built to be looked at: a dial is a sheet, printing and lume
   are decals, a traced hand is a top and walls standing open on the dial. A
   slicer wants closed solids. So each part's meshes are brought into one frame,
   welded (vertices within a micron joined, degenerate triangles dropped), and
   every opening left in them that lies in a plane — a hand's or an index's
   underside, a strap's cut ends, a crystal's rim — is capped. Sheets with no
   thickness (decals, printing, contact shadows) are left out. What stays open is reported, part by part, so a slicer's repair
   is never a surprise.

   3MF rather than STL: it carries millimetres (an STL has no units), a name and
   a colour per object, and every current slicer reads it. The watch lies dial
   up on the build plate, its lowest point on it. */
import {Vector3,BufferGeometry,Float32BufferAttribute,ShapeUtils,Vector2} from 'three';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {exportWatch} from './glb.js';
import {disposeHead} from '../core/three/watch.js';
import {reliefReady} from '../core/three/relief.js';
import {headProfiles,lathe,crownParts,bendGeometry} from '../core/three/lathe.js';
import {shapedProfile} from '../core/three/casebody.js';
import {outlinesOf,openingShaped,caseBendOf} from '../core/geometry.js';
import {zip} from './zip.js';
import {store} from '../state/store.js';
import {toast} from '../core/utils.js';

const WELD=1e-3,SHEET_MM=.012;

/* one part's triangles in the watch's own frame, as a flat position list */
function partTriangles(group){const out=[],v=new Vector3();
 group.updateMatrixWorld(true);
 group.traverse(o=>{if(!o.isMesh||!o.visible)return;
  const g=o.geometry,p=g.attributes.position;if(!p)return;
  /* a sheet — a decal, printing, a shadow — has no inside to print */
  g.computeBoundingBox();const sz=new Vector3();g.boundingBox.getSize(sz);
  const m=[].concat(o.material)[0];
  if(Math.min(sz.x,sz.y,sz.z)<SHEET_MM)return;
  /* a blended decal has no body; an alpha-tested strap has one, its holes punched
     only in its picture — it prints whole. The holes' own walls are open tubes. */
  if(m&&m.transparent&&!/crystal|cyclops/.test(o.name))return;
  if(/holeWalls/.test(o.name))return;
  /* lume is paint, laid in after: its fills are decals, bent to a hand's curve
     but with no body of their own */
  if(/lume/i.test(o.name))return;
  const idx=g.index?g.index.array:null,n=idx?idx.length:p.count;
  for(let i=0;i<n;i++){v.fromBufferAttribute(p,idx?idx[i]:i).applyMatrix4(o.matrixWorld);out.push(v.x,v.y,v.z)}});
 return out}

/* Where two surfaces meet with different tessellations — a crown's knurling,
   hundreds of teeth round, against its plain end turned in 72 steps — the seam
   has vertices on one side that the other side's edges pass straight by: a
   T-junction, and to a slicer an open edge. Every edge used by one triangle only
   is split at the open vertices lying on it, until none is left to split. */
function closeTJunctions(pos,tri,tol=.008){
 for(let pass=0;pass<10;pass++){
  const use=new Map(),key=(a,b)=>a<b?a+','+b:b+','+a;
  for(let i=0;i<tri.length;i+=3)for(let k=0;k<3;k++){const kk=key(tri[i+k],tri[i+(k+1)%3]);use.set(kk,(use.get(kk)||0)+1)}
  /* the open edges' vertices, in a coarse spatial hash */
  const openV=new Set(),H=new Map(),cell=.25,hk=(x,y,z)=>Math.floor(x/cell)+','+Math.floor(y/cell)+','+Math.floor(z/cell);
  for(const[kk,n]of use)if(n===1)for(const v of kk.split(','))openV.add(+v);
  if(!openV.size)return;
  for(const v of openV){const h=hk(pos[v*3],pos[v*3+1],pos[v*3+2]);(H.get(h)||H.set(h,[]).get(h)).push(v)}
  let split=0;const out=[];
  for(let i=0;i<tri.length;i+=3){const t=[tri[i],tri[i+1],tri[i+2]];let done=false;
   for(let k=0;k<3&&!done;k++){const a=t[k],b=t[(k+1)%3],c=t[(k+2)%3];if(use.get(key(a,b))!==1)continue;
    const ax=pos[a*3],ay=pos[a*3+1],az=pos[a*3+2],dx=pos[b*3]-ax,dy=pos[b*3+1]-ay,dz=pos[b*3+2]-az,L2=dx*dx+dy*dy+dz*dz;if(L2<1e-12)continue;
    /* the open vertices strictly between a and b, within tol of the edge */
    const on=[],x0=Math.min(ax,ax+dx)-tol,x1=Math.max(ax,ax+dx)+tol,y0=Math.min(ay,ay+dy)-tol,y1=Math.max(ay,ay+dy)+tol,z0=Math.min(az,az+dz)-tol,z1=Math.max(az,az+dz)+tol;
    for(let gx=Math.floor(x0/cell);gx<=Math.floor(x1/cell);gx++)for(let gy=Math.floor(y0/cell);gy<=Math.floor(y1/cell);gy++)for(let gz=Math.floor(z0/cell);gz<=Math.floor(z1/cell);gz++){
     const list=H.get(gx+','+gy+','+gz);if(!list)continue;
     for(const v of list){if(v===a||v===b)continue;const px=pos[v*3]-ax,py=pos[v*3+1]-ay,pz=pos[v*3+2]-az,s=(px*dx+py*dy+pz*dz)/L2;
      if(s<=1e-4||s>=1-1e-4)continue;const ex=px-s*dx,ey=py-s*dy,ez=pz-s*dz;if(ex*ex+ey*ey+ez*ez<=tol*tol)on.push([s,v])}}
    if(!on.length)continue;
    on.sort((p,q)=>p[0]-q[0]);const chain=[a,...on.map(p=>p[1]),b];
    for(let q=0;q<chain.length-1;q++)out.push(chain[q],chain[q+1],c);
    done=true;split++}
   if(!done)out.push(t[0],t[1],t[2])}
  /* copied back one by one: a spread of this many arguments overflows the stack */
  tri.length=out.length;for(let i=0;i<out.length;i++)tri[i]=out[i];if(!split)return}}

/* weld, then cap every planar opening: {pos, tri, open, capped} */
function solidify(flat){
 const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(flat,3));
 const w=mergeVertices(g,WELD);g.dispose();
 const P=w.attributes.position,I=w.index.array,tri=[];
 const pos=[];for(let i=0;i<P.count;i++)pos.push(P.getX(i),P.getY(i),P.getZ(i));w.dispose();
 /* welding collapses some triangles to slivers of no area — a knurl's closing
    ring where a tooth runs out onto its land — and those leave an edge shared by
    three faces; they and exact duplicates are dropped */
 const seenT=new Set();
 for(let i=0;i<I.length;i+=3){const a=I[i],b=I[i+1],c=I[i+2];if(a===b||b===c||a===c)continue;
  const ux=pos[b*3]-pos[a*3],uy=pos[b*3+1]-pos[a*3+1],uz=pos[b*3+2]-pos[a*3+2],vx=pos[c*3]-pos[a*3],vy=pos[c*3+1]-pos[a*3+1],vz=pos[c*3+2]-pos[a*3+2];
  const cx=uy*vz-uz*vy,cy=uz*vx-ux*vz,cz=ux*vy-uy*vx;if(cx*cx+cy*cy+cz*cz<1e-14)continue;
  const k=[a,b,c].sort((p,q)=>p-q).join(',');if(seenT.has(k))continue;seenT.add(k);
  tri.push(a,b,c)}
 closeTJunctions(pos,tri);
 const repaired=tri.slice();
 /* edges used once are the openings, kept directed as their triangle runs them,
    so a cap run the other way faces out as the surface round it does */
 const edges=new Map(),key=(a,b)=>a+','+b;
 const count=()=>{edges.clear();for(let i=0;i<tri.length;i+=3)for(let k=0;k<3;k++){const a=tri[i+k],b=tri[i+(k+1)%3];
  const r=key(b,a);if(edges.has(r))edges.delete(r);else edges.set(key(a,b),[a,b])}};
 count();
 const next=new Map();for(const[a,b]of edges.values())next.set(a,b);
 const seen=new Set();let capped=0;
 const V=i=>[pos[i*3],pos[i*3+1],pos[i*3+2]];
 const loops=[];
 for(const[a0]of edges.values()){if(seen.has(a0))continue;
  const loop=[];let a=a0,guard=0;while(!seen.has(a)&&next.has(a)&&guard++<1e6){seen.add(a);loop.push(a);a=next.get(a)}
  if(a===a0&&loop.length>=3)loops.push(loop)}
 /* A ring-shaped part — a bezel, the case round its opening — is open in two
    rings underneath, an outer and an inner, both round the watch's axis. Each
    capped with its own disc, the inner disc would be a membrane across the dial.
    So rings round the axis are joined in pairs, outermost first, by a strip
    between them (the part's underside); an odd one left over, and every other
    opening, is capped flat. */
 const ang=v=>Math.atan2(pos[v*3+2],pos[v*3]),rad=v=>Math.hypot(pos[v*3],pos[v*3+2]);
 const turn=L=>{let t=0;for(let i=0;i<L.length;i++){let d=ang(L[(i+1)%L.length])-ang(L[i]);if(d>Math.PI)d-=2*Math.PI;if(d<-Math.PI)d+=2*Math.PI;t+=d}return t};
 /* a ring: once round the axis, and near round — not a hand's outline, which
    crosses the centre and so goes round it too */
 const rings=loops.map(L=>{const rs=L.map(rad),r=rs.reduce((s,x)=>s+x,0)/rs.length;
   return{L,r,y:L.reduce((s,v)=>s+pos[v*3+1],0)/L.length,t:turn(L),spread:(Math.max(...rs)-Math.min(...rs))/r}})
  .filter(R=>Math.abs(Math.abs(R.t)-2*Math.PI)<.5&&R.r>.5&&R.spread<.4);
 /* the two edges of one underside run opposite ways round: pair each ring with
    the nearest ring running the other way, nearest pairs first */
 const pairs=[];
 for(let i=0;i<rings.length;i++)for(let j=i+1;j<rings.length;j++)if(Math.sign(rings[i].t)!==Math.sign(rings[j].t))
  pairs.push([Math.abs(rings[i].r-rings[j].r)+Math.abs(rings[i].y-rings[j].y),i,j]);
 pairs.sort((p,q)=>p[0]-q[0]);
 const joined=new Set(),used=new Set(),caps=[];
 for(const[,i,j]of pairs){if(used.has(i)||used.has(j))continue;used.add(i);used.add(j);
  const from=tri.length;bridge(rings[i].L,rings[j].L);caps.push([from,tri.length]);joined.add(rings[i].L);joined.add(rings[j].L)}
 function bridge(L1,L2){
  /* both walked the same way round, from their own smallest angle, angles unwound */
  const fwd=L=>turn(L)>0?L:[...L].reverse();
  const from=L=>{let k=0,m=Infinity;L.forEach((v,i)=>{const t=ang(v);if(t<m){m=t;k=i}});return L.slice(k).concat(L.slice(0,k))};
  const unwound=L=>{const t=[ang(L[0])];for(let i=1;i<L.length;i++){let d=ang(L[i])-ang(L[i-1]);if(d<-Math.PI)d+=2*Math.PI;if(d>Math.PI)d-=2*Math.PI;t.push(t[i-1]+d)}
   t.push(t[0]+2*Math.PI);return t};
  const A=from(fwd(L1)),B=from(fwd(L2)),ta=unwound(A),tb=unwound(B);A.push(A[0]);B.push(B[0]);
  const strip=[];let i=0,j=0;
  while(i<A.length-1||j<B.length-1){
   if(j>=B.length-1||(i<A.length-1&&ta[i+1]<=tb[j+1])){strip.push(A[i],B[j],A[i+1]);i++}
   else{strip.push(A[i],B[j],B[j+1]);j++}}
  /* wound against the surface's own edges along the rings, as a cap is */
  let same=0,against=0;
  for(let q=0;q<strip.length;q+=3)for(let k=0;k<3;k++){const p=strip[q+k],n=strip[q+(k+1)%3];
   if(edges.has(key(p,n)))same++;else if(edges.has(key(n,p)))against++}
  const flip=same>against;
  for(let q=0;q<strip.length;q+=3)if(flip)tri.push(strip[q],strip[q+2],strip[q+1]);else tri.push(strip[q],strip[q+1],strip[q+2])}
 /* The rest capped flat — together where they share a plane: every traced
    part's underside lies on the dial, and an outline can hold another inside it
    (two batons that touch trace as one outline round a gap), which is a hole in
    its cap, not a second cap over it. */
 const flatLoops=[];
 for(const loop of loops){if(joined.has(loop))continue;
  let nx=0,ny=0,nz=0;
  for(let i=0;i<loop.length;i++){const[x0,y0,z0]=V(loop[i]),[x1,y1,z1]=V(loop[(i+1)%loop.length]);
   nx+=(y0-y1)*(z0+z1);ny+=(z0-z1)*(x0+x1);nz+=(x0-x1)*(y0+y1)}
  const nl=Math.hypot(nx,ny,nz);if(nl<1e-9)continue;nx/=nl;ny/=nl;nz/=nl;
  const c=loop.map(V),d0=c.reduce((q,p)=>q+p[0]*nx+p[1]*ny+p[2]*nz,0)/c.length;
  if(Math.max(...c.map(p=>Math.abs(p[0]*nx+p[1]*ny+p[2]*nz-d0)))>.05)continue;
  flatLoops.push({loop,n:[nx,ny,nz],d:d0})}
 /* planes shared: normals along the same line, offsets together */
 const groups=[];
 for(const F of flatLoops){const g=groups.find(G=>{const dot=G.n[0]*F.n[0]+G.n[1]*F.n[1]+G.n[2]*F.n[2];
   /* opposite normals: the same plane has the opposite offset */
   return Math.abs(Math.abs(dot)-1)<1e-3&&Math.abs(G.d-Math.sign(dot)*F.d)<.02});
  if(g)g.loops.push(F);else groups.push({n:F.n,d:F.d,loops:[F]})}
 for(const G of groups){const[nx,ny,nz]=G.n,ref=Math.abs(nx)<.9?[1,0,0]:[0,1,0];
  const e1=[ny*ref[2]-nz*ref[1],nz*ref[0]-nx*ref[2],nx*ref[1]-ny*ref[0]],l1=Math.hypot(...e1);e1[0]/=l1;e1[1]/=l1;e1[2]/=l1;
  const e2=[ny*e1[2]-nz*e1[1],nz*e1[0]-nx*e1[2],nx*e1[1]-ny*e1[0]];
  const P2=v=>{const p=V(v);return new Vector2(p[0]*e1[0]+p[1]*e1[1]+p[2]*e1[2],p[0]*e2[0]+p[1]*e2[1]+p[2]*e2[2])};
  const L=G.loops.map(F=>{const pts=F.loop.map(P2);return{loop:F.loop,pts,area:Math.abs(ShapeUtils.area(pts))}});
  const inside=(p,poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];
   if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/((b.y-a.y)||1e-12)+a.x)c=!c}return c};
  /* each loop's parent: the smallest loop holding it; depth even is an outline, odd a hole */
  for(const A of L){A.parent=null;for(const B of L)if(B!==A&&B.area>A.area&&inside(A.pts[0],B.pts)&&(!A.parent||B.area<A.parent.area))A.parent=B}
  const depth=A=>{let k=0,q=A.parent;while(q){k++;q=q.parent}return k};
  for(const A of L){if(depth(A)%2)continue;
   const holes=L.filter(H=>H.parent===A&&depth(H)%2);
   const from=tri.length;
   const verts=A.loop.concat(...holes.map(H=>H.loop)),faces=ShapeUtils.triangulateShape(A.pts,holes.map(H=>H.pts));
   const all=A.pts.concat(...holes.map(H=>H.pts)),want=-Math.sign(ShapeUtils.area(A.pts));
   /* the cap runs against the outline's own edges */
   for(const[i,j,k]of faces){const sa=ShapeUtils.area([all[i],all[j],all[k]]);
    if(Math.sign(sa)===want||!sa)tri.push(verts[i],verts[j],verts[k]);else tri.push(verts[i],verts[k],verts[j])}
   caps.push([from,tri.length])}}
 /* Capping must never make a part worse. A cap that leaves an edge shared by
    three faces — its opening did not chain into a clean loop, or it overlapped
    another — is taken back out, and that opening reported for the slicer to
    close; the caps that fit stay. */
 const use=new Map(),ek=(a,b)=>a<b?a+','+b:b+','+a;
 for(let i=0;i<tri.length;i+=3)for(let k=0;k<3;k++){const kk=ek(tri[i+k],tri[i+(k+1)%3]);use.set(kk,(use.get(kk)||0)+1)}
 const bad=([a,b])=>{for(let i=a;i<b;i+=3)for(let k=0;k<3;k++)if(use.get(ek(tri[i+k],tri[i+(k+1)%3]))>2)return true;return false};
 const keep=caps.filter(c=>!bad(c)),out=repaired.slice();
 for(const[a,b]of keep)for(let i=a;i<b;i++)out.push(tri[i]);
 tri.length=0;for(const x of out)tri.push(x);capped=keep.length;
 count();
 return{pos,tri,open:edges.size,capped}}

/* how many edges are shared by more than two faces */
function manifoldBreaks(tri){const u=new Map();
 for(let i=0;i<tri.length;i+=3)for(let k=0;k<3;k++){const a=tri[i+k],b=tri[i+(k+1)%3],kk=a<b?a+','+b:b+','+a;u.set(kk,(u.get(kk)||0)+1)}
 let n=0;for(const v of u.values())if(v>2)n++;return n}

const COLOURS={head:'#C9CED6',lugs:'#C9CED6',crown:'#AEB4BC','dial details':'#3C5A80',strap:'#2A2B2E',markers:'#E6E8EC',hands:'#E6E8EC',crystal:'#DDEEFF'};

/* a geometry's triangles, moved by a matrix, as a flat position list */
function geoTriangles(g,m){const p=g.attributes.position,idx=g.index?g.index.array:null,n=idx?idx.length:p.count,v=new Vector3(),out=[];
 for(let i=0;i<n;i++){v.fromBufferAttribute(p,idx?idx[i]:i);if(m)v.applyMatrix4(m);out.push(v.x,v.y,v.z)}return out}

/* The head — case, bezel, the flange and the dial across it — as one solid.
   Its profiles (lathe.js headProfiles) run end to end from the caseback's centre
   out and up to the bezel and in down the flange to the dial; closed along the
   dial to the axis and down the axis, the outline is turned (a round case) or
   swept round the case's outline (a shaped one) into a solid that is closed by
   construction — no seams between strips to repair. */
function headSolid(d,mat){const P=headProfiles(d).profiles,OL=outlinesOf(d),A0=OL.case.A0;
 const shaped=OL.case.kind!=='round'||OL.bezel.kind!=='round',open=openingShaped(d);
 const pts=[],tag=[];const put=(list,t)=>{for(const p of list){const q=pts[pts.length-1];if(q&&q.distanceTo(p)<1e-4)continue;pts.push(p.clone());tag.push(t)}};
 put(P.caseback,'case');put(P.casebackRim,'case');put(P.flank,'case');put(P.flankEdge,'case');put(P.chamfer,'case');put(P.chamferEdge,'case');
 put(P.bezelFlank,'bezel');put(P.bezelEdge,'bezel');put(P.bezelTop,'bezel');put(P.bezelInner,'bezel');
 put(P.rehaut.slice(0,1),'bezel');put(P.rehaut.slice(1),open?'bezel':'round');
 const dial=pts[pts.length-1];put([new Vector2(0,dial.y),new Vector2(0,0)],'round');
 /* near the axis every outline is a circle: a shaped outline set in that far has nothing left */
 const shapeAt=i=>({from:pts[i].x<A0*.35?'round':tag[i]});
 const g=shaped?shapedProfile(pts,shapeAt,OL):lathe(pts,200);
 /* a curved case prints curved, as it is drawn */
 bendGeometry(g,caseBendOf(d));
 const out=geoTriangles(g,mat);g.dispose();return out}

/* The crown and its tube as one solid: the tube's axis from inside the case to
   the barrel, the barrel's base, its side, the domed end back to the axis —
   turned round the crown's own axis. The knurling is left smooth: its teeth,
   a third of a millimetre, are finer than a printer lays them down. */
function crownSolid(d,mat){const cp=crownParts(d),rb=cp.inner[cp.inner.length-1].x,tube=cp.tube.r,back=cp.tube.x0-cp.barrelX;
 const pts=[new Vector2(0,back),new Vector2(tube,back),...cp.inner,...cp.side,...cp.end];
 if(pts[pts.length-1].x>1e-6)pts.push(new Vector2(0,pts[pts.length-1].y));
 const g=lathe(pts.filter((p,i)=>!i||p.distanceTo(pts[i-1])>1e-5),96);
 g.rotateZ(-Math.PI/2);g.translate(cp.barrelX,0,0);
 const out=geoTriangles(g,mat);g.dispose();return out}

/* the triangles of a group's meshes whose names match */
function namedTriangles(group,re){const out=[];group.updateMatrixWorld(true);
 group.traverse(o=>{if(o.isMesh&&re.test(o.name))for(const x of geoTriangles(o.geometry,o.matrixWorld))out.push(x)});return out}

/* faces outward: a solid's signed volume is positive, or every triangle is turned */
function outward(o){let v=0;const p=o.pos,t=o.tri;
 for(let i=0;i<t.length;i+=3){const a=t[i]*3,b=t[i+1]*3,c=t[i+2]*3;
  v+=p[a]*(p[b+1]*p[c+2]-p[b+2]*p[c+1])-p[a+1]*(p[b]*p[c+2]-p[b+2]*p[c])+p[a+2]*(p[b]*p[c+1]-p[b+1]*p[c])}
 if(v<0)for(let i=0;i<t.length;i+=3){const x=t[i+1];t[i+1]=t[i+2];t[i+2]=x}
 return o}

/* the watch as solid parts: {objects:[{name,pos,tri,open,capped}], xml} */
export async function designToPrint(d,customs={}){
 await reliefReady;
 const w=await exportWatch(d,customs);
 const objects=[];const add=(name,flat)=>{if(flat.length)objects.push(outward({name,...solidify(flat)}))};
 try{w.updateMatrixWorld(true);const G=n=>w.getObjectByName(n);
  if(G('case'))add('head',headSolid(d,G('case').matrixWorld));
  if(G('case'))add('lugs',namedTriangles(G('case'),/^(lugs|lugEdges|guards|guardEdges)$/));
  const cg=G('crown'),grp=cg&&cg.children.find(c=>c.isGroup);
  if(grp){grp.updateMatrixWorld(true);add('crown',crownSolid(d,grp.matrixWorld).concat(namedTriangles(cg,/^pusher/)))}
  /* on the dial: a sculpted dial's plates and the date's frame stand on the head's dial */
  if(G('dial'))add('dial details',namedTriangles(G('dial'),/^(dialPlates|dateFrame|logo)$/));
  for(const part of['markers','hands','strap','crystal']){const grp=G(part);if(grp)add(part,partTriangles(grp))}}
 finally{disposeHead(w)}
 /* dial up on the plate: three's y is up, a printer's z; lowest point at 0 */
 let zMin=Infinity;for(const o of objects)for(let i=1;i<o.pos.length;i+=3)zMin=Math.min(zMin,o.pos[i]);
 const f=x=>+x.toFixed(4);
 const mats=objects.map(o=>`<base name="${o.name}" displaycolor="${COLOURS[o.name]||'#CCCCCC'}"/>`).join('');
 const objs=objects.map((o,k)=>{const Vs=[];for(let i=0;i<o.pos.length;i+=3)Vs.push(`<vertex x="${f(o.pos[i])}" y="${f(-o.pos[i+2])}" z="${f(o.pos[i+1]-zMin)}"/>`);
  const Ts=[];for(let i=0;i<o.tri.length;i+=3)Ts.push(`<triangle v1="${o.tri[i]}" v2="${o.tri[i+1]}" v3="${o.tri[i+2]}"/>`);
  return`<object id="${k+2}" type="model" name="${o.name}" pid="1" pindex="${k}"><mesh><vertices>${Vs.join('')}</vertices><triangles>${Ts.join('')}</triangles></mesh></object>`}).join('');
 const xml=`<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
<metadata name="Application">WatchStudio</metadata>
<resources><basematerials id="1">${mats}</basematerials>${objs}</resources>
<build>${objects.map((o,k)=>`<item objectid="${k+2}"/>`).join('')}</build>
</model>`;
 return{objects,xml}}

export async function designTo3MF(d,customs={}){const{objects,xml}=await designToPrint(d,customs);
 const files=[
  {name:'[Content_Types].xml',data:'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>'},
  {name:'_rels/.rels',data:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>'},
  {name:'3D/3dmodel.model',data:xml}];
 return{blob:zip(files),objects}}

export async function exportPrint(){const s=store.getState();
 toast('Building the print model…');
 let r;try{r=await designTo3MF(s.d,s.customs)}catch(e){console.error('WatchStudio: 3MF export failed',e);toast('Print model export failed');return}
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([r.blob],{type:'model/3mf'}));
 a.download=`${s.projName.replace(/\s+/g,'_')}.3mf`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),6000);
 const open=r.objects.filter(o=>o.open).map(o=>o.name);
 toast(open.length?`Print model exported — ${open.join(', ')} still have open edges; your slicer will close them`
  :`Print model exported (${r.objects.length} closed parts, in mm)`)}
