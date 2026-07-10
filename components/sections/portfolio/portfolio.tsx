/**
 * Portfolio section — 1:1 port of the Codrops "Atmospheric Depth Gallery".
 *
 * A depth-scroll WebGL experience: the camera flies through depth-stacked image
 * planes, each plane defining its own mood-morphing GLSL background, with pointer
 * parallax, velocity-reactive "breath", a glowing particle trail, and color-spec
 * label cards. Ported ~verbatim from `codrops-depth-gallery-main/` (imperative
 * Three.js); the original's private rAF loop and mouse-wheel hijack are replaced
 * by the shared gsap.ticker and a pinned + scroll-scrubbed ScrollTrigger so it
 * lives as a normal section inside the Lenis page.
 *
 * Like the site's other sections, this one is now TRANSPARENT over the global
 * sky: the depth gallery's own mood-background shader pass is disabled (see
 * portfolio-engine.ts `tick()`) and the WebGL canvas is `alpha: true`, so the
 * image planes / trail / particles float over the principal site's sky + cloud
 * background instead of a self-contained opaque world.
 *
 * Slots ABOVE pricing on the home page. The pin lives here, so page.tsx wraps this
 * section in a `shrink-0` block (see the note there).
 *
 * NOTE — no CSS background and z-index left at `auto` (below the site's front
 * cloud layer at `z-[61]`) ON PURPOSE, so the sky/cloud atmosphere reads through.
 */
import PortfolioScene from "./portfolio-scene";

export default function Portfolio() {
  return (
    <section data-portfolio className="relative min-h-dvh w-full overflow-hidden">
      <PortfolioScene />
    </section>
  );
}
