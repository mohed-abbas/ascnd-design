/**
 * Tagline statement — Figma frame "Colors" (node 56:72, 1512×982).
 *
 * A full-viewport, soft-focus statement headline ("look like you raised it.")
 * set over the shared sky. The Figma mockup paints its own sky + clouds, but in
 * this app the sky is the global fixed <Background/> (solid fill → grain →
 * volumetric clouds) mounted in layout.tsx; this section is transparent over it,
 * so scrolling from the hero into here stays in one continuous world.
 *
 * Sizing is expressed as `vw` ratios off the 1512px design frame
 * (230.919/1512 ≈ 15.27vw, blur 6.544/1512 ≈ 0.43vw) so the headline stays
 * scale-invariant across viewports. Below md it steps up to 26vw so the three
 * mobile lines fill the narrow screen (the widest, "raised it.", spans ~97%).
 * Tracking −6.9276px and leading 0.961 come straight from the node. Weight is
 * Bold (700) — the heaviest Product Sans the project self-hosts; the design's
 * "Black" weight isn't in app/fonts.
 *
 * Layout: the text block is centered in the viewport (absolute center +
 * `-translate` on both axes), but the copy itself is LEFT-aligned. `w-max`
 * shrinks the box to the widest line so the centered column reads as a tight,
 * left-ragged block. The copy reads two lines on desktop ("look like you" /
 * "raised it.") and three on mobile ("look" / "like you" / "raised it.") via a
 * mobile-only break (see LINES); each line is a block span split into
 * per-character clip units for the scroll reveal (see tagline-reveal.tsx).
 */
import { Fragment } from "react";
import TaglineReveal from "./tagline-reveal";

// The two DESKTOP lines. `breakBefore` is a char index at which a MOBILE-ONLY
// line break is injected (and the separating space just before it collapsed), so
// desktop reads two lines — "look like you" / "raised it." — while mobile reads
// three — "look" / "like you" / "raised it." Same bold, left-aligned, vw-sized
// look; the reveal still sees exactly two [data-trise] lines, so its per-line
// blur cascade and per-character roll-up are unchanged on both viewports.
const LINES: readonly { text: string; breakBefore?: number }[] = [
  { text: "look like you", breakBefore: 5 }, // break before the "l" of "like"
  { text: "raised it." },
];

export default function Tagline() {
  // A single sequence index across both lines so the per-character roll-up
  // cascades continuously (line 2 picks up where line 1 left off).
  let si = 0;

  return (
    <section data-tagline className="relative min-h-dvh w-full overflow-hidden">
      {/* Scrubs the per-line "supersize" reveal (per-char roll-up + blur-clear +
          bright fill) as the section crosses the viewport; renders nothing. */}
      <TaglineReveal />
      <p
        data-tagline-headline
        className="absolute left-1/2 top-1/2 w-max -translate-x-1/2 -translate-y-1/2 text-left font-product text-[15.27vw] font-bold leading-[0.961] tracking-[-0.03em] max-md:text-[26vw]"
      >
        {/* Three channels off one per-line --p (globals.css): [data-trise] on the
            line sharpens (blur-clear), and each character's [data-tfill] clone is
            wiped over the dim base. On top, each [data-tchar] mover rolls up out
            of its overflow-hidden clip (GSAP, tagline-reveal.tsx). The mover
            holds BOTH the dim base and the bright fill so they roll up together;
            its padding-bottom gives descenders (the "y" in "you") room inside the
            clip, cancelled by the clip's negative margin so line spacing holds. */}
        {LINES.map(({ text, breakBefore }, li) => (
          <span key={li} data-tline className="block">
            <span data-trise className="relative block">
              {text.split("").map((ch, i) => {
                const glyph = ch === " " ? " " : ch;
                const idx = si++;
                // Collapse the space directly before a mobile break so the
                // wrapped row starts flush (no leading gap).
                const hideOnMobile =
                  breakBefore !== undefined &&
                  i === breakBefore - 1 &&
                  ch === " ";
                return (
                  <Fragment key={i}>
                    {breakBefore === i && (
                      // Mobile-only forced line break: an empty block box in the
                      // inline flow splits the row. display:none on desktop, so
                      // the desktop line is unchanged; no data hooks, so the
                      // reveal ignores it.
                      <span aria-hidden className="hidden max-md:block" />
                    )}
                    <span
                      className={`inline-block overflow-hidden align-bottom${
                        hideOnMobile ? " max-md:hidden" : ""
                      }`}
                      style={{ marginBottom: "-0.22em" }}
                    >
                      <span
                        data-tchar
                        data-si={idx}
                        className="relative inline-block will-change-transform"
                        style={{ paddingBottom: "0.22em" }}
                      >
                        <span className="text-white/25">{glyph}</span>
                        <span
                          aria-hidden
                          data-tfill
                          className="absolute inset-0 text-white"
                        >
                          {glyph}
                        </span>
                      </span>
                    </span>
                  </Fragment>
                );
              })}
            </span>
          </span>
        ))}
      </p>
    </section>
  );
}
