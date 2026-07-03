# Why-stay glass pill — in-place optimization report (2026-07-02)

**Scope:** optimize the EXISTING `GlassSurface` SVG-displacement mechanism (`components/ui/glass-surface.tsx` over the `why-stay` pinned reel) instead of the audit's F2.1 transform-based rebuild. Diagnosis + options only — **nothing implemented**.
**Baseline (from `webgl-animation-audit-2026-07-02.md`):** ~39.9 fps average through the pinned scrub, p95 33.4 ms, worst frame 358 ms at pin-engage, plus a React hydration mismatch on every load (H1).
**Decision context:** the stakeholder prefers keeping the real per-pixel refraction over rebuilding the look with transforms.

---

## 1. Where the cost actually comes from

Per frame in which the pill's backdrop changes, Chromium must:

1. **Rasterize the backdrop sample region** — the pill is 876×133 CSS px; at dpr 2 that's 1752×266 ≈ 466k device px (no dpr knob exists for DOM backdrops — unlike our canvases, this can't be capped at 1.5).
2. **Run the filter chain** — `feImage` (map) → **3× `feDisplacementMap`** → **3× `feColorMatrix`** → **2× `feBlend`** → **1× `feGaussianBlur`** → `saturate(1)` appended in `backdrop-filter`. That is ~10 full-region passes ≈ 2.4–4.2 M pixel-ops per evaluation. `feDisplacementMap` does per-pixel dependent reads and frequently takes Chromium's software (Skia raster) path — consistent with the measured collapse.
3. **Composite** the result.

**When does it re-evaluate?** Any frame the sampled backdrop changes:

| Invalidation source | Rate | Note |
|---|---|---|
| `--reel-y` scrub writes (entrance + pin) | up to **120/s** on a 120 Hz panel | ScrollTrigger updates at scroll-event rate; `scrub: 0.8` keeps writing while it eases to rest, including **sub-pixel deltas** that re-filter for invisible movement |
| **`whystay-left` section cloud** (`cloud-specs.ts:77`) morphing + sliding on the fixed canvas behind the section | **30/s while the section is on screen — even with no scrolling** | Unverified how tightly Chromium clips this to the pill's sample region — needs a trace (§3, O9). If it invalidates, the pill re-filters at 30 fps *while idle* |
| Pill entrance `scale: 0.96 → 1` | per entrance frame | geometry change → re-raster |
| Sky fill + grain | static | free |

The 358 ms pin-engage spike = first full-res filter rasterization landing on the same frame as ScrollTrigger's pin re-layout (position swap + pin-spacer).

---

## 2. Optimization options — ranked

Ordering favours: no look change → look-preserving with A/B → look-trades. Effort: S/M/L.

