/* The tech pack: what a case maker, a dial maker and a hands maker need to quote
   and make the watch, as one ZIP.

     <name>_techpack.pdf   seven A4 sheets
       1 cover             a rendering and the key figures
       2 case              front and side drawings at 2:1, dimensioned
       3 caseback          back drawing, the thickness stack, the construction
       4 parts list        every part: style, material, finish, colour, sizes
       5 dial              the dial artwork enlarged, every element located
       6 bezel and hands   the insert's engraving and the hands, dimensioned
       7 notes             what is fixed, and blanks for the manufacturer
     artwork/*.svg         the dial, bezel insert and hands at 1:1 in mm
     spec.json             every number, as in the layered export

   Every figure comes from the geometry the watch is built from, and every
   drawing is the built watch (lineart.js) or the renderers' own artwork
   (artwork.js), so the pack cannot disagree with the design. */
import {createPDF,textWidth} from './pdf.js';
import {artworkOf,dialSVG,bezelSVG,handsSVG,handsLayout,loopsBox} from './artwork.js';
import {specData} from './layered.js';
import {zip} from './zip.js';
import {lineDrawing,renderStill} from '../core/three/view.js';
import {webglState} from '../core/three/support.js';
import {hasStructuralUpload} from '../core/three/uploads.js';
import {headHeights,headRadii,crownParts} from '../core/three/lathe.js';
import {geoOf,caseOf,thicknessStack,lugToLugMm,strapMmOf,crownMmOf,bezelMmOf,dialLayoutOf,handLengthsOf,
        strapLengthsOf,BRACELET_MM,BEAT_HZ,cyclopsOf,DIAL_STEP_MM,SUBDIAL_DEPTH_MM,detentOf,outlinesOf,caseLengthMm} from '../core/geometry.js';
import {CASEBACK_WINDOW} from '../core/render/caseback.js';
import {METALS,PX} from '../core/constants.js';
import {VNAME} from '../core/parts.js';
import {marketingClock} from '../core/time.js';
import {store} from '../state/store.js';
import {toast} from '../core/utils.js';

const PAGE_W=297,PAGE_H=210,M=10,SHEETS=7;
const INK='#1b1c1f',DIM='#1f55a8',CUTRED='#d2301e',MUTED='#6b6e75',RULE='#c9ccd2';
const f1=v=>(Math.round(v*10)/10).toFixed(1),f2=v=>(Math.round(v*100)/100).toFixed(2);
const metalName=id=>(METALS[id]||{name:id||'—'}).name;
const cap=s=>String(s||'').charAt(0).toUpperCase()+String(s||'').slice(1);
const safe=s=>String(s).replace(/[^a-z0-9._-]+/gi,'_');
const enc=s=>new TextEncoder().encode(s);

/* ------------------------------------------------------------ drawing kit */

function sheet(doc,{title,subtitle='',scale,n,project,date}){const pg=doc.page(PAGE_W,PAGE_H);
 pg.rect(M,M,PAGE_W-2*M,PAGE_H-2*M,{stroke:INK,width:.5});
 pg.text(M+6,M+11,title,{size:14,bold:true,color:INK});
 if(subtitle)pg.text(M+6,M+17,subtitle,{size:8,color:MUTED});
 /* title block, bottom right */
 const w=118,h=22,x=PAGE_W-M-w,y=PAGE_H-M-h;
 pg.rect(x,y,w,h,{stroke:INK,width:.35,fill:'#ffffff'});
 pg.line(x,y+9,x+w,y+9,{stroke:INK,width:.2});pg.line(x,y+15.5,x+w,y+15.5,{stroke:INK,width:.2});
 for(const cx of[30,58,86])pg.line(x+cx,y+15.5,x+cx,y+h,{stroke:INK,width:.2});
 pg.text(x+3,y+6.4,project,{size:10,bold:true});
 pg.text(x+w-3,y+6.4,'WatchStudio',{size:7,color:MUTED,align:'right'});
 pg.text(x+3,y+13.4,title,{size:8});
 const cell=(cx,label,val)=>{pg.text(x+cx+2,y+18.4,label,{size:5,color:MUTED});pg.text(x+cx+2,y+21,val,{size:7,bold:true})};
 cell(0,'SCALE',scale||'—');cell(30,'UNITS','mm');cell(58,'SHEET',`${n} of ${SHEETS}`);cell(86,'DATE',date);
 return pg}

/* a filled arrowhead with its tip at (x,y), pointing along (ux,uy) */
function arrow(pg,x,y,ux,uy,color=DIM){const L=2,w=.7,bx=x-ux*L,by=y-uy*L;
 pg.shape([[[x,y],[bx-uy*w,by+ux*w],[bx+uy*w,by-ux*w]]],{fill:color})}

/* horizontal dimension between page x a and b on the line at page y; the
   features are at (a,fa) and (b,fb), extension lines run from them to the line */
function dimH(pg,a,b,y,fa,fb,label){const gap=1,over=1.5,s=Math.sign(y-(fa+fb)/2)||1;
 pg.line(a,fa+s*gap,a,y+s*over,{stroke:DIM,width:.18});pg.line(b,fb+s*gap,b,y+s*over,{stroke:DIM,width:.18});
 const inside=Math.abs(b-a)>9;
 pg.line(inside?a:a-6,y,inside?b:b+6,y,{stroke:DIM,width:.18});
 if(inside){arrow(pg,a,y,-1,0);arrow(pg,b,y,1,0)}else{arrow(pg,a,y,1,0);arrow(pg,b,y,-1,0)}
 pg.text((a+b)/2,y-1.1,label,{size:7,color:DIM,align:'center'})}

