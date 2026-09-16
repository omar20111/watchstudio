# Changelog

## Unreleased

**Changed — a clear crystal, and hands pressed to a curve**
- **The dial is sharp through the glass again.** What is seen through the
  crystal is a second render of everything opaque, sampled with a smoothing
  filter, so the dial print, the indices and the magnified date all read softer
  than they are. That render now carries about twice the screen's resolution
  (and nothing extra on a 2x screen, which already has it), and the sapphire is
  given the mirror polish it has, since any roughness there blurs what is seen
  through it.
- **Hands are pressed to a shallow curve**, their tips dropping 0.05–0.1 mm
  toward the dial as a real hand's do, with the lume following the curve. A
  hand now catches the light along its length rather than all at once.
- The crystal-clearance check in the e2e counts the hands themselves, not the
  sheets laid over the dial (lume, shadows).

**Added — dials from PartStudio, and a background picture**
- **Import a dial designed in PartStudio** (Dial panel → Background &
  PartStudio). The file carries the plate's pattern, colour and finish, the date
  window, the chapter ring, the brand and model line, the logo and its placing,
  the background picture, and the marker set it was shown with — so the whole
  dial lands on the watch at once.
- **Background picture** (same panel, or drop a picture there): laid *under* the
  dial's printing (`core/dialbg.js`), not in place of the dial. The date window,
  the chapter step, the brand and model line and the minute track stay, and so
  does the plate's finish — a sunburst or a lacquer still catches the light,
  which a whole-dial upload cannot do. Zoom, turn and move it on the dial.
- Checked in `e2e/tests/partstudio.mjs` (a dial file brings its picture, its
  applied logo and its markers; the plate wears them).

**Changed — hands that stand over the dial**
- **Soft shadows on the dial** (`three/contactShadow.js`): the key light's
  shadow map spans the whole watch and table, so the shadow of a hand a
  millimetre wide blurred to nothing and the hands looked printed on the dial.
  Each hand, and the applied indices, now throw a soft shadow drawn from their
  own silhouette: offset away from the key light by their height above the dial,
  blurred by the penumbra a softbox gives at that height. A hand's shadow turns
  with it while still falling away from the light. They are drawn as blended
  opaque decals, since three renders what is seen through the crystal from
  opaque objects only; the path tracer and the GLB have real light and leave
  them out, and the tech pack's line drawings skip them.
- **Hands have real sides:** each hand stands on a wall of 0.07–0.13 mm below
  its facets, so from low down it has a thickness and an edge, not a sliver.
  A dauphine keeps a low wall so its two facets still light and darken apart.

**Changed — a bracelet that looks like a bracelet**
- Each link was a flat-topped block, which mirrors one patch of the studio and
  read as a black or white tile, in rows of three separate boxes. Links are
  now pillows (`watch.js pillowLink`): every edge rounded, the top crowned
  across and a little along, so each carries a gradient from light to dark.
  The centre link stands proud with more crown; the outer links fall away
  toward the bracelet's edges; the seams between them are fine lines instead
  of gaps. Brushing runs along the bracelet's length.
- **Crystal:** the sapphire's reflection is stronger (still AR coated), so the
  glass reads as glass where it turns away from the eye instead of the dial
  looking uncovered.

**Changed — the crown's end**
- The crown's end was a nearly flat disc, which reflects one patch of the
  studio and reads as a grey plate. It is now a polished chamfer, a shallow
  dome and a fine ring engraved round it, the way a signed crown is finished.

**Changed — brushed steel streaks along its grain**
- Brushed metal gets its directional highlight back, now clean: a brushed
  surface's mesh is given tangents from its uv (`materials.js withTangents`),
  so the highlight streaks round a case band and its top, along a lug, and
  along a bracelet's length, instead of the shader guessing a direction per
  2×2 pixel block. A mesh with no uv to take a direction from stays satin, and
  a tangent a degenerate triangle leaves undefined is repaired, so the GLB
  still passes the Khronos validator.

**Changed — edges that catch the light, lugs that look forged**
- **No sharp machined edges on the case:** where the band turns into the
  chamfer, and the chamfer into the case top, the corner is broken with a small
  radius (up to 0.18 mm), each its own polished face (`flankEdge`,
  `chamferEdge`). They carry the thin bright lines a real case shows.
- **Lugs are sculpted** (`casebody.js sculptedSection`): one continuous
  section instead of two vertical walls and a flat top. A gently domed top
  between rounded, polished edges; the inner face straight beside the strap;
  the outer flank curving in under itself toward the wrist; rounded bottom
  edges. Straight lugs narrow by 18% toward the tip and thin by a quarter, so
  they taper like forged horns. Drilled holes follow the narrowing flank.
  Crown guards take the same section.
- **Fixed: brushed metal showed blotches.** The brushing grain is laid out by
  a part's uv, and three's lathe spaces v by point count, so a case band whose
  profile bunches points into its small rounded edge had its grain stretched
  eight times along the long straight run. Lathes now space v by distance
  along the profile; a brushed band shows fine brushing lines.
- **Fixed: mirror-polished curves showed bands.** A drum or sloped side is
  drawn with 36 steps instead of 12, and a tonneau's bowed sides, which its
  outline approximates with short edges, are sampled evenly as a curve rather
  than as a hundred narrow flats.
- The studio's strip lights are wider and softer-edged: a thin, very bright
  strip broke up into blotches when blurred for rougher metal.

**Changed — a watch photographer's studio**
- Polished metal looked like grey plastic: seen from above, a case's side
  reflects the table, and the studio's table was an even pale grey, so the
  side came out one flat grey (and rose gold one brown smear). The studio
  (`three/studio.js`) is rebuilt as a catalogue set, built for reflections: a
  dark room, a large overhead softbox pulled toward 12, two tall strip lights
  at 2 and 10 o'clock, a lit backdrop behind with a crisp horizon line, and
  white bounce cards stood on a dark table at 4, 7 and 10. A polished case
  side now shows bright bands against dark ones, and edges and bezels carry
  thin lines of light.
