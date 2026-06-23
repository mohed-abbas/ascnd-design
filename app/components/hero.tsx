import DesignShots from "./design-shots";
import HeroText from "./hero-text";
import Logos from "./logos";
import Navbar from "./navbar";
import Rock from "./rock";
import Wordmark from "./wordmark";

/**
 * Hero section — built component by component to match the Figma "Hero base"
 * frame (103:4, 1512×982). Background is the design's solid sky fill (#62abff)
 * with a 1024px grain texture tiled over it at 10% opacity (node 103:4 bg).
 */
export default function Hero() {
  return (
    <section className="relative min-h-dvh w-full overflow-hidden bg-[#62abff]">
      {/* Grain overlay — 1024px noise tile at 10% opacity, sits just above the
          solid fill and behind every other layer. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 bg-[url('/textures/grain.png')] bg-[length:1024px_1024px] bg-left-top opacity-10"
      />

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
