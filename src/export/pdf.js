/* Minimal PDF writer — no dependency.

   Enough for a technical document: pages in millimetres with the origin at the
   top left, lines, rectangles, circles and filled outlines (even-odd, so a
   traced "8" keeps its counters), text in the standard Helvetica faces, and
   greyscale or RGB images. Content streams and images are deflated with the
   browser's CompressionStream when it has one.

   Text is set in the PDF's built-in Helvetica with WinAnsi encoding, so no font
   is embedded and every viewer has it. Its character widths are here so text
   can be centred and right-aligned. A string with characters outside WinAnsi
   (Arabic, CJK) cannot be set that way: it is drawn to a canvas with the
   browser's own fonts and placed as an image instead, so what the user typed
   still appears.

   The cross-reference table is where hand-written PDFs usually break: every
   offset is measured on the bytes as written, and pdfOffsets() lets a test
   check each one lands on its object. */

const PT=72/25.4;                                   /* points per millimetre */
const enc=new TextEncoder();

/* Helvetica and Helvetica-Bold advance widths (1/1000 em), ASCII 32..126 */
const W_REG=[278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,
 1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,
 333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const W_BOLD=[278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,
 975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,
 333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
/* WinAnsi's 0x80-0x9F block, by Unicode code point */
const CP1252={0x20AC:0x80,0x201A:0x82,0x0192:0x83,0x201E:0x84,0x2026:0x85,0x2020:0x86,0x2021:0x87,0x02C6:0x88,0x2030:0x89,0x0160:0x8A,
 0x2039:0x8B,0x0152:0x8C,0x017D:0x8E,0x2018:0x91,0x2019:0x92,0x201C:0x93,0x201D:0x94,0x2022:0x95,0x2013:0x96,0x2014:0x97,0x02DC:0x98,
 0x2122:0x99,0x0161:0x9A,0x203A:0x9B,0x0153:0x9C,0x017E:0x9E,0x0178:0x9F};
const EXTRA={0x91:222,0x92:222,0x93:333,0x94:333,0x95:350,0x96:556,0x97:1000,0xB0:400,0xB1:584,0xB7:278,0xD7:584,0xD8:778,0xF8:611,0x85:1000};

/* the WinAnsi byte for a character, or -1 */
function ansi(ch){const c=ch.codePointAt(0);
 if(c<128)return c>=32||c===9?c:-1;
 if(c>=0xA0&&c<=0xFF)return c;
 return CP1252[c]??-1}
export const encodable=s=>[...String(s)].every(ch=>ansi(ch)>=0);

/* text width in mm at `size` pt */
export function textWidth(s,size,bold=false){const T=bold?W_BOLD:W_REG;let w=0;
 for(const ch of String(s)){const b=ansi(ch);
  w+=b>=32&&b<127?T[b-32]:EXTRA[b]??(b>=0xC0?(bold?611:556):556)}
 return w/1000*size/PT}

/* a PDF literal string of WinAnsi bytes */
function lit(s){let o='(';
 for(const ch of String(s)){const b=ansi(ch);
  if(b<0)o+='?';
  else if(b===40||b===41||b===92)o+='\\'+String.fromCharCode(b);
  else if(b<32||b>126)o+='\\'+b.toString(8).padStart(3,'0');
  else o+=String.fromCharCode(b)}
 return o+')'}

const num=v=>{const r=Math.round(v*1000)/1000;return Object.is(r,-0)?'0':String(r)};
const rgb=c=>{if(Array.isArray(c))return c;
 const h=String(c||'#000').replace('#','');const f=h.length===3?h.split('').map(x=>x+x).join(''):h.padEnd(6,'0');
 return[0,2,4].map(i=>parseInt(f.slice(i,i+2),16)/255)};

async function deflate(bytes){
 if(typeof CompressionStream==='undefined')return null;
 const cs=new CompressionStream('deflate');const w=cs.writable.getWriter();w.write(bytes);w.close();
 return new Uint8Array(await new Response(cs.readable).arrayBuffer())}

/* A document. Pages are drawn synchronously; blob() compresses and writes. */
export function createPDF({title='',author='WatchStudio'}={}){
 const pages=[],images=[];
 const doc={
  /* a page w x h mm */
  page(w=297,h=210){const ops=[],used=new Set();let fontUsed=false;
   const Y=y=>num((h-y)*PT),X=x=>num(x*PT);
   const style=({stroke,fill,width,dash,cap})=>{
    if(stroke!=null)ops.push(rgb(stroke).map(num).join(' ')+' RG');
    if(fill!=null&&fill!=='none')ops.push(rgb(fill).map(num).join(' ')+' rg');
    ops.push(num((width??.25)*PT)+' w');
    ops.push(dash?'['+dash.map(v=>num(v*PT)).join(' ')+'] 0 d':'[] 0 d');
    ops.push((cap==='round'?1:cap==='square'?2:0)+' J')};
   const paint=o=>{const f=o.fill!=null&&o.fill!=='none',s=o.stroke!=null;
    return f&&s?(o.evenodd?'B*':'B'):f?(o.evenodd?'f*':'f'):s?'S':'n'};
   const pg={w,h,
    line(x0,y0,x1,y1,o={}){ops.push('q');style({stroke:'#000',...o});ops.push(`${X(x0)} ${Y(y0)} m ${X(x1)} ${Y(y1)} l S`,'Q');return pg},
    polyline(pts,o={}){if(pts.length<2)return pg;ops.push('q');style({stroke:'#000',...o});
     ops.push(pts.map(([x,y],i)=>`${X(x)} ${Y(y)} ${i?'l':'m'}`).join(' ')+(o.close?' h':'')+' '+paint({stroke:'#000',...o}),'Q');return pg},
    rect(x,y,rw,rh,o={}){ops.push('q');style(o);ops.push(`${X(x)} ${Y(y+rh)} ${num(rw*PT)} ${num(rh*PT)} re ${paint(o)}`,'Q');return pg},
    /* a circle from four cubic arcs */
    circle(cx,cy,r,o={}){const k=.5523*r;ops.push('q');style(o);
     ops.push(`${X(cx+r)} ${Y(cy)} m`,
      `${X(cx+r)} ${Y(cy+k)} ${X(cx+k)} ${Y(cy+r)} ${X(cx)} ${Y(cy+r)} c`,
      `${X(cx-k)} ${Y(cy+r)} ${X(cx-r)} ${Y(cy+k)} ${X(cx-r)} ${Y(cy)} c`,
      `${X(cx-r)} ${Y(cy-k)} ${X(cx-k)} ${Y(cy-r)} ${X(cx)} ${Y(cy-r)} c`,
      `${X(cx+k)} ${Y(cy-r)} ${X(cx+r)} ${Y(cy-k)} ${X(cx+r)} ${Y(cy)} c h ${paint(o)}`,'Q');return pg},
    /* closed outlines (arrays of [x,y] mm), filled even-odd and/or stroked */
    shape(loops,o={}){if(!loops.length)return pg;ops.push('q');style(o);
     const parts=[];for(const l of loops){if(l.length<3)continue;
      parts.push(l.map(([x,y],i)=>`${X(x)} ${Y(y)} ${i?'l':'m'}`).join(' ')+' h')}
     ops.push(parts.join('\n')+' '+paint({evenodd:true,...o}),'Q');return pg},
    /* text: size in pt, the baseline at y; align left, center or right */
    text(x,y,s,{size=9,bold=false,color='#000',align='left',angle=0}={}){s=String(s??'');if(!s)return pg;
     if(!encodable(s))return pg.textImage(x,y,s,{size,bold,color,align,angle});
     fontUsed=true;const tw=textWidth(s,size,bold),dx=align==='center'?-tw/2:align==='right'?-tw:0;
     const a=-angle*Math.PI/180,c=Math.cos(a),si=Math.sin(a);
     /* the offset along the text's own direction */
     const ox=x+dx*Math.cos(angle*Math.PI/180),oy=y+dx*Math.sin(angle*Math.PI/180);
     ops.push('BT',rgb(color).map(num).join(' ')+' rg',`/${bold?'F2':'F1'} ${num(size)} Tf`,
      `${num(c)} ${num(si)} ${num(-si)} ${num(c)} ${X(ox)} ${Y(oy)} Tm`,lit(s)+' Tj','ET');return pg},
    /* text a standard font cannot set: drawn by the browser, placed as an image */
    textImage(x,y,s,{size=9,bold=false,color='#000',align='left'}={}){
     const scale=10,px=size*scale,cv=document.createElement('canvas'),c=cv.getContext('2d');
     const font=`${bold?'700 ':''}${px}px system-ui, sans-serif`;c.font=font;
     const tw=Math.ceil(c.measureText(s).width)+4,th=Math.ceil(px*1.4);
     cv.width=tw;cv.height=th;c.font=font;c.fillStyle='#fff';c.fillRect(0,0,tw,th);
     c.fillStyle='#000';c.textBaseline='alphabetic';c.fillText(s,2,Math.round(px*1.1));
     const mm=v=>v/scale/PT,wmm=mm(tw),hmm=mm(th),dx=align==='center'?-wmm/2:align==='right'?-wmm:0;
     return pg.image(doc.imageFromCanvas(cv,{mask:true,color}),x+dx,y-mm(px*1.1),wmm,hmm)},
    image(img,x,y,iw,ih){used.add(img.id);ops.push('q',`${num(iw*PT)} 0 0 ${num(ih*PT)} ${X(x)} ${Y(y+ih)} cm`,`/Im${img.id} Do`,'Q');return pg},
    get fontUsed(){return fontUsed},ops,used};
   pages.push(pg);return pg},

  /* an image from raw pixels: channels 1 (grey) or 3 (RGB), rows top first */
  image(width,height,pixels,channels=3){const img={id:images.length+1,width,height,pixels,channels};images.push(img);return img},
  /* a canvas as an RGB image, or with mask:true as a stencil in one colour
     (text drawn dark on white: its darkness becomes the ink's coverage) */
  imageFromCanvas(cv,{mask=false,color='#000'}={}){
   const{width,height}=cv,px=cv.getContext('2d').getImageData(0,0,width,height).data,n=width*height;
   if(mask){const[r,g,b]=rgb(color).map(v=>v*255),out=new Uint8Array(n*3);
    for(let i=0;i<n;i++){const a=1-px[i*4]/255;out[i*3]=255+(r-255)*a;out[i*3+1]=255+(g-255)*a;out[i*3+2]=255+(b-255)*a}
    return doc.image(width,height,out,3)}
   const out=new Uint8Array(n*3);for(let i=0;i<n;i++){out[i*3]=px[i*4];out[i*3+1]=px[i*4+1];out[i*3+2]=px[i*4+2]}
   return doc.image(width,height,out,3)},

  async bytes(){
   const chunks=[],offsets=[];let size=0;
   const push=b=>{const u=typeof b==='string'?enc.encode(b):b;chunks.push(u);size+=u.length};
   const objs=[];                                   /* index = object number - 1 */
   const reserve=()=>{objs.push(null);return objs.length};
   const catalog=reserve(),pagesObj=reserve(),f1=reserve(),f2=reserve(),info=reserve();
   const imgObj=new Map();for(const im of images)imgObj.set(im.id,reserve());
   const pageObjs=pages.map(()=>[reserve(),reserve()]);
   const stream=async(dict,data)=>{const z=await deflate(data);
    const body=z||data;return{dict:`<< ${dict}${z?' /Filter /FlateDecode':''} /Length ${body.length} >>`,body}};
   objs[catalog-1]=`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
   objs[pagesObj-1]=`<< /Type /Pages /Kids [${pageObjs.map(p=>p[0]+' 0 R').join(' ')}] /Count ${pages.length} >>`;
   objs[f1-1]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
   objs[f2-1]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
   const str=s=>'('+String(s).replace(/[\\()]/g,m=>'\\'+m).replace(/[^\x20-\x7e]/g,'?')+')';
   objs[info-1]=`<< /Title ${str(title)} /Author ${str(author)} /Producer (WatchStudio) >>`;
   for(const im of images)objs[imgObj.get(im.id)-1]=await stream(
    `/Type /XObject /Subtype /Image /Width ${im.width} /Height ${im.height} /ColorSpace /${im.channels===1?'DeviceGray':'DeviceRGB'} /BitsPerComponent 8`,im.pixels);
   for(let i=0;i<pages.length;i++){const pg=pages[i],[po,co]=pageObjs[i];
    const xo=[...pg.used].map(id=>`/Im${id} ${imgObj.get(id)} 0 R`).join(' ');
    objs[po-1]=`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${num(pg.w*PT)} ${num(pg.h*PT)}] /Contents ${co} 0 R `+
     `/Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >>${xo?` /XObject << ${xo} >>`:''} >> >>`;
    objs[co-1]=await stream('',enc.encode(pg.ops.join('\n')))}
   /* a comment of four high bytes marks the file as binary */
   push('%PDF-1.4\n');push(new Uint8Array([37,0xE2,0xE3,0xCF,0xD3,10]));
   for(let i=0;i<objs.length;i++){offsets.push(size);const o=objs[i];
    push(`${i+1} 0 obj\n`);
    if(typeof o==='string')push(o+'\n');else{push(o.dict+'\nstream\n');push(o.body);push('\nendstream\n')}
    push('endobj\n')}
   const xref=size;
   push(`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`+offsets.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join(''));
   push(`trailer\n<< /Size ${objs.length+1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
   const out=new Uint8Array(size);let at=0;for(const c of chunks){out.set(c,at);at+=c.length}
   return out},
  async blob(){return new Blob([await doc.bytes()],{type:'application/pdf'})},
  get pageCount(){return pages.length}};
 return doc}

/* For tests: the offsets in a PDF's xref table, and whether each one lands on
   the "n 0 obj" it names. */
export function pdfOffsets(bytes){const s=new TextDecoder('latin1').decode(bytes);
 const start=+s.slice(s.lastIndexOf('startxref')+9).trim().split(/\s/)[0];
 const lines=s.slice(start).split('\n');const[,count]=lines[1].split(' ').map(Number);
 const out=[];for(let i=1;i<count;i++){const off=+lines[2+i].slice(0,10);
  out.push({n:i,off,ok:s.startsWith(`${i} 0 obj`,off)})}
 return{startOk:s.startsWith('xref',start),entries:out}}
