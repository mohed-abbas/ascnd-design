/**
 * Portfolio section — the cloud-canvas image globe.
 *
 * A 2D-canvas image globe (Fibonacci sphere, hand-rolled 3D projection, no
 * WebGL) of the project stills: it auto-spins, drags to rotate, and click-
 * focuses a tile. Unlike a scroll narrative it does NOT pin or scroll-scrub —
 * it's an explorable object that floats over the shared sky/cloud atmosphere.
 *
 * Ported standalone from the lab/portfolio-V2 variant selector (which also
 * carried the depth-gallery / carousel / cloudline designs); only the globe
 * came across. Tune presets live in the /lab/cloud-canvas sandbox; the locked
 * portfolio preset (CLOUD_CANVAS_PORTFOLIO_CONFIG) is applied by CloudCanvasScene.
 *
 * Slots between Testimonials and Pricing. Stays TRANSPARENT with z-index at
 * `auto` (below the site's front cloud layer) ON PURPOSE, so the sky/cloud
 * atmosphere reads through the globe.
 */
import CloudCanvasScene from "./cloud-canvas-scene";

export default function Portfolio() {
  return (
    <section data-portfolio className="relative min-h-dvh w-full overflow-hidden">
      <CloudCanvasScene />
    </section>
  );
}
