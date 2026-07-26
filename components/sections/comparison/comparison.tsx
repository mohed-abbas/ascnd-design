import AscndAura from "./ascnd-aura";
import ComparisonReveal from "./comparison-reveal";
import { CheckMark, Dash } from "./comparison-icons";
import {
  COMPARISON_COLUMNS,
  COMPARISON_ROWS,
  type ComparisonCell,
} from "./comparison-data";

/**
 * "comparisonSection" — Figma frame 420:412 (1512×982).
 *
 * A mixed-font heading + supporting line (node 469:550, frame-centred at top:85)
 * above a glass card (node 469:553, frame-centred at top:296) holding a 6×5
 * feature matrix (ascnd vs. in-house / agency / freelancer / match-me sub). The
 * two are 211px apart (85→296) and the pair sits centred in the frame; we
 * reproduce that as one viewport-centred 812×1360 block. Like the other sections
 * it renders at DESIGN SCALE (fixed px, centre-anchored) and stays TRANSPARENT
 * over the shared sky — the fixed <Background/> (fill → grain → clouds) shows
 * through, so the Figma mockup's own #62abff fill + grain are intentionally NOT
 * reproduced here.
 *
 * The matrix is a CSS grid whose column/row tracks are the exact Figma pixel
 * gaps, so the row hairlines land where the design draws them (as cell top
 * borders). The column dividers are separate overlay lines because the design
 * insets them 13.5px from the top edge (Figma Line223), which a cell border
 * can't do. The featured "ascnd" column gets a highlighted panel behind the
 * grid (node 469:554) whose edges serve as its own two dividers. Card glass
 * matches the house convention
 * (see cards/card-shell.tsx): 1.5px white/30 edge, black 10→5 gradient, and
 * the white inset veil in place of backdrop-blur (frost-swept 2026-07-18 —
 * this panel was the page's single largest frost, 1360×601 re-rastered per
 * scrolled frame over a sky-only backdrop; docs/backdrop-filter-sweep.md).
 */

// Column-divider x-positions (Figma Line223), for the three right-hand columns
// only: agency | freelancer | match-me sub left edges. The label|ascnd and
// ascnd|in-house dividers are the highlight panel's own left/right edges.
const DIVIDER_X = [713.5, 899.5, 1111.5];

function CellContent({ cell }: { cell: ComparisonCell }) {
  if (cell === "check") return <CheckMark className="h-[30px] w-[30px]" />;
  if (cell === "dash") return <Dash className="h-[24px] w-[24px]" />;
  return <span className="text-[20px] leading-normal text-white/50">{cell}</span>;
}

/** The same cell, sized for the mobile stack's option rows (right-aligned). */
function MobileCell({ cell }: { cell: ComparisonCell }) {
  if (cell === "check")
    return <CheckMark className="h-[22px] w-[22px] shrink-0" />;
  if (cell === "dash") return <Dash className="h-[18px] w-[18px] shrink-0" />;
  return <span className="text-right text-body text-white/50">{cell}</span>;
}