### O1 — Tier-gate to the built-in frost path (audit F2.4) — S, zero look change on capable machines
`GlassSurface` already ships a full frosted fallback (`blur(22px)` — a compositor-accelerated filter) for Safari/Firefox. Wire the quality tier so `low` takes that same branch on Chromium too. This is the **guaranteed 60-fps floor** the quality system promises but currently can't deliver here (the audit's headline: the profiled session sat at tier `low` and still janked, because the two heaviest consumers read no tier). Also adds `GlassSurface` to the `tiers.ts` consumer registry, as the new heavy-effect contract requires.
**Impact:** floor guarantee on weak GPUs. **Risk:** none on strong hardware (nothing changes there).
**Decision (2026-07-02, implemented):** the gate is **latched, not live** — a reactive gate would let a mid-pin watchdog step-down swap the material in front of the user (rejected by the stakeholder as a visible downgrade). The gate follows the store only while the pill is far off-screen and freezes permanently as the section approaches the viewport: weak machines get the fallback from the pill's very first appearance; everyone else keeps the displacement for the whole session, even if the watchdog later demotes the rest of the page.
**Decision 2 (2026-07-02, superseded by Decision 3):** the low-tier fallback was first changed from frost to **clear glass** — `blur(22px)` over the bright reel read as a milky blue bar (stakeholder-rejected).
**Decision 3 (2026-07-02, implemented):** after Wave 3 measured the **single-map variant at ~58 fps in software raster** (the weak-GPU worst case), tier `low` was upgraded from clear glass to the **single-map displacement + static chromatic ring** — real distortion, chromatic accent, ~⅓ the chain cost — so low resembles high/medium closely instead of losing the effect. Final tiering: high/medium → full 3-channel chromatic chain; low → single-map + static ring; Safari/Firefox → clear glass + static ring (no `backdrop-filter`).
**Decision 4 (2026-07-02, implemented):** the Gecko/Safari **engine frost was replaced with clear glass + the static chromatic ring** — the stakeholder rejected the frost on Mozilla engines just as on low tier. Also the ring's gradient is **cool at both ends** (the original warm-pink start read as a purplish smudge on the left rim; both sides now match the right side's cyan cast).
**Decision 5 (2026-07-02, implemented):** frost eliminated component-wide — a dark-OS Firefox still frosted through the vendored **dark-mode** fallback branch (`blur(12px)`). The whole vendored fallback ladder (dark/light frosts, no-backdrop statics) collapsed into ONE rule: **displacement running → the chain; anything else → clear glass + ring.** No `backdrop-filter` exists outside the displacement chain anymore, on any engine or OS theme.
**Decision 6 (2026-07-03, implemented):** the **single-map + static-ring variant is promoted from tier `low` only to ALL tiers** on Chromium — the 3-channel chromatic chain is retired for this pill entirely. The chain re-evaluated every scrolled frame (the sampled backdrop is the moving reel text — irreducible for the mechanism), which kept the pinned scrub off max fps even on capable machines; running the ~⅓-cost single-map chain uniformly makes every device pay the same minimal per-frame cost. Look trade accepted: high/medium lose live rim dispersion for the static ring (Decision 3 already validated single-map as "close to high/medium"). Implementation: the consumer (`why-stay.tsx`) now passes `chromatic={false}` directly, and `GlassSurface` no longer reads the quality tier — the viewport-latched tier gate (Decision 1 / O1) was removed as dead code. Final tiering: **all Chromium tiers → single-map + static ring; Safari/Firefox → clear glass + static ring.**
**⚠️ This is NOT a 120 fps guarantee** — per §3/§5 below, `feDisplacementMap` may stay on Chromium's software-raster path and the backdrop rasterizes at full device resolution with no dpr cap. Decision 6 targets a **locked ~60 during the pin on every tier** (removing the section's status as the page's slowest moment); the only guaranteed-120 paths remain the F2.1 transform rebuild or a WebGL pill. Verify on the target GPU with the DevTools FPS meter, not rAF sampling.

### O2 — Scope the backdrop with a Backdrop Root (`isolation: isolate` on the stage) — S + A/B, potentially the biggest lever
Per the Filter Effects 2 spec, `isolation: isolate` on an ancestor forms a **Backdrop Root**: the pill's `backdrop-filter` would then sample **only the stage subtree** (the reel text) — not the sky, grain, or the fixed cloud canvas.

- **Decouples the filter from the clouds entirely** — the 30 fps idle invalidation source (§1) disappears by construction.
- The sampled image becomes big white text on transparency instead of the full composited page — simpler raster input.
- **Look:** the visible refraction is all *text* — bending a flat `#62abff` sky is imperceptible, so the sky simply shows through unbent. Near-identical, but the channel-split screen-blend over *transparency* (vs over sky-blue) can shift the rim tint subtly → **must be A/B'd in Chromium**.

One CSS property on `[data-whystay-stage]`. If the A/B holds, this is the highest value-per-line change available.

### O3 — Cut the chain to one `feDisplacementMap` (audit F2.2) — M, small look trade
The three per-channel maps differ only by scale offset (−180 / −170 / −160); they exist solely for the chromatic rim. Single displacement (mean scale) + drop the 3× `feColorMatrix` + 2× `feBlend` → chain goes from ~10 passes to ~3 (**≈ ⅓ the filter cost** — the audit's own estimate). Recover the chromatic rim statically: the pill already carries layered inset shadows; add a subtle static RGB-fringe rim (gradient border or a painted rim in the map's own SVG — that raster is one-time, not per-frame).
**Risk:** the per-channel dispersion *moves with the text* today; a static rim doesn't. Needs a side-by-side. This is the main look-trade item — keep it for a later wave if O2+O5 measurements already land 60.

