# WatchStudio — Wrist Watch Designer

A part-by-part watch configurator: strap, case, bezel, dial, markers, hands,
crown and crystal. Rendered in 3D from real millimetre geometry, with custom
image uploads, per-part transforms (drag directly on the watch), themes, a
live clock and chronograph, and PNG / layered ZIP / spec sheet / project-file
export.

## How it is built

Every dimension lives in `core/geometry.js` in millimetres: the radial stack
(case, chamfer, bezel, rehaut, dial) and the thickness stack (caseback,
mid-case, movement, dial, bezel, crystal). The 3D watch is built from those
numbers and nothing else:

- **Metal is lathed or swept** (`core/three/lathe.js`, `casebody.js`): the case
  band (straight, drum, sloped or stepped), bezel, rehaut, crystal and caseback
  are solids of revolution from the two stacks, or lofts of the same profile
  around a cushion, octagon, square or tonneau outline (`core/caseshape.js`), where every inset
  of the outline keeps its shape. The lugs (straight, twisted, hooded, or an
  integrated shoulder the strap runs flush out of) and crown guards are swept
  solids that grow out of the case through fillets, standing a strap's width
  apart. The crown and pushers are lathed along their own axes.
- **Hands and applied indices are traced and ground** (`core/three/tracer.js`,
  `relief.js`): the 2D renderer bakes each silhouette, marching squares traces
  it back into outlines, and a height field over that outline gives it facets,
  a bevel or a dome, with the lume sunk into a channel — five hand styles,
  five marker styles and serif numerals without writing any shape twice.
- **Straps are swept solids** (`core/three/watch.js`): a padded, edge-rolled
  section follows the strap path, ending in a tail with holes at 6 o'clock and
  a buckle with keepers at 12. The flat bake is cut to the same outline
  (`geometry.js strapEndFactor`), so edges and stitching follow it.
