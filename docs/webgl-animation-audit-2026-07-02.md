# WebGL & Animation Audit — 2026-07-02

**Scope:** every WebGL surface (intro liquid glass, volumetric clouds, fluid cursor, tile conveyor), the DOM liquid-glass reel (why-stay), the GSAP/Lenis animation layer, and site architecture.
**Goal (stakeholder):** sustained **120 fps on capable displays**, hard **60 fps floor** everywhere (including reduced-motion), clouds renderable on mobile — without losing the current look.
**Method:** full static read of the current source + live runtime profiling (Playwright against the running dev server, rAF frame-timing + long-task observer + canvas inventory), cross-referenced against the three prior audits (`performance-audit.md`, `intro-loader-performance.md`, `gsap-audit.md`) and the commits that landed since them.
**Status: diagnosis only — no code was changed.**

---

## 1. Executive summary

The earlier audits' fixes genuinely landed (tiered MTM at 384/8/no-backside, intro frame cap, cloud dpr 1.5, idle-gated card loops, GSAP `quickSetter` fixes). **But two features added *after* those audits re-broke the architecture, and they are the dominant cost today:**

1. **The React Bits SplashCursor** (`components/cursor/splash-cursor.tsx`, commit `942db22`) replaced the old tier-aware, idle-gated cursor trail with a vendored fluid solver that **runs its own free-running `requestAnimationFrame` loop, never idles, renders at full DPR 2, and ignores the entire `lib/perf` quality system**. Every hard-won invariant the previous audit established for the cursor — one shared scheduler, idle = 0 GPU, tier-scaled resolution, 60 fps cap — was silently lost in the swap. It burns ~27 draw calls/frame at 120 Hz forever, even with a motionless pointer.

2. **The why-stay liquid-glass pill** (`components/ui/glass-surface.tsx`, commit `e60e352`) drives a `backdrop-filter: url(#svg-filter)` with **three `feDisplacementMap`s + two `feBlend`s + `feGaussianBlur`** over a scroll-scrubbed, *pinned* text reel — so the full SVG filter chain re-rasterizes on every scrolled frame. **Measured: ~40 fps average through the pin, worst frame 358 ms.** It also causes a React hydration mismatch (server renders the no-backdrop fallback, client renders another branch).

The measured state (Playwright, dev server, `low` tier active):

| Scenario | avg fps | p50 | p95 | worst | long tasks |
|---|---|---|---|---|---|
| Idle at hero (no input) | 67.6 | 16.6 ms | **25.0 ms** | 33.3 ms | 0 |
| Pointer moving | 64.3 | 16.6 ms | 25.1 ms | 33.3 ms | 0 |
| **Why-stay pinned scrub** | **39.9** | 19.6 ms | **33.4 ms** | **358.5 ms** | 0 |
| Intro window (per-second) | 68→120→**75** | — | 16.7 ms | 41.6 ms | 0 |

Zero long tasks in every scenario ⇒ the bottleneck is still **GPU/compositor**, not JS. The intro's own glass window now holds the main thread fine; the dip the user perceives at "glass text loaded" has two parts: (a) the GPU-bound MTM present-rate drop that rAF profiling *cannot see* (documented ground truth: ~33 fps presented while rAF read 120 — only the DevTools FPS meter shows it), and (b) a **measured 120→75 fps main-thread drop in the dock/handoff second**, when `INTRO_REVEAL_EVENT` mounts the SplashCursor (≈10 shader compiles + sim start + a 4th WebGL context) at the exact moment the hero cascade, SplitText reveal, and rock crossfade run.

**Headline conclusion:** the site's own architecture rule — *"one shared rAF; every loop idles when unseen; every heavy effect reads the quality tier"* — is correct and was proven to work. The two new features simply aren't following it. Bring them into the contract (or replace them with contract-compliant equivalents) and the 120/60 goal is reachable; leave them out of it and no amount of tier tuning elsewhere will get there, because **the two biggest consumers are the two that can't be turned down.**

---

## 2. Findings — ranked

