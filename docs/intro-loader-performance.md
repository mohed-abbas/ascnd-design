# Intro & Loader — WebGL Performance Analysis

> **Status:** Analysis only — none of the recommendations below are applied. The
> codebase is at commit `a97c9cb`. This document is the reference for the work if
> we choose to do it.
> **Date:** 2026-06-30

**Scope:** `components/sections/intro/intro.tsx` (orchestrator),
`intro-scene.tsx` (the R3F stage), `intro-loader.tsx` (the DOM cover),
`intro-state.ts`, `components/providers/lenis-provider.tsx`, and the concurrent
`components/background/cloud-canvas.tsx` / `cloud-layer.tsx`.

**Stack:** Next 16.2.9 · React 19.2 · three 0.183 · @react-three/fiber 9.6 ·
@react-three/drei 10.7 · gsap 3.15 · lenis 1.3.

---

## 1. Verdict (read this first)

- **The loader is clean.** It is pure DOM/CSS (`transform`/`opacity` only,
  compositor-friendly), correctly gated, and adds essentially zero GPU cost. No
  action needed there.
- **The FPS drop is real and almost entirely caused by one thing:** the
  `MeshTransmissionMaterial` on the glass, amplified by **two cloud WebGL
  contexts repainting at 30 fps concurrently** during the exact ~2.4 s window
  when the glass is most expensive. Both are fixable without changing the look
  meaningfully.
- **120 fps is already _enabled_** — nothing in the code caps you at 60. GSAP,
  Lenis, and R3F `frameloop="always"` all ride `requestAnimationFrame`, which
  fires at the display's native refresh rate (120 Hz on ProMotion / high-refresh
  panels). The DOM/loader animations _already_ run at 120 fps on capable
  hardware. The blocker is purely **GPU frame budget**: at 120 fps you have
  **8.33 ms/frame** instead of 16.67 ms, and the current glass material cannot
  finish in 8.33 ms on most GPUs. Lower the per-frame cost (below) and the WebGL
  portion can reach 120 too.

---

## 2. What's done right (don't regress these)

The architecture is genuinely well-engineered for performance. Catalogued so the
fixes don't undo it:

| Decision | Why it's correct |
|---|---|
| Single shared rAF — GSAP ticker drives Lenis, `lagSmoothing(0)`, `autoRaf:false` | No competing schedulers; the canonical Lenis+GSAP integration |
| Intro flips `frameloop` `"always"` → `"demand"` after dock | The persistent canvas goes nearly free once the glass is gone |
| Cloud canvas is `demand` + 30 fps throttled pump | Avoids a free-running second rAF for the steady state |
| Env cubemap baked with `frames={1}` | Reflections rendered once, not per-frame |
| Lazy `dynamic(ssr:false)` intro chunk + warm-prefetch on `shouldPlay` | Download overlaps the DOM measure |
| Two-tier `<Suspense>` — tiles on their own boundary | 7 shot textures don't block the ready gate |
| `introWillPlay()` gating (reduced-motion / no-WebGL / mobile / mid-page) | Visitors who can't benefit never pay |
| `NoToneMapping` set in `onCreated` | Correct for the flat-colour pipeline |
| GSAP **duration-based** tweens for the whole timeline | Frame-rate _independent_ — the intro choreography is already 120 fps-correct (see §5 for the one exception) |

---

## 3. Root-cause analysis of the FPS drop (ranked)

### 🔴 #1 — `MeshTransmissionMaterial` is configured far above drei defaults

`intro-scene.tsx` (the `<Text3D>` glass material):

```
samples={10}        // drei default: 6
resolution={1024}   // drei default: 256  → 16× the pixels
backside={true}     // drei default: false → doubles the FBO render passes
backsideThickness={0.4}
temporalDistortion={0.28}
```

Per frame, this material:

1. Hides the glyph and **renders the whole scene into a transmission FBO** at
   `resolution` (1024²).
2. Because `backside={true}`, does that render **a second time** for the backside
   pass (defaults to the same 1024²).