/* vertical dimension between page y a and b on the line at page x */
function dimV(pg,a,b,x,fa,fb,label){const gap=1,over=1.5,s=Math.sign(x-(fa+fb)/2)||1;
 pg.line(fa+s*gap,a,x+s*over,a,{stroke:DIM,width:.18});pg.line(fb+s*gap,b,x+s*over,b,{stroke:DIM,width:.18});
 const inside=Math.abs(b-a)>9;
 pg.line(x,inside?a:a-6,x,inside?b:b+6,{stroke:DIM,width:.18});
 if(inside){arrow(pg,x,a,0,-1);arrow(pg,x,b,0,1)}else{arrow(pg,x,a,0,1);arrow(pg,x,b,0,-1)}
 pg.text(x-1.1,(a+b)/2,label,{size:7,color:DIM,align:'center',angle:-90})}

/* a leader from a feature to a label, with a short shoulder */
function leader(pg,px,py,tx,ty,label,{align='left'}={}){const sh=align==='left'?3:-3;
 pg.circle(px,py,.4,{fill:DIM});pg.polyline([[px,py],[tx,ty],[tx+sh,ty]],{stroke:DIM,width:.18});
 pg.text(tx+sh+(align==='left'?1:-1),ty+1,label,{size:7,color:DIM,align})}

/* a numbered balloon */
function balloon(pg,x,y,n){pg.circle(x,y,2.3,{fill:'#ffffff',stroke:DIM,width:.25});pg.text(x,y+1,String(n),{size:6.5,bold:true,color:DIM,align:'center'})}

/* a line drawing placed with its drawing-space point (0,0) at page (x,y), s page mm per mm */
function placeDrawing(doc,pg,L,x,y,s){
 const img=doc.image(L.width,L.height,L.gray,1);
 pg.image(img,x+L.u0*s,y+L.v0*s,(L.u1-L.u0)*s,(L.v1-L.v0)*s);
 return(u,v)=>[x+u*s,y+v*s]}

/* a table: columns [{label,w}], rows of cell strings (\n breaks lines); returns the y below it */
function table(pg,x,y,cols,rows,{size=7.5,head=true,zebra=true}={}){
 const lh=size*.45,pad=1.8;
 if(head){let cx=x;pg.rect(x,y,cols.reduce((a,c)=>a+c.w,0),6,{fill:'#eceef2'});
  for(const c of cols){pg.text(cx+pad,y+4.2,c.label,{size:6.5,bold:true,color:MUTED});cx+=c.w}y+=6}
 rows.forEach((row,ri)=>{
  const wrapped=row.map((cell,i)=>wrap(String(cell??''),cols[i].w-2*pad,size,i===0));
  const h=Math.max(...wrapped.map(w=>w.length))*lh+2*pad;
  if(zebra&&ri%2)pg.rect(x,y,cols.reduce((a,c)=>a+c.w,0),h,{fill:'#f7f8fa'});
  let cx=x;wrapped.forEach((lines,i)=>{
   const sw=cols[i].swatch&&cols[i].swatch(ri);
   lines.forEach((ln,li)=>pg.text(cx+pad+(sw&&li===0?4.5:0),y+pad+lh*(li+1)-.6,ln,{size,bold:i===0}));
   if(sw)pg.rect(cx+pad,y+pad+.2,3.2,3.2,{fill:sw,stroke:'#999',width:.1});
   cx+=cols[i].w});
  pg.line(x,y+h,x+cols.reduce((a,c)=>a+c.w,0),y+h,{stroke:RULE,width:.15});
  y+=h});
 return y}
function wrap(s,w,size,bold){const out=[];
 for(const para of s.split('\n')){let line='';
  for(const word of para.split(' ')){const t=line?line+' '+word:word;
   if(textWidth(t,size,bold)>w&&line){out.push(line);line=word}else line=t}
  out.push(line)}
 return out}

/* ------------------------------------------------------------ the figures */

function figures(d,name){const c=caseOf(d),st=thicknessStack(d),g=geoOf(d),P=d.parts,H=headHeights(d),Rr=headRadii(d);
 const L=dialLayoutOf(d),HL=handLengthsOf(d),rMm=g.dialR/PX,cy=cyclopsOf(d),cp=crownParts(d);
 const rot=P.bezel.variant==='diver'||P.bezel.variant==='gmt',bracelet=P.strap.variant==='steel';
 const SL=strapLengthsOf(d),hw=P.strap.metal==='ceramic'?'steel':P.strap.metal==='carbon'?'black':(P.strap.metal||'steel');
 return{name,c,st,g,P,H,Rr,L,cp,rot,bracelet,
  caseMm:+d.caseMm,round:c.shape==='round',lengthMm:caseLengthMm(d),
  sizeLabel:c.shape==='round'?'Ø'+f1(+d.caseMm):c.shape==='tonneau'?f1(+d.caseMm)+' wide':f1(+d.caseMm)+' across flats',
  /* the bezel as built: a shape that does not fit the case is made round */
  bezelKind:outlinesOf(d).bezel.kind,bezelFlats:outlinesOf(d).bezel.A0*2,
  l2l:lugToLugMm(d),lugW:strapMmOf(d),crownMm:crownMmOf(d),bezelMm:bezelMmOf(d),
  dialMm:rMm*2,openingMm:Rr.rBezIn*2,hands:{hour:HL.hour*rMm,min:HL.min*rMm,sec:HL.sec*rMm},
  cyclops:cy,vph:BEAT_HZ[c.movement]?BEAT_HZ[c.movement]*7200:null,
  windowMm:Rr.rCase*CASEBACK_WINDOW*2,
  strap:bracelet?{kind:'Bracelet',top:BRACELET_MM.top,bottom:BRACELET_MM.bottom,clasp:BRACELET_MM.clasp}
   :{kind:VNAME[P.strap.variant]||P.strap.variant,top:SL.short,bottom:SL.long,hardware:hw},
  crystalName:{flat:'Flat',dome:'Domed',box:'Box'}[c.crystal]||c.crystal,
  dateAt:L.date==='none'?null:L.date==='430'?'4:30':L.date+' o\'clock'}}

/* ------------------------------------------------------------ the sheets */

