# Canvas consolidation plan — `enhancement/restructure-canvas`

**Status: PLANNED (2026-07-18). Not started.** Agreed after the fps campaign;
see `docs/backdrop-filter-sweep.md` and the measurement history below for how
we got here. Implementation happens on this branch so `main` stays shippable.

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
- **Phase 1 — shared canvas host:** `components/canvas/` — `SharedCanvas`
  (front + rear instances mounted in layout), a `useView` registration
  contract, the single ticker-end advance pump (idles to zero when no view
  is dirty/visible), one ContextWatchdog, dpr/caps read from the quality
  store. Nothing visual migrates yet; site renders unchanged.
- **Phase 2 — intro/conveyor tiles → FRONT canvas.** The riskiest migrant
  (welcome choreography, loader gating, dock handoff, dpr swap, ScrollRig +
  conveyor + off-screen gate). Full intro playthrough verification at
  `?intropos` checkpoints + the per-second live-run trace.
- **Phase 3 — testimonial rocks → FRONT canvas.** Resolve the stacking ⚠
  first (rocks vs quote text overlap); port the pump/reveal/dodge; verify
  60 pps cap + hover.
- **Phase 4 — clouds return** (`FLAGS.clouds = true`): SKY specs → REAR
  canvas view, ROCK specs → FRONT canvas view, MorphRig/ScrollAnchorRig/
  SectionRig ported to the shared pump (morph stays 30 fps; scroll rides
  the display via scrollRepaintFpsCap). Re-run the full-page scroll
  baseline; welded rock-clouds must track the cliffs with no half-rate
  stagger (the original judder complaint).
- **Phase 5 — footer glass** joins FRONT canvas whenever the new footer
  approach lands (`FLAGS.footer`). Out of scope until then.

## Success criteria

- All per-section numbers ≥ the recorded `main` baselines (no regression).
- GL contexts: ≤2 (+ the 2D globe). One rAF-driving loop total.
- Welcome intro: visually identical at `?intropos` 0.25/0.5/0.75/0.85.
- With clouds on: full-page warm scroll ≥ the no-clouds baseline minus the
  clouds' known 30 fps morph cost; no weld stagger against the cliffs.
- `main` remains shippable at every point (work stays on this branch).
