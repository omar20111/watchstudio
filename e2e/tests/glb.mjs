/* The 3D model export: the toolbar button downloads a GLB that the Khronos
   glTF Validator passes with no errors or warnings, at real size. */
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

export async function run({page,ready,press,expect,url}){
 const validator=require('gltf-validator');
 const p=await page();
 await p.goto(url);await ready(p);
 await press(p,'Heritage Diver');
 const[dl]=await Promise.all([p.waitForEvent('download',{timeout:240000}),
  press(p,'Export a 3D model (GLB) for Blender, AR and other 3D apps')]);
 expect(/\.glb$/.test(dl.suggestedFilename()),`downloads ${dl.suggestedFilename()}`);
 const chunks=[];for await(const ch of await dl.createReadStream())chunks.push(ch);
 const bytes=new Uint8Array(Buffer.concat(chunks));
 const report=await validator.validateBytes(bytes,{maxIssues:50});
 const{numErrors,numWarnings}=report.issues;
 expect(numErrors===0,`the Khronos validator finds no errors (${numErrors}${numErrors?': '+report.issues.messages.filter(m=>m.severity===0).slice(0,4).map(m=>m.code+' '+m.pointer).join('; '):''})`);
 expect(numWarnings===0,`and no warnings (${numWarnings})`);
 /* the JSON chunk: the root carries the millimetre-to-metre scale */
 const len=new DataView(bytes.buffer).getUint32(12,true),json=JSON.parse(Buffer.from(bytes.slice(20,20+len)).toString());
 const root=json.nodes[json.scenes[0].nodes[0]];
 expect(root.scale&&Math.abs(root.scale[0]-.001)<1e-12,'modelled in millimetres, exported in metres');
 /* The print model: a 3MF (a zip, stored) whose main parts are closed solids —
    every edge shared by exactly two faces */
 const[pd]=await Promise.all([p.waitForEvent('download',{timeout:240000}),press(p,'Export a 3D print model (3MF) for a slicer')]);
 expect(/\.3mf$/.test(pd.suggestedFilename()),`downloads ${pd.suggestedFilename()}`);
 const pc=[];for await(const ch of await pd.createReadStream())pc.push(ch);
 const zipBytes=Buffer.concat(pc);let model=null;
 for(let o=0;o+30<zipBytes.length;){if(zipBytes.readUInt32LE(o)!==0x04034b50)break;
  const size=zipBytes.readUInt32LE(o+18),nl=zipBytes.readUInt16LE(o+26),xl=zipBytes.readUInt16LE(o+28),name=zipBytes.slice(o+30,o+30+nl).toString();
  const data=zipBytes.slice(o+30+nl+xl,o+30+nl+xl+size);if(name==='3D/3dmodel.model')model=data.toString();o+=30+nl+xl+size}
 expect(!!model&&/unit="millimeter"/.test(model),'the 3MF holds a model in millimetres');
 const solids={};
 for(const m of (model||'').matchAll(/<object id="\d+" type="model" name="([^"]+)"[^>]*>([\s\S]*?)<\/object>/g)){
  const use=new Map();for(const t of m[2].matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"/g)){const v=[+t[1],+t[2],+t[3]];
   for(let k=0;k<3;k++){const a=v[k],b=v[(k+1)%3],key=a<b?a+','+b:b+','+a;use.set(key,(use.get(key)||0)+1)}}
  let bad=0;for(const n of use.values())if(n!==2)bad++;solids[m[1]]=bad}
 for(const part of['head','crown','hands','crystal'])
  expect(solids[part]===0,`the ${part} is a closed solid (${solids[part]} edges not shared by exactly two faces)`);
 expect(!p.errors.length,'no page errors '+JSON.stringify(p.errors.slice(0,3)))}
