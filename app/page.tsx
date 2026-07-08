import Cards from "@/components/sections/cards/cards";
import Hero from "@/components/sections/hero/hero";
import IntroLoader from "@/components/sections/intro/intro-loader";
import Pills from "@/components/sections/pills/pills";
import Showcase from "@/components/sections/showcase/showcase";
import Tagline from "@/components/sections/tagline/tagline";
import WhyStay from "@/components/sections/why-stay/why-stay";
import WorkingWith from "@/components/sections/working-with/working-with";

export default function Home() {
  return (
    <>
      {/* Pure-DOM cover over the sky while the WebGL intro warms up. Rendered
          first so its markup ships at the top of the body and paints with the
          first CSS, before any JS chunk loads. */}
      <IntroLoader />
      <Hero />
      <Tagline />
      {/* Three-card row (subscribe · request · receive) over the shared sky. */}
      <Cards />
      {/* Glass-pill "slot reel" of selling points ("why teams stay").
          Wrapped in a plain block div ON PURPOSE: <body> is a flex column, and
          ScrollTrigger cannot add pin-spacing to a direct child of a flex/grid
          container — the flex layout swallows the pin-spacer's padding, so the
          pinned reel would get zero scroll room and the page would freeze when
          it reached this section. The block wrapper gives the pin normal block
          flow to grow into. Don't remove it. */}
      <div className="shrink-0">
        <WhyStay />
      </div>
      {/* Scattered "capability pills" field around a centred headline + CTA
          ("everything that gets you up there"), over the shared sky. */}
      <Pills />
      {/* Quiet mixed-font statement + two-tone paragraph ("who you're working
          with"), centred over the shared sky. */}
      <WorkingWith />
      {/* "stuff we've shipped" — project-showcase section: a fanned arc of
          project cards over the shared sky. On capable desktops the wheel is
          drawn in WebGL and PINS to scrub its rotation as you scroll, then
          unpins. Wrapped in a plain block div ON PURPOSE (same reason as
          WhyStay above): <body> is a flex column, and ScrollTrigger can't grow
          pin-spacing on a direct flex child — the block wrapper gives the pin
          normal flow to expand into. Don't remove it. */}
      <div className="shrink-0">
        <Showcase />
      </div>
    </>
  );
}
