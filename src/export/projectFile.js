/* Project file (.json) export/import — portable between machines.

   Images live in IndexedDB, so a project file has to carry them inline or a
   file mailed to a colleague arrives with every upload missing. On export the
   blobs are read out of the vault and encoded; on import they are decoded and
   put back, so the round trip is lossless across machines. */
import {toast} from '../core/utils.js';
import {store,SCHEMA_VERSION,migrateProject} from '../state/store.js';
import * as IMG from '../core/images.js';

export async function exportProjectFile(){
 const s=store.getState();
 const customs={};
 let embedded=0;
 for(const part in s.customs){customs[part]={};
  for(const id in s.customs[part]){
   const meta=s.customs[part][id];
   const blob=await IMG.get(id);
   const data=blob?await IMG.toDataURL(blob):null;
   if(data)embedded++;
   customs[part][id]={name:meta.name,data}}}
 const body={app:'WatchStudio',schemaVersion:SCHEMA_VERSION,name:s.projName,d:s.d,customs};
 const b=new Blob([JSON.stringify(body)],{type:'application/json'});
 const a=document.createElement('a');a.href=URL.createObjectURL(b);
 a.download=s.projName.replace(/\s+/g,'_')+'.watchstudio.json';a.click();
 setTimeout(()=>URL.revokeObjectURL(a.href),4000);
 toast(embedded?`Project exported with ${embedded} image${embedded>1?'s':''}`:'Project exported');}

export function importProjectFile(f,cb){const rd=new FileReader();
 rd.onload=async()=>{
  try{
   const o=migrateProject(JSON.parse(rd.result));
   if(!o||!o.d||!o.d.parts)throw new Error('bad');
   /* put the embedded blobs back in the vault before the state references them */
   const customs={};let restored=0,failed=0;
   for(const part in(o.customs||{})){customs[part]={};
    for(const id in o.customs[part]){
     const c=o.customs[part][id];
     customs[part][id]={name:c.name};
     if(c.data){const ok=await IMG.save(id,c.data);
      if(ok){customs[part][id].url=IMG.urlFor(id);restored++}else failed++}
     else if(c.url){customs[part][id].url=c.url}}}
   store.get().importState({...o,customs});
   toast(failed?`Project imported — ${failed} image${failed>1?'s':''} could not be stored`
    :restored?`Project imported with ${restored} image${restored>1?'s':''}`:'Project imported');
   cb&&cb()}
  catch(e){toast('Not a valid WatchStudio project file')}};
 rd.readAsText(f)}
