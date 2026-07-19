# Canvas consolidation plan — `enhancement/restructure-canvas`

**Status: Phases 0–4 DONE (2026-07-19) — see results inline. Phase 5 parked
until the new footer lands.** Phase 2–4 reference: `docs/canvas-migration-map.md`. Agreed after the fps campaign; see `docs/backdrop-filter-sweep.md`
and the measurement history below for how we got here. Implementation happens
on this branch so `main` stays shippable.

## Decision

Do **NOT** move the site into a single all-WebGL canvas (text/SEO/a11y/forms
would have to be rebuilt by hand, and one shared frame budget couples every
section to the heaviest one — the intro-glass incident, where one heavy pass
stalled the whole page to 49 rAF, is what that architecture makes permanent).

**DO** consolidate the *effect* canvases into shared canvases using the drei
`<View>` pattern (scissored viewports on one context, each tracking an empty
placeholder `<div>` in the normal DOM flow). Content stays DOM. One context,
one loop, one dpr/caps policy for all effects; text, SEO, accessibility,
forms untouched.

## The constraint that shapes everything: z-planes

A canvas is ONE plane in the page's stacking order, but our effects straddle
page content — so it CANNOT be literally one canvas. It's **one canvas per
z-plane**, which still collapses today's 4–5 contexts to 2:

```
   z-999  navbar (DOM)
   z-100  cursor lens (DOM)
   z-61   FRONT effects canvas ── rock-base clouds · intro/conveyor tiles ·
          (fixed, pointer-events    testimonial rocks · future footer glass
           none by default)
   z-0+   PAGE CONTENT (DOM text, glass cards, buttons…)
   -z-10  REAR effects canvas ──── distant sky clouds
   -z-20  sky backdrop (DOM gradient + grain)
```

## Current inventory (what merges, what doesn't)

| Canvas today                        | Type  | Destination            |
|-------------------------------------|-------|------------------------|
| Intro/conveyor tile canvas (z-60)   | R3F   | FRONT canvas view      |
| Cloud SKY layer (-z-10, benched)    | R3F   | REAR canvas view       |
| Cloud ROCK layer (z-61, benched)    | R3F   | FRONT canvas view      |
| Testimonial rocks (inline in flow)  | R3F   | FRONT canvas view ⚠ investigate stacking vs neighbouring DOM first |
| Footer glass (benched, future)      | R3F   | FRONT canvas view      |
| Portfolio globe                     | 2D    | **stays as-is** — 2D canvas can't join a GL context; it already behaves (60 cap + drag-uncap) |

## Why this is worth doing (measured wins it locks in)

1. **One render loop, driven correctly.** The shared canvas runs
   `frameloop="never"` with a single `advance()` called from the END of the
   GSAP ticker tick — every view renders in the *same tick* as the Lenis
   scroll write. This architecturally fixes the demand-mode half-rate problem
   we measured (invalidate() inside a rAF schedules R3F's render on its own
   NEXT rAF → paints degrade to ~½ the achieved frame rate under load).
2. **One place for the caps policy** (`heavyEffectFpsCap` /
   `scrollRepaintFpsCap`) instead of per-canvas wiring — the class of bug we
   fixed three times (intro cadence, globe accumulator slip, rocks uncapped)
   stops being writable.
3. One GL context per z-plane: less GPU memory, one context-loss watchdog,
   one dpr policy (site cap ≤1.5).
4. Views whose placeholder rect is off-screen are skipped — idle-to-zero by
   construction instead of per-canvas IntersectionObserver plumbing.

## Honest caveats (say them out loud)

- Effects on one canvas share one budget among themselves: a heavy effect
  drags other *effects* (never DOM text). Per-effect budget discipline
  (tiers, caps, the heavy-effect contract) stays mandatory.
- Tone mapping is renderer-level: intro glass runs `NoToneMapping`, the
  clouds' doc specifies ACES. Per-view switching (`gl.toneMapping` in the
  view's render callback) must be verified early — it's the likeliest
  technical blocker (Phase 1 spike).
- The intro runs dpr 1 during the welcome (measured necessity for the MTM
  glass). dpr is canvas-global → during the welcome the whole FRONT canvas
  runs dpr 1. Acceptable (everything else is barely visible then); restore
  [1,1.5] at handoff as today.
- `MeshTransmissionMaterial`'s internal FBO pass renders "the scene" — under
  Views it must see only its own view's scene. Verify in the Phase 1 spike.
- Pointer events: intro tiles are pointer-events:none (fine); testimonial
  rocks need hover/dodge — drei View supports events via `eventSource` on
  the placeholder; verify with the cursor-dodge interaction.

## Phases (each ends: lint + build + instrumented verify + screenshots)

Verification method for every phase = the campaign's instrumentation: patch
GL draw calls to count paint bursts + rAF/s buckets on the prod build,
compare against the recorded baselines (globe 59.7 pps; rocks 59.5 pps;
idle 0; band scroll 117–121 rAF).

