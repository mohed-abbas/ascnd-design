# Portfolio grid mode — the second variant of the work section

**Status: DECIDED 2026-07-27. Steps 1–3 of 7 BUILT (§13), unverified in a browser.**
This is the architecture decision record for the portfolio section's *second*
display mode — a Pinterest-style column wall that sits beside the existing image
globe. It is the contract the implementation has to satisfy; §17 records what
building the first step settled.

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
| **D3** | **Up to 4 columns on desktop, 2 on mobile**, adjacent columns running in opposite directions. The desktop column COUNT adapts to the filtered set size (§8.2) — tile size never changes, the field narrows. | ✅ |
| **D4** | **Hovering a column pauses THAT column only** — its neighbours keep drifting. See the note below; this is the one answer worth re-confirming when you first see it running. | ⚠️ see §3.1 |
| **D5** | Clicking a tile does an **in-place Flip expand** (the wall dims behind it), matching the globe's focus feel. A lightbox/panel variant is recorded in §10 as a deferred alternative, not built. | ✅ |
| **D6** | The **mode switcher sits next to the filter tabs**, reusing the same glass-pill recipe and `useSlidingHighlight`. | ✅ |
| **D7** | The section's **top and bottom fade** is a CSS `mask-image` on the column viewport — not an opaque gradient overlay. | ✅ |
| **D8** | **Full-length / oversized tile designs are deferred to last**, but the data shape that admits them lands with the first pass so it is not a rewrite. | ✅ |
| **D9** | **Masonry, not a uniform grid.** Fixed column WIDTH; every tile's HEIGHT comes from its own authored aspect. Tiles are NOT all the same size — that is the whole point of the mode (§8). | ✅ |
| **D10** | Grid tiles carry the **glass-matted frame**, the same treatment the globe draws around every tile — not bare rounded corners. The two modes stay one visual language, and a bare image over the live sky reads as a sticker. | ✅ |
| **D11** | The **`tall` slot ships with D8, not in pass 1.** The wall launches on the three authored aspects (2:1 spread); the taller form arrives with the full-length designs. | ✅ |

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

## 8. Tile sizing — masonry, not a uniform grid (D9)

### 8.1 Fixed width, varied height

Pinterest's rule, and the thing that makes a wall read as a wall: **every column
is the same width; every tile's height comes from its own aspect.** Tiles are
deliberately NOT uniform.

The grid does not invent aspects — it inherits the three the globe already
authors in `SLOT_SIZE` (`cloud-canvas-engine.ts`), which every source image has
already been cropped to by `scripts/optimize-portfolio-images.mjs`:

| form | authored slot | aspect (w/h) | height in a 380px column |
|---|---|---|---|
| `landscape` | 164 × 104 | 1.577 | 241 px |
| `square` | 126 × 126 | 1.000 | 380 px |
| `portrait` | 112 × 146 | 0.767 | 495 px |
| `tall` (D8, last) | — | ~0.55 | ~690 px |

That is a ~2:1 spread between the shortest and tallest tile before D8 even
lands — enough that no two columns line up and the wall reads as masonry rather
than a table. `tall` widens it to ~3:1 later.

Fixed width matters beyond looks: uniform column width means **one `sizes` value
per breakpoint**, so the srcset resolves to a single source width per device
instead of a per-tile matrix. A variable-*width* wall would multiply the image
preset count for no visual gain. D8's `span: 2` is the deliberate exception, and
it is the last thing built.

Consequence for the marquee: each column's advance is **its own** content height
+ gap, measured per column (`logos-marquee` measures `offsetWidth + gap`; this
measures `offsetHeight + gap`). Columns of unequal total height therefore loop at
different periods at a constant px/sec — they desync for free. Nothing needs to
be forced, and no column should be padded to match another.

**Assignment:** shortest-column-first greedy — classic masonry — walked over the
registry order. That order already rotates web → branding → misc specifically so
a contiguous run can't clump one type (and therefore one shape); a rule written
for the globe that pays off again here. Deterministic: same filter → same wall.

### 8.2 The sparse-filter problem (this one bites)

An infinite column built from few tiles repeats itself *on screen*:

| tab | projects | at 4 columns | verdict |
|---|---|---|---|
| all | 24 | 6 / column | fine |
| web designs | 10 | 2–3 / column | thin |
| misc | 8 | 2 / column | thin |
| brandings | 6 | 1–2 / column | **broken** — a 1-tile column is one image stacked forever |

The globe answers sparsity by GROWING tiles (`densityFactors` shrinks spread and
grows size — it is why the brandings tab reached 93.8% of screen width per tile
on a phone before the `DESIGN_BASE` fix). **The grid must not copy that.** A
bigger tile in a fixed-width column means a wider column, and the wall stops
being a wall.

The grid's answer is the inverse: **keep tile size constant, drop columns.**
Floor of 3 tiles per column:

```
columns = clamp(floor(count / 3), 2, 4)      // desktop; mobile is always 2

all(24) → 4      web(10) → 3      misc(8) → 2      brandings(6) → 2
```

