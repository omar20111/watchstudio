# Changelog

## Unreleased — safety net, one crystal, 3D spike

**Added**
- `npm run refs`: pixel reference renders of every theme through the real
  export compositor, byte-reproducible, via the system Edge/Chrome
  (`playwright-core`, no browser download). `--renderer 3d --view
  front|three-quarter` renders the 3D spike the same way. The headless tests
  mock the canvas, so this is the only check that looks at pixels.
- CI workflow (`.github/workflows/test.yml`) running `npm test` and the build.
- **3D spike (dev builds only).** `core/three/` lathes the case, bezel, rehaut,
  caseback and crystal from `geoOf()` + `thicknessStack()`; dial, indices,
  insert and hands are the existing 2D bakes as textures. The studio
  environment is built from the `ENV` table rather than an HDRI. A `2D · 3D ·
  3D ¾` toggle sits top-right of the stage in `npm run dev`; the production
  bundle contains none of it. combos.mjs asserts the head's apex equals the
  case thickness and its rings follow the radial stack.

**Fixed**
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
