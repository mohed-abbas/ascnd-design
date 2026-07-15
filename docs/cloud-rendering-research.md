# Cloud Rendering & Parallax — Research & Architecture Decision

**Status:** Decided — **amended 2026-06-23 to volumetric Three.js / R3F clouds (see §9)**. Pending implementation.
**Date:** 2026-06-23
**Owner:** ascnd-design
**Scope:** Site-wide animated sky background (color + grain + parallax clouds), driven by Lenis + GSAP ScrollTrigger.

---

## 1. Context & goal

The hero (and eventually the whole site) sits on a sky background. We want:

- A **site-wide sky**: one global `position: fixed` background layer (solid color + grain) behind all content, consistent across every section.
- **Clouds as multiple depth layers** that move with **scroll-driven parallax** — *not* autonomous ambient drift. "Layer N translates at speed X as the user scrolls."
- Parallax driven by **Lenis** (smooth scroll) + **GSAP ScrollTrigger** (already chosen).
- Clouds that are **easy to animate** and ideally **easy to generate or source** (start with Figma PNG exports, want a better long-term pipeline).
- Correct layering: clouds sit **behind foreground elements** (e.g. the hero rock cutouts), which render above them.
- **Performance-sensitive** — this is a full-viewport fixed background present on every page.

### Stack
- Next.js 16 (App Router, Turbopack), React 19.2.4, Tailwind v4, TypeScript.
- Already built: hero with `Background` (currently `#62abff` fill + grain overlay), `Rock` cutouts, `DesignShots`, `HeroText`, `Logos`, `Logo`, `Wordmark`, `Navbar`.

---

## 2. Architecture discussion & decisions (history)

### 2.1 Component boundaries
**Decision:** split into two components rather than one monolith.

- **`Clouds`** — presentational + parallax-aware. Renders the cloud image layers and moves each based on scroll. Reusable on its own.
- **`Background`** — thin composition: solid color + grain + `<Clouds/>`. This is what sections drop in.

**Why:** clouds are the thing with *behavior* (parallax). Isolating that keeps `Background` declarative and lets `Clouds` be reused independently.

### 2.2 Global vs per-section background
**Decision:** **global single fixed Background**, mounted once at the root (`fixed inset-0`), because the sky is consistent across the whole site (confirmed by product owner). Content scrolls over it; sections needing a different look paint their own opaque background above it.

- Gives **continuous parallax** down the whole page for free (no per-section coordination).
- The component boundaries (`Clouds`, `Background`) are identical whether mounted globally or per-section, so this is **not a lock-in** — can localize later.

### 2.3 Scroll source
**Decision (non-negotiable):** **one global Lenis scroll source.** Parallax reads from a single Lenis instance so motion is consistent regardless of where `Background` is mounted.

### 2.4 Confirmed product decisions
- ✅ The sky is the **same across the whole site**.
- ✅ Cloud assets start as **Figma PNG exports** to get the layout right; want a better generation/sourcing pipeline long-term.
- ✅ **Multiple depth layers** of clouds across different sections.
- ✅ OK to add **`lenis` + `gsap`** dependencies + a root client provider, "complete industry-standard setup."
- ✅ **Rocks stay static for now**, but eventually get scroll parallax too — the `Clouds`/parallax API should leave room for this without rework.
- ✅ Reduced motion → parallax frozen (static positions).

### 2.5 Open decision that triggered the research
The product owner asked whether we could find a **library to generate or get cloud assets that animate easily**. Prior recommendation (before research): layered images/SVG now, swappable renderer, avoid WebGL/generative until proven necessary. The research pass below was run to verify this against current (2026) options.

---

## 3. Research findings (2026-06-23)

All version/license/download data from the npm registry API; bundle sizes from Bundlephobia; behavior/maintenance notes cited inline.

### 3.1 Verified package facts

| Package | Latest | Last publish | License | Weekly DL | Bundle (min+gzip) |
|---|---|---|---|---|---|
| `@react-three/drei` | 10.7.7 | 2025-11-13 | MIT | ~3.17M | **484.6 KB gzip** (whole lib; tree-shakeable per-import) |
| `three` | 0.184.0 | 2026-04-16 | MIT | ~12.0M | **177.7 KB gzip** (core does not effectively tree-shake) |
| `@react-three/fiber` | 9.6.1 | 2026-04-28 | MIT | — | 49.7 KB gzip |
| `vanta` | 0.5.24 | **2022-09-16** | MIT | ~27.7k | n/a (needs three/p5 as global) |
| `tsparticles` | 4.2.1 | 2026-06-19 | MIT | ~106k | 38.1 KB gzip (+ plugins) |
| `lottie-react` | 2.4.1 | 2025-01-22 | MIT | — | 77.9 KB gzip |
| `@rive-app/react-canvas` | 4.29.2 | 2026-06-23 | MIT | — | 47.0 KB gzip |
| `lenis` | 1.3.23 | 2026-04-15 | MIT | ~1.04M | — (chosen) |
| `gsap` | 3.15.0 | 2026-04-13 | "no charge" std license (now free incl. all plugins) | ~3.94M | — (chosen) |

