# Portfolio grid mode — the second variant of the work section

**Status: DECIDED 2026-07-27. Steps 1–3 and 5 of 7 BUILT (§13), unverified in a
browser. Step 4 is blocked on a human looking at it.**
This is the architecture decision record for the portfolio section's *second*
display mode — a Pinterest-style column wall that sits beside the existing image
globe. It is the contract the implementation has to satisfy; §17 records what
building the first step settled.

**Resuming this work? Read `docs/portfolio-grid-remaining.md` instead** — it is
the handoff: branch, current state, and the remaining steps in enough detail to
continue on another machine. This file is the decision record behind it.

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

So the two modes are not redundant. They originally split by device; since
2026-07-28 the wall is simply the default and the globe is the thing you opt
into (D2, §25). The argument above is why — it just turned out to apply on
the desktop too, not only on a phone.

---

## 3. Decisions

| # | Decision | Locked |
|---|---|---|
| **D1** | The grid is **DOM + CSS transforms + GSAP**. Not WebGL, not a second 2D canvas, not a new formation inside the existing engine. | ✅ |
| **D2** | ~~Globe default on desktop, grid on mobile.~~ **REVISED 2026-07-28 (§25): grid is the default EVERYWHERE.** Both modes still reachable on both devices via the switcher. | ✅ |
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

Corollary for D2 — **no longer applies to the MODE, and that is the point**
(§25). The initial mode used to be a device decision, which meant picking it the
way `CloudLayer` does: `useSyncExternalStore` with a server snapshot, SSR
renders one stable branch, the device branch arrives after hydration. The
unavoidable cost was that a phone rendered the *globe* on the server and swapped
to the wall on hydration — mounting and disposing a canvas for nothing, on the
devices least able to afford it.

Grid being the default everywhere removes that: SSR and the client now agree on
the mode for every device. The `useSyncExternalStore` idiom is still used, but
only for the wall's COLUMN COUNT (D3), where being wrong for one render re-deals
4 columns into 2 and rebuilds the marquee — no canvas involved. Still no
`matchMedia` in the render path, for the same hydration reason.

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
5. ✅ **DONE** — expand (D5), wall dim, Escape/click-out to close, focus
   restored to the originating tile. `grid/grid-expand.tsx` + the freeze
   contract in `grid/grid-freeze.ts`. Built out of order: step 4 needs a human
   in a browser, and this did not.
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
                    ┌──────────── default (D2, rev. §25) ───────────┐
                    │  GRID, on every device. SSR and client agree, │
                    │  so no mode swap on hydration and no canvas   │
                    │  mounted-then-disposed on a phone.            │
                    └───────────────────┬──────────────────────────┘
                                        │  (was: desktop→globe, mobile→grid)
                                        ▼
                     ┌────────────┐   switcher   ┌────────────┐
                     │   GLOBE    │ ◄──────────► │    GRID    │
                     │ 2D canvas  │   opt-in     │ DOM+GSAP   │
                     │            │              │ ← default  │
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

---

## 19. The expand, as built (step 5)

### 19.1 Clicks are delegated and native — NOT React `onClick`

The marquee CLONES each column's tiles (step 2), and at any moment most tiles on
screen are those clones. They are `cloneNode`d DOM with **no React fiber**, so
React's delegated synthetic events never fire for them: an `onClick` on the tile
would work on the handful of originals and silently do nothing on every copy —
which would have read as "the expand works sometimes".

So the wall carries one native `click` listener, resolved with
`closest("[data-grid-tile]")` and the tile's `data-tile-key`. This is a
correctness requirement of cloned content, not a style preference. Anything
later that adds per-tile interaction (a hover label, a link) inherits the same
constraint.

Related: clones are `aria-hidden` **and** their tiles get `tabIndex = -1`, but
they stay clickable. Making them `inert` would be tidier for AT and would break
the wall's main interaction, since most of what you click is a clone.

### 19.2 FLIP by hand, not the Flip plugin

The panel renders at its final centred layout, is measured, and is tweened from
the delta to the tile's live rect. Two things make the simple version correct:

- `getBoundingClientRect` is already post-transform viewport space, so the
  drifting track's translate is accounted for with no extra work.
- **The panel keeps the tile's ASPECT**, so the scale is uniform and the shot
  cannot distort in flight. A panel of a different shape would need per-axis
  handling — that is when the plugin earns its place. (§10's deferred lightbox
  variant is exactly that case, and should use the plugin.)

The return flight **re-measures** the origin. The columns ease to a stop rather
than snapping, so the tile keeps moving for ~0.4s after the outbound flight
starts; flying home to the rect captured on the way out would land the tile
visibly beside itself.

### 19.3 The panel is portalled to `<body>`

Inside the wall it would be clipped by the viewport's `overflow-hidden`, faded
by its edge mask (masks apply to every descendant), and `position: fixed` would
be trapped by the tracks' `will-change: transform`, which forms a containing
block. All three vanish with a portal.

### 19.4 The wall recedes, it does not darken