async function cover(doc,F,d,customs,clock,meta,has3D){
 const pg=doc.page(PAGE_W,PAGE_H);
 pg.rect(M,M,PAGE_W-2*M,PAGE_H-2*M,{stroke:INK,width:.5});
 if(has3D){const w=1500,h=1150;
  const im=await renderStill({...d,shadow:false,night:false},customs,{w,h,camera:'three-quarter',clock});
  const cv=document.createElement('canvas');cv.width=w;cv.height=h;const x=cv.getContext('2d');
  x.fillStyle='#ffffff';x.fillRect(0,0,w,h);x.drawImage(im,0,0);
  pg.image(doc.imageFromCanvas(cv),M+4,M+18,165,165*h/w)}
 else pg.text(M+90,110,'The rendering needs 3D graphics (WebGL), which this browser is not providing.',{size:9,color:MUTED,align:'center'});
 const X=190;
 pg.text(X,M+22,'TECH PACK',{size:9,bold:true,color:DIM});
 pg.text(X,M+33,F.name,{size:20,bold:true});
 pg.text(X,M+40,`${meta.date} · made with WatchStudio`,{size:8,color:MUTED});
 const rows=[F.c.shape==='tonneau'?['Case width × length',`${f1(F.caseMm)} × ${f1(F.lengthMm)} mm (tonneau)`]
  :[F.round?'Case diameter':'Case across flats',`${f1(F.caseMm)} mm${F.round?'':` (${F.c.shape})`}`],['Thickness',`${f1(F.c.thickness)} mm`],['Lug to lug',`${f1(F.l2l)} mm`],
  ['Lug width',`${f1(F.lugW)} mm`],['Crystal',`${F.crystalName} sapphire${F.cyclops?', cyclops':''}`],
  ['Movement',cap(F.c.movement)+(F.vph?` · ${F.vph.toLocaleString('en-US')} vph`:'')],
  ['Caseback',cap(F.c.caseback)],['Water resistance',`${F.c.wrM} m`],
  ['Case',`${metalName(F.P.case.metal)}, ${F.P.case.finish}`],['Dial',`${VNAME[F.P.dial.variant]||F.P.dial.variant} ${F.P.dial.color}`]];
 let y=M+52;for(const[k,v]of rows){pg.text(X,y,k,{size:8,color:MUTED});pg.text(X+34,y,v,{size:8.5,bold:true});pg.line(X,y+2.2,PAGE_W-M-6,y+2.2,{stroke:RULE,width:.15});y+=7.4}
 y+=4;pg.text(X,y,'CONTENTS',{size:7,bold:true,color:MUTED});y+=5;
 for(const[i,t]of['Cover','Case — front and side','Caseback, thickness and construction','Parts list','Dial artwork','Bezel and hands','Notes for the manufacturer'].entries()){
  pg.text(X,y,`${i+1}`,{size:8,color:DIM,bold:true});pg.text(X+6,y,t,{size:8});y+=5}
 pg.text(X,PAGE_H-M-8,'Drawings, figures and artwork are generated from the design itself.',{size:6.5,color:MUTED});
 pg.text(X,PAGE_H-M-4.5,'Artwork files at 1:1 are in the artwork folder of this pack.',{size:6.5,color:MUTED})}

