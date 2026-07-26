# ascnd

The marketing site for **ascnd** — a design and front-end subscription. One page
of scroll-driven WebGL over a live sky, plus a standalone `/pricing` route.

Production: [ascnd.design](https://ascnd.design)

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) · React 19.2 |
| Styling | Tailwind v4, CSS-first — `@theme` in `app/globals.css`, **no `tailwind.config.js`** |
| 3D | Three.js · React Three Fiber · drei |
| Motion | GSAP + ScrollTrigger, Lenis smooth-scroll |
| Language | TypeScript, path alias `@/*` → repo root |

## Getting started

```bash
npm install
npm run dev      # Turbopack dev server → http://localhost:3000
```

Only **one** `next dev` may run per project directory — Next 16 enforces this,
and two instances sharing `.next/` will corrupt the cache. If startup fails with
`SyntaxError: Unexpected end of JSON input`, stop every `next` process,
`rm -rf .next`, and start one.

| Script | What it does |
|---|---|
| `npm run dev` | dev server (Turbopack) |
| `npm run build` | production build |
| `npm run start` | serve the production build |
| `npm run lint` | ESLint (`next/core-web-vitals` + `next/typescript`) |
| `npm run optimize:portfolio` | re-encode the portfolio globe imagery |

**There is no test runner.** No Jest, Vitest or Playwright suite exists — don't
infer one from the `playwright` devDependency (it's used for ad-hoc scripted
capture, not tests). Verification is `lint` + `build` + a manual browser pass.

## Layout

`app/` is routing only; all UI lives in the root-level `components/` tree.

```
app/            routes, metadata, robots/sitemap/OG, error + 404 UI
components/     background · canvas · cursor · providers · ui · sections/*
lib/            site constants, perf tiers, theme palette, flags
docs/           architecture decision records — read before touching WebGL
public/         fonts, textures, cloud sprites, rock cut-outs, imagery
```

Read `CLAUDE.md` before making structural changes — it documents the layered
rendering model (fixed sky behind scrolling content, one shared GSAP ticker, one
shared WebGL canvas host) and the constraints that keep it working. The
non-negotiable ones:

- **No `filter` / `backdrop-filter` on any ancestor of the fixed background
  layers** — a blurred ancestor breaks `position: fixed` descendants.
- **Every heavy effect idles to zero**, rides the shared ticker, reads the
  quality tier, and caps `dpr` at 1.5.

`docs/` holds the reasoning behind the cloud rendering, colour/lighting, canvas
consolidation and performance work. Those are decision records — check them
before reversing something that looks arbitrary.

## Branches

- **`main`** — production. No sandboxes, no debug query params.
- **`dev`** — the workshop. Carries the `/lab/*` tuning routes and their leva
  panels. **Merging `dev` into `main` re-introduces them**: drop `app/lab/`,
  `app/api/lab/` and the `leva` dependency as part of any such merge.

## Deploying

Hosted on Vercel. `docs/hosting-vercel-and-domain.md` records the plan analysis
and the exact DNS steps for pointing `ascnd.design` at it.

Set `NEXT_PUBLIC_SITE_URL` per environment so canonical, OG and sitemap URLs
describe the deployment they're on; it defaults to the production origin.

## Fonts

Product Sans is the global default, self-hosted from `app/fonts/`. It is
**Google's proprietary corporate typeface** — a licensing question that needs
answering before launch, not a settled one. Instrument Serif (hero accent) and
Geist Mono come from `next/font/google`.
