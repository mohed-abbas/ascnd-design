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
 * `-translate` on both axes), but the copy itself is LEFT-aligned. `w-fit`
 * shrinks the box to the widest line so the centered column reads as a tight,
 * left-ragged block; the hard `<br/>` pins the intended two lines ("look like
 * you" / "raised it.") so the ragged edge doesn't reflow by viewport width.
 */
import TaglineReveal from "./tagline-reveal";

export default function Tagline() {
  return (
    <section data-tagline className="relative min-h-dvh w-full overflow-hidden">
      {/* Pulls the headline's resting blur to crisp once the section crosses the
          70% viewport line on scroll; renders nothing. */}
      <TaglineReveal />
      <p
        data-tagline-line
        className="absolute left-1/2 top-1/2 w-max -translate-x-1/2 -translate-y-1/2 text-left font-product text-[15.27vw] font-bold leading-[0.961] tracking-[-0.03em] text-white blur-[0.43vw]"
      >
        look like you
        <br />
        raised it.
      </p>
    </section>
  );
}
