# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> The directive above is load-bearing: this is **Next.js 16** (App Router, Turbopack) with breaking changes from older versions. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next-specific code.

## Working conventions

- **Commits & PRs: no AI/Claude attribution.** Do not add `Co-Authored-By: Claude…`, "Generated with Claude Code", or any mention of AI tooling to commit messages or PR descriptions. Write them as a normal human author would.
- **The dev server is the user's to run.** Do not launch or stop a dev server yourself, and don't kill `next` processes or `rm -rf .next` on your own. Ask the user to start/stop/restart it. To verify a change works, ask them to run it (or to share output), rather than spinning up your own instance.
- **Plan mode is discussion mode until told otherwise.** When the user enters plan mode, treat it as a discussion: explore, explain, sketch (ASCII/diagrams), and clarify — but do **not** write or finalize a plan, and do **not** call `ExitPlanMode`, until the user explicitly says to (e.g. "make the plan"). Keep iterating on understanding until then.
- **Feature first, degrade later.** When building a new visual/interactive feature, implement exactly what was asked and make it work fully on capable desktop browsers (Chrome AND Firefox) **first** — do not wire in quality-tier gating, reduced-motion branches, or device fallbacks in the first pass. Add degradation only after the user has approved the working feature. In particular, a mid-session quality step-down (frame watchdog) must never swap out or freeze a feature the user is looking at — tier decisions for mounted features are locked at mount.
- **`main` is the production branch; `dev` carries the workshop.** The `/lab/*` tuning sandboxes, their leva panels and the sprite-writer API route live on `dev` only — they were removed from `main` on 2026-07-26. Provenance comments on `main` say "branch `dev`" where a value was tuned in a lab. **Merging `dev` → `main` will drag the labs back**: re-delete `app/lab/`, `app/api/lab/` and the `leva` dependency as part of that merge.
- **No debug query params on `main`.** Eleven `?param` A/B hooks (`?tier`, `?intropos`, `?noclouds`, `?tl=…`, …) used to read `window.location.search` in production with no env gate; they're gone. If you need a new one to tune something, add it on `dev`, or gate it behind `process.env.NODE_ENV !== "production"` so the production bundle strips it — the way `window.__quality` in `quality-controller.tsx` does.

## Commands

```bash
npm run dev      # Turbopack dev server on http://localhost:3000
npm run build    # production build
npm run start    # serve the production build
npm run lint     # eslint (next/core-web-vitals + next/typescript)
```

There is **no test runner configured** — no Jest/Vitest/Playwright, no test files. Don't invent test commands; verification is `lint` + `build` + manual browser check.

**Only one `next dev` may run per project dir** (Next 16 enforces this). A second instance exits, and concurrent servers sharing `.next/` can corrupt the cache → `SyntaxError: Unexpected end of JSON input` on startup. The recovery is to stop all `next` processes, `rm -rf .next`, and start one — but per the working conventions above, **ask the user to do this**; don't start/stop servers or delete `.next/` yourself.

## What this is

A single-page marketing site for "ascnd" (a design-subscription product). `app/page.tsx` composes the page sections (`<Hero/>`, `<Tagline/>`). UI lives in the root-level `components/` tree (see **Project structure** below). Layout is **Figma-driven** — components carry Figma node IDs in comments and use absolute pixel positioning mapped to a 1512×982 hero frame, so changes should be cross-referenced against the cited nodes.

Stack: Next 16 (App Router, Turbopack) · React 19.2 · Tailwind v4 (CSS-first, `@theme` in `globals.css` — no `tailwind.config.js`) · TypeScript · Three.js / R3F. Path alias `@/*` → repo root.

## Project structure