### F1 — CRITICAL — SplashCursor: free-running, never idles, full-res, tier-blind

**Where:** `components/cursor/splash-cursor.tsx:699-708` (own `requestAnimationFrame(updateFrame)` loop), `:718-727` (full `devicePixelRatio` sizing), `:24` (`DYE_RESOLUTION = 1440`), `:29` (`PRESSURE_ITERATIONS = 20`).

**Mechanism.** Every displayed frame, unconditionally: curl → vorticity → divergence → pressure-clear → **20 Jacobi pressure iterations** → gradient-subtract → velocity advection → dye advection → shaded display composite ≈ **27 full-screen blits**. The dye double-buffer is RGBA16F at ~2217×1440 (≈51 MB of RTs). On a 120 Hz panel that's ~3,240 draw calls/sec **while the page is completely idle** — the dissipation constants mean the dye fades to invisible within ~1 s of the pointer stopping, after which 100 % of this work produces a visually black, unchanging canvas.

**Violations of the site's own architecture:**
- Second rAF scheduler competing with the GSAP ticker (lenis-provider mandate).
- No idle gate (the R2 fix from the prior audit — previously shipped, lost in the swap).
- Canvas at raw `devicePixelRatio` (2), while every other surface was deliberately capped at 1.5 (`6422516`).
- Reads nothing from `lib/perf` — `tiers.ts:28-30` still documents `cursorRtScale` for `cursor-trail-canvas.tsx`, **a file that no longer exists**. The watchdog's step-down (the "60 fps floor" mechanism) cannot reach the page's single heaviest consumer. Measured proof: the profiling session sat at tier `low` and idle p95 was still 25 ms.
- `dt = Math.min(dt, 1/60)` (`:713`) also means the sim time-dilates below 60 fps, so on a struggling machine the trail additionally moves in slow motion.