3. In the final shader pass, runs the roughness/anisotropic blur loop
   **`samples`=10 times** per fragment.

So the cost driver is roughly **2 full-scene FBO renders at 1024² + a 10-tap
blur**, every frame, for the ~2.4 s the glass is on screen. This is the dominant
term in the drop. `resolution=1024` is the single biggest lever (cost scales with
pixel count: 1024²→512² is a **4× reduction** per pass).

### 🔴 #2 — Three WebGL contexts compete during the welcome

During the intro, **three** canvases are live:

- `intro-scene` — `frameloop="always"` (vsync).
- `cloud-canvas` (SKY layer) — `demand`, but `MorphRig` pumps `invalidate()` at
  **30 fps unconditionally**.
- `cloud-canvas` (ROCK-base layer) — same, a second 30 fps pump.

The clouds (`<Cloud segments={20}>` × N = hundreds of overdraw-heavy transparent
billboards) steal GPU from the glass at the moment it needs it most — and the
clouds are barely noticeable during a 2.4 s glass reveal. The cloud canvas has
**no awareness of the intro lifecycle**, so nothing throttles it. The cloud
fade-in is pure CSS on the wrapper, so pausing the morph pump during the intro
does **not** affect that fade.

### 🟠 #3 — `dpr={[1, 2]}` on the intro canvas

The intro wrapper is `fixed inset-0` (full viewport). At DPR 2 on a 1512×982
hero the backbuffer is ~3024×1964, and the MTM FBO work compounds on top. The
glass is viewed through a telephoto lens almost head-on and is very forgiving of
resolution — DPR 2 buys little here and costs a lot of fill. This is why the drop
is worse on retina / hi-DPI laptops.

### 🟠 #4 — No GPU preference hint