The field centres and narrows; tile size never changes. At the 3-per-column
floor a column stands ~1.3 viewports tall, so a given tile can appear at most
twice on screen at once — that is the acceptable floor, and the reason the
divisor is 3 rather than 2.

Second lever if `brandings` still reads monotonous (it is nearly all portrait):
the reserved `grid?.form` override (§9) can re-shape individual projects for the
wall without touching their globe slot.

## 9. Data model and the image pipeline (D8 groundwork)

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

## 10. Deferred alternatives (recorded so a future change is cheap)

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

## 11. Deferred degradation (feature-first, per `CLAUDE.md`)

Not in pass 1, by policy — build it working on capable Chrome *and* Firefox
first, then add:

- `prefers-reduced-motion` → static wall, no drift (mask and expand stay).
- Tier knobs per §6 row 3.
- A no-JS resting state: the columns should render as a plain static grid with
  no tween, the way `logos-marquee` leaves a centred group under its mask.

## 12. Open risks

- **D4's reading** (§3.1) — confirm on first sight.
- **Mobile default (D2) changes what a phone downloads.** Today a phone pays for
  the globe's 24-image batch decode; after this it pays for grid sources. Verify
  the phone is not made to pay for *both* — that is what §5's mount contract is
  for, and it is worth checking in a real profile, not just by reading.
