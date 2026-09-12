/* Spec-sheet (txt) export. */
import {PX,METALS} from '../core/constants.js';
import {strapMmOf} from '../core/geometry.js';
import {store} from '../state/store.js';

export function exportSpec(){const s=store.getState(),d=s.d,P=d.parts;
 const L=['WatchStudio — Spec Sheet',`Project: ${s.projName}`,`Date: ${new Date().toLocaleString()}`,`Canvas: 1200×1200 px, dial center (600,600) · Scale 1 mm = ${PX} px`,'',
 `Case: ${d.caseMm} mm · ${METALS[P.case.metal].name} · ${P.case.finish}`,`Strap: ${P.strap.variant} · ${strapMmOf(d)} mm · color ${P.strap.color} · stitch ${P.strap.stitch} · ${METALS[P.strap.metal].name}`,
 `Bezel: ${P.bezel.variant} · ${METALS[P.bezel.metal].name} · ${P.bezel.finish}${P.bezel.variant==='diver'?' · insert '+P.bezel.insertColor:''}`,
 `Dial: ${P.dial.variant} · ${P.dial.color} · text "${P.dial.text.top}" / "${P.dial.text.bottom}" (${P.dial.text.font}, ink ${P.dial.text.color})`,
 `Markers: ${P.markers.variant} · lume ${P.markers.lume}${P.markers.glow?' (glow on)':''}`,
 `Hands: ${P.hands.variant} · ${METALS[P.hands.metal].name} · second ${P.hands.secColor} · lume ${P.hands.lume}`,`Crown: ${P.crown.variant} · ${METALS[P.crown.metal].name}`,'',
 `Crystal: ${P.crystal.variant} · gloss ${Math.round(P.crystal.opacity*100)}%`,'',
 `Hand lengths: hour 55% · minute 80% · second 90% + counterweight (of dial radius)`,`Presentation: bg=${d.bg}, shadow=${d.shadow?'on':'off'}, time=${d.time.mode==='live'?'live':'set '+d.time.h+':'+d.time.m}`,'',
 'Custom uploads:'];
 for(const[part,m]of Object.entries(s.customs))for(const[id,cu]of Object.entries(m))L.push(` · ${part}: ${cu.name}`);
 const b=new Blob([L.join('\n')],{type:'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=s.projName.replace(/\s+/g,'_')+'_spec.txt';a.click()}