- **Surfaces wear** (`core/three/wear.js`): generated, seamless textures add
  hairline scratches and haze to exposed metal (by the case's Wear setting),
  streaks to brushed finishes, and grain to leather, rubber and NATO straps.
- **Colour is the existing artwork, unlit** (`core/render/*`, `mode: 'flat'`):
  dial printing, bezel inserts, straps and lume are baked without painted
  light and applied as textures, so all light and shadow is real.
- **Light is the studio the 2D engine described** (`core/three/studio.js`): the
  `ENV` table in `core/render/material.js` becomes a horizon band, a softbox
  and a table, prefiltered into an environment map. No HDRI file.
- **Surface detail is generated** (`core/three/surface.js`): sunburst and
  brushed dials use anisotropy maps; flutes, knurling and register snailing are
  normal maps.
- **The dial is a plate** (`core/geometry.js dialLayoutOf`): a date window cut
  through it onto a turning date wheel, an optional stepped chapter ring, and
  chronograph registers milled into it. The 2D dial is painted from the same
  layout, so apertures and artwork agree.
- **Contact shading is real** (`core/three/ao.js`): ambient occlusion darkens
  where parts meet — indices on the dial, hands over it, bracelet joints.
- **Proportions follow watchmaking** (`core/geometry.js`):
  - **Hands:** each reaches what it reads: the seconds hand the edge of the
    minute track, the minute hand into it, the hour hand the inner end of the
    indices.
  - **Straps and bracelets:** cut to real lengths. A bracelet ends in fitted
    end links and a folding clasp.
  - **Dial parts:** date windows, registers and printing keep their sizes in mm
    (`DIAL_MM`).
  - **Clearances:** anything raised on the dial stands below the hands that pass
    over it, and a logo is drawn smaller rather than run into the printing, the
    date or the registers.
- **Glass and finish** (`lathe.js crystalSolid`, `materials.js zoneFinish`): the
  crystal is a solid of sapphire (flat, domed or box), with an optional cyclops
  over the date. A brushed case keeps polished bevels. A diver insert's scale is
  engraved, with a raised lume pip.
- **The movement is built** (`core/three/movement.js`): behind an exhibition
  caseback, bridges, jewels, a rotor and a balance swinging at the calibre's
  beat, sized to the thickness stack.

The same view (`core/three/view.js`) drives the editor, the product and sheet
presentations and every export, so what you see and what you export cannot
diverge. The build output is still **one portable HTML file** (via
`vite-plugin-singlefile`).

## Commands

```bash
npm install        # once
npm run dev        # dev server with hot reload
npm run build      # → dist/index.html (single portable file)
npm test           # boot invariants + smoke + combination checks (headless)
npm run e2e        # build, then drive the real app in a browser (e2e/)
npm run refs       # pixel reference renders of every theme (drives Edge/Chrome)
```

`npm run e2e` serves the built app and checks, in a real browser with WebGL and
touch input: the welcome gallery and quick start, tilting and editing, the
Wear setting, pinch and two-finger gestures on a phone, logo upload, AR (QR
hand-off, a Quick Look USDZ, a refused WebXR session), Photo, and a GLB that
passes the Khronos validator. It uses Edge on Windows and Chrome elsewhere
(`E2E_CHANNEL` to choose); `E2E_ONLY=touch,logo` runs a subset. WebGL is
software-rendered there, so a full run takes about ten minutes.

`npm run refs -- --camera three-quarter` (or `side`, `back`) renders other
cameras; `--only diver,dress` limits the themes. The headless tests cannot see
pixels; these images are the check that does.

## Exports

- **PNG** at 2× or 4×, from the camera you are looking through.
- **3D model (.glb)** at real size, for Blender, product renderers and AR
  viewers. Posed at the set time (or 10:09), one node per part, the spec in the
  root node's extras.
- **Layered ZIP** — every part's artwork, every view, `spec.json`, `geometry.json`.
- **Tech pack** (ZIP) — for a manufacturer to quote from:
  - a seven-sheet A4 PDF: cover, dimensioned front and side drawings, back
    drawing with the thickness stack, a parts list, the dial artwork with every
    element located, the bezel and the hands, and notes;
  - the dial, bezel and hands artwork as layered SVG at 1:1 in mm;
  - `spec.json`.

  The drawings are the 3D model itself (`export/lineart.js`), the artwork is
  the renderers' own drawing traced to outlines (`export/artwork.js`), and the
  PDF is written without a dependency (`export/pdf.js`).
- **Spec sheet** (.txt), **project file** (.watchstudio.json, images embedded),
  **share link** (design only, no images).

## Without WebGL

The watch is drawn only in 3D. If the browser has no WebGL 2 (hardware
acceleration off, remote desktops, older machines) or the GPU drops out and
does not recover, the stage says so in place of the watch, with how to fix it
and a retry. The design stays saved; saving, sharing and project files still
work, and the watch comes back as soon as 3D does.

## Publish online (GitHub Pages)

The build is a single self-contained `index.html`, so it can be hosted
anywhere static. The included workflow (`.github/workflows/test.yml`) tests
every push and publishes `main` to GitHub Pages once the tests and every group
of browser checks have passed, which takes about a quarter of an hour; a push
that fails any of them is not published. One-time setup:

1. Create an empty repository on GitHub (no README, so the first push is clean).
2. Push this project to it:
   ```bash
   git remote add origin https://github.com/<you>/watchstudio.git
   git push -u origin main
   ```
3. In the repository: **Settings → Pages → Build and deployment → Source:
   GitHub Actions**.
4. Re-run the workflow (**Actions → test and deploy → Re-run jobs**) or push
   again. The site appears at `https://<you>.github.io/watchstudio/`.

Designs autosave in each visitor's own browser; nothing is stored on a server.

## Layout

```
src/
├── core/
│   ├── constants.js     sheet size, materials, backgrounds
│   ├── geometry.js      millimetre construction, case architecture, bezel detents
│   ├── parts.js         part catalog & variant names
│   ├── cache.js         bakes (painted / flat / shape / lume / print) & thumbnails
│   ├── layers.js        per-part artwork list, clock angle table
│   ├── time.js          scene clock, chronograph
│   ├── render/          artwork painters (dial, markers, hands, bezel, strap, caseback): textures, silhouettes, artwork files
│   └── three/           lathe, tracer, surface, studio, uploads, watch, view
├── state/               store (undo/redo, autosave, projects, migrations), themes
├── export/              png, glb, tech pack, layered zip, spec, project file, share URL
└── ui/                  App shell, Stage (editor), WatchCanvas, Controls, Views…
```

## Controls

- **Front** (editing): drag a part to move it · Alt-drag rotates · drag a diver
  or GMT bezel to turn it · right-drag (or Ctrl-drag) tilts the watch up to 25°
  to look round it, easing back level on release · Shift+scroll scales · arrow
  keys nudge (Shift = 5×) · `[` `]` rotate · `1–8` select part · `F` fit
- **¾**: drag to orbit · click a part to select it · scroll to zoom
- **Back**: the watch turned over, and the movement behind an exhibition caseback
- **Side**: measured side elevation and caseback
- **Night** (or `N`): lights out, the lume glows
- **Product render**: drag to turn · pick a surface and a lens blur · **📷
  Photo** path traces a photo-quality still of the view, saved as a PNG
- **Touch**: drag a part to move it · pinch to zoom · two fingers to tilt the
  front view · the ☰ and ✎ tabs open the parts and the part's controls · ⋯
  holds saving and exports
- **AR**: on a phone, places the watch in the room at real size (Safari on
  iPhone and iPad via AR Quick Look, Chrome on Android via WebXR); on a
  computer, shows a QR code that opens the design on a phone
- `V` cycles cameras · `0` resets the bezel · `Space` / `R` run and reset the
  chronograph · `Ctrl+Z` undo · `Ctrl+Shift+Z` / `Ctrl+Y` redo

An uploaded case, bezel, crown, hands or strap is a flat picture with no depth
to turn, so the ¾ camera is unavailable while one is in use.
