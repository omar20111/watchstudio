/* The movement behind an exhibition caseback, built as parts.

   It sits in the mid-case between the caseback and the dial, as high as the
   thickness stack says the chosen movement is, and wide enough that the
   sapphire window shows nothing but movement. Seen through the window, from the
   caseback side inward:

     rotor       an automatic's winding weight: a half disc with a heavy gold
                 rim, engraved, on a centre bearing (automatic, spring drive)
     wheels      the ratchet and crown wheels on the barrel bridge, their teeth
                 cut round the rim and their faces turned in circles
     jewels      synthetic rubies in gold settings at the pivots, and blued
                 screws holding the bridges down
     bridges     the barrel bridge, train bridge and balance cock, decorated
                 with Côtes de Genève
     balance     the balance wheel and its hairspring, swinging at the beat
                 (geometry.js movementAngles) in a recess of the plate; a spring
                 drive turns a glide wheel there instead
     plate       the main plate under it all, grained with perlage

   A quartz movement shows its battery, coil and circuit cover instead.

   Local frame: y up toward the dial, x toward 3 o'clock, z toward 6 o'clock.
   Everything is in millimetres, scaled from the movement's radius `m`. */
import {Group,Mesh,Shape,Path,ExtrudeGeometry,ShapeGeometry,CylinderGeometry,LatheGeometry,TubeGeometry,BoxGeometry,
        CatmullRomCurve3,Vector2,Vector3,MeshPhysicalMaterial,Color} from 'three';
import {metalMaterial} from './materials.js';
import {cotesNormalMap,perlageNormalMap,snailNormalMap} from './surface.js';
import {engravedMetalMaps} from './wear.js';
import {CASEBACK_WINDOW} from '../render/caseback.js';

/* gap between the caseback's inside and the movement */
const BACK_GAP=.12;

/* The movement's size and heights in the case. `r` is as wide as the dial
   allows and wider than the window; `y0` is its caseback side, `yB` the face of
   its bridges, `yT` its dial side. An automatic keeps the space its rotor
   swings in between y0 and the bridges. */
export function movementLayout(kind,H,Rr){
 const rw=Rr.rCase*CASEBACK_WINDOW;
 const r=Math.max(rw+.8,Math.min(Rr.dialR*.96,Rr.rCase*.68));
 const rotor=kind==='automatic'||kind==='spring';
 const y0=H.back+BACK_GAP,yT=H.back+H.stack.movement;
 /* a quartz movement's coil and quartz capsule lie on its plate, toward the caseback */
 const yB=y0+(rotor?1.15:kind==='quartz'?1:.5);
 const m=r;
 return{kind,r,rw,y0,yB,yT,rotor,
  balance:{x:.36*m,z:.36*m,r:.3*m},
  barrel:{x:.2*m,z:-.3*m,r:.3*m},
  crownWheel:{x:.6*m,z:-.15*m,r:.13*m},
  escape:{x:.05*m,z:.42*m}}}

const V2=(x,y)=>new Vector2(x,y);
/* a shape given in the movement's xz plane, extruded from y0 up to y1: shape y is
   -z once the extrusion is laid flat (as in watch.js) */
function slab(shapes,y0,y1,bevel=.06){const t=y1-y0,b=Math.min(bevel,t*.3);
 const g=new ExtrudeGeometry(shapes,{depth:Math.max(.01,t-2*b),bevelEnabled:b>0,bevelThickness:b,bevelSize:b,bevelOffset:-b,bevelSegments:2,curveSegments:24});
 g.translate(0,0,b);g.rotateX(-Math.PI/2);g.translate(0,y0,0);return g}
const xz=(x,z)=>V2(x,-z);
/* a closed outline from xz points */
const outline=pts=>{const s=new Shape();pts.forEach(([x,z],i)=>i?s.lineTo(x,-z):s.moveTo(x,-z));s.closePath();return s};
/* a circle as a Path (a hole), clockwise in shape space */
const hole=(x,z,r)=>{const p=new Path();p.absarc(x,-z,r,0,Math.PI*2,true);return p};
/* points along an arc in the xz plane, angles in radians (0 toward +x, turning toward +z) */
const arc=(cx,cz,r,a0,a1,n=24)=>{const o=[];for(let i=0;i<=n;i++){const a=a0+(a1-a0)*i/n;o.push([cx+r*Math.cos(a),cz+r*Math.sin(a)])}return o};

