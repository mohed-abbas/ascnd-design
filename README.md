```text
                 .                                      *
            .-~~~-.                     .                          .
    .- ~ ~-(       )_ _                                 .-~~-.
   /                    ~ -.                     .-~~-(      )-.
  |                         \        +          (                )
   \                       .'                    `-.________.-'
     ~- . ___________ . -~                 .
                                                                 +

                                                         ██
                                                         ██
                ▄██████  ▄██████  ▄██████  ██████▄  ▄██████
                ██   ██  ██▄▄▄▄   ██       ██   ██  ██   ██
                ██   ██   ▀▀▀▀██  ██       ██   ██  ██   ██
                ▀██████  ██████▀  ▀██████  ██   ██  ▀██████

             your design and front-end team, without the hiring

       \ | /    '                                            '    \ | /
     ,,\\|//,, ,,                                            ,, ,,\\|//,,
    ▄▟████████▙▄▄▖                                        ▗▄▄▟████████▙▄
   ▟███████████████▙▄                                  ▄▟███████████████▙
```

<div align="center">

**The marketing site for ascnd — a design and front-end subscription.**
<br>
One page of scroll-driven WebGL over a live sky, plus a standalone `/pricing` route.

<br>

[![Next.js](https://img.shields.io/badge/Next.js-16-0b1d33?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.2-62abff?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![Three.js](https://img.shields.io/badge/Three.js-R3F_·_drei-0b1d33?style=flat-square&logo=threedotjs&logoColor=white)](https://r3f.docs.pmnd.rs)
[![GSAP](https://img.shields.io/badge/GSAP-ScrollTrigger-62abff?style=flat-square&logo=greensock&logoColor=white)](https://gsap.com)
[![Tailwind](https://img.shields.io/badge/Tailwind-v4-0b1d33?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Vercel](https://img.shields.io/badge/hosted_on-Vercel-62abff?style=flat-square&logo=vercel&logoColor=white)](https://ascnd.design)

**[ascnd.design](https://ascnd.design)**

</div>

<br>

## ☁ Contents

- [Preflight](#-preflight) — install and run
- [Flight controls](#-flight-controls) — npm scripts
- [Layers of the sky](#-layers-of-the-sky) — how the page is stacked
- [Weather rules](#-weather-rules) — the constraints that keep it flying
- [The map](#-the-map) — where things live
- [Times of day](#-times-of-day) — sky modes and quality tiers
- [Ground crew](#-ground-crew) — branches and deploys
- [Fonts](#-fonts)
- [Logbook](#-logbook) — decision records in `docs/`

<br>

## ✈ Preflight

```bash
npm install
npm run dev      # Turbopack dev server → http://localhost:3000
```

> [!WARNING]
> Only **one** `next dev` may run per project directory. Next 16 enforces this,
> and two instances sharing `.next/` corrupt the cache. If startup fails with
> `SyntaxError: Unexpected end of JSON input`, stop every `next` process,
> `rm -rf .next`, and start a single one.

<br>

## 🎛 Flight controls

| Script | What it does |
|---|---|
| `npm run dev` | dev server (Turbopack) |
| `npm run build` | production build |
| `npm run start` | serve the production build |
| `npm run lint` | ESLint (`next/core-web-vitals` + `next/typescript`) |
| `npm run optimize:portfolio` | re-encode the portfolio globe imagery |
| `npm run presets:portfolio` | rebuild the portfolio globe presets |

> [!NOTE]
> **There is no test runner.** No Jest, Vitest or Playwright suite exists. The
> `playwright` devDependency is for ad-hoc scripted capture, not tests.
> Verification is `lint` + `build` + a manual pass in the browser.

<br>

## 🌤 Layers of the sky

The page is a fixed sky with content scrolling over it. Everything that moves
with the scroll reads from **one** source: a single Lenis instance that hands its
frame loop to GSAP's ticker.

```text
   z
   ▲
   │  61  ┌──────────────────────────────────────────────┐
   │      │ FRONT plane · intro tiles, rock-base clouds  │  WebGL, fixed
   │      └──────────────────────────────────────────────┘
   │      ┌──────────────────────────────────────────────┐
   │      │ page content · Hero → Tagline → Cards → …    │  DOM, scrolls
   │      │ … → Pricing → Faq → FinalCta → Footer        │
   │      └──────────────────────────────────────────────┘
   │   0  ┌──────────────────────────────────────────────┐
   │      │ MID plane · testimonial GLB rocks            │  WebGL, fixed
   │      └──────────────────────────────────────────────┘
   │ -10  ┌──────────────────────────────────────────────┐
   │      │ REAR plane · volumetric sky clouds           │  WebGL, fixed
   │      └──────────────────────────────────────────────┘
   │ -20  ┌──────────────────────────────────────────────┐
   │      │ Background · sky gradient + SVG grain        │  DOM, fixed
   │      └──────────────────────────────────────────────┘
   │
   └─ LenisProvider ──► gsap.ticker ──► ScrollTrigger.update
                one loop, no competing schedulers
