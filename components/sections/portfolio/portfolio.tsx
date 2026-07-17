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
 *
 * Header (Figma 424:487): the house 49px mixed-font display heading — "stuff
 * we've " (Product Sans Light) + "shipped" (Instrument Serif) — over the shared
 * solid <Button> ("see all work", the exact white-gradient pill from the Figma
 * frame). The header wrapper is pointer-events-none so it never blocks the
 * globe's drag; only the button re-enables hits. The globe region starts below
 * the header (see cloud-canvas-scene.tsx) so tiles orbit under the heading, and
 * any faded far tile that drifts up passes BEHIND it (header z-10) — the same
 * "content floating among the atmosphere" move as the testimonials quote.
 */
import Button from "@/components/ui/button";
import CloudCanvasScene from "./cloud-canvas-scene";

export default function Portfolio() {
  return (
    <section data-portfolio className="relative min-h-dvh w-full overflow-hidden">
      {/* Section header — Figma 424:487 (heading + see-all-work, gap 25px). */}
      <div className="pointer-events-none relative z-10 flex w-full flex-col items-center gap-[25px] pt-[10dvh] max-md:px-6">
        <h2 className="text-center text-display font-light leading-[1.1] tracking-[-0.03em] text-white [word-break:break-word]">
          stuff we&apos;ve <span className="font-instrument">shipped</span>
        </h2>
        <Button variant="solid" className="pointer-events-auto">
          see all work
        </Button>
      </div>

      <CloudCanvasScene />
    </section>
  );
}