The chosen organization is **Approach A — colocated feature folders** (Next's documented "store project files outside `app`" strategy). `app/` is kept **purely for routing**; all non-routing code lives in a root-level `components/` tree, imported via the `@/*` alias. Cross-folder imports use `@/components/...`; same-folder imports stay relative.

```
app/                          # routing ONLY — keep this thin
  layout.tsx                  # root: <LenisProvider> → <Background> + page; site metadata + viewport
  page.tsx                    # composes the sections
  pricing/page.tsx            # the standalone pricing route
  not-found.tsx  error.tsx    # 404 + runtime-error UI (render inside the root layout)
  global-error.tsx            # root-layout failure — self-contained, inline-styled
  robots.ts  sitemap.ts       # generated from lib/site.ts
  opengraph-image.tsx         # share card, drawn with next/og
  globals.css  favicon.ico
  fonts/                      # self-hosted Product Sans (next/font/local)
components/
  background/                 # fixed sky: background, cloud-layer, cloud-canvas
  providers/                  # lenis-provider (global smooth-scroll)
  ui/                         # shared chrome/primitives: navbar, wordmark, icons, logo
  sections/                   # one folder per page section, self-contained
    hero/                     # hero, hero-text, hero-reveal, grass-rocks, rock*, …
    intro/                    # intro, intro-scene, intro-state (the shared reveal gate)
    logos/                    # logos, logos-marquee (client-logo marquee)
    design-shots/             # design-shots, design-shots-reveal
    tagline/                  # tagline
```

Conventions:
- **`app/` stays routing-only.** New routes go in `app/`; their UI is composed from `components/`. Don't add a flat `app/components/` dump back.
- **Sections are self-contained**, but cross-section imports are allowed in this approach (e.g. `hero/hero.tsx` is the page composer — it pulls in `ui/navbar`, `sections/logos`, `sections/intro`, etc.).
- **`sections/intro/intro-state.ts` is the shared animation gate.** It's imported by `intro`, `hero-reveal`, `rock-reveal`, and `design-shots-reveal` to keep the intro→hero cascade in sync — treat its path/contract as load-bearing.
- **Future Stripe / Cal.com (Next 16 idiom):** UI-triggered mutations are **Server Actions** colocated with their feature (e.g. `components/sections/pricing/checkout.action.ts` with `"use server"`); webhooks/external callbacks are **Route Handlers** under `app/api/**/route.ts`. Shared clients/env go in a root `lib/` (e.g. `lib/stripe/`, `lib/cal/`, `lib/env.ts`). Don't create a generic `server/` dumping ground.
- Promote to **Feature-Sliced Design** (layered `widgets/features/entities/shared` with enforced import direction) only if the product grows past ~20 features; Approach A's folders map cleanly onto it.

## Architecture — the layered rendering model

The non-obvious structure is how the **fixed sky** sits behind **scrolling content**, all driven by one scroll source. Read these together:

- **`app/layout.tsx`** mounts, at the root: `<LenisProvider>` wrapping two independent fixed layers — `<Background/>` (sky) and `<CloudLayer/>` (clouds) — plus page content.
- **`LenisProvider`** (`lenis-provider.tsx`) — the single global smooth-scroll instance. It hands its rAF to GSAP's ticker (`autoRaf: false`, `gsap.ticker.add(...)`, `lagSmoothing(0)`) and feeds `ScrollTrigger.update` on scroll. **One loop, no competing schedulers.** Everything scroll-driven (cloud parallax, future rock parallax) reads from this.
- **`Background`** (`background.tsx`) — a `fixed inset-0 -z-20` sky: solid `#62abff` fill → grain overlay (an **inline SVG `feTurbulence` data-URI**, ~0.8K in the bundle and zero network requests, so the grain paints with the first render even on a cold 3G load; it replaced a 514K `textures/grain.png`). Sky **only**; the clouds are a separate layer. Mounted once globally; content scrolls over it.
- **`CloudLayer`** (`cloud-layer.tsx`) — its **own** `fixed inset-0 -z-10` layer (a *sibling* of `Background`, not nested inside it), so the sky and clouds z-stack independently. It device-gates, then mounts `CloudCanvas` (see below).
- **`Hero`** and its children stack *above* both fixed layers as transparent absolutely-positioned layers.

### ⚠️ The constraint that governs this whole layout

**No `filter` / `backdrop-filter` may appear on an *ancestor* of the fixed `Background` or `CloudLayer`** — a blurred ancestor breaks `position: fixed` descendants. This is why both are mounted at the root, not nested. The navbar/CTA `backdrop-blur` is fine because those are *siblings*, not ancestors. Cloud softness must come from the sprite's alpha, never a CSS blur on a parent. (Full rationale: `docs/cloud-rendering-research.md` §4 / §9.)

### ⚠️ The heavy-effect contract (applies to vendored imports too)

Any **heavy effect** — a WebGL canvas, a free-running animation loop, a per-frame SVG/CSS filter — must satisfy ALL of these before it ships, **including third-party/vendored components** (React Bits, codepen ports, etc.). Two vendored drops (`splash-cursor.tsx`, `glass-surface.tsx`) each violated several of these and became the page's dominant GPU cost (see `docs/webgl-animation-audit-2026-07-02.md` F1/F2/F7):

1. **Rides the shared GSAP ticker** — no private `requestAnimationFrame` loop (LenisProvider's "one loop, no competing schedulers" mandate). Demand-mode R3F canvases (`frameloop="demand"` + `invalidate()`) also qualify.
2. **Idles to zero** — when nothing visibly changes (pointer still, effect faded, section off-screen), it must stop repainting entirely. "Renders an unchanged frame at 120 fps" is the failure mode this exists to prevent.
3. **Reads the quality tier** — its GPU-cost knobs (resolution, dpr, iterations, segments) come from `lib/perf/tiers.ts`, added to the consumer registry there **in the same PR** that introduces the effect. Repaint rates go through `heavyEffectFpsCap()` / `makeCappedInvalidate`.
4. **SSR-stable first render** — no browser sniffing (`CSS.supports`, `navigator.*`) in the render path; render a stable fallback and switch branches only after mount (`useSyncExternalStore` or a mounted flag), or hydration mismatches result.
5. **dpr ≤ 1.5** — never raw `devicePixelRatio` (deliberate site-wide cap; the soft/blurred nature of every effect here hides it).

A vendored file that can't satisfy these as-is gets **forked deliberately** (short header documenting the deltas) — "don't hand-edit vendored code" loses to the architecture contract.

### Volumetric clouds (R3F)

`docs/cloud-rendering-research.md` is the **authoritative architecture decision record** for the sky — read §9 before touching clouds. **Cloud colour & lighting** (why white clouds rendered grey, the ACES `NoToneMapping` fix, and the key-light-vs-flat-ambient decision) is documented in `docs/cloud-color-and-lighting.md` — read it before touching the lights or material in `cloud-canvas.tsx`. The chosen path is `@react-three/drei` `<Clouds>`/`<Cloud>` with a strict optimization mandate:

- `CloudLayer` (`cloud-layer.tsx`) gates whether the canvas mounts at all: skipped on no-WebGL, `prefers-reduced-motion`, and `≤768px` screens, via `useSyncExternalStore` (server snapshot is `false`, so SSR renders the cheap fallback and re-evaluates after hydration — no mismatch). A baked static-image fallback for ineligible devices is a documented TODO.
- `CloudCanvas` (`cloud-canvas.tsx`) is loaded via `next/dynamic({ ssr: false })` (required — `ssr:false` can't live in a Server Component). It uses a single batched `<Clouds>` draw call, a **self-hosted** texture (`public/textures/cloud-puff.png` — a *local copy of drei's detailed cloud sprite*, so the CDN is never hit at runtime), `alpha:true` (clouds only; color/grain stay DOM), `antialias:true`, `dpr` up to 2 (crisp on retina), and handles WebGL context loss/restore. **The sprite must be a detailed painted puff** — the legacy `cloud.png` (deleted) was a featureless radial blob, which made the cloud render as a washed-out blur with no form.
- Rendering is `frameloop="demand"` (per doc §9): no free-running rAF. Clouds have `speed=0` (static), so frames are painted only on change. `ParallaxRig` maps `ScrollTrigger` progress → each cloud group's `y` then `invalidate()`s; `InvalidateOnReady` pumps a short burst after mount (drei builds geometry/loads the texture over several frames, so one mount frame can paint blank) and repaints on tab re-show.
- **Context-loss resilience:** rely on `THREE.WebGLRenderer`'s built-in `webglcontextlost`/`restored` handling — do **not** add a manual `preventDefault()` handler (anti-pattern; leaks across Fast Refresh and was the cause of the clouds vanishing). `ContextWatchdog` only repaints on restore and, if a real driver reset never restores within ~3s, remounts the `<Canvas>` via a `key` bump. `frustumCulled={false}` on `<Clouds>` stops the InstancedMesh (stale bounding sphere under parallax) from being culled.

## Fonts

**Product Sans is the global default font.** Wiring spans two files:

- `layout.tsx` loads fonts via `next/font`: Product Sans self-hosted with `next/font/local` from `app/fonts/*.ttf` (→ `--font-product-sans`), Instrument Serif and Geist Mono from `next/font/google`. Each font's `.variable` class is applied to `<html>`.
- `globals.css` (`@theme inline`) maps those to tokens: `--font-sans` and the `--font-product` alias both resolve to Product Sans; `body` uses `var(--font-sans)`, so everything inherits Product Sans without an explicit class. `font-instrument` → Instrument Serif (the italic-feel hero accent); `font-mono` → Geist Mono.

Note: Product Sans is Google's proprietary corporate typeface — a licensing consideration, flagged in the source comments.

## Config notes

- `next.config.ts` pins `turbopack.root` to `__dirname` so Next doesn't infer the workspace root from a stray lockfile higher up the tree.
- `reactStrictMode: false` is **intentional** — Strict Mode's dev-only double-mount creates/destroys the WebGL cloud context within ~100ms, making the clouds flicker on load. Production never runs Strict Mode, so this makes dev match prod. Don't re-enable globally; wrap non-WebGL subtrees in `<React.StrictMode>` if you want the dev checks back.
- Public assets: `public/rocks/` (hero cliff cutouts + the testimonial GLB), `public/shots/` (design-collage images), `public/portfolio/`, `public/cards/`, `public/footer/`, `public/timeline/`, `public/clouds/sprites/` (the baked mobile cloud sprites), `public/textures/cloud-puff.png` (the detailed cloud sprite). Everything in `public/` is reachable from code — an asset nothing references is a bug, not an archive; keep the raw sources outside the repo.
- `next.config.ts` sets long-lived `Cache-Control` on the `public/` image directories. **Adding a new asset directory means adding it to `imageDirs` there**, or every file in it pays a 304 revalidation round-trip on each visit.