- The set is one function of direction: the live views prefilter it (as half
  float, which filters on every WebGL 2 device), and Photo mode path traces the
  same panorama, now at full strength since the room is dark.
- **Brushed** metal is a softer satin (rougher, no anisotropy). Its streaking
  was derived per 2×2 pixel block without tangents, which the crisp new lights
  turned into blotches; directional brushing comes back with real tangents.
- **Black DLC** gains its glossy film (a clearcoat), and forged carbon a
  stronger one: against a dark room a black case otherwise vanished, and the
  grey reflections of the lights in that film are what show its shape.

**Added — square and tonneau cases, square bezel**
- **Case shape** gains *Square* (tight corners) and *Tonneau*: a barrel 1.2
  times as long from 12 to 6 as it is across, its sides bowed out, its ends
  narrower and gently domed. A 40 mm tonneau is 40 × 48 mm.
- **Bezel shape** gains *Square*.
- **One outline model for every shape** (`core/caseshape.js`): a convex core
  polygon with a rounded edge all the way round it. Setting it in by less than
  the corner radius shrinks the corners; past that the core's own edges move
  in. Round, cushion and octagon come out exactly as before (checked against
  the previous code to 1e-11 mm); every point of the new shapes lies exactly
  on its inset, so a chamfer stays an even width round a tonneau too.
- **A tonneau's length is real:** lug-to-lug, the lug tips, the lug drop, the
  bracelet's end link and the integrated shoulder all start from its ends. Its
  ends are narrower than its middle, so where a pair of lugs for a wide strap
  would run past the end's flat run, the Case panel says so.
- **Shaped bezels fit the case they sit on:** a shaped bezel is as large as the
  case top holds it (everywhere as far inside the case's edge as a round bezel
  sits in a round case), up to its flats at the bezel's size. On a round case
  an octagon is unchanged; on a cushion or square case an octagon or square
  bezel now fills the case's corners. A shape whose flats would cut into the
  crystal opening (a square bezel on a round, octagon or tonneau case, or any
  shaped bezel with a very narrow bezel width) is greyed out in the panel, and
  a design that asks for one is built round.
- **Editor:** the front view's dashed guide follows a shaped case or bezel.
- **Tech pack:** a tonneau is "40.0 wide" on the front view, with its case
  length dimensioned on the side view and "width × length" on the cover; a
  bezel is labelled by the shape it is built with. Spec sheet and `spec.json`
  carry the case length.
- **Fixed on the tech pack's side view:** the lug-to-lug figure ran into the
  caseback on an integrated case, and the crown's leader crossed the
  dimension figures.
- Checked in `combos.mjs` for 5 case shapes × 3 bezel shapes × 4 lug styles on
  a classic and a sport watch: the bezel keeps its distance from the case's
  edge and clears the crystal opening, the case is as long as stated, lug tips
  reach the stated lug-to-lug, and the earlier checks. The editor e2e picks
  Tonneau.

**Removed — the flat 2D watch**
- The watch is drawn only in 3D now. The flat whole-watch drawing (the painted
  case with its lugs, crown, crystal and rehaut, the layer compositor behind
  it, the flat stage and `?2d`) is gone. It had become a second picture of the
  watch that every case feature had to be built for twice, and it still could
  not show a drum side, a hooded lug or an integrated shoulder.
- **Kept:** the artwork painters for the dial, markers, hands, bezel, strap and
  caseback. They are what the 3D watch is dressed in (textures, traced
  silhouettes), and they still make the layered export's part files and the
  tech pack's artwork.
- **Without WebGL** the stage and the product view say so in place of the
  watch: why, how to fix it (hardware acceleration, another browser), and a
  retry. The design stays saved. PNG export says it needs 3D; the design
  sheet's elevations say the same; the gallery cards go without pictures.
- **Preset thumbnails:** the case and crown presets are small 3D stills of the
  design with that preset applied, rendered one at a time and kept. The crystal
  presets are drawn as their profile on the bezel (flat, domed, box), since
  clear glass is not something a picture of the whole watch tells apart.
- Still renders (exports, the design sheet, the gallery, preset pictures) now
  take turns on their shared view, so one can no longer swap the design out
  from under another's frame.
- The layered export's `parts/` folder holds the strap, bezel, dial, markers
  and hands artwork, plus any part the user uploaded a picture for.

**Added — shaped cases and integrated bracelets**
- **Case shape** (Case panel): *Round*, *Cushion* (a square with big rounded
  corners) or *Octagon*. The case band, chamfer and case top are lofted around
  the outline instead of lathed (`core/caseshape.js`, `shapedProfile` in
  `three/casebody.js`):
  - The outline is a rounded regular polygon. Each step in from the edge is an
    exact offset of it, so the chamfer stays an even width all the way round,
    corners included.
  - Every side profile (straight, drum, sloped, stepped) follows the outline.
  - The case size is measured across the flats, so a 40 mm cushion is 40 mm at
    3 and 9 and reaches further at its corners.
  - Lugs, crown guards, the crown and pushers all meet the shaped wall where it
    really is: the fillets, the crown's standoff and each pusher's reach are
    found on the outline along their own bearing.
- **Bezel shape**: *Round* or *Octagon*. An octagonal bezel keeps its corners
  inside the bezel diameter, so it sits on a round case without overhanging. Its
  top blends from the octagon at the outer edge to round at the crystal, and the
  insert and crystal opening stay round.
- **Integrated lugs** (Lugs: *Integrated*): instead of two horns, the case grows
  a single shoulder as wide as the strap plus its walls. Its top carries on
  from the case's flat top, rising over the chamfer and falling only a little,
  so the bracelet reads as part of the case; its underside flows down to meet
  the strap, and the strap or bracelet leaves it level with its top (within
  0.05 mm for every strap type). The bracelet's end
  link starts where the shoulder ends. Lug-to-lug shortens to match, and drilled
  holes are off for this style.
