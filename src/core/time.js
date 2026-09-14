/* Clock math.

   sceneClock(d, nowMs) is PURE: one time source for the hands, the date
   window, the GMT hand, the chronograph registers and every export. Nothing
   downstream may call `new Date()` of its own — that is what made a "set time"
   pose keep ticking and exports non-deterministic.

   The React hook at the bottom only decides WHEN to re-read the clock; it
   never computes angles itself. */
import React from 'react';
import {clamp} from './utils.js';
import {detentOf,detentStep,bezelRotOf,bezelRotatable,bezelElapsedMin,gmtReadHours,caseOf,movementAngles,marketingSecondsOf} from './geometry.js';
import {logoBoxOf} from './logo.js';
import {useApp} from '../state/store.js';
const {useState,useEffect}=React;

export const calcAngles=(dt,sweep)=>{const h=dt.getHours(),m=dt.getMinutes(),s=dt.getSeconds(),ms=sweep?dt.getMilliseconds():0;
 return{h:((h%12)+m/60+s/3600)*30,m:(m+(s+ms/1000)/60)*6,s:(s+ms/1000)*6,g:((h%24)+m/60)*15}};

export const fixedAng=t=>({h:(t.h%12)*30+t.m/2+t.s/120,m:t.m*6+t.s/10,s:t.s*6,g:((t.h%24)+t.m/60)*15});

export const pad2=n=>String(n).padStart(2,'0');

/* the classic advertising pose — day 28 so no month is too short for it */
export const MARKETING_TIME={h:10,m:9,s:36,date:28};

/* The scene's own date. In 'set' mode this is a fabricated date built from the
   design, NOT the host's clock, so a posed export shows the scene's day. */
export function sceneDate(d,nowMs){
 const t=d.time||{};
 if(t.mode!=='set')return new Date(nowMs);
 const base=new Date(nowMs);
 const lastDay=new Date(base.getFullYear(),base.getMonth()+1,0).getDate();
 const day=Math.min(clamp(Math.round(+t.date||1),1,31),lastDay);
 return new Date(base.getFullYear(),base.getMonth(),day,
  clamp(+t.h||0,0,23),clamp(+t.m||0,0,59),clamp(+t.s||0,0,59),0)}

export const gmtShift=d=>clamp(+((d.time&&d.time.gmtOffsetH)||0),-12,14);
export const gmtDate=(d,base)=>new Date(base.getTime()+gmtShift(d)*3600000);

/* chrono elapsed ms — pure in (state, now) so tests never touch the clock */
export function chronoElapsedMs(d,nowMs){
 const c=d.chrono||{};
 /* Number.isFinite, not `||`: 0 is a legitimate timestamp and the falsy
    check silently turned a real start time into "now", pinning a running
    chronograph at zero. */
 if(c.running){const st=Number.isFinite(+c.start)?+c.start:nowMs;
  return clamp(nowMs-st,0,43200000)}
 return clamp(+c.elapsed||0,0,43200000)}

/* sub-register angles: 30-min at 9h, 12-hr at 6h, chrono seconds centrally */
export function chronoAngles(ms){const total=ms/1000;
 return{sec30:(total%60)*6,min30:((total/60)%30)*12,hr12:((total/3600)%12)*30}}

export function sceneClock(d,nowMs,perfNow){
 nowMs=nowMs==null?Date.now():nowMs;
 const date=sceneDate(d,nowMs);
 const g=gmtDate(d,date);
 const t=d.time||{};
 const A=t.mode==='set'
  ?fixedAng({h:date.getHours(),m:date.getMinutes(),s:date.getSeconds()})
  :calcAngles(date,!!t.sweep);
 const isChrono=d.parts.dial.variant==='chrono';
 const chMs=isChrono?chronoElapsedMs(d,nowMs):0;
 const ch=chronoAngles(chMs);
 const rot=bezelRotOf(d);
 const n=detentOf(d);
 return{date,gmtDate:g,nowMs,
  /* the balance (or glide wheel) behind an exhibition caseback, in real time */
  movement:movementAngles(caseOf(d).movement,nowMs),
  ang:{hour:A.h,min:A.m,sec:A.s,gmt:A.g},
  /* the central seconds hand is the chrono seconds on a chrono dial */
  secAng:isChrono?ch.sec30:A.s,
  smallsecAng:A.s,
  chrono:{active:isChrono,ms:chMs,ang:ch,running:!!(d.chrono&&d.chrono.running)},
  bezel:{rot,detents:n,step:detentStep(n),
   elapsedMin:bezelElapsedMin(A.m,rot),gmt:gmtReadHours(A.g,rot),
   rotatable:bezelRotatable(d),dir:d.parts.bezel.dir==='ccw'?'ccw':'bi'}}}

/* A whole scene frozen at the marketing pose — hands AND date agree. Used by
   thumbnails, the spec card and the design sheet so they never tick. */
export const marketingClock=d=>sceneClock({...d,time:{...(d.time||{}),mode:'set',...MARKETING_TIME,s:marketingSecondsOf(d,
 /* the logo, if there is one, at its fitted size (its image's shape is not known here: square is the tallest) */
 d.active&&d.active.logo?[(({x,y,w,h})=>({x0:x-w/2,x1:x+w/2,y0:y-h/2,y1:y+h/2}))(logoBoxOf(d,1))]:[])}},Date.now());

export const fmtChrono=ms=>{const t=Math.floor(ms/100);
 return `${pad2(Math.floor(t/600))}:${pad2(Math.floor(t/10)%60)}.${t%10}`};

/* Re-read the scene clock on a schedule. Live time ticks; a set pose does not,
   but a RUNNING chronograph still has to animate even from a frozen pose. */
export function useSceneClock(){const d=useApp().d;
 const t=d.time||{};const running=!!(d.chrono&&d.chrono.running);
 const[,bump]=useState(0);
 useEffect(()=>{
  const live=t.mode==='live';
  if(!live&&!running)return;                       /* fully static: never tick */
  let raf,iv;
  if(t.sweep||running){const loop=()=>{bump(n=>n+1);raf=requestAnimationFrame(loop)};loop();
   return()=>cancelAnimationFrame(raf)}
  iv=setInterval(()=>bump(n=>n+1),200);return()=>clearInterval(iv)},[t.mode,t.sweep,running]);
 return sceneClock(d,Date.now())}