> Realistic R3F cloud stack = three (178) + fiber (50) + the drei `Clouds` slice. The 484 KB drei figure is the **entire package**; per-path imports ship a fraction, but **three.js dominates and won't tree-shake well** — budget **~230–280 KB gzip** for a minimal R3F cloud scene.

### 3.2 Per-option evaluation

#### 1. Layered transparent PNG/WebP cutouts, parallaxed via CSS transforms — ⭐ RECOMMENDED STARTER
- **Renders as:** plain DOM `<img>`/`<div>`; transform animated on the GPU compositor.
- **Deps/maintenance/license:** zero dependency, zero version risk, no license.
- **Next 16 App Router:** trivial. Layers are pure markup (Server-Component-safe); only the ScrollTrigger wiring is client. No hydration/SSR concerns.
- **Lenis + GSAP ScrollTrigger:** *ideal*. `gsap.to(layer, { y: …, scrollTrigger: { scrub: true } })` scrubs `translate3d` directly. No competing animation loop — GSAP fully owns the transform. Canonical parallax pattern.
- **Art direction:** total — whatever the designer painted. Matches a specific look perfectly (Figma exports already are this).
- **Performance:** best-in-class for a persistent fixed background. `transform`/`opacity` are compositor-only (no layout/paint), near-zero idle CPU, no WebGL context, no battery drain. Use WebP/AVIF + `will-change: transform` sparingly, limit to ~3–6 layers.
- **Scroll-parallax suitability:** purpose-built. Depth = one layer per speed.
- **Verdict:** the correct default — cheapest, fastest, most art-directable, fights nothing.

#### 2. SVG procedural clouds via `feTurbulence` + `feGaussianBlur` — ⭐ RECOMMENDED UPGRADE/COMPLEMENT
- **Renders as:** SVG filter (Perlin noise → blur), no image assets, resolution-independent.
- **Deps/maintenance/license:** native browser feature, zero deps.
- **Next 16:** trivial, SSR-safe, inline SVG.
- **Lenis + GSAP:** parallax the *containing layer's* transform exactly like option 1 — fully scrubbable. **Do not** animate `baseFrequency`/`seed` per scroll frame — filter re-rasterization is expensive. Generate the texture once, then translate the layer.
- **Art direction:** good for soft/wispy/haze/grain (matches the "solid + grain" sky beautifully), but harder to hit a *specific designed silhouette* than a painted PNG. Best for atmosphere/mist and the grain layer.
- **Performance:** cheap **if static** (rasterized once). Animating filter params live, or very large blur radii full-viewport, gets costly.
- **Verdict:** excellent zero-asset generator for haze/grain/procedural depth fills — pair with PNGs, don't replace them.

#### 3. `@react-three/drei` `<Clouds>`/`<Cloud>` (R3F volumetric sprites) — situational, heaviest
- **Renders as:** WebGL. `<Clouds>` batches the material; `<Cloud>`s are billboarded soft particle sprites.
- **Maintenance:** very healthy — drei 10.7.7 (Nov 2025), fiber 9.6.1 (Apr 2026), three 0.184.0 (Apr 2026), all MIT. **Requires React 19** (drei peer `react: ^19`) — we're on 19.2.4 ✓.
- **Bundle:** heaviest by far — ~three (178) + fiber (50) + drei slice → **~230–280 KB+ gzip**. A WebGL context for a *background* is a large fixed cost.
- **Next 16 App Router:** needs `"use client"`; the `<Canvas>` must be `next/dynamic` with `ssr:false` to avoid SSR/hydration issues. Non-trivial.
- **CDN gotcha:** the default `<Cloud>` texture historically loads from a third-party CDN (githack) and drei docs warn it's "not for production" — must **self-host and pass `texture`**.
- **Lenis + GSAP:** the friction point. R3F runs its **own rAF loop**. To make clouds scroll-driven: `frameloop="demand"` + `invalidate()` from Lenis's scroll callback, driving cloud/camera position from `ScrollTrigger` progress (zero out `<Cloud>`'s `speed`/drift). Doable, but bending a library built for autonomous motion into a scrubbed system.
- **Performance:** continuous WebGL is worst for battery; `frameloop="demand"` fixes idle cost but a persistent full-viewport canvas + context is still the heaviest baseline. Community guidance: often disable scrolling WebGL on mobile.
- **Art direction:** great for *volumetric/god-ray/true-3D depth*, real parallax-by-camera. But matching a *specific flat designed cloud* is harder than just shipping that PNG.
- **Verdict:** overkill unless you specifically want volumetric 3D clouds; designed for autonomous drift, must be tamed for scrub, heaviest bundle + WebGL on every page.

