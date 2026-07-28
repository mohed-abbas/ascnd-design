# Portfolio grid mode — what's left

**Updated 2026-07-28.** The original version of this file was a handoff written
mid-build, listing steps 4, 6 and 7 as outstanding; all three are done, and D8's
`tall` slot landed with the first full-length design. Everything decided lives in
`docs/portfolio-grid-mode.md` (the ADR, §1–24); this file is only the short
answer to "what is still open".

---

## Status: the mode is built

**Steps 1–7 of 7 are complete**, including D8's `tall` slot. What remains is
artwork, not code.

```
components/sections/portfolio/
  portfolio.tsx            mode state, device default, switcher, exclusive mounts
  grid/
    grid-spec.ts           aspects, column count, assignment, drift, mat ratios
    portfolio-grid.tsx     the wall: columns → track → group → tiles
    grid-marquee.tsx       renders null; drift + per-column hover pause
    grid-expand.tsx        renders null until a tile opens; two-stage flight + panel
    grid-freeze.ts         the one contract between marquee and expand
scripts/build-portfolio-presets.mjs    the wall's two image presets
public/portfolio/grid/     slot-cropped tiles      (committed)
public/portfolio/full/     uncropped shots         (committed)
portfolio-src/             the originals           (GITIGNORED — local only)
```

The wall has been driven in a browser at 1512×982, 1280×800 and 390×844 — the
verification table is ADR §22.1. No layout constant needed changing.

**D2 was revised on 2026-07-28: grid is the default on every device**, not just
on a phone (§25). The globe is now the mode you opt into. One line in
`portfolio.tsx`; it also removed a resize-swaps-your-mode bug and a
canvas-mounted-then-disposed-on-hydration cost on phones.

Two decisions the ADR had left open are now closed:

- **D4 → per-column hover pause stays** (§22.2). The section is a full 100dvh, so
  a whole-wall pause would fire whenever the pointer is anywhere over it and the
  drift would effectively never be seen.
- **Navbar z-order → leave it** (§22.3). Nothing that paints actually overlaps
  the panel; the earlier report was the nav's transparent bounding box.

---

## 1. Still open: more full-length artwork (D8 is otherwise DONE)

The `tall` slot is **built and shipped** (ADR §24). The first full-length design
— TroxRide, 1440×4816 — is in the wall as a 0.6 top crop and opens into a
scrolling panel showing all 4816px.

Adding the next one is now genuinely a data change:

1. Drop the export into `portfolio-src/web/<slug>.png`.
2. Add the registry entry in `cloud-canvas-data.ts` with a normal `form` for the
   globe **and** `grid.form: "tall"` for the wall. The two modes are supposed to
   disagree — see `GridForm` for why the sphere must not learn about `tall`.
3. Add a `CROPS` entry in `optimize-portfolio-images.mjs` with `focus: 0`, so
   the GLOBE crops from the top too; copy the PNG into `public/portfolio/cloud/`
   and run `npm run optimize:portfolio`.
4. Run `npm run presets:portfolio`. The wall's two presets pick up the tall form
   automatically — the script reads it out of the registry and top-anchors it.

Still unimplemented, still reserved: **`grid.span: 2`**. The first span-2 tile
also buys a second `sizes` value per breakpoint (§8.1).

## 2. Recommended next: a readable expand on mobile for WIDE shots

Not a defect in what was built — a limit found by looking at it (§22.4).

For a landscape shot the expanded panel is **335×213 on a 390px phone**, barely
1.9× the tile, and a dense UI screenshot is not legible at that size. Mobile is
where grid is the DEFAULT — as it now is everywhere (D2, §25) — so this is the
mode's weakest moment.

Note this is now the WIDE case only — full-length designs are already handled,
since the scrolling panel (§24.5) serves them on any viewport. What is left is
that a 16:9 desktop screenshot cannot be made legible on a 390px portrait screen
by scaling alone: the envelope is already width-bound, and 86vw → 94vw buys 9%.
The real answer is **pinch-zoom or a double-tap zoom** — a feature, deliberately
not built unasked.

The `public/portfolio/full/` preset (uncropped, width-capped) is already the
right source for it.

---

## 3. Deferred degradation (after approval, per `CLAUDE.md`)

Explicitly not done, by the "feature first, degrade later" policy. All of it is
in `grid-marquee.tsx` except where noted:

- **`prefers-reduced-motion`** → build the wall, skip the tweens entirely. Mask
  and expand stay. `logos-marquee.tsx` shows the house shape for the bail-out.