- **Phase 0 — spike (throwaway allowed):** minimal page with one shared
  `frameloop="never"` canvas + two `<View>`s: an MTM glass text (NoToneMapping)
  and a drei `<Clouds>` (ACES). Prove: per-view tone mapping, MTM FBO
  isolation, ticker-end `advance()` lockstep. If any fails with no
  workaround → stop, document, revisit.
  **RESULT (2026-07-18): ALL THREE PROVEN — spike lives at
  `app/lab/canvas-spike/` (dev-only route, 404s in prod via the lab gate).
  Measured on the 120Hz MacBook, dev server:**
  - **Lockstep:** ticker ticks/s = advance()/s = paint bursts/s = 120.1 with
    one view on screen, and still 120.1 with BOTH views sharing the frame.
    No half-rate. Idle (both views scrolled off): advance/draws/bursts all 0
    while the ticker holds 120 — the gate idles to zero by not calling
    `advance()`.
  - **Per-view tone mapping:** glass view renders under NoToneMapping (0),
    clouds under ACESFilmic (4), same renderer, same frame — identical
    emissive spheres visibly clip (glass) vs roll off (clouds). Mechanism:
    a setter `useFrame` at priority `index−1` inside each View (all portal
    subscribers share the root's one priority-sorted list). Safe because
    three r183 keys shader programs on toneMapping PER MATERIAL — a material
    that only ever renders under one tone mapping compiles once. Load-bearing
    rule: **never share a material instance across views with different tone
    mappings.**
  - **MTM FBO isolation:** `state.scene` inside a View's portal resolves to
    the view's own virtual scene, so MTM's transmission FBO captures only its
    view (verified: saturated red probe in the clouds scene never refracts
    through the glass; the glass's own orange backdrop does).
  - **Two findings the plan must carry into Phase 1:**
    1. `invalidate()` is a NO-OP under `frameloop="never"` (fiber early-
       returns). Every migrated rig must be rewired to a dirty-flag →
       ticker-end `advance()` pump; `advance()` renders unconditionally, so
       idle-to-zero means *not calling it*.
    2. drei View sets `gl.autoClear=false` and never clears per frame → a
       transparent multi-view canvas ghosts. The shared host needs the
       spike's leading full-canvas clear (`useFrame` at the lowest positive
       priority: scissor test off, clearAlpha 0, clear color+depth).
    Also: `advance(t)` takes SECONDS (`gsap.ticker.time`), not the ms form
    Lenis.raf uses — ms silently corrupts MTM time and cloud morph/rotation.

- **Phase 1 — shared canvas host:** `components/canvas/` — `SharedCanvas`
  (front + rear instances mounted in layout), a `useView` registration
  contract, the single ticker-end advance pump (idles to zero when no view
  is dirty/visible), one ContextWatchdog, dpr/caps read from the quality
  store. Nothing visual migrates yet; site renders unchanged.
  **RESULT (2026-07-18): DONE — `components/canvas/` + `/lab/canvas-host`
  demo (dev-only). Verified live through the production host on the 120 Hz
  panel: uncapped continuous view → plane at display rate (120 = ticks =
  advances, LOCKSTEP); "heavy"-capped view alone → clean 60; demand view
  (markDirty on scroll, cap 30) → 30.0 while scrolling, 0.0 stopped; homepage
  → zero host canvases and the plane-canvas chunk never downloads (the three
  pre-existing canvases are untouched until their phases migrate them).
  Post-review fixes baked in: per-view Suspense (one loading view can no
  longer blank its plane), host-owned in-Canvas mount burst (fires on
  watchdog remounts too), virtual-clock delta clamp (no gap-sized animation
  pops), session warm latch (no context teardown when a plane transits
  count 0), and a measured accumulator fix (the modulo remainder-carry
  double-painted inside the 1 ms tolerance window → 48 pps on a 30 cap; the
  `max(last+budget, now−budget)` idiom is the correct one — reuse it, never
  the modulo form). Documented follow-ups (minor): IO rebuild on children
  identity churn, track-ref-null re-observe, multi-view pointer contention
  (only one interactive view per plane for now), live-dpr stale frame on
  demand-only views.**

- **Phase 2 — intro/conveyor tiles → FRONT canvas.** The riskiest migrant
  (welcome choreography, loader gating, dock handoff, dpr swap, ScrollRig +
  conveyor + off-screen gate). Full intro playthrough verification at
  `?intropos` checkpoints + the per-second live-run trace.
  **RESULT (2026-07-18): DONE — the intro no longer owns a Canvas; one FRONT
  view via useSharedView (telephoto camera per-view via makeDefault on the
  portal store; the fixed wrapper is the full-viewport track). IntroFrameCap
  deleted — the host pump paces the welcome. Paint policy: continuous/heavy
  while welcome/conveyor animates with the hero on screen (the fixed
  placeholder defeats the host IO gate, so hero visibility gates feature-
  side via the [data-hero] ScrollTrigger flipping the descriptor to
  demand/scroll). dpr-1 welcome window = plane dpr override, released on
  every exit path (reviewer-verified leak-free). ?intropos bursts on the
  actual timeline seek. Verified live (dev server, 120 Hz): welcome
  60/60/61 paints/s steady; conveyor 60 on-screen / 0 hero-gone / 60 on
  return; frozen 0.5/0.85 checkpoints visually intact, idle 0 draws.
  Conscious change: post-handoff dpr now respects the quality tier (1.25 on
  low instead of hard 1.5) per the plan's dpr-from-quality-store intent.
  ?introaa degrades to a warning (antialias is context-level now —
  plane-config.ts). GL contexts on the homepage: down from 3 to 2 + globe
  (intro merged; testimonial rocks migrate in Phase 3).**

- **Phase 3 — testimonial rocks → FRONT canvas.** Resolve the stacking ⚠
  first (rocks vs quote text overlap); port the pump/reveal/dodge; verify
  60 pps cap + hover.
  **RESULT (2026-07-19): DONE — resolved as a NEW "mid" plane (user-approved),
  not FRONT: z 0 sits under the section's positioned z-auto rings and z-10
  quote by CSS tree order (host mounts before {children}) with zero
  section-local z tweaks; antialias:true on MID (single tenant) dissolves
  the AA conflict for the rocks. The in-flow 120vw wrapper is the View
  track (scissor + host-IO idle gate) and pointer target. Two mechanisms
  discovered/fixed en route: (1) interactive planes must set
  eventSource=document.documentElement — fiber attaches DOM listeners only
  at context creation, so a root-fixed canvas can never hear events
  targeting an in-page track; drei's event.target===track gate then
  filters (off-track moves early-return, no raycast). (2) warm
  gl.compileAsync must run under the VIEW's tone mapping (program cache
  key includes it) — a bare call compiled the default-ACES variants and
  the AgX recompile hitch returned on the scroll path. Reveal starts
  same-tick via markDirty + a fly-in-spanning burst. Virtual-clock note:
  rocks now resume their pose after off-screen idle instead of advancing
  on wall time (delta clamp hides it). Verified live: reveal paints
  mid-scroll, 58–60 pps in view / 0 off-screen, hover-dodge + quote
  advance work through the new routing, stacking rocks < rings < quote
  intact.**

