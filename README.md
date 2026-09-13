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

- **Metal is lathed or extruded** (`core/three/lathe.js`): case, bezel, rehaut,
  crystal and caseback are solids of revolution from the two stacks; lugs,
  crown guards, crown and pushers use the outlines the 2D renderers draw.
- **Hands and applied indices are traced** (`core/three/tracer.js`): the 2D
  renderer bakes each silhouette, marching squares traces it back into
  outlines with holes, and it is extruded — five hand styles, five marker
  styles and serif numerals without writing any shape twice.
- **Colour is the existing artwork, unlit** (`core/render/*`, `mode: 'flat'`):
  dial printing, bezel inserts, straps and lume are baked without painted
  light and applied as textures, so all light and shadow is real.
- **Light is the studio the 2D engine described** (`core/three/studio.js`): the
  `ENV` table in `core/render/material.js` becomes a horizon band, a softbox
  and a table, prefiltered into an environment map. No HDRI file.
- **Surface detail is generated** (`core/three/surface.js`): sunburst and
  brushed dials use anisotropy maps; flutes and knurling are normal maps.

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
npm run refs       # pixel reference renders of every theme (drives Edge/Chrome)
```

`npm run refs -- --camera three-quarter` (or `side`, `back`) renders other
cameras; `--only diver,dress` limits the themes. The headless tests cannot see
pixels; these images are the check that does.

## Exports

- **PNG** at 2× or 4×, from the camera you are looking through.
- **3D model (.glb)** at real size, for Blender, product renderers and AR
  viewers. Posed at the set time (or 10:09), one node per part, the spec in the
  root node's extras.
- **Layered ZIP** — every part's artwork, every view, `spec.json`, `geometry.json`.
- **Spec sheet** (.txt), **project file** (.watchstudio.json, images embedded),
  **share link** (design only, no images).

## Without WebGL

If the browser has no WebGL 2 (hardware acceleration off, remote desktops,
older machines) or the GPU drops out and does not recover, WatchStudio shows a
flat 2D drawing instead, with a banner saying so. Designing, saving, sharing,
PNG and GLB export all still work; the ¾ and side views need WebGL. Add `?2d`
to the URL to force this mode.

## Publish online (GitHub Pages)

The build is a single self-contained `index.html`, so it can be hosted
anywhere static. The included workflow (`.github/workflows/test.yml`) tests
every push and publishes `main` to GitHub Pages. One-time setup:

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
│   ├── render/          2D renderers: thumbnails, artwork, textures for 3D
│   └── three/           lathe, tracer, surface, studio, uploads, watch, view
├── state/               store (undo/redo, autosave, projects, migrations), themes
├── export/              png, glb, flat 2D fallback, layered zip, spec, project file, share URL
└── ui/                  App shell, Stage (editor), WatchCanvas, Controls, Views…
```

## Controls

- **Front** (editing): drag a part to move it · Alt-drag rotates · drag a diver
  or GMT bezel to turn it · Shift+scroll scales · arrow keys nudge (Shift = 5×)
  · `[` `]` rotate · `1–8` select part · `F` fit
- **¾**: drag to orbit · click a part to select it · scroll to zoom
- **Side**: measured side elevation and caseback
- `V` cycles cameras · `0` resets the bezel · `Space` / `R` run and reset the
  chronograph · `Ctrl+Z` undo · `Ctrl+Shift+Z` / `Ctrl+Y` redo

An uploaded case, bezel, crown, hands or strap is a flat picture with no depth
to turn, so the ¾ camera is unavailable while one is in use.
