/* The design's artwork, part by part, and the clock angle each moving part follows.

   buildLayers lists every part's flat artwork — the painted bake, or the
   user's upload — for the layered export's per-part files. The case, crown and
   crystal are solids, built and drawn only in 3D; they appear here only when the
   user uploaded a picture of their own. layerAngle is the one table the 3D
   hands, the chronograph registers and the bezel insert all turn by, in the
   editor, the presentation views and every export alike. */
import {getProc} from './cache.js';
import {bezelRotatable} from './geometry.js';
import {logoSheet} from './logo.js';

export function buildLayers(d,customs){const L=[];
 const cust=part=>{const id=d.active[part];return id&&customs[part]&&customs[part][id]?customs[part][id]:null};
 /* a part's painted bake, or the picture uploaded in its place */
 const art=(part,key,sub)=>{const c=cust(part);L.push(c?{key,url:c.url}:{key,cv:getProc(part,d,sub)})};
 art('strap','strapB','bottom');if(!cust('strap'))art('strap','strapT','top');
 for(const part of['case','crown']){const c=cust(part);if(c)L.push({key:part,url:c.url})}
 art('bezel','bezel');
 if(!cust('bezel')&&bezelRotatable(d))L.push({key:'bezelIns',cv:getProc('bezel',d,'insert')});
 art('dial','dial');
 /* the user's logo, once its image has loaded */
 const lg=logoSheet(d,customs||{});if(lg&&!(lg instanceof Promise))L.push({key:'logo',cv:lg});
 art('markers','markers');
 if(cust('hands'))L.push({key:'handsC',url:cust('hands').url});
 else for(const k of['hour','min','sec'])L.push({key:k,cv:getProc('hands',d,k)});
 const cX=cust('crystal');if(cX)L.push({key:'crystal',url:cX.url});
 return L}

/* Which clock angle each moving part follows, in degrees clockwise from 12. */
export function layerAngle(key,clock){
 if(!clock)return 0;
 switch(key){
  case'hour':return clock.ang.hour;
  case'min':return clock.ang.min;
  case'sec':return clock.secAng;
  case'smallsec':return clock.smallsecAng;       /* chronograph register at 3, or a small seconds at 6 */
  case'gmt':return clock.ang.gmt;                 /* a GMT's 24-hour hand */
  case'power':return -120+240*.72;                /* a power reserve, most of the way full */
  case'chMin':return clock.chrono.ang.min30;     /* 30-minute register at 9 */
  case'chHr':return clock.chrono.ang.hr12;       /* 12-hour register at 6 */
  case'bezelIns':return clock.bezel.rot;
  case'balance':return clock.movement?clock.movement.balance:0;
  case'glide':return clock.movement?clock.movement.glide:0;
  /* the date wheel turns back one step a day to bring the day under the window */
  case'dateWheel':return -((clock.date?clock.date.getDate():1)-1)*360/31;
  default:return 0}}
