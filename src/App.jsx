/* App shell: layout, keyboard shortcuts, modal routing. */
import React from 'react';
import {PARTS} from './core/parts.js';
import {clamp,normDeg} from './core/utils.js';
import {store,useApp,patchPartT} from './state/store.js';
import {bezelRotatable,bezelRotOf} from './core/geometry.js';
import {readShareFromLocation} from './export/shareUrl.js';
import {TopBar} from './ui/TopBar.jsx';
import {PartsList} from './ui/PartsList.jsx';
import {Controls} from './ui/Controls.jsx';
import {Stage} from './ui/Stage.jsx';
import {SaveModal,ProjectsModal,SharedModal} from './ui/Modals.jsx';
import {ProductRender,DesignSheet} from './ui/Views.jsx';
import {Modal} from './ui/primitives.jsx';
import {strapMmOf} from './core/geometry.js';
import {PX} from './core/constants.js';
const {useEffect,useState}=React;

/* Any renderer or geometry throw used to unmount the whole tree to a blank page.
   The design itself is safe in the store and in autosave, so offer a way back
   instead of a white screen. */
class Boundary extends React.Component{
 constructor(p){super(p);this.state={err:null}}
 static getDerivedStateFromError(err){return{err}}
 componentDidCatch(err,info){console.error('WatchStudio view crashed:',err,info&&info.componentStack)}
 render(){if(!this.state.err)return this.props.children;
  return<div role="alert" className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
   <div className="text-sm text-[#e8c766]">This view hit an error and stopped drawing.</div>
   <div className="text-[11px] text-neutral-500 max-w-md">Your design is not lost — it is still in autosave. {String(this.state.err&&this.state.err.message||'')}</div>
   <div className="flex gap-2">
    <button className="btn" onClick={()=>this.setState({err:null})}>Try again</button>
    <button className="btn" onClick={()=>{store.get().setD(n=>{n.view='edit';n.camera='front';n.zoom=1});this.setState({err:null})}}>Back to the editor</button>
   </div></div>}}