- **Phase 4 — clouds return** (`FLAGS.clouds = true`): SKY specs → REAR
  canvas view, ROCK specs → FRONT canvas view, MorphRig/ScrollAnchorRig/
  SectionRig ported to the shared pump (morph stays 30 fps; scroll rides
  the display via scrollRepaintFpsCap). Re-run the full-page scroll
  baseline; welded rock-clouds must track the cliffs with no half-rate
  stagger (the original judder complaint).
  **RESULT (2026-07-19): DONE — FLAGS.clouds=true; cloud-canvas.tsx is a
  registration module instantiated twice (SKY→REAR, ROCK→FRONT co-resident
  with the intro, both ACES per-view). MorphRig/watchdog/private ticker
  deleted; the descriptor is the policy: continuous while on-screen
  (feature-side gates — fixed placeholders defeat host IO), fpsCap 30↔
  "scroll" flipped on a trigger-less scroll-activity ST (stays true through
  the whole Lenis glide; 0.15s release). Weld: max-wins lifts FRONT past
  the intro's heavy-60 to display rate on high tier while the rock view is
  scroll-dirty. Reveal moved in-scene (material opacity + world drift),
  idempotency-latched (review caught a visible double-reveal at the dock).
  Host hardening from review: mode/fpsCap are runtime fields now
  (setPaintPolicy, no emit) — descriptor routing tore down the plane IO
  per scroll gesture (also fixed a latent unregister-on-flip reset in
  useSharedView). Verified live (dev, stepped-tier browser): 30pps morph
  idle per cloud plane / tier-cap while scrolling / 0 off-band; clouds
  white (ACES), weld glued, single reveal on the welcome; full-page warm
  scroll settles 116–120 rAF in dev. AA delta signed off (REAR/FRONT
  antialias:false vs old true — alpha sprites don't use MSAA edges).
  Accepted ride-along: rock clouds paint at 60 (not 30) while the hero
  conveyor runs. PROD RE-BASELINE still owed on the next prod build.**

- **Phase 5 — footer glass** joins FRONT canvas whenever the new footer
  approach lands (`FLAGS.footer`). Out of scope until then.

## Success criteria

- All per-section numbers ≥ the recorded `main` baselines (no regression).
- GL contexts: ≤2 (+ the 2D globe). One rAF-driving loop total.
- Welcome intro: visually identical at `?intropos` 0.25/0.5/0.75/0.85.
- With clouds on: full-page warm scroll ≥ the no-clouds baseline minus the
  clouds' known 30 fps morph cost; no weld stagger against the cliffs.
- `main` remains shippable at every point (work stays on this branch).