const MAT={
 /* the waves are shallow: a mirror polish with a strong normal reads as black
    and white bars rather than bands of sheen */
 rhodium:()=>{const m=new MeshPhysicalMaterial({color:new Color('#d3d7dc'),metalness:1,roughness:.32});
  m.normalMap=cotesNormalMap(2.6);m.normalScale=new Vector2(.16,.16);return m},
 plate:()=>{const m=new MeshPhysicalMaterial({color:new Color('#b4b8be'),metalness:1,roughness:.42});
  m.normalMap=perlageNormalMap();m.normalScale=new Vector2(.3,.3);return m},
 /* turned from the centre, like a ratchet wheel's face: needs UVs 0..1 across it */
 soleil:()=>{const m=new MeshPhysicalMaterial({color:new Color('#d9dde2'),metalness:1,roughness:.26});
  m.normalMap=snailNormalMap(28);m.normalScale=new Vector2(.35,.35);return m},
 gilt:()=>{const m=metalMaterial('gold','polished');m.roughness=.18;return m},
 steel:finish=>metalMaterial('steel',finish),
 ruby:()=>new MeshPhysicalMaterial({color:new Color('#8e0f24'),metalness:0,roughness:.06,clearcoat:1,clearcoatRoughness:.02,ior:1.76,specularIntensity:1}),
 blued:()=>new MeshPhysicalMaterial({color:new Color('#223f94'),metalness:1,roughness:.22}),
 slot:()=>new MeshPhysicalMaterial({color:new Color('#15171a'),roughness:.6}),
 glucydur:()=>new MeshPhysicalMaterial({color:new Color('#d4b06a'),metalness:1,roughness:.2}),
 copper:()=>new MeshPhysicalMaterial({color:new Color('#b8643a'),metalness:1,roughness:.3}),
 cover:()=>{const m=new MeshPhysicalMaterial({color:new Color('#c8a95a'),metalness:1,roughness:.3});
  m.normalMap=perlageNormalMap(.7);m.normalScale=new Vector2(.5,.5);return m}};

/* A rotor's engraving, cut into its metal: the lettering white on nothing, from
   which engravedMetalMaps (wear.js) makes grooves with sloped walls, matte and
   darker than the polish. It was a grey picture with dark print laid over the
   rotor, as flat as a sticker. One set of maps per text. */
const engravings=new Map();
function engraving(text){if(engravings.has(text))return engravings.get(text);
 const W=1024,cv=document.createElement('canvas');cv.width=cv.height=W;const ctx=cv.getContext('2d',{willReadFrequently:true});
 ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';
 /* on the rotor's half disc, seen from the caseback: upper right of the canvas */
 ctx.font='600 38px Georgia, serif';ctx.fillText(text,632,256);
 ctx.font='500 24px system-ui, sans-serif';ctx.fillText('AUTOMATIC · 25 JEWELS',632,312);
 const maps=engravedMetalMaps(cv,W);engravings.set(text,maps);return maps}

