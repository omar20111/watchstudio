/* A wrist to wear the watch on, for the product render.

   The point of it is scale: a 41 mm case reads one way on a table and another on
   a 16 cm wrist. So the arm is built from the same oval the strap wraps
   (lathe.js wristOval) — the skin under the strap is exactly where the strap
   lies — and runs a hand's width either way along the arm, narrowing toward the
   hand (the crown side, as a watch is worn on the left wrist) and widening
   toward the elbow, its ends rounded off. Skin, not a mannequin's plastic: a
   soft sheen and no clearcoat. */
import {BufferGeometry,Float32BufferAttribute,Mesh,MeshPhysicalMaterial,Color} from 'three';
import {wristOval} from './lathe.js';

export const SKIN_TONES=[['light','#e6c4ad'],['medium','#c69a80'],['tan','#a07058'],['deep','#61412f']];
export const skinOf=id=>(SKIN_TONES.find(t=>t[0]===id)||SKIN_TONES[1])[1];

const LEN=280,NX=140,NA=128;
/* `side`: the left wrist has the hand toward the crown (+x), the right the elbow */
export function wristGeometry(cm,side='left'){const W=wristOval(cm),half=LEN/2,toHand=side==='right'?-1:1;
 const pos=[],idx=[];
 for(let i=0;i<=NX;i++){const x=-half+LEN*i/NX,t=x/half;
  /* narrower toward the hand (+x), wider toward the elbow; rounded off at both ends */
  const taper=1-.07*t*toHand,end=Math.abs(t)>.9?Math.sqrt(Math.max(0,1-((Math.abs(t)-.9)/.1)**2)):1,k=taper*end;
  for(let j=0;j<=NA;j++){const f=j/NA*Math.PI*2;
   pos.push(x,W.yc+W.b*k*Math.cos(f),W.a*k*Math.sin(f))}}
 for(let i=0;i<NX;i++)for(let j=0;j<NA;j++){const a=i*(NA+1)+j,b=a+NA+1;idx.push(a,a+1,b,b,a+1,b+1)}
 const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(pos,3));
 g.setIndex(idx);g.computeVertexNormals();return g}

export function wristMesh(cm,tone='medium',side='left'){
 const col=new Color(skinOf(tone));
 const mat=new MeshPhysicalMaterial({color:col,roughness:.74,metalness:0,sheen:.3,sheenRoughness:.6,
  sheenColor:col.clone().lerp(new Color('#ff9a7a'),.35)});
 const m=new Mesh(wristGeometry(cm,side),mat);m.receiveShadow=true;m.castShadow=false;
 m.userData={noPick:true,wrist:cm};
 return m}