- `public/portfolio/cloud-backup/` — 24 grey placeholder SVGs (a `<rect
  fill="#9a9a9a"/>` and a two-digit label), the pre-real-work placeholders the
  registry header says are gone. Nothing references them. Per `CLAUDE.md` (*"an
  asset nothing references is a bug, not an archive"*) they should be deleted or
  moved outside the repo. **They and the unrelated vendored `cursor-trail-main/`
  were accidentally committed to this branch by a `git add -A` in `504ffc1` and
  un-tracked again in a follow-up; both are back to untracked-on-disk, which is
  how the session found them. They are still the user's to delete.**

## 13. Implementation order

1. ✅ **DONE** — mode state + switcher next to the filter tabs (D6), device
   default (D2), mutually exclusive mounts (§5). Grid renders a static wall —
   no motion yet. `grid/grid-spec.ts` (aspects, column count, assignment, mat
   ratios) + `grid/portfolio-grid.tsx` (the wall) + the mode wiring in
   `portfolio.tsx`. Two things were settled while building — see §17.
2. ✅ **DONE** — column marquee (D3) on the `logos-marquee` mechanic,
   alternating directions, px/sec speeds, off-screen idle gate.
   `grid/grid-marquee.tsx`, a render-nothing sibling that reads `[data-drift-*]`
   off the columns; drift constants in `grid-spec.ts` (`DRIFT_SPEED = 30`,
   `columnDrift()`). Tier registry row added in the same commit per §6.
3. ✅ **DONE** — hover pause via `timeScale` easing (D4), 0.4s in and out,
   per column. Pointer events, so touch never triggers it.
4. Mask fade (D7) — measure it here, while there is nothing else to blame.
5. Flip expand (D5), wall dim, Escape/click-out to close, focus restored to the
   originating tile.
6. Grid image preset + `grid?` data block (§9).
7. **Last:** full-length tile designs (D8), reusing the expand from step 5.

---

## 14. Diagrams

Drawn 2026-07-27 while reading the section. They describe the CURRENT globe
(A–E) and the PLANNED grid (F–I).

### A · Where the section sits in the page z-stack

```
  z-999   navbar (DOM, backdrop-blur — a SIBLING of the fixed layers, never an ancestor)
  z-100   cursor lens (DOM)
  z-61    FRONT cloud layer  ──────────────────────────┐
                                                        │ portfolio's tiles can be
  z-auto  ┌───────────────────────────────────────┐    │ occluded by front clouds
          │  #work  [data-portfolio]              │◄───┘ ON PURPOSE — the globe
          │  transparent, z-index: auto           │      floats IN the atmosphere
          └───────────────────────────────────────┘
  z-0+    other page content (DOM)
  -z-10   REAR cloud layer   (fixed, own layer)
  -z-20   sky backdrop       (fixed: #62abff fill + inline-SVG grain)

  ⚠ nothing above may put filter/backdrop-filter on an ANCESTOR of the two
    fixed layers — that breaks position:fixed for their descendants.
```

### B · Section anatomy today (vertical)

```
 ┌─ <section id="work" data-portfolio>  overflow-hidden ────────────────┐
 │   pt-[8dvh]            ← only the REMAINDER of the house gap; the    │
 │                          band's own 10dvh completes it               │
 │  ┌─ .globe band ─ h-dvh (max-md:h-svh) ─ relative ─────────────────┐ │
 │  │                                                                 │ │
 │  │   pt-[10dvh]                                                    │ │
 │  │   ┌──── header row · z-10 · pointer-events-NONE ─────────────┐  │ │
 │  │   │        ╭──────────────────────────────────────╮          │  │ │
 │  │   │        │ all │ web designs │ brandings │ misc │ ← glass   │  │ │
 │  │   │        ╰──────────────────────────────────────╯   pill,   │  │ │
 │  │   │           ▲ sliding highlight    pointer-events-AUTO      │  │ │
 │  │   └──────────────────────────────────────────────────────────┘  │ │
 │  │                                                                 │ │
 │  │   <canvas>  absolute inset-0  h-full w-full   ← FULL-BLEED      │ │
 │  │         ▒▒▒      ▒▒▒▒▒                          on purpose:     │ │
 │  │     ▒▒▒▒   "stuff we've shipped"   ▒▒▒          an inset box    │ │
 │  │        ▒▒▒▒  ▒▒▒▒     ▒▒▒▒▒                     would hard-clip │ │
 │  │      ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒                      tiles at its    │ │
 │  │          ▒▒▒▒▒▒▒▒▒▒▒▒▒                          own edge        │ │
 │  │   <h2 class="sr-only">  ← the accessible twin of the in-canvas  │ │
 │  └─────────────────────────────────────────── heading ────────────┘ │
 │   pb-section          ← the band exists so this padding CANNOT      │
 └──────────────────────── reach the canvas ───────────────────────────┘

 why the band: radius = min(cssW,cssH) × 0.45 × spread × zoom.
 A canvas grown by the padding would scale the sphere by the same amount
 and hand back exactly the clearance the padding bought.
 max-md:h-svh: dvh tracks the URL bar → resize → canvas.width reassigned
 → backing store CLEARED → one blank frame per URL-bar move.
```

### C · Component / data flow

```
  portfolio.tsx  ("use client" — owns the filter state)
        │
        ├── useSlidingHighlight(filter) ──► groupRef + pillRef (the travelling pill)
        │
        ├── PROJECT_FILTERS ──► tab buttons ──► setFilter()
        │                                            │
        └── <CloudCanvasScene filter> ───────────────┘
                  │  next/dynamic({ ssr:false })   ← 2D canvas + decode are
                  ▼                                  browser-only
            <CloudCanvasView config filter wheelZoom={false} initFrom="[data-pills]">
                  │
                  ├── CLOUD_CANVAS_PORTFOLIO_CONFIG   (locked preset, tuned in /lab on `dev`)
                  ├── cloudProjects[24]               (src · name · type · form)
                  │
                  └── new CloudCanvasEngine(canvas, config, images)
                         ├─ owns NO scheduler  ← tick(dt) is called by the view
                         ├─ draws TRANSPARENT  ← clearRect only, never a bg fill
                         └─ setFilter() re-FORMS (no rebuild): survivors glide,
                            filtered-out evaporate in place, returners condense
                            in at their new spot
```

### D · One frame of the globe

```
   formation unit points          per-card easing            painter's algorithm
   ───────────────────           ───────────────            ───────────────────
   Fibonacci sphere              visEase  (filter)          sort by rotated z
   (Y_SQUASH 0.86)               hoverEase                        │
        │                        focusEase ──┐                    ▼
        ▼                        dimEase     │           ┌────────────────┐
   Euler rotate (yaw/pitch/roll) ◄───────────┘           │ far  ░ faded   │
        │                                                │  ▒             │
        ▼                        FOCUS warp: a focused   │   ▓  CORE      │
   orthographic project          tile leaves the         │  LABEL drawn   │
   screen = centre + xy·radius   formation COMPLETELY,   │   ▓  HERE      │
        │                        landing at centre,      │  █  near, big  │
        ▼                        z→1.16, +0.45 scale —   └────────────────┘
   draw: frame sprite blit       so every tile presents   the heading is SPLICED
       + clip + cover-draw       identically whichever    into the sort, so tiles
       + depth fade              face it was clicked on   pass BEHIND and IN FRONT

   cost ≈ 48 drawImage + 25 fillRect + 24 clips + 2 shadow-blurred fillText
   …every frame. The 0.2 autospin never reaches rest → no dirty check possible.
```

### E · Load + idle gating

```
  page load                scroll ──────────────────────────────────────►
     │
     │  mount: engine constructed, canvas empty & transparent. NO fetch.
     │
     ├──[data-pills] top hits viewport top ──► armInit()      ← ScrollTrigger floor:
     │  (first UNPINNED section after the WhyStay pin)          keeps the 1.44MB
     │                                                          fetch out of the
     │                                                          page's heaviest pin
     ├──1000px before the canvas ──► startInit()
     │        fetch 24 imgs → decode → downscale to ≤900px → benchmark 2 real frames
     │                                                            │
     │                                        avg > 8ms? ─── yes ─┴─► isLite = true
     │                                        (CPU raster: FF/Linux ~35ms vs ~4.6ms)
     │                                        locked for the mount — never re-evaluated
     │
     └──canvas intersects (IO rootMargin 0px) ──► inView = true ──► ticker paints
                                                  leaves view  ──► inView = false
                                                                   → zero repaints

   paint cap per frame:   coarse pointer → 30
                          isLite         → 30
                          interacting    → scrollRepaintFpsCap()   (cursor is the
                          else           → heavyEffectFpsCap()      reference frame)
                          +1ms tolerance, or 120Hz ticks slip and you measure ~44fps
```

### F · Grid mode — desktop, 4 columns (D3 + D9)

Tile heights are the authored aspects (§8.1), NOT a uniform cell:

```
 ┌─ #work ────────────────────────────────────────────────────────────┐
 │      ╭──────────────────────────────╮  ╭───────────────╮           │
 │      │ all │ web │ brandings │ misc │  │ globe │ grid  │ ← D6      │
 │      ╰──────────────────────────────╯  ╰───────────────╯   switcher│
 │                                                     sits beside    │
 │  ┌─ .viewport  mask-image: ↓ ─────────────────────── the filters ─┐│
 │  │ ░░░░░░░░░░░░░░░░░░░░░ transparent → opaque (12%) ░░░░░░░░░░░░░ ││
 │  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐                        ││
 │  │  │ land │  │ SQR  │  │ port │  │ land │   land = 1.577  241px  ││
 │  │  └──────┘  │      │  │      │  └──────┘   sqr   = 1.000  380px ││
 │  │  ┌──────┐  └──────┘  │      │  ┌──────┐   port  = 0.767  495px ││
 │  │  │ port │  ┌──────┐  └──────┘  │ SQR  │   (in a 380px column)  ││
 │  │  │      │  │ land │  ┌──────┐  │      │                        ││
 │  │  │      │  └──────┘  │ land │  └──────┘   uniform WIDTH,       ││
 │  │  └──────┘  ┌──────┐  └──────┘  ┌──────┐   varied HEIGHT →      ││
 │  │  ┌──────┐  │ port │  ┌──────┐  │ port │   no two columns ever  ││
 │  │  │ SQR  │  │      │  │ SQR  │  │      │   line up              ││
 │  │  │      │  │      │  │      │  │      │                        ││
 │  │  └──────┘  └──────┘  └──────┘  └──────┘                        ││
 │  │     ↓         ↑         ↓         ↑     ← alternating, ±15%    ││
 │  │  col 1     col 2     col 3     col 4      speed variance       ││
 │  │ ░░░░░░░░░░░░░░░ opaque → transparent (88%) ░░░░░░░░░░░░░░░░░░░ ││
 │  └────────────────────────────────────────────────────────────────┘│
 └────────────────────────────────────────────────────────────────────┘

   one column = logos-marquee's mechanic, vertical:
   ┌ clone the tile group until track ≥ viewport + 1 advance
   ├ advance = THIS column's own offsetHeight + gap  (§8.1 — columns of
   │           unequal height loop at different periods and desync for free)
   ├ gsap.to(track, { y: -advance, repeat: -1, ease: "none" })
   └ frame at y=-advance ≡ frame at y=0  →  the restart is invisible
     (clones are aria-hidden + out of tab order)

   hover col 3:   col1 ↓   col2 ↑   col3 ■ (timeScale→0 over .4s)   col4 ↑
                                         └─ D4: neighbours keep moving
```

### F.2 · Sparse filters — drop columns, never resize tiles (§8.2)

```
  all · 24 projects            web · 10              brandings · 6
  ┌──┐┌──┐┌──┐┌──┐             ┌──┐┌──┐┌──┐            ┌──┐┌──┐
  │  ││  ││  ││  │             │  ││  ││  │            │  ││  │
  └──┘│  │└──┘│  │             └──┘│  │└──┘            │  ││  │
  ┌──┐└──┘┌──┐└──┘             ┌──┐└──┘┌──┐            └──┘└──┘
  │  │┌──┐│  │┌──┐             │  │┌──┐│  │            ┌──┐┌──┐
  └──┘└──┘└──┘└──┘             └──┘└──┘└──┘            └──┘└──┘
   4 cols · 6 per column        3 cols · 3–4          2 cols · 3
      ▲ tile size is IDENTICAL in all three — only the COUNT of columns
        changes and the field re-centres. The globe does the opposite
        (densityFactors GROWS tiles when sparse); copying that here would
        widen the column and stop it being a wall.
```

### G · Grid mode — mobile, 2 columns (the DEFAULT there, D2)

```
 ┌─────────────────────┐    no hover on touch, so:
 │  ╭───────────────╮  │      · columns just keep drifting
 │  │ globe │ grid  │  │      · tap = expand
 │  ╰───────────────╯  │      · NO drag-to-scrub — that would recreate
 │ ░░░░░░░░░░░░░░░░░░  │        the exact gesture conflict the globe
 │  ┌──────┐ ┌──────┐  │        had to concede (touch-action: pan-y)
 │  │ land │ │ port │  │
 │  └──────┘ │      │  │    the grid's whole advantage here is that it
 │  ┌──────┐ │      │  │    asks NOTHING of the visitor
 │  │ port │ └──────┘  │
 │  │      │ ┌──────┐  │
 │  │      │ │ SQR  │  │
 │  └──────┘ │      │  │
 │  ┌──────┐ └──────┘  │
 │  │ SQR  │ ┌──────┐  │
 │  └──────┘ │ land │  │
 │     ↓     └──────┘  │
 │ ░░░░░░░░░░░░░░↑░░░  │
 └─────────────────────┘
```

### H · Mode switching — the mount contract

```
                    ┌───────────── device default (D2) ─────────────┐
                    │  useSyncExternalStore → server snapshot first,│
                    │  device branch chosen AFTER hydration         │
                    └───────┬───────────────────────────┬───────────┘
                     desktop│                     mobile│
                            ▼                           ▼
                     ┌────────────┐   switcher   ┌────────────┐
                     │   GLOBE    │ ◄──────────► │    GRID    │
                     │ 2D canvas  │              │ DOM+GSAP   │
                     └────────────┘              └────────────┘
                            │                           │
              on leaving:   │                           │  on leaving:
              ticker.remove │                           │  kill tweens
              engine.dispose│                           │  disconnect IO
              IO/RO/gate off│                           │  remove clones
                            ▼                           ▼
                        UNMOUNTED                   UNMOUNTED

   ⛔ NEVER render both and hide one with display:none — that is two
      repaint sources for one visible section. The filter state is
      SHARED across modes (it belongs to portfolio.tsx, not to either mode).
```

### I · The expand (D5, in-place Flip)

```
        BEFORE (state captured)              AFTER (Flip plays the delta)
   ┌──────────────────────────────┐     ┌──────────────────────────────┐
   │ ┌────┐ ┌────┐ ┌────┐ ┌────┐  │     │ ░░░░░░ wall dimmed ░░░░░░░░  │
   │ │▓▓▓▓│ │▓▓▓▓│ │████│ │▓▓▓▓│  │     │ ░░  ┌──────────────────┐ ░░  │
   │ ├────┤ │    │ └────┘ │    │  │ ──► │ ░░  │                  │ ░░  │
   │ │▓▓▓▓│ ├────┤   ▲    ├────┤  │     │ ░░  │      ████        │ ░░  │
   │ │    │ │▓▓▓▓│   │    │▓▓▓▓│  │     │ ░░  │                  │ ░░  │
   │ └────┘ └────┘ clicked └────┘ │     │ ░░  └──────────────────┘ ░░  │
   └──────────────────────────────┘     └──────────────────────────────┘
      all columns keep drifting              columns PAUSE while open

   mirrors the globe's focus: one tile leaves the formation, parks centre,
   everything else dims. Escape / click-out closes; focus returns to the
   originating tile.
   D8 later: this expanded panel is where the FULL-LENGTH shot lives —
   the wall shows the crop, the expand reveals the long screenshot.
```

---

## 15. Final view — what the finished mode looks like

Wireframes of the END STATE, drawn 2026-07-27. Everything below is the grid
mode as specified by D1–D9; the globe is unchanged and reached through the
switcher.

### 15.1 Desktop, at rest (the money shot)

```
 ╔═════════════════════════════════════════════════════════════════════╗
 ║   ☁                          ╭───────────────────╮            ☁     ║
 ║        ☁                     │ ascnd    ≡  menu  │                  ║  fixed sky
 ║                              ╰───────────────────╯      ☁           ║  (#62abff
 ║                                                                     ║  + grain
 ║                    stuff we've  𝑠𝘩𝑖𝑝𝑝𝑒𝑑                              ║  + clouds)
 ║                    ▲ DOM <h2> in grid mode — the globe paints this   ║
 ║                      in-canvas at its core; grid has no canvas.      ║
 ║                      RESOLVED — see §17.                                 ║
 ║                                                                     ║
 ║      ╭──────────────────────────────────╮  ╭──────────────────╮     ║
 ║      │ all │ web │ brandings │ misc     │  │  globe  │  grid  │     ║
 ║      ╰──────────────────────────────────╯  ╰──────────────────╯     ║
 ║        filter tabs (existing, shared)        mode switcher (D6)     ║
 ║                                                                     ║
 ║  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ║ ← D7 mask
 ║  ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒  ║   0 → 1
 ║  │  emerald   │   │  crypkit   │   └────────────┘   │  phone fin │  ║   over 12%
 ║  │  poster    │   └────────────┘   ┌────────────┐   │            │  ║
 ║  └────────────┘   ┌────────────┐   │            │   │            │  ║
 ║  ┌────────────┐   │            │   │  emerald   │   └────────────┘  ║
 ║  │  kalinka   │   │ phone fit  │   │ telehealth │   ┌────────────┐  ║
 ║  └────────────┘   │            │   │            │   │            │  ║
 ║  ┌────────────┐   │            │   └────────────┘   │  tablet    │  ║
 ║  │            │   └────────────┘   ┌────────────┐   │            │  ║
 ║  │  monitor   │   ┌────────────┐   │            │   └────────────┘  ║
 ║  │            │   │  medlink   │   │  cloth tag │   ┌────────────┐  ║
 ║  └────────────┘   └────────────┘   │            │   │  fashion   │  ║
 ║  ┌────────────┐   ┌────────────┐   └────────────┘   └────────────┘  ║
 ║  │            │   │            │   ┌────────────┐   ┌────────────┐  ║
 ║  │  laptop    │   │ circle mark│   │  ops dash  │   │            │  ║
 ║  │            │   │            │   └────────────┘   │ emerald ask│  ║
 ║  │            │   └────────────┘   ┌────────────┐   │            │  ║
 ║  ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒  ║ ← 1 → 0
 ║  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ║   from 88%
 ║       ↓ 34px/s      ↑ 29px/s       ↓ 31px/s       ↑ 27px/s          ║
 ║      col 1         col 2          col 3          col 4              ║
 ╚═════════════════════════════════════════════════════════════════════╝

  Read the SEAMS, not the tiles: every column's tile boundaries fall on
  different lines, because heights are the authored aspects (§8.1) and
  nothing is padded to match. That is the whole masonry effect.
  Adjacent columns run opposite directions at ±15% speed variance, so the
  wall never resolves into a readable pattern.
```

### 15.2 Desktop, pointer over column 3 (D4)

```
 ║  ┌────────────┐   ┌────────────┐   ┌────────────┐   ┌────────────┐  ║
 ║  │  kalinka   │   │            │   │  emerald   │   │  tablet    │  ║
 ║  └────────────┘   │ phone fit  │   │ telehealth │   │            │  ║
 ║  ┌────────────┐   │            │   │            │   └────────────┘  ║
 ║  │  monitor   │   └────────────┘   └────────────┘   ┌────────────┐  ║
 ║       ↓             ↑                  ■                ↑          ║
 ║    still moving  still moving    timeScale → 0     still moving    ║
 ║                                  over ~0.4s                        ║
 ║                                  (an eased stop reads as attention;║
 ║                                   a hard .pause() reads as a stall)║
```

### 15.3 Desktop, tile expanded (D5)

```
 ╔═════════════════════════════════════════════════════════════════════╗
 ║      ╭──────────────────────────────────╮  ╭──────────────────╮     ║
 ║      │ all │ web │ brandings │ misc     │  │  globe  │  grid  │     ║
 ║      ╰──────────────────────────────────╯  ╰──────────────────╯     ║
 ║ ░▒▓███████████████████████████████████████████████████████████▓▒░   ║
 ║ ▓███ wall dimmed + PAUSED behind ████████████████████████████████   ║
 ║ ██     ┌───────────────────────────────────────────────┐      ███   ║
 ║ ██     │                                               │      ███   ║
 ║ ██     │                                               │      ███   ║
 ║ ██     │              medlink                          │      ███   ║
 ║ ██     │              the tile, Flipped from its       │      ███   ║
 ║ ██     │              exact position in the wall       │      ███   ║
 ║ ██     │                                               │      ███   ║
 ║ ██     │                                               │      ███   ║
 ║ ██     └───────────────────────────────────────────────┘      ███   ║
 ║ ▓█████████████████████████████████████████████████████████████▓▒░   ║
 ║          esc / click-out closes · focus returns to the tile         ║
 ╚═════════════════════════════════════════════════════════════════════╝

  D8, last: this panel is where the FULL-LENGTH shot lives — the wall
  shows the crop, the expand reveals the long screenshot.
  Deferred alternative (§10): the same click opening a lightbox with the
  project name + link instead of an in-place Flip.
```

### 15.4 Mobile — grid is the DEFAULT here (D2)

```
      ╔═══════════════════════╗
      ║  ☁       ╭─────────╮  ║
      ║          │ ascnd ≡ │  ║
      ║          ╰─────────╯  ║
      ║   stuff we've shipped ║
      ║  ╭─────────────────╮  ║   filters wrap /
      ║  │ all │web│brand… │  │   scroll horizontally
      ║  ╰─────────────────╯  ║
      ║  ╭─────────────────╮  ║
      ║  │  globe  │ grid  │  ║ ← switcher stays
      ║  ╰─────────────────╯  ║
      ║ ░░░░░░░░░░░░░░░░░░░░  ║
      ║  ┌───────┐ ┌───────┐  ║
      ║  │kalinka│ │       │  ║
      ║  └───────┘ │ phone │  ║
      ║  ┌───────┐ │  fit  │  ║
      ║  │       │ │       │  ║
      ║  │emerald│ └───────┘  ║
      ║  │ poster│ ┌───────┐  ║
      ║  │       │ │ tablet│  ║
      ║  └───────┘ │       │  ║
      ║  ┌───────┐ └───────┘  ║
      ║  │monitor│ ┌───────┐  ║
      ║  │       │ │medlink│  ║
      ║  └───────┘ └───────┘  ║
      ║ ░░░░░░░░░░░░░░░░░░░░  ║
      ║     ↓         ↑       ║
      ╚═══════════════════════╝

   no hover on touch → columns simply keep drifting; tap = expand.
   NO drag-to-scrub: it would recreate the gesture conflict the globe
   had to concede (touch-action: pan-y), and the grid's advantage here
   is that it asks nothing of the visitor.
```

---

## 16. Reference check — the Pinterest screenshot (2026-07-27)

A real Pinterest wall was shared to confirm the intended look. It is the right
layout reference: uniform column width, heights from each image's own aspect,
seams that never line up. Four deltas are deliberate and should not be
"corrected" toward the reference without a decision:

| | Pinterest reference | this grid |
|---|---|---|
| aspect spread | ~2.5–3:1 (tall pins run 1:2 → 2:3) | **2:1** — landscape 241px → portrait 495px in a 380px column (§8.1) |
| motion | static wall | columns drift in opposite directions (D3) |
| ground | white cards on a white page | tiles float over the live sky + clouds |
| edges | runs edge to edge | dissolves into sky, top and bottom (D7) |

### 16.1 Why we do NOT chase the full Pinterest spread

**Height × motion is the constraint the reference doesn't have.** A 1:2 tile in
a 380px column is 760px tall — most of a viewport — and at ~30px/s it dominates
its column for the better part of half a minute. Static walls don't pay that.
Cap the tallest grid form near **0.6** (≈633px at a 380px column) rather than
matching Pinterest's extremes.

**Content sets the ceiling anyway.** Posters and device mockups are already
portrait and can be re-cropped taller for the grid-only preset (that is what the
`grid?.form` override and the separate output directory in §9 are for). Web
designs are landscape screenshots — cropping one to 2:3 destroys it. So the
realistic end state is: web work reads as the wide anchors, branding and
mockups as the tall ones. Livelier than §15's drawing, calmer than the
reference. That is on-brand, not a compromise.

### 16.2 Consequence for the build order — RESOLVED (D11)

Splitting two things that were implicitly one: the **`tall` slot** is a row in
the aspect table, while **D8's full-length designs** are new long-form artwork
revealed by the expand. They *could* ship separately.

**Decided: they don't.** The wall launches on the three authored aspects and its
2:1 spread; `tall` arrives with D8, last. The reference's wider spread is
knowingly not matched in pass 1 (see 16.1 for why that is defensible).

### 16.3 Tile treatment — RESOLVED (D10)

**Glass-matted frame**, the same treatment the globe draws around every tile —
not bare rounded corners. Bare works over the reference's white page; over the
live sky it reads as a sticker, and the mat is what keeps the two modes one
visual language. The DOM implementation has to reproduce the engine's mat
(inset, radius, hairline, sheen) in CSS rather than approximate it by eye.

---

## 17. Settled during pass 1 (2026-07-27)

Two things the spec left open that building step 1 forced to a decision.

### 17.1 The heading — visible in grid mode, hidden in globe mode

The globe paints "stuff we've shipped" *inside* its canvas at the sphere's core
(`config.coreLabel`), spliced into the painter's sort so near tiles pass in
front of the words and far tiles behind. A DOM heading can only sit wholly above
the canvas or wholly below it; depth is the whole point of that trick, so the
globe keeps it.

The grid has no canvas. **The `<h2>` therefore lives in the DOM in both modes and
is merely `sr-only` while the engine is the one drawing it** — the accessible
name and the crawlable text never move, only their visibility. In grid mode it
shows, above the controls, in the house mixed-font display (Product Sans Light +
Instrument Serif on "shipped"). The two copies of the words must stay in sync.

### 17.2 The wall is its own box BELOW the header — corrected 2026-07-27

Shipped first as a full-bleed layer behind the floating header, on the reasoning
that a mask needs content in its fade band and padded columns would leave the
top 12% fading empty sky. **Stakeholder call: the heading and the controls sit
ABOVE the grid, not over it.** They were right, and the original reasoning had a
false premise: the fix is not padding the columns inside a full-bleed masked
layer (which really would fade nothing), it is giving the WALL ITS OWN BOX below
the header and masking that. Then the wall's top *is* the fade's top and 12% of
tile does the dissolve, as specified.

So the band is now `flex flex-col`: header in flow, wall `flex-1 min-h-0`
underneath. `min-h-0` because a flex item's default `min-height: auto` would let
the columns push the box past the band and defeat its overflow clip. The mask
top stop goes back to the spec's **12%** — the 22% was only ever compensation
for tiles passing behind the heading, which can no longer happen.

The globe is untouched: its canvas is `absolute inset-0`, out of flow, so it
keeps floating its controls over a full-bleed sphere. **The two modes now differ
in layout model on purpose** — the globe is an object you look *into* and its
chrome floats on top; the grid is a surface you look *at* and its chrome sits
above it.

### 17.3 Not yet true (so nobody reads pass 1 as the finished mode)

- No motion. Columns are static; steps 2–3 add the drift and the hover pause.
- Tiles are `<figure>`s with alt text, **not** links or buttons — there is
  nothing to open until the expand (step 5) exists, and a control that does
  nothing is worse than none.
- Still the globe's own images (`public/portfolio/cloud/`, cropped to the three
  slot aspects, ≤900px). The dedicated grid preset (§9) only earns its bytes
  once tile sizes diverge from the globe's.
