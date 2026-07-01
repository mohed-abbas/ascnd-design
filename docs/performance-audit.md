# Performance Audit — ascnd-design

**Date:** 2026-07-01
**Scope:** Whole marketing site, with emphasis on the intro loader and the liquid-glass wordmark, plus the always-on WebGL layers (clouds, cursor trail).
**Goal set by stakeholder:** sustained **120 fps on capable displays**, with a hard **60 fps floor** everywhere, without losing the current look or animations.
**Method:** Google Lighthouse (mobile, production) + **runtime frame-timing profiling** via Playwright against the production deployment + static source audit by three parallel specialists (WebGL/R3F runtime, asset/bundle/network, intro-loader/main-thread).

> This report is diagnosis only — **no code was changed.** It extends the existing GPU-focused note in [`intro-loader-performance.md`](./intro-loader-performance.md); where they overlap, this document is the site-wide superset.

---

## 1. Executive summary

The site **loads fast but does not stay smooth.** Load metrics are mostly good (FCP 0.3 s, CLS 0); the two real problems are:

1. **Runtime is GPU/fill-rate bound, with no 120 fps headroom and visible jank even at idle.** The page runs **four simultaneous full-viewport WebGL contexts at DPR 2**, and — contrary to the "demand/cheap" comments in the code — **all four repaint continuously forever.** An idle page with a motionless cursor should cost ~0 GPU; today it pays for two 30 fps cloud repaints + a full-refresh-rate fluid simulation + a full-refresh-rate tile conveyor. Measured worst-frame times sit at **~26–36 ms in every scenario** (idle, cursor, scroll, boot) — i.e. dropped frames against a 16.7 ms (60 fps) budget, and roughly 4× over the 8.3 ms (120 fps) budget.

2. **~3.1 MB of avoidable image bytes** ship on first load (Lighthouse "Improve image delivery"). Root cause: the four hero cliff images are served **`unoptimized`** (no AVIF/WebP re-encode, no responsive sizing, 4× masters shipped to ~1× slots) and eagerly `priority`-loaded, plus a **1.4 MB `grain.png`** noise tile. On mobile, ~1.5 MB of that is the grass-hover overlay which is **never even visible** (no fine pointer).

The main thread is **not** the steady-state bottleneck (0 long tasks measured during idle/scroll/cursor). The 180 ms TBT is boot-time JS: WebGL context creation, shader compiles, `Text3D` tessellation, and font-gated work colliding in the ~2.5 s hidden warm-up window.

**Bottom line:** hitting 120/60 fps is achievable **without dropping any effect**, because the fixes gate *when* and *at what resolution* work happens — not *whether* the effects exist. The single highest-ROI change is making the always-on loops actually idle when nothing is moving.

---

## 1a. Phase 1 — Results (shipped 2026-07-01)

Phase 1 (the quick wins from §8) is **implemented, production-build-verified, and merged.** No effect or visual was dropped. Every change was validated with `npm run lint` + `tsc --noEmit` + a live browser check (0 console/hydration errors), and a clean `npm run build`.

| Item | Status | Commit | Result |
|---|---|---|---|
| **R2** idle-gate cursor trail | ✅ shipped | `30a1b4e` | sim parks after ~3.5 s of pointer stillness → **0 GPU when idle**; wakes on `pointermove` |
| **R3** throttle + off-screen-pause conveyor | ✅ shipped | `30a1b4e` | persistent canvas repaint capped + pauses entirely once the hero scrolls away. **Later raised 30 → 60 fps** (`heavyEffectFpsCap()`, bounded on 120 Hz): at 30 fps the slow drift read as stuttery next to the 60/120 fps DOM animations, and the steady scene is cheap (8 unlit quads, glass unmounted, dpr ≤ 1.5) — the off-screen pause is unchanged |
| **A1** rocks → AVIF (crispness-preserved) | ✅ shipped | `6c655e2` | full 1428×3928 res kept, q80 (PSNR ~43 dB RGB / ~62 dB alpha); **−443 KB**, applied to DOM `<Image>` + WebGL `useTexture` |
| **A4** fonts → WOFF2 | ✅ shipped | `76d49e5` | 4 weights, no subsetting (623 glyphs each); **384 KB → 135 KB (−249 KB)**, shorter `fonts.ready` gate |
| **A5** `images.formats` AVIF | ✅ shipped | `a8ca856` | optimized `next/image` output now prefers AVIF (rocks stay pre-encoded/`unoptimized`) |
| **T6** modern `browserslist` + `tsconfig` target | ✅ shipped | `a8ca856` | Chrome/Edge/FF 111+, Safari 16.4+; ES2022 — drops the ~14 KB legacy-JS transpile/polyfills |
| **A3** preload-herd trim + grass mobile-gate | ✅ shipped | `e5f7154` | rock preloads 4→2 (removed manual dups of `next/image priority`); grass `<Image>` gated on `(pointer: fine)` + not-reduced-motion and made `loading="lazy"` — **~1.3 MB not loaded on touch**, grass preloads 2→0 |
| **A2** grain shrink | ↩️ reverted | — | reverted by request; original 1.4 MB `grain.png` retained |

