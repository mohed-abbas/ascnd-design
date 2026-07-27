# Portfolio grid mode — the second variant of the work section

**Status: DECIDED 2026-07-27, not yet implemented.** This is the architecture
decision record for the portfolio section's *second* display mode — a Pinterest-
style column wall that sits beside the existing image globe. Nothing in
`components/sections/portfolio/` has changed yet; this document is the contract
the implementation has to satisfy.

Related records: `docs/canvas-consolidation-plan.md` (why the site is not going
all-WebGL, and why the globe stays a 2D canvas), `docs/performance-audit.md`
(the fps campaign this section came out of), `CLAUDE.md` (the heavy-effect
contract every new effect must satisfy).

---

## 1. What exists today

`components/sections/portfolio/` renders ONE thing: a **2D-canvas image globe**
(`cloud-canvas-engine.ts`, 1718 lines). It is not WebGL — it is a hand-rolled
3D pipeline on a plain canvas: Fibonacci sphere → Euler rotate (yaw/pitch/roll)
→ orthographic project → painter's sort by rotated z → per-tile depth-driven
size and fade. It auto-spins, drags with a fling model, and click-focuses a tile
(`focusedIndex`, `FOCUS_Z = 1.16`, `FOCUS_SCALE = 0.45`).

Around it:

- **Filter tabs** (`PROJECT_FILTERS` in `cloud-canvas-data.ts`) — a glass
  segmented control driven by `useSlidingHighlight()` from
  `components/ui/sliding-highlight.tsx`. Selecting a type re-forms the globe.
- **The heading is drawn IN the canvas** (`config.coreLabel`) so tiles pass in
  front of it and behind it; the DOM keeps an `sr-only` `<h2>` twin.
- **Lazy everything** — the image fetch/decode is deferred by an
  `initFrom="[data-pills]"` ScrollTrigger gate plus a ~1000px near-view
  observer, and the repaint loop idles to zero off-screen via an
  `IntersectionObserver` with a 0px margin.

## 2. Why a second mode at all

The globe is an *object* — it rewards play, but it shows a handful of tiles
legibly at any instant and it is weakest exactly where most traffic is: a phone,
where pitch-by-drag had to be surrendered (`touch-action: pan-y`) so the canvas
would stop eating page scroll. A column wall is the opposite: it shows the
whole body of work at a glance and asks nothing of the visitor.

So the two modes are not redundant — they split by device, see D2.

---

## 3. Decisions

| # | Decision | Locked |
|---|---|---|
| **D1** | The grid is **DOM + CSS transforms + GSAP**. Not WebGL, not a second 2D canvas, not a new formation inside the existing engine. | ✅ |
| **D2** | **Globe is the default on desktop. Grid is the default on mobile.** Both modes reachable on both devices via the switcher. | ✅ |
| **D3** | **4 columns on desktop, 2 on mobile.** Adjacent columns run in opposite directions. | ✅ |
| **D4** | **Hovering a column pauses THAT column only** — its neighbours keep drifting. See the note below; this is the one answer worth re-confirming when you first see it running. | ⚠️ see §3.1 |
| **D5** | Clicking a tile does an **in-place Flip expand** (the wall dims behind it), matching the globe's focus feel. A lightbox/panel variant is recorded in §9 as a deferred alternative, not built. | ✅ |
| **D6** | The **mode switcher sits next to the filter tabs**, reusing the same glass-pill recipe and `useSlidingHighlight`. | ✅ |
| **D7** | The section's **top and bottom fade** is a CSS `mask-image` on the column viewport — not an opaque gradient overlay. | ✅ |
| **D8** | **Full-length / oversized tile designs are deferred to last**, but the data shape that admits them lands with the first pass so it is not a rewrite. | ✅ |

### 3.1 The D4 caveat (read this)

The original brief said *"when the user hovers over the section it should stop
the infinite animation"* (whole section). The follow-up answer was *"only the
hovered section pauses"*, which reads as **per-column**: the word *only* is
contrasting with neighbours that keep moving.

