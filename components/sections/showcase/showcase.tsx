import ShowcaseReveal from "./showcase-reveal";
import ShowcaseScene from "./showcase-scene";

/**
 * "stuff we've shipped" — the project-showcase wheel (Figma node 435:515).
 * See docs/portfolio-showcase-research.md for the full architecture.
 *
 * This server component is just the section shell over the shared sky. The
 * composed content lives in <ShowcaseScene> (client): the fanned cards + the
 * heading/CTA, plus — on capable devices — a WebGL wheel that takes over the
 * card images (the DOM arc is the SSR / no-JS / reduced-motion / mobile
 * fallback). The HEADING keeps its per-word blur-rise reveal on scroll
 * (showcase-reveal.tsx), matching the why-stay heading.
 *
 * PHASE 1 (WebGL scaffold) ships the STATIC fan in WebGL. Scroll rotation, the
 * cloth warp, and the fly-in reveal arrive in the later phases.
 */
export default function Showcase() {
  return (
    <section
      data-showcase
      className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden"
    >
      {/* Heading per-word blur-rise reveal on scroll; renders nothing. */}
      <ShowcaseReveal />
      <ShowcaseScene />
    </section>
  );
}
