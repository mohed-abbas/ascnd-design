import Hero from "@/components/sections/hero/hero";
import Tagline from "@/components/sections/tagline/tagline";

export default function Home() {
  return (
    <>
      <Hero />
      <Tagline />
      {/* Empty full-viewport section over the shared sky — placeholder for the
          next block; lets the cloud/parallax keep scrolling past the tagline. */}
      <section data-spacer className="relative min-h-dvh w-full" />
    </>
  );
}
