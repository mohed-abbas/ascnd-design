/**
 * "looking cheap costs more." — Figma frame 792:438 (text node 677:2528).
 *
 * A second full-viewport supersize statement, IDENTICAL in format and animation
 * to the hero tagline (components/sections/tagline) — only the copy and line
 * count differ. Same 230.919px glyphs (15.27vw off the 1512 frame), −6.9276px
 * tracking (−0.03em), 0.961 leading, 0.43vw resting blur, Product Sans Bold (the
 * heaviest weight the app self-hosts; the design's "Black" isn't in app/fonts).
 * Renders transparent over the shared fixed <Background/>, like every section.
 *
 * The copy reads THREE lines on desktop — "looking" / "cheap costs" / "more." —
 * exactly as the Figma wraps it. Below md a mobile-only break inside "cheap
 * costs" splits it to four — "looking" / "cheap" / "costs" / "more." — so the
 * widest line ("looking") fills the narrow screen at 26vw without overflowing
 * (mirrors the tagline's desktop-2 / mobile-3 treatment).
 *
 * The reveal is the tagline's driver reused VERBATIM (scoped to [data-costs] via
 * its `section` prop): the per-line blur-clear + bright fill-wipe and the
 * per-character roll-up, cascading line to line. See tagline-reveal.tsx and the
 * [data-trise]/[data-tfill] CSS channels in globals.css (both generic hooks, so
 * this section styles for free).
 */
import { Fragment } from "react";
import TaglineReveal from "@/components/sections/tagline/tagline-reveal";

// Desktop lines (as the Figma wraps them). `breakBefore` is a char index at
// which a MOBILE-ONLY line break is injected (and the space just before it
// collapsed): desktop reads "cheap costs" as one line, mobile splits it to
// "cheap" / "costs". The reveal still sees exactly three [data-trise] lines, so
// its per-line cascade and per-character roll-up are unchanged on both viewports.
const LINES: readonly { text: string; breakBefore?: number }[] = [
  { text: "looking" },
  { text: "cheap costs", breakBefore: 6 }, // break before the "c" of "costs"
  { text: "more." },
];

export default function Costs() {
  // A single sequence index across every line so the per-character roll-up
  // cascades continuously (each line picks up where the last left off).
  let si = 0;

  return (
    <section data-costs className="relative min-h-dvh max-md:min-h-svh w-full overflow-hidden">
      {/* The tagline's supersize reveal, scoped to this section. Renders nothing. */}
      <TaglineReveal section="[data-costs]" />
      <p
        data-costs-headline
        className="absolute left-1/2 top-1/2 w-max -translate-x-1/2 -translate-y-1/2 text-left font-product text-[15.27vw] font-bold leading-[0.961] tracking-[-0.03em] max-md:text-[26vw]"
      >
        {/* Three channels off one per-line --p (globals.css): [data-trise] on the
            line sharpens (blur-clear), and each character's [data-tfill] clone is
            wiped over the dim base. On top, each [data-tchar] mover rolls up out
            of its overflow-hidden clip (GSAP, tagline-reveal.tsx). The mover holds
            BOTH the dim base and the bright fill so they roll up together; its
            padding-bottom gives descenders room inside the clip, cancelled by the
            clip's negative margin so line spacing holds. */}
        {LINES.map(({ text, breakBefore }, li) => (
          <span key={li} data-tline className="block">
            <span data-trise className="relative block">
              {text.split("").map((ch, i) => {
                // A word-space must be a NON-BREAKING space: each char sits in its
                // own `inline-block overflow-hidden` roll-up clip, and a lone ASCII
                // space is leading+trailing whitespace inside that box, so it
                // collapses to zero width and the words run together. A non-breaking
                // space keeps its intrinsic width.
                const glyph = ch === " " ? " " : ch;
                const idx = si++;
                // Collapse the space directly before a mobile break so the wrapped
                // row starts flush (no leading gap).
                const hideOnMobile =
                  breakBefore !== undefined &&
                  i === breakBefore - 1 &&
                  ch === " ";
                return (
                  <Fragment key={i}>
                    {breakBefore === i && (
                      // Mobile-only forced line break: an empty block box in the
                      // inline flow splits the row. display:none on desktop, so the
                      // desktop line is unchanged; no data hooks, so the reveal
                      // ignores it.
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
