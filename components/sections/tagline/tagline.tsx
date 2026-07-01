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
 * authored as explicit block spans (not a `<br/>`) so each can be its own
 * overflow-hidden mask for the scroll reveal (see tagline-reveal.tsx).
 */
import TaglineReveal from "./tagline-reveal";

export default function Tagline() {
  return (
    <section data-tagline className="relative min-h-dvh w-full overflow-hidden">
      {/* Scrubs the per-line "supersize" reveal (rise + blur-clear + bright
          fill) as the section crosses the viewport; renders nothing. */}
      <TaglineReveal />
      <p
        data-tagline-headline
        className="absolute left-1/2 top-1/2 w-max -translate-x-1/2 -translate-y-1/2 text-left font-product text-[15.27vw] font-bold leading-[0.961] tracking-[-0.03em]"
      >
        {/* Each line stays in place while [data-trise] sharpens (blur-clear) and
            a bright [data-tfill] clone is wiped over the dim base. Both channels
            are driven by one per-line --p in globals.css. */}
        {(["look like you", "raised it."] as const).map((line) => (
          <span key={line} data-tline className="block">
            <span data-trise className="relative block">
              <span className="text-white/25">{line}</span>
              <span
                aria-hidden
                data-tfill
                className="absolute inset-0 text-white"
              >
                {line}
              </span>
            </span>
          </span>
        ))}
      </p>
    </section>
  );
}
