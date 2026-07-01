# GSAP implementation audit — performance

**Scope:** every GSAP call site on the site (17 files). **Goal:** performance
gains only. **Constraint:** *no animation behaviour changes* — every suggestion
below is intended to produce pixel-identical motion, just cheaper. This is a
report; nothing here has been implemented.

**Method:** static read of all `gsap.*` / `ScrollTrigger` / `useFrame` /
`onUpdate` usage, cross-referenced against `docs/performance-audit.md` (the
existing runtime-profiled audit) and the site's one-shared-ticker architecture.

---

## 0. What's already right (preserve this)

The GSAP foundation here is strong; most "obvious" optimizations are already
done. Do **not** undo these while acting on the findings:

- **One shared scheduler.** `lenis-provider.tsx` drives Lenis off `gsap.ticker`
  (`autoRaf:false`), feeds `ScrollTrigger.update` from `lenis.on("scroll")`, and
  sets `lagSmoothing(0)`. Every scroll-driven effect, the frame watchdog, the
  cloud morph pump, and rock-hover all ride this **one rAF**. Textbook — no
  competing loops.
- **Idle-gating is pervasive.** The three card loops pause via
  `IntersectionObserver`; the cloud `MorphRig` pauses past 1.5 vh; the tile
  `ConveyorRig` pauses when the hero leaves. This is the highest-ROI pattern and
  it's already applied in most places (the gaps are in §Findings).
- **Reduced-motion + SSR discipline.** Every driver bails on
  `prefers-reduced-motion` and arms hidden state in `useLayoutEffect` before
  paint. `gsap.matchMedia` / `gsap.context` are used for scoped revert.
- **Cleanup is correct.** Tweens/timelines/ScrollTriggers/SplitText are killed or
  `ctx.revert()`-ed on unmount; no obvious leaks across Fast Refresh.
- **Transform/opacity-first.** Almost all tweens animate compositable props
  (`x/y/scale/opacity/autoAlpha`), not layout. `autoAlpha` correctly drops
  hidden elements from paint.
- **Scrub over toggleActions.** Reveals are scrubbed, so a mid-section load
  resolves to correct progress with no on-load flash.

---

## 1. Findings, prioritized

| # | Finding | File | Severity | Effort | Expected gain |
|---|---------|------|----------|--------|---------------|
| A | Per-frame `gsap.set()` ×8 in the DOM conveyor render loop | `design-shots-reveal.tsx` | **Medium** | S | Removes ~480 throwaway tweens/sec on the fallback path (GC/CPU) |
| B | Logos marquee never idle-gates off-screen | `logos-marquee.tsx` | **Medium** | S | Stops an infinite tween + live layer once the hero scrolls away |
| C | Permanent `will-change` on base selectors | `globals.css` | **Medium** | S | Frees compositor memory (esp. 16 always-promoted tile layers) |
| D | Typewriter writes `textContent` every frame | `request-media.tsx` | Low | S | Removes redundant layout writes during the 2.4 s type |
| E | Per-tile intro tweens (7 tweens + 7 closures) | `intro.tsx` | Low | M | Fewer tween objects during the intro fly-in |
| F | Animated `filter: blur()` on the image grid | `receive-media.tsx` | Low* | — | Heaviest card beat; already off-screen-gated |
| G | Aura shimmer repaints a blurred layer each frame | `receive/subscribe-media.tsx` | Low | S | Minor paint saving while the end-state is up |
| H | SplitText doesn't re-split on resize | `hero-reveal.tsx`, `cards-heading.tsx` | Info | M | Correctness on resize; not a perf win |

\*F is a correctness-preserving *note*, not a recommended change — see below.

### Implementation status

- **A — done.** `render()` now caches each rotor's `arc` once and writes
  `transform`/`opacity` straight to `style` (translate3d) instead of `gsap.set()`
  per rotor per frame; `interpolate` inlined. No per-frame allocation.
- **B — done.** The marquee tween now pauses/resumes via an `IntersectionObserver`
  on the row, and a rebuild while off-screen stays paused.
- **C — done.** The permanent `will-change` on `[data-shot-rotor]`/`[data-shot]`
  was removed from CSS; it's now set in `begin()` only when the DOM tiles actually
  animate — so the hidden WebGL-path collage no longer holds 16 compositor layers.
- **D — done.** The typewriter's `paint()` skips redundant `textContent` writes
  when the rounded index is unchanged (reset each loop).
- **E / F / G / H — deferred** (unchanged). E is a delicate one-time intro edit for
  a negligible gain; F/H are out of scope (visual change / correctness, not perf);
  G is low-value with visual-match risk. Left for a follow-up if profiling warrants.

---

## 2. Detailed findings

### A — Per-frame `gsap.set()` in the DOM conveyor  *(Medium)*
**Where:** `design-shots-reveal.tsx:95-126` (`render()` inside the
`repeat:-1 onUpdate` tween).