- The flat 2D drawing paints the cushion or octagon outline and clips the bezel
  to an octagon.
- The tech pack labels a shaped case "across flats" instead of Ø, names the
  shape in the cover figures and parts list, and dimensions an octagonal bezel
  across its flats. The spec sheet and `spec.json` carry `caseShape` and
  `bezelShape`.
- Checked in `combos.mjs` for every case shape × bezel shape × lug style on a
  classic leather and a sport steel watch: the case top lies on the outline, the
  bezel stays inside its diameter, the crown clears the wall, swept normals are
  unit length, and an integrated shoulder is wider than the strap with the strap
  flush. The editor e2e picks cushion, octagon and integrated and checks the
  rebuilt case and the saved design.

**Changed — the case is one piece**
- **Lugs grow out of the case** (`three/casebody.js`). Each lug used to be a flat
  extruded slab pushed into the side of the case band, with a hard seam where
  they met and a flat top joining halfway up the band. Now each lug is one solid
  swept from inside the case to its tip:
  - **Plan:** its sides run into the case wall through a fillet (a concave radius
    on both sides), then straight to a rounded tip on the lug-to-lug.
  - **Top:** it rises out of the case chamfer, just under the bezel, and sweeps
    down toward the wrist by the lug drop.
  - **Underside:** it leaves the band a quarter of the way up and lifts clear in
    a long concave curve.
  - **Section:** a flat top with rounded bevels onto the flanks, as separate faces,
    so a brushed case keeps polished lug edges.
- **Fixed: the lugs stood wider apart than the strap.** The gap between a pair of
  lugs was about 2.5 mm wider than the lug width the watch states (22.5 mm for a
  "20 mm" watch), so the strap floated between them. The lugs now stand 0.15 mm
  off the strap on each side. The tech pack's lug-width dimension now lands on
  the lug faces.
- **Case side profile** (Case panel): *Straight*, *Drum* (bowed out, widest at
  mid-height), *Sloped* (drawn in toward the caseback, slimmer on the wrist) or
  *Stepped* (a narrower lower tier below a small ledge). The widest point stays
  the case diameter, so every figure holds.
- **Lug styles** (Case panel):
  - *Straight*.
  - *Twisted*, a lyre lug: the outer flank sweeps outward toward the tip and is
    cut to a flat polished facet that widens as it goes, while the inner face
    runs straight beside the strap.
  - *Hooded*: each pair of lugs and a hood across the strap end are one solid,
    with a tunnel for the strap underneath.
- **Drilled lug holes** (Case panel): spring-bar bores through the lugs' outer
  flanks. The flat 2D drawing no longer paints a hole on the lug's top face,
  where no real hole shows.
- **Crown guards** on the sport case are swept the same way: they grow out of the
  case through fillets, and their tops fall away toward the tip.
- The tech pack, spec sheet and `spec.json` name the case side and lug style.
- Checked in `combos.mjs` for every side, lug style, holes or not, classic and
  sport, 34 and 46 mm: the lug gap against the strap, the tips on the
  lug-to-lug, nothing above the bezel seat, faces pointing outward, holes and
  hood tunnel present when chosen, the band's profile. Also in
  `e2e/tests/editor.mjs` (the controls rebuild the case and are saved).

**Added — a tech pack for manufacturers**
- **Tech pack** (⋯ menu, or the toolbar on a wide screen): one ZIP that a
  case, dial or hands maker can quote from.
  - **The PDF** (`export/techpack.js`): seven A4 sheets with a title block
    (project, sheet, scale, units, date):
    1. *Cover:* a ¾ rendering and the key figures.
    2. *Case:* front and side drawings at 2:1, or 3:2 for a watch too large
       for the sheet, dimensioned: diameter, width over the crown, lug to lug,
       lug width, bezel, crystal opening, dial, date window, registers, total
       thickness, crystal height, and crown diameter and height.
    3. *Caseback:* back drawing, the thickness stack to scale, and the
       construction (movement and beat, caseback, crystal, crown, bezel clicks,
       water resistance, lugs).
    4. *Parts list:* style, material, finish (brushed with polished bevels
       where the finish zones apply), colour swatch and sizes for every part,
       strap or bracelet included.
    5. *Dial artwork:* enlarged, in its inks, with numbered balloons locating
       every element from the centre: text height and position, index ring,
       minute track, date window, registers, chapter step, logo.
    6. *Bezel and hands:* the insert's engraving and pip, the hands with
       their lengths from the pivot.
    7. *Notes:* what the design fixes, blanks to agree with the manufacturer
       (tolerances, material grades, calibre, lume grade), and revisions.
  - **The drawings are the 3D watch** (`export/lineart.js`): drawn
    orthographically as lines where the outline ends, the surface folds or one
    part stands in front of another, so they cannot disagree with the model.
  - **The artwork is vector** (`export/artwork.js`): the dial's text, minute
    track and register scales, a printed logo, the applied indices, the bezel
    engraving and the hands are each baked alone at 72 px per mm and traced
    into outlines. The date window, registers, dial edge and chapter step are
    exact cut lines. They are written as layered SVG at 1:1 in mm
    (`artwork/dial.svg`, `bezel.svg`, `hands.svg`), with ink colours and metal
    names in the layer labels.
  - **No dependency:** the PDF writer (`export/pdf.js`) sets text in the
    built-in Helvetica with its real character widths, falls back to a
    picture for scripts that font lacks (Arabic, for example), and deflates
    streams with the browser's CompressionStream.
  - Checked in `combos.mjs` (PDF cross-references, escaping, text widths) and
    `e2e/tests/techpack.mjs` (the download, seven sheets, drawings, figures
    matching `spec.json`, 1:1 artwork whose indices reach the hour ring).
- **Fixed: bezel numerals were struck through.** On diver and GMT inserts the
  long tick at 10, 20 … 50 (and at every even hour on a GMT) ran through the
  numeral printed there, and a tick sat under the pip. Those ticks are now
  left out, as on a real insert.
