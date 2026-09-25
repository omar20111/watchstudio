/* Whole-watch themes and the randomizer. */
import {pick} from '../core/utils.js';
import {DEF_CASE} from '../core/geometry.js';

/* A theme is a whole look, case and all. What makes a case what it is — its
   outline, its bezel's shape, its lugs, its curve and length, its height, its
   movement, a bezel's screws, a complication — starts from the default for
   every theme, so one theme's square case or open heart does not carry on
   into the next one's. A theme then sets what it is known by. */
const IDENTITY=['shape','bezelShape','lugs','side','tonneauLen','bend','thicknessMm','lugLenMm','lugDropMm','crystalMm','lugHoles','movement','pushers'];
function fresh(n){const c=DEF_CASE();n.case={...n.case};for(const k of IDENTITY)n.case[k]=c[k];
 /* the bezel, strap and crown take the sizes their case would give them */
 n.bezelMm=n.strapMm=n.crownMm='auto';
 n.parts.bezel.screws=0;n.parts.bezel.screwHead='hex';n.parts.dial.complication='none';delete n.parts.strap.style}

const RAW=[
 {id:'diver',name:'Heritage Diver',apply:n=>{const P=n.parts;n.caseMm=42;
  P.case.metal='steel';P.case.finish='brushed';
  P.bezel.variant='diver';P.bezel.metal='steel';P.bezel.insertColor='#101318';
  P.dial.variant='matte';P.dial.color='#101214';P.dial.date='3';P.dial.step='stepped';P.dial.text={top:'WATCHSTUDIO',bottom:'200 m',font:'sans',color:'auto'};
  P.markers.variant='dots';P.markers.lume='#dff3e4';
  P.hands.variant='sword';P.hands.metal='steel';P.hands.lume='#dff3e4';P.hands.secColor='#e8482c';
  P.strap.variant='rubber';P.strap.color='#15161a';P.strap.metal='steel';
  P.crown.variant='oversized';P.crown.metal='steel';P.crown.finish='brushed';
  n.case.crystal='dome'}},
 {id:'dress',name:'Rose Dress',apply:n=>{const P=n.parts;n.caseMm=38;
  P.case.metal='rose';P.case.finish='polished';
  P.bezel.variant='smooth';P.bezel.metal='rose';P.bezel.finish='polished';
  P.dial.variant='sunburst';P.dial.color='#e8e6e0';P.dial.date='none';P.dial.step='flat';P.dial.text={top:'WatchStudio',bottom:'',font:'serif',color:'auto'};
  P.markers.variant='roman';
  P.hands.variant='dauphine';P.hands.metal='rose';P.hands.secColor='#8a5636';
  P.strap.variant='leather';P.strap.color='#2b2118';P.strap.stitch='#e0cfa6';
  P.crown.variant='standard';P.crown.metal='rose';P.crown.finish='polished';
  n.case.crystal='dome'}},
 {id:'panda',name:'Panda Chrono',apply:n=>{const P=n.parts;n.caseMm=40;
  P.case.metal='steel';P.case.finish='brushed';
  P.bezel.variant='tachy';P.bezel.metal='steel';P.bezel.finish='none';
  P.dial.variant='chrono';P.dial.color='#eae6db';P.dial.date='430';P.dial.step='stepped';P.dial.text={top:'WatchStudio',bottom:'CHRONOGRAPH',font:'caps',color:'auto'};
  P.markers.variant='batons';P.markers.lume='#e8e2c8';
  P.hands.variant='baton';P.hands.metal='steel';P.hands.lume='#e8e2c8';P.hands.secColor='#e8482c';
  P.strap.variant='steel';P.strap.metal='steel';
  P.crown.variant='standard';P.crown.metal='steel';P.crown.finish='brushed';
  n.case.crystal='flat'}},
 {id:'field',name:'Military Field',apply:n=>{const P=n.parts;n.caseMm=38;
  P.case.metal='steel';P.case.finish='matte';
  P.bezel.variant='smooth';P.bezel.metal='steel';P.bezel.finish='matte';
  P.dial.variant='matte';P.dial.color='#1d3a2a';P.dial.date='none';P.dial.step='stepped';P.dial.text={top:'WatchStudio',bottom:'FIELD',font:'caps',color:'auto'};
  P.markers.variant='arabic';
  P.hands.variant='sword';P.hands.metal='steel';P.hands.lume='#c7f59b';P.hands.secColor='#e0cfa6';
  P.strap.variant='nato';P.strap.color='#1d3a2a';P.strap.stitch='#e0cfa6';P.strap.metal='steel';
  P.crown.variant='standard';P.crown.metal='steel';P.crown.finish='matte';
  n.case.crystal='flat'}},
 {id:'gmt',name:'Gulf Racer',apply:n=>{const P=n.parts;n.caseMm=40;
  P.case.metal='steel';P.case.finish='brushed';
  P.bezel.variant='diver';P.bezel.metal='steel';P.bezel.insertColor='#1c3f66';
  P.dial.variant='sunburst';P.dial.color='#1c3f66';P.dial.date='3';P.dial.step='stepped';P.dial.text={top:'WatchStudio',bottom:'GMT',font:'sans',color:'auto'};
  P.markers.variant='batons';P.markers.lume='#dff3e4';
  P.hands.variant='mercedes';P.hands.metal='steel';P.hands.lume='#dff3e4';P.hands.secColor='#c96a2b';
  P.strap.variant='rubber';P.strap.color='#c96a2b';P.strap.metal='steel';
  P.crown.variant='oversized';P.crown.metal='steel';P.crown.finish='brushed';
  n.case.crystal='dome'}},
 {id:'bronze',name:'Bronze Diver',apply:n=>{const P=n.parts;n.caseMm=42;
  P.case.metal='bronze';P.case.finish='brushed';
  P.bezel.variant='diver';P.bezel.metal='bronze';P.bezel.finish='brushed';P.bezel.insertColor='#1d3a2a';
  P.dial.variant='fume';P.dial.color='#2f6b4f';P.dial.finish='polished';P.dial.date='none';P.dial.step='stepped';P.dial.text={top:'WatchStudio',bottom:'BRONZE',font:'caps',color:'auto'};
  P.markers.variant='batons';P.markers.lume='#e8d9a8';
  P.hands.variant='sword';P.hands.metal='bronze';P.hands.finish='polished';P.hands.lume='#e8d9a8';P.hands.secColor='#e8c766';
  P.strap.variant='leather';P.strap.color='#4a2f1c';P.strap.stitch='#c9a227';P.strap.metal='bronze';
  P.crown.variant='oversized';P.crown.metal='bronze';P.crown.finish='brushed';
  n.case.crystal='dome';P.crystal.finish='polished'}},
 {id:'carbon',name:'Carbon Racer',apply:n=>{const P=n.parts;n.caseMm=44;
  P.case.metal='carbon';P.case.finish='matte';
  P.bezel.variant='tachy';P.bezel.metal='carbon';P.bezel.finish='matte';
  P.dial.variant='chrono';P.dial.color='#15171b';P.dial.finish='matte';P.dial.date='430';P.dial.step='stepped';P.dial.text={top:'WATCHSTUDIO',bottom:'CARBON',font:'caps',color:'#e8482c'};
  P.markers.variant='batons';P.markers.lume='#e8e2c8';
  P.hands.variant='baton';P.hands.metal='steel';P.hands.finish='polished';P.hands.lume='#e8e2c8';P.hands.secColor='#e8482c';
  P.strap.variant='rubber';P.strap.color='#17181c';P.strap.metal='carbon';
  P.crown.variant='oversized';P.crown.metal='carbon';P.crown.finish='matte';
  n.case.crystal='flat';P.crystal.finish='matte'}},
 {id:'ceramic',name:'White Ceramic',apply:n=>{const P=n.parts;n.caseMm=40;
  P.case.metal='ceramic';P.case.finish='polished';
  P.bezel.variant='smooth';P.bezel.metal='ceramic';P.bezel.finish='polished';
  P.dial.variant='guilloche';P.dial.color='#eceae4';P.dial.finish='polished';P.dial.date='none';P.dial.step='flat';P.dial.text={top:'WatchStudio',bottom:'CERAMIQUE',font:'serif',color:'auto'};
  P.markers.variant='roman';
  P.hands.variant='dauphine';P.hands.metal='rose';P.hands.finish='polished';P.hands.secColor='#c08457';
  P.strap.variant='leather';P.strap.color='#e6e3dc';P.strap.stitch='#c9c4ba';P.strap.metal='ceramic';
  P.crown.variant='standard';P.crown.metal='ceramic';P.crown.finish='polished';
  n.case.crystal='dome';P.crystal.finish='polished'}},
 {id:'noir',name:'Noir DLC',apply:n=>{const P=n.parts;n.caseMm=44;
  P.case.metal='black';P.case.finish='matte';
  P.bezel.variant='smooth';P.bezel.metal='black';P.bezel.finish='matte';
  P.dial.variant='matte';P.dial.color='#101214';P.dial.date='6';P.dial.step='stepped';P.dial.text={top:'WATCHSTUDIO',bottom:'NOIR',font:'caps',color:'#d4af37'};
  P.markers.variant='minimal';P.markers.lume='#d4af37';
  P.hands.variant='baton';P.hands.metal='black';P.hands.lume='#d4af37';P.hands.secColor='#d4af37';
  P.strap.variant='rubber';P.strap.color='#15161a';P.strap.metal='black';
  P.crown.variant='oversized';P.crown.metal='black';P.crown.finish='matte';
  n.case.crystal='flat'}},
 {id:'arabia',name:'Arabian Heritage',apply:n=>{const P=n.parts;n.caseMm=39;
  P.case.variant='classic';P.case.metal='gold';P.case.finish='polished';
  P.bezel.variant='coin';P.bezel.metal='gold';P.bezel.finish='polished';
  P.dial.variant='enamel';P.dial.color='#f1ece0';P.dial.finish='none';P.dial.date='none';P.dial.step='flat';
  P.dial.text={top:'WatchStudio',bottom:'أوتوماتيك',font:'serif',color:'#6b4a2f'};
  P.markers.variant='eastern';
  P.hands.variant='dauphine';P.hands.metal='gold';P.hands.finish='polished';P.hands.secColor='#8a5636';
  P.strap.variant='leather';P.strap.color='#3b2416';P.strap.stitch='#e0cfa6';P.strap.metal='gold';
  P.crown.variant='standard';P.crown.metal='gold';P.crown.finish='polished';
  n.case.crystal='dome'}},
 {id:'pilot',name:'Flieger Pilot',apply:n=>{const P=n.parts;n.caseMm=42;
  P.case.variant='classic';P.case.metal='steel';P.case.finish='matte';
  P.bezel.variant='smooth';P.bezel.metal='steel';P.bezel.finish='matte';
  P.dial.variant='matte';P.dial.color='#121315';P.dial.finish='matte';P.dial.date='none';P.dial.step='flat';
  P.dial.text={top:'WATCHSTUDIO',bottom:'FLIEGER',font:'caps',color:'auto'};
  P.markers.variant='arabic';P.markers.lume='#e8e2c8';
  P.hands.variant='cathedral';P.hands.metal='black';P.hands.finish='polished';P.hands.lume='#e8e2c8';P.hands.secColor='#e8e2c8';
  P.strap.variant='leather';P.strap.color='#5a3a22';P.strap.stitch='#e8e2c8';P.strap.metal='steel';
  P.crown.variant='oversized';P.crown.metal='steel';P.crown.finish='matte';
  n.case.crystal='dome'}},
 {id:'milano',name:'Milanese Dress',apply:n=>{const P=n.parts;n.caseMm=38;
  P.case.variant='classic';P.case.metal='steel';P.case.finish='polished';
  P.bezel.variant='smooth';P.bezel.metal='steel';P.bezel.finish='polished';
  P.dial.variant='sunburst';P.dial.color='#d9dde3';P.dial.finish='none';P.dial.date='6';P.dial.step='flat';
  P.dial.text={top:'WatchStudio',bottom:'',font:'serif',color:'auto'};
  P.markers.variant='wedges';
  P.hands.variant='dauphine';P.hands.metal='steel';P.hands.finish='polished';P.hands.secColor='#2f7de1';
  P.strap.variant='mesh';P.strap.metal='steel';
  P.crown.variant='standard';P.crown.metal='steel';P.crown.finish='polished';
  n.case.crystal='box'}},
 {id:'royal',name:'Tapisserie Sport',apply:n=>{const P=n.parts;n.caseMm=41;
  P.case.variant='classic';P.case.metal='steel';P.case.finish='brushed';
  P.bezel.variant='smooth';P.bezel.metal='steel';P.bezel.finish='polished';
  P.dial.variant='tapisserie';P.dial.color='#1f3d73';P.dial.finish='none';P.dial.date='3';P.dial.step='stepped';
  P.dial.text={top:'WATCHSTUDIO',bottom:'AUTOMATIC',font:'caps',color:'auto'};
  P.markers.variant='batons';P.markers.lume='#dff3e4';
  P.hands.variant='baton';P.hands.metal='steel';P.hands.finish='polished';P.hands.lume='#dff3e4';P.hands.secColor='#e8e6e0';
  P.strap.variant='steel';P.strap.metal='steel';P.strap.finish='brushed';
  P.crown.variant='standard';P.crown.metal='steel';P.crown.finish='brushed';
  n.case.crystal='flat';
  /* the octagonal bezel with a hexagonal screw at each corner, the case running
     on into its bracelet: 41 mm across, 10.4 mm high, 51 mm end to end */
  Object.assign(n.case,{bezelShape:'octagon',lugs:'integrated',lugLenMm:12,thicknessMm:10.4});n.bezelMm=3;
  P.bezel.finish='brushed';P.bezel.screws=8;P.bezel.screwHead='hex'}},
 {id:'desert',name:'Desert Field',apply:n=>{const P=n.parts;n.caseMm=40;
  P.case.variant='classic';P.case.metal='titanium';P.case.finish='matte';
  P.bezel.variant='smooth';P.bezel.metal='titanium';P.bezel.finish='matte';
  P.dial.variant='matte';P.dial.color='#c2ab80';P.dial.finish='matte';P.dial.date='none';P.dial.step='stepped';
  P.dial.text={top:'WatchStudio',bottom:'FIELD',font:'caps',color:'#2a241a'};
  P.markers.variant='arabic';
  P.hands.variant='syringe';P.hands.metal='black';P.hands.finish='polished';P.hands.lume='#f2ead2';P.hands.secColor='#c96a2b';
  P.strap.variant='nato';P.strap.color='#5e5238';P.strap.stitch='#e0cfa6';P.strap.metal='titanium';
  P.crown.variant='standard';P.crown.metal='titanium';P.crown.finish='matte';
  n.case.crystal='dome'}},
 /* The icons each case shape is known by, in proportions measured off the real
    watches: a square dress watch with its bezel screwed down two to a side, a
    square pilot's with four at the corners, a cushion diver, a square racing
    chronograph, a curved tonneau and a slim octagon. */
 {id:'squaredress',name:'Square Classic',apply:n=>{const P=n.parts;n.caseMm=39.8;
  Object.assign(n.case,{shape:'square',bezelShape:'square',lugs:'integrated',lugLenMm:8.6,thicknessMm:9.5,crystal:'flat',crystalMm:.8});
  P.case.variant='classic';P.case.metal='steel';P.case.finish='brushed';
  P.bezel.variant='smooth';P.bezel.metal='steel';P.bezel.finish='polished';P.bezel.screws=8;P.bezel.screwHead='slot';
  P.dial.variant='matte';P.dial.color='#ece8dc';P.dial.finish='none';P.dial.date='none';P.dial.step='flat';
  P.dial.text={top:'WatchStudio',bottom:'AUTOMATIC',font:'serif',color:'#2a2c33'};
  P.markers.variant='roman';
  P.hands.variant='sword';P.hands.metal='black';P.hands.finish='polished';P.hands.lume='#e8e4d8';P.hands.secColor='#2a2c33';
  P.strap.variant='steel';P.strap.metal='steel';P.strap.finish='brushed';
  P.crown.variant='standard';P.crown.metal='steel';P.crown.finish='polished'}},
 {id:'squarepilot',name:'Square Pilot',apply:n=>{const P=n.parts;n.caseMm=42;
  Object.assign(n.case,{shape:'square',bezelShape:'square',thicknessMm:10.5,lugLenMm:5.5,crystal:'flat'});
  P.case.variant='classic';P.case.metal='black';P.case.finish='matte';
  P.bezel.variant='smooth';P.bezel.metal='black';P.bezel.finish='matte';P.bezel.screws=4;P.bezel.screwHead='slot';
  P.dial.variant='matte';P.dial.color='#111214';P.dial.finish='none';P.dial.date='none';P.dial.step='flat';
  P.dial.text={top:'WATCHSTUDIO',bottom:'AVIATION',font:'sans',color:'auto'};
  P.markers.variant='arabic';P.markers.lume='#dff3e4';
  P.hands.variant='sword';P.hands.metal='steel';P.hands.finish='polished';P.hands.lume='#dff3e4';P.hands.secColor='#e8e6e0';
  P.strap.variant='rubber';P.strap.color='#15161a';P.strap.metal='black';
  P.crown.variant='standard';P.crown.metal='black';P.crown.finish='matte'}},
 {id:'cushion',name:'Cushion Marine',apply:n=>{const P=n.parts;n.caseMm=44;
  Object.assign(n.case,{shape:'cushion',thicknessMm:15.5,lugLenMm:8,crystal:'dome'});
  P.case.variant='sport';P.case.metal='steel';P.case.finish='brushed';
  P.bezel.variant='smooth';P.bezel.metal='steel';P.bezel.finish='polished';
  P.dial.variant='matte';P.dial.color='#141414';P.dial.finish='none';P.dial.date='3';P.dial.step='stepped';
  P.dial.text={top:'WATCHSTUDIO',bottom:'300 m',font:'sans',color:'auto'};
  P.markers.variant='arabic';P.markers.lume='#f0e6c8';
  P.hands.variant='sword';P.hands.metal='steel';P.hands.finish='polished';P.hands.lume='#f0e6c8';P.hands.secColor='#e8e6e0';
  P.strap.variant='leather';P.strap.color='#6b4526';P.strap.stitch='#e8dcc0';P.strap.metal='steel';
  P.crown.variant='oversized';P.crown.metal='steel';P.crown.finish='brushed'}},
 {id:'racingsquare',name:'Racing Square',apply:n=>{const P=n.parts;n.caseMm=39;
  Object.assign(n.case,{shape:'square',bezelShape:'case',thicknessMm:14.35,lugLenMm:7,crystal:'flat',pushers:true});
  P.case.variant='classic';P.case.metal='steel';P.case.finish='polished';
  P.bezel.variant='smooth';P.bezel.metal='steel';P.bezel.finish='polished';
  P.dial.variant='chrono';P.dial.color='#1d4f9c';P.dial.finish='none';P.dial.date='none';P.dial.step='flat';
  P.dial.text={top:'WATCHSTUDIO',bottom:'AUTOMATIC',font:'caps',color:'auto'};
  P.markers.variant='batons';P.markers.lume='#dff3e4';
  P.hands.variant='baton';P.hands.metal='steel';P.hands.finish='polished';P.hands.lume='#dff3e4';P.hands.secColor='#e8482c';
  P.strap.variant='leather';P.strap.style='rally';P.strap.color='#141416';P.strap.stitch='#e8482c';P.strap.metal='steel';
  P.crown.variant='standard';P.crown.metal='steel';P.crown.finish='polished'}},
 {id:'tonneausport',name:'Tonneau Sport',apply:n=>{const P=n.parts;n.caseMm=40;
  Object.assign(n.case,{shape:'tonneau',tonneauLen:1.25,bend:1.2,lugs:'integrated',lugLenMm:7,thicknessMm:16,crystal:'flat'});
  P.case.variant='classic';P.case.metal='titanium';P.case.finish='brushed';
  P.bezel.variant='smooth';P.bezel.metal='titanium';P.bezel.finish='brushed';P.bezel.screws=8;P.bezel.screwHead='hex';
  P.dial.variant='matte';P.dial.color='#2a2d33';P.dial.finish='none';P.dial.date='none';P.dial.step='stepped';
  P.dial.text={top:'WATCHSTUDIO',bottom:'AUTOMATIC',font:'sans',color:'auto'};
  P.markers.variant='arabic';P.markers.lume='#ffffff';
  P.hands.variant='baton';P.hands.metal='titanium';P.hands.finish='polished';P.hands.lume='#ffffff';P.hands.secColor='#e8482c';
  P.strap.variant='rubber';P.strap.color='#1f1f22';P.strap.metal='titanium';
  P.crown.variant='standard';P.crown.metal='titanium';P.crown.finish='brushed'}},
 {id:'octagonslim',name:'Octagon Slim',apply:n=>{const P=n.parts;n.caseMm=40;
  Object.assign(n.case,{shape:'octagon',bezelShape:'octagon',lugs:'integrated',lugLenMm:7,thicknessMm:6,movement:'manual',crystal:'flat',crystalMm:.6});
  P.case.variant='classic';P.case.metal='titanium';P.case.finish='matte';
  P.bezel.variant='smooth';P.bezel.metal='titanium';P.bezel.finish='matte';
  P.dial.variant='matte';P.dial.color='#6a6e75';P.dial.finish='matte';P.dial.date='none';P.dial.step='flat';P.dial.complication='smallsec';
  P.dial.text={top:'WATCHSTUDIO',bottom:'',font:'caps',color:'auto'};
  P.markers.variant='minimal';
  P.hands.variant='baton';P.hands.metal='titanium';P.hands.finish='polished';P.hands.lume='#e8e8e8';P.hands.secColor='#e8e8e8';
  P.strap.variant='steel';P.strap.metal='titanium';P.strap.finish='matte';
  P.crown.variant='standard';P.crown.metal='titanium';P.crown.finish='matte'}},
 {id:'arrow',name:'Broad Arrow Diver',apply:n=>{const P=n.parts;n.caseMm=41;
  P.case.variant='sport';P.case.metal='steel';P.case.finish='brushed';
  P.bezel.variant='diver';P.bezel.metal='steel';P.bezel.insertColor='#101318';
  P.dial.variant='matte';P.dial.color='#0f1113';P.dial.finish='none';P.dial.date='none';P.dial.step='stepped';
  P.dial.text={top:'WATCHSTUDIO',bottom:'300 m',font:'sans',color:'auto'};
  P.markers.variant='dots';P.markers.lume='#dff3e4';
  P.hands.variant='arrow';P.hands.metal='steel';P.hands.finish='polished';P.hands.lume='#dff3e4';P.hands.secColor='#e8482c';
  P.strap.variant='rubber';P.strap.color='#15161a';P.strap.metal='steel';
  P.crown.variant='oversized';P.crown.metal='steel';P.crown.finish='brushed';
  n.case.crystal='dome'}}];
