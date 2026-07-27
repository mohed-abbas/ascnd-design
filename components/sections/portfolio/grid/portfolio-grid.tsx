import Image from "next/image";
import { cloudProjects, type CloudFilter } from "../cloud-canvas/cloud-canvas-data";
import GridExpand from "./grid-expand";
import GridMarquee from "./grid-marquee";
import {
  assignColumns,
  columnCount,
  columnDrift,
  GRID_ASPECT,
  MAT_RATIO,
  RADIUS_RATIO,
} from "./grid-spec";

/**
 * PortfolioGrid — the work section's SECOND mode: a Pinterest-style masonry wall
 * of the same 24 projects the globe carries.
 *
 * Full decision record: docs/portfolio-grid-mode.md. The short version — this is
 * DOM + CSS, never WebGL and never a second 2D canvas (D1), because a column
 * wall animates ONE number per column (a transform the compositor owns) where
 * the globe animates every pixel of every tile. DOM also buys srcset, lazy
 * decode, alt text and crawlability, all of which the canvas structurally
 * cannot have.
 *
 * ⚠️ STEPS 1–3 OF 7 (§13). Layout, drift and hover pause are in; the drift and
 * the pause live in grid-marquee.tsx, a render-nothing sibling. Still to come:
 * mask tuning against the real thing (step 4), the Flip expand (step 5), the
 * grid image preset (step 6) and the full-length tiles (step 7). Tiles are
 * therefore NOT interactive yet: there is nothing to click until the expand
 * exists, so they are figures with alt text rather than buttons that do nothing.
 *
 * LAYOUT (D9 — masonry, not a uniform grid)
 * Every column is the same WIDTH; every tile's HEIGHT is its own authored aspect
 * (grid-spec.ts). Nothing is padded to match, so the tile seams fall on
 * different lines in every column — that misalignment IS the effect. Column
 * count adapts to the filtered set (§8.2) so a thin tab can't produce a column
 * of one image repeated forever.
 *
 * TILES (D10) — the glass-matted frame, same recipe as design-shots.tsx and as
 * the globe's in-canvas tiles: a white/10 pane with a white/40 hairline and an
 * inset sheen, wrapping the shot as an OUTER border so the shot keeps its full
 * box. The mat is sized in container-query units off the column width
 * (grid-spec.ts explains why the column, not the tile, is the base), so it
 * scales fluidly with the layout and needs no measurement in JS.
 *
 * IMAGES — public/portfolio/cloud/*.webp, the globe's own set. They are already
 * cropped to the three slot aspects and capped at 900px, which is exactly what
 * this wall wants; the dedicated grid preset (§9) only becomes worth its bytes
 * once tile sizes diverge from the globe's. Unlike the canvas, this gets real
 * `sizes` — a phone pulls phone-width sources instead of the one global 900px.
 */