**Mechanism:** every animation frame, `render()` loops the 8 rotors and calls
`gsap.set(el, { x, y, scale, opacity })` on each. `gsap.set` instantiates a
zero-duration tween per call — so this allocates **~8 short-lived tween objects
per frame (~480/sec at 60 fps)**, plus a `gsap.utils.interpolate(...)` allocation
and a `Number(el.dataset.arc)` string-parse per rotor per frame. That's steady
GC pressure and setter-resolution overhead for what is really 8 transform writes.

**Context:** this is the **DOM fallback** renderer (runs on mid-page reload /
no-WebGL; reduced-motion is excluded). The WebGL twin (`ConveyorRig`) was already
addressed separately, so this path is what remains.

**Suggestion (no visual change):**
- Cache `const arcs = rotors.map(el => Number(el.dataset.arc ?? 0))` once, outside
  `render()`.
- Replace the per-frame `gsap.set` with cached **`gsap.quickSetter`** setters
  (e.g. one `quickSetter(el, "css")` per rotor, or per-prop setters), or write
  `el.style.transform`/`el.style.opacity` directly. Either bypasses the tween
  pipeline entirely — no per-frame allocation.
- `interpolate(1, steady, fade)` can be inlined as `1 + (steady - 1) * fade`.

**Risk:** none — same computed values, same output.

---

### B — Logos marquee is not idle-gated  *(Medium)*
**Where:** `logos-marquee.tsx:78-83` — `gsap.to(track, { x:-advance, repeat:-1, ease:"none" })`.

**Mechanism:** the marquee tween runs **forever**, including after the hero (its
only home) has scrolled out of view. It keeps an active tween on the ticker and a
composited, continuously-transformed layer alive off-screen. Every *other* loop
on the site idle-gates; this one is the exception, which is contrary to the
audit's "idle-gate every loop" mandate (`performance-audit.md` C4).

**Suggestion:** wrap the `tween.play()/pause()` in an `IntersectionObserver` on
the marquee viewport (or a `ScrollTrigger` `onToggle`), exactly like
`receive-media.tsx`. Resume on re-entry. Optionally also pause on tab-hidden
(the browser parks rAF anyway, so this is secondary).

**Risk:** none — the loop is seamless (frame at `x=0` ≡ frame at `x=-advance`),
so pausing/resuming at any point is invisible.

---

### C — Permanent `will-change` on base selectors  *(Medium)*
**Where:** `globals.css` — `will-change` is declared on **unscoped base
selectors** (not `.reveal-armed`, not for the animation window):
`[data-reveal], [data-reveal-fade]` (:60), `[data-rock]` (:93),
`[data-shot-rotor], [data-shot]` (:171 — **16 elements**), `[data-reel-col]`
(:238), `[data-grass-overlay]` (:157).

**Mechanism:** `will-change` forces the browser to keep a dedicated compositor
layer / extra memory for that element **as long as the rule matches**. MDN and
GSAP both advise applying it *shortly before* an animation and removing it after;
leaving it on permanently costs memory and can *reduce* performance. Here:
- The one-shot reveal elements (`[data-reveal]`, `[data-rock]`, headline glyphs)
  keep the hint **forever** after their single entrance completes.
- The **16 tile layers** (`[data-shot-rotor]`/`[data-shot]`) stay promoted even
  while the conveyor is paused off-screen — so the memory the audit's off-screen
  pause was meant to reclaim is partly held anyway.

**Suggestion (no visual change):**
- Scope the one-shot reveal `will-change` under `.reveal-armed` so it drops after
  you (optionally) clear the armed class, or clear it in the tween's
  `onComplete` (`gsap.set(el, { willChange: "auto" })`). GSAP can also manage it
  per-tween if you'd rather not hand-hold CSS.
- For the tiles, it's defensible while the arc is visible (continuous motion);
  consider clearing it when `ConveyorRig` pauses and restoring on resume.

**Risk:** low — verify no reveal flash/jank re-appears; the hint is a compositor
optimization, not part of the parked layout, so removing it doesn't move anything.

---

### D — Typewriter writes `textContent` every frame  *(Low)*
**Where:** `request-media.tsx:147-160` — `paint()` runs on every `onUpdate` of a
2.4 s tween and sets `briefText.textContent = BRIEF.slice(0, Math.round(typed.n))`.

**Mechanism:** at 60 fps that's ~144 writes over the type, but `Math.round(n)`
lands on the **same integer for several consecutive frames**, so many of those
`textContent` assignments write an identical string — and each assignment still
dirties the `<p>` and forces layout.

**Suggestion:** track the last painted index and early-return when unchanged:
`if (i === lastI) return; lastI = i; briefText.textContent = BRIEF.slice(0, i)`.
Cuts the redundant writes/relayouts to only the frames where a character actually
appears.

**Risk:** none — visually identical typing.

---