async function caseSheet(doc,F,d,customs,clock,meta,has3D){
 const R=F.caseMm/2,hl=F.l2l/2,H=F.H;
 /* laid out from the right edge inward: the side view and its dimensions, the
    lug-to-lug dimension, then the front view and the ring labels on its left.
    A large watch that will not fit at 2:1 is drawn at 3:2. Quick low-resolution
    drawings give the extents to plan with. */
 const probeF=has3D?await lineDrawing(d,customs,{view:'front',ppm:3,pen:.6,clock}):null;
 const probeS=has3D?await lineDrawing(d,customs,{view:'side',ppm:3,pen:.6,clock}):null;
 const ringLabels=[F.bezelKind==='round'?`Ø${f1(F.Rr.rBezOut*2)} bezel`:`${f1(F.bezelFlats)} bezel across flats`,`Ø${f1(F.openingMm)} crystal opening`,`Ø${f1(F.dialMm)} dial`];
 const labelW=Math.max(...ringLabels.map(t=>textWidth(t,7)));
 const plan=s=>{const sxC=PAGE_W-M-24-(probeS?probeS.box.u1:hl)*s,sideLeft=sxC+(probeS?probeS.box.u0:-hl)*s;
  const l2lX=sideLeft-9,fx=l2lX-8-(probeF?probeF.box.u1:R+8)*s;
  return{s,sxC,sideLeft,l2lX,fx,ok:fx-R*s-6-labelW>=M+3&&M+38+2*hl*s+22<=PAGE_H-M-4}};
 const L=plan(2).ok?plan(2):plan(1.5),s=L.s;
 const pg=sheet(doc,{title:'Case — front and side',subtitle:'Head without strap. Hands set at 10:09.',scale:s===2?'2:1':'3:2',n:2,...meta});
 if(!has3D){pg.text(148,105,'These drawings need 3D graphics (WebGL), which this browser is not providing.',{size:9,color:MUTED,align:'center'});return}
 const pen=.24/s,ppm=15.7*s;
 const FR=await lineDrawing(d,customs,{view:'front',ppm,pen,clock,names:['lugs']});
 const SD=await lineDrawing(d,customs,{view:'side',ppm,pen,clock,names:['lugs']});

 /* A — front */
 const fx=L.fx,fy=M+38+hl*s;
 const P=placeDrawing(doc,pg,FR,fx,fy,s);
 pg.text(fx,M+25,'A — FRONT',{size:7.5,bold:true,color:MUTED,align:'center'});
 const lugs=FR.extents.lugs||FR.box;
 /* lug to lug, on the right between the two views */
 {const[xa,ya]=P(lugs.u1,-hl),[,yb]=P(lugs.u1,hl);dimV(pg,ya,yb,L.l2lX,xa,xa,f1(F.l2l))}
 /* lug width, above the top lugs */
 {const[xa,ya]=P(-F.lugW/2,-hl+1.2),[xb]=P(F.lugW/2,-hl+1.2);dimH(pg,xa,xb,fy-hl*s-6,ya,ya,f1(F.lugW))}
 /* case diameter and the width over the crown, below */
 {const[xa,ya]=P(-R,0),[xb]=P(R,0),yd=fy+hl*s+8;dimH(pg,xa,xb,yd,ya,ya,F.sizeLabel);
  const crown=FR.extents.crown;if(crown){const[xc,yc]=P(crown.u1,(crown.v0+crown.v1)/2);dimH(pg,xa,xc,yd+8,ya,yc,f1(crown.u1+R)+' over the crown')}}
 /* the rings, by leaders to the left */
 const ring=(r,deg,label,row)=>{const a=deg*Math.PI/180,[px,py]=P(r*Math.sin(a),-r*Math.cos(a));leader(pg,px,py,fx-R*s-3,fy-16+row*6,label,{align:'right'})};
 ring(F.bezelKind==='round'?F.Rr.rBezOut*.995:F.bezelFlats/2*.99,292,ringLabels[0],0);
 ring(F.Rr.rBezIn,280,ringLabels[1],1);
 ring(F.dialMm/2*.99,266,ringLabels[2],2);
 if(F.L.subdials.length){const sd=F.L.subdials.find(x=>x.key==='chMin')||F.L.subdials[0],[px,py]=P((sd.x-600)/PX,(sd.y-600)/PX);
  leader(pg,px,py,fx-R*s-3,fy-16+3*6,`Ø${f1(sd.r*2/PX)} registers`,{align:'right'})}
 /* the date window, labelled above the crown */
 if(F.L.win){const w=F.L.win,[px,py]=P((w.x-600)/PX,(w.y-600)/PX-w.h/PX/2);
  leader(pg,px,py,fx+R*s*.9,fy-R*s*.5,`Date ${f1(w.w/PX)} × ${f1(w.h/PX)}`)}

 /* B — side, seen from 3 o'clock, 12 o'clock to the right */
 const sxC=L.sxC,syC=M+36+H.top*s;
 const Q=placeDrawing(doc,pg,SD,sxC,syC,s);
 pg.text(sxC,M+25,"B — SIDE, FROM 3 O'CLOCK",{size:7.5,bold:true,color:MUTED,align:'center'});
 const right=sxC+SD.box.u1*s;
 {const[xa,ya]=Q(R,0),[xb,yb]=Q(0,-H.top);dimV(pg,ya,yb,right+6,xa,xb,f1(F.c.thickness))}
 {const[xa,ya]=Q(F.Rr.rBezIn,-H.bezelTop),[xb,yb]=Q(0,-H.top);dimV(pg,ya,yb,right+14,xa,xb,f1(F.st.crystal))}
 /* under the whole drawing: an integrated shoulder sits higher than the caseback */
 const sl=SD.extents.lugs||SD.box,yb=Q(0,Math.max(sl.v1,SD.box.v1))[1];
 {const[xa]=Q(-hl,0),[xb]=Q(hl,0);dimH(pg,xa,xb,yb+8,Q(-hl,sl.v1)[1]-2,Q(hl,sl.v1)[1]-2,f1(F.l2l))}
 /* a tonneau is longer than it is wide: its length from 12 to 6, under the lug-to-lug */
 const long=F.c.shape==='tonneau',extra=long?8:0;
 if(long){const[xa,ya]=Q(-F.lengthMm/2,0),[xb]=Q(F.lengthMm/2,0);dimH(pg,xa,xb,yb+16,ya,ya,f1(F.lengthMm)+' case length')}
 const cr=SD.extents.crown;if(cr){const[px,py]=Q((cr.u0+cr.u1)/2,cr.v1);
  /* slanting away to the left, clear of the dimension figures centred under the drawing */
  leader(pg,px,py,sxC-24,yb+18+extra,`Crown Ø${f1(F.crownMm)}, its axis ${f1(F.cp.axisY)} above the caseback`)}
 pg.text(right+16,Q(0,-(H.top+H.bezelTop)/2)[1]+1,'crystal',{size:6,color:DIM});
 pg.text(sxC,yb+30+extra,'Thickness stack and construction: sheet 3.',{size:6.5,color:MUTED,align:'center'});
 if(hasStructuralUpload(d,customs))pg.text(M+6,PAGE_H-M-4,'Uploaded parts are flat pictures and are not drawn.',{size:6.5,color:CUTRED});
 pg.text(M+6,PAGE_H-M-9,'Dimensions in mm. Tolerances to be agreed with the manufacturer (sheet 7).',{size:6.5,color:MUTED})}