- The text spec sheet gives the hands' real lengths in mm; it still had the old
  fixed percentages.

**Added — markers from PartStudio**
- **Import a marker set designed in PartStudio** (Markers panel → From
  PartStudio, or a `#m=` link from PartStudio's Open in WatchStudio). A set is
  several index styles placed hour by hour, in millimetres: outlines, numerals,
  bevelled/faceted/domed relief, metals, printed ink and lume. It is ground on
  the 3D dial with PartStudio's own code (`core/markerset/`, copied from
  PartStudio's `src/core`), leaves out the index a date window replaces, sets
  the hour hand's length, and appears among the marker presets. Checked in
  `combos.mjs` and `e2e/tests/partstudio.mjs`.
- PartStudio's numeral faces come with the sets (`core/markerset/fonts/`, OFL):
  Eastern Arabic, Persian, Roman IIII, words at the hours and readable radial
  numerals are ground in the faces they were designed in, on every device.

**Added — depth**
- **Ambient occlusion** (`core/three/ao.js`). three's GTAO, multiplied onto the
  frame the renderer already draws, so tone mapping, antialiasing and the
  transparent background are unchanged. Half resolution live, full for stills;
  export tiles overlap so the effect leaves no seams. The crystal, lume and
  upload sheets and the shadow-catcher are hidden from its depth pass. If a
  live view draws below ~30 fps with it for three seconds, it switches off for
  that view only.
- **Softer key-light glints** (`materials.js softenKeyGlint`). The key light is
  a point source; on the crystal and mirror polishes its specular made a tiny
  camera-flash dot. Its point reflection is now removed on glass and scaled by
  roughness elsewhere; its shadows and fill are unchanged, and the softbox
  reflection comes from the environment as before.
- **Ground hands and indices** (`core/three/relief.js`). Hands and applied
  indices are no longer flat slabs: each is a height field over its traced
  outline. A dauphine has two facets meeting at a ridge, batons and swords a
  bevel round a flat top with the lume sunk into a channel, leaf hands and
  dot indices are domed. Hour hands stand a little taller than minute hands.
- **Straps with a real shape.** A leather, rubber or NATO strap is a solid
  with a flat underside, rolled edges and a crowned top, instead of an
  open-ended band. Leather is padded where it leaves the lugs and thins toward
  its end. The 6 o'clock strap narrows to a rounded tail with five holes, and
  its stitching follows the tail. The 12 o'clock strap folds round a tongue
  buckle and carries two keepers. The buckle is made in the strap's hardware
  metal; a ceramic or carbon watch gets a steel or black buckle. All three are
  in the GLB.
- **New styles.**
  - *Markers:* **Arabic ١٢** — Eastern Arabic (Arabic-Indic) numerals, raised
    like the others; and **Wedges**, applied indices ground to a ridge. The
    existing 12 · 3 · 6 · 9 style is now labelled Numerals.
  - *Hands:* **Cathedral** (a lume lancet crossed by a metal bar), **Syringe**
    and **Broad arrow**.
  - *Dials:* **Enamel**, a deep glossy glaze, and **Tapisserie**, a grid of
    small pyramids that each catch the light in 3D.
  - *Bezel:* **Coin edge**, finely knurled round a fixed ring.
  - *Strap:* **Milanese** mesh, a woven metal band.
  - Unlumed numerals and wedges in a dark metal on a dark dial are printed in
    cream instead, so a black-handed pilot's watch keeps legible numerals.
  - Dial text in Arabic keeps its letters joined (no letter spacing).
- **Fixed: hour markers moved with every style.** Each style was centred on
  the same radius, so short minimal bars and dots sat further in than batons,
  numerals moved in on a stepped dial, and a numeral's reach depended on its
  glyph — 10 and VIII stood out past 1 and V. Every style now ends on one ring
  just inside the minute track (0.885 of the dial radius) and runs inward by
  its own length; numerals are placed by their actual ink, so their farthest
  pixel touches the ring. All styles now end within 0.01 of the radius of each
  other, checked hour by hour on the 3D indices (`e2e/tests/markers.mjs`).
- **Hands as long as a watchmaker cuts them** (`geometry.js handLengthsOf`).
  Hand lengths were fixed fractions of the dial radius, so the minute hand
  stopped short of the minute track and the hour hand floated in the middle
  of the dial whatever the indices. Now the seconds hand reaches the outer end
  of the minute track, the minute hand ends inside the track, and the hour hand
  reaches the inner end of the hour indices, but is never more than 80% of the
  minute hand. So it is longer over short minimal bars than over batons. A
  longer hand keeps its width and shape rather than growing fatter. The hands
  sit a little higher, so the hour hand clears the tallest applied index.
  Checked for every index style at 34, 40 and 46 mm (`combos.mjs`).
- **Straps as long as the real thing** (`geometry.js strapLengthsOf`). Both
  strap pieces used to run the same length, so the watch lay on two equal
  stubs. A two-piece strap is sold by the length of each piece from the spring
  bar, and now each is cut to that. On a 20 mm strap the buckle piece is 75 mm,
  buckle included, and the piece with the holes is 118 mm. Narrower straps are
  a little shorter and wider ones a little longer. Each piece has its own bake,
  only as tall as that piece is long, so even the longest strap stays inside a
  phone GPU's 4096 px texture limit. Checked by measuring the built meshes
  (`combos.mjs`). Bracelets keep their length until they get a clasp.
- **Night mode** (the Night button by the cameras, or N). The lights go out: the
  studio drops to a faint moonlight, and every lume material glows in its own
  colour through its own shape. That covers the indices' lume, the hands' lume,
  a rotating insert's pip and a PartStudio set's lume. The watch is only just
  visible around it, and the stage's backdrop darkens with it. Turning it off
  restores the daylight look exactly, including a lume's own Glow setting. It
  needs no rebuild, so it switches instantly, and it is saved with the design.
  Checked in `combos.mjs` (what is marked as lume) and `e2e/tests/night.mjs`
  (on a diver: all four lumes glow, the studio dims, N restores daylight).
- **A bracelet with fitted end links and a folding clasp** (`geometry.js
  BRACELET_MM`). The bracelet was the same run of links on both sides, with a
  plain block as its end link. It now lies open on the table as a real one
  does:
  - **End links:** each is cut to the case's own curve, closing the gap
    between the lugs without touching the case.
  - **Lengths:** 62 mm of links at 12 o'clock, 80 mm at 6.
  - **Clasp:** the 6 o'clock half ends in a 34 mm folding clasp lying closed: a
    cover brushed along its length with polished bevels (the finish zones),
    engraved with the case's engraving, over two blades and a hinge. The
    12 o'clock half ends in the bar the clasp locks onto.
  - **Taper:** the links narrow to where each half ends.

  A GLB with the bracelet, a diver insert and a movement passes the Khronos
  validator. Checked in `combos.mjs`: end links against the case, the clasp on
  the table and its length.
- **An engraved bezel insert with a raised pip.** A diver or GMT insert was
  printed flat. Its scale is now cut into it: the ticks and numerals are
  grooves with sloped walls (a normal map made from the insert's own markings),
  filled with a satin metal coat that is rougher and metallic where the ceramic
  is glossy. The lume pip at zero stands proud in a polished setting, a domed
  dot of lume, and turns with the insert. The GLB carries both, and the
  validator passes it.
- **Clearances between the hands and what is on the dial** (`geometry.js`
  CLEARANCES, `logo.js logoBoxOf`).
  - **Height:** a raised part may stand no taller than the underside of the
    lowest hand that sweeps over it: the hour hand out to its tip, then the
    minute hand, then the seconds hand. A PartStudio set designed with tall
    indices (up to 1.2 mm) is ground no taller than that at each index's inner
    end. The built-in index styles are checked against it at every size and
    chapter ring. An applied logo is checked in the browser to stand below the
    hour hand.
  - **Logo placement:** the logo keeps the place and size you set, but is drawn
    smaller where it would run into the brand text, the model line, the date
    window, a register or the hour indices, or cover the hands' centre. The
    Logo panel says how much smaller and what for, or asks you to move it when
    there is no room at all. It is never made larger and never moved.
  - **Posed pictures:** the 10:09 pose that thumbnails, stills and the design
    sheet use picks its second, from 36 outward, so the seconds hand (tail to
    tip) crosses no printing, no date window and no logo.
  - Checked in `combos.mjs` and `e2e/tests/logo.mjs`.
- **Dial elements at their real sizes** (`geometry.js DIAL_MM`). Several dial
  elements grew and shrank with the case diameter, so a 46 mm watch had a date
  window a third larger than a 34 mm one. On a real watch the date aperture and
  the chronograph registers belong to the movement, and the printing is set
  for legibility. Now they keep their sizes in mm, and shrink only where a
  small dial has no room:
  - **Date window:** 3.1 × 2.4 mm at 3, 2.7 × 2.3 mm at 6, 2.5 × 2.1 mm at 4:30,
    with a 0.2 mm frame and numerals sized to the aperture.
  - **Chronograph registers:** 7.8 mm across and up to 8 mm from the centre.
    Where they reach into the hour indices, the indices at 3, 6 and 9 are left
    out, PartStudio sets included.
  - **Chronograph date at 3:** it sits between the seconds register and the
    track when there is room, as on a 46 mm case. Otherwise it moves to 4:30,
    and the Dial panel says why.
  - **Printing:** the brand is 2 mm and the model line 1.2 mm. Each shrinks only
    to clear a register or the date window level with it. On a chronograph the
    model line stacks under the brand, above the registers.
  - **Details:** the centre pinion is 0.45 mm, tapisserie pyramids have a 1 mm
    pitch, and register snailing has a groove every quarter millimetre.

  The 2D dial, the 3D registers and hands, and the marker renderers read one
  layout, so they cannot drift. Checked for every size, position and chapter
  ring in `combos.mjs`.
- **A real movement behind the exhibition caseback** (`three/movement.js`).
  The window used to show a painted disc. It now shows a movement built from
  parts, sized to the thickness stack: it sits between the caseback and the
  dial, and is wider than the window but narrower than the dial.
  - **Automatic:** a half-disc rotor with a gold rim and an engraving (the case's
    engraving text) on a centre bearing.
  - **Bridges and wheels:** barrel and train bridges and a balance cock with
    Côtes de Genève; a toothed ratchet and crown wheel with sunray faces; jewels
    in gold settings; blued screws; and a perlage-grained plate.
  - **Balance:** a balance wheel with timing screws and a hairspring, swinging
    270° either way at the calibre's beat (28,800 an hour for an automatic,
    21,600 for a hand-wound one).
  - **Other movements:** a hand-wound movement has no rotor. A spring drive
    turns a glide wheel 8 times a second. A quartz movement shows its battery,
    coil, quartz capsule and a gilt cover.
  - **Window:** the window is now a solid sapphire disc.
- **Back camera.** The watch turned over, caseback toward you. The key light
  and studio swing round to the viewer's side, so the movement is lit like the
  front. The view redraws every frame while a balance swings in it. It is
  saved with the design, is reachable with V, and is unavailable while an
  uploaded flat part is in use. The Side view's caseback drawing is lit the
  same way. Checked in `combos.mjs` (fit in the case, parts per movement, the
  beat) and in `e2e/tests/movement.mjs` (Exhibition, Back, a swinging balance,
  and a GLB with the movement that passes the Khronos validator).
- **Finish zones on the case, bezel and crown** (`materials.js zoneFinish`).
  A finish used to cover a whole part, so a brushed case had brushed bevels
  too. Now:
  - the finish you choose covers the flat surfaces: the case band, lug tops and
    sides, crown-guard faces, the bezel's top and side, and the crown barrel;
  - the bevels are polished on a brushed case: the case chamfer, the lugs' and
    crown guards' rounded edges (their own faces now, split from the
    straight extrusion before the lugs are bent down), the bezel's outer and
    inner edges, the crown end, the pusher heads and the caseback rim;
  - a polished part is polished everywhere, and a bead-blasted (matte) one is
    blasted everywhere;
  - the caseback centre stays circle-grained unless the case is blasted.

  The two halves of a lug share their vertices and normals, so the shading
  runs on across the line where the finish changes. The Finish panel says what
  Brushed means on these parts. Checked per mesh and per finish in
  `combos.mjs`.