**Remediation (keep the exact look):**
1. **Idle-gate the loop.** Track "pointer moved recently" + "dye energy above epsilon" (a cheap proxy: time since last splat vs `DENSITY_DISSIPATION`). When idle: stop stepping *and* stop rendering; re-enter on `pointermove`. Idle page → **0 GPU**. This is the single biggest sustained win, same as R2 was.
2. **Ride the shared GSAP ticker** instead of a private rAF, and apply `heavyEffectFpsCap()` (60 on 120 Hz panels) — the sim is a soft dye trail; 120 Hz simulation is invisible.
3. **Re-wire the tier system:** `DYE_RESOLUTION` 1440 → ~1024/768/512 by tier (it's a blurred dye field — 1440 is far past visual threshold), display canvas capped at dpr 1.5, `PRESSURE_ITERATIONS` 20 → 12 on lower tiers (visually identical for a decorative trail).
4. Housekeeping: the file is vendored "don't hand-edit" — either **fork it deliberately** (it's already the site's hottest loop; it must obey the architecture) or wrap it (mount/unmount on an idle detector from outside). Forking with a short header documenting the deltas is the honest option; an external wrapper can only achieve the idle gate (via unmount), not the fps cap/tiers, and unmount/remount costs shader recompiles.
5. **Defer the mount past the handoff frame.** It currently mounts exactly on `INTRO_REVEAL_EVENT` — the busiest frame of the session (hero cascade + SplitText + rock crossfade + wordmark fade). Mounting on `requestIdleCallback` after the reveal (or first `pointermove`) removes the measured 120→75 dip without any visible difference (the pointer is under a fading intro anyway).

**Approach alternative (if restructuring is on the table):** the previous custom trail (curl-noise glow) obeyed all the rules and was already tuned; the fluid look is richer but is the most expensive decorative element per visible pixel on the site. A middle path: keep the fluid sim but run it at `SIM_RESOLUTION 64 / DYE 512 / dpr 1` — fluid dynamics are resolution-forgiving, and A/B at those numbers usually reads identically for a cursor trail.

### F2 — CRITICAL — Why-stay glass pill: SVG backdrop displacement over a pinned scrub

**Where:** `components/ui/glass-surface.tsx:344-423` (the filter chain), `components/sections/why-stay/why-stay.tsx:129-146` (876×133 pill), `why-stay-reveal.tsx:113-129` (pin + scrub writing `--reel-y` every frame).

**Mechanism.** `backdrop-filter: url(#glass-filter)` forces Chromium to (1) rasterize the backdrop region behind the pill, (2) run `feImage` + **3× feDisplacementMap + 3× feColorMatrix + 2× feBlend + feGaussianBlur** over it, (3) composite — and to *redo all of it any frame the backdrop changes*. During the pin, the reel translates every frame, so the whole chain re-evaluates at scroll rate. SVG filter primitives in Chromium frequently drop to software paths; that is consistent with the measurement: **39.9 fps average through the scrub, p95 33 ms, and a 358 ms worst frame** at pin-engage (first filter rasterization + pin re-layout). This section is currently the slowest moment on the page — worse than the intro.

**Also:** a **React hydration mismatch** (confirmed in console): `getContainerStyles()` branches on `supportsBackdropFilter()`/`svgSupported` during render — the server takes the "no backdrop-filter" branch, the client takes another. React re-renders the tree and logs an error on every load. And the `ResizeObserver → setTimeout → regenerate data-URI SVG` path rebuilds/re-decodes the displacement map on any resize tick.

**Remediation options, in order of preference:**
1. **Replace the mechanism, keep the look — "fake refraction" with transforms (the air.inc-style trick).** The pill is *empty* and sits over known content (big white text on flat sky). Render a **duplicate of the reel text inside the pill**, clipped by the pill's rounded rect, with a slight `scaleY`/offset (and optionally 3 colour-tinted copies ±1px for the chromatic rim), moving in lock-step with `--reel-y`. Everything is transform/clip — fully composited, zero filter work, trivially 120 fps, and works in Safari/Firefox too (they currently get a flat frost fallback). This is the approach-change recommendation: the current per-pixel physical refraction is paying an enormous price to bend *one line of text you control*.
2. If real displacement must stay: **cut the chain to one `feDisplacementMap`** (single map, no per-channel split — keep the chromatic rim as a CSS gradient border), drop the `feGaussianBlur`, and pre-render the displacement map once (it's static per size). Roughly ⅓ the filter cost; still not guaranteed 120.
3. Regardless of path: **fix the hydration mismatch** by rendering a stable SSR fallback and switching branches only after mount (the component already has `svgSupported` state — the *inline style* must not depend on browser sniffing during the first render).
4. Consider gating the displacement variant by tier (`low` → frost fallback), since GlassSurface already has a graceful frost path built in.

### F3 — HIGH — Intro glass window: the remaining, GPU-side dip

**Where:** `intro-scene.tsx:701-722` (MTM), `:777-797` (canvas), `intro.tsx:396-575` (timeline), `cursor.tsx:78-93` (mount at reveal).

What's already right (don't regress): demand frameloop + `IntroFrameCap` at `heavyEffectFpsCap()`, tiered MTM (384², 8 samples, no backside) snapshotted at mount, dpr [1, 1.5], glass/rocks unmount post-dock, assets preloaded, two-tier Suspense, loader decoupled.

Remaining issues:
1. **No `powerPreference: "high-performance"`** on any canvas — recommended in the 06-30 audit, never applied. On dual-GPU machines the browser may bind the iGPU for the MTM window. One line, zero risk (intro canvas only; leave the always-mounted layers default for battery).
2. **The dock-second collision (measured 120→75 fps):** SplashCursor mounts + compiles at `INTRO_REVEAL_EVENT` exactly as the hero cascade runs → see F1.5. Move the cursor mount to idle-time after the reveal.
3. **Shader-compile stall is still in-band.** The MTM + Text3D + env-cubemap compile burst lands when the scene mounts, behind the loader — mostly hidden, but on weaker GPUs it's the residual hitch. Three.js has `renderer.compileAsync()` (uses `KHR_parallel_shader_compile`): compile the glass material against the scene during the loader's ~2.5 s cover before the first visible frame, so the reveal never stalls. Cheap to add inside `SceneReady`/`onCreated`.
4. **The watchdog cannot see this dip.** It reads main-thread rAF deltas; the glass drop is a GPU present-rate drop with a healthy main thread (documented in §1b of the prior audit). Accept the limitation but stop relying on it for the intro: the intro already snapshots its tier, so the *initial* tier pick (GPU sniff) is the only protection. Worth extending `gpu-tier.ts`'s regex list with real weak-device profiles as planned, and/or a one-time "canary" probe: render 3 frames of a tiny MTM offscreen at boot and time them with `EXT_disjoint_timer_query_webgl2` where available, stepping the *intro* tier down pre-emptively.
5. Minor: `?intro=force` measurement showed the persistent tile canvas + conveyor repaint at 60 fps whenever the hero is on screen. It pauses correctly off-screen. Acceptable, but it is one of the four standing repaint sources at the top of the page (cursor + 2×clouds + tiles); with F1 fixed, this becomes the largest *idle* repainter at the hero. An epsilon-idle (pause when the arc is fully covered by the DOM collage crossfade? it isn't — it *is* the visible collage) — realistically: keep it, but it should read the tier and drop to 30 fps on `low`.

### F4 — MEDIUM — Clouds: architecture is right; three drifts and no mobile story

The render strategy (demand loop, batched `<Clouds>`, 30 fps morph pump on the shared ticker, dpr ≤ 1.5, off-screen pause, context watchdog) is correct and matches the research doc. Issues found:

1. **Stale off-screen cutoff vs the new section clouds.** `MorphRig` (`cloud-canvas.tsx:349-375`) stops the morph pump past **1.5 vh** on the rationale "all clouds are hero-anchored" — but `cloud-specs.ts` now has **section-bound clouds** (`cards-br`, `whystay-left`) that are on screen at 2–4 vh of scroll. Result: those clouds render but their "living morph" is **frozen** while visible (and the comment is now wrong). Either drive the pump from "any cloud currently on screen" (the SectionRig already knows) or accept static section clouds and document it.
2. **Uncapped scroll-driven repaints.** `ScrollAnchorRig`/`SectionRig`/`ScrollRig` call `invalidate()` on every ScrollTrigger update — at 120 Hz scrolling, both cloud canvases repaint at up to 120 fps (vs the 30 fps morph budget). The sprite field can't visibly benefit past ~60. Route the scroll-invalidates through the same accumulator pattern as `MorphRig`/`heavyEffectFpsCap()` for a strictly-invisible saving on the heaviest interaction (scrolling).
3. **Overdraw is the real per-frame cost:** `segments: 20` per `<Cloud>` × 7 clouds ≈ 140 large transparent billboards through one instanced draw — fill-rate heavy at high dpr. Fine on desktop at dpr 1.5; this is the knob that matters for weaker GPUs (tier it: 20/14/10 segments — form holds up well because the sprite carries the detail).
4. **Mobile: there are currently no clouds at all** (`cloud-layer.tsx` gates `≤768px` out, fallback is a TODO). The stakeholder wants clouds on mobile. Recommended strategy, in order:
   - **Baked static image** (the documented TODO): render the hero cloud arrangement once (the /lab scene → PNG/AVIF export), ship as a positioned `<Image>` layer. 0 GPU, perfect on any phone, and honestly indistinguishable for *distant* clouds at mobile sizes. Also serves `prefers-reduced-motion` and no-WebGL on desktop.
   - If *live* mobile clouds are a must: one canvas only (merge: on mobile the front/behind z-straddle matters less at small sizes), `dpr` 1, `segments` ~8, no morph pump (static puffs), scroll-anchored repaints only — i.e. a "mobile" tier below `low`. Test on a mid-range Android, not an iPhone Pro.
   - Do **not** port the desktop two-context setup to mobile as-is: two WebGL contexts + iOS Safari context limits + thermal throttling is exactly the wrong trade.
5. Two contexts on desktop remain justified (documented DOM z-straddle constraint) — no change recommended.

### F5 — MEDIUM — Quality system: right idea, two blind spots

1. **Consumers drifted** (F1): the tier table's biggest lever points at deleted code. Any future heavy effect must be added to `tiers.ts` *in the same PR* — suggest a checklist comment in `tiers.ts` and in `CLAUDE.md`.
2. **Main-thread-only watchdog:** GPU-bound present drops (the actual glass symptom) are invisible to it. Options: `EXT_disjoint_timer_query_webgl2` GPU timing on one canary canvas; or accept and document that the watchdog guards JS/compositor stalls only, with GPU protection coming from the initial tier pick. (The DevTools FPS meter remains the only ground truth for presented fps — rAF-based numbers in this audit are optimistic bounds.)
3. `pickInitialTier` returned `low` in the profiled session (headless GPU sniffed weak) and the page **still** janked — the definitive demonstration of (1).
4. One-way step-down is a sound choice; keep.

### F6 — LOW/HYGIENE — Correctness & delivery leaks

| # | Finding | Where | Note |
|---|---|---|---|
| H1 | **Hydration mismatch ×2** | `glass-surface.tsx` (style branches on client sniffing at render); `SparkleSvg` (float `y1={9.055513627132909}` serialized differently server/client) | React logs an error and re-renders on every load. For the sparkle: round coordinates to fixed precision so SSR/client strings match. |
| H2 | **Both manual preloads are double-downloads** | `layout.tsx:58-70` — `product-sans-medium.typeface.json` (`as="fetch"`, no `crossorigin`) and `cloud-puff.png` (three fetches it with different credentials mode) | Confirmed live: "preload found but not used because credentials mode does not match". Add matching `crossOrigin`, or drop the preloads. Was flagged as A3 in the prior audit; the fix that landed removed the rock dups but left these two broken. |
| H3 | **rock-hover lerp is frame-rate-dependent** | `rock-hover.tsx:9,50-51` — `FOLLOW = 0.18` per tick | The hover disc chases ~2× faster at 120 Hz than 60. Known since 06-30; fix with the documented `1 - Math.pow(1 - FOLLOW, dt/16.7)` form. Correctness for the 120 fps goal, not perf. |
| H4 | `grain.png` 1.4 MB | `background.tsx` | Intentionally reverted (A2) — re-flagging only because it remains the single largest asset; an AVIF re-encode of the *same* tile is lossless-looking and ~100 KB. Decision stands with the user. |
| H5 | `/lab/glass`, `/lab/clouds` ship in prod build | `app/lab/*` | Unlinked but routable; exclude from prod (env-gate or delete) before launch. |
| H6 | Grass overlay AVIF became the LCP | console warning | Cosmetic: lazy-loaded grass being LCP means the *visible* hero content painted earlier than the metric thinks; verify `priority`/`loading` choices after F-fixes with a Lighthouse run. |

### F7 — Architecture & structure (requested review)

The folder architecture (routing-only `app/`, colocated `components/sections/*`, root-mounted fixed layers, the `intro-state.ts` gate, one Lenis+GSAP scheduler) is **sound and consistently applied** — no restructuring recommended. Three notes:

1. **Vendored third-party effects need a home + a contract.** `splash-cursor.tsx` (1,100 lines, `@ts-nocheck`) and `glass-surface.tsx` were dropped in as-is, and both broke site invariants (F1, F2/H1). Suggest a `components/vendor/` (or a header convention) with a required checklist: *rides the shared ticker · idles when unseen · reads the tier · SSR-stable render*. The codebase's own rules are good; they just weren't applied to imports.
2. `glass-surface.tsx` sits in `ui/` but is single-consumer (why-stay). Fine either way; if the transform-based rebuild (F2.1) happens, it becomes `sections/why-stay/` anyway.
3. Docs are excellent and load-bearing — keep updating `MorphRig`-style comments when specs change (F4.1 shows one already rotted).

---

## 3. What "120 fps like air.inc" actually requires

air.inc reads flat because its hero is a **pre-rendered plate** — one composited layer, ~0 continuous shader work, so the browser presents at whatever the panel gives (and merely 30 fps under reduced motion, per the stakeholder's own measurement — i.e. they *dropped* work, not optimized it). The equivalent discipline here is not "make the shaders faster", it's:

> **Idle = zero repaints.** Any frame where nothing visibly moves must cost nothing on every canvas.

Current standing repaint budget at the hero, per displayed frame (120 Hz, after all shipped fixes):

| Source | Rate today | After remediation |
|---|---|---|
| SplashCursor (F1) | 120 fps, always | 60 fps **only while dye visible**, else 0 |
| Tile conveyor | 60 fps while hero visible | 60 (tiered 30 on low) |
| Cloud canvas ×2 (morph) | 30 fps each | 30 (unchanged), scroll-invalidates capped |
| Cloud canvas ×2 (scroll) | up to 120 fps while scrolling | ≤60 |
| Why-stay pill (F2) | full SVG filter re-raster at scroll rate | 0 filter work (transform-only rebuild) |
| DOM (GSAP reveals, marquee, cards) | already idle-gated | unchanged |

With F1 + F2 done, a motionless page = 2×30 fps small cloud repaints + one 60 fps tile drift — comfortably inside an 8.3 ms budget at dpr 1.5 on any recent GPU; a still-cursor page while scrolling = clouds + tiles only. That is the 120-capable / 60-floor shape. Reduced-motion already mounts none of the WebGL layers and no pin — it is effectively static DOM and will hold 60+ trivially (well above air.inc's 30).

---

## 4. Proposed correction plan (for discussion — nothing implemented)

**Phase A — restore the contract (highest ROI, look-preserving)**
1. F1: idle-gate + shared-ticker + fps-cap + tier-wire the SplashCursor (fork the vendored file deliberately); defer its mount past the reveal (also fixes the measured dock dip).
2. F2: rebuild the why-stay pill as clipped/duplicated text transforms (or, minimally, single-map displacement) + fix the hydration mismatch.
3. H2: fix/drop the two broken preloads. H1: round SparkleSvg floats.

**Phase B — intro polish**
4. `powerPreference:"high-performance"` on the intro canvas; `compileAsync` the glass during the loader cover.
5. Move the cursor/heavy mounts off the `INTRO_REVEAL_EVENT` frame to idle-time.

**Phase C — clouds**
6. Fix `MorphRig`'s stale 1.5 vh cutoff (drive from actual cloud visibility); cap scroll-driven `invalidate()` to `heavyEffectFpsCap()`.
7. Tier `segments`; bake the static mobile/reduced-motion/no-WebGL cloud image and mount it as the `!eligible` fallback (the existing TODO).

**Phase D — guardrails**
8. Tier-consumer checklist in `tiers.ts` + CLAUDE.md vendor-import contract; extend `gpu-tier.ts` regexes; optional GPU-timer canary.
9. H3 (rock-hover dt-lerp), H5 (lab routes), H6 (LCP re-check), revisit H4 (grain) with the user.

**Verification protocol** (per phase): `npm run lint` + `npm run build`; presented-fps via the Chrome DevTools FPS meter (ground truth — not rAF sampling) on a real 120 Hz panel, in the four scenarios of §1's table; a mid-range Android for the mobile cloud fallback.

---

## 5. Measurement caveats

- Profiling ran against the **dev server** (Turbopack dev overhead inflates absolute numbers ~10–20 %) in Playwright's Chromium (GPU sniffed *weak* → session tier `low`; no ProMotion vsync). Relative signals — idle p95 spikes, the why-stay collapse, the dock-second dip, canvas inventory — are hardware-independent and match the prior production-profiled audit's structure.
- rAF-delta fps is an **optimistic upper bound**: GPU present drops (the glass's actual symptom) don't show in it. Treat the DevTools FPS meter as ground truth for any glass/cursor verification.
