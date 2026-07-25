import Cards from "@/components/sections/cards/cards";
import Comparison from "@/components/sections/comparison/comparison";
import Faq from "@/components/sections/faq/faq";
import FinalCta from "@/components/sections/final-cta/final-cta";
import Footer from "@/components/sections/footer/footer";
import Hero from "@/components/sections/hero/hero";
import IntroLoader from "@/components/sections/intro/intro-loader";
import Pills from "@/components/sections/pills/pills";
import Portfolio from "@/components/sections/portfolio/portfolio";
import Pricing from "@/components/sections/pricing/pricing";
import Tagline from "@/components/sections/tagline/tagline";
import Testimonials from "@/components/sections/testimonials/testimonials";
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
            {/* Cloud-canvas image globe: project stills arranged on a Fibonacci
          sphere (2D canvas, no WebGL) that auto-spins, drags to rotate, and
          click-focuses a tile. Floats transparently over the shared sky — it
          does NOT pin/scrub, so no shrink-0 wrapper is needed (unlike WhyStay).

          ORDER: deliberately placed BEFORE Comparison, i.e. between the two
          heaviest scroll features rather than beside one. It used to sit
          directly after Testimonials, so the WebGL GLB rocks and this 2D image
          globe were adjacent and briefly co-visible across that boundary;
          Comparison (a light glass table) now separates them by ~1200px so
          they're never on screen together. The permutation is exact — these
          three sections still fill the same band, so Pricing and everything
          below keep their offsets, and the vh-anchored clouds (max anchorVh 7
          ≈ 5390px, all above this point) are untouched. See the initAfter gate
          in cloud-canvas-scene.tsx for the one thing this move DID require. */}
            <Portfolio />
            {/* Feature matrix: ascnd vs hiring / agencies / freelancers ("none of the
          above"), a glass comparison table over the shared sky. */}
            <Comparison />
            {/* Client pull-quote floating in open sky, framed by four rocks ringed
          with thin orbit outlines ("testimonials"), over the shared sky. Sits
          before pricing. */}
            <Testimonials />
            {/* Two-tier pricing ("simple pricing, pause anytime"): subscription +
          fixed-sprint glass cards joined by a dashed connector, over the shared
          sky. */}
            <Pricing />
            {/* "questions, answered straight": six glass FAQ pills that expand on click
          (single-open accordion), under a mixed-font heading, over the shared
          sky. */}
            <Faq />
            {/* Closing call-to-action ("let's get you off the ground"): a mixed-font
          heading over the two shared CTA buttons, over the shared sky. */}
            <FinalCta />
            {/* Closing footer ("FooterFinal"): utility bar (nav + socials + legal)
          high in the band, a giant "ascnd" wordmark, and two grass-rock cutouts
          framing the bottom edges — transparent over the shared sky. */}
            <Footer />
        </>
    );
}