**Built as: per-column pause.** If the intent was whole-section, it is a
one-line change at the call site — pause every column's tween instead of the
hovered one; the tween bookkeeping is identical either way. Flagging it here so
the change is a decision and not a bug report.

Either way the pause should be a **`timeScale` tween to 0 over ~0.4s**, not a
hard `.pause()`. A wall of images stopping dead reads as a stall; easing the
speed out reads as attention.

---

## 4. D1 in full — why DOM, and not the two obvious alternatives

### Rejected: a WebGL grid

`docs/canvas-consolidation-plan.md` already ruled on this and its inventory
table names this exact component: *"Portfolio globe — 2D — **stays as-is**, a 2D
canvas can't join a GL context"*. The site deliberately does not put content
into WebGL (text/SEO/a11y/forms would be rebuilt by hand, and one shared frame
budget couples every section to the heaviest one — the intro-glass incident,
where one heavy pass stalled the whole page to 49 rAF, is what that architecture
makes permanent). A WebGL grid reopens a settled decision and introduces a third
context class for a feature that needs no shading, no depth, and no 3D.

### Rejected: a fifth formation inside `cloud-canvas-engine.ts`

Tempting — the engine already owns four formations (`globe`, `halo`, `ascent`,
`cumulus`), the filter re-form, the glass tile recipe, focus, and lite mode. But
almost none of that machinery applies to a flat wall: no rotation, no painter's
sort, no perspective term, no depth fade. You would be paying for a 3D engine to
translate rectangles, and inheriting its ceilings:

- **One global source size.** `FAST_MAX_SIDE = 900` is a single number, coupled
  by hand to `MAX_SIDE` in `scripts/optimize-portfolio-images.mjs`. The canvas
  cannot do responsive `srcset` — a phone downloads the same pixels as a 27".
- **All images decoded at init**, in one batch, whatever is on screen.
- **Canvas is opaque to assistive tech and crawlers.** The globe needed the
  `sr-only` `<h2>` twin precisely because of this. A wall of project work is the
  one part of this site that most deserves to be indexed.

### The decisive difference

The globe animates **pixels** — every tile changes position, scale and opacity
each frame, so the canvas must repaint: ~48 `drawImage` + 25 `fillRect` + 24
clips per frame, on the main thread, continuously (the 0.2 autospin never
reaches rest, so there is no dirty check to exploit).

The grid animates **one number per column**. Rastered once, then it is a
compositor transform. Per-frame main-thread cost ≈ 4–6 property writes.

| | canvas engine | DOM columns |
|---|---|---|
| per-frame main thread | full repaint, ~100 canvas ops | 4–6 transform writes |
| images | one 900px source, all decoded at init | `next/image` srcset + `sizes`, lazy per tile |
| a11y | invisible to AT (needs the sr-only twin) | real `<a>`, alt text, tab order |
| SEO | not indexed | indexed |
| hover-pause | hit-test in engine code | pointer listener on the column |
| expand | formation math | GSAP **Flip** (`node_modules/gsap/Flip.js`, free since 3.13; we are on `^3.15.0`) |

---

## 5. Architecture

```
<section id="work" data-portfolio>            ← unchanged shell, transparent over the shared sky
  ├─ header row  (z-10, pointer-events-none)
  │    ├─ [filter tabs]      web designs · brandings · misc      ← existing
  │    └─ [mode switcher]    globe | grid                        ← D6, same glass recipe
  │
  ├─ mode === "globe"  → <CloudCanvasScene/>        (existing, unchanged)
  │
  └─ mode === "grid"   → <PortfolioGrid/>
         └─ .viewport            mask-image: linear-gradient(transparent, #000 12%, #000 88%, transparent)   ← D7
              ├─ .column  (track, will-change: transform)   ↓ drifts down
              ├─ .column                                    ↑ drifts up
              ├─ .column                                    ↓
              └─ .column                                    ↑        (2 columns below md — D3)
```

### The marquee mechanic — reuse `logos-marquee.tsx`