### E — Per-tile intro tweens  *(Low)*
**Where:** `intro.tsx:468-492` — a separate `gsap.to(d, { onUpdate })` is created
**per tile** (7) for the scatter→necklace fly-in, each with its own proxy object
and closure.

**Mechanism:** 7 tweens + 7 `onUpdate` closures run in parallel during the fly-in
(one-time, ~1 s). Functionally fine, but it's more tween/closure objects than
needed on the frames that overlap the MTM-heavy intro window.

**Suggestion:** drive all tiles from **one** proxy tween whose single `onUpdate`
loops the tiles and writes each pose (the DOM/WebGL conveyors already use this
one-tween-many-elements shape). Fewer objects, one callback per frame.

**Risk:** none if the per-tile eases/timing are preserved (they share `power2.inOut`
and the same `dockStart`/`tileFlight`, so a single tween with per-tile math is
equivalent).

---

### F — Animated `filter: blur()` on the grid  *(Low — note only)*
**Where:** `receive-media.tsx:91,106` — grid blurs `0 → 7px` and back.

**Mechanism:** animating a CSS `blur()` re-runs the blur convolution over a
378×300 image region **every frame** of the 0.5 s tween — the most expensive
single beat in the cards. It's already **off-screen-gated** by the
IntersectionObserver, so it only ever runs while the card is visible.

**Suggestion:** none recommended — the blur *is* the effect. Documented here as
the cards' dominant cost if you ever need to claw back more: options would be a
lower peak blur or cross-fading a pre-blurred image copy's opacity (a composite,
not a repaint) — but both are visual changes, so out of scope for this audit.

---

### G — Aura shimmer repaints a blurred layer  *(Low)*
**Where:** `receive-media.tsx:80-83`, `subscribe-media.tsx:64-70` — a `repeat:-1`
`backgroundPosition` sweep on the aura ring **and** a `filter: blur(9px)` glow.

**Mechanism:** `background-position` is a **paint** (not composite) property, and
the glow it animates is blurred — so each frame repaints a blurred element while
the end-state pill is on screen. It's paused off-screen with the parent timeline,
so the cost is bounded to the visible hold (~1.5 s/loop).

**Suggestion:** minor — could animate `transform: translateX` on an over-wide
gradient instead of `background-position` (composited), or drop the sweep on the
blurred glow and keep it only on the crisp ring. Low priority given the gating.

**Risk:** low; the translate approach needs the gradient element sized/positioned
so the motion matches — verify visually.

---

### H — SplitText doesn't re-split on resize  *(Info)*
**Where:** `hero-reveal.tsx:79,98`, `cards-heading.tsx:47` — `new SplitText(...)`
measured once after `document.fonts.ready`.

**Mechanism:** if the viewport resizes and the text rewraps, the char/word masks
aren't re-measured, so a masked line could mis-clip. In practice these are
one-shot reveals that have usually finished before any resize, so it rarely
bites — this is a **correctness** note, not a perf gain.

**Suggestion (optional):** GSAP 3.13's `SplitText.create(el, { autoSplit:true,
onSplit })` re-splits on resize/font-swap and hands back fresh targets to
re-tween. Only worth it if resize-mid-reveal is a real scenario.

---

## 3. Cross-cutting recommendations

1. **Introduce `quickSetter`/`quickTo` for hot per-frame writes.** The codebase
   has zero `quickSetter`/`quickTo` usage today, yet several `onUpdate` loops call
   `gsap.set` per element per frame (Finding A is the clearest). This is the
   single most idiomatic GSAP perf lever available here.
2. **Finish the idle-gating story.** The marquee (B) is the one continuous loop
   not gated off-screen. Closing it makes "every loop idles when unseen" true
   site-wide.
3. **Treat `will-change` as a temporary hint, not a static style** (C). Prefer
   armed-scoped or `onComplete`-cleared hints over permanent base-selector ones,
   especially for the 16 tile layers.
4. **Guard redundant DOM writes in `onUpdate`** (D) — cheap wins wherever an
   `onUpdate` maps a continuous proxy to a discrete DOM output (text, integer
   counts).
5. **Optional global:** `ScrollTrigger.config({ ignoreMobileResize: true })`
   avoids a full ScrollTrigger refresh on mobile URL-bar show/hide (the pin in
   `why-stay-reveal.tsx` makes refreshes global). Low effort, mobile-only benefit.

---

## 4. Suggested order of work

1. **A** (conveyor `quickSetter`) and **B** (marquee gate) — highest gain / lowest
   risk, both small and self-contained.
2. **C** (`will-change` hygiene) — one CSS pass; verify no reveal flash.
3. **D** (typewriter guard) — trivial.
4. **E / G** — only if profiling still shows headroom worth chasing.
5. **F / H** — leave unless a specific need arises (F is a visual change; H is
   correctness, not perf).

None of the above alters the animations themselves — they change *how* the same
motion is produced, not *what* is shown.