- **A solid sapphire crystal** (`lathe.js crystalSolid`). The crystal was a
  single glass skin with nothing under it. It is now a closed solid:
  - a flat crystal has a ground 45° bevel, a dome is a shell, and a box crystal
    has tall walls rounded over at the top;
  - its underside clears the hands, measured at each distance from the centre
    (only the seconds pinion stands tallest), and a crystal set low in a thin
    bezel is ground thinner there rather than touching them;
  - outside the dial a rim steps down to its seat, as a crystal is cut, so there
    is no gap under it at the bezel.

  The path-traced photo and the GLB (`KHR_materials_volume`) refract through
  its real thickness. The live view bends by a fraction of it, because
  screen-space refraction at a full millimetre smeared the date window and
  kinked the indices.
- **Cyclops date magnifier** (Crystal panel; `geometry.js cyclopsOf`). A
  plano-convex sapphire lens bonded over the date window: a rounded-rectangle
  footprint with a spherical top, its radius chosen to magnify the date 2.5x
  from its height above the date wheel. That calculation allows for the
  sapphire under and inside the lens. It needs a flat top, so it is offered on
  flat and box crystals and explains itself on a dome or without a date.
  - In the live view a shader magnifies what lies under the lens, along the line
    of sight refracted into the sapphire. Seen from above it shows the date;
    tilted far enough, the date slides out of it, as on a real watch.
  - The path tracer magnifies through the lens itself.
  - The flat 2D drawing marks the lens.

  Checked across crystal shapes, heights, bezels and case sizes in
  `combos.mjs`, and in the browser in `e2e/tests/crystal.mjs`.