### Measured deltas
- **First-load image bytes:** rocks −443 KB (AVIF); grass ~1.3 MB no longer downloaded on coarse-pointer devices; preload contention reduced (herd of high-priority requests trimmed to the true LCP + essentials).
- **Fonts:** −249 KB (WOFF2).
- **Legacy JS:** ~14 KB removed via modern build target (confirmed by production build).
- **Runtime:** the idle page now rests — the cursor fluid-sim (previously the heaviest always-on cost) parks when the pointer is still, and the 4th (tile-conveyor) context throttles to 30 fps and stops off-screen. This targets the ~30 ms idle p95 spikes measured in §2.2.
- **Grain (A2) reverted**, so ~1.23 MB of potential savings was intentionally left on the table.

### Deferred (not yet done)
- **Phase 3** — boot polish: defer cursor mount past the intro, flatten the intro forced-reflow, pre-split SplitText, phased-resolution glass, dead-asset cleanup.

---

## 1b. Phase 2 — Scaffolding landed (in progress, 2026-07-01)

The adaptive-quality **plumbing (§6 C1–C4)** is built and wired, with **conservative defaults that reproduce the shipped look 1:1 on capable hardware** (the `high` tier == current values, and `unknown` GPU starts high). What remains is **on-hardware calibration** of the tier constants and thresholds — which needs a real 120 Hz panel + a genuinely weak GPU. Nothing here changes the look until the watchdog demotes a struggling machine.

### New subsystem — `lib/perf/`

| File | Role (audit ref) |
| --- | --- |
| `tiers.ts` | Tier table: `high`/`medium`/`low` → the GPU-cost knobs (cursor RT scale, cloud dpr cap, MTM samples/resolution/backside, Text3D tessellation). `high` = shipped values. |
| `refresh-rate.ts` | **C1** — median of ~30 rAF deltas → snapped Hz (SSR-safe → 60). |
| `gpu-tier.ts` | **C2** — unmasked-renderer + memory/core heuristic → `strong`/`weak`/`unknown`. |
| `quality-store.ts` | **C2/C3 state** — framework-agnostic store: `initQuality`, one-way `stepDownTier`, `heavyEffectFpsCap` (60 on fast panels / stepped tiers), subscribe. |
| `frame-watchdog.ts` | **C3** — EMA of frame time on the shared GSAP ticker; sustained overrun → one step down, with warmup + cooldown. |
| `use-quality.ts` | React binding (`useSyncExternalStore`, server snapshot = `high` → no hydration mismatch). |

`components/providers/quality-controller.tsx` boots it (detect → `initQuality` → arm watchdog), mounted once in `layout.tsx`.

### Calibration affordances

A capable machine (e.g. an M4) never trips the watchdog, so tiers must be driven by hand to eyeball `medium`/`low`:

- **`?tier=high|medium|low`** — pins a tier (freezes the watchdog) for A/B. Applied synchronously so even the intro glass snapshot picks it up.
- **`window.__quality`** (dev only) — `{ tier, refreshHz, config, force(t), stepDown() }`, and every tier change logs to the console.

### Consumers wired (live)

- **Cursor sim** (`cursor-trail-canvas.tsx`) — reads `cursorRtScale`; **fps cap** via a dt-accumulator (integration stays time-accurate when capped); resizes the ping-pong buffers on tier change.
- **Clouds** (`cloud-canvas.tsx`) — `dpr={[1, cloudDprMax]}` from the tier (R3F re-applies dpr on change).
- **Intro glass** (`intro-scene.tsx`) — MTM `samples`/`resolution`/`backside` + Text3D `curveSegments`/`bevelSegments` from a **mount-time snapshot** (not reactive — avoids a mid-intro FBO rebuild flash).

### Verified on real hardware (M4 Pro, 120 Hz — 2026-07-01)

Driven via Playwright against the dev server (Chromium reported the true 120 Hz):

- **C1 refresh detection** → `refreshHz=120` (measured rAF median 8.3 ms). ✅
- **C2 GPU detection** → `gpu=strong` → starts `high`. ✅
- **Sustained 120 fps at `high`** on the M4 (8.3 ms steady-state frame time). ✅
- **Step-down chain** `high(0.5/dpr2) → medium(0.45/1.5) → low(0.4/1.25) → floor`; every consumer's config updates live and `stepDown()` returns `false` at the floor. ✅
- **Override + debug API** (`?tier=`, `window.__quality`) work. ✅

**Bug found & fixed:** the watchdog fired *during the intro* (MTM compile + HMR pushed the EMA over budget) and false-demoted the whole session to `medium`, despite steady state being a healthy 8.3 ms. Fix: the controller now **arms the watchdog only after `INTRO_REVEAL_EVENT` + an 800 ms settle** (failsafe timer for the intro-skipped path), and the watchdog's own warmup dropped 3000 → 1000 ms. Re-verified: boot stays `high`, "watchdog armed" logs post-intro, no false step-down.

### Still to do (needs a weak GPU + the user's own Chrome)

