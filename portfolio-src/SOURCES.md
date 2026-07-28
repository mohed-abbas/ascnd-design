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
| `troxride-landing` | `20:7647` | 1 | 1440×4816 | TroxRide — **full-length landing page** (`grid.form: "tall"`) |
| `emerald-landing` | `20:334` | 3 → 1440w | 1440×8780 | Emerald Psychiatry — **full-length landing page** (`grid.form: "tall"`) |
| `opus-ventures` | `20:2263` | 2 → 1440w | 1440×14730 | Opus Ventures — **full-length landing page** (`grid.form: "tall"`) |

The three full-length pages are the exception to the "near 1300px on the long
side" rule above: they are exported at the frame's **natural 1440 width** and
left at full height, because the wall and the expand crop the same source
differently and the expand shows all of it (ADR §24, §29, §30).

⚠️ **A full-length frame cannot be pulled at scale 1.** Past roughly 4096px the
export service clamps the long side and the WIDTH collapses with it — asking for
`emerald-landing` at scale 1 returns 672×4096, well under the 900 the wall's
grid preset needs. Ask for **scale 2 or 3** (uncapped: 2880×29460 and 4320×26340
respectively) and downsample to 1440 wide locally:

```bash
node -e "require('sharp')('<export>.png',{limitInputPixels:false})
  .resize({width:1440,kernel:'lanczos3'}).png({compressionLevel:9})
  .toFile('portfolio-src/web/<slug>.png')"
```

Supersampling down is also sharper than a direct 1× export would have been.
Scale 2 is enough for any of these and costs a third of the bytes of scale 3;
go to 3 only if 2 comes back clamped. **Always check the `--dry` headroom
column afterwards** — `← source-limited` on a fresh full-length page means the
export was clamped, not that the artwork is small.

⚠️ **Ceiling: a source taller than ~16851px cannot be built at all.** The `full`
preset is 1400 wide, and WebP's hard maximum dimension is 16383, so
`1400 / (1440/H) > 16383` fails. It fails loudly — sharp throws *"Processed
image is too large for the WebP format"* — so this cannot ship silently, but a
longer design needs `FULL_MAX` lowered or the sheet split. `opus-ventures` at
14730 is 87% of the way there.

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

## misc — Figma "Design shortlist"

Same file key, section `89:241` (`Mics`). All device mockups.

| slug | Figma node | scale | export px | form | note |
|---|---|---|---|---|---|
| `phone-mockup-finance` | `51:4339` | 0.25 | 683×1024 | portrait | |
| `laptop-mockup` | `51:4512` | 0.4 | 689×1033 | portrait | |
| `desktop-mockup` | `52:4528` | 0.25 | 1024×768 | landscape | Pro Display XDR |
| `phone-mockup-fitness` | `52:112177` | 0.25 | 1024×768 | **portrait** | 4:3 source, portrait slot — see below |
| `tablet-mockup` | `52:103841` | 0.32 | 983×983 | square | iPad on sofa |

`phone-mockup-fitness` is the one place where the source aspect and the right
slot disagree: the frame is 4:3 but its subject is a vertical phone on black, so
the landscape slot would spend half the tile on empty background. `form` is
authored per project precisely so the slot can follow the subject rather than
the file.

With this batch the placeholder set is fully retired — every tile on the globe
is real work.