- **A welcome for first-time visitors** (`ui/Welcome.jsx`). A gallery of all
  15 designs, shown as real renders, to start from — or a blank watch — then
  three quick steps (case, dial, strap) over the live editor, with the full
  editor one click away. Visitors arriving on a share link or with a design of
  their own go straight to the editor; the ⋯ menu reopens the gallery.
- **Browser tests in the project** (`e2e/`, `npm run e2e`). The checks that
  used to live outside the repository now run against the built app in a real
  browser: welcome and quick start, tilt and editing, Wear, phone gestures,
  logo upload, AR, Photo, and GLB validity. GitHub runs them on every push
  (reporting, not yet blocking deploys). The built app exposes its live view
  to them when opened with `?e2e`.
- **Your logo on the dial** (`core/logo.js`, `ui/LogoControls.jsx`). In the Dial
  panel, add a PNG, SVG or JPG (optionally removing a white background). It is
  **printed** on the dial — in the dial's ink or its own colours — or
  **applied**: traced and raised in the hands' metal like the numerals. Size
  and position sliders, and one click to use it in place of the brand text.
  The image is kept in the upload vault, so it survives reloads and appears
  in the product render, photos, AR, the design sheet and the GLB.
- **Six new themes:** Arabian Heritage, Flieger Pilot, Milanese Dress,
  Tapisserie Sport, Desert Field and Broad Arrow Diver. Shuffle draws on the
  new styles too.
- **📷 Photo** (`core/three/photo.js`, `ui/Photo.jsx`). The product render can
  take a photo-quality still: the view is path traced (three-gpu-pathtracer)
  from exactly the camera on screen, so the case reflects the strap, the
  crystal catches the room, shadows fall soft from a real area light, and a
  lens blurs what is out of focus. It refines over 320 samples (seconds on a
  desktop GPU, longer on a phone) and can be saved as a PNG at any point; the
  live view pauses underneath. The room is the same studio the live views
  reflect, now also generated as a panorama (`studio.js studioEquirect`).
  Photos carry wear as its average roughness; hairline scratches and brushed
  streaks are drawn by the live renderer only.
- **Staging** (`core/three/surfaces.js`). The product render's watch lies on a
  surface — Studio paper, Slate, Walnut, Marble, Linen or None — generated as
  seamless textures with a finish to match (polished marble reflects, walnut
  is varnished, linen matte), fading into the backdrop. Lens blur: Off, Soft
  or Strong, for photos. Both are saved with the design.
- **Works on phones and tablets.**
  - *Pinch to zoom* the watch in the editor and the product render. A pinch
    used to zoom the whole page instead, leaving the editor magnified.
  - *Two fingers to tilt* the front view, the touch form of right-drag; it
    eases back level when you let go. A second finger landing during a part
    drag puts the part back, so starting a pinch never moves anything.
  - *A layout that fits.* The top bar keeps undo, the views and a ⋯ menu for
    everything else, instead of scrolling most of its buttons off screen. The
    stage's hint, time and zoom bars no longer overlap; the hint shows touch
    gestures and fades once read; the zoom steps give way to pinching. The
    design sheet is scaled to fit the screen. On mid-sized screens the top
    bar moves its less-used exports into More rather than overflowing.
- **View in AR** (`core/three/ar.js`, `export/usdz.js`, `ui/ARModal.jsx`). See
  the watch in your room at its real size, from the toolbar or the AR chip on
  the stage.
  - *iPhone and iPad (Safari):* the design is built as USDZ in the page and
    opened in Apple's AR viewer, standing on a table.
  - *Android (Chrome with ARCore):* a WebXR session in the page. Tap a surface
    to place the watch, tap again to move it; its hands keep the design's time
    and it wears the same materials the editor draws.
  - *Computers:* a QR code opens the design on your phone in one scan.