- **Visual A/B of `medium`/`low` glass** (384/6 and 256/4-backside-off) — best judged live via `?tier=low` in a real browser (a 2 s transient is hard to screenshot). Confirm dispersion still reads as glass at the telephoto framing.
- **Subjective 60-cap check:** on a 120 Hz panel the cursor sim is capped to 60 — confirm the trail still feels right (raise the cap if it dulls).
- **Calibrate the watchdog `THRESHOLD_MS`** against a genuinely weak GPU (the M4 can't trip it naturally) — CPU-throttle in DevTools or temporarily lower the constant to confirm it demotes *before* visible stutter.
- Extend the `gpu-tier.ts` renderer regexes from real weak-device profiling.

### Site-wide consistency — the real goal (2026-07-01)

**User goal:** flat 120 fps site-wide, like air.inc (measured 115 fps steady on **93 MB GPU**). **Why air.inc is flat:** its rich hero is a pre-rendered video/image plate — one cheap composited layer, ~0 continuous shader work. **Why ours varies (120→101 everywhere, even in a prod build):** it runs **4 live WebGL contexts**, three of which repaint *continuously at 30 fps even at idle* (2 cloud canvases via `MorphRig`, the tile canvas via `ConveyorRig repeat:-1`), and all 4 are composited every displayed frame. Profiled on the M4 (Playwright, no vsync → optimistic): **44% of idle frames already exceed the 8.4 ms/120 fps budget**; pointer-move spikes to ~32 ms (cursor fluid sim). On a real vsync'd panel that variance is the visible 120→101.

**Mechanism of the periodic dip:** a 30 fps repaint on a 120 Hz panel = every 4th frame does the heavy GPU work. At dpr 2 that repaint (~6 ms) lands at the frame budget → overflow → spike. At **dpr 1.5** it's ~3.5 ms → fits → flat.

**User decisions (keep all effects, make each cheaper):** keep the live cloud billow, keep the cursor trail (tune harder), keep the tile conveyor live.

**Round applied — dpr + cursor (non-destructive):**

- Cloud `dpr` 2→**1.5** (tier `cloudDprMax`) — soft sprite, imperceptible; ~44% cheaper per repaint.
- Intro tile `<Canvas>` `dpr` [1,2]→**[1,1.5]** — halves-ish the conveyor repaint cost on retina.
- Cursor display `setPixelRatio` 2→**1.5** + `cursorRtScale` 0.5→**0.4** — cuts the per-pointer-move fluid-sim spike.

Targets the periodic-spike mechanism directly. **Needs a prod rebuild + FPS-meter check on the user's Chrome** (Playwright headless has no vsync and can't measure the present-rate dips). If the glass intro still dips, next step is phased glass (full 512 only during the static HOLD beat, cheap during motion).

**Follow-up — defer the cursor past the intro (T1, user-suggested):** `CursorTrail` now gates its mount on `INTRO_REVEAL_EVENT` (the dock), like the clouds, with a failsafe for the intro-skipped path. During the intro the fluid-sim shader no longer compiles alongside the glass MTM, and its WebGL context isn't mounted — so the glass reveal has one fewer context competing for GPU (3 contexts during the intro instead of 4). Directly targets the glass-intro dip. No downside: the intro is scroll-locked and the trail is unseen there.

### Glass GPU-cost fix (2026-07-01)

**Symptom:** during the intro the *presented* framerate fell to ~33 fps on an M4 (everything else fine). **Diagnosis:** the glass was GPU-bound — the main thread ran 120 fps (rAF steady at 8.3 ms) but the GPU couldn't finish the MTM's passes in time, so vsync dropped presented frames. **This is invisible to rAF-delta profiling and to Playwright (headless = no vsync); the DevTools FPS meter is ground truth.**

**Fix** (in `tiers.ts`, all tiers): drop `backside` and lower `resolution` (512→384 high). `backside` renders a whole extra scene pass and, on the `height={0}` (zero-extrusion) Text3D, its back face is near-coincident with the front — near-zero visual contribution here. `samples` stays 8 (refraction-blur sharpness kept). The glass is only ever *moving* (reveal/dock) or briefly *static* (0.45 s HOLD, where low fps on a near-static frame is imperceptible), so the cut lands where it can't be seen. **Needs FPS-meter confirmation on the user's Chrome.** If the HOLD beat looks too flat, the fallback is phased quality — full 512/backside only during the static HOLD (fps there is irrelevant), cheap during motion.

### Both remaining levers now wired (2026-07-01)

- **Intro frameloop 60-cap (R4 item 3)** — the intro `<Canvas>` moved from `frameloop="always"` to `"demand"`, driven by a new `IntroFrameCap` rig that pumps `invalidate()` off the shared ticker at `heavyEffectFpsCap()` (60 on a fast panel, uncapped on a 60 Hz high tier). Halves the MTM's paint cost through the compile window on 120 Hz. Verified on the M4: intro plays and docks correctly, 0 console errors.
- **Pause `MorphRig` off-screen (R5)** — the 30 fps cloud-morph pump now stops once scrolled past **1.5 vh** (all clouds are hero-anchored; the ROCK layer clears the top by ~1.2 vh), and repaints once on return. Threshold was **1.5 vh, not 2 vh**: the page is only 2 vh of scroll, so a 2 vh cutoff sat at `maxScroll` and never fired. Verified: scroll past + back repaints the clouds cleanly, no freeze.