export default function PortfolioGrid({
  filter,
  isMobile,
}: {
  /** The section's shared type filter — the SAME state the globe reads. */
  filter: CloudFilter;
  /** Decides the column count (D3). Owned by portfolio.tsx, not re-derived here. */
  isMobile: boolean;
}) {
  const projects =
    filter === "all"
      ? cloudProjects
      : cloudProjects.filter((p) => p.type === filter);
  const columns = assignColumns(projects, columnCount(projects.length, isMobile));

  return (
    // The wall is its OWN in-flow box BELOW the header, not a full-bleed layer
    // behind it (the globe's arrangement, which this deliberately does not
    // copy): the heading and the controls sit above the grid and the grid
    // starts under them. `flex-1 min-h-0` takes the band's remaining height —
    // min-h-0 because a flex item's default min-height:auto would let the
    // columns push this box taller than the band and defeat the overflow clip.
    //
    // That box is also what makes the mask (D7) meaningful. The fade has to
    // have content in its band to act on: masking a full-bleed layer whose
    // columns were padded down to clear the header would fade empty sky at the
    // top and tiles would simply begin, hard-edged, where the padding ended.
    // Here the wall's top IS the fade's top, so 12% of tile does the dissolve.
    //
    // Mask, never an opaque gradient overlay: the section is transparent over
    // the shared fixed sky, so a painted gradient would cover the CLOUDS
    // passing behind the wall and leave a visibly cloud-free band.
    <div
      data-portfolio-grid
      className="relative mt-[20px] min-h-0 w-full flex-1 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent_0%,#000_12%,#000_88%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,#000_12%,#000_88%,transparent_100%)]"
    >
      {/* The field. Columns are capped at the design width and CENTRED, so a
          sparse filter (fewer columns) narrows the field instead of stretching
          the tiles — the whole point of §8.2.
          items-start: a column shorter than the band must hang from the top,
          not stretch. Once step 2 clones each column to overfill the viewport
          this stops mattering, but at rest it is the difference between a wall
          and four stretched images. */}
      <div className="flex h-full w-full items-start justify-center gap-[24px] px-[24px] max-md:gap-[14px] max-md:px-[14px]">
        {columns.map((tiles, columnIndex) => {
          const drift = columnDrift(columnIndex);
          return (
          <div
            key={columnIndex}
            data-grid-column
            // Read by grid-marquee.tsx at build time. Passing the drift through
            // data attributes rather than props keeps the motion component a
            // render-nothing sibling (the house pattern — logos-marquee,
            // footer-reveal, design-shots-reveal all work this way), so the
            // markup stays declarative and the animation owns no JSX.
            data-drift-direction={drift.direction}
            data-drift-speed={drift.speed}
            // @container: the mat metrics below resolve in `cqw` against THIS
            // column, so one CSS rule gives every tile a mat proportional to the
            // column at any viewport — no ResizeObserver, no measurement.
            // max-w caps a column at the design width so 4 columns on an
            // ultra-wide don't inflate into posters.
            className="@container w-full max-w-[380px]"
            style={{
              // Consumed by every tile in this column (see below).
              ["--tile-mat" as string]: `${MAT_RATIO * 100}cqw`,
              ["--tile-radius" as string]: `${RADIUS_RATIO * 100}cqw`,
            }}
          >
            {/* TRACK — the one element the marquee translates. will-change sits
                here, on the four moving layers, and never on a tile: promoting
                every tile would multiply layer memory by the tile count to
                animate exactly the same four transforms. */}
            <div
              data-grid-track
              className="flex flex-col gap-[24px] will-change-transform max-md:gap-[14px]"
            >
              {/* GROUP — the unit the marquee clones to fill the column. Its
                  height + the track's gap IS the loop's advance, which is why
                  it wraps the tiles instead of them sitting directly on the
                  track: cloning needs one node to copy. */}
              <div
                data-grid-group
                className="flex flex-col gap-[24px] max-md:gap-[14px]"
              >
            {tiles.map((project) => (
              // A real <button>, so the wall is operable by keyboard and
              // announces itself — but the CLICK is handled by a delegated
              // native listener in grid-expand.tsx, never by an onClick here.
              // Most tiles on screen are marquee clones (cloneNode, no React
              // fiber), and React's synthetic events do not fire for those, so
              // an onClick would work on the originals and silently fail on
              // every copy. `data-tile-key` is how the listener resolves which
              // project it just got, clone or not.
              <button
                key={project.src}
                type="button"
                data-grid-tile
                data-tile-key={project.src}
                aria-haspopup="dialog"
                aria-label={`Open ${project.name}`}
                className="relative block w-full cursor-pointer"
                style={{ aspectRatio: GRID_ASPECT[project.form] }}
              >
                {/* Glass mat — an OUTER border (negative inset) so the shot
                    keeps its full box and only the ring shows as glass. Sits
                    UNDER the shot, exactly as the engine draws it. */}
                <div
                  aria-hidden
                  className="absolute border border-white/40 bg-white/10"
                  style={{
                    inset: "calc(-1 * var(--tile-mat))",
                    borderRadius: "var(--tile-radius)",
                    boxShadow:
                      "inset 0 0 var(--tile-mat) 0 rgba(255,255,255,0.28)",
                  }}
                />
                {/* The shot on top, sharing the mat's corner radius. bg-white so
                    a tile that hasn't decoded yet reads as an empty lit frame
                    rather than a hole in the sky — the DOM equivalent of the
                    engine's placeholder wash. */}
                <div
                  className="relative size-full overflow-hidden bg-white"
                  style={{ borderRadius: "var(--tile-radius)" }}
                >
                  <Image
                    src={project.src}
                    alt={project.name}
                    fill
                    // Real responsive sources — the thing the canvas could never
                    // do (FAST_MAX_SIDE is one global 900px for every device).
                    sizes="(max-width: 768px) 45vw, (max-width: 1600px) 23vw, 380px"
                    className="object-cover"
                  />
                </div>
              </button>
                ))}
              </div>
            </div>
          </div>
          );
        })}
      </div>

      {/* Drift + hover pause. Renders nothing; it reads the [data-grid-*]
          attributes above and animates the tracks (steps 2–3). Keyed on the
          wall's identity so it rebuilds when the filter or the breakpoint
          changes the columns out from under it. */}
      <GridMarquee rebuildKey={`${filter}:${columns.length}`} />

      {/* Click-to-expand (step 5). Renders nothing until a tile is opened, then
          portals a centred panel to <body>. It takes the FILTERED list because
          that is what the wall is showing — a stale key can't resolve to a
          project that isn't on screen. */}
      <GridExpand projects={projects} />
    </div>
  );
}