#### 4. Vanta.js `CLOUDS` — ❌ do not use
- **Renders as:** WebGL (three.js) full-screen effect with its own internal animation loop.
- **Maintenance:** **abandoned** — v0.5.24, last published **September 2022** (~4 years).
- **Lenis + GSAP:** worst fit. Vanta **owns its loop and animates autonomously**; not a scroll-scrubbed depth-layer system. Can't do "layer N at speed X on scroll." Contradicts the core requirement.
- **Next 16:** client-only, manual `three` global wiring, awkward in App Router.
- **Verdict:** disqualified — abandoned, autonomous-motion model, no per-layer scroll parallax.

#### 5. Pure CSS clouds (gradients + blur) — fallback/accent only
- **Renders as:** DOM `<div>` with radial gradients + `filter: blur()`.
- **Deps/maintenance/license:** zero deps, native.
- **Lenis + GSAP:** layer transform scrubs fine (same as option 1).
- **Critical caveat:** **`filter: blur()` / `backdrop-filter` on an ancestor breaks `position: fixed` descendants** — a real hazard given our fixed sky layer. Keep blur off any ancestor of fixed content; keep blur radius < ~20px on large surfaces / mobile GPUs.
- **Art direction:** limited — soft blobs, hard to hit a designed shape.
- **Verdict:** fine for cheap soft accents/atmosphere, not for art-directed hero clouds; watch the fixed+blur pitfall.

#### 6. Others considered
- **tsParticles 4.2.1** (MIT, active, 38 KB): canvas particle system. Great for snow/stars/motes, but an *autonomous emitter*, not scroll-scrubbed depth layers — wrong model (better maintained than Vanta though). Not recommended.
- **Rive (`@rive-app/react-canvas` 4.29.2, 47 KB)** / **Lottie (`lottie-react` 2.4.1, 78 KB)**: play *timeline* animations. Can be driven by scroll progress, so technically support scrubbed clouds, but they're built for designed-motion playback, add a runtime + authoring-tool dependency, and don't beat PNG layers on a static-parallax requirement. Overkill.
- **Spline:** heavy WebGL scene runtime, same battery/bundle objections as R3F with less control. No.
- **`@takram/three-clouds`:** high-fidelity volumetric three.js clouds — more specialized/heavier than drei. Only for photoreal volumetrics. No for a landing bg.

---

## 4. Decision

### Ranked recommendation
1. **Layered transparent PNG/WebP cutouts + GSAP ScrollTrigger transforms** — **starter and likely permanent answer.** Zero deps, fastest, most art-directable, perfect Lenis+GSAP fit, no WebGL/battery cost, SSR-clean. Start with Figma PNG exports directly.
2. **`feTurbulence`/`feGaussianBlur` SVG (static, translated as a layer)** — **upgrade/complement** for procedural haze, mist, grain, and depth fills without image weight. Generate once, parallax the container.
3. **CSS gradient+blur** — cheap atmospheric accents only; mind the `filter` breaks-`fixed` pitfall.
4. **drei `<Clouds>`** — only if we decide we want genuine *volumetric 3D* clouds and accept the bundle/WebGL/mobile cost + demand-loop wiring.
5. ❌ **Vanta** (abandoned + autonomous); tsParticles/Lottie/Rive/Spline (wrong model or overkill).

### ⚠️ Critical constraint that touches existing code
**`filter: blur()` / `backdrop-filter` on an *ancestor* breaks `position: fixed` descendants.**
- The global fixed sky `Background` **must have no blurred ancestor** → mount it at the **root**, not nested inside any `backdrop-blur` container.
- The navbar and CTAs use `backdrop-blur` — fine, because they are **siblings/descendants**, not ancestors of the fixed bg.
- Cloud softness must come from **pre-baked soft alpha in the asset**, not a CSS blur on a parent of fixed content.