async function backSheet(doc,F,d,customs,clock,meta,has3D){
 const pg=sheet(doc,{title:'Caseback, thickness and construction',scale:'2:1',n:3,...meta});
 const s=F.caseMm*2+10<=150&&F.l2l*2<=150?2:1.5;
 if(has3D){const BK=await lineDrawing(d,customs,{view:'back',ppm:15.7*s,pen:.24/s,clock});
  const R=F.caseMm/2,hl=F.l2l/2,bx=M+40+R*s,by=M+30+hl*s;
  const P=placeDrawing(doc,pg,BK,bx,by,s);
  pg.text(bx,M+22,'C — BACK',{size:7.5,bold:true,color:MUTED,align:'center'});
  {const[xa,ya]=P(-R,0),[xb]=P(R,0);dimH(pg,xa,xb,by+hl*s+8,ya,ya,F.sizeLabel)}
  if(F.c.caseback==='exhibition'){const r=F.windowMm/2,[px,py]=P(-r*Math.sin(.9),-r*Math.cos(.9));
   leader(pg,px,py,bx+R*s*.3,by-hl*s-2,`Ø${f1(F.windowMm)} sapphire window`)}
  else{const[px,py]=P(0,-F.caseMm*.2);leader(pg,px,py,bx+R*s*.3,by-hl*s-2,F.c.caseback==='engraved'?`Engraved: "${F.c.engraving}"`:`Solid, engraved "${F.c.engraving}"`)}}
 else pg.text(90,105,'The back drawing needs 3D graphics (WebGL).',{size:9,color:MUTED,align:'center'});

 /* the thickness stack */
 const st=F.st,X=175,Y0=M+30,barH=56,k=barH/st.total;
 pg.text(X,Y0-4,'THICKNESS STACK',{size:7,bold:true,color:MUTED});
 const parts=[['Crystal',st.crystal,'#dfe9f3'],['Bezel',st.bezel,'#c6ccd6'],['Dial',st.dial,F.P.dial.color],['Movement',st.movement,'#e9dcc0'],['Mid-case band',st.band,'#d5d9e0'],['Caseback',st.caseback,'#b9bfc9']];
 let y=Y0;for(const[n,v,c]of parts){const h=v*k;pg.rect(X,y,16,h,{fill:c,stroke:INK,width:.15});
  pg.line(X+16,y+h/2,X+22,y+h/2,{stroke:RULE,width:.15});pg.text(X+23,y+h/2+1,`${n}`,{size:7});pg.text(X+62,y+h/2+1,f2(v),{size:7,bold:true,align:'right'});y+=h}
 dimV(pg,Y0,Y0+barH,X-5,X,X,f2(st.total));
 /* construction */
 const rows=[['Movement',`${cap(F.c.movement)}${F.vph?`, ${F.vph.toLocaleString('en-US')} vibrations an hour`:''}, ${f1(st.movement)} mm high`],
  ['Caseback',`${cap(F.c.caseback)}${F.c.caseback==='exhibition'?`, sapphire window Ø${f1(F.windowMm)}`:`, engraved "${F.c.engraving}"`}`],
  ['Crystal',`${F.crystalName} sapphire, ${f1(F.c.crystalMm)} mm above the bezel${F.cyclops?`, cyclops ${f1(F.cyclops.mag||2.5)}x over the date`:''}`],
  ['Crown',`${VNAME[F.P.crown.variant]||F.P.crown.variant}, Ø${f1(F.crownMm)}, at ${F.c.crownPos==='430'?'4:30':'3 o\'clock'}${F.c.pushers?'; chronograph pushers at 2 and 4':''}`],
  ['Bezel',`${VNAME[F.P.bezel.variant]||F.P.bezel.variant}${F.rot?`, ${detentOf(d)} clicks, ${F.P.bezel.dir==='bi'?'bidirectional':'unidirectional'}`:', fixed'}`],
  ['Water resistance',`${F.c.wrM} m`],['Lugs',`${f1(F.c.lugLen)} long, ${f1(F.c.lugDrop)} drop`]];
 pg.text(X,Y0+barH+10,'CONSTRUCTION',{size:7,bold:true,color:MUTED});
 table(pg,X,Y0+barH+12,[{label:'',w:28},{label:'',w:74}],rows,{size:7,head:false})}

