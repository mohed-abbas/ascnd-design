import DesignShots from "./design-shots";
import DesignShotsReveal from "./design-shots-reveal";
import GrassRocks from "./grass-rocks";
import HeroReveal from "./hero-reveal";
import HeroText from "./hero-text";
import Logos from "./logos";
import LogosMarquee from "./logos-marquee";
import Navbar from "./navbar";
import Rock from "./rock";
import RockHover from "./rock-hover";
import RockReveal from "./rock-reveal";
import Wordmark from "./wordmark";

/**
 * Hero section — built component by component to match the Figma "Hero base"
 * frame (103:4, 1512×982). The sky (solid fill + grain + volumetric clouds)
 * is the global fixed <Background/> mounted in layout.tsx; the hero is
 * transparent over it.
 */
export default function Hero() {
  return (
    <section
      data-hero
      className="relative min-h-dvh w-full overflow-hidden"
    >
      {/* Drives the staggered on-load slide-up reveal of the text blocks below
          (marked with data-reveal* / data-reveal-order). Renders nothing. */}
      <HeroReveal />

      <Navbar />

      {/* Logos trusted-by row (node 103:6): centered, anchored near the hero
          bottom — frame bottom y=938 of the 982-tall hero (44px gap). Rendered
          BEFORE the rocks so the cliffs paint over it: the marquee wordmarks
          scroll out from behind the rocks (this page layers by DOM order — the
          rocks sit at z-0 and everything after them paints on top). */}
      <div className="absolute bottom-[44px] left-1/2 w-[1351px] max-w-[calc(100vw-3rem)] -translate-x-1/2">
        {/* Drives the infinite leftward marquee of the brand row; renders nothing. */}
        <LogosMarquee />
        <Logos />
      </div>

      {/* Rocks (nodes 103:19 / 103:18): cliffs pinned to the hero's bottom
          edges, framing the content. RockEntrance drives their on-load rise
          (Option A); it renders nothing. */}
      <RockReveal />
      <Rock side="left" />
      <Rock side="right" />

      {/* Grass-rock hover reveal (nodes 56:58 / 69:175): the lush variant of the
          cliffs, registered over the bare ones and uncovered in a soft disc that
          follows the cursor. GrassRocks is the masked overlay; RockHover drives
          the mask and renders nothing. */}
      <GrassRocks />
      <RockHover />

      {/* ascnd wordmark (node 77:174): top-center brand mark, glyph top ~55px
          of the 982-tall hero, ~36px Product Sans Medium. Sits above the
          collage on plain sky. */}
      <div className="absolute left-1/2 top-[40px] z-10 -translate-x-1/2 text-[38px]">
        {/* Masked slide-up reveal (cascade #1). */}
        <span className="block overflow-hidden">
          <span className="block" data-reveal data-reveal-order={1}>
            <Wordmark />
          </span>
        </span>
      </div>

      {/* Designs Shots collage (node 103:30): centered horizontally, near the
          top — frame origin x=241,y=-44 within the 1512×982 hero. DesignShotsReveal
          drives the on-load bloom-from-center of the tiles; it renders nothing. */}
      <DesignShotsReveal />
      <div className="absolute left-1/2 top-[-44px] h-[491px] w-[1029px] -translate-x-1/2">
        <DesignShots />
      </div>

      {/* Hero Text (node 103:22): centered, frame top y=515 of the 982-tall hero. */}
      <div className="absolute left-1/2 top-[52.4%] w-[775px] max-w-[calc(100vw-3rem)] -translate-x-1/2">
        <HeroText />
      </div>
    </section>
  );
}
