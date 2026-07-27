# Portfolio grid mode — what's left, and how to do it

**Written 2026-07-27 as a handoff.** Everything decided lives in
`docs/portfolio-grid-mode.md` (the ADR, §1–21). This file is the *continuation*:
where the work stands, what remains, and enough detail to pick it up on another
machine without re-deriving anything.

Read the ADR first if you're new to this. If you're resuming, this file is
enough.

---

## 0. Getting the work

Everything is pushed. Nothing lives only on the machine it was written on.

```bash
git fetch origin
git checkout feat/portfolio-grid-mode      # tracks origin/feat/portfolio-grid-mode
npm install                                 # if the machine is cold
npm run dev                                 # http://localhost:3000 — YOUR call to run
```

Branches in play:

| branch | contents | state |
|---|---|---|
| `feat/portfolio-grid-mode` | the ADR **and** the implementation | current work — branch off THIS |
| `docs/portfolio-grid-mode` | the ADR alone, at the point before code | superseded; the feature branch contains it |
| `feat/footer-nav-roll-hover` | unrelated footer hover | independent, mergeable any time |

`feat/portfolio-grid-mode` is cut from `docs/portfolio-grid-mode`, which is cut
from `main`. Merging the feature branch brings the doc with it, so the docs PR
does not need to land first.

**Verification available to a machine:** `npm run lint` and `npm run build` only.
There is no test runner in this project and no browser automation in the loop —
which is exactly why everything below that needs an eye is marked as needing one.

---

## 1. Where it stands

**Built: steps 1, 2, 3, 5 of 7.** None of it has been seen in a browser.

```
components/sections/portfolio/
  portfolio.tsx            ← mode state, device default, switcher, exclusive mounts
  grid/
    grid-spec.ts           ← aspects, column count, assignment, drift, mat ratios
    portfolio-grid.tsx     ← the wall: columns → track → group → tiles
    grid-marquee.tsx       ← renders null; drift + hover pause
    grid-expand.tsx        ← renders null until a tile opens; the flight + panel
    grid-freeze.ts         ← the one contract between marquee and expand
lib/perf/tiers.ts          ← consumer-registry row for the marquee
components/sections/portfolio/cloud-canvas/cloud-canvas-data.ts
                           ← optional `grid?` override block (unused, deliberate)
```

Commits on the branch, oldest first: `ef41d66` `92088cd` `fdbfef3` `c9d95e8`
`ffa83b7` (the record) → `504ffc1` (wall) → `5a16a48` `05da309` (layout fix) →
`8338de4` (drift + pause) → `337e526` (corrections) → `b9dfd01` (expand) →
`60197b8` (three defect fixes).

---

## 2. THE GATE: a browser pass (this is step 4, and it needs a human)

Nothing else should be built before this. There are now three stacked motions —
drift, hover pause, flight — none of which has rendered anywhere. Building step
6 or 7 on top would be stacking more unverified work on unverified work.

### 2.1 What to look at, in order

1. **Does the wall look like masonry?** Column seams must fall on different
   lines. If they line up, the aspect assignment is wrong (`grid-spec.ts`
   `assignColumns`).
2. **The mask stops** — currently `transparent 0% → #000 12% → #000 88% →
   transparent 100%` in `portfolio-grid.tsx`. Judge the top and bottom fades
   independently; they do not have to be symmetric.
3. **Gutters and mat weight** — `gap-[24px]` (desktop) / `gap-[14px]` (mobile)
   on both the track and the group, which must stay equal to each other or the
   loop seam gains a gap. Mat weight is `MAT_RATIO = 0.0245` of the column width.
4. **Drift pace** — `DRIFT_SPEED = 30` px/sec, variance `[1, .87, 1.12, .94]`.
   Is 30 browsing pace or fidgeting? Is the variance enough that the wall never
   resolves into a pattern?
5. **Hover pause (D4)** — ⚠️ **the open question.** It is built as *per-column*:
   hovering column 3 stops column 3 only. The original brief said "hovering the
   section stops the animation" (whole wall). See ADR §3.1. Decide by looking.
   Changing it is a few lines in `grid-marquee.tsx`: make `slow`/`resume` walk
   every tween instead of the closed-over one — the same shape the freeze
   listener already uses.
6. **The expand** — click a tile mid-drift. Does it fly from where it actually
   is? Does it fly *home* correctly (the columns ease to a stop over 0.4s, so
   the origin keeps moving after the flight starts)? Escape and click-out.
7. **The navbar sits ON TOP of the expanded panel** (`z-[999]` vs the panel's
   `z-[120]`). Deliberate for now — the nav stays reachable. Decide whether the
   panel should win.
8. **Mobile** — the grid is the DEFAULT there (D2). Two columns, no hover, tap
   to expand. Check the header (heading + two stacked pill groups) doesn't eat
   the viewport before the wall starts.
9. **Filter × mode** — switch tabs in grid mode. Columns re-deal, the marquee
   rebuilds. `brandings` (6 projects) should drop to 2 columns, NOT shrink the
   tiles (ADR §8.2).

### 2.2 What "done" looks like for step 4

Mask stops, gutters, mat weight and drift speed all settled by eye, plus a
decision on D4 and on the navbar z-order. Everything is a constant in
`grid-spec.ts` or a class in `portfolio-grid.tsx`; none of it is structural.

---

## 3. Step 6 — the grid image preset (BLOCKED, and should wait anyway)

Full reasoning in ADR §20. Short version:

**Blocked:** the value is cropping to the wall's aspect *before* the 900px cap,
which restores the 8 of 24 tiles that under-resolve a 380px column at 2× DPR
(worst `phone-mockup-fitness`, 0.68×). That needs the uncropped originals.
`portfolio-src/` kept only `SOURCES.md` — the PNGs were never committed. They
can be re-pulled from Figma: file key `AlJwKmp1F8MmaViAh75vuu`, every node ID
and export scale is in that manifest.

**Should wait regardless:** the preset is cut against the wall's aspects at the
wall's sizes, and step 4 is about to change the column width, while D8/D11's
`tall` form changes the aspect table outright.

**When it does happen:**

1. Re-pull the 24 frames into `portfolio-src/` (gitignored — pixels stay local).
2. Extend `scripts/optimize-portfolio-images.mjs` with a grid preset: crop to
   the WALL aspect first, then cap the long side at 900, output WebP to
   `public/portfolio/grid/`. Do **not** re-tune `MAX_SIDE` — it is hand-coupled
   to `FAST_MAX_SIDE` in the engine and raising it bills every globe visitor.
3. Point tiles at the new sources via the `grid.src` field already on
   `CloudProject`. Nothing else changes: `portfolio-grid.tsx` and
   `grid-expand.tsx` both already read `project.grid?.src ?? project.src`.
4. `/portfolio` is already in `imageDirs` in `next.config.ts`, so the new
   subdirectory inherits the immutable cache headers. No config change.
5. Keep Next's optimizer — do NOT add `unoptimized`. Measured in ADR §18.1.

---

## 4. Step 7 — full-length designs (D8, last)

Blocked on step 6 *and* on artwork that does not exist yet. When both land:

- Add `tall` (~0.55–0.6 aspect) to `GRID_ASPECT` and to `ProjectForm`.
  **Cap near 0.6, not Pinterest's 1:2** — ADR §16.1: height multiplied by motion
  is a cost a static wall never pays. A 1:2 tile at a 380px column is 760px tall
  and owns its column for roughly half a minute at 30px/s.
- `grid.span: 2` is reserved on `CloudProject` but nothing implements it. The
  first span-2 tile also buys a second `sizes` value per breakpoint — today
  every tile being span 1 is what keeps that to one (ADR §8.1).
- **The long-form shot belongs in the EXPAND, not the wall** (ADR §8/§15.3): the
  wall shows the crop, clicking reveals the full screenshot. That folds this
  into the panel that already exists rather than being a second feature.

---

## 5. Deferred degradation (after the feature is approved, per CLAUDE.md)

Explicitly not done, by policy — "feature first, degrade later". All of it is in
`grid-marquee.tsx` except where noted:

- **`prefers-reduced-motion`** → build the wall, skip the tweens entirely. The
  mask and the expand stay. `logos-marquee.tsx` shows the house shape for the
  bail-out.
- **No-JS / pre-hydration resting state** — the wall renders statically today
  (the markup is server-rendered; only the drift is JS), so this is mostly a
  matter of confirming it looks deliberate rather than truncated.
- **Tier knobs** — `lib/perf/tiers.ts` has the registry row and it currently
  reads NO knob, with the reasoning written out. If step 4 makes the wall
  heavier (more columns, taller tracks), revisit.
- **A focus trap on the expand.** It is `aria-modal` but tab can still reach the
  controls behind it. A real trap belongs with the deferred lightbox variant
  (ADR §10), which is when this becomes a true modal.

---

## 6. Things a future session must NOT re-derive

Each of these cost something to find. They are in the code comments too, but
collected here so they are not rediscovered the hard way.

1. **Tile clicks CANNOT use React `onClick`.** The marquee clones tiles with
   `cloneNode`, so most tiles on screen have no React fiber and synthetic events
   never fire for them. Anything per-tile (hover labels, links) must go through
   the delegated native listener in `grid-expand.tsx`. (ADR §19.1)
2. **The expand's origin element can be detached by close time** — clones are
   destroyed on every marquee rebuild, which a resize triggers. Guarded with
   `isConnected`. (ADR §21)
3. **The freeze flag is module-scoped on purpose** (`grid-freeze.ts`) so it
   survives a marquee rebuild — which means only `GridExpand` can thaw it, and
   it must do so on unmount or the wall stays frozen forever.
4. **The mask needs content in its fade band.** Padding the columns below the
   header inside a full-bleed masked layer fades empty sky and the tiles begin
   hard-edged. The wall is its own box below the header for this reason.
   (ADR §17.2)
5. **A falling column starts at `y = -advance`, not 0**, or it drags empty space
   in behind its first tile.
6. **Never pad a column to match another's height.** Unequal heights at a
   constant px/sec are what desync the columns. (ADR §8.1)
7. **`will-change: transform` belongs on the 4 tracks, never on tiles.**
8. **The wall dims by RECEDING (opacity), never by a dark scrim** — this site's
   depth cue goes toward the sky. Same rule the cloud engine follows.
9. **Source images are NOT pre-cropped to the slot aspects.** The aspect is a
   crop *instruction*; `object-cover` does the cut, mirroring the engine's
   `drawImageCover`. (ADR §18.2, and a comment in `grid-spec.ts` that was wrong
   about this once already)

---

## 7. Housekeeping carried by this branch

- `cursor-trail-main/` and `public/portfolio/cloud-backup/` were swept into
  `504ffc1` by a `git add -A`, and a first attempt to untrack them **undid
  itself** (the `git rm --cached` was followed by another `add -A` in the same
  command). Now untracked *and* gitignored so it cannot recur. **The files are
  still on disk and are yours to delete** — nothing references either.
- `main` is production. `dev` carries the `/lab/*` sandboxes; merging `dev` into
  `main` drags them back (see CLAUDE.md). Unrelated to this work, but worth
  knowing before any merge.
- Commit messages on this branch carry no AI attribution, per CLAUDE.md.