Do not invent a second infinite-scroll. `components/sections/logos/logos-marquee.tsx`
already solves the seam without a measured-percentage guess: clone the source
group until the track overfills its viewport, then translate by **exactly one
group's advance** with `repeat: -1, ease: "none"`. Every group is identical and
equally spaced, so the frame at `y = -advance` is pixel-identical to the frame
at `y = 0` and the restart is invisible. Speed is authored in **px/sec**
(`SPEED = 40` there), so columns of different heights drift at the same visual
rate.

Per-column deltas from the logos version: vertical axis, alternating sign, and a
small per-column speed variance (~±15%) so the wall doesn't read as one sheet.

**Clone tiles get `aria-hidden` and are removed from the tab order.** Same
lesson as the footer nav roll clone — a duplicated label must not double the
accessible name, and a duplicated `<a>` must not double the tab stops.

### Mount contract — the modes are mutually exclusive

Switching modes **unmounts** the other. The globe's cleanup already does the
right thing (`gsap.ticker.remove(tickerFn)`, `engine.dispose()`, all observers
disconnected), so this is free — but it is load-bearing: two live modes means
two repaint sources for one visible section. Never render both and hide one with
`display:none`.

Corollary for D2: the *initial* mode is a device decision, so it must be picked
the way `CloudLayer` picks: `useSyncExternalStore` with a server snapshot, so
SSR renders one stable branch and the device branch is chosen after hydration.
No `matchMedia` in the render path, or hydration mismatches result.

---

## 6. Heavy-effect contract compliance (`CLAUDE.md`)

A `repeat: -1` tween is a free-running loop, so the contract applies in full
even though nothing here is WebGL:

| # | Requirement | How the grid satisfies it |
|---|---|---|
| 1 | Rides the shared ticker — no private rAF | GSAP tweens run on `gsap.ticker`, which `LenisProvider` already drives. Nothing new is scheduled. |
| 2 | Idles to zero off-screen | `IntersectionObserver` pauses every column tween when the section leaves the viewport — exactly what `logos-marquee` does today. |
| 3 | Reads the quality tier | Add the row to the consumer registry in `lib/perf/tiers.ts` **in the same PR** (the ★ RULE from audit F5.1 — the SplashCursor regression happened by skipping that file). The knob is likely a column-count / speed lever rather than an fps cap, since transform tweens aren't repaint-bound. |
| 4 | SSR-stable first render | Device default via `useSyncExternalStore` (see §5). |
| 5 | dpr ≤ 1.5 | N/A — no canvas. The DOM equivalent is capping `sizes` so a retina phone doesn't pull desktop-width sources. |

---

## 7. Performance: what to expect, and what to measure

Expected: **the grid is cheaper than the globe it replaces**, given §5's mount
contract and one rule — **only `transform` animates**. No per-frame `filter`, no
`backdrop-blur` on a moving tile, no animating `top`/`margin`.

The cost moves from CPU-per-frame to **bytes and decoded memory**:

- Decoded RGBA is `w × h × 4`. Today's 24 tiles at ≤900px are already ~40–50 MB
  decoded inside the engine. The DOM version can *reduce* that: a 380px-wide
  column does not need a 900px source, and `sizes` picks per breakpoint.
- **Duplicated tiles cost DOM nodes, not decodes** — same URL, one decode,
  shared across clones.
- Long tracks are tiled by the compositor, so raster stays near-viewport. Still,
  size the clone count the way `logos-marquee` does (`ceil((viewport + advance) /
  advance) + 1`), not "40 tiles just in case".

Two watch-items:

1. **The D7 mask costs one compositor pass over the section's bbox per frame.**
   Precedent says this is acceptable: `pills.tsx` runs `.pill-field-mask` (a CSS
   radial-gradient mask) over genuinely moving content today. The warning in
   `cloud-canvas-scene.tsx` about masks was specifically a *full-screen mask over
   a canvas whose every pixel changes every frame* — a different animal. Measure
   it anyway; it is the single most likely thing to show up in a profile.
