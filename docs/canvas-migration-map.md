# Canvas consolidation — Phase 2–4 migration map

**Companion to `docs/canvas-consolidation-plan.md`.** Produced 2026-07-18 by a
full audit of every paint driver in the three migrating features, after Phase 0
passed. Core invariant confirmed: **every paint currently flows through
`invalidate()` or a private `advance()`/`gsap.ticker.add` loop** — and
`invalidate()` is a no-op under `frameloop="never"`, so every driver below gets
rewired to the host's `markDirty`/`requestBurst` API.

## Cross-cutting conflicts on the FRONT canvas

- **Tone mapping is 3-way, not 2-way:** intro `NoToneMapping` · testimonial
  rocks `AgXToneMapping` (+ `toneMappingExposure 1.15`) · clouds ACES (R3F
  default). The Phase-0 per-view setter handles it (materials are already
  distinct instances per feature), but each view needs its own setter, and the
  rocks' setter must also set/restore `toneMappingExposure`.
- **`antialias` is a context-creation flag — one value per shared context.**
  Intro deliberately runs `false` (MSAA×dpr was its dominant measured cost);
  rocks (GLB silhouette — would visibly degrade) and clouds (alpha sprites —
  AA ~free/irrelevant) currently run `true`. **The sharpest unresolved decision
  of Phases 2–4**; the host keeps it per-plane config so it's a one-line change.
- **`powerPreference`:** intro wants `"high-performance"`; clouds deliberately
  leave default. One context, one value — decide at migration.
- **dpr is NOT a conflict:** all three effectively cap at `[1, 1.5]`
  (`cloudDprMax` high/med = 1.5, low = 1.25; the `cloud-canvas.tsx` header's
  "dpr up to 2" comment is stale — the code reads `cloudDprMax`). Only global
  event: the intro's dpr-1 welcome window (plan already accepts canvas-wide).
- **`advance()` unit = SECONDS** (`gsap.ticker.time`). The testimonial canvas
  currently calls `advance(t * 1000)` (ms) — harmless standalone, but on the
  shared host the ms form would corrupt co-resident cloud morph / MTM time.
  Reconcile to seconds at migration.

---

## 1 · Intro / conveyor tiles → FRONT (Phase 2)

Files: `components/sections/intro/intro-scene.tsx` (scene + rigs), `intro.tsx`
(GSAP choreographer), `intro-state.ts` (event gate), `intro-loader.tsx` (DOM
cover, no canvas).

### Paint-driver inventory

| Driver | Location | Trigger | Current rate policy | Under host contract |
|---|---|---|---|---|
| `IntroFrameCap` | intro-scene.tsx 1024–1052 (`gsap.ticker.add` 1047; `invalidate()` 1031/1045) | per tick while `introActive` | `heavyEffectFpsCap()`, remainder-carry | **continuous**, cap **"heavy"**, markDirty each tick while `introActive` |
| `ConveyorRig` | 620–722 (`invalidate()` 685; tween `onUpdate` 688–694) | `gsap.to` p:0→1 repeat:-1 | `heavyEffectFpsCap()` inline (652–660) | **continuous**, cap **"heavy"**, markDirty per throttled tick |
| ConveyorRig off-screen pause | 700–713 | `[data-hero]` ST `start:"bottom top"` | pause/resume + `invalidate()` | stop markDirty when hero gone; burst(1) on re-entry |
| `ScrollRig` (tile field y) | 731–804 (`makeCappedInvalidate` 745) | ST `scrub:true` onUpdate 779 | `scrollRepaintFpsCap()` + trailing paint | **demand**, cap **"scroll"**, markDirty on scroll |
| ScrollRig off-screen gate | 753–774 | `[data-hero]` ST | writes position always, skips paint offscreen | keep write, gate the markDirty |
| ScrollRig refresh re-seed | 793–794 | ST "refresh" | `apply(st.scroll())` | markDirty after re-seed |
| `Glass` sky crossfade | 890–922 (`invalidate()` 916) | mode change tween | uncapped short tween | **demand**, markDirty per tween tick |
| `SceneReady` mount burst | 820–850 | `gl.compileAsync` + 2 painted frames → `onReady` | 1.5s failsafe | **requestBurst** after mount (≥2 frames or `onReady` never fires) |
| `Rocks`/`Tiles` per-frame writers | 286–300, 517–539 | `useFrame` reading entry refs | run when a frame paints | host-registered per-frame updaters |

