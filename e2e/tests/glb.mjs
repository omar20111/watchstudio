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
 expect(!p.errors.length,'no page errors '+JSON.stringify(p.errors.slice(0,3)))}