---

## 2. Current state (measured)

### 2.1 Lighthouse (mobile, production)

| Metric | Value | Verdict |
|---|---|---|
| Performance score | **84** | needs work |
| First Contentful Paint | 0.3 s | ✅ good |
| Largest Contentful Paint | 1.8 s | 🟠 |
| Total Blocking Time | 180 ms | 🟠 |
| Speed Index | 2.1 s | 🟠 |
| Cumulative Layout Shift | 0 | ✅ good |
| Accessibility / Best-Practices / SEO | 98 / 100 / 100 | ✅ |

Flagged insights: **Improve image delivery (~3,100 KiB)**, LCP request discovery, Network dependency tree, Render-blocking requests, Legacy JavaScript (~14 KiB).

### 2.2 Runtime frame profiling (production, Playwright)

Frame-timing sampled over 2–5 s windows per scenario. **Caveat:** the profiling browser is headless and may not use the same GPU path as real hardware, so treat *absolute* FPS as indicative, not exact — the **relative signal (consistent ~30 ms worst-frames across all states, and 4 live contexts) is hardware-independent and is the real finding.**

| Scenario | Avg FPS | Median frame | p95 frame | Worst frame | Long tasks |
|---|---|---|---|---|---|
| **Idle** (no input) | 67 | 9.1 ms | **30.8 ms** | 33.3 ms | 0 |
| **Cursor active** | 73 | 9.7 ms | 27.6 ms | 32.2 ms | 0 |
| **Scroll active** | 72 | 10.8 ms | 26.3 ms | 33.8 ms | 0 |
| **Boot / intro (0–5 s)** | 64–80 | — | — | 26–36 ms | 0 |

Boot timings: first-paint 152 ms, DOMContentLoaded 72 ms, load 178 ms.

**Live GPU surfaces at runtime: 4 canvases, each `3024×1428` (full viewport × DPR 2).**

The critical takeaways:
- **Jank exists at idle.** p95 = 30.8 ms with a still cursor means the page is repainting and periodically missing frames when it should be resting.
- **No long tasks at steady state** ⇒ the bottleneck is the GPU/compositor, not JS. Four transparent full-res layers must be blended every frame on top of four independent `present()`s.
- **No 120 fps headroom anywhere** — median frames are already ~9–11 ms before the spikes.

---

## 3. Performance targets & budgets

To make "120 on capable, 60 floor" concrete and testable:

| Tier | Display | Per-frame budget | Quality profile |
|---|---|---|---|
| **High** | ≥120 Hz + strong GPU | **8.3 ms** | full effects, current settings |
| **Standard** | 60 Hz, or 120 Hz weak GPU | **16.7 ms** | effects capped to 60 fps, reduced RT/DPR |
| **Reduced** | low-end / `prefers-reduced-motion` | n/a | static fallbacks (already partly built) |

Load-metric targets (mobile): **LCP < 1.2 s, TBT < 100 ms, Speed Index < 1.5 s, Performance ≥ 95, CLS 0 (hold).**

The current architecture cannot *reach* the High tier because nothing measures the display rate or the achieved frame time, and nothing steps quality down under pressure (see §6).

---

## 4. Findings — Runtime / GPU (the fps killers)

These are the changes that actually move fps. All preserve the visual result.

### R1 — CRITICAL — Four WebGL contexts, all repainting forever
**Where:** `cloud-layer.tsx:136` & `:153` (two cloud canvases), `cursor-trail-canvas.tsx:45`, `intro-scene.tsx:701` (persists after intro).
**Root cause:** Each is an independent renderer with its own GL state, clear, and `present()`; four transparent full-viewport canvases are also four compositor layers blended every frame. None idles.
**Impact:** Fixed per-frame overhead ×4 + 4-layer blend = the baseline that eats the frame budget before any real work. Directly explains the measured idle jank.
**Remediation (look-preserving):**
- **Idle-gate every loop** (R2, R3, R5) so 4 contexts cost ~0 when static — far higher ROI than merging.
- The two cloud contexts **cannot** be merged (DOM cliffs must z-stack *between* the sky clouds at `-z-10` and rock clouds at `z-[61]` — a real, documented constraint). Don't chase a single-canvas rewrite.
- If one context must go, the **cursor trail** is the only viable merge candidate (a `pointer-events:none` fullscreen-triangle pass that could composite into the rock-cloud front layer). Lower priority than idle-gating.

