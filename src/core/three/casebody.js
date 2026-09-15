/* The case's horns and guards as one piece with the case.

   A real case is forged or milled from one block: the lugs grow out of it. So
   each lug here is a single solid swept from inside the case band out to its
   tip, not a slab pushed into the wall:

     plan     its sides run into the case wall through a fillet (a concave
              radius where lug meets band, on both sides), then run straight to
              a rounded tip at the lug-to-lug
     top      rises out of the case chamfer, just under the bezel, and sweeps
              down toward the wrist by the lug drop
     under    flows down into the case band near the case, then lifts clear
     section  a flat top with rounded bevels onto its sides; the bevels are
              their own faces, so a brushed case keeps polished lug edges

   Styles: straight; twisted (a lyre lug: its outer flank sweeps outward toward the tip and
   its outer edge is cut to a broad polished bevel that widens as it goes);
   hooded (square tips joined across the strap by a hood). Spring-bar holes can
   be drilled through the outer flank. Crown guards are swept the same way,
   along the crown's axis.

   Everything is built in a local frame — `lat` across the part, `s` out along
   it — and placed by `toWorld`. Units mm, y up out of the dial. */
import {BufferGeometry,Float32BufferAttribute,CylinderGeometry} from 'three';
import {lugParts,headHeights,headRadii,bandOf,crownParts,smoothstep} from './lathe.js';
import {geoOf,caseOf,crownAng} from '../geometry.js';
import {PX} from '../constants.js';

const lerp=(a,b,t)=>a+(b-a)*t;

/* A polyline resampled into n+1 points: `marks` split it into sections, each
   taking its share of the stations, so corresponding sections of two edges line
   up (fillet with fillet, straight with straight, tip with tip). */