export default function App(){const s=useApp();const d=s.d;
 const[modal,setModal]=useState(null);
 const[shared,setShared]=useState(null);
 const close=()=>setModal(null);
 /* resolve uploaded blobs from the vault once, after mount */
 useEffect(()=>{store.get().rehydrateImages&&store.get().rehydrateImages()},[]);
 /* A #w=... fragment is a shared design. Opening one used to replace the
    visitor's autosaved design outright, with no undo. Now: a pristine session
    just opens it; anyone with work of their own is asked, and their design is
    kept in Projects before anything is replaced. */
 useEffect(()=>{const sh=readShareFromLocation();if(!sh)return;
  history.replaceState(null,'',location.pathname+location.search);
  if(store.get().hasWork())setShared(sh);
  else store.get().importState({d:sh.d,name:sh.name,customs:{}})},[]);
 useEffect(()=>{const h=e=>{const tg=(e.target&&e.target.tagName||'').toLowerCase();
  if(tg==='input'||tg==='select'||tg==='textarea')return;
  /* an open dialog owns the keyboard — arrows must not nudge parts behind it */
  if(document.querySelector('[role="dialog"]'))return;
  const st=store.getState();
  /* the presentation modes are read-only — no nudging parts from there */
  if(st.d.view!=='edit'&&!((e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())))return;
  if((e.ctrlKey||e.metaKey)&&!e.altKey){const key=e.key.toLowerCase();
   if(key==='z'){e.preventDefault();e.shiftKey?st.redo():st.undo();return}
   if(key==='y'){e.preventDefault();st.redo();return}}
  if(e.ctrlKey||e.metaKey)return;
  const sel=st.sel,dd=st.d,base0=part=>part==='hands'&&!dd.active.hands?dd.parts.hands.tH:dd.parts[part].t;
  const stp=e.shiftKey?10:2;
  const nudge=(dx,dy)=>{e.preventDefault();const b=base0(sel);
   patchPartT(sel,{x:clamp(b.x+dx,-300,300),y:clamp(b.y+dy,-300,300)},'nudge:'+sel)};
  /* with the bezel selected, left/right are detent clicks rather than nudges —
     that is what the ring is for */
  const bezelKeys=sel==='bezel'&&bezelRotatable(dd);
  if(bezelKeys&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){
   e.preventDefault();st.nudgeBezel(e.key==='ArrowRight'?1:-1);return}
  switch(e.key){
   case'ArrowLeft':nudge(-stp,0);break;
   case'ArrowRight':nudge(stp,0);break;
   case'ArrowUp':nudge(0,-stp);break;
   case'ArrowDown':nudge(0,stp);break;
   case'[':case']':{e.preventDefault();const b=base0(sel);const dr=(e.shiftKey?15:2)*(e.key===']'?1:-1);
    patchPartT(sel,{r:Math.round(normDeg(b.r+dr))},'rot:'+sel);break}
   case'f':case'F':st.setD(n=>{n.zoom=1});break;
   /* V cycles cameras, 0 resets the bezel, Space/R drive the chronograph */
   case'v':case'V':{e.preventDefault();
    /* two cameras, both real drawings — see CHANGELOG for why there is no 3/4 */
    st.setD(n=>{n.camera=n.camera==='profile'?'front':'profile'});break}
   case'0':{if(bezelRotatable(st.d)){e.preventDefault();st.resetBezel()}break}
   case' ':{if(st.d.parts.dial.variant==='chrono'){e.preventDefault();st.chronoToggle()}break}
   case'r':case'R':{if(st.d.parts.dial.variant==='chrono'){e.preventDefault();st.chronoReset()}break}
   default:{const n=parseInt(e.key,10);if(n>=1&&n<=PARTS.length)st.select(PARTS[n-1][0])}}};
  window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h)},[]);
 const vault=s.vault||{ok:true};
 return<div className="h-full flex flex-col">
  <TopBar onModal={setModal}/>
  {/* A banner, not a toast: the failure this reports is silent data loss, and
      a message that fades after two seconds is how it went unnoticed before. */}
  {!vault.ok&&<div role="alert" className="shrink-0 flex items-center gap-3 px-3 py-2 bg-amber-500/15 border-b border-amber-500/40 text-[11px] text-amber-200">
   <span aria-hidden="true">⚠</span>
   <span className="flex-1">{vault.message||'The image vault is unavailable — uploads will not survive a reload.'}</span>
   <button className="btn" onClick={()=>store.get().rehydrateImages()}>Retry</button>
  </div>}
  <Boundary key={d.view}>
  {d.view==='product'?<ProductRender/>:d.view==='sheet'?<DesignSheet/>:<>
   <div className="flex-1 flex min-h-0 overflow-x-auto">
    <PartsList/><Stage/><Controls/>
   </div>
   <div className="h-7 shrink-0 flex items-center gap-4 px-3 border-t border-white/10 bg-[#16171b] text-[10px] text-neutral-500 overflow-x-auto whitespace-nowrap">
    <span>Scale 1 mm = {PX} px @1200²</span><span>Case {d.caseMm} mm</span><span>Lug {strapMmOf(d)} mm</span>
    <span>Zoom {Math.round(d.zoom*100)}%</span><span className="text-neutral-600">All layers share one 1200×1200 canvas, center (600,600)</span>
   </div></>}
  </Boundary>
  {shared&&<SharedModal shared={shared} onClose={()=>setShared(null)}/>}
  {modal==='save'&&<SaveModal onClose={close}/>}
  {modal==='projects'&&<ProjectsModal onClose={close}/>}
  {modal==='reset'&&<Modal title="Reset design" onClose={close}>
   <p className="text-xs text-neutral-400 mb-3">Every part returns to its default preset. Saved projects are not affected.</p>
   <div className="flex gap-2"><button className="btn flex-1" onClick={close}>Cancel</button>
    <button className="btn flex-1 text-red-400" onClick={()=>{store.get().reset();close()}}>Reset</button></div></Modal>}
 </div>}
