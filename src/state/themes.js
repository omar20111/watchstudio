/* Whole-watch themes and the randomizer. */
import {pick} from '../core/utils.js';

export const THEMES=[
 {id:'diver',name:'Heritage Diver',apply:n=>{const P=n.parts;n.caseMm=42;
  P.case.metal='steel';P.case.finish='brushed';
  P.bezel.variant='diver';P.bezel.metal='steel';P.bezel.insertColor='#101318';
  P.dial.variant='matte';P.dial.color='#101214';P.dial.text={top:'WATCHSTUDIO',bottom:'200 m',font:'sans',color:'auto'};
  P.markers.variant='dots';P.markers.lume='#dff3e4';
  P.hands.variant='sword';P.hands.metal='steel';P.hands.lume='#dff3e4';P.hands.secColor='#e8482c';
  P.strap.variant='rubber';P.strap.color='#15161a';P.strap.metal='steel';
  P.crown.variant='oversized';P.crown.metal='steel';P.crown.finish='brushed';
  P.crystal.variant='dome'}},
 {id:'dress',name:'Rose Dress',apply:n=>{const P=n.parts;n.caseMm=38;
  P.case.metal='rose';P.case.finish='polished';
  P.bezel.variant='smooth';P.bezel.metal='rose';P.bezel.finish='polished';
  P.dial.variant='sunburst';P.dial.color='#e8e6e0';P.dial.text={top:'WatchStudio',bottom:'',font:'serif',color:'auto'};
  P.markers.variant='roman';
  P.hands.variant='dauphine';P.hands.metal='rose';P.hands.secColor='#8a5636';
  P.strap.variant='leather';P.strap.color='#2b2118';P.strap.stitch='#e0cfa6';
  P.crown.variant='standard';P.crown.metal='rose';P.crown.finish='polished';
  P.crystal.variant='dome'}},
 {id:'panda',name:'Panda Chrono',apply:n=>{const P=n.parts;n.caseMm=40;
  P.case.metal='steel';P.case.finish='brushed';
  P.bezel.variant='tachy';P.bezel.metal='steel';P.bezel.finish='none';
  P.dial.variant='chrono';P.dial.color='#eae6db';P.dial.text={top:'WatchStudio',bottom:'CHRONOGRAPH',font:'caps',color:'auto'};
  P.markers.variant='batons';P.markers.lume='#e8e2c8';
  P.hands.variant='baton';P.hands.metal='steel';P.hands.lume='#e8e2c8';P.hands.secColor='#e8482c';
  P.strap.variant='steel';P.strap.metal='steel';
  P.crown.variant='standard';P.crown.metal='steel';P.crown.finish='brushed';
  P.crystal.variant='flat'}},
 {id:'field',name:'Military Field',apply:n=>{const P=n.parts;n.caseMm=38;
  P.case.metal='steel';P.case.finish='matte';
  P.bezel.variant='smooth';P.bezel.metal='steel';P.bezel.finish='matte';
  P.dial.variant='matte';P.dial.color='#1d3a2a';P.dial.text={top:'WatchStudio',bottom:'FIELD',font:'caps',color:'auto'};
  P.markers.variant='arabic';
  P.hands.variant='sword';P.hands.metal='steel';P.hands.lume='#c7f59b';P.hands.secColor='#e0cfa6';
  P.strap.variant='nato';P.strap.color='#1d3a2a';P.strap.stitch='#e0cfa6';P.strap.metal='steel';
  P.crown.variant='standard';P.crown.metal='steel';P.crown.finish='matte';
  P.crystal.variant='flat'}},
 {id:'gmt',name:'Gulf Racer',apply:n=>{const P=n.parts;n.caseMm=40;
  P.case.metal='steel';P.case.finish='brushed';
  P.bezel.variant='diver';P.bezel.metal='steel';P.bezel.insertColor='#1c3f66';
  P.dial.variant='sunburst';P.dial.color='#1c3f66';P.dial.text={top:'WatchStudio',bottom:'GMT',font:'sans',color:'auto'};
  P.markers.variant='batons';P.markers.lume='#dff3e4';
  P.hands.variant='mercedes';P.hands.metal='steel';P.hands.lume='#dff3e4';P.hands.secColor='#c96a2b';
  P.strap.variant='rubber';P.strap.color='#c96a2b';P.strap.metal='steel';
  P.crown.variant='oversized';P.crown.metal='steel';P.crown.finish='brushed';
  P.crystal.variant='dome'}},
 {id:'bronze',name:'Bronze Diver',apply:n=>{const P=n.parts;n.caseMm=42;
  P.case.metal='bronze';P.case.finish='brushed';
  P.bezel.variant='diver';P.bezel.metal='bronze';P.bezel.finish='brushed';P.bezel.insertColor='#1d3a2a';
  P.dial.variant='fume';P.dial.color='#2f6b4f';P.dial.finish='polished';P.dial.text={top:'WatchStudio',bottom:'BRONZE',font:'caps',color:'auto'};
  P.markers.variant='batons';P.markers.lume='#e8d9a8';
  P.hands.variant='sword';P.hands.metal='bronze';P.hands.finish='polished';P.hands.lume='#e8d9a8';P.hands.secColor='#e8c766';
  P.strap.variant='leather';P.strap.color='#4a2f1c';P.strap.stitch='#c9a227';P.strap.metal='bronze';
  P.crown.variant='oversized';P.crown.metal='bronze';P.crown.finish='brushed';
  P.crystal.variant='dome';P.crystal.finish='polished'}},
 {id:'carbon',name:'Carbon Racer',apply:n=>{const P=n.parts;n.caseMm=44;
  P.case.metal='carbon';P.case.finish='matte';
  P.bezel.variant='tachy';P.bezel.metal='carbon';P.bezel.finish='matte';
  P.dial.variant='chrono';P.dial.color='#15171b';P.dial.finish='matte';P.dial.text={top:'WATCHSTUDIO',bottom:'CARBON',font:'caps',color:'#e8482c'};
  P.markers.variant='batons';P.markers.lume='#e8e2c8';
  P.hands.variant='baton';P.hands.metal='steel';P.hands.finish='polished';P.hands.lume='#e8e2c8';P.hands.secColor='#e8482c';
  P.strap.variant='rubber';P.strap.color='#17181c';P.strap.metal='carbon';
  P.crown.variant='oversized';P.crown.metal='carbon';P.crown.finish='matte';
  P.crystal.variant='flat';P.crystal.finish='matte'}},
 {id:'ceramic',name:'White Ceramic',apply:n=>{const P=n.parts;n.caseMm=40;
  P.case.metal='ceramic';P.case.finish='polished';
  P.bezel.variant='smooth';P.bezel.metal='ceramic';P.bezel.finish='polished';
  P.dial.variant='guilloche';P.dial.color='#eceae4';P.dial.finish='polished';P.dial.text={top:'WatchStudio',bottom:'CERAMIQUE',font:'serif',color:'auto'};
  P.markers.variant='roman';
  P.hands.variant='dauphine';P.hands.metal='rose';P.hands.finish='polished';P.hands.secColor='#c08457';
  P.strap.variant='leather';P.strap.color='#e6e3dc';P.strap.stitch='#c9c4ba';P.strap.metal='ceramic';
  P.crown.variant='standard';P.crown.metal='ceramic';P.crown.finish='polished';
  P.crystal.variant='dome';P.crystal.finish='polished'}},
 {id:'noir',name:'Noir DLC',apply:n=>{const P=n.parts;n.caseMm=44;
  P.case.metal='black';P.case.finish='matte';
  P.bezel.variant='smooth';P.bezel.metal='black';P.bezel.finish='matte';
  P.dial.variant='matte';P.dial.color='#101214';P.dial.text={top:'WATCHSTUDIO',bottom:'NOIR',font:'caps',color:'#d4af37'};
  P.markers.variant='minimal';P.markers.lume='#d4af37';
  P.hands.variant='baton';P.hands.metal='black';P.hands.lume='#d4af37';P.hands.secColor='#d4af37';
  P.strap.variant='rubber';P.strap.color='#15161a';P.strap.metal='black';
  P.crown.variant='oversized';P.crown.metal='black';P.crown.finish='matte';
  P.crystal.variant='flat'}}];

