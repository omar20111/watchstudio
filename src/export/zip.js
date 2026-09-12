/* Minimal ZIP writer — STORE method only, no dependency.

   STORE (no compression) is deliberate: it keeps the writer small enough to be
   obviously correct, and the payload is PNG, which is already deflated. A
   second compression pass would cost CPU and save almost nothing.

   The two places this kind of writer usually goes wrong are the CRC table and
   the central-directory offsets, so both are asserted: crc32('123456789') has
   the published value 0xCBF43926, and the assertions check a built archive's
   end-of-central-directory record points where the writer says it does. */

const TABLE=(()=>{const t=new Uint32Array(256);
 for(let n=0;n<256;n++){let c=n;
  for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;
  t[n]=c>>>0}
 return t})();

export function crc32(bytes){let c=0xFFFFFFFF;
 for(let i=0;i<bytes.length;i++)c=TABLE[(c^bytes[i])&0xFF]^(c>>>8);
 return (c^0xFFFFFFFF)>>>0}

const enc=s=>new TextEncoder().encode(s);

/* DOS date/time. Passed in rather than read from the clock so an archive built
   from the same design twice is byte-identical. */
function dosStamp(date){
 const d=date||new Date(2020,0,1,0,0,0);
 const time=((d.getHours()&31)<<11)|((d.getMinutes()&63)<<5)|((d.getSeconds()/2)&31);
 const day=(((d.getFullYear()-1980)&127)<<9)|(((d.getMonth()+1)&15)<<5)|(d.getDate()&31);
 return{time,day}}

/* files: [{name, data:Uint8Array}] -> Blob */
export function zip(files,opts={}){
 const {time,day}=dosStamp(opts.date);
 const chunks=[],central=[];
 let offset=0;

 for(const f of files){
  const name=enc(f.name),data=f.data instanceof Uint8Array?f.data:enc(String(f.data));
  const crc=crc32(data);

  const local=new Uint8Array(30+name.length);
  const lv=new DataView(local.buffer);
  lv.setUint32(0,0x04034b50,true);   /* local file header signature */
  lv.setUint16(4,20,true);           /* version needed */
  lv.setUint16(6,0,true);            /* flags */
  lv.setUint16(8,0,true);            /* method 0 = STORE */
  lv.setUint16(10,time,true);lv.setUint16(12,day,true);
  lv.setUint32(14,crc,true);
  lv.setUint32(18,data.length,true); /* compressed size */
  lv.setUint32(22,data.length,true); /* uncompressed size */
  lv.setUint16(26,name.length,true);
  lv.setUint16(28,0,true);           /* extra length */
  local.set(name,30);
  chunks.push(local,data);

  const cen=new Uint8Array(46+name.length);
  const cv=new DataView(cen.buffer);
  cv.setUint32(0,0x02014b50,true);   /* central directory signature */
  cv.setUint16(4,20,true);cv.setUint16(6,20,true);
  cv.setUint16(8,0,true);cv.setUint16(10,0,true);
  cv.setUint16(12,time,true);cv.setUint16(14,day,true);
  cv.setUint32(16,crc,true);
  cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);
  cv.setUint16(28,name.length,true);
  cv.setUint16(30,0,true);cv.setUint16(32,0,true);
  cv.setUint16(34,0,true);cv.setUint16(36,0,true);
  cv.setUint32(38,0,true);
  cv.setUint32(42,offset,true);      /* where this file's local header starts */
  cen.set(name,46);
  central.push(cen);

  offset+=local.length+data.length}

 const centralSize=central.reduce((n,c)=>n+c.length,0);
 const end=new Uint8Array(22);
 const ev=new DataView(end.buffer);
 ev.setUint32(0,0x06054b50,true);    /* end of central directory */
 ev.setUint16(8,files.length,true);
 ev.setUint16(10,files.length,true);
 ev.setUint32(12,centralSize,true);
 ev.setUint32(16,offset,true);       /* central directory starts after the data */
 return new Blob([...chunks,...central,end],{type:'application/zip'})}