- **Shorter share links.** New links compress the design (`#z=`), about 40% of
  the old length, which is what lets them fit in a QR code. Old `#w=` links
  still open.
- **Surface wear and texture** (`core/three/wear.js`). Exposed metal is no
  longer factory-perfect. Polish carries faint hairline scratches and handling
  haze, brushed surfaces show real streaks along their grain, and a matte
  finish is burnished where it is rubbed. A new **Wear** setting on the case
  chooses New, Light (the default) or Worn. Hands, indices and the dial sit
  under the crystal and stay new. Leather straps have a pebbled grain, rubber a
  fine matte skin and NATO straps a woven texture; the strap grain is in the
  GLB, while the wear is drawn by the renderer only.
- **Fixed: brushed lugs rendered flat white.** The lugs and crown guards had no
  texture coordinates, which a brushed finish needs for its grain direction.
- **Tilt to look round the watch while editing.** In the front view, drag with
  the right mouse button (or Ctrl-drag on a trackpad) to tilt the watch up to
  25° and see its flanks, lugs and crown. It eases back level when you let go,
  so edits always happen square-on. Selection guides hide while it is tilted.
- **Solid bracelet links.** A steel bracelet is rows of outer and centre links
  following the strap path, hinging round the bend, with dark pins in the
  joints and an end link between the lugs. Brushed along its length; a
  polished finish polishes the centre links. Merged per material.
- **Dial construction** (`geometry.js dialLayoutOf`, shared by the 2D dial, the
  3D plate and the checks):
  - *Date window* at 3, 4:30 or 6: an aperture cut through the plate, lined
    with a polished frame, onto a date wheel that turns to the day. The index
    at that hour is left out. A chronograph's date at 6 moves to 4:30.
  - *Stepped chapter ring*: the dial's centre sits 0.18 mm below the ring that
    carries the minute track. Numerals move in slightly so they clear the step.
  - *Chronograph registers* are milled 0.28 mm into the plate, with snailed
    grooves as a normal map.
  New designs have a date at 3 and a stepped ring; themes choose their own.
  Schema v7: designs saved earlier keep the flat, no-date dial they had.

**Added**
- **Works without WebGL.** A browser with no WebGL 2 (hardware acceleration
  off, remote desktops, older machines) used to crash into the error screen,
  whose "Try again" crashed again. It now shows the flat 2D drawing — the lit
  part artwork stacked with transforms, clock angles, tints and glow — with a
  banner saying why and what still works. Dragging moves the part selected in
  the list; the ¾ and side cameras are disabled with a reason; PNG export and
  the layered ZIP use the flat front view; the design sheet says which views
  need 3D. `?2d` forces this mode. (`core/three/support.js`, `export/flat.js`,
  `ui/FlatWatch.jsx`)
- **GPU context loss recovery.** When the browser drops the WebGL context the
  view pauses with a notice and is rebuilt when the context returns; if it has
  not returned after 6 s, every view switches to the flat drawing.
- **3D model export (`⤓ 3D model`, .glb).** The editor's own watch as binary
  glTF, for Blender, product renderers, manufacturers' viewers and AR. At real
  size (modelled in mm, scaled to metres), posed at the set time or 10:09, one
  node per design part, the spec in the root's extras, PBR materials kept
  (transmission, ior, clearcoat, sheen, specular, anisotropy). Tangents are
  computed so anisotropy and normal maps are portable; the crystal is
  thin-walled glass. Passes the Khronos glTF Validator with no errors or
  warnings, and works without WebGL. (`export/glb.js`)

- **Ready to publish on GitHub Pages.** The workflow now also deploys `main`
  (checkout/setup-node v7, upload-pages-artifact/deploy-pages v5, Node 22 —
  Node 20 is end-of-life and Vite 8 needs 20.19+). README → "Publish online"
  has the one-time repository setting. Checked by serving the production build
  under `/watchstudio/`: 3D runs, share links keep the path and open for a
  fresh visitor, and nothing is requested outside the subpath.
- Page title and description no longer say "2D"; an inline favicon replaces
  the request that 404'd on every load.

**Fixed**
- The headless canvas mock accepted any `drawImage` argument, which hid a crash
  that only a real canvas shows; it now rejects non-images like a browser does.

## v6 — the watch is 3D

The 2D canvas renderer had reached its ceiling: every surface knew its radius
and slope but never its height, so there could be no three-quarter view,
reflections were a 1-D lookup, and the side elevation had drifted to its own
proportions. The watch is now built in three.js from the same millimetre
geometry, and the 2D renderers live on as the artwork, thumbnails and textures.

**Added**
- **3D watch** (`core/three/`). Case, bezel, rehaut, crystal and caseback are
  lathed from the radial and thickness stacks; lugs, crown guards, crown and
  pushers extrude the outlines the 2D renderers draw; hands and applied indices
  (numerals included) are traced from silhouette bakes and extruded; straps are
  bands of real thickness curving down to the table. PBR materials come from
  the METALS table, the studio environment from the ENV table (no HDRI), and
  sunburst dials, flutes and knurling from generated anisotropy and normal maps.
- **Cameras**: front (editing, on the same 1 mm = 18 px sheet as before), ¾
  (orbit, click to select) and side (measured elevation over the caseback).
  `V` cycles them. Picking is a ray into the geometry.
- **Drag a diver or GMT bezel to turn it** — the UI always said so; it was
  never wired up.
- Chronograph registers have real hands on the running seconds, 30-minute and
  12-hour angles the clock already computed but nothing drew.
- Product render is live and orbitable; the design sheet, layered ZIP
  (front, ¾, profile, caseback) and PNG exports render from the same view, in
  GPU-sized tiles for large sizes.
- Renderer bake modes: `flat` (no painted light), `shape`, `lume`, `print`.
- `npm run refs`: reference renders of every theme through the export pipeline
  via the system Edge/Chrome (`playwright-core`), per camera.