- **No-JS / pre-hydration resting state** — the wall is server-rendered and only
  the drift is JS, so this is mostly confirming it reads as deliberate.
- **Tier knobs** — `lib/perf/tiers.ts` has the registry row and reads NO knob,
  with the reasoning written out. Revisit only if the wall gets heavier.
- **A focus trap on the expand.** It is `aria-modal` but tab still reaches the
  controls behind. A real trap belongs with the deferred lightbox variant
  (§10), which is when this becomes a true modal.

---

## 4. Things a future session must NOT re-derive

Each of these cost something to find. They are in the code comments too, but
collected here so they are not rediscovered the hard way.

1. **Tile clicks CANNOT use React `onClick`.** The marquee clones tiles with
   `cloneNode`, so most tiles on screen have no React fiber and synthetic events
   never fire for them. Anything per-tile goes through the delegated native
   listener in `grid-expand.tsx`. (§19.1)
2. **The expand's origin element can be detached by close time** — clones are
   destroyed on every marquee rebuild, which a resize triggers. Guarded with
   `isConnected`. (§21)
3. **The freeze flag is module-scoped on purpose** (`grid-freeze.ts`) so it
   survives a marquee rebuild — which means only `GridExpand` can thaw it, and
   it must do so on unmount or the wall stays frozen forever.
4. **The expand's flight must stay a UNIFORM scale**, which is why the panel
   opens at the tile's aspect and only morphs after landing. Flying straight to
   a different shape needs per-axis scaling and squashes the shot. (§19.2, §23.1)
5. **The close folds and flies at once**, and that is only safe because the panel
   is flex-centred: folding it does not move its centre, so the centre-to-centre
   translation is unaffected. (§23.2)
6. **The mask needs content in its fade band.** Padding the columns below the
   header inside a full-bleed masked layer fades empty sky. The wall is its own
   box below the header for this reason. (§17.2)
7. **A falling column starts at `y = -advance`, not 0**, or it drags empty space
   in behind its first tile.
8. **Never pad a column to match another's height.** Unequal heights at a
   constant px/sec are what desync the columns. (§8.1)
9. **`will-change: transform` belongs on the 4 tracks, never on tiles.**
10. **The wall dims by RECEDING (opacity), never by a dark scrim** — this site's
    depth cue goes toward the sky. Same rule the cloud engine follows.
11. **`portfolio-src/` is GITIGNORED, not missing.** A previous session read
    `git ls-files` and recorded the originals as lost; they were on disk the
    whole time. For an ignored path, git history is evidence about the repo, not
    about the filesystem. (§20)
12. **Do NOT re-tune `MAX_SIDE`** in `optimize-portfolio-images.mjs` — it is
    hand-coupled to the engine's `FAST_MAX_SIDE` and raising it bills every
    globe visitor. The wall has its own presets precisely so it never has to.
13. **`data-lenis-prevent` on the scrolling panel is load-bearing.** One global
    Lenis instance swallows wheel events; without it the wheel over an open
    full-length design scrolls the PAGE behind the panel. (§24.6)
14. **Every tile-aspect read goes through `wallForm()`.** Reading `project.form`
    directly ignores the `grid.form` override, which silently balanced the
    masonry against one shape while rendering another. (§24.3)
15. **The preset cap is on WIDTH, not the longer side.** Width is what the
    layout constrains and what `sizes` describes; a long-side cap turns a
    1440×4816 page into a 418px-wide file. (§24.4)

---

## 5. Regenerating the images

```bash
npm run presets:portfolio          # writes public/portfolio/{grid,full}
npm run presets:portfolio -- --dry # report + resolution table, touch nothing
```

Requires `portfolio-src/` (gitignored, local-only). If it is missing, re-pull
from Figma — file key `AlJwKmp1F8MmaViAh75vuu`, every node ID and export scale
is in `portfolio-src/SOURCES.md`. The script errors loudly on a missing original
or a slug the registry does not mention; it never silently skips a tile.

The dry run prints the per-tile resolution headroom against the 760px raster a
380px column needs at 2× DPR, which is the number §18.2 and §20 are arguing over.

---

## 6. Housekeeping

- `cursor-trail-main/` and `public/portfolio/cloud-backup/` are untracked and
  gitignored. **The files are still on disk and are yours to delete** — nothing
  references either.
- `main` is production. `dev` carries the `/lab/*` sandboxes; merging `dev` into
  `main` drags them back (see CLAUDE.md).
- Commit messages on this branch carry no AI attribution, per CLAUDE.md.
