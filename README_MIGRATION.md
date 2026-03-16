# OEM System Stack React + Tailwind Migration

## Hardened QA status

This package includes a strict hardening pass over the initial React + Tailwind migration.

### What was fixed

- restored the required `public/data/nodes.csv` and `public/data/edges.csv` structure
- removed the misplaced `public_nodes.csv` file that would break runtime loading
- hardened CSV loading with fallback path handling and validation errors
- filtered invalid edges whose `source` or `target` no longer resolve to valid nodes
- made search and confidence filtering edge-aware instead of node-only
- fixed reset behaviour so it resets filters without unexpectedly changing the current tab
- added tooltip viewport clamping to prevent off-screen overflow
- tightened D3 cleanup so React Strict Mode does not leave stale SVG nodes behind
- added empty states for grid, network, and architecture views
- added a GitHub Pages workflow for repeatable static deployment
- added a simple data validation script to catch missing CSV assets before deploy

## Docs approach chosen

Docs remain in local Markdown files under `src/docs/`.

Why:

1. keeps the runtime shell smaller
2. prevents docs content from living inside one brittle script file
3. makes it easy to update methodology and interpretation notes without touching rendering logic
4. works cleanly in a static Vite build

## File structure

```text
public/
  data/
    nodes.csv
    edges.csv
src/
  components/
    Filters.jsx
    Header.jsx
    Legend.jsx
    Tabs.jsx
    ToggleBar.jsx
    Tooltip.jsx
  docs/
    architecture.md
    methodology.md
    overview.md
  lib/
    constants.js
    data.js
    useD3.js
    utils.js
  views/
    ArchitectureView.jsx
    DocsView.jsx
    GovernanceView.jsx
    GridView.jsx
    NetworkView.jsx
  App.jsx
  main.jsx
  styles.css
scripts/
  check-data.mjs
.github/workflows/
  deploy.yml
index.html
package.json
postcss.config.js
tailwind.config.js
vite.config.js
```

## Run locally

```bash
npm install
npm run check:data
npm run dev
```

## Build

```bash
npm run build
```

## GitHub Pages note

The current config uses:

```js
base: '/oem-system-stack/'
```

Keep that only if the repository name is `oem-system-stack`.
If the repo name differs, update `vite.config.js`.
