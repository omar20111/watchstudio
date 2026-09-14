/* Spec-sheet (txt) export. */
import {PX,METALS} from '../core/constants.js';
import {strapMmOf,caseOf,thicknessStack,lugToLugOf,crownMmOf,bezelMmOf,dialLayoutOf,handLengthsOf,geoOf} from '../core/geometry.js';
import {store} from '../state/store.js';

/* a hand-edited project or a future migration can carry a metal id this build
   does not know; name it rather than throw and silently export nothing */
const metal=id=>(METALS[id]||{name:id||'unknown'}).name;

export function exportSpec(){const s=store.getState(),d=s.d,P=d.parts;
 const c=caseOf(d),st=thicknessStack(d);
 const insert=P.bezel.variant==='diver'||P.bezel.variant==='gmt';
 const L=['WatchStudio — Spec Sheet',`Project: ${s.projName}`,`Date: ${new Date().toLocaleString()}`,`Canvas: 1200×1200 px, dial center (600,600) · Scale 1 mm = ${PX} px`,'',
 `Case: ${d.caseMm} mm · ${metal(P.case.metal)} · ${P.case.finish} · ${P.case.variant}`,
 `Case architecture: ${c.thickness} mm thick (caseback ${st.caseback} · band ${st.band} · movement ${st.movement} · dial ${st.dial} · bezel ${st.bezel} · crystal ${st.crystal})${c.feasible?'':` — raised from ${c.requested} mm`}`,
 `Lugs: ${c.lugLen} mm long · ${c.lugDrop} mm drop · lug-to-lug ${lugToLugOf(d)} mm · lug width ${strapMmOf(d)} mm`,
 `Movement: ${c.movement} · caseback ${c.caseback}${c.caseback==='engraved'?` "${c.engraving}"`:''} · water resistance ${c.wrM} m`,
 `Crown: ${P.crown.variant} · ${crownMmOf(d)} mm · ${metal(P.crown.metal)} · at ${c.crownPos==='430'?'4:30':'3 o’clock'}${c.pushers?' · chronograph pushers at 2 and 4':''}`,
 `Strap: ${P.strap.variant} · ${strapMmOf(d)} mm · color ${P.strap.color} · stitch ${P.strap.stitch} · ${metal(P.strap.metal)}`,
 `Bezel: ${P.bezel.variant} · ${bezelMmOf(d)} mm · ${metal(P.bezel.metal)} · ${P.bezel.finish}${insert?' · insert '+P.bezel.insertColor:''}`,
 `Dial: ${P.dial.variant} · ${P.dial.color} · date ${(at=>at==='none'?'none':at==='430'?'4:30':at+' o’clock')(dialLayoutOf(d).date)} · ${P.dial.step==='stepped'?'stepped chapter ring':'flat'} · text "${P.dial.text.top}" / "${P.dial.text.bottom}" (${P.dial.text.font}, ink ${P.dial.text.color})`,
 `Markers: ${P.markers.variant} · lume ${P.markers.lume}${P.markers.glow?' (glow on)':''}`,
 `Hands: ${P.hands.variant} · ${metal(P.hands.metal)} · second ${P.hands.secColor} · lume ${P.hands.lume}`,'',
 `Crystal: ${c.crystal} sapphire · ${c.crystalMm} mm · gloss ${Math.round(P.crystal.opacity*100)}%`,'',
 `Hand lengths from the pivot: ${(({hour,min,sec},r)=>`hour ${(hour*r).toFixed(1)} · minute ${(min*r).toFixed(1)} · second ${(sec*r).toFixed(1)} mm`)(handLengthsOf(d),geoOf(d).dialR/PX)}`,`Presentation: bg=${d.bg}, shadow=${d.shadow?'on':'off'}, time=${d.time.mode==='live'?'live':'set '+d.time.h+':'+d.time.m}`,'',
 'Custom uploads:'];
 for(const[part,m]of Object.entries(s.customs))for(const[id,cu]of Object.entries(m))L.push(` · ${part}: ${cu.name}`);
 const b=new Blob([L.join('\n')],{type:'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(b);
 a.download=s.projName.replace(/\s+/g,'_')+'_spec.txt';a.click();
 setTimeout(()=>URL.revokeObjectURL(a.href),4000)}
