/* The tech pack: from the ⋯ menu a ZIP downloads holding a seven-sheet PDF
   whose cross-reference table is sound, whose drawings and figures are the
   design's own (checked against the spec.json packed with it), and 1:1 SVG
   artwork whose outlines sit where the dial puts them. */
import zlib from 'node:zlib';
import {pdfOffsets} from '../../src/export/pdf.js';

/* the files in a STORE zip */
function unzip(bytes){const out={},dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let i=0;
 while(i+30<=bytes.length&&dv.getUint32(i,true)===0x04034b50){
  const size=dv.getUint32(i+18,true),nl=dv.getUint16(i+26,true),xl=dv.getUint16(i+28,true);
  const name=Buffer.from(bytes.slice(i+30,i+30+nl)).toString();out[name]=bytes.slice(i+30+nl+xl,i+30+nl+xl+size);
  i+=30+nl+xl+size}
 return out}

/* every string a PDF's content streams show, WinAnsi decoded */
const WINANSI={0x91:'‘',0x92:'’',0x93:'“',0x94:'”',0x95:'•',0x96:'–',0x97:'—',0x85:'…'};
function pdfText(bytes){const s=Buffer.from(bytes).toString('latin1'),texts=[];
 const re=/<<([^>]*?)\/Length (\d+) >>\nstream\n/g;let m;
 while((m=re.exec(s))){const start=m.index+m[0].length,len=+m[2];
  if(/\/Subtype \/Image/.test(m[1]))continue;
  let body=Buffer.from(bytes.slice(start,start+len));
  if(/FlateDecode/.test(m[1]))try{body=zlib.inflateSync(body)}catch(e){continue}
  const t=body.toString('latin1');if(!/ Tj/.test(t))continue;
  for(const x of t.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g))
   texts.push(x[1].replace(/\\([0-7]{3})/g,(_,o)=>{const c=parseInt(o,8);return WINANSI[c]||String.fromCharCode(c)}).replace(/\\(.)/g,'$1'))}
 return texts}

const f1=v=>(Math.round(v*10)/10).toFixed(1);

export async function run({page,ready,until,press,present,expect,url}){
 const p=await page();
 await p.goto(url);await ready(p);
 await press(p,'Heritage Diver');
 await until(p,()=>!!(window.__watchView&&window.__watchView.watch&&window.__watchView.watch.getObjectByName('bezelIns')),null,120000);

 await press(p,'More actions');
 await present(p,'Export a tech pack for manufacturers: drawings, parts list and artwork');
 const[dl]=await Promise.all([p.waitForEvent('download',{timeout:420000}),
  press(p,'Export a tech pack for manufacturers: drawings, parts list and artwork',{role:'menuitem'})]);
 expect(/_techpack\.zip$/.test(dl.suggestedFilename()),`downloads ${dl.suggestedFilename()}`);
 const chunks=[];for await(const ch of await dl.createReadStream())chunks.push(ch);
 const files=unzip(new Uint8Array(Buffer.concat(chunks)));
 const names=Object.keys(files);
 const pdfName=names.find(n=>/_techpack\.pdf$/.test(n));
 expect(pdfName&&files['artwork/dial.svg']&&files['artwork/hands.svg']&&files['artwork/bezel.svg']&&files['spec.json'],
  `with the PDF, the dial, hands and bezel artwork and the spec (${names.join(', ')})`);
 if(!pdfName)return;

 /* the PDF: sound, seven sheets, drawings in it */
 const pdf=files[pdfName],raw=Buffer.from(pdf).toString('latin1');
 const xr=pdfOffsets(pdf);
 expect(raw.startsWith('%PDF-1.4')&&xr.startOk&&xr.entries.every(e=>e.ok),`a well-formed PDF (${xr.entries.length} objects, every offset on its object)`);
 const pages=(raw.match(/\/Type \/Page /g)||[]).length,images=(raw.match(/\/Subtype \/Image/g)||[]).length;
 expect(pages===7,`seven sheets (${pages})`);
 expect(images>=4,`the rendering and the front, side and back drawings are in it (${images} images)`);

 /* its figures are the design's */
 const spec=JSON.parse(Buffer.from(files['spec.json']).toString()),D=spec.dimensionsMm;
 const text=pdfText(pdf),has=s=>text.some(t=>t.includes(s));
 for(const[label,want]of[['case diameter','Ø'+f1(D.caseDiameter)],['lug to lug',f1(D.lugToLug)],['lug width',f1(D.lugWidth)],['thickness',f1(D.caseThickness)]])
  expect(has(want),`the ${label} is dimensioned (${want})`);
 for(const sheet of['Case — front and side','Parts list','Dial artwork','Bezel and hands','Notes for the manufacturer'])
  expect(has(sheet),`it has the sheet "${sheet}"`);

 /* the artwork, at 1:1 in mm */
 const svg=Buffer.from(files['artwork/dial.svg']).toString();
 const vb=(svg.match(/viewBox="([^"]+)"/)||[])[1],w=vb?+vb.split(' ')[2]:0;
 expect(/width="[\d.]+mm"/.test(svg)&&Math.abs(w-(D.dialDiameter+2))<.01,`the dial artwork is 1:1 in mm (${w} mm wide for a ${D.dialDiameter} mm dial)`);
 for(const id of['print-text','print-track','applied-indices','cut'])expect(svg.includes(`id="${id}"`),`the dial artwork has its ${id} layer`);
 /* the indices' outer ends on the hour ring: 0.885 of the dial radius */
 const idx=(svg.match(/id="applied-indices"[^>]*><path[^>]* d="([^"]+)"/)||[])[1]||'';
 let far=0;for(const m of idx.matchAll(/(-?[\d.]+) (-?[\d.]+)/g))far=Math.max(far,Math.hypot(+m[1],+m[2]));
 expect(Math.abs(far-D.dialDiameter/2*.885)<.12,`the indices' outlines reach the hour ring (${far.toFixed(2)} mm, ring ${(D.dialDiameter/2*.885).toFixed(2)} mm)`);
 const hands=Buffer.from(files['artwork/hands.svg']).toString();
 expect(['hand-hour','hand-min','hand-sec'].every(h=>hands.includes(`id="${h}"`)),'all three hands are in the hands artwork');
 expect(Buffer.from(files['artwork/bezel.svg']).toString().includes('id="engraving"'),'the diver insert\'s engraving is in the bezel artwork');
 expect(!p.errors.length,'no page errors '+JSON.stringify(p.errors.slice(0,3)))}