- No tier row in `lib/perf/tiers.ts` yet: at rest the wall has no loop to gate.
  It **must** land with step 2, in the same commit as the first tween (§6 row 3).

### 17.4 Drift mechanics, as built (steps 2–3)

- **A falling column cannot simply translate downward from 0** — at `y = 0` its
  first tile already sits at the viewport top, so falling would drag empty space
  in behind it. Falling columns start at `y = -advance` (one group parked above
  the viewport) and travel to 0; rising columns are the plain `0 → -advance`.
- **Each column measures its OWN advance** (`group.offsetHeight + rowGap`).
  Unequal column heights at a constant px/sec means unequal loop periods, so the
  columns desync with no extra machinery. Never pad a column to match another —
  that would delete the effect (§8.1).
- **Speed variance is a fixed pattern**, `[1, 0.87, 1.12, 0.94]`, not
  `Math.random()`: random would differ between server and client, and a fixed
  offset is reproducible when something looks wrong. Chosen asymmetric so
  columns 1 and 3 — same direction — still drift apart over time.
- **`DRIFT_SPEED = 30` px/sec**, deliberately under the logos row's 40: that
  marquee is glanced at in passing, this is work someone is reading. A tile
  crosses a 400px window in ~13s.
- **`will-change: transform` is on the TRACK**, one per column, never on a tile.
- **Clones are `aria-hidden`** and will need excluding from the tab order once
  step 5 makes tiles focusable — a screen reader must not read the portfolio
  three times.
