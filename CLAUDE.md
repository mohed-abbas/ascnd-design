# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> The directive above is load-bearing: this is **Next.js 16** (App Router, Turbopack) with breaking changes from older versions. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next-specific code.

## Working conventions

- **Commits & PRs: no AI/Claude attribution.** Do not add `Co-Authored-By: Claude…`, "Generated with Claude Code", or any mention of AI tooling to commit messages or PR descriptions. Write them as a normal human author would.
- **The dev server is the user's to run.** Do not launch or stop a dev server yourself, and don't kill `next` processes or `rm -rf .next` on your own. Ask the user to start/stop/restart it. To verify a change works, ask them to run it (or to share output), rather than spinning up your own instance.
- **Plan mode is discussion mode until told otherwise.** When the user enters plan mode, treat it as a discussion: explore, explain, sketch (ASCII/diagrams), and clarify — but do **not** write or finalize a plan, and do **not** call `ExitPlanMode`, until the user explicitly says to (e.g. "make the plan"). Keep iterating on understanding until then.

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

A single-page marketing site for "ascnd" (a design-subscription product). `app/page.tsx` renders one thing: `<Hero/>`. All UI lives in `app/components/`. Layout is **Figma-driven** — components carry Figma node IDs in comments and use absolute pixel positioning mapped to a 1512×982 hero frame, so changes should be cross-referenced against the cited nodes.

Stack: Next 16 (App Router, Turbopack) · React 19.2 · Tailwind v4 (CSS-first, `@theme` in `globals.css` — no `tailwind.config.js`) · TypeScript · Three.js / R3F. Path alias `@/*` → repo root.

## Architecture — the layered rendering model

The non-obvious structure is how the **fixed sky** sits behind **scrolling content**, all driven by one scroll source. Read these together:

- **`app/layout.tsx`** mounts, at the root: `<LenisProvider>` wrapping `<Background/>` + page content.
- **`LenisProvider`** (`lenis-provider.tsx`) — the single global smooth-scroll instance. It hands its rAF to GSAP's ticker (`autoRaf: false`, `gsap.ticker.add(...)`, `lagSmoothing(0)`) and feeds `ScrollTrigger.update` on scroll. **One loop, no competing schedulers.** Everything scroll-driven (cloud parallax, future rock parallax) reads from this.
- **`Background`** (`background.tsx`) — a `fixed inset-0 -z-10` sky: solid `#62abff` fill → grain overlay (`public/textures/grain.png`) → `<CloudLayer/>`. Mounted once globally; content scrolls over it.
- **`CloudLayer` → `CloudCanvas`** — the volumetric WebGL clouds (see below).
- **`Hero`** and its children stack *above* the fixed background as transparent absolutely-positioned layers.

### ⚠️ The constraint that governs this whole layout

**No `filter` / `backdrop-filter` may appear on an *ancestor* of the fixed `Background`** — a blurred ancestor breaks `position: fixed` descendants. This is why `Background` is mounted at the root, not nested. The navbar/CTA `backdrop-blur` is fine because those are *siblings*, not ancestors. Cloud softness must come from the sprite's alpha, never a CSS blur on a parent. (Full rationale: `docs/cloud-rendering-research.md` §4 / §9.)

### Volumetric clouds (R3F)

`docs/cloud-rendering-research.md` is the **authoritative architecture decision record** for the sky — read §9 before touching clouds. **Cloud colour & lighting** (why white clouds rendered grey, the ACES `NoToneMapping` fix, and the key-light-vs-flat-ambient decision) is documented in `docs/cloud-color-and-lighting.md` — read it before touching the lights or material in `cloud-canvas.tsx`. The chosen path is `@react-three/drei` `<Clouds>`/`<Cloud>` with a strict optimization mandate:

- `CloudLayer` (`cloud-layer.tsx`) gates whether the canvas mounts at all: skipped on no-WebGL, `prefers-reduced-motion`, and `≤768px` screens, via `useSyncExternalStore` (server snapshot is `false`, so SSR renders the cheap fallback and re-evaluates after hydration — no mismatch). A baked static-image fallback for ineligible devices is a documented TODO.
- `CloudCanvas` (`cloud-canvas.tsx`) is loaded via `next/dynamic({ ssr: false })` (required — `ssr:false` can't live in a Server Component). It uses a single batched `<Clouds>` draw call, a **self-hosted** texture (`public/textures/cloud.png` — never the drei CDN default), `alpha:true` (clouds only; color/grain stay DOM), `antialias:false`, clamped `dpr`, and handles WebGL context loss/restore.
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
- Public assets: `public/rocks/` (hero cliff cutouts), `public/shots/` (design-collage images), `public/textures/` (`cloud.png` sprite, `grain.png`).
