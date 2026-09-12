/* Compose the design state into an ordered layer list for the stage/export.

   Order is the physical construction stack, bottom up:
   strap -> case -> crown -> bezel -> dial -> rehaut -> markers -> hands -> crystal.
   The rehaut sits above the dial only so the shadow it throws lands on the dial
   edge; the two rings do not overlap. */
import {MF} from './constants.js';
import {getProc} from './cache.js';
import {bezelRotatable} from './geometry.js';
import {tex} from './textures.js';

export function buildLayers(d,customs){const P=d.parts;const L=[];
 const cust=part=>{const id=d.active[part];return id&&customs[part]&&customs[part][id]?customs[part][id]:null};
 const cS=cust('strap');
 if(cS)L.push({key:'strapB',url:cS.url,t:P.strap.t,z:1,filter:MF[P.strap.metal],tex:P.strap.finish!=='none'?tex(P.strap.finish):null});
 else{L.push({key:'strapB',cv:getProc('strap',d,'bottom'),proc:['strap','bottom'],t:P.strap.t,z:1});
  L.push({key:'strapT',cv:getProc('strap',d,'top'),proc:['strap','top'],t:P.strap.t,z:2})}
 const cC=cust('case');L.push(cC?{key:'case',url:cC.url,t:P.case.t,z:3,filter:MF[P.case.metal],tex:P.case.finish!=='none'?tex(P.case.finish):null}:{key:'case',cv:getProc('case',d),proc:['case'],t:P.case.t,z:3});
 const cCr=cust('crown');L.push(cCr?{key:'crown',url:cCr.url,t:P.crown.t,z:4,filter:MF[P.crown.metal]}:{key:'crown',cv:getProc('crown',d),proc:['crown'],t:P.crown.t,z:4});
 const cB=cust('bezel');L.push(cB?{key:'bezel',url:cB.url,t:P.bezel.t,z:5,filter:MF[P.bezel.metal],tex:P.bezel.finish!=='none'?tex(P.bezel.finish):null}:{key:'bezel',cv:getProc('bezel',d),proc:['bezel'],t:P.bezel.t,z:5});
  /* The insert is a separate bake so rotating the bezel is a DOM transform on
    this layer, not a re-bake of the whole ring. Fixed bezels have no insert. */
 if(!cB&&bezelRotatable(d))L.push({key:'bezelIns',cv:getProc('bezel',d,'insert'),proc:['bezel','insert'],
   t:P.bezel.t,z:5,spin:'bezel'});
 const cD=cust('dial');L.push(cD?{key:'dial',url:cD.url,t:P.dial.t,z:6}:{key:'dial',cv:getProc('dial',d),proc:['dial'],t:P.dial.t,z:6});
 /* part of the case, so it follows the case transform and is skipped when the
    user has replaced the case with their own image */
 if(!cC)L.push({key:'rehaut',cv:getProc('rehaut',d),proc:['rehaut'],t:P.case.t,z:7});
 const cM=cust('markers');L.push(cM?{key:'markers',url:cM.url,t:P.markers.t,z:8,glow:P.markers.glow?P.markers.lume:null}:{key:'markers',cv:getProc('markers',d),proc:['markers'],t:P.markers.t,z:8,glow:P.markers.glow?P.markers.lume:null});
 const cH=cust('hands');
 if(cH)L.push({key:'handsC',url:cH.url,t:P.hands.tM,z:10,filter:MF[P.hands.metal]});
 else{L.push({key:'hour',cv:getProc('hands',d,'hour'),proc:['hands','hour'],t:P.hands.tH,z:9,glow:P.hands.glow?P.hands.lume:null});
  L.push({key:'min',cv:getProc('hands',d,'min'),proc:['hands','min'],t:P.hands.tM,z:10,glow:P.hands.glow?P.hands.lume:null});
  L.push({key:'sec',cv:getProc('hands',d,'sec'),proc:['hands','sec'],t:P.hands.tS,z:11})}
 const cX=cust('crystal');L.push(cX?{key:'crystal',url:cX.url,t:P.crystal.t,z:12,o:P.crystal.opacity}:{key:'crystal',cv:getProc('crystal',d),proc:['crystal'],t:P.crystal.t,z:12,o:P.crystal.opacity});
 return L}

/* Which scene angle each layer follows. One table, read by the stage, both
   presentation cameras and the exporter — so a spinning bezel can never move
   on screen and stay still in the export. */
export function layerAngle(key,clock){
 if(!clock)return 0;
 switch(key){
  case'hour':return clock.ang.hour;
  case'min':return clock.ang.min;
  case'sec':return clock.secAng;
  case'gmt':return clock.ang.gmt;
  case'smallsec':return clock.smallsecAng;
  case'chSec':return clock.chrono.ang.sec30;
  case'chMin':return clock.chrono.ang.min30;
  case'chHr':return clock.chrono.ang.hr12;
  case'bezelIns':return clock.bezel.rot;
  default:return 0}}