### Final architecture
```
LenisProvider (root, "use client")           ← single smooth-scroll + GSAP ticker sync
  Background (root, fixed inset-0, NO blurred ancestor)
    └ solid #62abff → grain → <Clouds/>       ← 3–6 WebP layers (+ optional feTurbulence haze)
  page content (hero rocks/text… above bg) → nav (top)
Clouds: layers:[{ src, depth, x, y, scale, opacity }] → one ScrollTrigger scrub tween per layer
prefers-reduced-motion → parallax frozen
```

### Industry-standard Lenis + GSAP setup (to implement)
- Init Lenis once in a root `"use client"` provider.
- Sync with GSAP: `lenis.on('scroll', ScrollTrigger.update)`, `gsap.ticker.add((t) => lenis.raf(t * 1000))`, `gsap.ticker.lagSmoothing(0)`.
- One `ScrollTrigger` with `scrub: true` per cloud layer, setting `y`/`x` at different speeds (depth).
- Clean up on unmount.

---

## 5. Asset generation / sourcing

The make-or-break detail: clouds need **soft, semi-transparent edges** — exactly where one-click background removers fail (hard cutouts kill the alpha gradient).

- **AI route:** mainstream models are RGB-only (no alpha) — Midjourney/FLUX/DALL·E. **Recraft** is the exception (native transparent PNG) but its upscale flattens transparency. Practical workflow: generate clouds **on flat black (or magenta)**, then recover alpha mathematically — a **luminance-to-alpha / screen matte** (Photoshop/GIMP, or a tool like Transparify) preserves soft edges far better than magic-wand removal.
- **Stock (fastest):** Pngtree, Vecteezy, FreePNGimg, Resource Boy cloud textures. **Verify each license individually** — many require attribution or a paid tier for commercial use.
- **Procedural (zero-asset, best long-term):** `feTurbulence` + `feGaussianBlur` + `feColorMatrix` → infinite tileable cloud/haze textures, fully controllable, never licensed. For hero shapes, **Blender volumetric clouds rendered to transparent PNG sprite sheets** is the highest-quality custom route.
- **Recommendation:** ship now with **Figma/stock WebP layers**; build the long-term pipeline on **`feTurbulence` for atmosphere/grain + Blender-or-AI-on-black-bg for hero silhouettes**, recovering alpha via luminance matte rather than hard background removal.

---

## 6. Next steps / open items

- [ ] Install `lenis` + `gsap`; add root `LenisProvider` with GSAP ticker sync + cleanup.
- [ ] Refactor current hero background into a global, root-mounted `Background` (fixed, no blurred ancestor): `#62abff` → grain → `<Clouds/>`.
- [ ] Build `Clouds` with a layer API (`layers:[{ src, depth, x, y, scale, opacity }]`) + one ScrollTrigger scrub tween per layer; `prefers-reduced-motion` → frozen.
- [ ] Get the **hero cloud PNG(s)** into `public/` (start from Figma node 103:5) with intended **depth order (back→front)** to map parallax speeds.
- [ ] Convert cloud PNGs → WebP for weight.
- [ ] (Later) leave hooks to parallax the **rocks** without rework.
- [ ] (Later) evaluate `feTurbulence` haze layer once base parallax is in.

---

## 7. Caveats / could not fully verify
- Exact tree-shaken gzip of a *minimal* drei `Clouds` import isn't published; ~230–280 KB is modeled (three+fiber are the floor; three doesn't tree-shake well). Measure in-bundle to confirm.
- Bundlephobia's 484 KB is the **whole drei package**, not the `Clouds`-only slice.
- Stock-site commercial licenses change; confirm per asset before shipping.

## 8. Sources
- drei: npm `@react-three/drei`, drei `Cloud` docs, drei issues #631 / #1666
- R3F: scaling-performance docs, `frameloop=demand` discussion #1884, 14islands `r3f-scroll-rig`
- Vanta: npm `vanta`, Snyk advisor
- SVG/CSS: MDN `feTurbulence`, CSS-Tricks "Drawing realistic clouds with SVG and CSS", MDN `backdrop-filter`, Josh Comeau `backdrop-filter`
- Integration: devdreaming "Next.js smooth scrolling with Lenis + GSAP"
- three tree-shaking: three.js discourse thread
- Assets: Transparify "AI image transparent background", Resource Boy cloud textures, Vecteezy free cloud PNG
- Version/download/size figures: npm registry API + Bundlephobia API