function resample(sections,shares,n){const out=[];
 sections.forEach((pts,si)=>{
  if(pts.length<2)pts=[pts[0],pts[0]];              /* a section that is one point */
  const len=[0];for(let i=1;i<pts.length;i++)len.push(len[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
  const L=len[len.length-1]||1e-9,m=Math.max(1,Math.round(n*shares[si]));
  for(let k=si?1:0;k<=m;k++){const want=L*k/m;let j=1;while(j<len.length-1&&len[j]<want)j++;
   const t=(want-len[j-1])/((len[j]-len[j-1])||1e-9);
   out.push([lerp(pts[j-1][0],pts[j][0],t),lerp(pts[j-1][1],pts[j][1],t)])}});
 return out}

/* One edge of a horn in its local frame: lateral e, the case circle R, a fillet
   of radius rf into it on the side given by sigma (-1 the edge faces toward the
   axis, +1 away from it), a straight run to sTipStart, then the tip. */
function edge(e,sigma,R,rf,sTipStart,tip){
 const cx=e+sigma*rf,cz=Math.sqrt(Math.max(0,(R+rf)**2-cx*cx));
 const onCircle=[cx*R/(R+rf),cz*R/(R+rf)],inside=[onCircle[0]*(R-1.8)/R,onCircle[1]*(R-1.8)/R];
 const a1=Math.atan2(-cz,-cx),a0=sigma<0?0:Math.PI;
 let dA=a0-a1;while(dA>Math.PI)dA-=2*Math.PI;while(dA<-Math.PI)dA+=2*Math.PI;
 const fillet=[];for(let k=0;k<=10;k++){const a=a1+dA*k/10;fillet.push([cx+rf*Math.cos(a),cz+rf*Math.sin(a)])}
 const run=[[e,cz],[e,Math.max(cz+.01,sTipStart)]];
 return[[inside,onCircle],fillet,run,tip]}

/* Sweep a section along paired edges.
   stations: [{inner:[lat,s], outer:[lat,s]}] from inside the case to the tip
   toWorld(lat,s) -> [x,z]; heights(x,z,s) -> {top,bot}
   strips(k,W,h) -> the section at station k: strips of points {dx, ref, off, zone},
     dx mm from the inner edge, y = top-off (ref 'top') or bot+off (ref 'bot')
   capEnd: close the last station with a face.
   Returns {geometry, surface, bevel} (index lists into it). */
function sweep(stations,{toWorld,heights,strips,capEnd=false,tilt=()=>0}){
 const pos=[],uv=[],surface=[],bevel=[];
 const place=(k,pt)=>{const S=stations[k],W=Math.hypot(S.outer[0]-S.inner[0],S.outer[1]-S.inner[1]);
  const t=W<1e-6?0:Math.min(1,Math.max(0,pt.dx/W));
  const lat=lerp(S.inner[0],S.outer[0],t),s=lerp(S.inner[1],S.outer[1],t),[x,z]=toWorld(lat,s),h=heights(x,z,s);
  const y=pt.ref==='top'?h.top-pt.off-tilt(k)*pt.dx:h.bot+pt.off;
  return[x,y,z]};
 const along=[0];for(let k=1;k<stations.length;k++){const a=stations[k-1],b=stations[k];
  along.push(along[k-1]+Math.hypot((a.inner[0]+a.outer[0]-b.inner[0]-b.outer[0])/2,(a.inner[1]+a.outer[1]-b.inner[1]-b.outer[1])/2))}
 const W0=k=>Math.hypot(stations[k].outer[0]-stations[k].inner[0],stations[k].outer[1]-stations[k].inner[1]);
 const per=stations.map((S,k)=>{const mid=toWorld((S.inner[0]+S.outer[0])/2,(S.inner[1]+S.outer[1])/2);return strips(k,W0(k),heights(mid[0],mid[1],(S.inner[1]+S.outer[1])/2))});
 const tris=[];                                     /* [a,b,c,zone] */
 per[0].forEach((strip,si)=>{const base=pos.length/3,np=strip.length;
  for(let k=0;k<stations.length;k++){let v=0,prev=null;
   for(let j=0;j<np;j++){const p=place(k,per[k][si][j]);if(prev)v+=Math.hypot(p[0]-prev[0],p[1]-prev[1],p[2]-prev[2]);prev=p;
    pos.push(...p);uv.push(along[k],v)}}
  for(let k=0;k<stations.length-1;k++)for(let j=0;j<np-1;j++){
   const a=base+k*np+j,b=base+(k+1)*np+j,c=base+(k+1)*np+j+1,e=base+k*np+j+1,zone=strip[j].zone||'surface';
   tris.push([a,b,c,zone],[a,c,e,zone])}});
 /* the end face: a fan over the section's outline at the last station */
 if(capEnd){const k=stations.length-1,loop=[];
  for(const strip of per[k])for(const pt of strip){const p=place(k,pt);
   const last=loop[loop.length-1];if(!last||Math.hypot(p[0]-last[0],p[1]-last[1],p[2]-last[2])>1e-6)loop.push(p)}
  const c=loop.reduce((m,p)=>[m[0]+p[0]/loop.length,m[1]+p[1]/loop.length,m[2]+p[2]/loop.length],[0,0,0]);
  const base=pos.length/3;pos.push(...c);uv.push(along[k],0);
  loop.forEach(p=>{pos.push(...p);uv.push(along[k],0)});
  for(let i=0;i<loop.length;i++)tris.push([base,base+1+i,base+1+(i+1)%loop.length,'cap'])}
 /* Face it outward. The horn is open where it enters the case, so a volume test
    is unreliable; instead the faces, weighted by area, must point away from
    the part's own centre on the whole. */
 const P=i=>[pos[i*3],pos[i*3+1],pos[i*3+2]];let cx=0,cy=0,cz=0;const nv=pos.length/3;
 for(let i=0;i<nv;i++){cx+=pos[i*3]/nv;cy+=pos[i*3+1]/nv;cz+=pos[i*3+2]/nv}
 let out=0;
 for(const[a,b,c]of tris){const A=P(a),B=P(b),C=P(c),u=[B[0]-A[0],B[1]-A[1],B[2]-A[2]],v=[C[0]-A[0],C[1]-A[1],C[2]-A[2]];
  const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  out+=n[0]*((A[0]+B[0]+C[0])/3-cx)+n[1]*((A[1]+B[1]+C[1])/3-cy)+n[2]*((A[2]+B[2]+C[2])/3-cz)}
 const flip=out<0;
 for(const[a,b,c,zone]of tris){const tri=flip?[a,c,b]:[a,b,c];(zone==='bevel'?bevel:surface).push(...tri)}
 const geometry=new BufferGeometry();
 geometry.setAttribute('position',new Float32BufferAttribute(pos,3));geometry.setAttribute('uv',new Float32BufferAttribute(uv,2));
 geometry.setIndex([...surface,...bevel]);geometry.computeVertexNormals();
 /* where a tip closes to a point, a vertex can be touched only by zero-area
    triangles: give it an upward normal rather than none */
 {const n=geometry.attributes.normal;for(let i=0;i<n.count;i++){const l=Math.hypot(n.getX(i),n.getY(i),n.getZ(i));if(!(l>1e-6))n.setXYZ(i,0,1,0)}}
 return{geometry,surface,bevel}}

/* a round quarter from the wall top (dx0, off b) to the top (dx1, off 0), n segments */
const arc=(dx0,dx1,b,n,zone,reverse=false)=>{const o=[];
 for(let i=1;i<n;i++){const a=i/n*Math.PI/2,w=reverse?dx0-(dx0-dx1)*(1-Math.cos(a)):dx0+(dx1-dx0)*(1-Math.cos(a));
  o.push({dx:w,ref:'top',off:b*(1-Math.sin(a)),zone})}
 return o};

/* The section of a horn: `bi`/`bo` the inner and outer bevel sizes; `facet`
   cuts the outer edge to a flat polished bevel of width bo instead of a round. */
function hornSection(W,{bi,bo,facet=false,drop=0}){
 const top=[],n=4;
 for(let m=1;m<n;m++)top.push({dx:bi+(W-bi-bo)*m/n,ref:'top',off:0,zone:'surface'});
 const inner=[{dx:0,ref:'bot',off:0,zone:'surface'},{dx:0,ref:'top',off:bi,zone:'bevel'},...arc(0,bi,bi,4,'bevel'),{dx:bi,ref:'top',off:0,zone:'surface'},...top];
 if(!facet){
  const A=[...inner,{dx:W-bo,ref:'top',off:0,zone:'bevel'},...arc(W,W-bo,bo,4,'bevel',true).reverse(),{dx:W,ref:'top',off:bo,zone:'surface'},{dx:W,ref:'bot',off:0}];
  return[A,[{dx:W,ref:'bot',off:0,zone:'surface'},{dx:W/2,ref:'bot',off:0,zone:'surface'},{dx:0,ref:'bot',off:0}]]}
 /* a lyre lug: the top runs to the bevel, the bevel is a flat facet, then the wall */
 const A=[...inner,{dx:W-bo,ref:'top',off:0}];
 const F=[{dx:W-bo,ref:'top',off:0,zone:'bevel'},{dx:W,ref:'top',off:drop}];
 const D=[{dx:W,ref:'top',off:drop,zone:'surface'},{dx:W,ref:'bot',off:0}];
 return[A,F,D,[{dx:W,ref:'bot',off:0,zone:'surface'},{dx:W/2,ref:'bot',off:0,zone:'surface'},{dx:0,ref:'bot',off:0}]]}

/* the height of the case's top surface at radius rho: the chamfer cone from the
   band up to the seat, and the seat within it (lugs and guards stay under it) */
function chamferTop(rho,H,Rr,B){
 if(rho<=Rr.rSeat)return H.seat;
 if(rho>=B.rTop)return Infinity;
 return lerp(H.seat,B.y1,(rho-Rr.rSeat)/(B.rTop-Rr.rSeat))}

/* ---------------------------------------------------------------- lugs */

export function caseHorns(d){
 const H=headHeights(d),Rr=headRadii(d),B=bandOf(d,H,Rr),arch=caseOf(d),lp=lugParts(d),L=lp.plan;
 const R=Rr.rCase,style=arch.lugs,hooded=style==='hooded',twisted=style==='twisted';
 const sTip=L.tip,tipR=L.wt/2,sTipStart=hooded?sTip:sTip-tipR;
 const sCase=Math.sqrt(Math.max(0,R*R-L.xc*L.xc));
 const N=46;
 const shares=[.05,.2,.53,.22];
 const tipArc=sigma=>hooded?[[sigma<0?L.xi:L.xo,sTip]]
  :Array.from({length:9},(_,i)=>{const a=(sigma<0?Math.PI:0)+(sigma<0?-1:1)*(i/8)*Math.PI/2;return[L.xc+tipR*Math.cos(a),sTipStart+tipR*Math.sin(a)]});
 const inner=resample(edge(L.xi,-1,R,L.rf,sTipStart,[[L.xi,sTipStart],...tipArc(-1)]),shares,N);
 const outer=resample(edge(L.xo,1,R,L.rf,sTipStart,[[L.xo,sTipStart],...tipArc(1)]),shares,N);
 /* a lyre lug sweeps outward as it goes: its outer flank curves away while the
    inner face runs straight beside the strap, so the pair stays a strap's width apart */
 const lean=s=>twisted?L.wt*.45*Math.pow(smoothstep(sCase,sTip,s),2):0;
 /* ...except round the tip, where the inner edge follows so the tip stays round */
 const tipFollow=s=>smoothstep(sTipStart,sTip,s);
 const stations=inner.map((p,k)=>({inner:[p[0]+lean(p[1])*tipFollow(p[1]),p[1]],outer:[outer[k][0]+lean(outer[k][1]),outer[k][1]]}));
 const Hh=lp.heights,drop=lp.drop;
 const heights=(x,z,s)=>{const rho=Math.hypot(x,z),S=smoothstep(lp.z0,lp.z1,s);
  const sweepTop=lerp(Hh.topCase,Hh.top,smoothstep(sCase-.6,sCase+(sTip-sCase)*.6,s))-drop*S;
  const top=Math.min(chamferTop(rho,H,Rr,B)-.05,sweepTop);
  /* the underside leaves the band a quarter of the way up and lifts clear in a
     long concave sweep (an ease-out), not a tall flank running down to the caseback */
  const u=Math.min(1,Math.max(0,(s-sCase+.3)/Math.max(1,(sTip-sCase)*.7))),ease=1-(1-u)*(1-u);
  const bot=lerp(Hh.bandBottom,Hh.bottom,ease)-drop*S;
  return{top,bot:Math.min(bot,top-.4)}};
 const strips=(k,W,h)=>{const prog=k/(stations.length-1),t=Math.max(.2,h.top-h.bot);
  const bi=Math.min(twisted?.22:.42,W*.26,t*.3);
  if(twisted){const bo=Math.min(W*(.12+.34*prog),W-bi-.02,t*.9);return hornSection(W,{bi,bo:Math.max(0,bo),facet:true,drop:Math.max(0,Math.min(bo*.85,t*.6))})}
  return hornSection(W,{bi,bo:Math.min(.42,W*.26,t*.3)})};
 const parts=[],holes=[];
 const hole=(sx,sy,lat)=>{const sp=lp.springZ,x=sx*lat,z=sy*sp,h=heights(x,z,sp);
  holes.push({x,z,y:h.bot+(h.top-h.bot)*.5,sx,r:Math.min(.5,(h.top-h.bot)*.22)})};
 if(!hooded){
  for(const sy of[-1,1])for(const sx of[-1,1]){
   parts.push(sweep(stations,{toWorld:(lat,s)=>[sx*lat,sy*s],heights,strips,tilt:k=>twisted?.05*k/(stations.length-1):0}));
   if(arch.lugHoles)hole(sx,sy,L.xo+lean(lp.springZ))}}
 else{
  /* Hooded: each pair of lugs and the hood between them are one solid, its
     section a U turned over — the lugs' outer flanks, one top across, and a
     tunnel underneath the strap passes through. Square-ended at the lug tips. */
  const edgeOut=resample(edge(L.xo,1,R,L.rf,sTip,[[L.xo,sTip]]),shares,N);
  const hst=edgeOut.map(p=>({inner:[-p[0],p[1]],outer:[p[0],p[1]]}));
  const hoodT=Math.min(1.7,Math.max(.8,(Hh.top-Hh.bottom)*.55));
  const U=(k,W,h)=>{const X=W/2,t=Math.max(.2,h.top-h.bot),b=Math.min(.42,W*.1,t*.3),T=Math.min(hoodT,t-.3);
   const wl=Math.max(b+.05,X-L.xi),wr=Math.min(W-b-.05,X+L.xi),top=[];
   for(let m=1;m<8;m++)top.push({dx:b+(W-2*b)*m/8,ref:'top',off:0,zone:'surface'});
   return[[{dx:0,ref:'bot',off:0,zone:'surface'},{dx:0,ref:'top',off:b,zone:'bevel'},...arc(0,b,b,4,'bevel'),{dx:b,ref:'top',off:0,zone:'surface'},...top,
     {dx:W-b,ref:'top',off:0,zone:'bevel'},...arc(W,W-b,b,4,'bevel',true).reverse(),{dx:W,ref:'top',off:b,zone:'surface'},{dx:W,ref:'bot',off:0}],
    [{dx:W,ref:'bot',off:0,zone:'surface'},{dx:wr,ref:'bot',off:0}],
    [{dx:wr,ref:'bot',off:0,zone:'surface'},{dx:wr,ref:'top',off:T}],
    [{dx:wr,ref:'top',off:T,zone:'surface'},{dx:wl,ref:'top',off:T}],
    [{dx:wl,ref:'top',off:T,zone:'surface'},{dx:wl,ref:'bot',off:0}],
    [{dx:wl,ref:'bot',off:0,zone:'surface'},{dx:0,ref:'bot',off:0}]]};
  for(const sy of[-1,1]){parts.push(sweep(hst,{toWorld:(lat,s)=>[lat,sy*s],heights,strips:U,capEnd:true}));
   if(arch.lugHoles)for(const sx of[-1,1])hole(sx,sy,L.xo)}}
 return{parts,holes}}

/* ---------------------------------------------------------------- guards */

/* Crown guards on the sport case: two shoulders either side of the crown,
   swept along its axis from inside the band to just past the crown's barrel. */
export function crownGuards(d){
 if(d.parts.case.variant!=='sport')return[];
 const H=headHeights(d),Rr=headRadii(d),B=bandOf(d,H,Rr),g=geoOf(d),cp=crownParts(d);
 const R=Rr.rCase,cr=g.crownR/PX,gi=cr*.86,go=cr*1.95,sTip=R+cr,rf=Math.min(1.2,R*.05);
 const gh=Math.min(H.seat-H.back-.6,R*.34),top=cp.axisY+gh/2,bot=cp.axisY-gh/2;
 const b=(crownAng(d)-90)*Math.PI/180,cs=Math.cos(b),sn=Math.sin(b);
 const tipR=(go-gi)/2,xc=(gi+go)/2,sTipStart=sTip-tipR*.9;
 const N=30,shares=[.06,.24,.4,.3];
 const tipArc=sigma=>Array.from({length:9},(_,i)=>{const a=(sigma<0?Math.PI:0)+(sigma<0?-1:1)*(i/8)*Math.PI/2;return[xc+tipR*Math.cos(a),sTipStart+tipR*.9*Math.sin(a)]});
 const inner=resample(edge(gi,-1,R,rf,sTipStart,[[gi,sTipStart],...tipArc(-1)]),shares,N);
 const outer=resample(edge(go,1,R,rf,sTipStart,[[go,sTipStart],...tipArc(1)]),shares,N);
 const stations=inner.map((p,k)=>({inner:p,outer:outer[k]}));
 /* a guard's top falls away toward its tip, and its underside lifts a little,
    so it tapers like a shoulder rather than standing as a block */
 const heights=(x,z,s)=>{const u=smoothstep(R-.4,sTip,s);
  const t=Math.min(chamferTop(Math.hypot(x,z),H,Rr,B)-.05,top-gh*.32*u);
  return{top:t,bot:Math.min(bot+gh*.12*u,t-.4)}};
 const out=[];
 for(const side of[-1,1]){
  /* local s runs along the crown's axis, lat across it; +lat toward 6 o'clock at 3 */
  const toWorld=(lat,s)=>{const X=s,Z=side*lat;return[X*cs-Z*sn,X*sn+Z*cs]};
  out.push(sweep(stations,{toWorld,heights,strips:(k,W,h)=>hornSection(W,{bi:Math.min(.35,W*.25,(h.top-h.bot)*.3),bo:Math.min(.35,W*.25,(h.top-h.bot)*.3)})}))}
 return out}

/* a drilled spring-bar hole: a short dark bore sunk into the lug's outer flank */
export function holeGeometry(h){const depth=.9,g=new CylinderGeometry(h.r,h.r,depth,24,1,false);
 g.rotateZ(Math.PI/2);g.translate(h.x-h.sx*(depth/2-.02),h.y,h.z);return g}