export function shuffleInto(n){const P=n.parts;const metal=pick(['steel','steel','rose','gold','titanium','black','bronze','ceramic','carbon']);
 for(const k of['case','crown','bezel','hands'])P[k].metal=metal;
 if(metal==='carbon'||metal==='ceramic')P.hands.metal=pick(['steel','rose','gold']);
 P.case.finish=pick(['polished','brushed','matte']);P.bezel.finish=pick(['polished','brushed']);
 P.hands.finish=pick(['polished','brushed']);P.dial.finish=pick(['none','polished','matte']);
 P.bezel.variant=pick(['smooth','fluted','diver','gmt','tachy']);
 P.bezel.insertColor=pick(['#101318','#16324f','#4a1f24','#1d3a2a','#1c3f66']);
 P.dial.variant=pick(['sunburst','sunburst','matte','chrono','guilloche','fume']);
 P.dial.color=pick(['#16324f','#101214','#e8e6e0','#1d3a2a','#4a1f24','#d9c6a5','#0d3a2b','#1c3f66']);
 P.markers.variant=pick(['batons','dots','roman','arabic','minimal']);
 P.hands.variant=pick(['dauphine','baton','sword','mercedes','leaf']);
 P.hands.secColor=pick(['#e8482c','#d4af37','#e8e6e0','#2f7de1','#c96a2b']);
 P.crown.variant=pick(['standard','oversized']);
 P.case.variant=pick(['classic','classic','sport']);
 const sv=pick(['leather','rubber','steel','nato']);P.strap.variant=sv;P.strap.metal=metal;
 if(sv==='leather')P.strap.color=pick(['#6b4a2f','#2b2118','#1d3a2a','#4a1f24']);
 else if(sv==='rubber')P.strap.color=pick(['#15161a','#16324f','#1d3a2a','#c96a2b']);
 else if(sv==='nato'){P.strap.color=pick(['#1f3a5f','#1d3a2a','#4a4a4a']);P.strap.stitch=pick(['#e0cfa6','#e8e6e0'])}}
