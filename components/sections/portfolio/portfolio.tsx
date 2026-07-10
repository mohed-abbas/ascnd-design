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
 * Unlike the site's other sections (transparent over the global sky), this one is
 * intentionally OPAQUE — the depth gallery draws its own mood background, which is
 * core to the effect and fully covers the sky/clouds while pinned.
 *
 * Slots ABOVE pricing on the home page. The pin lives here, so page.tsx wraps this
 * section in a `shrink-0` block (see the note there).
 *
 * The `bg-[#fffaf0]` is a first-paint fallback matching the first plane's mood
 * background, so there's no flash before the WebGL canvas takes over.
 */
import PortfolioScene from "./portfolio-scene";

export default function Portfolio() {
  return (
    <section
      data-portfolio
      className="relative min-h-dvh w-full overflow-hidden bg-[#fffaf0]"
    >
      <PortfolioScene />
    </section>
  );
}