/* Build the movement for a design's case. `engrave` is the case's engraving. */
export function buildMovement(kind,H,Rr,{engrave='WATCHSTUDIO'}={}){
 const L=movementLayout(kind,H,Rr),{r:m,y0,yB,yT}=L,g=new Group();g.name='movement';
 const add=(to,name,geo,mat)=>{const o=new Mesh(geo,mat);o.name='movement:'+name;o.castShadow=o.receiveShadow=true;to.add(o);return o};
 const B=L.balance,br=B.r+.3;

 /* plate: everything behind the bridges, with the balance's recess in it */
 const plateTop=yB+.45,recess=yB+1.15;
 {const s=new Shape();s.absarc(0,0,m,0,Math.PI*2,false);
  if(kind!=='quartz')s.holes.push(hole(B.x,B.z,br));
  add(g,'plate',slab([s],plateTop,yT,.1),MAT.plate());
  /* the recess floor faces the caseback: laid with rotateX(+90deg), shape y is +z */
  if(kind!=='quartz'){const f=new ShapeGeometry(new Shape().absarc(B.x,B.z,br,0,Math.PI*2,false),32);
   f.rotateX(Math.PI/2);f.translate(0,recess,0);add(g,'recess',f,MAT.plate())}}

 if(kind==='quartz')return quartz(g,L,add);

 /* bridges: barrel bridge over the top half, train bridge at 9, the balance cock at 4:30 */
 const edge=m*.97,bridges=[];
 bridges.push(outline([...arc(0,0,edge,Math.PI*1.04,Math.PI*1.96,40),[edge*.9,-.05*m],[.1*m,.02*m],[-edge*.9,-.02*m]]));
 bridges.push(outline([...arc(0,0,edge,Math.PI*.99,Math.PI*.62,24),[.08*m,.5*m],[0,.28*m],[-.1*m,.06*m]]));
 /* the cock: a round eye over the balance on an arm that widens to the edge, one outline */
 {const d=Math.hypot(B.x,B.z),ux=B.x/d,uz=B.z/d,px=-uz,pz=ux,wR=.15*m,th=Math.atan2(uz,ux);
  bridges.push(outline([...arc(B.x,B.z,.12*m,th+Math.PI/2,th+Math.PI*1.5,20),[ux*edge-px*wR,uz*edge-pz*wR],[ux*edge+px*wR,uz*edge+pz*wR]]))}
 add(g,'bridges',slab(bridges,yB,plateTop),MAT.rhodium());

 /* balance wheel and hairspring in the recess, swinging about the cock's jewel */
 {const bal=new Group();bal.name='balance';bal.position.set(B.x,(plateTop+recess)/2,B.z);bal.userData.spin=kind==='spring'?'glide':'balance';g.add(bal);
  const rr=B.r,t=.28,rim=Math.max(.35,rr*.12);
  const wheel=new LatheGeometry([V2(rr-rim,-t/2),V2(rr,-t/2),V2(rr,t/2),V2(rr-rim,t/2),V2(rr-rim,-t/2)],64);
  add(bal,'balanceRim',wheel,MAT.glucydur());
  const arms=kind==='spring'?5:3;
  for(let k=0;k<arms;k++){const a=new BoxGeometry(rr*2-rim,t*.7,Math.max(.22,rr*.07));a.translate(0,0,0);a.rotateY(k*Math.PI/arms);add(bal,'balanceArm'+k,a,MAT.glucydur())}
  add(bal,'balanceStaff',new CylinderGeometry(.18,.18,recess-plateTop+.3,16),MAT.steel('polished'));
  /* timing screws round a mechanical balance's rim */
  if(kind!=='spring')for(let k=0;k<8;k++){const a=k/8*Math.PI*2,sc=new CylinderGeometry(.16,.16,.22,10);
   sc.rotateZ(Math.PI/2);sc.rotateY(-a);sc.translate(Math.cos(a)*(rr+.08),0,Math.sin(a)*(rr+.08));add(bal,'balanceScrew'+k,sc,MAT.gilt())}
  if(kind!=='spring'){const pts=[],turns=11;
   for(let i=0;i<=turns*48;i++){const u=i/(turns*48),a=u*turns*Math.PI*2,rad=rr*(.14+.62*u);pts.push(new Vector3(Math.cos(a)*rad,-t/2-.12,Math.sin(a)*rad))}
   add(bal,'hairspring',new TubeGeometry(new CatmullRomCurve3(pts),turns*64,.035,4,false),MAT.steel('polished'))}}

 /* ratchet and crown wheels on the barrel bridge: turned faces, cut teeth */
 /* a wheel with its teeth cut round the outline, its face turned from the centre */
 const wheelAt=(name,c,teeth,h)=>{const w=new Group();w.position.set(c.x,0,c.z);g.add(w);
  const pts=[];for(let i=0;i<teeth;i++){const a=i/teeth*Math.PI*2,da=Math.PI*2/teeth;
   pts.push([Math.cos(a)*c.r*.93,Math.sin(a)*c.r*.93],[Math.cos(a+da*.45)*c.r,Math.sin(a+da*.45)*c.r],[Math.cos(a+da*.6)*c.r*.93,Math.sin(a+da*.6)*c.r*.93])}
  const geo=slab([outline(pts)],yB-h,yB,.03),uv=geo.attributes.uv,p=geo.attributes.position;
  for(let i=0;i<p.count;i++)uv.setXY(i,.5-p.getX(i)/(2*c.r),.5-p.getZ(i)/(2*c.r));
  add(w,name,geo,MAT.soleil());
  screw(w,'screw:'+name,0,0,yB-h)};
 const screw=(to,name,x,z,y,rad=.55)=>{const s=new CylinderGeometry(rad,rad,.16,24);s.translate(x,y-.08,z);add(to,name,s,MAT.blued());
  const sl=new BoxGeometry(rad*2.05,.09,rad*.3);sl.rotateY(.7);sl.translate(x,y-.14,z);add(to,name+'Slot',sl,MAT.slot())};
 wheelAt('ratchet',L.barrel,72,.28);
 wheelAt('crownWheel',L.crownWheel,30,.22);

 /* jewels at the pivots, in gold settings standing a hair proud of the bridges */
 const jewels=[[B.x,B.z],[L.escape.x,L.escape.z],[-.12*m,.28*m],[-.36*m,.12*m],[-.55*m,-.3*m],[.62*m,-.52*m]];
 jewels.forEach(([x,z],k)=>{const ch=new CylinderGeometry(.78,.78,.08,28);ch.translate(x,yB-.04,z);add(g,'chaton'+k,ch,MAT.gilt());
  const j=new CylinderGeometry(.42,.46,.06,24);j.translate(x,yB-.1,z);add(g,'jewel'+k,j,MAT.ruby())});
 /* screws holding the bridges */
 for(const[x,z]of[[-.72*m,-.48*m],[.1*m,-.8*m],[-.78*m,.3*m],[-.3*m,.55*m],[.78*m*Math.cos(.78),.78*m*Math.sin(.78)]])screw(g,'bridgeScrew',x,z,yB);

 /* rotor: half a disc turning on the centre bearing, its heavy rim toward the caseback */
 if(L.rotor){const rot=new Group();rot.name='rotor';g.add(rot);
  const a0=Math.PI*.85,a1=Math.PI*1.85,ro=m*.95,ri=m*.8,top=yB-.4;
  const sector=outline([...arc(0,0,.16*m,a1,a0,12),...arc(0,0,ri,a0,a1,40)]);
  const plate=slab([sector],top-.35,top,.05);
  /* the engraving's canvas is laid across the plate's own xz */
  {const p=plate.attributes.position,uv=plate.attributes.uv;
   /* seen from the caseback, 3 o'clock is on the left and 12 at the top */
   for(let i=0;i<p.count;i++)uv.setXY(i,.5-p.getX(i)/(2*ro),.5-p.getZ(i)/(2*ro))}
  const pm=metalMaterial('steel','polished'),eng=engraving(engrave.toUpperCase());pm.color=new Color('#d3d7dc');pm.roughness=.2;
  if(eng){pm.normalMap=eng.normal;pm.roughnessMap=eng.rough;pm.roughness=.4;pm.map=eng.shade}
  add(rot,'rotorPlate',plate,pm);
  const ring=outline([...arc(0,0,ro,a0,a1,48),...arc(0,0,ri-.05,a1,a0,48)]);
  add(rot,'rotorRim',slab([ring],y0+.05,top,.12),MAT.gilt());
  const hub=new CylinderGeometry(.16*m,.16*m,yB-(top-.5),40);hub.translate(0,(yB+top-.5)/2,0);add(rot,'rotorBearing',hub,MAT.steel('polished'));
  screw(rot,'rotorScrew',0,0,top-.5,.12*m*.55)}
 return g}

