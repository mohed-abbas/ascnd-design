import Hero from "@/components/sections/hero/hero";
import IntroLoader from "@/components/sections/intro/intro-loader";
import Tagline from "@/components/sections/tagline/tagline";

export default function Home() {
  return (
    <>
      {/* Pure-DOM cover over the sky while the WebGL intro warms up. Rendered
          first so its markup ships at the top of the body and paints with the
          first CSS, before any JS chunk loads. */}
      <IntroLoader />
      <Hero />
      <Tagline />
      {/* Empty full-viewport section over the shared sky — placeholder for the
          next block; lets the cloud/parallax keep scrolling past the tagline. */}
      <section data-spacer className="relative min-h-dvh w-full" />
    </>
  );
}
