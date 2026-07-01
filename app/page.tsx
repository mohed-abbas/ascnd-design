import Cards from "@/components/sections/cards/cards";
import Hero from "@/components/sections/hero/hero";
import IntroLoader from "@/components/sections/intro/intro-loader";
import Tagline from "@/components/sections/tagline/tagline";
import WhyStay from "@/components/sections/why-stay/why-stay";

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
      {/* Glass-pill "slot reel" of selling points ("why teams stay"). */}
      <WhyStay />
    </>
  );
}
