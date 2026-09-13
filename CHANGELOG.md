# Changelog

## Unreleased

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
