# Custom cursor

A white disc that follows the pointer and, on hover over an interactive element,
grows and turns into a small liquid-glass lens — the same `<GlassSurface/>`
displacement refraction used by the "why teams stay" pill.

> Replaces the fluid-simulation cursor (React Bits `SplashCursor`) and, before
> it, the curl-noise `cursor-trail` — both removed for being the page's dominant
> GPU cost (`docs/cursor-trail.md`, kept for history). This one is DOM + CSS +
> one reused SVG filter, with no per-frame loop.

**Code:** `components/cursor/`

- `cursor.tsx` — the device gate + mount decision (mirrors `cloud-layer.tsx`).
- `cursor-visual.tsx` — the follow + hover morph + the two visual layers.
- Mounted at the root in `app/layout.tsx`, last child inside `<LenisProvider>`.

## Gating (`cursor.tsx`)

Mounts only when **all** hold, resolved through `useSyncExternalStore` (server
snapshot `false`, so SSR renders nothing — the native cursor stays — and it
re-evaluates after hydration, no mismatch, reacting live to a mouse being
plugged in or a devtools device toggle):

- `hover: hover` **and** `pointer: fine` — a hover-morphing cursor is meaningful
  only on a real mouse; touch / coarse / no-hover devices get the native cursor.
- Screen wider than 768px.

Reduced-motion and low GPU tier do **not** gate here — the cursor still shows,
it just stays a plain white disc (see below).

## Behaviour matrix

| Context | Cursor |
|---|---|
| Chromium, capable tier, normal motion | white disc → hover: grows + **displacement glass** |
| Firefox / Safari, capable tier, normal motion | white disc → hover: grows + **clear glass** (rim + static chromatic ring, no displacement) |
| Low GPU tier (any browser) | **white disc only** — no morph |
| `prefers-reduced-motion` (any) | **white disc only** — no morph |
| touch / coarse / no-hover / ≤768px / SSR | **no custom cursor** (native stays) |

The Firefox/Safari clear-glass degradation is inherited for free from
`<GlassSurface/>`, which detects Gecko/WebKit (they render the `feImage` +
`feDisplacementMap` backdrop combo incorrectly) and drops displacement. Low tier
and reduced-motion don't render the glass layer at all — the plain disc follows.

### Why the tier is latched (not live)

The frame-watchdog (`lib/perf/frame-watchdog.ts`) is armed **only after the
intro docks** (`quality-controller.tsx`) and steps the tier down under sustained
load — the GPU-heavy intro can demote even a **capable** machine to `low`. A
live gate would then unmount the glass for the rest of the session: the cursor
shows glass for the first second, then permanently drops to the white disc
(the originally-reported "hover does nothing"). So `cursor-visual.tsx` captures
the tier **once**, at the initial gpu-tier pick (which always resolves before
the watchdog can fire), and ignores later step-downs — mirroring GlassSurface's
latch. A genuinely weak machine (initial pick `low`) still starts as the white
disc. The hover-only 44px lens is negligible GPU cost, so keeping it through a
demotion is safe.

## The performance design (why this one doesn't leak)

The heavy-effect contract (CLAUDE.md) — the cursor satisfies all five:

1. **No private rAF loop.** The follow is **event-driven**: each `pointermove`
   writes ONE composited transform (`gsap.quickSetter` → `translate3d`). Pointer
   still → no events → **zero work**. The only animation is the discrete hover
   morph, a short GSAP timeline on the *shared* ticker that completes and stops.
2. **Idles to zero.** At rest the glass layer is `visibility:hidden`
   (autoAlpha 0), so its `backdrop-filter` is never evaluated — displacement runs
   only while a hover morph is visible, over a ~44px region.
3. **Reads the tier.** `low` (and reduced-motion) drop to the plain disc; the
   glass is `<GlassSurface/>` (its own tier gate). Registered in
   `lib/perf/tiers.ts` in the same PR (the same-PR rule the SplashCursor
   regression violated). The decision is **latched to the initial gpu-tier
   pick** and frozen against the frame-watchdog — see below.
4. **SSR-stable.** Only mounted client-side by the gate; never renders on the
   server.
5. **dpr ≤ 1.5 (spirit).** No canvas; the tiny lens makes device-res backdrop
   raster negligible; no raw `devicePixelRatio`.

## Hover detection

Resolved by **hit-testing the layer stack** on `pointermove`
(`document.elementsFromPoint` → first element matching `a, button,
[role=button], input, textarea, select, label, summary, [data-cursor="glass"]`,
skipping any `[data-cursor="none"]` subtree), **not** `event.target`.

Why not delegated `pointerover`/`pointerout`: this page stacks full-viewport
WebGL canvases with `pointer-events:auto` (the intro/hero R3F canvas needs them
for rock-hover) OVER the DOM, so every `pointerover` targets the canvas and the
CTAs beneath it are never seen. `elementsFromPoint` returns every layer at the
point — including the DOM under the canvas — so the CTA is found (it sits a few
layers below the canvas in the returned stack). The cursor's own disc is
`pointer-events:none` and non-interactive, so it's skipped.

The hit-test runs only while glass is enabled and only on move (zero idle cost);
`data-cursor="glass"` opts extra targets in, `data-cursor="none"` opts out.

## The fixed-element constraint

Like `<Background/>` / `<CloudLayer/>`, the cursor is `position: fixed` and (in
its glass state) carries a `backdrop-filter`, so it **must not** sit under any
`filter` / `backdrop-filter` ancestor — a blurred ancestor breaks `position:
fixed` descendants (CLAUDE.md). That's why it's mounted at the root, as a
sibling of the fixed sky layers. Being the last child means it paints on top, so
its lens samples everything behind it.

## Hiding the native cursor

`cursor: none` is **not** global (that would strip the cursor from touch / no-JS
/ SSR users). `cursor-visual.tsx` sets `document.documentElement.dataset
.customCursor = "on"` after mount, and `globals.css` scopes the rule to
`html[data-custom-cursor="on"]`. Cleared on unmount → native cursor restored.

## Tuning

In `cursor-visual.tsx`: `DOT` / `LENS` diameters, the morph timeline
(scale/opacity/ease/duration), and the `<GlassSurface/>` props. `distortionScale`
is scaled down from the why-stay pill's `-180` to `-55` for the small lens (a
large scale shreds a tiny rim instead of bulging it) — tune against the pill's
look on the target machine with the DevTools FPS meter as ground truth.
