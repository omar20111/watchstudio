/* Custom image upload: rasterize into the shared 1200² space. */
import React from 'react';
import {CAN} from '../core/constants.js';
import {mk} from '../core/utils.js';
import {frameBox} from '../core/geometry.js';
import {store,useApp} from '../state/store.js';
const {useRef,useState}=React;

export function processFile(part,file,mode,removeWhite,cb){const rd=new FileReader();
 rd.onload=()=>{const img=new Image();img.onload=()=>{const[cv,ctx]=mk(CAN);
  if(mode==='template'){const s=Math.min(CAN/img.width,CAN/img.height,1);ctx.drawImage(img,(CAN-img.width*s)/2,(CAN-img.height*s)/2,img.width*s,img.height*s)}
  else{const b=frameBox(part,store.getState().d);const pad=10;const s=Math.min((b[2]-pad*2)/img.width,(b[3]-pad*2)/img.height);const w=img.width*s,h=img.height*s;ctx.drawImage(img,b[0]+(b[2]-w)/2,b[1]+(b[3]-h)/2,w,h)}
  if(removeWhite){const id=ctx.getImageData(0,0,CAN,CAN),px=id.data;for(let i=0;i<px.length;i+=4){if(px[i]>235&&px[i+1]>235&&px[i+2]>235)px[i+3]=0}ctx.putImageData(id,0,0)}
  cb(cv.toDataURL('image/png'))};img.src=rd.result};rd.readAsDataURL(file)}

export function UploadZone({part}){const s=useApp();const[mode,setMode]=useState('fit');const[rw,setRw]=useState(false);const inp=useRef();
 /* the checkbox is offered for every accepted type, so honour it for every type —
    it used to be silently ignored for PNG and SVG */
 const handle=f=>{if(!f)return;processFile(part,f,mode,rw,url=>s.addUpload(part,f.name,url))};
 return<div className="space-y-1.5">
  <div onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();handle(e.dataTransfer.files[0])}} onClick={()=>inp.current.click()}
   className="border border-dashed border-white/20 rounded-lg p-3 text-center text-[11px] text-neutral-400 cursor-pointer hover:border-[#d4af37]/60 hover:text-neutral-200">
   ⤓ Drop PNG / JPG / SVG or click<br/><span className="text-neutral-500">transparent PNG recommended</span></div>
  <input ref={inp} type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={e=>{handle(e.target.files[0]);e.target.value=''}}/>
  <div className="flex items-center gap-2 text-[11px] text-neutral-400">
   <select className="bg-[#1b1c21] border border-white/10 rounded px-1 py-0.5" value={mode} onChange={e=>setMode(e.target.value)}>
    <option value="fit">Auto-fit to part frame</option><option value="template">Full-canvas (1200² template)</option></select>
   <label className="flex items-center gap-1"><input type="checkbox" checked={rw} onChange={e=>setRw(e.target.checked)}/>key out white</label></div></div>}
