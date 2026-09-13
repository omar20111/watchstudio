/* First visit: the gallery, starting from a design, the three quick steps; a
   returning visitor skips it and can reopen it from the menu. */
export async function run({page,until,press,present,expect,url}){
 const p=await page({},{firstVisit:true});
 await p.goto(url);
 const galleryOpen=()=>p.evaluate(()=>!!document.querySelector('[aria-labelledby="welcome-title"]'));
 expect(await until(p,()=>!!document.querySelector('[aria-labelledby="welcome-title"]')),'a first visit opens the gallery');
 const cards=await p.evaluate(()=>document.querySelectorAll('ul[aria-label="Designs to start from"] button').length);
 expect(cards>=15,`${cards} designs to start from`);
 await press(p,'Start from Arabian Heritage');
 expect(await until(p,()=>!!document.querySelector('[aria-label="Quick start"]'),null,30000),'choosing a design opens the quick start');
 await press(p,'Next: Dial');
 await press(p,'Tapisserie',{within:'[aria-label="Dial style"]'});
 await press(p,'Next: Strap');
 await press(p,'Milanese',{within:'[aria-label="Strap"]'});
 await press(p,'Done — open the full editor');
 const saved=await until(p,()=>{try{const d=JSON.parse(localStorage.getItem('ws:auto')).d;
  return d.parts.markers.variant==='eastern'&&d.parts.dial.variant==='tapisserie'&&d.parts.strap.variant==='mesh'}catch(e){return false}});
 expect(saved,'the chosen design, as edited in the steps, is saved');
 expect(await until(p,()=>!document.querySelector('[aria-label="Quick start"]'),null,30000),'Done closes the quick start');
 await p.reload();
 await present(p,'More actions',90000);
 expect(!(await galleryOpen()),'a returning visitor goes straight to the editor');
 await press(p,'More actions');
 await until(p,()=>!!document.querySelector('[role=menu]'),null,30000);
 await press(p,'Open the gallery of designs to start from',{role:'menuitem'});
 expect(await until(p,()=>!!document.querySelector('[aria-labelledby="welcome-title"]'),null,30000),'the ⋯ menu reopens the gallery');
 expect(!p.errors.length,'no page errors '+JSON.stringify(p.errors.slice(0,3)))}