- CI workflow (`.github/workflows/test.yml`) running `npm test` and the build.
- Narrow screens: the part controls (below 1100 px) and the parts list (below
  760 px) become drawers instead of scrolling the editor sideways.
- The stage draws only when something changes, or as often as the hands move.

**Changed**
- The single-file build is ~930 kB (256 kB gzipped), up from 304 kB, for
  three.js.
- An uploaded case, bezel, crown, hands or strap is shown face-on; the ¾ camera
  is unavailable while one is active.
- `render/profile.js` is gone: the side view and caseback are the 3D watch.

**Fixed**
- A diver's "CCW ratchet" only turned clockwise — the unsafe direction — both
  from the arrow buttons and the keyboard.
- Horn tips peaked 0.14 of their width short of the stated lug-to-lug in the
  drawing, so every design measured ~0.8 mm shorter than its spec sheet.
- Opening a share link replaced the visitor's autosaved design with no undo; it
  now asks, and keeps their design in Projects first.
- The last edit before closing the tab was lost (autosave debounce); renaming
  the project was never autosaved; deleting a project did not ask, and left its
  images in IndexedDB.
- The vault banner's Retry could never succeed; a missing upload showed a broken
  image; 'key out white' ignored PNG and SVG; the spec sheet crashed on an
  unknown metal and omitted the case architecture.
- A view crash blanked the whole page (error boundary); modals had no dialog
  semantics, Escape or focus handling; toasts were not announced; Ctrl+Y did
  nothing in presentation modes; a cancelled pointer left a drag latched.
- The leather backdrop was re-encoded as a PNG 60 times a second; preset
  thumbnails re-baked on every tick of a dimension slider.
- The crystal had two shape fields: `case.crystal` fed the thickness stack,
  `parts.crystal.variant` fed the drawings. `case.crystal` is now the only one;
  schema v6 migrates the old variant into it (what was drawn wins).
- `hydrate()` read a `__v` that nothing wrote, so every load re-ran the v4
  migration and a box crystal could never survive a reload. Autosave now
  writes `schemaVersion`; a missing one is inferred from shape.
- Box crystals now draw in the front view and the profile.
- Short lugs drew longer than the lug-to-lug the sheet printed (`geoOf` floors
  the exposed lug at R·0.1). `caseOf` and the slider share `lugLenMinOf`.
- Preset thumbnails bake through `procOpts`, so case thumbnails show pushers.
- smoke.mjs printed its hit-test results without checking them; combos.mjs set
  v4 fields nothing reads. Both now assert what they claim.

## v5 — case architecture, scene clock, rotating bezel, image vault

Feature parity work against the single-file v5 build, without collapsing the
module structure.

**Added**
- **Case architecture in millimetres** (`core/geometry.js`). A nested `case`
  object: thickness, lug length and drop, crystal height and profile, caseback,
  water resistance, movement, pushers, crown position. The thickness stack
  (caseback + mid-band + movement + dial + bezel + crystal) sums to the
  requested thickness exactly, and an impossible request is raised to the
  feasible minimum and flagged in the UI rather than drawn as fiction.
- **Pure scene clock** (`core/time.js`). `sceneClock(d, nowMs)` is the single
  time source for hands, date, GMT, chronograph and every export.
  `marketingClock(d)` freezes the 10:09:36 / day-28 pose for thumbnails and the
  design sheet.
- **Rotating bezel**. The insert is its own baked layer, so spinning it is a DOM
  transform. Real detents (60/120 diver, 24/120 GMT), CCW ratchet that refuses
  to run backwards past 12, bidirectional option. Arrow keys, `0` to reset.
- **Image vault** (`core/images.js`). Uploads live in IndexedDB; state keeps
  only `{id, name}`. A persistent banner — not a toast — reports an unreachable
  vault or a missing image.
- **Exports**: `export/zip.js` (STORE, hand-rolled CRC32), `export/layered.js`
  (per-part PNGs, both cameras at 2x, `spec.json`, `geometry.json`),
  `export/shareUrl.js` (base64url via TextEncoder, images excluded).
  Project files now embed their images.
- **Boot assertions** (`core/assertions.js`), run in dev and in CI via
  `npm run assert`. Ring-stack monotonicity, non-negative rehaut, thickness
  stack summation, lug-to-lug derivation, detent snapping, ratchet clamping,
  GMT angles, crown bearing, cache-key coverage, texture determinism.
- `SCHEMA_VERSION` + `migrateProject()`; v4 flat dimensions migrate into the
  nested `case`, preserving the saved lug-to-lug by inverting the formula.

**Fixed**
- `chronoElapsedMs` used `+c.start || nowMs`; `0` is falsy, so a real start
  timestamp became "now" and a running chronograph read zero forever.
- `png.js` computed its own angles from `new Date()` inside the export loop, so
  two exports of the same posed design differed. It now takes a clock.
- Export blur radii ignored the CTM, so shadows and lume glow came out 2x/4x
  tighter in the file than on screen.
- Baked textures (`NOISE`, `LEATHER`, brushed tile) drew on `Math.random`, so a
  part re-baked after cache eviction was not pixel-identical.
- `dimsKey` omitted every case-architecture field; parts rendered stale when a
  dimension slider moved.
- Undo history capped at 50, now 100.

**Known trade**
- Lug-to-lug is now derived from lug length rather than a `0.26 · R` fudge, so a
  new 40 mm default measures 47.2 mm where it used to report 50.4 mm. Saved
  projects keep their original number via migration.
- The ¾ camera from the v5 brief is **not** implemented. A three-quarter view
  faked in 2D canvas without a projection model reads as amateurish beside the
  orthographic front and profile drawings; shipping it would lower the quality
  bar the rest of the work sets. The profile camera is the supported second view.

## v4 — construction and materials

Rebuilt the renderer around real construction: annular depth stack
(case band → chamfer → bezel → rehaut → dial), a shared studio light rig with
per-surface finishes, applied indices with shadows, tapered lug horns with
drilled holes, product-render and design-sheet presentation modes.

_Older history archived._