/* A quartz movement: a gilt circuit cover, the battery in its well, the coil
   and the capsule of the quartz crystal, all held by plain steel screws. */
function quartz(g,L,add){const{r:m,y0,yB}=L,edge=m*.97;
 const cover=outline([...arc(0,0,edge,Math.PI*.9,Math.PI*2.1,48),[.15*m,.2*m]]);
 add(g,'cover',slab([cover],yB,yB+.45),MAT.cover());
 const plateTop=yB+.45;
 /* an SR626 cell, 6.8 mm across and 2.6 mm thick, most of it sunk in the plate */
 const bat=new CylinderGeometry(3.4,3.4,2.1,64);bat.translate(-.3*m,y0+.08+1.05,.42*m);add(g,'battery',bat,MAT.steel('brushed'));
 const coil=new CylinderGeometry(.7,.7,5,32);coil.rotateZ(Math.PI/2);coil.translate(.4*m,plateTop-.7,.45*m);add(g,'coil',coil,MAT.copper());
 const cap=new CylinderGeometry(.6,.6,3.2,24);cap.rotateZ(Math.PI/2);cap.rotateY(.5);cap.translate(-.2*m,plateTop-.6,.1*m);add(g,'quartz',cap,MAT.steel('polished'));
 for(const[x,z]of[[.7*m,-.3*m],[-.6*m,-.55*m],[.55*m,.55*m]]){const s=new CylinderGeometry(.5,.5,.14,20);s.translate(x,yB-.07,z);add(g,'screw',s,MAT.steel('polished'))}
 return g}