### Non-paint entanglements

- **Camera:** PerspectiveCamera z=40, **fov 11.82°**; z=0 plane height =
  8.284 world units → `wpp = 8.284/innerHeight`; `intro.tsx` 216–219 converts
  DOM px → world with this factor (+ `ROCK_DEPTH`/`TILE_DEPTH` compensation).
  Survives under a per-view camera **only if the View placeholder is
  full-viewport fixed** — else the px→world mapping desyncs.
- Tone mapping via `onCreated` (1152) → becomes the per-view setter.
- MTM FBO must see only the intro view's scene (Phase-0 proved; re-verify on
  the real FRONT canvas). Quality tier mount-snapshotted (929) — keep.
- dpr swap `introActive ? 1 : [1,1.5]` (1133) → per-plane dprOverride hook.
- Pointer: canvas + wrapper both pointer-events none — passive, fine.
- CSS: wrapper `fixed inset-0 z-[60]`; scroll moves tiles in-world, not DOM.
- Suspense: ready gate (rocks+font+env) + separate tiles boundary — preserve.
- Dev hooks to preserve: `?introaa` (now gates the whole FRONT context),
  `?introdpr`, `?noglass`, `?intro=force|skip`, `?introslow`, `?intropos`.
- Lifecycle: `INTRO_START`/`INTRO_REVEAL` events feed clouds + hero reveals;
  `introActive→false` at onComplete is the heavy→steady transition. Keep.

### Risks
- MTM FBO leaking other views' scenes → glass refracts rocks/clouds.
- AA-off FRONT softens the GLB rock silhouette (cross-cutting decision).
- dpr-1 welcome dims the whole FRONT canvas (accepted; nothing else visible).
- Non-full-viewport placeholder desyncs the px→world mapping.
- `SceneReady`'s 2-frame count needs a guaranteed mount burst.

---

## 2 · Testimonial rocks (Phase 3)

Files: `testimonial-rocks-canvas.tsx` (already `frameloop="never"` +
`advance()`), `testimonial-rocks.tsx` (wrapper/eligibility/mount),
`testimonials.tsx` (DOM section + stacking), `testimonials-reveal.ts`,
`testimonials-quote-advance.ts`, `testimonials-data.ts`.

### Paint-driver inventory

| Driver | Location | Trigger | Current rate policy | Under host contract |
|---|---|---|---|---|
| `Scene.pump` | canvas 401–428 (`advance(t*1000)` 411, private `gsap.ticker.add`) | every tick while `!paused \|\| revealing` | `heavyEffectFpsCap()`, remainder-carry | **continuous**, cap **"heavy"**; drop the private ticker — host advance replaces it |
| Per-rock updaters | Rock 281–308 via `register` | called by pump each frame | — | host per-frame updaters; **t stays SECONDS** |
| Reveal fly-in | Rock 314–338 | ST reveal gate → GSAP tween of `offset` | pump renders every frame | tween unchanged; host keepalive |
| Scene reveal fade + keepalive | 435–478 | ST reveal fired inside scroll callback | `revealTotal` delayedCall then idle | host must allow **synchronous** "start advancing now" from the ST callback |
| Warm frame | 485–488 | mount (idle-warmed) | single paint at opacity 0 | requestBurst(1) on mount |
| `ContextWatchdog` | 528–572 | context lost/restored | remount via key if >3s | folds into host watchdog |
| Hover → quote | Rock 348–358 (dodge raycast 235–256, `requestQuoteAdvance`) | pointer over mesh | — | needs **eventSource** on the View placeholder |