- **Rebuild key** is `filter:columnCount`. A filter change or a breakpoint
  change replaces the columns wholesale, and both the cloned nodes and the
  measured advances belong to the old wall.

---

## 18. Image pipeline findings (measured 2026-07-27)

### 18.1 Grid tiles keep Next's optimizer — do NOT add `unoptimized`

`design-shots.tsx` opts out of the optimizer for a stated reason (Next's re-encode
softened fine mockup text). The wall carries the same kind of content — UI
screenshots with small type — so the question had to be asked rather than
assumed. It was measured, and **the design-shots premise does not transfer.**

There, the source is a lossless ~1024² PNG shown at roughly native size, so
Next's pass is a *pure* lossy re-encode. Here the master is already lossy WebP
(q82, ≤900px) displayed at ~380 CSS px. Comparing both pipelines at the same
760px raster by mean-|Laplacian| edge energy:

| tile | master | AVIF q75 | WebP q75 |
|---|---|---|---|
| operations-dashboard | 5.74 | 5.57 (−3%) | 4.53 (−21%) |
| medlink | 6.36 | 6.15 (−3%) | 4.99 (−22%) |
| tasktrox-webapp | 8.50 | 7.93 (−7%) | 6.28 (−26%) |
| kalinka | 9.54 | 9.10 (−5%) | 7.30 (−23%) |

