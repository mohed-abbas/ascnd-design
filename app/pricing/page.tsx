import type { Metadata } from "next";
import AnchorLink from "@/components/ui/anchor-link";
import ChromeReveal from "@/components/ui/chrome-reveal";
import BookACall from "@/components/sections/book-a-call/book-a-call";
import Costs from "@/components/sections/costs/costs";
import Faq from "@/components/sections/faq/faq";
import { PRICING_FAQS } from "@/components/sections/faq/faq-data";
import Footer from "@/components/sections/footer/footer";
import Navbar from "@/components/ui/navbar";
import PlanCompare from "@/components/sections/plan-compare/plan-compare";
import Pricing from "@/components/sections/pricing/pricing";
import Timeline from "@/components/sections/timeline/timeline";
import Wordmark from "@/components/ui/wordmark";

export const metadata: Metadata = {
  title: "pricing — ascnd",
  description:
    "Two ways to work with us, same senior team either way. Subscribe and pause anytime, or scope a fixed sprint.",
};

/**
 * /pricing — the standalone pricing route.
 *
 * Reuses the site's shared chrome and the homepage Pricing section as its hero:
 *   • Sky, grain, volumetric clouds, custom cursor and the sky-mode switcher all
 *     come from the global fixed layers in layout.tsx — this route inherits them
 *     with no extra wiring (like every other page, it renders transparent over
 *     the shared <Background/>).
 *   • <Navbar> — the same floating glass nav (fixed, shared across routes).
 *   • The top-center <Wordmark> — the hero's brand mark, lifted out to the page
 *     top here (there's no hero on this route). NB: no `data-wordmark-slot` — the
 *     WebGL welcome intro only ever docks on the homepage hero.
 *   • <Pricing> — the homepage pricing section verbatim, standing in as this
 *     page's hero. It carries its own <PricingReveal> (a ScrollTrigger `once`
 *     timeline that fires immediately when it's the in-view first section).
 *   • <Footer> — the shared closing footer (with its own <FooterReveal>).
 *
 * <ChromeReveal> plays the wordmark + navbar on-load entrance: the shared layout
 * arms `.reveal-armed` on <html> for EVERY route, and globals.css then hides the
 * armed chrome — on the homepage HeroReveal clears it, so interior pages need
 * this counterpart or the navbar never fades in (see chrome-reveal.tsx).
 *
 * The next sections (below the Pricing hero, above the footer) land here as their
 * Figma frames are provided.
 */
export default function PricingPage() {
  return (
    <>
      {/* Fades the navbar in + slides the wordmark up on load. Renders nothing. */}
      <ChromeReveal />

      <Navbar />

      {/* ascnd wordmark — top-center brand mark over the plain sky, matching the
          hero's placement (glyph top ~40px, ~38px Product Sans Medium). Absolute
          to the page top (scrolls away with content). Masked slide-up reveal via
          [data-reveal], driven by ChromeReveal. Links home (cross-route here, so
          AnchorLink hands off to next/link — the shared fixed sky/cloud canvas
          survives the navigation). */}
      <div className="absolute left-1/2 top-[40px] z-10 -translate-x-1/2 text-[38px] max-md:top-[24px]">
        <span className="block overflow-hidden">
          <span className="block" data-reveal>
            <AnchorLink href="/" aria-label="ascnd — home" className="block">
              <Wordmark />
            </AnchorLink>
          </span>
        </span>
      </div>

      {/* Hero — the homepage pricing section, reused verbatim. */}
      <Pricing />

      {/* Supersize statement ("looking cheap costs more.") — same format and
          reveal as the hero tagline, different copy (Figma 792:438). */}
      <Costs />

      {/* Accordion plan comparison ("compare plan details") — Figma 678:2856. */}
      <PlanCompare />

      {/* Timeline ("your first month, plotted") — the winding dotted journey of
          the first month, day 1 → day 23 (Figma 746:4125). */}
      <Timeline />

      {/* Booking ("not sure which fits? talk to us.") — heading + subhead over
          the Cal.com inline embed (Figma 746:4592). */}
      <BookACall />

      {/* FAQ ("questions, answered straight") — the shared glass-pill accordion
          with the pricing-specific question set (Figma 746:4593). */}
      <Faq faqs={PRICING_FAQS} />

      {/* ── Future sections land here (Figma frames pending) ─────────────── */}

      {/* Closing footer — shared across routes. */}
      <Footer />
    </>
  );
}