function partsSheet(doc,F,d,meta){
 const pg=sheet(doc,{title:'Parts list',scale:'—',n:4,...meta});const P=F.P;
 const zones=f=>f==='brushed'?'Brushed; bevels polished':f==='matte'?'Bead-blasted':f==='polished'||f==='none'||!f?'Polished':cap(f);
 const rows=[
  ['Case',`${cap(F.c.shape)} ${(VNAME[P.case.variant]||P.case.variant).toLowerCase()}; ${cap(F.c.side)} side; ${F.c.lugs==='integrated'?'integrated':cap(F.c.lugs)+' lugs'}${F.c.lugHoles&&F.c.lugs!=='integrated'?', drilled':''}`,metalName(P.case.metal),zones(P.case.finish),'—',`Ø${f1(F.caseMm)}, ${f1(F.c.thickness)} thick, lug to lug ${f1(F.l2l)}, lug width ${f1(F.lugW)}`],
  ['Bezel',`${VNAME[P.bezel.variant]||P.bezel.variant}${F.bezelKind==='round'?'':', '+F.bezelKind}`,metalName(P.bezel.metal),zones(P.bezel.finish),F.rot?(P.bezel.insertColor||'#101318'):'—',
   `Outer Ø${f1(F.Rr.rBezOut*2)}, width ${f1(F.bezelMm)}, ${f1(F.st.bezel)} high${F.rot?`; insert, ${detentOf(d)} clicks`:''}`],
  ['Crystal',`${F.crystalName} sapphire`,'Sapphire','Polished','—',`Ø${f1(F.openingMm)} visible, ${f1(F.c.crystalMm)} above the bezel${F.cyclops?'; cyclops over the date':''}`],
  ['Dial',VNAME[P.dial.variant]||P.dial.variant,'—',!P.dial.finish||P.dial.finish==='none'?'—':cap(P.dial.finish),P.dial.color,
   `Ø${f1(F.dialMm)}${F.dateAt?`; date window at ${F.dateAt}`:''}${P.dial.step==='stepped'?`; centre sunk ${f2(DIAL_STEP_MM)}`:''}${F.L.subdials.length?`; registers milled ${f2(SUBDIAL_DEPTH_MM)}`:''}`],
  ['Hour indices',VNAME[P.markers.variant]||P.markers.variant,metalName(P.hands.metal),'Polished',P.markers.lume,`Outer ends on Ø${f1(F.dialMm*.885)}; lume ${P.markers.lume}`],
  ['Hands',VNAME[P.hands.variant]||P.hands.variant,metalName(P.hands.metal),cap(P.hands.finish||'polished'),P.hands.lume,
   `Hour ${f1(F.hands.hour)}, minute ${f1(F.hands.min)}, seconds ${f1(F.hands.sec)} (${P.hands.secColor})`],
  ['Crown',VNAME[P.crown.variant]||P.crown.variant,metalName(P.crown.metal),zones(P.crown.finish),'—',`Ø${f1(F.crownMm)} at ${F.c.crownPos==='430'?'4:30':'3 o\'clock'}${F.c.pushers?'; two pushers':''}`],
  ['Caseback',cap(F.c.caseback),F.c.caseback==='exhibition'?`${metalName(P.case.metal)} + sapphire`:metalName(P.case.metal),'Circular grain','—',
   F.c.caseback==='exhibition'?`Window Ø${f1(F.windowMm)}`:`Engraving "${F.c.engraving}"`],
  ['Movement',cap(F.c.movement),'—','—','—',`${f1(F.st.movement)} high${F.vph?`, ${F.vph.toLocaleString('en-US')} vph`:''}; calibre to be specified`],
  F.bracelet?['Bracelet','Three-link, folding clasp',metalName(P.strap.metal),zones(P.strap.finish),'—',`Width ${f1(F.lugW)}; ${F.strap.top} + ${F.strap.bottom} of links, ${F.strap.clasp} clasp`]
   :['Strap',F.strap.kind,cap(P.strap.variant==='rubber'?'rubber':P.strap.variant==='nato'?'nylon webbing':P.strap.variant==='mesh'?metalName(P.strap.metal)+' mesh':'leather'),'—',P.strap.color||'—',
    `Width ${f1(F.lugW)}; ${f1(F.strap.top)} (buckle side) + ${f1(F.strap.bottom)}; buckle in ${metalName(F.strap.hardware)}`]];
 const swatch=i=>{const c=rows[i][4];return/^#[0-9a-f]{3,8}$/i.test(c)?c:null};
 table(pg,M+6,M+24,[{label:'PART',w:28},{label:'STYLE',w:40},{label:'MATERIAL',w:34},{label:'FINISH',w:40},{label:'COLOUR',w:26,swatch},{label:'SIZES (MM)',w:109}],rows,{size:7.5})}

function loopsShape(pg,loops,map,opts){pg.shape(loops.map(l=>l.map(([x,y])=>map(x,y))),opts)}
function ringLoop(r,n=120){const o=[];for(let i=0;i<n;i++){const a=i/n*Math.PI*2;o.push([r*Math.cos(a),r*Math.sin(a)])}return o}

function dialSheet(doc,F,art,meta){
 /* as large as fits beside the key, in half steps: 4:1 for most dials */
 const D=art.dial,s=Math.max(1,Math.floor(Math.min(4,124/D.diameter)*2)/2);
 const pg=sheet(doc,{title:'Dial artwork',subtitle:`Enlarged ${f1(s)}:1. The same artwork at 1:1 is in artwork/dial.svg.`,scale:`${f1(s)}:1`,n:5,...meta});
 const cx=M+18+D.diameter/2*s+8,cy=M+28+D.diameter/2*s;
 const map=(x,y)=>[cx+x*s,cy+y*s];
 pg.circle(cx,cy,D.diameter/2*s,{fill:D.color});
 for(const p of D.print)loopsShape(pg,p.loops,map,{fill:p.ink});
 for(const p of D.pictures)pg.image(doc.imageFromCanvas(p.canvas),cx+p.x*s,cy+p.y*s,p.w*s,p.h*s);
 for(const a of D.applied)loopsShape(pg,a.loops,map,{fill:'#c9ced6',stroke:'#1d1f23',width:.12});
 const cut={stroke:CUTRED,width:.22};
 pg.circle(cx,cy,D.cuts.edge*s,cut);
 const w=D.cuts.window;
 if(w){const x0=w.x-w.w/2,y0=w.y-w.h/2,r=w.rad,pts=[];
  for(const[qx,qy,a0]of[[x0+w.w-r,y0+r,-90],[x0+w.w-r,y0+w.h-r,0],[x0+r,y0+w.h-r,90],[x0+r,y0+r,180]])
   for(let i=0;i<=6;i++){const a=(a0+i*15)*Math.PI/180;pts.push(map(qx+r*Math.cos(a),qy+r*Math.sin(a)))}
  pg.polyline(pts,{...cut,close:true})}
 for(const sd of D.cuts.registers)pg.circle(cx+sd.x*s,cy+sd.y*s,sd.r*s,{...cut,dash:[1.2,.6]});
 if(D.cuts.step)pg.circle(cx,cy,D.cuts.step*s,{...cut,dash:[2,.8]});
 pg.line(cx-2,cy,cx+2,cy,cut);pg.line(cx,cy-2,cx,cy+2,cut);

 /* every element located, by numbered balloons round the dial */
 const Rb=D.diameter/2*s+9,items=[];const Mz=D.measures;
 const at=(x,y,deg,text,val)=>items.push({x,y,deg,text,val});
 at(D.diameter/2*Math.sin(.7),-D.diameter/2*Math.cos(.7),40,'Dial',`Ø${f2(D.diameter)}`);
 at(Mz.track*Math.sin(.35),-Mz.track*Math.cos(.35),20,'Minute track',`outer ends on Ø${f2(Mz.track*2)}`);
 at(Mz.indexOuter*Math.sin(Math.PI/3),-Mz.indexOuter*Math.cos(Math.PI/3),62,'Hour indices',`from Ø${f2(Mz.indexOuter*2)} in to Ø${f2(Mz.indexInner*2)}`);
 if(Mz.brand)at(0,Mz.brand.y,335,`Brand "${Mz.brand.text}"`,`${f1(Mz.brand.size)} high, centred ${f2(-Mz.brand.y)} above the centre`);
 if(Mz.line)at(0,Mz.line.y,205,`Model line "${Mz.line.text}"`,`${f1(Mz.line.size)} high, centred ${f2(Math.abs(Mz.line.y))} ${Mz.line.y<0?'above':'below'} the centre`);
 if(w)at(w.x,w.y,w.at==='3'?105:w.at==='6'?165:125,'Date window',`${f2(w.w)} × ${f2(w.h)}, corners r${f2(w.rad)}, frame ${f2(w.frame)}; centre ${f2(Math.hypot(w.x,w.y))} from the centre`);
 if(D.cuts.registers.length){const sd=D.cuts.registers.find(x=>x.key==='chMin')||D.cuts.registers[0];
  at(sd.x,sd.y,250,'Registers',`Ø${f2(sd.r*2)}, milled ${f2(SUBDIAL_DEPTH_MM)}; centres ${f2(Math.hypot(sd.x,sd.y))} from the centre`)}
 if(D.cuts.step)at(D.cuts.step*Math.sin(2.3),-D.cuts.step*Math.cos(2.3),132,'Chapter ring step',`Ø${f2(D.cuts.step*2)}, centre sunk ${f2(DIAL_STEP_MM)}`);
 const logo=D.applied.find(a=>a.id==='applied-logo')||D.print.find(p=>p.id==='print-logo');
 if(logo){const b=loopsBox(logo.loops);if(b)at((b.x0+b.x1)/2,(b.y0+b.y1)/2,352,'Logo',`${f2(b.x1-b.x0)} × ${f2(b.y1-b.y0)}, centred ${f2(-(b.y0+b.y1)/2)} above the centre`)}
 else if(D.pictures.length){const p=D.pictures[0];at(p.x+p.w/2,p.y+p.h/2,352,'Logo (colour picture)',`${f2(p.w)} × ${f2(p.h)}`)}
 items.forEach((it,i)=>{const a=it.deg*Math.PI/180,bx=cx+Rb*Math.sin(a),by=cy-Rb*Math.cos(a),[px,py]=map(it.x,it.y);
  const dx=bx-px,dy=by-py,l=Math.hypot(dx,dy)||1;
  pg.circle(px,py,.45,{fill:DIM});pg.line(px,py,bx-dx/l*2.3,by-dy/l*2.3,{stroke:DIM,width:.18});balloon(pg,bx,by,i+1)});

 /* the key, the inks, and the dial at 1:1 */
 const X=178;let y=M+26;
 pg.text(X,y,'MEASURED FROM THE DIAL CENTRE (MM)',{size:7,bold:true,color:MUTED});y+=2;
 y=table(pg,X,y,[{label:'',w:7},{label:'',w:28},{label:'',w:64}],items.map((it,i)=>[String(i+1),it.text,it.val]),{size:6.5,head:false});
 y+=6;pg.text(X,y,'LAYERS',{size:7,bold:true,color:MUTED});y+=4;
 const legend=[...D.print.map(p=>[p.ink,`Print: ${p.label}`,p.ink]),...D.applied.map(a=>['#c9ced6',`Applied: ${a.label}, ${metalName(a.metal)}`,'']),[CUTRED,'Cut or milled lines','']];
 for(const[c,t,hex]of legend){pg.rect(X,y-2.6,3.2,3.2,{fill:c,stroke:'#999',width:.1});pg.text(X+5,y,t+(hex?` (${hex})`:''),{size:6.5});y+=4.6}
 const s1=1,r1=D.diameter/2;if(y+r1*2+8<PAGE_H-M-26){y+=4;pg.text(X,y,'1:1',{size:7,bold:true,color:MUTED});
  const c1x=X+r1+2,c1y=y+3+r1,m1=(x,yy)=>[c1x+x*s1,c1y+yy*s1];
  pg.circle(c1x,c1y,r1,{fill:D.color});for(const p of D.print)loopsShape(pg,p.loops,m1,{fill:p.ink});
  for(const a of D.applied)loopsShape(pg,a.loops,m1,{fill:'#c9ced6'})}}

function bezelHandsSheet(doc,F,art,meta){
 const pg=sheet(doc,{title:'Bezel and hands',subtitle:'Artwork at 1:1 is in artwork/bezel.svg and artwork/hands.svg.',scale:'as marked',n:6,...meta});
 const Z=art.bezel;
 if(Z){const s=Math.min(2.5,118/(Z.outer*2)),cx=M+14+Z.outer*s+6,cy=M+32+Z.outer*s,map=(x,y)=>[cx+x*s,cy+y*s];
  pg.text(cx,M+26,`BEZEL ${Z.kind==='insert'?'INSERT':'SCALE'} — ${f1(s)}:1`,{size:7.5,bold:true,color:MUTED,align:'center'});
  pg.shape([ringLoop(Z.outer).map(([x,y])=>map(x,y)),ringLoop(Z.inner).map(([x,y])=>map(x,y))],{fill:Z.color});
  loopsShape(pg,Z.engraving.loops,map,{fill:Z.engraving.ink});
  if(Z.pip){pg.circle(cx+Z.pip.x*s,cy+Z.pip.y*s,Z.pip.r*s,{fill:'#c9ced6',stroke:INK,width:.12});pg.circle(cx+Z.pip.x*s,cy+Z.pip.y*s,Z.pip.lume*s,{fill:Z.pip.color})}
  pg.circle(cx,cy,Z.outer*s,{stroke:CUTRED,width:.22});pg.circle(cx,cy,Z.inner*s,{stroke:CUTRED,width:.22});
  dimH(pg,cx-Z.outer*s,cx+Z.outer*s,cy+Z.outer*s+8,cy,cy,`Ø${f2(Z.outer*2)} outer`);
  dimH(pg,cx-Z.inner*s,cx+Z.inner*s,cy+Z.outer*s+16,cy,cy,`Ø${f2(Z.inner*2)} inner`);
  if(Z.pip)leader(pg,cx+Z.pip.x*s,cy+Z.pip.y*s-Z.pip.r*s,cx+Z.outer*s*.5,M+30,`Lume pip Ø${f2(Z.pip.r*2)} (lume Ø${f2(Z.pip.lume*2)})`);
  pg.text(cx,cy+2,Z.kind==='insert'?`${Z.detents} clicks, ${Z.action}`:'Engraved into the bezel',{size:7,color:MUTED,align:'center'})}
 else pg.text(M+70,100,`${VNAME[F.P.bezel.variant]||F.P.bezel.variant} bezel: no printed or engraved scale.`,{size:8,color:MUTED,align:'center'});

 /* hands, pivots in a row */
 const Lay=handsLayout(art);if(!Lay.items.length)return;
 const top=Math.min(...Lay.items.map(h=>h.box.y0)),bot=Math.max(...Lay.items.map(h=>h.box.y1));
 const s=Math.min(5,120/(bot-top),88/Lay.width),X=PAGE_W-M-24-Lay.width*s,Y=M+34-top*s;
 pg.text(X+Lay.width*s/2,M+26,`HANDS — ${f1(s)}:1`,{size:7.5,bold:true,color:MUTED,align:'center'});
 for(const h of Lay.items){const ox=X+h.dx*s,map=(x,y)=>[ox+x*s,Y+y*s];
  loopsShape(pg,h.loops,map,{fill:h.color,stroke:INK,width:.12});
  pg.line(ox-1.5,Y,ox+1.5,Y,{stroke:CUTRED,width:.2});pg.line(ox,Y-1.5,ox,Y+1.5,{stroke:CUTRED,width:.2});
  const xr=ox+h.box.x1*s+4;dimV(pg,Y,Y-h.length*s,xr,ox,ox,f2(h.length));
  pg.text(ox,Y+bot*s+7,h.label,{size:7,bold:true,align:'center'});
  pg.text(ox,Y+bot*s+10.5,`${h.metal?metalName(h.metal):h.color}${h.lume?' · lume':''}`,{size:6.5,color:MUTED,align:'center'})}
 pg.text(X,PAGE_H-M-28,'Lengths from the pivot (red cross) to the tip.',{size:6.5,color:MUTED})}

function notesSheet(doc,F,d,meta){
 const pg=sheet(doc,{title:'Notes for the manufacturer',scale:'—',n:7,...meta});
 let y=M+26;const X=M+6;
 pg.text(X,y,'FROM THE DESIGN',{size:7,bold:true,color:MUTED});y+=3;
 y=table(pg,X,y,[{label:'',w:40},{label:'',w:100}],[
  ['Units','Millimetres. Drawings of the head exclude the strap.'],
  ['Hands','Drawn at 10:09. Lengths on sheet 6 run from the pivot.'],
  ['Lume',`Indices ${F.P.markers.lume}; hands ${F.P.hands.lume}${F.rot?'; bezel pip':''}`],
  ['Dial printing',`Inks as on sheet 5; text ${F.P.dial.text.font==='caps'?'in capitals':F.P.dial.text.font==='serif'?'serif':'sans serif'}`],
  ['Finishes','"Brushed; bevels polished" means brushed flats with polished chamfers and edges'],
  ['Artwork files','artwork/dial.svg, artwork/hands.svg'+(F.rot||F.P.bezel.variant==='tachy'?', artwork/bezel.svg':'')+' — 1:1, mm, layered'],
  ['Figures','spec.json holds every dimension in this pack']],{size:7,head:false});
 y+=8;pg.text(X,y,'TO BE AGREED WITH THE MANUFACTURER',{size:7,bold:true,color:MUTED});y+=3;
 const blank=['General tolerance','Case material grade','Crystal anti-reflective coating','Movement calibre','Luminous compound grade','Water resistance test','Quantity and lead time','Supplier references'];
 for(const b of blank){pg.text(X,y+6,b,{size:7.5});pg.line(X+52,y+6.6,X+150,y+6.6,{stroke:RULE,width:.2});y+=9}
 const RX=175;let ry=M+26;
 pg.text(RX,ry,'REVISIONS',{size:7,bold:true,color:MUTED});ry+=3;
 table(pg,RX,ry,[{label:'REV',w:12},{label:'DATE',w:24},{label:'CHANGE',w:66}],[['A',meta.date,'First issue from WatchStudio'],['',' ',''],['',' ',''],['',' ','']],{size:7})}

/* ------------------------------------------------------------ export */

export async function buildTechPack(d,customs,name,{date=new Date()}={}){
 const has3D=webglState().ok,clock=marketingClock(d);
 const pad=n=>String(n).padStart(2,'0'),meta={project:name,date:`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`};
 const F=figures(d,name),art=await artworkOf(d,customs);
 const doc=createPDF({title:`${name} — tech pack`});
 await cover(doc,F,d,customs,clock,meta,has3D);
 await caseSheet(doc,F,d,customs,clock,meta,has3D);
 await backSheet(doc,F,d,customs,clock,meta,has3D);
 partsSheet(doc,F,d,meta);
 dialSheet(doc,F,art,meta);
 bezelHandsSheet(doc,F,art,meta);
 notesSheet(doc,F,d,meta);
 const pdf=await doc.bytes();
 const files=[{name:`${safe(name)}_techpack.pdf`,data:pdf},{name:'artwork/dial.svg',data:enc(dialSVG(art,name))}];
 const bz=bezelSVG(art,name);if(bz)files.push({name:'artwork/bezel.svg',data:enc(bz)});
 const hs=handsSVG(art,name);if(hs)files.push({name:'artwork/hands.svg',data:enc(hs)});
 files.push({name:'spec.json',data:enc(JSON.stringify(specData(d,name),null,2))});
 files.push({name:'README.txt',data:enc(`${name} — tech pack from WatchStudio (${meta.date})\n\n`+
  `${safe(name)}_techpack.pdf  seven A4 sheets: cover, case drawings, caseback and construction,\n`+
  `                     parts list, dial artwork, bezel and hands, notes for the manufacturer\n`+
  `artwork/            dial, bezel and hands artwork at 1:1, in mm, as layered SVG\n`+
  `spec.json           every dimension in millimetres\n`)});
 return{files,pdf,art,pages:doc.pageCount}}

export async function exportTechPack(){
 const s=store.getState(),name=s.projName||'Watch';
 toast('Building the tech pack…');
 try{const{files}=await buildTechPack(s.d,s.customs,name);
  const blob=zip(files,{date:new Date(2020,0,1)});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${safe(name)}_techpack.zip`;a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),8000);
  toast('Tech pack ready: PDF and artwork')}
 catch(e){console.error(e);toast('The tech pack could not be built: '+(e&&e.message||e))}}