`next.config.ts` sets `formats: ["image/avif", "image/webp"]`, so AVIF is what
nearly everyone gets: a 3–7% loss. The 21–26% softening is the legacy-WebP
fallback only. Bytes for the whole 24-tile set: master 838K · 828px AVIF 685K
(−18%) · 640px 541K (−35%) · **384px 256K (−69%)** — and the big win lands on
mobile, which is exactly where D2 makes the grid the default.

`unoptimized` is also all-or-nothing: `get-img-props.js` returns
`srcSet: undefined, sizes: undefined` on that branch, so opting out would cost
the responsive srcset entirely and hand every device the 900px master.

**Decision: keep the optimizer.** Accept 3–7% edge-energy loss on the AVIF path
for 35–69% fewer bytes where this mode is the default — and note that
`unoptimized` could not buy the crispness back anyway, for the reason below.

### 18.2 Why §9's grid preset is now justified by measurement, not taste

After `object-cover`, **8 of 24 tiles are already source-limited at a 380px
column on a 2× display**, and the best tile has only 1.18× headroom:

```
phone-mockup-fitness   900×675 → portrait box → 518 usable   (0.68× of a 760px raster)
emerald-mark / -mind / -ohio, laptop-, phone-finance → 600    (0.79×)
emerald-poster-help 672 · monitor-mockup 675                  (0.88–0.89×)
16:9 landscape tiles → 798 (1.05×)   ·   everything else 900   (1.18×)
```

The globe's 900px long-side cap leaves a 2:3 portrait only 600px wide, and a 4:3
source cropped into the portrait slot only 518px. Cropping to the WALL's aspect
*before* the 900 cap is what the preset buys. That is a resolution argument,
independent of the byte argument above, and it is the real reason step 6 exists.

### 18.3 `sizes` verified

The declared `(max-width: 768px) 45vw, (max-width: 1600px) 23vw, 380px` is
correct as an upper bound: at 1440px the 4-column layout computes to 330px vs a
declared 331px; at 1600px, 370 vs 368; above that the `max-w-[380px]` cap holds.
Sparse filters only widen columns up to that same cap, so it stays safe.