### O4 — Delete the near-no-op passes — S, ~zero look risk
- `feGaussianBlur` runs at `stdDeviation 0.5` (`displace={0.5}`) — a full-region convolution for a half-pixel soften. Remove it; if rim jaggies appear, bake extra blur into the displacement map instead (that blur is rasterized once inside the `feImage`, not per frame).
- `backdrop-filter: url(#id) saturate(1)` — `saturate(1)` is an identity op but still a filter stage; omit it when `saturation === 1` (our config).

Two fewer passes per evaluation, free.

### O5 — Cap + quantize the `--reel-y` writes — M, invisible by the site's own argument
The DOM analog of the shipped `makeCappedInvalidate` (F4.2):
1. **Throttle** the CSS-var writes to `heavyEffectFpsCap()` (60 on 120 Hz panels, lower on stepped tiers) with the same trailing-write guarantee, so a scrub can never park one frame stale. Halves filter evaluations while scrolling on fast panels — the same strictly-invisible saving already accepted for the cloud canvases.
2. **Snap to whole device pixels** (`Math.round` in the writer / GSAP `modifiers`). `scrub: 0.8` currently keeps emitting sub-pixel deltas while easing to rest — each one re-runs the full chain for movement nobody can see. Snapping also ends the settle-tail several frames earlier.

**Risk:** none visually (95 px bold text drifting at ≤ a few px/frame does not need 120 Hz updates); implementation must reuse the existing accumulator pattern, not a second scheduler.

### O6 — Kill the 358 ms pin-engage spike — S/M
The entrance animates the pill with `autoAlpha` — while `visibility: hidden`, Chromium skips the filter entirely, so the **first full-res rasterization** can land exactly on the pin frame (worst case: a load parked mid-page, where entrance + pin resolve on the same frame). Warm it:
- Pre-raster once, early: as the section approaches (e.g. `top 120%`), flip the pill to `visibility: visible; opacity: 0.01` for a frame so the first filter evaluation happens on a quiet frame, then let the real entrance take over. (Below ~`opacity: 0.01` some engines still skip — verify in the trace that the warm frame actually rasters.)
- Re-measure the engage frame after; if pin re-layout remains the dominant slice, that part is ScrollTrigger-structural (`anticipatePin` was deliberately rejected for its Lenis snap — leave it).

### O7 — Map-generation hygiene — S, fixes hitches (not scroll-frame cost)
- **Mount generates the displacement map twice** (`useEffect([])` and `useEffect([width, height])` both fire `updateDisplacementMap` on mount) — each one builds + `encodeURIComponent`s an SVG string that `feImage` must decode *and rasterize including a 12 px blur*.
- The `ResizeObserver → setTimeout(0) → regenerate` path re-does that on **every resize tick**; debounce (~100 ms trailing) and skip when the size didn't actually change.
- Optional (audit F2.2): pre-render the map once to a canvas → PNG data-URI so `feImage` decodes a bitmap instead of re-rasterizing an SVG-with-blur. Only worth it if traces show map decode inside resize/mount hitches.

### O8 — Fix the SSR/hydration mismatch (H1) — S, correctness + one wasted re-render per load
`getContainerStyles()` branches on `CSS.supports(...)`/`svgSupported` **during render**: the server takes the no-`backdrop-filter` branch, the client's first render takes the frost branch → React logs a mismatch and re-renders the tree on every load (verified in dev; prod recovers silently but still re-renders). Fix per the heavy-effect contract: SSR and first client render must emit identical styles (render the base/fallback, upgrade to the displacement branch in an effect after mount). The component already has the `svgSupported` state — the *inline style* just must not consult `CSS.supports` until mounted.

### O9 — Measure the cloud↔pill invalidation coupling — S (measure first, act after)
Superseded by O2 if isolation lands. If O2 fails the A/B: trace whether the `whystay-left` morph repaints force pill re-filters while idle (DevTools Performance + paint flashing while pinned, hands off the wheel). If they do, pause that cloud's morph while `[data-whystay]` is pinned (the SectionRig already knows visibility) — spec `cloud-specs.ts:77` sits far left (ndc −0.78) so a `speed=0` hold during the pin is likely unnoticeable anyway.