### Non-paint entanglements
- `AgXToneMapping` + `toneMappingExposure 1.15` (595–597) → per-view setter
  incl. exposure.
- Orthographic camera, 1 world unit = 1 px (598) — per-view camera, survives.
- `antialias: true` (590) — cross-cutting conflict.
- **CSS/stacking (the crux):** canvas is absolute, IN-FLOW inside a
  120vw/120vh centred div inside the section — it scrolls with the section
  (a View placeholder there tracks it for free). But in DOM paint order the
  rocks render **behind** the ring outlines and the `z-10` pull-quote.
- Eligibility/warm-mount: `useSyncExternalStore` gate + idle GLB preload;
  deliberately NOT tier-gated, NOT IO-gated; `paused = !inView` from a
  ScrollTrigger visibility gate. Preserve all.
- `useGLTF` GLB (version-suffixed, immutable-served) + procedural PMREM env
  baked from `gl` — the env bake will use the shared renderer.

### ⚠ Stacking resolution (the plan's flagged investigation)

**A fixed FRONT canvas at z-61 WOULD cover the pull-quote** (quote is `z-10`
inside an un-z-indexed section; rocks today paint behind it by DOM order).
Options, preferred first:
1. **A dedicated in-band "MID" plane below content text** (rocks don't
   straddle content — they sit behind one section's own text; they don't
   belong on the z-61 overlay). Host planes are config-driven to make this
   additive.
2. Keep z-61 FRONT and promote the quote + rings above it (`z-[62]`+) —
   works, pollutes global z-order.
3. Don't migrate the rocks (own canvas stays) — lowest risk, forfeits the win.

**Recommendation: option 1.** Resolve before porting the pump.

### Risks
- Rocks over the quote if put on z-61 (above).
- Hover/dodge dead without eventSource wiring.
- ms-vs-seconds advance corrupts co-resident views on the shared host.
- Losing AA degrades the GLB silhouette.
- Reveal must start advancing synchronously from the ST callback or the
  "rocks only appear on scroll-stop" bug returns.

---

## 3 · Clouds → REAR + FRONT (Phase 4, currently `FLAGS.clouds=false`)

Files: `cloud-layer.tsx` (mount/eligibility/split), `cloud-canvas.tsx` (rigs),
`cloud-specs.ts` (SKY_CLOUDS/ROCK_CLOUDS). The mobile DOM sprite fallback
(`static-cloud-*`) is the ineligible-device path — unaffected.

**Split per plan:** SKY_CLOUDS (behind content, `-z-10`) → REAR view;
ROCK_CLOUDS (in front of cliffs, `z-[61]`) → FRONT view. `cloud-layer.tsx`
today mounts two `<CloudCanvas>` instances; each becomes a View.

### Paint-driver inventory

| Driver | Location | Trigger | Current rate policy | Under host contract |
|---|---|---|---|---|
| `MorphRig` (living billow) | cloud-canvas 484–539 (`invalidate()` 516/528, `gsap.ticker.add` 518) | ticker, 30fps STEP | fixed 30fps, gated by `cloudsOnScreen` + `activeClouds` | **continuous**, cap **30**, markDirty per step; idle when gated |
| MorphRig off-screen gate | 523–530 | trigger-less ST (`pumpUntilVh`) | onToggle + `invalidate()` on return | stop markDirty when gated; burst(1) on return |
| `ScrollAnchorRig` (field parallax) | 244–322 (`makeCappedInvalidate` 276) | ST scrub onUpdate 293 | `scrollRepaintFpsCap()` + trailing | **demand**, cap **"scroll"**, markDirty on scroll |
| ScrollAnchorRig seed/refresh | 298, 309–310 | mount + ST "refresh" | re-seed | markDirty after re-seed |
| `SectionRig` (section clouds) | 352–460 (`makeCappedInvalidate` 378) | per-section ST scrub | `scrollRepaintFpsCap()` + trailing; feeds `activeClouds` | **demand**, cap **"scroll"** |
| `CloudPlacement` | 189–234 (`invalidate()` 230) | resize/mount | one paint per layout change | markDirty on resize |
| `InvalidateOnReady` | 549–577 | mount + tab re-show | 8-frame rAF burst + 100/300/600ms nudges + visibilitychange | **requestBurst** on mount/visibility; timers cover sprite decode |
| `ThemeRig` retint | 653–721 (`makeCappedInvalidate` 698) | mode-change tween | capped; reduced-motion snaps | **demand**, markDirty per tween tick |
| `ContextWatchdog` | 587–637 | context lost/restored | remount if >4s | folds into host watchdog |