```

The WebGL planes come from `SharedCanvasHost` (`components/canvas/`): one canvas
per plane, mounted only while some section has registered a view on it, so a
page with no views downloads no three.js and creates no GL context. The sky
`Background` and the cloud layer are **siblings** mounted at the root in
`app/layout.tsx`, never nested.

<br>

## ⛈ Weather rules

Read [`CLAUDE.md`](CLAUDE.md) before making structural changes. The
non-negotiables:

1. **No `filter` / `backdrop-filter` on any ancestor of the fixed background
   layers.** A blurred ancestor breaks `position: fixed` descendants. Navbar and
   CTA blur are fine because they are siblings, not ancestors. Cloud softness
   comes from the sprite's alpha, never a CSS blur.
2. **Every heavy effect** (WebGL canvas, animation loop, per-frame filter),
   vendored code included:
   - rides the shared GSAP ticker, with no private `requestAnimationFrame`
   - idles to zero when nothing visibly changes
   - reads its GPU knobs from the quality tier in `lib/perf/tiers.ts`
   - renders an SSR-stable first frame, with browser sniffing only after mount
   - caps `dpr` at **1.5**
3. **`sections/intro/intro-state.ts` is the shared animation gate** for the
   intro → hero cascade. Its path and contract are load-bearing.

<br>

## 🗺 The map

`app/` is routing only. All UI lives in the root-level `components/` tree,
imported through the `@/*` alias.

```text
app/                    routes, metadata, robots / sitemap / OG, error + 404 UI
  pricing/  terms/  privacy/  refunds/
components/
  background/           the fixed sky: gradient, cloud layer, cloud canvas
  canvas/               the shared WebGL canvas host and its views
  cursor/               custom cursor
  providers/            lenis · theme driver · quality controller · cal.com
  ui/                   navbar, wordmark, buttons, glass surface, rocks, icons
  sections/             one self-contained folder per page section
    intro/  hero/  tagline/  cards/  why-stay/  pills/  working-with/
    portfolio/  comparison/  testimonials/  pricing/  faq/  final-cta/  footer/
lib/
  site.ts               name, URL, tagline, indexable routes
  perf/                 quality tiers, GPU tier, frame watchdog
  theme/                sky palettes and mode store
docs/                   decision records (read before touching WebGL)
public/                 textures, cloud sprites, rock cut-outs, imagery
scripts/                image optimisation and rock-asset generation
```

<br>

## 🌅 Times of day

**Sky modes.** Four times of day, defined once in `lib/theme/palette.ts`:
`sunrise` · `day` (the default, brand blue `#62abff`) · `sunset` · `night`. Each
mode sets the DOM sky gradient **and** the light on the clouds, and both
crossfade together. The chosen mode persists in `localStorage`.

**Quality tiers.** `high` · `medium` · `low`, defined in `lib/perf/tiers.ts`.
A tier sets the GPU-cost knobs: cloud `dpr` and segment count, the intro
glass's samples and resolution, and whether the comparison aura and the
testimonial rocks animate at all. The starting tier comes from a GPU probe; a
frame watchdog can step down the list, but a tier is **locked once a feature
mounts**, so a step-down never swaps out an effect someone is looking at.

<br>

## 🛬 Ground crew

**Branches**

- **`main`**: production. No sandboxes, no debug query params.
- **`dev`**: the workshop. It carries the `/lab/*` tuning routes, their leva
  panels and the sprite-writer API route.

> [!CAUTION]
> **Merging `dev` into `main` brings the labs back.** Delete `app/lab/`,
> `app/api/lab/` and the `leva` dependency as part of any such merge.

New debug `?param` hooks belong on `dev`, or behind
`process.env.NODE_ENV !== "production"` so the production bundle strips them.

**Deploying**

Hosted on Vercel. [`docs/hosting-vercel-and-domain.md`](docs/hosting-vercel-and-domain.md)
records the plan analysis and the DNS steps for `ascnd.design`.

Set `NEXT_PUBLIC_SITE_URL` per environment so canonical, OG and sitemap URLs
describe the deployment they are on. It defaults to the production origin.

<br>

## 🔤 Fonts

| Font | Role | Source |
|---|---|---|
| Product Sans | global default | self-hosted, `app/fonts/` |
| Instrument Serif | italic hero accent | `next/font/google` |
| Geist Mono | monospace | `next/font/google` |

> [!IMPORTANT]
> Product Sans is **Google's proprietary corporate typeface**. Its licensing
> needs answering before launch; it is not settled.

<br>

## 📓 Logbook

`docs/` holds the reasoning behind the rendering and performance work. They are
decision records: check them before reversing something that looks arbitrary.

| Start here | For |
|---|---|
| [`cloud-rendering-research.md`](docs/cloud-rendering-research.md) | the sky architecture (§9 is the decision) |
| [`cloud-color-and-lighting.md`](docs/cloud-color-and-lighting.md) | why white clouds rendered grey, and the lighting fix |
| [`canvas-consolidation-plan.md`](docs/canvas-consolidation-plan.md) | the single shared WebGL canvas |
| [`performance-audit.md`](docs/performance-audit.md) | the frame-rate targets: 120 fps on capable displays, a 60 fps floor |
| [`webgl-animation-audit-2026-07-02.md`](docs/webgl-animation-audit-2026-07-02.md) | why the heavy-effect rules exist |

<br>

```text
          .                       ^                       .
                 let's get you off the ground
```