---

## 9. Decision amendment (2026-06-23) — volumetric R3F clouds chosen

**Decision:** Override the §4 recommendation. We will implement **volumetric clouds with Three.js / React Three Fiber** (`@react-three/drei` `<Clouds>`/`<Cloud>`), optimized aggressively.

**Why (rationale, for the record):**
- The product owner wants the genuine **volumetric, dimensional cloud look** that flat layered sprites cannot achieve. The art-direction goal outweighs the bundle/perf cost that made layered images the default recommendation.
- This is a deliberate, informed trade-off: we accept the ~230–280 KB gzip WebGL stack and the integration complexity (documented in §3.2 option 3) in exchange for the look, and commit to mitigating that cost via the optimization mandate below.

**Optimization mandate (non-negotiable for this path):**
1. **`frameloop="demand"`** — render only on scroll/parallax change (driven by Lenis) or an explicit invalidate; never a free-running rAF, no render when idle.
2. **Batch via the `<Clouds>` instanced wrapper** (single draw call) — never standalone `<Cloud>`s.
3. **Self-host the cloud sprite texture** (pass `texture`); never the drei default CDN.
4. **Transparent canvas** (`alpha:true`) drawing **only clouds** — keep solid color + grain as cheap DOM layers behind it.
5. `antialias:false`, **`dpr` clamped** (e.g. `[1, 1.5]`), minimal lights, no shadows.
6. **Adaptive quality** (`PerformanceMonitor` / regress on scroll) + clamp.
7. **Mobile / low-power / `prefers-reduced-motion` / no-WebGL → static baked cloud image fallback** (no canvas mounted).
8. **`next/dynamic` with `ssr:false`**; lazy/idle mount.

**Layering unchanged:** the WebGL canvas is a low-z DOM element inside the fixed root `Background`; DOM content (rocks, collage, text, nav) stacks above it as before. The §4 critical constraint still holds — **no `filter`/`backdrop-filter` ancestor over the fixed bg**.

**Cloud colour & lighting:** how the clouds get their bright, dimensional white (the grey-clouds investigation, the ACES tone-mapping fix, and the key-light vs flat-ambient decision) is documented separately in [`cloud-color-and-lighting.md`](./cloud-color-and-lighting.md).

**Revised implementation plan (handed off 2026-06-23):**
1. Install `three` + `@react-three/fiber` + `@react-three/drei` (+ `lenis` + `gsap`); verify React 19 peer compat.
2. Root `LenisProvider` (`"use client"`) + GSAP ticker sync + cleanup.
3. Refactor hero bg → global root-mounted `Background` (fixed, no blurred ancestor): `#62abff` → grain → cloud canvas.
4. `CloudCanvas` — `next/dynamic` `ssr:false`, transparent `<Canvas frameloop="demand" dpr={[1,1.5]} gl={{antialias:false, alpha:true}}>`, batched `<Clouds>` + self-hosted texture, minimal lights.
5. Scroll-parallax controller — map Lenis/ScrollTrigger progress → cloud depth groups, `invalidate()` on change (no continuous `useFrame` for parallax).
6. Optimization pass — `PerformanceMonitor`/regress, dpr clamp, mobile + reduced-motion + no-WebGL fallback to a static baked cloud image, measure bundle + FPS.
7. Match Figma cloud placement (node 103:5) for the hero; source/host a soft cloud sprite; tune `segments`/`volume`/`bounds`/color to the design.
8. Verify (lint, build, browser, perf), commit, push.

**Note:** §1–§8 are retained verbatim as the decision history — the analysis that led to "layered images as default" still stands; this section records the informed override and the conditions attached to it.

---

## 10. Scroll axis — `perspectiveScroll` toggle (2026-07-04)

The static camera looks down ~31° (`[0,11,18]` → origin). The field rigs translate clouds along **world-Y** on scroll, but under that tilt world-Y has a component along the view axis — so a rising cloud also moves **toward the lens and swells**. That swell is now an opt-in, not a given.

Per-cloud flag `perspectiveScroll` (`cloud-specs.ts`) selects the travel axis:

- **unset → FLAT (default):** travel along the **camera-up axis** (`matrixWorld` column 1), which is perpendicular to the view direction → pure screen-vertical motion at **constant size**. Calibrated by `viewportUpSpan()` (the full world length of the viewport's vertical edge at `REF_DIST`, both endpoints equidistant from the camera).
- **`true` → PERSPECTIVE:** travel along **world-Y** (the original behaviour) → rises **and swells**. Calibrated by `viewportWorldHeight()` (world-Y span) as before.

Implementation (`cloud-canvas.tsx`): field clouds are split into two wrapper groups (perspective / flat), each with its own `<ScrollAnchorRig>` + `<CloudPlacement>` parameterized by `perspective`. `anchorVh` is baked along the matching axis so a cloud still reaches its rest spot at the right scroll. The perspective path is byte-for-byte the prior code, so existing clouds are unchanged. Current assignment: hero `top-right` + `rock-left`/`rock-right` are `perspectiveScroll: true` (kept swelling); the section-anchored sky clouds (`cards-br`, `whystay-br`) are flat.

**Scope:** both paths honour the flag. Field clouds (`ScrollAnchorRig`) and section-bound clouds (`SectionRig`, dormant until a `section` cloud is added) pick their slide/travel axis from `perspectiveScroll` the same way, so the two behave consistently whenever section clouds return.

---

## 11. Section-cloud motion — continuous drift vs. docking hold (2026-07-12)

The two final-CTA corner clouds (`finalcta-tl`/`finalcta-br`) reopened how a **section-bound** cloud should move across its section's scroll crossing. `SectionRig` (`cloud-canvas.tsx`) originally used a **slide → HOLD → slide** curve; in use it felt wrong — the slide-in was compressed into a *fixed* 0.7vh (too fast), and the motionless middle (`d = 0`) read as the cloud being **pinned** to the section. The wanted feel: "nice and slow to reach position, then keep floating past."

Three ways to change it were evaluated (none touch `anchorVh`, which is the *field*-cloud path and already drifts continuously):

| | **A — Data-only (big `slide`)** | **B — Monotonic curve (chosen)** | **C — Opt-in `hold` flag (future)** |
|---|---|---|---|
| Change | Set `slide: 100` on the bind | ~5 lines in `SectionRig.apply()` | Add `hold?: boolean` to `SectionBind` + branch |
| Code change | None | Small | Small + API surface |
| Keeps section-anchoring | ✅ | ✅ | ✅ |
| Removes the "pinned" hold | ✅ | ✅ | ✅ when `hold:false` |
| Constant drift speed | ⚠️ settles at centre | ✅ | ✅ |
| Can still dock/pin | ❌ | ❌ | ✅ (`hold:true`) |

**Option A** exploits the existing `slide = Math.min(slidePx, total/2)` clamp: a large `slide` saturates to `total/2`, so slide-in fills the first half and slide-out the second — hold gone. But each half still uses `smoothstep`, which decelerates to ~0 velocity *at* rest, so a subtle settle/pause remains at centre. Zero-code, but not a true constant drift.

**Option B — IMPLEMENTED (2026-07-12).** `SectionRig.apply()` now maps the crossing with a single linear function of scroll progress:

```
d = -1 + 2 * self.progress   // progress 0 → -1 (travel below rest)
                             // progress 0.5 → 0 (rest, section centred)
                             // progress 1 → +1 (travel above rest)
off = d * travel
```

Constant velocity, no hold: the cloud drifts slowly up, passes through its `ndc` rest spot exactly when the section is centred, and keeps floating out — the `anchorVh` field-cloud feel, but triggered by the section element (no viewport-height counting, robust to reordering). The old `slide`/`smoothstep`/`clamp01`/`hold` code was removed; `SectionBind.slide` is now **reserved** (unused) for Option C. `travel` (default 1vh) still tunes how far the cloud sweeps to each side of rest — raise it for a longer, slower drift. `perspectiveScroll` still selects the drift axis (§10).

**Option C — FUTURE (leaning toward it).** Reintroduce the docking hold as an **opt-in**, not the default: add `hold?: boolean` to `SectionBind` (default `false`). `false` → Option B's continuous curve; `true` → the original slide → HOLD → slide (fixed-`slide` ease-in, motionless middle spanning any pin, ease-out), which is the right choice for a cloud that should **pin beside a genuinely pinned section** (e.g. why-stay). This keeps continuous drift as the default feel while making `bind.slide` live again for the docking path. Cost: one flag + a restored branch + a doc line.

**Independent knobs (stack on any option):** `travel` (sweep distance), `scrub: <number>` on the ScrollTrigger (currently `true` → 1:1; a number adds easing lag for a softer track), and — for B/C — a non-linear `d` ease (`power1`) if a gentle slow *near* centre is wanted without a full stop.