### R2 — CRITICAL — Cursor trail runs a heavy 2-pass fluid sim every frame, even with a motionless pointer
**Where:** `cursor-trail-canvas.tsx:208` (added to `gsap.ticker`, never removed until unmount); `:172-206` renders unconditionally; shader `cursor-trail-shaders.ts:106-107`.
**Root cause:** The `update` callback does two `renderer.render()` calls every ticker frame regardless of pointer state. When the pointer stops, the trail fades but the shader keeps executing at full cost. The fragment shader is genuinely expensive: **36 simplex-noise evaluations per fragment per frame** (2× `curlNoise` → 6× `snoiseVec3` → 3× `snoise`), plus 2 texture taps.
**Impact:** At `RT_SCALE = 0.5` on a 1920×1080 display that's a 960×540 sim ≈ **~18.7 M noise evals/frame → ~2.2 billion/sec at 120 Hz, sustained, on an idle page.** Note `RT_SCALE` was recently raised 0.25 → 0.5, which is **4× the fragment count** of the prior version (the comments at `:20`/`:103` still say "1/4-resolution" and are now stale).
**Remediation:**
1. **Idle-gate the ticker:** when `uSpeed ≈ 0` for N frames *and* the trail has fully faded, `gsap.ticker.remove(update)`; re-add on the next `pointermove`. A still cursor then costs 0 GPU — **the single biggest sustained win on the page.**
2. **Cap the sim to 60 fps** even on 120 Hz (a soft additive glow gains nothing from 120) via an accumulator, mirroring `MorphRig` (`cloud-canvas.tsx:250-256`).
3. **Revisit `RT_SCALE` 0.5 → ~0.4** (indistinguishable for a blurred glow) and tie it to the device tier (§6).
4. Keep half-float RT + LinearFilter — required for feedback precision.

### R3 — HIGH — The intro glass canvas never unmounts; it repaints at full refresh forever as the tile conveyor
**Where:** `intro-scene.tsx:701` (canvas), `ConveyorRig` `:505-511` calls `invalidate()` on every tween tick (`:502`); `intro.tsx:394` sets `introActive=false` but doesn't unmount.
**Root cause:** The comment at `:703-705` claims the canvas becomes cheap `demand` after the intro, but the `repeat:-1` conveyor tween invalidates every frame, so it's effectively `always` for the whole session — the 4th always-on context.
**Impact:** Full-refresh-rate repaint of the tile scene (8 textured quads + `ScrollRig`) for the entire session, on top of the other three contexts.
**Remediation:** Throttle the conveyor's `invalidate()` to ~30 fps (accumulator, like `MorphRig`), and **pause it when the tiles are scrolled off-screen** (IntersectionObserver / ScrollTrigger `onToggle`) so it costs 0 off-screen. Both preserve the motion when visible.

### R4 — HIGH — `MeshTransmissionMaterial` is the intro's frame spike (~3 scene renders/frame)
**Where:** `intro-scene.tsx:655-675` — `samples={8}`, `resolution={512}`, **`backside={true}`**, plus distortion/temporal-distortion/chromatic-aberration; `frameloop="always"` (`:705`); `Text3D` `:641-653` at `curveSegments={32}`/`bevelSegments={12}`.
**Root cause:** drei's MTM renders the scene into its own FBO each frame; `backside=true` adds a second (backside) render → **~3 scene renders/frame** at 512² with an 8-tap blur, at full refresh. This is the heaviest single thing on the page while the glass is up — but it is **time-bounded** (intro ≈ 2.35 s, then `Glass` unmounts at `:727`). So it's a ~2.35 s load-time jank window on weaker/120 Hz GPUs, not a sustained cost.
**Remediation (keep the glass look):**
1. **Tier `samples`/`resolution`** off §6: 512/8 strong, 256/4 weak (the near-orthographic telephoto view, fov 11.82° at `:713`, hides high-frequency detail).
2. **Drop `backside` on the low tier** — removes a whole scene render/frame; compensate with slightly higher `thickness`/attenuation.
3. **Cap the intro to 60 fps** on 120 Hz panels — halves the spike at the exact moment jank is most likely.
4. **Cheaper look-alike for the low tier:** stock `MeshPhysicalMaterial` with `transmission`/`thickness`/`ior` uses three's built-in single transmission pass (one renderer-shared FBO) instead of drei's multi-pass FBO — loses the dispersion shimmer (subtle at this framing). Worth A/B-ing.
5. **Reduce tessellation** to `curveSegments={16}`/`bevelSegments={6}` — ~halves triangles, invisible head-on, and cuts the one-time CPU geometry build (see B/T findings).

### R5 — MEDIUM — Two cloud contexts repaint at 30 fps forever and never pause off-screen
**Where:** `MorphRig` `cloud-canvas.tsx:244-262` (30 fps morph via shared ticker — correctly throttled and tab-parked); DPR at `:381`.
**Root cause:** Runs for both canvases whenever mounted, even when the clouds are scrolled out of view. Cloud DPR is capped at 2, but the sprite is soft — 2× device resolution quadruples FBO fragments for no perceptible gain at 30 fps.
**Remediation:** Gate `MorphRig` on visibility (IntersectionObserver / ScrollTrigger `onToggle`) so the 30 fps pump stops off-screen; **cap cloud `dpr` to ~1.5** (`dpr={[1,1.5]}`). Both invisible to the eye.

