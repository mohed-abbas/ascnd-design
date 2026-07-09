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
 * (see cards/card-shell.tsx): 1.5px white/30 edge, black 10→5 gradient, 2px
 * backdrop-blur — a sibling of the fixed sky layers, never an ancestor, so the
 * blur is allowed (CLAUDE.md).
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

export default function Comparison() {
  return (
    <section
      data-comparison
      className="relative min-h-dvh w-full overflow-hidden"
    >
      {/* Content block (Figma 469:646, 812×1360), viewport-centred. Header and
          card are pinned (top:0 / top:211) rather than flow-spaced, matching the
          design's explicit positions. */}
      <div className="absolute left-1/2 top-1/2 h-[812px] w-[1360px] -translate-x-1/2 -translate-y-1/2">
        {/* Heading + supporting copy (469:550), pinned to the top and centred. */}
        <div className="absolute left-1/2 top-0 flex w-[628px] -translate-x-1/2 flex-col items-center gap-[25px] text-center text-white">
          <h2 className="text-[49px] leading-[1.1] tracking-[-1.47px]">
            <span className="block whitespace-nowrap font-light">
              hiring, agencies, or freelancers?
            </span>
            <span className="block font-instrument">none of the above.</span>
          </h2>
          <p className="w-[567px] text-[16px] leading-normal tracking-[0.32px]">
            freelancers go quiet a week before launch. agencies can&rsquo;t be
            paused. hiring takes months. there&rsquo;s a fourth option.
          </p>
        </div>

        {/* Glass matrix card (469:553), pinned at top:211. */}
        <div className="absolute left-0 top-[211px] h-[601px] w-[1360px] overflow-clip rounded-[20px] border-[1.5px] border-solid border-white/30 bg-gradient-to-b from-black/10 to-black/5 backdrop-blur-[2px]">
          {/* Featured-column highlight (469:554): a brighter panel behind the
              grid, spanning the "ascnd" track. Its edges double as that
              column's vertical dividers. */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-[303.5px] top-[-1.5px] z-0 h-[601px] w-[173px] rounded-[20px] border border-solid border-white/40"
            style={{
              backgroundImage:
                "linear-gradient(169.6deg, rgba(255,255,255,0.2) 1.55%, rgba(255,255,255,0.06) 97%)",
            }}
          />

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