export default function Comparison() {
  return (
    <section
      data-comparison
      // CONTENT-DRIVEN (no min-h-dvh) + the shared section rhythm: `py-section`
      // is --gap-section (globals.css), HALF the sky between two sections, so
      // this boundary and every other one between padded sections come out the
      // same. Viewport-proportional (dvh) so the rhythm scales like the
      // full-screen tagline/cards sections it sits between, and CONSISTENT
      // regardless of content height — a fixed-viewport section made sparse
      // content float in far more air than dense content. This section used to
      // carry a hand-written py-[25dvh]; two of those met at ~490px and read as
      // a dead gap. Mobile keeps its full-height layout (max-md:min-h-dvh); the
      // token drops to 12dvh there on its own.
      className="relative flex max-md:min-h-dvh w-full items-center justify-center overflow-hidden py-section"
    >
      {/* Content block (Figma 469:646, 812×1360), flow-centred so a viewport
          shorter than the block grows the section (page scrolls) instead of
          clipping it. Header and card are pinned inside (top:0 / top:211) rather
          than flow-spaced, matching the design's explicit positions. */}
      <div className="relative h-[812px] w-[1360px] max-md:h-auto max-md:w-full max-md:flex max-md:flex-col max-md:items-center max-md:gap-[32px] max-md:px-6">
        {/* Word-by-word blur reveal on the heading (see comparison-reveal.tsx). */}
        <ComparisonReveal />
        {/* Heading + supporting copy (469:550), pinned to the top and centred. */}
        <div className="absolute left-1/2 top-0 flex w-[628px] -translate-x-1/2 flex-col items-center gap-[25px] text-center text-white max-md:static max-md:w-full max-md:translate-x-0 max-md:gap-[18px]">
          <h2
            data-comparison-head
            className="text-display leading-[1.1] tracking-[-0.03em]"
          >
            <span className="block whitespace-nowrap font-light max-md:whitespace-normal">
              hiring, agencies, or freelancers?
            </span>
            <span className="block font-instrument">none of the above.</span>
          </h2>
          <p
            data-comparison-sub
            className="w-[567px] text-body leading-normal tracking-[0.02em] max-md:w-full"
          >
            freelancers go quiet a week before launch. agencies can&rsquo;t be
            paused. hiring takes months. there&rsquo;s a fourth option.
          </p>
        </div>

        {/* Glass matrix card (469:553), pinned at top:211. NOT overflow-clip:
            the featured column spans the full card height and its rainbow glow
            must bloom past the top/bottom edges (a clip would chop it into a
            broken loop). The grid fills the card edge-to-edge with no content in
            the rounded corners, so nothing else needs clipping. */}
        <div
          data-comparison-card
          className="absolute left-0 top-[211px] h-[601px] w-[1360px] rounded-[20px] border-[1.5px] border-solid border-white/30 bg-gradient-to-b from-black/10 to-black/5 shadow-[inset_0_0_0_999px_rgba(255,255,255,0.06)] max-md:hidden"
        >
          {/* Featured-column highlight (469:554): a brighter panel behind the
              grid over the "ascnd" track, at full card height, wearing the
              siri-style rainbow aura (same effect as the CTA button's hover
              ring). The card is not clipped, so its glowing border is a
              continuous loop on all four sides. */}
          <AscndAura />

          {/* Column dividers (Figma Line223): inset 13.5px from the top edge,
              unlike the full-height ascnd highlight border. */}
          {DIVIDER_X.map((x) => (
            <div
              key={x}
              aria-hidden
              className="pointer-events-none absolute bottom-0 top-[13.5px] z-0 w-px bg-white/10"
              style={{ left: `${x}px` }}
            />
          ))}

          {/* The matrix. Tracks are the exact Figma pixel gaps so the row
              hairlines land on the design's divider positions. */}
          <div className="relative z-10 grid h-full w-full grid-cols-[302.5px_174px_237px_186px_212px_248.5px] grid-rows-[80.5px_81px_80px_88px_88px_88px_95.5px]">
            {/* Header row: empty label cell, then the column names. */}
            <div />
            {COMPARISON_COLUMNS.map((name) => (
              <div
                key={name}
                className="flex items-center justify-center"
              >
                <span className="text-[20px] font-bold leading-normal text-white">
                  {name}
                </span>
              </div>
            ))}

            {/* Data rows. */}
            {COMPARISON_ROWS.map((row) => (
              <Row key={row.label} label={row.label} cells={row.cells} />
            ))}
          </div>
        </div>

        {/* ── Mobile stack (below md) ─────────────────────────────────────
            The wide grid can't shrink to a phone (long text cells across 6
            tracks), so the matrix is rebuilt as one glass card per feature, each
            listing all five options with ascnd featured on top. The desktop card
            above is max-md:hidden; this is hidden max-md:flex. Carries
            data-comparison-card so the reveal blur-rises it too. */}
        <div
          data-comparison-card
          className="hidden w-full max-w-[520px] flex-col gap-[16px] max-md:flex"
        >
          {COMPARISON_ROWS.map((row) => (
            <div
              key={row.label}
              className="rounded-[20px] border-[1.5px] border-solid border-white/30 bg-gradient-to-b from-black/10 to-black/5 p-[20px] shadow-[inset_0_0_0_999px_rgba(255,255,255,0.06)]"
            >
              <h3 className="mb-[14px] text-body-lg font-bold leading-normal text-white">
                {row.label}
              </h3>
              <ul className="flex flex-col gap-[2px]">
                {COMPARISON_COLUMNS.map((col, i) => {
                  const featured = i === 0;
                  return (
                    <li
                      key={col}
                      className={`flex items-center justify-between gap-[16px] rounded-[10px] px-[12px] py-[9px] ${
                        featured ? "bg-white/10" : ""
                      }`}
                    >
                      <span
                        className={`text-body ${
                          featured
                            ? "font-medium text-white"
                            : "font-light text-white/60"
                        }`}
                      >
                        {col}
                      </span>
                      <MobileCell cell={row.cells[i]} />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Row({
  label,
  cells,
}: {
  label: string;
  cells: readonly ComparisonCell[];
}) {
  return (
    <>
      <div className="flex items-center border-t border-white/10 pl-[34.5px]">
        <span className="text-[20px] font-bold leading-normal text-white">
          {label}
        </span>
      </div>
      {cells.map((cell, colIndex) => (
        <div
          key={colIndex}
          className="flex items-center justify-center border-t border-white/10"
        >
          <CellContent cell={cell} />
        </div>
      ))}
    </>
  );
}