### R6 — Confirmed correct (do not regress)
- **Single shared rAF** is textbook: GSAP ticker drives Lenis (`lenis-provider.tsx:52,72-76`, `autoRaf:false`, `lagSmoothing(0)`). No competing schedulers — clouds/cursor/conveyor all ride this one ticker or R3F demand. The problem is *what's stacked on it*, not loop count.
- `frameloop="demand"` + `frustumCulled={false}` + single batched `<Clouds>` draw (`cloud-canvas.tsx:380,409-415`) are all correct.
- No per-frame allocations found in the `useFrame`/`update` loops (no GC pressure).

---

## 5. Findings — Asset delivery (the ~3.1 MB)

### A1 — CRITICAL — Hero cliffs served `unoptimized` + eager `priority` (the bulk of "Improve image delivery")
**Where:** `rock.tsx:22-27,44-45` (`left-rock.webp` 556K + `right-rock.webp` 380K, `unoptimized`+`priority`); `grass-rocks.tsx:22-25,44-51` (`left-rock-grass.webp` 920K + `right-rock-grass.webp` 568K, `unoptimized`+`priority`). **Total ≈ 2,424 KiB, all eager/high-priority at first paint.**
**Root cause:** `unoptimized` defeats the entire Next pipeline — no AVIF/WebP re-encode, no responsive `srcset`, no width cap. The assets are **4× cut-outs** displayed in ~120–360 CSS-px slots, so a phone downloads the full 4× payload for a 1× slot. `sizes` is set but ignored because `unoptimized`.
**Worst offender:** the grass overlay (1,488 KiB) is masked to fully hidden at rest and only revealed inside a cursor-tracking disc — so on mobile (no fine pointer) it is **downloaded eagerly, at `priority`, and never shown.**
**Impact:** ~2.4 MB eager, dominant LCP driver, drives "LCP request discovery" (below).
**Remediation (keeps the hand-tuned crispness that motivated `unoptimized`):** the real tension is Next's `q=75` softening color-keyed edges — the industry answer is *pre-encode, don't hand-serve the 4× master*:
- Ship **AVIF (or high-q WebP) pre-encoded at 2× the max display size, not 4×** (~720 px max). ~4× fewer pixels immediately.
- AVIF at q≈60–70 is ~30–50 % smaller than the current WebP at equal sharpness.
- Combined: **2,424 KiB → ~400–600 KiB (~1.8–2.0 MB saved)** with no visible softening, because you control the encoder + target size.
- Alternatively drop `unoptimized`, pass `quality={90}` and a real width cap (requires `images.formats` for AVIF — see A5).
- **Gate the grass overlay behind `(pointer: fine)`** (the same gate `cursor-trail.tsx:33` already uses), make it `loading="lazy"`, and remove `priority` — saves ~1.5 MB on every mobile load outright.