Neither canvas sets `powerPreference: "high-performance"`. On dual-GPU laptops
(common on Linux / macOS), the browser may bind the **integrated** GPU, which
alone can explain a "subtle but persistent" drop. One-line, zero-risk change for
the intro canvas. (Leave the always-mounted cloud canvases on the default profile
so the dGPU isn't pinned on for the whole session = battery.)

### 🟡 #5 — Minor / informational

- `temporalDistortion={0.28}` animates the refraction over time, so the FBO is
  legitimately dirty every frame — it prevents any static-frame caching during
  the HOLD beat. Intentional for the "living glass" look; just know it's why the
  canvas can't idle while visible.
- `makeRoundedAlpha` builds a 256² `CanvasTexture` per tile (×7) — one-time,
  negligible.
- `frameloop="always"` repaints during the 0.45 s HOLD even though only
  `temporalDistortion` changes — negligible next to #1.

---

## 4. Can it run at 120 fps?

**Yes — and you're closer than it looks.** Three layers, three answers:

1. **Loader + GSAP timeline + Lenis (DOM):** Already 120 fps on a 120 Hz display,
   today, with no change. rAF fires at the panel's refresh rate; GSAP's ticker
   and Lenis both ride rAF with no artificial cap (`gsap.ticker.fps()` is never
   set).
2. **R3F intro canvas:** `frameloop="always"` paints **every** rAF — so it's
   _uncapped_ and will _attempt_ 120 fps on a 120 Hz panel. There is no 60 fps
   lock anywhere. The only question is whether the GPU finishes a frame in
   8.33 ms.
3. **The actual bottleneck:** with the current MTM settings, **no mainstream GPU
   finishes the glass frame in 8.33 ms**, so the WebGL layer drops below 120 even
   though it's trying. Fix §3's cost (samples, resolution, backside, DPR) and the
   glass can hold 120 on a decent dGPU; on integrated GPUs it'll land somewhere
   between 60–120 but smoother than today.

**To make 120 fps real (not just enabled):**

- Apply the §5 cost reductions (this is the whole game — 120 fps is a
  frame-budget problem).
- Add drei `<PerformanceMonitor>` to **adaptively drop DPR** under load and
  restore it when headroom returns — lets the same build hit 120 on strong GPUs
  and degrade gracefully on weak ones instead of stuttering.
- Keep `frameloop="always"` for the intro (correct — don't switch to demand
  mid-reveal).

**One real 120 fps _correctness_ bug:** `rock-hover.tsx` uses a per-frame lerp
`FOLLOW = 0.18` applied once per `tick`. This is **frame-rate dependent** — at
120 fps the reveal disc chases the cursor ~2× faster than at 60 fps, so the hover
"feel" changes on high-refresh displays. The intro itself is immune (all
duration-based GSAP), but this hover isn't. Fix by making the lerp time-based off
the ticker's `deltaTime` (ms):

```ts
// frame-rate-independent smoothing (≈ same feel at any refresh rate)
const tick = (_time: number, deltaTime: number) => {
  const k = 1 - Math.pow(1 - FOLLOW, deltaTime / (1000 / 60));
  state.x += (target.x - state.x) * k;
  state.y += (target.y - state.y) * k;
  apply();
};
```

---

## 5. Prioritized recommendations

Ordered by impact-to-effort. Estimated GPU savings are relative to the current
glass frame cost; treat as directional, not measured.

| # | Change | File | Est. impact | Risk |
|---|---|---|---|---|
| 1 | `resolution={1024}` → **`512`** | `intro-scene.tsx` | ~−75% FBO fill per pass | Negligible visual (telephoto, head-on) |
| 2 | `samples={10}` → **`6`** | `intro-scene.tsx` | ~−40% blur cost | Very low — 6 is drei's default |
| 3 | `backside={true}` → **`false`** (test); if kept, add `backsideResolution={256}` | `intro-scene.tsx` | Removes one full FBO pass | Low for flat text — A/B it |
| 4 | Intro canvas `dpr={[1, 2]}` → **`[1, 1.5]`** | `intro-scene.tsx` | Big fill reduction on retina | Low |
| 5 | `gl={{ …, powerPreference:"high-performance" }}` (intro canvas only) | `intro-scene.tsx` | Can be decisive on dual-GPU laptops | None |
| 6 | **Freeze cloud morph during the intro** — `MorphRig` pauses its 30 fps pump while the intro plays, resumes at the dock (`INTRO_REVEAL_EVENT`, with a failsafe) | `cloud-canvas.tsx` | Frees two whole contexts' GPU during the drop window | Low — clouds are static-ish anyway |
| 7 | Add drei **`<PerformanceMonitor>` + `<AdaptiveDpr>`** to the intro canvas | `intro-scene.tsx` | Enables real 120 fps with graceful fallback | Low |
| 8 | Make `rock-hover` lerp **time-based** (`deltaTime`-scaled) | `rock-hover.tsx` | 120 fps _correctness_, not perf | Low |

**Suggested first pass (one commit, ~5 lines):** #1 + #2 + #4 + #5. Highest
confidence, lowest risk; together they should roughly halve the glass frame cost
— likely enough to erase the "subtle drop" at 60 fps and get most of the way to
120 on a dGPU. Then measure before touching #3 / #6 / #7.

---

## 6. How to verify (no test runner exists — this is manual)

1. **Identify the GPU actually in use:** in the DevTools console on the live page,
   ```js
   const gl = document.createElement('canvas').getContext('webgl');
   const e = gl.getExtension('WEBGL_debug_renderer_info');
   gl.getParameter(e.UNMASKED_RENDERER_WEBGL);
   ```
   confirms integrated vs discrete (validates #5).
2. **Baseline the drop:** Chrome DevTools → Performance, record across the intro.
   Watch the GPU track and frame durations during the ~2.4 s glass window. Note
   ms/frame.
3. **Drop in drei `<Stats>`** (or `<PerformanceMonitor onChange>`) temporarily to
   read live fps/ms during the reveal.
4. Apply a change set, re-record, compare ms/frame in the same window.
5. **Test on a 120 Hz panel** (needs real hardware — DevTools can't emulate
   refresh rate) to confirm the timeline hits 120 and the glass holds.
6. `npm run lint && npm run build` for correctness. Per project conventions, the
   dev server is the user's to run — don't start it to verify.
