import DesignShots from "./design-shots";
import HeroText from "./hero-text";
import Logos from "./logos";
import Navbar from "./navbar";
import Rock from "./rock";
import Wordmark from "./wordmark";

/**
 * Hero section — built component by component to match the Figma "Hero base"
 * frame (103:4, 1512×982). The sky (solid fill + grain + volumetric clouds)
 * is the global fixed <Background/> mounted in layout.tsx; the hero is
 * transparent over it.
 */
export default function Hero() {
  return (
    <section className="relative min-h-dvh w-full overflow-hidden">
      <Navbar />

      {/* Rocks (nodes 103:19 / 103:18): cliffs pinned to the hero's bottom
          edges, framing the content. */}
      <Rock side="left" />
      <Rock side="right" />

      {/* ascnd wordmark (node 77:174): top-center brand mark, glyph top ~55px
          of the 982-tall hero, ~36px Product Sans Medium. Sits above the
          collage on plain sky. */}
      <div className="absolute left-1/2 top-[40px] z-10 -translate-x-1/2 text-[38px]">
        <Wordmark />
      </div>

      {/* Designs Shots collage (node 103:30): centered horizontally, near the
          top — frame origin x=241,y=-44 within the 1512×982 hero. */}
      <div className="absolute left-1/2 top-[-44px] h-[491px] w-[1029px] -translate-x-1/2">
        <DesignShots />
      </div>

      {/* Hero Text (node 103:22): centered, frame top y=515 of the 982-tall hero. */}
      <div className="absolute left-1/2 top-[52.4%] w-[775px] max-w-[calc(100vw-3rem)] -translate-x-1/2">
        <HeroText />
      </div>

      {/* Logos trusted-by row (node 103:6): centered, anchored near the hero
          bottom — frame bottom y=938 of the 982-tall hero (44px gap). */}
      <div className="absolute bottom-[44px] left-1/2 w-[1351px] max-w-[calc(100vw-3rem)] -translate-x-1/2">
        <Logos />
      </div>
    </section>
  );
}
