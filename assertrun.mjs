/* headless boot-assertion run — used by npm run assert and by CI */
function makeGrad(){return{addColorStop(){}}}
function makeCtx(cv){const base={canvas:cv};return new Proxy(base,{get(t,p){if(p in t)return t[p];
 if(/^create(Linear|Radial|Conic)Gradient$/.test(p))return()=>makeGrad();
 if(p==='createPattern')return()=>({});
 if(p==='getImageData'||p==='createImageData')return(x,y,w,h)=>({data:new Uint8ClampedArray(Math.max(4,(w||1)*(h||1)*4)),width:w||1,height:h||1});
 if(p==='measureText')return()=>({width:0});const fn=()=>undefined;t[p]=fn;return fn},set(t,p,v){t[p]=v;return true}})}
function makeCanvas(){const cv={width:0,height:0,parentNode:null,style:{},toDataURL:()=>'x'};cv.getContext=function(){return this.__ctx||(this.__ctx=makeCtx(this))};return cv}
function el(){return{style:{},setAttribute(){},appendChild(){},removeChild(){},remove(){},click(){},addEventListener(){},removeEventListener(){},contains:()=>false,closest:()=>null,querySelector:()=>null,querySelectorAll:()=>[]}}
globalThis.document={createElement:t=>t==='canvas'?makeCanvas():el(),getElementById:()=>el(),body:el(),addEventListener(){},removeEventListener(){}};
globalThis.window={addEventListener(){},removeEventListener(){}};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
globalThis.CanvasRenderingContext2D=class{};globalThis.requestAnimationFrame=()=>0;globalThis.cancelAnimationFrame=()=>{};
globalThis.ResizeObserver=class{observe(){}disconnect(){}};
const A=await import('./src/core/assertions.js');
const fails=A.assertReport();
if(fails.length){console.log('ASSERTIONS FAIL ('+fails.length+')');for(const f of fails)console.log('  - '+f);process.exit(1)}
console.log('ASSERTIONS PASS');