Opening a tile drops the wall's opacity to 0.3 rather than laying a dark scrim
over it. This site's depth cue is toward white/atmosphere, never toward black —
the same rule `cloud-canvas-engine.ts` follows for its own haze ("*NOT black:
this site's depth cue is receding INTO the sky … which reads muddy over the
bright atmosphere*"). The backdrop element is transparent and exists only to
catch the click-out.

### 19.5 The freeze contract

`grid-freeze.ts` is a window event plus a module-scoped flag, the same idiom as
`intro-state.ts`. The marquee and the expand are siblings that must not hold
handles to each other: the marquee **rebuilds** on every filter change and every
resize, so a direct reference would go stale exactly when it matters. Three
cases the flag (rather than the event alone) covers:

- a marquee rebuilt *while a tile is open* comes back frozen, because it reads
  `isFrozen()` instead of waiting for an event that already fired;
- `pointerleave` firing as the cursor crosses the backdrop toward the panel must
  not restart that column;
- `setFrozen` is idempotent, so a double-close can't thaw a wall that has since
  been legitimately frozen again.

---

## 20. Step 6 — RESOLVED, the originals were never lost (2026-07-27)

This section previously recorded step 6 as blocked, on the finding that
`portfolio-src/` held `SOURCES.md` and nothing else. **That was a conclusion
drawn from `git ls-files`, and it was wrong about the world.** The folder is
listed in `.gitignore` — the PNGs were never *committed*, which is not the same
as never *existing*. All 24 are on the authoring machine, exactly where
`SOURCES.md` says they should be. Nothing had to be re-pulled from Figma.

The lesson worth keeping: for a gitignored path, git history is evidence about
the repository, not about the disk. Check the filesystem before recording an
asset as lost.

**Built:** `scripts/build-portfolio-presets.mjs` (`npm run presets:portfolio`),
a sibling of `optimize-portfolio-images.mjs` that never touches
`public/portfolio/cloud` or `MAX_SIDE` — that constant stays hand-coupled to the
engine's `FAST_MAX_SIDE`, and raising it would bill every globe visitor for
bytes only the wall can see. It emits two presets from the originals:

| preset | crop | cap | consumed by |
|---|---|---|---|
| `public/portfolio/grid/` | to the tile's SLOT aspect | 900 | the wall tile (`gridSrc()`) |
| `public/portfolio/full/` | none — the whole design | 1400 | the expanded panel (`fullSrc()`) |

Measured against §18.2's table, cropping *before* the cap recovers what the old
double-downscale threw away. Source-limited tiles drop from 8 to 6, and the
worst case improves by 15%:

```
phone-mockup-fitness   518 → 589 usable   (0.68× → 0.78×)
emerald-* / laptop- / phone-finance  600 → 672–689   (0.79× → 0.88–0.91×)
monitor-mockup         675 → 768          (0.89× → 1.01×)
16:9 landscape tiles   798 → 900          (1.05× → 1.18×)
```

Bytes: grid 866K (vs the globe set's 838K — the same order, for a sharper
image), full 1169K and fetched only when a tile is actually opened.

The wall aspect per slug is **parsed out of `cloud-canvas-data.ts`**, not copied
into the script: that registry is the single source of truth for `form` and for
`grid.form`, and a duplicate would drift silently the first time a tile is
reshaped. A slug the registry does not mention, or a missing original, is a hard
error rather than a quietly skipped tile.

Paths are likewise **derived, not listed**. `gridSrc()` / `fullSrc()` map a
project's `src` slug into each preset directory; `grid.src` / `grid.full` remain
as per-project overrides for framing the convention cannot express. Twenty-four
literal paths in the registry would have been 24 chances to typo a filename that
still type-checks and only surfaces as a broken tile.

### 20.1 Why the ordering held anyway

The original worry — that cutting the preset before step 4 would waste it —
turned out not to bite, because step 4 changed **no layout constant** (§22). But
the ordering was still right for the reason given: the preset is cut against the
wall's aspects, and had step 4 moved the column width or D8 landed `tall`, these
24 assets would have been recut. Step 4 first remains the correct sequence.

## 21. Self-review of steps 1–5 (2026-07-27)

None of the motion has been seen in a browser, so the code was re-read cold
looking for defects. Three were real and are fixed; one suspected issue was
checked and dismissed.

**Fixed — the origin tile can be GONE by close time.** The tile a panel flew
from is usually a marquee CLONE, and the marquee destroys every clone on each
rebuild, which a resize behind an open panel triggers. Flying "home" to a
detached node measures a 0×0 rect at the document origin: the panel would have
collapsed into the top-left corner. Now `isConnected` is checked and the panel
fades in place instead — a gentler exit for a case the visitor caused, and
honest about having lost the tile.

**Fixed — unmounting while open left the wall frozen forever.** The freeze flag
is module-scoped precisely so it survives a marquee rebuild, which means nothing
else would ever thaw it: a mode switch with a tile open would have left the wall
dimmed to 0.3 and permanently motionless on the next visit. GridExpand now
thaws and restores on unmount.

**Fixed — focus never entered the dialog.** It stayed parked on the tile button,
which by then is invisible and behind the overlay. Focus now moves to the dialog
(with `preventScroll` — it is a fixed overlay, and letting the browser scroll to
it would move the page the return flight is aiming at). Still not a focus TRAP;
that belongs with the deferred lightbox variant, which is when this becomes a
real modal.

**Checked and dismissed — the custom cursor.** The expanded panel sits at
z-120 and the site hides the native cursor (`html[data-custom-cursor="on" ] *`),
so a panel above the cursor layer would have left no visible pointer at all.
`cursor-visual.tsx` is `z-[9999]`, comfortably above. Fine.

**Noted, not changed — the navbar floats over the panel** (`z-[999]` vs the
panel's 120). Arguably right (the nav stays reachable) and arguably wrong (it
sits on top of the work). A look call for the review pass, not a bug.

---

## 22. Step 4 — the browser pass, done (2026-07-27)

Driven with Playwright against the dev server at 1512×982, 1280×800 and 390×844.
The wall had never been rendered anywhere before this; the headline is that
**nothing in the layout needed changing.** Every constant §17.4 and §8 argued for
survived contact with the real thing.

### 22.1 Verified, unchanged

| checked | measured | verdict |
|---|---|---|
| masonry seams | column seams land on different lines in all 4 | the effect works |
| mask stops (12% / 88%) | 89px fade on a 745px wall, both ends | dissolves cleanly; no change |
| gutters | 24px desktop / 14px mobile, track and group equal | reads as a wall, not a contact sheet |
| mat weight | `MAT_RATIO` → 8.5px at a 348px column | matches the globe's ring |
| drift | 26.2 / 33.8 / 28.3 px/s vs 26.1 / 33.6 / 28.2 declared | exact; browsing pace |
| column count | all 4 · web 3 · brandings 2 · misc 2 | §8.2 holds |
| sparse filters | width caps at 380, field re-centres, tiles never grow | §8.2 holds |
| `sizes` | 23vw declared → 348px actual at 1512 | §18.3 confirmed on the nose |
| mobile default | grid, 2 columns, 174px, D2 | correct |
| expand + close | lands on the tile's exact box, wall thaws, no tile left hidden | the freeze contract works |

**A framing note, not a defect.** The section is `pt-[8dvh]` plus a `h-dvh` band,
so the wall's bottom sits ~78px below the fold until you scroll another 78px.
That is where the band aligns to the viewport and the composition resolves. The
globe has the same overrun and never shows it, because its content is a centred
sphere in empty sky; the wall fills its box, so the last strip is simply below
the fold on the way in. Scrolling reveals it. No change.

### 22.2 D4 — RESOLVED: per-column stays

§3.1 flagged this as the one answer worth re-confirming. Confirmed as built, and
the deciding argument is one the original note did not make:

**The section is a full 100dvh.** A whole-wall pause fires whenever the pointer
is anywhere over it — which, on a full-viewport section, is most of the time it
is on screen. The wall would be frozen almost permanently and the drift would
effectively never be seen. Per-column freezes the one column being read and
leaves the other three alive, which is both the better reading experience and
the only version where the feature is visible at all.

Verified: hovering column 3 moved it 0px over 1.5s while its neighbours
continued at their declared speeds.

### 22.3 Navbar z-order — RESOLVED: leave it

§21 left this as "a look call". Looked at, and the premise turns out to be
false: **nothing that paints actually overlaps the panel.** The nav's *bounding
box* intersects it, but the box is `pointer-events-none` and transparent — its
visible controls sit in the right margin, outside the panel at every width
tested (1512 and 1280, landscape and portrait tiles).

So there is nothing to fix, and raising the dialog above `z-[999]` would hide
the nav to solve a collision that does not occur. The nav stays reachable, as
§21 preferred. Re-open this only if the panel envelope grows past `86vw`.

### 22.4 Found in passing

- **The expanded panel is small on a phone** — 335×213 for a landscape shot at
  390px wide, barely 1.9× the tile. A dense UI screenshot is not legible at that
  size, and mobile is where grid is the DEFAULT (D2). This is not a tuning
  problem: a 16:9 desktop screenshot **cannot** be made legible on a 390px
  portrait screen by sizing alone — the envelope is already width-bound, and
  going 86vw → 94vw buys 9%. The real answer is pinch-zoom or a scrollable
  full-resolution view, which is a feature, not a constant. **Recorded, not
  built** — it is the natural next piece of work on this mode.
- **The name label was `text-white/80`** over the receded wall, which is pale
  sky plus washed-out tiles. 80% on that is barely a shade. Now full white.
- **Two Next LCP warnings** name wall tiles. False positives from jumping
  straight to the section — the wall is ~7,600px down the page and is never the
  real LCP. Adding `loading="eager"` would be actively wrong: it would eagerly
  fetch 24 images far below the fold.

---

## 23. Step 7 — the two-stage expand (2026-07-27)

D8's original shape was "full-length designs": a `tall` (~0.55–0.6) slot in the
wall, fed by long-form screenshots. **That half remains blocked, and not on
tooling — on artwork that does not exist.** Every export in `portfolio-src/`
measures 0.667 or wider; the tallest thing in the set is a 2:3 poster. Cropping
a 4:3 mockup into a 0.577 slot would keep 43% of its width and destroy it. No
amount of scripting makes a long-form design out of a 1024×768 frame.

What D8 *also* promised is buildable today, and is the more valuable half —
§8/§15.3's "the wall shows the crop, clicking reveals the full screenshot":

> the long-form shot belongs in the EXPAND, not the wall

**Built.** Opening a tile no longer shows the same crop larger. It shows the
whole design:

```
stage 1   fly from the tile, at the TILE's aspect, showing the same crop
stage 2   once the uncropped file decodes, unfold to the shot's TRUE aspect
```

Measured end to end:

```
phone-mockup-fitness   0.767 → 1.333    a portrait sliver becomes the whole 4:3 mockup
crypkit                1.577 → 1.777    the 16:9 dashboard's cropped edges come back
circle-mark            1.000 → 1.000    no morph — skipped by MORPH_EPSILON
```

### 23.1 Why two stages and not one

§19.2's constraint. The flight is a **uniform** scale, which is exact only while
the panel carries the tile's aspect; flying straight to a different shape needs
per-axis scaling and visibly squashes the shot on the way. Splitting them keeps
the flight uniform and puts the aspect change in its own tween, where no scaling
is happening at all.

The morph animates `width`/`height` rather than a transform — deliberately. The
two stages differ in SHAPE, and a non-uniform transform is precisely the
distortion being avoided. It is one portalled element with no layout dependents,
for half a second, once per open; not a per-frame cost the page carries.

### 23.2 The close folds and flies at once

Returning from an unfolded panel to a tile of a different shape could have been
two sequential tweens (fold back, then fly), which would make every close take
`FLIGHT + MORPH` and read as a stall before the tile goes home.

It runs as one motion instead, and the reason it is safe is a property of the
layout: **the panel is centred by the dialog's flexbox, so folding it does not
move its centre.** The centre-to-centre translation is therefore unaffected by
the fold running alongside it, and the two tweens cannot fight. The flight's
scale is measured against the *folded* width, which is known up front.

Verified by sampling the panel through a close: aspect 1.33 → 1.28 → 1.08 →
0.84 → 0.77 while travelling, landing on 290×378 — the tile's exact box.

### 23.3 Two stacked images, not one swapped source

The panel shows the wall's cropped tile UNDER the uncropped one, which fades in
on decode. At stage 1 both are the same crop at the same size, so the hand-off
is invisible. Without it, clicking a tile would flash an empty white frame while
the larger file downloaded — the cropped tile is already in cache and paints on
the first frame.

### 23.4 The true aspect is read, not stored

`fullAspect` is deliberately NOT a registry field. It is a property *of the
file*: 24 copies in `cloud-canvas-data.ts` would be 24 numbers to re-derive by
hand every time an export is re-pulled, and a stale one would size the panel
wrong with nothing to catch it. It is read off the decoded image instead —
which costs nothing, since the morph could not begin before the pixels exist.

### 23.5 What remains of D8

Only the `tall` wall slot, and only the artwork. When long-form designs exist:

1. Drop them into `portfolio-src/`, add the entry to `cloud-canvas-data.ts`.
2. Add `tall` to `ProjectForm` and to `GRID_ASPECT` — **cap near 0.6, not
   Pinterest's 1:2** (§16.1: height × motion is a cost a static wall never pays).
3. Re-run `npm run presets:portfolio`. Both presets pick it up automatically —
   the script reads the wall form out of the registry.
4. `grid.span: 2` is still reserved and still unimplemented; the first span-2
   tile buys a second `sizes` value per breakpoint (§8.1).

---

## 24. D8 — the `tall` slot and the scrolling expand (2026-07-28)

The first full-length design arrived: **TroxRide, 1440×4816** (Figma
`20:7647`), exported to `portfolio-src/web/troxride-landing.png`. §23.5 assumed
that adding `tall` would be a data change. It was not — the artwork is far more
extreme than the aspect table anticipated, and two things had to be built.

### 24.1 0.299 is not a tile aspect

The design is **1:3.34**. §16.1 already capped `tall` near 0.6 and rejected even
Pinterest's 1:2; this is two and a half times taller than the number that was
rejected. In a moving wall:

```
0.6    380px column → 633px tall  → ~21s to cross at 30px/s
0.5    380px column → 760px tall  → ~25s        (Pinterest's cap)
0.299  380px column → 1271px tall → ~42s, and TALLER THAN THE WALL (1040px)
```

A tile that outlives the wall it travels through stops being one item among
many and becomes a column of its own, and at 42s nobody sees it leave.

**`GRID_ASPECT.tall = 0.6` is therefore a CAP, not the artwork's aspect.** The
wall shows a 0.6 crop of the top — the hero, which is what identifies a landing
page — and the whole 4816px lives in the expand. Which is precisely the split
§8/§15.3 asked for.

### 24.2 `tall` is a wall form, not a project form

`ProjectForm` is coupled to `SLOT_SIZE` in cloud-canvas-engine.ts, so widening
it would have given the SPHERE a 1:1.67 card as a side effect of a wall change.
Instead:

```ts
export type GridForm = ProjectForm | "tall";   // the wall's shapes
grid?: { form?: GridForm }                      // tall lives here and nowhere else
```

TroxRide carries `form: "portrait"` for the globe and `grid.form: "tall"` for
the wall. **The two modes disagree about its shape on purpose**, and each gets
its own top-anchored crop: the globe's from the `CROPS` map in
optimize-portfolio-images.mjs, the wall's from `TOP_ANCHORED` in
build-portfolio-presets.mjs. A centred cut on a 4816px page lands around the
testimonials and could belong to any site.

### 24.3 A latent bug this surfaced

`assignColumns` and the tile's own `aspectRatio` both read `project.form`
directly, while only the expand read `grid.form ?? form`. Harmless while the
override was unused — the moment `tall` landed, the wall would have BALANCED
that project as a 0.767 portrait and RENDERED it as a 0.6 tall, leaving the
masonry quietly unbalanced with no visible cause. All three now go through
`wallForm()` in grid-spec.ts.

### 24.4 The cap moved from the long side to the WIDTH

`build-portfolio-presets.mjs` capped the longer side. For a 1440×4816 page that
yields **418px across** — narrower than the column it has to fill.

Width is the axis the layout constrains (a 380px column, an 86vw panel) and the
axis `sizes` describes, so it is the one that decides whether a tile looks
sharp. For every non-tall tile the two rules agree exactly — none is tall enough
after cropping for height to bind — so this was a **no-op on the existing 24**
and the correct rule for what is arriving. Verified: all 24 headroom figures are
unchanged.

Output: grid `900×1500` (0.600, 58K), full `1400×4682` (0.299, 214K).

### 24.5 Fitting is the wrong rule past a point — the scrolling panel

The two-stage expand (§23) fits the true aspect into `min(86vw, 78vh × aspect)`.
At 0.299 on a 1512×982 screen that computes to a **229px-wide sliver** — a
reveal that reveals nothing.

So past a point the panel stops shrinking to fit and starts scrolling:

```
                    fitting                     scrolling
target box    min(86vw, 78vh×aspect)      min(86vw, 1040) × 78vh
chosen by     the decoded aspect          the authored wall form
```

**Keyed on `wallForm === "tall"`, not on the decoded aspect.** `tall` IS the
declaration that a project is full-length, so the answer is known at click time,
before a pixel of the full file arrives, and the panel never changes its mind
about what kind of panel it is halfway through the flight.

Measured: stage 1 `460×766` (the tile's 0.6 box) → stage 2 `1040×766`, sheet
3478px tall, scrollable.

**Continuity comes for free**, and this is why both crops are top-anchored: the
sheet is the full design at the panel's width, clipped, top-aligned. At stage 1
the panel IS the tile's 0.6 box, so the clipped sheet is pixel-for-pixel the
tile that was clicked — the two presets are the same source cut at the same
corner. Nothing cross-fades; the panel just gets bigger, then scrolls.

### 24.6 Two details that would have broken it

**`data-lenis-prevent` is load-bearing.** The page's smooth scroll is one global
Lenis instance that swallows wheel events before the browser sees them; without
the attribute the wheel over an open panel scrolls the PAGE behind it and the
design never moves. Verified against the installed Lenis (1.3.23,
`lenis.mjs:580`): it walks `event.composedPath()` for exactly this attribute and
bails out, letting the native scroll through.

**The close rewinds as it folds.** The tile shows the TOP of the design, so a
panel closed halfway down a landing page would fly home showing the
testimonials and land on a tile showing the hero — one object visibly becoming
another. `scrollTop` is tweened back to 0 over the same `FLIGHT` as the fold,
through a proxy object rather than directly (it is not a CSS property, and a
proxy avoids registering ScrollToPlugin for one tween).

Verified through a close from `scrollTop: 1400`: the box folds 1.35 → 1.25 →
0.87 → 0.64 → 0.60 while the scroll rewinds 1400 → 1195 → 500 → 67 → 1, landing
on 348×580 — the tile's exact box.

### 24.7 State after this

25 projects. Filters: all 4 columns / web 3 (11 projects) / brandings 2 (6) /
misc 2 (8). Globe canvas alive with the 25th. Drift unchanged at 30/26/34/28.

Adding the next full-length design is now genuinely a data change: drop the PNG
in `portfolio-src/`, add the registry entry with `form` + `grid.form: "tall"`,
add a `CROPS` entry so the globe crops from the top, and run both scripts.

---

## 25. D2 revised — grid is the default everywhere (2026-07-28)

**Was:** globe on desktop, grid on a phone. **Now:** grid on both; the globe is
what you opt into. The switcher is unchanged and still offers both.

```ts
const mode = chosen ?? "grid";        // was: chosen ?? (isSmallScreen ? "grid" : "globe")
```

§2's argument for the wall — *it shows the whole body of work at a glance and
asks nothing of the visitor* — was written as a mobile argument. It is not one.
A first-time visitor on any device is better served seeing 25 projects than one
spinning object showing four legibly, and the globe is the more rewarding thing
to find second. So the split by device was doing less work than it looked.

### 25.1 Two problems it removes for free

**A resize can no longer swap modes under you.** The old default read the
breakpoint on every render, so dragging a desktop window past 768px flipped a
visitor who had never touched the switcher from the globe to the wall
mid-look — tearing down a canvas and building a marquee as a side effect of a
window drag. `chosen` protected anyone who had picked; nobody else. The default
no longer reads the breakpoint at all.

**SSR and the client now agree on every device.** The old rule was strictly
worse on a phone than it looked: `useIsSmallScreen`'s server snapshot is
`false`, so a phone rendered the GLOBE on the server, hydrated, discovered it
was mobile, and swapped to the wall — mounting and immediately disposing a 2D
canvas on precisely the devices least able to afford it. Grid being the default
everywhere means the server and the client pick the same mode, always.

### 25.2 What still reads the breakpoint

`useIsSmallScreen` stays, feeding the wall's COLUMN COUNT (D3, 4 vs 2). Being
wrong for one render there re-deals the columns and rebuilds the marquee, which
is cheap and self-correcting — no canvas is involved. The hook's doc comment now
says so, because "decides the default mode" was its stated purpose and is no
longer true.

### 25.3 What this does NOT change

- The globe is not deprecated. It is one tap away and keeps its tuned preset.
- The mount contract is untouched: still mutually exclusive, still never both
  with one hidden by CSS (§5).
- The filter state is still shared across modes.
- D3's column counts, D4's per-column pause, everything from §22 onward: all
  unchanged. This is a one-line change to which branch is picked first.

---

## 26. Transitions — the entrance, the filter swap, the mode swap (2026-07-28)

Everything up to §25 built *states*. This section builds the *handovers between
them*, which had all been instant: the wall was simply there when you scrolled
to it, a filter change replaced 25 tiles with 11 between two paints, and the
mode switcher cut from a canvas to a wall in one frame. Each was correct and
each read as a glitch.

Three new pieces, and a deliberate fourth that does nothing:

| what | where | plays |
| --- | --- | --- |
| the wall's entrance | `grid/grid-reveal.tsx` | on load, and after every filter swap |
| the wall's exit | `portfolio-swap.ts` `exitWall` | before a filter commits, in grid mode |
| the mode handover | `portfolio-swap.ts` `exitMode` / `enterScene` | both directions |
| a filter change in GLOBE mode | — | nothing new; the engine already re-forms |

### 26.1 The state had to split in two

React has no "about to unmount", so there is no exit animation without holding
the state back. But holding ALL of it back means the control you just pressed
does not respond for a third of a second, which reads as a broken button. So the
section now carries two versions of the same two facts:

```
filter / mode          the CONTROLS — commit instantly, drive the pill,
                       the sliding highlight and aria-pressed
activeFilter / activeMode   the CONTENT — lag by exactly one exit animation
```

`useStagedSwap` (portfolio-swap.ts) is the whole mechanism: take a value, play an
exit, then commit. Everything in the section header renders the control pair;
everything below it renders the active pair. **Mixing the two up is the one way
to break this.** The band's own height is on the ACTIVE side for the same reason
— sizing it from the control would snap 130dvh → 100dvh under a globe that had
not arrived yet.

The commit runs in a **layout** effect, not a passive one. The opt-out path
(below) returns no animation and commits immediately, and a passive effect would
still have cost it a visible frame at the old value — the abrupt swap this
section removes, one frame later.

### 26.2 The globe opts out of the filter transition

`exit` returning `null` means "commit with no animation", and a filter change in
globe mode takes that path. The engine already has a transition for exactly this
— `setFilter` re-forms the sphere toward new targets and evaporates the tiles
that dropped out (cloud-canvas-engine.ts) — so staging on top of it would blank
the canvas *before* its own animation started, and the visitor would see less
motion than they do today, not more.

This is why the exit is a callback rather than a constant: it reads `activeMode`
at click time.

### 26.3 The targets are DOM queries, not refs

The two modes are mutually exclusive mounts with incompatible boxes (§5): the
wall is a `flex-1` block below the header, the globe is `absolute inset-0` across
the whole band. **A shared wrapper to animate would have to be one or the other
and would break whichever it was not.** So the swap queries for whichever is
mounted:

```
[data-portfolio-grid]      the wall          (portfolio-grid.tsx, already existed)
[data-portfolio-globe]     the canvas        (cloud-canvas-scene.tsx, new)
[data-portfolio-heading]   the <h2>          (portfolio.tsx, new)
```

Only one of the first two can match. One selector per swap, both layouts left
alone, and it is how every other motion component in this feature reaches its
targets.

The heading is tagged because it is NOT unmounted by a mode swap — it changes
between visible and `sr-only`, and letting it blink out under a fading wall was
the one part of the handover that still cut. Tweening it while the globe owns it
is invisible and harmless, which is simpler than conditionally tagging it.

### 26.4 The entrance moves four elements, not seventy

The obvious first idea is a per-tile stagger. It is the wrong one here: the
marquee has already cloned every group two or three times over (§17.4), so "the
tiles" is 50–70 nodes each fading on its own schedule — a lot of compositing for
a section that shares every frame with the fixed sky and the cloud canvas.

Four columns of opacity + transform is the same visual idea for a fraction of
the cost, and it is what the wall already animates in its steady state: one
number per column. The column carries the reveal's transform; the TRACK inside
it carries the marquee's. Separate elements, so they compose and neither has to
know the other is running.

**Direction is the drift's.** A column enters from the side it is travelling
FROM — a falling column drops in from above, a rising one comes up from below —
reading the same `data-drift-direction` the marquee does, so the entrance
decelerates straight into the loop. The exit leaves the other way, WITH the
drift, so the outgoing wall looks carried off on the same current the incoming
one arrives on.

### 26.5 Timings, and why the exit is the short one

```
entrance   heading 0.7s   columns 1.0s, stagger 0.09, power3.out   (grid-reveal.tsx)
wall exit  0.34s, stagger 0.035, power2.in                        (portfolio-swap.ts)
mode exit  0.32s, power2.in
globe in   0.55s, power2.out
```

An exit that lingers is dead time between a click and its answer; an entrance IS
the answer. So the exits are short, sharp and `power2.in` (accelerating away,
which reads as *pulled off* rather than *faded down*) and the entrances are long
and `power3.out`. Measured end to end, a filter swap is ~1.4s from click to
settled, with the new wall's first column already moving at ~500ms.

The globe's arrival is deliberately **one-sided**: the wall brings its own
entrance, and running a container fade under that stagger would flatten it back
into a single cross-fade. The canvas has nothing equivalent — the engine's
formation is a steady state, not an arrival — so without `enterScene` the sphere
pops in at full strength the instant the mode commits.

### 26.6 The change-of-mind path

Press "brandings", then press "web" again before the wall has finished
leaving. `next` is back to `committed`, so from React's side nothing changed and
nothing will re-render to re-arm the columns — they would sit stranded at 40%
opacity for the rest of the session. `useStagedSwap` keeps the in-flight
animation in a ref and calls `restore` on that path, which eases them back and
`clearProps` them.

The ref is deliberately NOT the effect's cleanup function. The effect re-runs
when `committed` lands, and a passive cleanup there fires AFTER the incoming
content's layout effects — it would stomp the entrance grid-reveal.tsx had just
armed.

Verified in the browser at 1512×982: change-of-mind restores to opacity 1 with
the tile count unchanged; three tab presses in 240ms land on the last one with
the right column count and no stranded inline styles.

### 26.7 The reveal is gated on visibility, with a reach

The portfolio sits ~7,500px down the page, so an entrance that fired at mount
would play to nobody. An `IntersectionObserver` holds the timeline until the wall
is on screen and then disconnects — a one-shot, not the marquee's idle gate. On a
filter swap the wall is on screen by definition (the controls are inside the
section), so it fires on the observer's first callback and the entrance is
immediate.

`rootMargin: "0px 0px 20% 0px"` reaches a fifth of a viewport down, and the
reason is the HEADING rather than the wall. `[data-portfolio-grid]` starts ~350px
below the band's top, so an un-margined observer left the heading — armed by the
same timeline — sitting on screen and blank for ~250px of scroll. Reaching
further, or watching `[data-portfolio]` instead, would run the whole entrance
below the fold and the visitor would arrive at a wall that was already there.

The heading animates on the reveal's FIRST run only. A ref survives `rebuildKey`
changes (GridReveal is not keyed, so it stays mounted across them) but not a mode
swap, which unmounts the wall — exactly the right scope. Re-fading "stuff we've
shipped" every time a tab is pressed made the header look unstable.

### 26.8 Considered and NOT built: animating the band's height

A mode swap changes the band from `130dvh` to `100dvh`, and that 295px commits in
one frame. It looks like an obvious thing to tween, and it is a trap:

- the wall is `flex-1` inside the band, so a height tween resizes it every frame,
  and grid-marquee.tsx's `ResizeObserver` answers each one with a **full
  rebuild** — re-cloning and re-measuring every column ~20 times over 0.35s.
- avoiding that means teaching the marquee to distinguish a width change (which
  invalidates every measured advance) from a height change (which only changes
  how many clones are needed), plus a way to top up clones without rebuilding.
  Real work, on the hot path, for this.

And the jump is **not visible**. The band is at least one viewport tall, and the
switcher sits ~278px below its top; for the control to be clickable at all the
band's top must be within ~280px of the fold, which puts its bottom off-screen in
every case on desktop. Nothing the visitor can see moves. (On a 390×844 phone the
margin narrows to roughly 20px at the extreme — noted, still not worth the
rebuild storm.)

### 26.9 Still not handled, deliberately

`prefers-reduced-motion`. Per CLAUDE.md's "feature first, degrade later" it joins
the list in §11 / `portfolio-grid-remaining.md` §3 — and it is now three tweens
to bail out of rather than one, all of them one-shots that can simply not play.

---

## 27. The expand, tuned — pacing, mat weight, and the white flash (2026-07-28)

Three things reported from looking at the built mode, and one defect found while
verifying them.

### 27.1 The white flash was a `sizes` mismatch

**Symptom:** open a tile and the panel shows white for a beat, then the design
appears.

§23.3's whole design is that the panel stacks TWO files: the wall's cropped tile
underneath — already downloaded, already decoded, so it paints on the first
frame — and the uncropped shot over it, fading in when it arrives. That is what
is supposed to make the flight carry a picture instead of an empty box.

The under-layer was declaring `sizes="86vw"` while the wall's tile declares
`(max-width: 768px) 45vw, (max-width: 1600px) 23vw, 380px`. **`sizes` is what
next/image resolves a srcset candidate from**, so the two elements pointed at the
same source file and requested two different URLs. The "already decoded" layer
was a cold fetch.

Measured at 1512×982, opening one tile:

| layer | complete at | transferred |
| --- | --- | --- |
| under-layer (the "free" one) | **553 ms** | 15.8 KB |
| the uncropped shot | 185 ms | 16.0 KB |

The placeholder arrived *after* the thing it was meant to be a placeholder for,
and `bg-white` — the panel's backing plate, §17's "empty lit frame" — was what
filled the gap. Now one exported constant, `GRID_TILE_SIZES` in grid-spec.ts,
used by both. Re-measured: the under-layer is `complete` on the first sampled
frame (6 ms), and the fetch is a cache hit.

It renders upscaled at panel size, which is correct and is the point: it stands
in for the moment before the real file lands, and soft beats blank.

**The rule:** two elements showing the same file must say the same `sizes`, or
they are not showing the same file.

### 27.2 The flight was fast because of the ease, not only the duration

```
FLIGHT  0.62 → 0.85        EASE_OPEN  power3.inOut → power2.inOut
MORPH   0.5  → 0.65
```

A cubic in-out spends most of its budget in a fast middle, so 0.62s on
`power3.inOut` arrives before the eye has finished following it. Lengthening
alone would not have fixed it — 0.85s still snaps through the middle on a
cubic — and softening alone would not either, because 0.62s on a quadratic is
still brisk. Both moved together.

`inOut` rather than `out` is deliberate: an out-ease starts at maximum velocity,
which reads as the tile being *flung* out of the wall rather than lifted from it.

Open, end to end, is now FLIGHT + MORPH ≈ 1.5s, against ~1.1s before.

### 27.3 The mat is a frame weight, and it was neither thin nor constant

Two separate faults under one symptom ("the glass frame is too thick, especially
on the expanded version"):

**It was twice the wall's weight when open.** The panel resolves the same
fractions against its own short edge, because it has no `cqw` source outside a
column container. An open panel's short edge is ~766px against a ~348px column,
so one shared `MAT_RATIO` drew 18.8px on the panel against 9.3px on the tile it
came from. `PANEL_MAT_RATIO = 0.0105` is a *separate* number chosen so the two
land together (~8px vs ~6.8px). `MAT_RATIO` itself also came down 0.0245 → 0.0195
— the house ratio is authored against a 261px shot on the design-shots conveyor,
and a 348–380px column made the same fraction read heavier here than the identical
recipe reads anywhere else on the page. `SHOT_MAT_RATIO` is untouched.

**It changed thickness during the flight.** The mat was applied once at the
landed size and then carried by the flight's uniform scale, so at launch
(scale ≈ 0.3–0.6) it RENDERED at a fraction of its value and thickened all the
way in — the tile left the wall wearing a thinner frame than the tile it had just
been. `applyMat` now takes the live scale and divides it back out, so the frame
holds one weight for the whole flight and that weight starts at the wall's.
Verified: constant 6.17px across scale 0.59 → 1.00, against the wall tile's
6.79px.

**The RADIUS is deliberately not compensated.** A corner belongs to the shape and
is supposed to grow with the panel; holding the open panel's ~41px corner through
a launch at tile size would round a 348px box into a pill.

### 27.4 Found while verifying: focus returned into an `aria-hidden` subtree

Pre-existing, not caused by the above. On close, focus went back to
`originRef.current` — which is usually a marquee CLONE, and clones carry
`aria-hidden="true"` and `tabIndex = -1` so a screen reader doesn't read the
portfolio three times (§17.4). Moving focus into an aria-hidden subtree is a
contradiction the browser refuses: Chrome logged *"Blocked aria-hidden on an
element because its descendant retained focus"* and the keyboard was left on the
body.

Close now resolves the ORIGINAL tile for the same project — same button, same
project, and the one copy actually in the tab order — via
`[data-grid-group]:not([data-grid-clone]) [data-tile-key=…]`, with
`preventScroll` because it may be a loop away from where the clone was.

This is the third distinct bug caused by "the origin is usually a clone" (§19.1
the click, §21 the detached origin, now the focus). Anything that treats the
origin as an ordinary element should be assumed wrong until checked.

---

## 28. The globe is desktop-only, and the expand has no caption (2026-07-28)

Two scope decisions, both narrowing what the section shows.

### 28.1 D2, final form: no globe below 768px

§25 made grid the default everywhere and left the globe one tap away on any
device. It is now **not offered at all on a phone**:

```ts
const mode = isSmallScreen ? "grid" : (chosen ?? "grid");
```

plus `max-md:hidden` on the mode-switcher group.

**This puts the breakpoint back into `mode`, which §25.1 deliberately took out** —
so the distinction matters. What §25.1 removed was the breakpoint acting as the
DEFAULT: a visitor who had chosen nothing got flipped between modes by a window
drag. What it is now is a CEILING. It can only ever move someone toward grid,
never away from it, and only because the globe is not on offer at that width.
`chosen` is kept rather than cleared, so widening past 768px hands a
desktop visitor their globe straight back — verified, including the sliding pill
landing back on the globe segment rather than sliding in from the corner.

Nothing changes on the server: `useIsSmallScreen`'s snapshot is `false`, and a
non-mobile render already resolved to `"grid"`.

### 28.2 Why the switcher is hidden in CSS and not unmounted

`max-md:hidden` is `display: none`, which takes the control out of the tab order
and out of the accessibility tree — inert, not merely invisible. Two reasons it
beats a JS-gated unmount here:

- **It applies on the first paint.** `useIsSmallScreen`'s server snapshot is
  `false`, so an unmount gated on it would render the switcher on the server and
  pull it back after hydration — a visible flash of a control on precisely the
  device that may never use it.
- **It keeps `useSlidingHighlight`'s geometry alive.** The hook's `placed` ref
  lives in `Portfolio`, which stays mounted; unmounting only the group would
  leave `placed = true` pointing at a destroyed pill, so the next desktop render
  would animate the new pill in from 0×0 in the corner instead of snapping.

Note this is NOT in tension with §5's mount contract. That rule is about the two
MODES — each a repaint source for the same visible section — never both being
mounted with one hidden by CSS. Two buttons behind `display: none` cost nothing
and repaint nothing.

### 28.3 The expand's caption is gone

The project's name used to sit under the open panel. Removed: the wall already
declines to label its tiles — a tile reads as work, a labelled tile reads as a
catalogue (§15.3) — and the expand was contradicting its own section at the one
moment the work is largest.

**Purely visual.** The dialog's `aria-label` is the project name and the shot's
`alt` is too, so a screen reader still announces which project opened. Anything
re-adding a visible caption should be a design decision, not a fix for an
accessibility gap that is not there.

One thing improved for free: the dialog is now a plain centring box rather than a
`flex-col` with a caption and an 18px gap, so the panel's centre is the
viewport's centre exactly (measured 422 vs 422 at 390×844). It used to sit
~18px high — the caption and the gap pushed it up. The close's fold-and-fly was
unaffected either way: the panel's centre is independent of its own height under
`justify-center`, which is what §23.2 relies on.

---

## 29. The second full-length design (2026-07-28)

**Emerald Psychiatry, 1440×8780** (Figma `20:334`), exported to
`portfolio-src/web/emerald-landing.png`. §24.7 predicted that the next one would
be "genuinely a data change". It was — the registry entry, a `CROPS` line and
the two scripts, with **no code touched** beyond a stale comment. §24's
machinery held at an aspect it was not sized against.

### 29.1 More extreme than the thing that forced the slot to exist

```
             aspect   vs the 0.6 slot   full page at 1400w
TroxRide     0.299    2.0× taller       1400×4682   214KB
Emerald      0.164    3.6× taller       1400×8536   560KB
```

0.164 is **1.8× longer than TroxRide** and 4.6× past the 0.767 portrait slot the
globe files it under. It changed nothing, because §24.1's decision was to treat
`GRID_ASPECT.tall = 0.6` as a **cap** rather than an aspect: the wall shows a
0.6 top crop whatever the source does, so the tile is 900×1500 for both designs
and the wall cannot be destabilised by a longer page. Only the expand's sheet
grows, and it was already a scroller.

Both crops stay top-anchored and agree, as §24.5's continuity requires — the
globe's from `CROPS` (`focus: 0`), the wall's from `TOP_ANCHORED`, which already
contained `"tall"` and so needed no new entry. A centred cut here would have
landed in the **FAQ accordion**, the least identifying band on the page. The top
2400px carries the emerald wordmark and the "Care that works, delivered with
compassion" hero.

### 29.2 The export clamps past ~4096px, and scale 1 is a trap

Asking the export service for this frame at **scale 1 returns 672×4096** — the
long side is capped and the width collapses with it, from 1440 to 672. That is
**below `GRID_MAX` (900)**, so the wall's tile would have been upscaled from a
short source and the headroom column would have read `0.75× ← source-limited`
instead of `1.18×`.

The cap is not absolute: **scale 3 returns 4320×26340 uncapped** (~31MB).
Downsampling that to 1440 wide locally is both a correct source and a sharper
one than a 1× export, being supersampled 3:1. The recipe is in
`portfolio-src/SOURCES.md`.

**This is the failure mode to watch**, because it is silent — a clamped export
is a valid PNG of the right design and the pipeline emits a tile from it without
complaint. The `--dry` headroom table is what catches it; anything reading
`← source-limited` for a freshly-added full-length page is this bug, not a
resolution limit of the artwork.

### 29.3 The `web` tab gained a fourth column

`columnCount` is `floor(total / MIN_TILES_PER_COLUMN)` clamped to [2, 4]. Web
went 11 → 12 projects, and `floor(12/3)` is exactly 4:

```
             before            after
all          26 → 4 cols       26 → 4 cols   (unchanged)
web          11 → 3 cols       12 → 4 cols   ← the density floor, working
branding      6 → 2 cols        6 → 2 cols
misc          8 → 2 cols        8 → 2 cols
```

Not a regression to tune away. §8.2's floor exists so no column is built from
fewer than 3 tiles; at 12 projects a 4th column still gives every column 3, so
the tab widens instead of the three it had growing longer.

### 29.4 Where it sits in the registry, and why

Placed after `elyv-logo` (branding) and before `tablet-mockup` (misc), which
keeps §14's web → branding → misc rotation intact. Two further constraints
decided it over the other rotation-legal slots:

- **Away from TroxRide in the `web` sequence.** The `web` filter drops every
  branding and misc entry, so registry neighbours are not what neighbour each
  other there — the other `web` entries are. Two 0.6 tiles dealt into one column
  would give it a visible seam of full-length pages.
- **Not adjacent to the four `emerald-*` branding tiles.** Same client; five
  Emerald entries in a row reads as the sphere repeating itself.

Verified by running the real `assignColumns`/`columnCount` against the real
registry rather than by eye:

```
DESKTOP  all   4 cols, spread 0.57u   talls in col2 and col3   ✓ separated
         web   4 cols, spread 0.24u   talls in col0 and col3   ✓ maximally
MOBILE   web   2 cols, spread 0.00u   one tall per column      ✓ balanced
         all   2 cols, spread 0.30u   both talls in col0       ← see below
```

The one imperfect case is mobile `all`: both full-length tiles land in column 0.
The heights still balance (0.30u apart over ~12.7u), and at 1.67u each inside a
13-tile drifting column they are nowhere near each other on screen, so this is
recorded rather than fixed. Forcing it would mean overriding the masonry for one
filter on one breakpoint — a worse trade than an even wall.

### 29.5 State after this

26 projects. Filters: all 4 columns (26) / web **4** (12) / brandings 2 (6) /
misc 2 (8). Assets: cloud 690×900 57KB, grid 900×1500 122KB, full 1400×8536
560KB. `public/portfolio/` totals grid 1.1M, full 2.0M, cloud 988K.

560KB is the largest single file in the section by 2.6×. It is fetched **only**
when that tile is expanded, never by the wall or the globe, and
`next.config.ts`'s `imageDirs` already gives `portfolio/:path*` long-lived cache
headers. Worth watching if a third full-length design lands, not worth
compressing now.

---

## 30. The third full-length design, and the ceiling (2026-07-28)

**Opus Ventures, 1440×14730** (Figma `20:2263`), exported to
`portfolio-src/web/opus-ventures.png`. A Dubai forex fund; dark, which makes it
the strongest tonal break in a wall that is otherwise mostly light artwork.

Cost: a registry entry, a `CROPS` line, two script runs. Again no code. The
interesting part of this one is not that it worked — §29 established that — it
is that it finally found where the pipeline *stops* working.

### 30.1 Three designs, one tile

```
             aspect    source        wall tile     full sheet      full KB
TroxRide     0.299     1440×4816     900×1500      1400×4682        214
Emerald      0.164     1440×8780     900×1500      1400×8536        560
Opus         0.0978    1440×14730    900×1500      1400×14321       864
```

The middle column is the whole argument. Three designs spanning a **3.1× range
of aspect** produce the *same tile*, at the same 1.18× headroom, because
`GRID_ASPECT.tall = 0.6` is a cap (§24.1). The wall cannot be destabilised by a
longer page; only the sheet grows. Nothing in the masonry, the drift or the
expand needed a number changed for any of them.

### 30.2 The ceiling, which is now close

The `full` preset is `FULL_MAX = 1400` wide, and **WebP's hard maximum dimension
is 16383**. So from a 1440-wide source:

```
max source height = 16383 × 1440/1400 = 16851px
opus-ventures     = 14730px            = 87% of it
```

Measured, not recalled: 1400×16383 encodes fine, 1400×16384 throws *"Processed
image is too large for the WebP format"*. **It fails loudly**, which is the
saving grace — a design past the ceiling cannot ship as a silently broken tile
the way a clamped export can (§29.2). But the next full-length design is
genuinely at risk, and the fix is not obvious-in-the-moment, so decide it now:

- **Lower `FULL_MAX`** for tall forms only. 1000px wide buys 23600px of height.
  Cheapest change; costs sharpness on the one form that is already scrolled
  past rather than studied.
- **Split the sheet** into stacked images inside the scroller. Keeps full
  resolution, and the panel already scrolls, so nothing about the interaction
  changes. More moving parts in `grid-expand.tsx`.
- **AVIF or JPEG for the `full` preset only.** Neither has WebP's 16383 limit.
  Changes the format matrix for one preset, which the presets script currently
  has no notion of.

Preference is the first: it is a constant, it is reversible, and the `full`
preset for a tall form is a sheet someone scrolls — the wall's tile, which is
what gets *looked* at, comes from the `grid` preset and is unaffected.

### 30.3 Placement was chosen by measurement, not by eye

Four registry positions keep §14's rotation (a `web` entry needs a non-`web`
neighbour on both sides). Running the real `assignColumns`/`columnCount` over
each of the four:

```
idx  after                    all/desk           web/desk
 2   emerald-mark             talls[0,1,2,0] ✗   talls[0,1,1,1]
 5   emerald-poster-mind      talls[0,1,1,1] ✓   talls[0,1,1,1]   spread 0.43u  ← chosen
 8   emerald-poster-help      talls[0,1,1,1] ✓   talls[0,1,1,1]   spread 0.63u
15   emerald-poster-ohio      talls[0,1,2,0] ✗   talls[1,1,1,0]
```

Two of the four rotation-legal slots stack **two full-length tiles in one
column** — the seam §29.4 was placed to avoid — and nothing about the registry
line would have hinted at which. Index 5 wins the tie on `all` balance.

Result: **one tall per column on every desktop filter.** Mobile cannot match
that — 3 talls into 2 columns means one column holds two by pigeonhole — but the
spreads stay tight (0.57u of ~13.4u on `all`), so it is even where it can be.

This is the third time the placement check has changed a decision. Treat it as
part of adding a project, not as verification of one.

### 30.4 State after this

27 projects. Filters: all 4 columns (27) / web 4 (13) / brandings 2 (6) /
misc 2 (8). `public/portfolio/` totals grid 1.2M, full 2.8M, cloud 1.0M.

The `full` directory is now 2.8M across 27 files, and three of those files are
1.6M of it. That directory is fetched **one file at a time, only on expand**,
and never by the wall or the globe — it is not page weight. Revisit only if a
future change makes the expand preload.

---

## 31. An open panel now locks the page (2026-08-01)

Reported from a screenshot: a tile opened at the portfolio, and the wheel kept
driving the document underneath, so the panel was left floating over the
plan-compare table two sections down. The panel is `aria-modal`; the page was
not behaving like it.

`data-lenis-prevent` (§24.6) was doing exactly what it was written for and
nothing more. It is an opt-OUT for the one element that IS allowed to scroll —
the full-length sheet — not a lock on everything else. Over the backdrop, or
anywhere at all on a fitted panel that has no sheet, the wheel reached the page.

### 31.1 Why not `overflow: hidden` on the body

The reflex answer, and it is the wrong one HERE specifically. Removing the
scrollbar narrows the layout by its width; the columns are a ratio of the column
width, so they re-flow; the marquee's ResizeObserver fires and rebuilds the wall.
That rebuild **destroys the clone the panel flew from**, which is the detached-
origin case §21 exists to survive — the close would fall back to a fade in place
instead of flying home. A lock that loses the tile it opened is not a lock.

### 31.2 `lenis.stop()`, plus one listener for phones

A stopped Lenis `preventDefault`s the wheel and touch events it is already
listening to (lenis.mjs:584-587) and **still honours `data-lenis-prevent` first**
(:578-583). So one call gives both halves of the behaviour with zero layout
cost: the page cannot move, and a full-length design still scrolls inside its
sheet. No scrollbar disappears, so nothing re-flows and no rebuild fires.

Touch devices have no instance to ask — `LenisProvider` skips Lenis entirely on
a coarse pointer — so a non-passive `touchmove` listener applies the same policy
there, reading the SAME attribute rather than a selector of its own. Grid is the
only mode below 768px, so this is not an edge case; it is half the traffic.

`useLenis()` is mirrored into a ref (intro.tsx's idiom) because it can return a
fresh reference across renders, and depending on it directly would tear the lock
down and rebuild it — a frame of unlocked page for nothing.

### 31.3 Left knowingly: the keyboard

Space / PageDown / arrows with focus outside the sheet still scroll the page.
Swallowing them would take the arrow keys away from a full-length design, which
has no other way to scroll — the scroller is a plain `div` and takes no focus.
This belongs with the focus trap already deferred to the lightbox variant (§10),
which is the pass where the dialog becomes a real modal.
