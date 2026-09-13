/* Silhouette tracing: a `shape` bake -> outlines, for relief.js.

   The hands and indices already exist as drawing code — five hand styles, five
   marker styles, numerals in a serif font. Rather than writing each shape a
   second time as geometry, the renderer bakes its silhouette in white and this
   traces the alpha edge back into outlines (with holes: the Mercedes ring, the
   counters in "VIII"), which relief.js grinds into shaped solid parts.

   Marching squares with linear interpolation, so an anti-aliased edge gives a
   sub-pixel contour rather than a staircase. Every crossed cell edge joins
   exactly two segments, so segments chain into closed loops without needing a
   direction table; saddle cells are resolved from the cell centre. */

const TH=.5;                                          /* alpha iso-level */

/* `data`: the canvas's RGBA pixels if the caller has already read them */
export function traceLoops(cv,data){
 const W=cv.width,H=cv.height;
 data=data||cv.getContext('2d').getImageData(0,0,W,H).data;
 /* the silhouette usually covers a few percent of the sheet: find its box */
 let x0=W,y0=H,x1=-1,y1=-1;
 for(let y=0;y<H;y++){const row=y*W;
  for(let x=0;x<W;x++)if(data[(row+x)*4+3]>8){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}}
 if(x1<0)return[];
 /* one pixel of empty margin all round, so every loop closes */
 const bx=x0-1,by=y0-1,bw=x1-x0+3,bh=y1-y0+3;
 const A=(x,y)=>{const X=x+bx,Y=y+by;return X<0||Y<0||X>=W||Y>=H?0:data[(Y*W+X)*4+3]/255};

 const pts=new Map(),adj=new Map();
 const edge=(ax,ay,horizontal)=>(ay*(bw+1)+ax)*2+(horizontal?0:1);
 const at=(id,ax,ay,bx2,by2)=>{if(pts.has(id))return;
  const va=A(ax,ay),vb=A(bx2,by2),t=(TH-va)/((vb-va)||1e-9);
  pts.set(id,[ax+(bx2-ax)*t+bx,ay+(by2-ay)*t+by])};
 const link=(a,b)=>{(adj.get(a)||adj.set(a,[]).get(a)).push(b);(adj.get(b)||adj.set(b,[]).get(b)).push(a)};

 for(let y=0;y<bh-1;y++)for(let x=0;x<bw-1;x++){
  const tl=A(x,y)>TH,tr=A(x+1,y)>TH,br=A(x+1,y+1)>TH,bl=A(x,y+1)>TH;
  const k=(tl?8:0)|(tr?4:0)|(br?2:0)|(bl?1:0);if(k===0||k===15)continue;
  const top=edge(x,y,true),bot=edge(x,y+1,true),lef=edge(x,y,false),rig=edge(x+1,y,false);
  if(tl!==tr)at(top,x,y,x+1,y);if(bl!==br)at(bot,x,y+1,x+1,y+1);
  if(tl!==bl)at(lef,x,y,x,y+1);if(tr!==br)at(rig,x+1,y,x+1,y+1);
  if(k===5||k===10){const mid=(A(x,y)+A(x+1,y)+A(x+1,y+1)+A(x,y+1))/4>TH;
   /* joined through the centre: cut off the two corners that are the odd ones out */
   if((k===5)===mid){link(top,lef);link(rig,bot)}else{link(top,rig);link(lef,bot)}}
  else{const e=[];if(tl!==tr)e.push(top);if(tr!==br)e.push(rig);if(bl!==br)e.push(bot);if(tl!==bl)e.push(lef);
   link(e[0],e[1])}}

 const loops=[],seen=new Set();
 for(const start of adj.keys()){if(seen.has(start))continue;
  const loop=[];let prev=-1,cur=start;
  while(cur!==undefined&&!seen.has(cur)){seen.add(cur);loop.push(pts.get(cur));
   const n=adj.get(cur);const next=n[0]!==prev?n[0]:n[1];prev=cur;cur=next}
  if(loop.length>=3)loops.push(loop)}
 return loops}

/* Ramer-Douglas-Peucker on a closed loop */
export function simplifyLoop(l,eps){if(l.length<8)return l;
 const keep=new Uint8Array(l.length);keep[0]=keep[l.length-1]=1;
 const stack=[[0,l.length-1]];
 while(stack.length){const[a,b]=stack.pop();let dm=0,im=-1;
  const[ax,ay]=l[a],[bx,by]=l[b],dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy)||1;
  for(let i=a+1;i<b;i++){const d=Math.abs(dy*l[i][0]-dx*l[i][1]+bx*ay-by*ax)/len;if(d>dm){dm=d;im=i}}
  if(dm>eps){keep[im]=1;stack.push([a,im],[im,b])}}
 return l.filter((_,i)=>keep[i])}

