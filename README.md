# WatchStudio — 2D Wrist Watch Designer (v3, modular)

A part-by-part watch configurator: strap, case, bezel, dial, markers, hands,
crown and crystal — with procedural rendering, custom image uploads,
per-part transforms (drag directly on the canvas), themes, live clock,
and crisp PNG / spec-sheet / project-file export.

Materials are shaded by a shared engine (`core/render/material.js`): a studio
environment reflection (softbox overhead, dark walls at 3 and 9, floor bounce
at 6), anisotropic circular/linear graining for brushed finishes, Fresnel rim
light for polished chamfers, and per-material grain. Every reflection is built
from gradients rather than raster tiles, so it stays sharp when the PNG export
re-renders the scene at 2× or 4×. Materials: steel, rose/yellow gold, titanium,
black DLC, bronze, white ceramic and forged carbon.

Developed as a modular Vite project; **the build output is still ONE
portable HTML file** (via `vite-plugin-singlefile`).

## Commands

```bash
npm install        # once
npm run dev        # dev server with hot reload
npm run build      # → dist/index.html (single portable file)
npm run smoke      # headless validation of renderers/themes/export/UI
```

## Layout

```
src/
├── core/
│   ├── constants.js     canvas size, materials, backgrounds
│   ├── utils.js         math/color helpers, toast, roundRect polyfill
│   ├── parts.js         part catalog & variant names
│   ├── geometry.js      proportions, frames, hit-testing (pickPart)
│   ├── textures.js      noise, sheen, leather backdrop, finish textures
│   ├── cache.js         LRU caches for part canvases & thumbnails
│   ├── layers.js        state → ordered layer list
│   ├── time.js          clock math + live-time hook
│   └── render/          material.js (shading engine) + one module per part
├── state/
│   ├── store.js         state, undo/redo (drag coalescing), autosave, projects
│   └── themes.js        whole-watch themes + shuffle
├── export/
│   ├── png.js           hi-res PNG (re-rendered, not upscaled)
│   ├── spec.js          spec sheet (.txt)
│   └── projectFile.js   portable .watchstudio.json import/export
└── ui/
    ├── App.jsx, main.jsx
    ├── TopBar / PartsList / Controls / Stage / Modals
    └── primitives.jsx, upload.jsx, icons.jsx
```

## Controls

- Drag a part to move it · Alt-drag rotates · Shift+scroll scales
- Arrow keys nudge (Shift = 5×) · `[` `]` rotate · `1–8` select part · `F` fit
- `Ctrl+Z` undo · `Ctrl+Shift+Z` / `Ctrl+Y` redo
