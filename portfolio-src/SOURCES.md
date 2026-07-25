# Portfolio globe — image sources

Uncropped Figma exports for the tiles in `public/portfolio/cloud/`. This folder
sits at the repo root, **outside `public/`**, so these multi-hundred-KB PNGs are
never served — they exist only so a tile can be re-cropped or re-encoded without
another trip through Figma.

Pipeline: export here → copy into `public/portfolio/cloud/<slug>.png` → run
`npm run optimize:portfolio` (downscales to ≤520px, converts to WebP, removes the
PNG) → add/adjust the entry in
`components/sections/portfolio/cloud-canvas/cloud-canvas-data.ts`.

## web — Figma "Design shortlist"

File key `AlJwKmp1F8MmaViAh75vuu`, section `82:239` (`webdesigns`).
Re-pull one with `download_assets({ fileKey, nodeId, defaultFormat: "png", defaultScale })` —
the scales below land each frame near 1300px on the long side.

| slug | Figma node | scale | export px | what it is |
|---|---|---|---|---|
| `monitor-mockup` | `51:4521` | 0.25 | 1024×768 | monitor on a studio pedestal (filed under **misc**, not web) |
| `tasktrox-landing` | `52:17437` | 0.25 | 1318×989 | Tasktrox landing page |
| `tasktrox-webapp` | `59:126209` | 0.2 | 1231×923 | Tasktrox to-do web app; keeps the "ascnd's product" glass headline |
| `operations-dashboard` | `59:128049` | 0.25 | 1162×872 | order/inventory dashboard |
| `kalinka` | `52:4530` | 0.25 | 1366×768 | Kalinka — orange samurai hero |
| `crypkit` | `52:28088` | 0.17 | 1308×736 | CrypKit — dark crypto dashboard |
| `performance-consultancy` | `59:129281` | 0.23 | 1310×737 | "Perfecting Performance" landing |
| `crypto-scratchers` | `52:113866` | 0.25 | 1366×768 | decentralized crypto scratchers |
| `medlink` | `52:112121` | 0.25 | 1339×1005 | Medlink — "Your Health, Simplified" |
| `fashion-storefront` | `55:124634` | 0.23 | 1324×745 | fashion e-commerce product page |
| `dubai-blueprint` | `59:127617` | 0.17 | 1342×755 | Dubai Blueprint — Burj Khalifa |

Names for `operations-dashboard`, `performance-consultancy`, `crypto-scratchers`
and `fashion-storefront` are **descriptive, not brands** — those designs carry
icon-only marks with no wordmark, so there was nothing to read off them.

## branding, misc

Not yet exported. The remaining `cloud-NN.webp` files are placeholders from the
Figma "Startup" collage and get replaced the same way.
