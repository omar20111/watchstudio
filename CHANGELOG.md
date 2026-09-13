# Changelog

## Unreleased

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