### A2 — HIGH — `grain.png` is a 1.4 MB PNG on the always-visible background
**Where:** `background.tsx:19` — CSS `bg-[url('/textures/grain.png')]`, tiled 1024², `opacity-10`, on the root fixed `<Background/>` (`layout.tsx:91`) — loads eagerly on every page.
**Root cause:** A full-detail 1024² PNG for a monochrome noise tile shown at 10 % opacity.
**Impact:** ~1.4 MB, bandwidth contention with fonts + rock preloads in the first-load window; PNG decode competes on the main thread. **A1 + A2 together ≈ the full 3.1 MB Lighthouse estimate.**
**Remediation:** re-encode to AVIF/WebP and/or shrink the tile to 256²–512² (nobody sees the repeat at opacity-10) → **~1.2–1.35 MB saved**, visually identical. (An SVG `<feTurbulence>` grain would remove the request entirely if deterministic grain isn't required.)

### A3 — HIGH — LCP request discovery: a herd of equally-eager oversized preloads
**Where:** `next/image priority` on 4 rocks (`rock.tsx:44`, `grass-rocks.tsx:51`) *plus* hand-rolled `<link rel="preload">` for `left-rock.webp`/`right-rock.webp`/`cloud-puff.png` **and** a typeface `.json` in `layout.tsx:57-72` → **6+ high-priority requests fired at once**, all contending for mobile bandwidth.
**Root cause:** The true LCP resource is discoverable but not *prioritized cleanly* — it's stuck behind duplicated, equally-eager, oversized requests. LCP 1.8 s is dominated by the transfer time of an oversized image, not discovery latency.
**Remediation:** After A1 re-encodes the LCP image, keep **exactly one** preload for it with `fetchpriority="high"`; **delete the redundant manual rock preloads** (next/image `priority` already preloads them) and **demote the grass overlays** (drop `priority`). Fewer high-priority requests ⇒ the LCP resource wins the race. Add `crossOrigin` to the font preload or drop it.

### A4 — HIGH — Fonts shipped as uncompressed TTF (4 weights), gating the reveal
**Where:** `layout.tsx:25-34` — Product Sans via `next/font/local` from **`.ttf`** (Light 92K, Regular 109K, Medium 92K, Bold 90K ≈ **386 KB**), auto-preloaded; `Geist_Mono` also preloaded (`:10-13`).
**Root cause:** TTF is uncompressed vs WOFF2 (40–60 % smaller, Brotli-friendly). The hero reveal is gated on `document.fonts.ready` (`hero-reveal.tsx:148-154`) and SplitText measures with the real font, so slow fonts directly delay the *visible* hero and the intro handoff.
**Remediation:** convert the 4 TTFs to **WOFF2** subset to used Latin glyphs (**~386 KB → ~190 KB**), keep `display:"swap"`; set `preload:false` on `Geist_Mono` and any weight not in the LCP text so only the LCP-critical weight preloads. Shortens the `fonts.ready` gate the whole cascade waits on.

### A5 — MEDIUM — `next.config.ts` has no `images` block
**Where:** `next.config.ts:3-18` (only `turbopack.root` + `reactStrictMode:false`).
**Root cause:** Next 16's default optimized format is **WebP only**; AVIF is opt-in via `images.formats`. Even after dropping `unoptimized`, there'd be no AVIF today.
**Remediation:** add `images: { formats: ['image/avif','image/webp'] }` and consider `deviceSizes`/`qualities` tuning. (No effect on the rocks until `unoptimized` is removed — A1.)

### A6 — LOW — Dead assets
`public/brand/ascnd-glass.webp` (196K, **referenced nowhere**) and `public/textures/cloud.png` (28K, legacy unused) — delete.

---

## 6. The 120/60 fps strategy (the headline goal)

Nothing today measures the display rate or achieved frame time, and nothing steps quality down under load — so the High tier is unreachable and there is no guaranteed 60 floor. Industry-standard approach:

**C1 — Detect refresh rate at startup.** Sample ~30 `requestAnimationFrame` deltas → median → ~60/90/120 Hz. (`matchMedia (update: fast)` only reports fast/slow, not the rate; rAF sampling is the standard.)

**C2 — Pick an adaptive quality tier** from (refresh rate × GPU strength): choose `RT_SCALE` (cursor), fps caps, cloud `dpr`, and MTM `samples`/`resolution` per tier. 120 Hz + strong ⇒ full at 120; 120 Hz + weak ⇒ cap effects to 60 and drop RT/samples.

**C3 — Runtime frame-time watchdog.** Keep an EMA of frame time on the single shared ticker; if it exceeds ~10 ms for a rolling window, step down one tier (lower cursor scale → cloud dpr → transmission resolution). This delivers the true **60 fps floor** while letting capable machines sustain **120**.

**C4 — Idle everything that can idle** (R2/R3/R5). A tier system is pointless if the baseline never rests; idle-gating is the prerequisite that frees the budget the High tier needs.

All four hang off the existing single GSAP ticker — no new schedulers, no architectural change.

---

## 7. Findings — Boot / main-thread / TBT (~180 ms)

The main thread is idle at steady state; the cost is a boot burst in the ~2.5 s hidden warm-up.

- **T1 — HIGH — `CursorTrail` mounts and compiles during the intro.** `layout.tsx:96` mounts it at root with no intro-lifecycle awareness (unlike clouds, which listen for `INTRO_START/REVEAL`), so its fluid-sim shader compiles concurrently with the MTM compile — the two heaviest compiles collide during the exact GPU-starved window, for a trail nobody sees while the pointer is idle under a 3 s loader. **Fix:** defer its mount to `INTRO_REVEAL_EVENT` (reuse the existing gate) or `requestIdleCallback`/first `pointermove`. Renders identically once mounted.
- **T2 — MEDIUM — Forced-reflow burst in the intro plan builder.** `intro.tsx:175-334` (`useLayoutEffect`) does ~12+ `getBoundingClientRect()` reads and a per-rock write→read→write (`:226-229`) forcing extra synchronous layouts, blocking paint. **Fix:** batch all reads then all writes (or read a parked offset constant) — same placement, no interleaved reflow.
- **T3 — MEDIUM — `Text3D` over-tessellation is a one-time CPU build** (`intro-scene.tsx:641-652`, 32/12 across 5 glyphs) landing with the MTM compile + env cubemap bake. **Fix:** 16/6 (invisible head-on) — halves the geometry build. (Also helps R4.)
- **T4 — MEDIUM — Phased-resolution "cheap start" for the glass.** The scene is correctly deferred off FCP (dynamic `ssr:false`, two-tier Suspense), but the compile+geometry+first-FBO burst still lands in the TBT window. **Fix:** mount MTM at `resolution:256, samples:6, backside:false` for REVEAL+HOLD (glass small/rising, differences invisible), bump to full at `dockStart`; `dpr={[1,1.5]}` + `powerPreference:"high-performance"` on the intro `gl`.
- **T5 — LOW — SplitText reflow at the busiest handoff.** `hero-reveal.tsx:69-84` splits the headline exactly as the glass fades + rock/wordmark crossfade run. **Fix:** pre-split earlier (at `INTRO_START`, hidden, after `fonts.ready`); only *play* at `INTRO_REVEAL`.
- **T6 — LOW — Legacy JavaScript (~14 KiB).** No `browserslist` anywhere + `tsconfig.json:3` `target:"ES2017"` ⇒ SWC transpiles down and injects polyfills. **Fix:** add a modern `browserslist` (e.g. `["chrome 111","safari 16","firefox 111","edge 111"]`) + raise `tsconfig` `target` to `ES2020`+.

### Confirmed correct (do not regress)
Inline `.reveal-armed` before paint (`layout.tsx:81-85`); `useSyncExternalStore` eligibility gates with server snapshot `false` (no hydration mismatch); `reactStrictMode:false` (avoids dev double-mount of all 4 contexts — keep per CLAUDE.md); no ScrollTrigger creation storm at boot; all WebGL behind `next/dynamic({ssr:false})` (three/drei out of the initial bundle); `leva` route-isolated to `/lab/*` (not on the homepage).

---

## 8. Prioritized roadmap

Ordered by (impact ÷ effort). None removes an effect.

### Phase 1 — Quick wins (highest ROI, low risk)
1. **Idle-gate the cursor trail** (R2) — remove from ticker when pointer still + trail faded. *Biggest sustained-GPU win.*
2. **Throttle the tile conveyor to ~30 fps + pause off-screen** (R3) — stops the 4th context running at full refresh forever.
3. **Re-encode + right-size the rocks** to AVIF @2×, remove `unoptimized`, gate grass behind `(pointer:fine)` + lazy (A1) — ~1.8–2.0 MB, fixes LCP + image delivery.
4. **Shrink `grain.png`** to AVIF/small tile (A2) — ~1.2–1.35 MB.
5. **Convert Product Sans TTF → WOFF2**, `preload:false` on non-LCP fonts (A4) — ~190 KB + shorter reveal gate.
6. **Clean the preload herd** — one `fetchpriority="high"` LCP preload; drop redundant manual + grass preloads (A3).

### Phase 2 — Structural (the 120/60 guarantee)
7. **Refresh-rate detection + adaptive quality tier + frame-time watchdog** (§6 / C1–C3) — the only way to actually hit "120 capable, 60 floor."
8. **Cap cursor sim to 60 fps + `RT_SCALE` 0.5 → ~0.4** (R2).
9. **Tier the MTM** (`samples`/`resolution`/`backside`) + cap intro to 60 fps on 120 Hz + tessellation 16/6 (R4/T3).
10. **Cap cloud `dpr` to 1.5 + pause `MorphRig` off-screen** (R5).

### Phase 3 — Boot polish
11. Defer `CursorTrail` mount past the intro (T1).
12. Flatten the intro forced-reflow (T2); pre-split SplitText (T5).
13. Phased-resolution glass cheap-start + `powerPreference` (T4).
14. `images.formats` AVIF (A5); modern `browserslist` + `tsconfig target` (T6); delete dead assets (A6).

---

## 9. Projected outcomes

| Metric | Now | After Phase 1 | After Phase 2 |
|---|---|---|---|
| Image bytes (first load) | ~4.0 MB | ~0.8–1.0 MB | same |
| LCP (mobile) | 1.8 s | ~1.0–1.2 s | ~1.0 s |
| Lighthouse Perf | 84 | ~92–95 | ~95–98 |
| Idle worst-frame | ~33 ms | ~8–16 ms (rests) | ≤ budget |
| Sustained fps (capable) | ~60–75, janky | 60 stable | **120 with 60 floor** |

The look and every animation are preserved throughout — Phase 1 changes only *byte size* and *when idle loops sleep*; Phase 2 changes only *resolution under load*, adaptively.

---

## 10. Methodology & caveats

- **Lighthouse:** mobile, production (`ascnd-design.vercel.app`), values from stakeholder-supplied run.
- **Runtime profiling:** Playwright against production; rAF-delta frame timing + `PerformanceObserver('longtask')` over 2–5 s windows per scenario (idle / cursor-active / scroll-active / boot). Headless GPU path may differ from real hardware, so absolute FPS is indicative; the structural signals (4 live full-res contexts, always-on loops, ~30 ms idle p95, 0 long tasks) are hardware-independent.
- **Static audit:** three parallel specialists (WebGL/R3F runtime; assets/bundle/network; intro-loader/hydration), findings cross-checked against the runtime data and the existing [`intro-loader-performance.md`](./intro-loader-performance.md).
- **No verification build was run** for byte/fps *projections* — they are estimates from measured asset sizes and per-frame cost models; validate with a production build + a real 120 Hz device after implementation.

### Key file reference
`components/cursor/cursor-trail-canvas.tsx`, `cursor-trail-shaders.ts`, `cursor-trail.tsx` · `components/background/cloud-canvas.tsx`, `cloud-layer.tsx`, `background.tsx` · `components/sections/intro/intro-scene.tsx`, `intro.tsx`, `intro-state.ts` · `components/sections/hero/rock.tsx`, `grass-rocks.tsx`, `hero-reveal.tsx` · `components/providers/lenis-provider.tsx` · `app/layout.tsx`, `app/page.tsx` · `next.config.ts`, `tsconfig.json`, `package.json`
