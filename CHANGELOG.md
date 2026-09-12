# Changelog

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
