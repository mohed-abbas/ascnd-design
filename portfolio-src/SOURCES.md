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

## branding — Figma "Design shortlist"

Same file key, section `89:240` (`BrandingTiles`).

| slug | Figma node | scale | export px | what it is | type |
|---|---|---|---|---|---|
| `keycap-mockup` | `56:124639` | 0.25 | 1024×768 | 3D keycap render | **misc** |
| `emerald-mark` | `55:124452` | 0.32 | 672×1008 | Emerald Psychiatry — wordmark poster | branding |
| `emerald-poster-mind` | `55:124453` | 0.32 | 672×1008 | "Your mind matters." | branding |
| `emerald-poster-help` | `55:124477` | 0.32 | 672×1008 | "It's okay to ask for help" — **pre-cropped, focus 0.85** | branding |
| `emerald-poster-ohio` | `55:124511` | 0.32 | 672×1008 | telehealth / "Serving all of Ohio" | branding |
| `elyv-logo` | `56:124811` | 0.25 | 943×943 | ElyV wordmark, white on orange | branding |
| `circle-mark` | `56:124824` | 0.25 | 943×943 | two-circle mark on periwinkle | branding |
| `cloth-tag-mockup` | `59:139748` | 0.3 | 1000×1000 | woven tag on blue fabric | **misc** |

The two marked **misc** are physical-object mockups — photographs *of* branding
rather than the branding itself — filed by the same rule as `monitor-mockup` in
the web set.

`emerald-poster-help` is the only image in the whole set that needs an
off-centre cut; see `CROPS` in `scripts/optimize-portfolio-images.mjs`.

## misc

Not yet exported. The remaining six `cloud-NN.webp` files are placeholders from
the Figma "Startup" collage and get replaced the same way.