2. **`will-change: transform` belongs on the COLUMN, never on every tile.**
   Per-tile promotion multiplies layer memory by the tile count for no gain.

Ground truth is the DevTools FPS meter, not rAF sampling — see the known blind
spot documented at the top of `lib/perf/tiers.ts`.

---

## 8. Data model and the image pipeline (D8 groundwork)

`CloudProject` (`cloud-canvas-data.ts`) currently carries `form: landscape |
square | portrait`, which is coupled to the engine's `SLOT_SIZE` **and** to the
aspect table in `scripts/optimize-portfolio-images.mjs`. Do not overload it.

Add an optional, additive grid block so the globe's contract is untouched:

```ts
grid?: {
  form: "landscape" | "square" | "portrait" | "tall";  // "tall" = the D8 full-length tile
  span?: 1 | 2;        // columns spanned — reserved for D8, unused in pass 1
  src?: string;        // overrides the globe crop when the grid wants a different framing
}
```

Grid sources are a **separate output preset** under `public/portfolio/grid/`,
not a re-tune of `MAX_SIDE = 900` (that constant is hand-coupled to
`FAST_MAX_SIDE` and raising it degrades nothing but costs every globe visitor
bytes they don't see). `/portfolio` is already in `imageDirs` in
`next.config.ts`, so a new subdirectory inherits the immutable cache headers —
no config change needed.

**The full-length shot has an obvious home: it is what the expand reveals.** The
wall shows the crop; clicking Flips to the expanded tile which presents the long
screenshot. That folds D8 into D5 instead of making it a separate feature.

---

## 9. Deferred alternatives (recorded so a future change is cheap)

**Lightbox / panel expand** — instead of the in-place Flip, the tile flies to a
centered panel carrying the project name, a link, and the full-length shot, over
a dimmed wall. Rejected *for now* only because the in-place Flip is closer to
the globe's focus feel and keeps the two modes speaking the same language. If
this is revisited: the Flip implementation is the same call with a different
destination element, so the swap is contained to one component. The data it
would need (`name`) already exists on every project.

**Whole-section hover pause** — see §3.1.

**Drag-to-scrub the columns** — deliberately not planned. On touch it would
recreate the exact gesture conflict the globe had to concede (`touch-action:
pan-y`), and the grid's whole advantage on mobile is that it asks nothing of the
visitor.

## 10. Deferred degradation (feature-first, per `CLAUDE.md`)

Not in pass 1, by policy — build it working on capable Chrome *and* Firefox
first, then add:

- `prefers-reduced-motion` → static wall, no drift (mask and expand stay).
- Tier knobs per §6 row 3.
- A no-JS resting state: the columns should render as a plain static grid with
  no tween, the way `logos-marquee` leaves a centred group under its mask.

## 11. Open risks

- **D4's reading** (§3.1) — confirm on first sight.
- **Mobile default (D2) changes what a phone downloads.** Today a phone pays for
  the globe's 24-image batch decode; after this it pays for grid sources. Verify
  the phone is not made to pay for *both* — that is what §5's mount contract is
  for, and it is worth checking in a real profile, not just by reading.
- `public/portfolio/cloud-backup/` is sitting untracked in the working tree
  (~100K). Per `CLAUDE.md` (*"an asset nothing references is a bug, not an
  archive"*), it should be deleted or moved outside the repo before this work
  adds a second image directory next to it.

## 12. Implementation order

1. Mode state + switcher next to the filter tabs (D6), device default (D2),
   mutually exclusive mounts (§5). Grid renders a static wall — no motion yet.
2. Column marquee (D3) on the `logos-marquee` mechanic, alternating directions,
   px/sec speeds, off-screen idle gate.
3. Hover pause via `timeScale` easing (D4).
4. Mask fade (D7) — measure it here, while there is nothing else to blame.
5. Flip expand (D5), wall dim, Escape/click-out to close, focus restored to the
   originating tile.
6. Grid image preset + `grid?` data block (§8).
7. **Last:** full-length tile designs (D8), reusing the expand from step 5.
