/* Global drawing constants & palettes.
   ONE fixed canvas: 1200x1200, dial center at (600,600).
   Scale: 1 mm = 18 px. Case 36-44mm, strap auto 18/20/22mm. */

export const CAN=1200, C=600, PX=18;

/* How far from the dial centre a strap is drawn, in px. The 2D sheet stops it
   46 px short of the edge; a 3D strap curves away out of frame, so its flat
   bake reaches much further (on a taller canvas — see cache.js bakeSize). */
export const STRAP_REACH_2D=C-46, STRAP_REACH_3D=1650;

/* Materials. hi/base/lo drive the UI swatch and the body ramp; dk is the deep
   reflection shadow, kind picks the reflection model, rough blurs the studio
   bands and refl scales their contrast. */
export const METALS={
 steel:{name:'Steel',kind:'metal',hi:'#f6f8fb',base:'#c9ced6',lo:'#767d88',dk:'#2f343b',rough:.12,refl:1},
 rose:{name:'Rose Gold',kind:'metal',hi:'#ffe3d1',base:'#e0aa8c',lo:'#9c6a50',dk:'#3d2418',rough:.14,refl:.96},
 gold:{name:'Yellow Gold',kind:'metal',hi:'#ffefb0',base:'#e3bf6e',lo:'#9a752e',dk:'#3a2b0c',rough:.13,refl:.98},
 titanium:{name:'Titanium',kind:'metal',hi:'#eef1f4',base:'#b7bcc3',lo:'#5f666e',dk:'#262b30',rough:.32,refl:.8},
 black:{name:'Black DLC',kind:'metal',hi:'#8a8f96',base:'#43474d',lo:'#1b1d20',dk:'#0a0b0c',rough:.36,refl:.76},
 bronze:{name:'Bronze',kind:'metal',hi:'#f2d6a4',base:'#b98b4f',lo:'#6d4726',dk:'#2c1a0c',rough:.26,refl:.86},
 ceramic:{name:'White Ceramic',kind:'ceramic',hi:'#ffffff',base:'#e6e8ec',lo:'#a8aeb6',dk:'#5b626b',rough:.05,refl:1},
 carbon:{name:'Forged Carbon',kind:'carbon',hi:'#a8aeb6',base:'#2e3237',lo:'#181a1e',dk:'#0b0c0e',rough:.4,refl:.7}};

/* CSS filters used to tint uploaded custom images to a metal */
export const MF={steel:'none',rose:'sepia(.9) saturate(1.9) hue-rotate(-25deg) brightness(1.05)',gold:'sepia(1) saturate(2.6) hue-rotate(-13deg) brightness(1.05)',titanium:'saturate(.5) brightness(.9)',black:'brightness(.5) contrast(1.3) saturate(.6)',
 bronze:'sepia(1) saturate(2.2) hue-rotate(-20deg) brightness(.92)',ceramic:'grayscale(1) brightness(1.3) contrast(.85)',carbon:'grayscale(1) brightness(.5) contrast(1.5)'};

/* scene backgrounds (procedural leather canvas lives in core/textures.js) */
export const BG={
 studio:{label:'Studio Grey',css:'radial-gradient(120% 90% at 50% 12%, #43474e 0%, #2a2c31 52%, #1a1b1f 100%)'},
 dark:{label:'Dark',css:'radial-gradient(110% 90% at 50% 20%, #23252a 0%, #131418 55%, #0a0b0d 100%)'},
 leather:{label:'Leather',css:'#3a2a1c'},
 wrist:{label:'On Wrist',css:'#241c14',upload:true},
 transparent:{label:'Alpha',css:'repeating-conic-gradient(#26272c 0% 25%, #1d1e22 0% 50%) 0 0 / 24px 24px'}};