export const THEMES=RAW.map(t=>({...t,apply:n=>{fresh(n);t.apply(n)}}));

export function shuffleInto(n){const P=n.parts;const metal=pick(['steel','steel','rose','gold','titanium','black','bronze','ceramic','carbon']);
 for(const k of['case','crown','bezel','hands'])P[k].metal=metal;
 if(metal==='carbon'||metal==='ceramic')P.hands.metal=pick(['steel','rose','gold']);
 P.case.finish=pick(['polished','brushed','matte']);P.bezel.finish=pick(['polished','brushed']);
 P.hands.finish=pick(['polished','brushed']);P.dial.finish=pick(['none','polished','matte']);
 P.bezel.variant=pick(['smooth','fluted','coin','diver','gmt','tachy']);
 P.bezel.insertColor=pick(['#101318','#16324f','#4a1f24','#1d3a2a','#1c3f66']);
 P.dial.variant=pick(['sunburst','sunburst','matte','chrono','guilloche','fume','enamel','tapisserie','sculpted']);
 P.dial.accent=pick(['#b5a24a','#9aa2a8','#c08a4e','#7f8c5a']);
 P.dial.color=pick(['#16324f','#101214','#e8e6e0','#1d3a2a','#4a1f24','#d9c6a5','#0d3a2b','#1c3f66']);
 P.dial.date=pick(['none','none','3','3','430','6']);P.dial.step=pick(['flat','stepped','stepped']);
 P.markers.variant=pick(['batons','dots','roman','arabic','eastern','wedges','minimal']);
 P.hands.variant=pick(['dauphine','baton','sword','mercedes','leaf','cathedral','syringe','arrow']);
 P.hands.secColor=pick(['#e8482c','#d4af37','#e8e6e0','#2f7de1','#c96a2b']);
 P.crown.variant=pick(['standard','oversized']);
 P.case.variant=pick(['classic','classic','sport']);
 const sv=pick(['leather','rubber','steel','nato','mesh']);P.strap.variant=sv;P.strap.metal=metal;
 if(sv==='leather')P.strap.color=pick(['#6b4a2f','#2b2118','#1d3a2a','#4a1f24']);
 else if(sv==='rubber')P.strap.color=pick(['#15161a','#16324f','#1d3a2a','#c96a2b']);
 else if(sv==='nato'){P.strap.color=pick(['#1f3a5f','#1d3a2a','#4a4a4a']);P.strap.stitch=pick(['#e0cfa6','#e8e6e0'])}}
