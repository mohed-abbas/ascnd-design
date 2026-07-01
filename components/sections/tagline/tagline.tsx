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
 * scale-invariant across viewports. Tracking −6.9276px and leading 0.961 come
 * straight from the node. Weight is Bold (700) — the heaviest Product Sans the
 * project self-hosts; the design's "Black" weight isn't in app/fonts.
 *
 * Layout: the text block is centered in the viewport (absolute center +
 * `-translate` on both axes), but the copy itself is LEFT-aligned. `w-max`
 * shrinks the box to the widest line so the centered column reads as a tight,
 * left-ragged block. The two lines ("look like you" / "raised it.") are
 * authored as explicit block spans (not a `<br/>`) and split into per-character
 * clip units for the scroll reveal (see tagline-reveal.tsx).
 */
import TaglineReveal from "./tagline-reveal";

const LINES = ["look like you", "raised it."] as const;

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
        className="absolute left-1/2 top-1/2 w-max -translate-x-1/2 -translate-y-1/2 text-left font-product text-[15.27vw] font-bold leading-[0.961] tracking-[-0.03em]"
      >
        {/* Three channels off one per-line --p (globals.css): [data-trise] on the
            line sharpens (blur-clear), and each character's [data-tfill] clone is
            wiped over the dim base. On top, each [data-tchar] mover rolls up out
            of its overflow-hidden clip (GSAP, tagline-reveal.tsx). The mover
            holds BOTH the dim base and the bright fill so they roll up together;
            its padding-bottom gives descenders (the "y" in "you") room inside the
            clip, cancelled by the clip's negative margin so line spacing holds. */}
        {LINES.map((line) => (
          <span key={line} data-tline className="block">
            <span data-trise className="relative block">
              {line.split("").map((ch, i) => {
                const glyph = ch === " " ? " " : ch;
                const idx = si++;
                return (
                  <span
                    key={i}
                    className="inline-block overflow-hidden align-bottom"
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
                );
              })}
            </span>
          </span>
        ))}
      </p>
    </section>
  );
}