---

## 3. What this can and cannot achieve — honest expectations

- **O1 + O5 + O4 + O7 + O8** are look-identical and low-risk: they cut evaluation *rate* (~½ at 120 Hz), remove ~2 of ~10 passes, and delete the load/resize hitches. Realistic outcome: the scrub moves from ~40 fps toward **stable 60 on strong hardware**, with `low` guaranteed 60 via frost.
- **O2** is the wildcard: if Chromium's backdrop-root scoping behaves per spec, idle cost drops to zero and per-frame raster input simplifies — possibly enough to hold 60 with margin, occasionally more.
- **O3** buys the remaining ~⅔ chain reduction but trades the live chromatic rim for a static one — only spend it if the measurements above still miss 60.
- **120 fps through the pin is NOT promised by any of this.** `feDisplacementMap` may stay on Chromium's software raster path regardless of how few passes remain; the backdrop rasterizes at full device resolution with no dpr cap. The audit's verdict stands: the F2.1 transform rebuild remains the only *guaranteed*-120 path. Recommended framing: **target = locked 60 during the pin on every tier** (which alone removes the section's status as the slowest moment on the page), and treat anything above as a bonus.

## 4. Suggested order + verification

| Wave | Items | Gate to proceed |
|---|---|---|
| 1 — free wins | O8, O7, O4, O5, O1 | `lint` + `build`; DevTools **FPS meter** (ground truth — not rAF) through the pin on the 120 Hz panel; Performance trace of pin-engage |
| 2 — the lever | O2 (+ O6, + O9 trace) | A/B screenshots of the rim over the brightest phrase; idle-pinned trace shows zero filter re-evals |
| 3 — only if still < 60 | O3 (single map + static rim) | side-by-side look approval before merging |

Per-wave measurement scenarios (mirror the audit §1 table): idle pinned (hands off), slow scrub through the pin, fast flick through the pin, and the entrance frame — worst-frame and p95 each time.

---

## 5. Wave 1 + 2 — measured results (2026-07-02, dev server, software-raster Chromium @60 Hz)

All Wave-1 items landed (`c1e3ba3`…`4b95a8c`; O1's gate is latched + falls back to **clear glass**, not frost — see the two decision notes in §2). Wave 2: **O2 implemented**; **O6 skipped** (no spike left to warm away); **O9 moot** (isolation excludes the fixed layers by construction).

| Scenario | Audit baseline | After W1+W2 | Note |
|---|---|---|---|
| Pin-engage worst frame | **358 ms** | **50 ms** | the dedicated spike is gone (map dedupe + smaller chain); 50 ms = an ordinary scrub frame in this env |
| Scrub through pin | ~40 fps avg | 42–53 fps avg (run variance) | still **entirely** filter-bound, see below |
| Same scrub, pill hidden | — | **60 fps flat** (p95 16.7) | pin + reel + mask + Lenis cost nothing |
| Same scrub, clear glass (no filter) | — | **60 fps flat** | the low-tier fallback is free |
| Idle pinned | — | 60 fps, isolate on or off | no main-thread cloud coupling measurable here |
| O2 look A/B | — | **pixel-identical** | screenshots at the same scroll position; rim refraction + chroma unchanged |

**Interpretation.** The remaining cost during the scrub is *irreducible for this mechanism*: the sampled backdrop is the moving text itself, so every scrolled frame legitimately re-runs the chain — isolation can't help with that (its value is idle decoupling + smaller raster input, both confirmed free to keep). These numbers are from a **software-raster** environment; on real GPU-raster hardware the chain is lighter — verify on the target machine with the DevTools FPS meter. If it doesn't lock 60 there, the remaining paths are **O3** (single map, ~⅓ chain — may lock 60, won't reach 120) or the **WebGL pill** (guaranteed 120, exact look, full knob control — the text is static content, so refraction becomes a one-quad SDF shader over a texture atlas; see the discussion of 2026-07-02).
