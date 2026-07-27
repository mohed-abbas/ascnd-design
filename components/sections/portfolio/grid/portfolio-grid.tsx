import Image from "next/image";
import { cloudProjects, type CloudFilter } from "../cloud-canvas/cloud-canvas-data";
import {
  assignColumns,
  columnCount,
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
 * ⚠️ PASS 1 OF 7 (§13). This renders the wall at REST — correct layout, correct
 * tiles, no motion. The infinite opposite-direction drift (step 2), hover pause
 * (step 3), edge mask tuning (step 4) and Flip expand (step 5) land on top of
 * this, in that order. Tiles are therefore NOT interactive yet: there is nothing
 * to click until the expand exists, so they are figures with alt text rather
 * than buttons that do nothing.
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
    // The mask (D7) is the section's top/bottom fade. It has to be a mask and
    // not an opaque gradient overlay: this section is transparent over the
    // shared fixed sky, so a painted gradient would cover the CLOUDS passing
    // behind the wall and leave a visibly cloud-free band.
    //
    // The wall is FULL-BLEED behind the header, not padded below it — the same
    // arrangement as the globe canvas, and the mask is why. Start the columns
    // below the controls instead and the first 12% of the mask has no content
    // to fade: tiles would simply begin, hard-edged, wherever the padding ended.
    // Running the wall to the top of the band gives the fade something to act
    // on and lets tiles rise into the header exactly as the globe's do.
    //
    // The top stop is 22%, not the spec's 12%: it has to clear the floating
    // header (10dvh + heading + pill row), or tiles pass behind the heading at
    // ~83% opacity and eat its legibility — the problem the engine solves for
    // its own core label with a text shadow. Step 4 tunes both stops against
    // the real thing; this is the starting guess, and it is a guess.
    <div
      data-portfolio-grid
      className="absolute inset-0 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent_0%,#000_22%,#000_88%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,#000_22%,#000_88%,transparent_100%)]"
    >
      {/* The field. Columns are capped at the design width and CENTRED, so a
          sparse filter (fewer columns) narrows the field instead of stretching
          the tiles — the whole point of §8.2.
          items-start: a column shorter than the band must hang from the top,
          not stretch. Once step 2 clones each column to overfill the viewport
          this stops mattering, but at rest it is the difference between a wall
          and four stretched images. */}
      <div className="flex h-full w-full items-start justify-center gap-[24px] px-[24px] max-md:gap-[14px] max-md:px-[14px]">
        {columns.map((tiles, columnIndex) => (
          <div
            key={columnIndex}
            data-grid-column
            // @container: the mat metrics below resolve in `cqw` against THIS
            // column, so one CSS rule gives every tile a mat proportional to the
            // column at any viewport — no ResizeObserver, no measurement.
            // max-w caps a column at the design width so 4 columns on an
            // ultra-wide don't inflate into posters.
            className="@container flex w-full max-w-[380px] flex-col gap-[24px] max-md:gap-[14px]"
            style={{
              // Consumed by every tile in this column (see below).
              ["--tile-mat" as string]: `${MAT_RATIO * 100}cqw`,
              ["--tile-radius" as string]: `${RADIUS_RATIO * 100}cqw`,
            }}
          >
            {tiles.map((project) => (
              <figure
                key={project.src}
                className="relative w-full"
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
              </figure>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
