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
 * full-bleed and its two-line wrap ("look like you" / "raised it.") is
 * scale-invariant across viewports. Tracking −6.9276px and leading 0.961 come
 * straight from the node. Weight is Bold (700) — the heaviest Product Sans the
 * project self-hosts; the design's "Black" weight isn't in app/fonts.
 */
export default function Tagline() {
  return (
    <section className="relative min-h-dvh w-full overflow-hidden">
      <p className="absolute left-1/2 top-1/2 w-[106vw] -translate-x-1/2 -translate-y-1/2 text-center font-product text-[15.27vw] font-bold leading-[0.961] tracking-[-0.03em] text-white blur-[0.43vw]">
        look like you raised it.
      </p>
    </section>
  );
}