### Non-paint entanglements
- Tone mapping: default ACES (no onCreated override) — alone on REAR; on
  FRONT needs its per-view setter (3-way conflict).
- Camera: perspective `[0,11,18]`, fov 50, `lookAt(0,0,0)`; all scroll math
  (`viewportWorldHeight`/`viewportUpSpan`/`REF_DIST=22`) is camera-relative —
  keep view-local.
- `antialias: true` (810) — FRONT conflict; alone on REAR.
- dpr `[1, cloudDprMax]` LIVE via `useQuality` (1.5/1.25) vs `cloudSegments`
  mount-snapshotted — the live step-down must drive the host plane's dpr.
- persp/flat group split with per-group `ScrollAnchorRig`+`CloudPlacement`
  (895–906) moves per-view. All current specs `perspectiveScroll:false`.
- Palette/mode: `initialCloud` mount snapshot; ThemeRig tweens light refs.
- Sprite `/textures/cloud-puff.png` preload in layout gated by FLAGS.clouds.
- `frustumCulled={false}` on `<Clouds>` — keep (stale bounding sphere).
- ROCK_CLOUDS: only `rock-left`/`rock-right`, `anchorVh:0`,
  **`scrollFactor` must stay 1** (welded to cliff feet).

### Risks
- Any material shared across differing tone-map views mis-shades.
- Weld criterion: ROCK_CLOUDS must ride `scrollRepaintFpsCap()` (uncapped on
  high) through the host or the original judder returns.
- MorphRig delta pops after idle→resume; burst-on-return must repaint.
- Mode switch dirties multiple views in one tween — markDirty fan-out must
  not double-advance a plane.

---

## Consolidated host-API mapping

| Feature / driver | mode | fpsCap | markDirty trigger | burst |
|---|---|---|---|---|
| Intro IntroFrameCap | continuous | heavy | tick while introActive | — |
| Intro ConveyorRig | continuous | heavy | throttled tick, hero visible | hero re-entry |
| Intro ScrollRig | demand | scroll | scroll onUpdate (gated) | refresh re-seed |
| Intro Glass crossfade | demand | — | mode-tween tick | — |
| Intro SceneReady | — | — | — | mount (≥2 frames) |
| Rocks Scene.pump | continuous | heavy | active tick; sync start from ST | mount + restore |
| Rocks hover | — | — | via updaters | eventSource on placeholder |
| Clouds MorphRig | continuous | 30 | 30fps step while on-screen | return-to-screen |
| Clouds ScrollAnchorRig | demand | scroll | scroll onUpdate | seed + refresh |
| Clouds SectionRig | demand | scroll | scroll onUpdate | seed + refresh |
| Clouds CloudPlacement | demand | — | resize | mount |
| Clouds InvalidateOnReady | — | — | — | mount + 100/300/600ms + visibility |
| Clouds ThemeRig | demand | — | mode-tween tick | — |

**Blockers to resolve before/during migration:**
1. FRONT `antialias` single-flag decision (intro-off vs rocks/clouds-on).
2. FRONT `powerPreference` single value.
3. `advance()` in seconds; fix the rocks' `advance(t*1000)`.
4. Testimonial rocks → in-band MID plane below the quote, not z-61 FRONT.
5. Per-view tone-mapping setters (incl. AgX exposure) for all FRONT tenants;
   never share a material across differing tone maps.
6. Fix the stale "dpr up to 2" comment in `cloud-canvas.tsx`.
