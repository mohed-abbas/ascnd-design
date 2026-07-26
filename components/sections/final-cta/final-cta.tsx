import Button from "@/components/ui/button";
import FinalCtaReveal from "./final-cta-reveal";

/**
 * "let's get you off the ground" — Figma frame 526:458 (FinalCTA).
 *
 * The closing call-to-action: a mixed-font heading (504:501) over a two-button
 * row (510:520) — a primary "choose a plan" and a glass "book a 15-min intro
 * call". Like every other section it renders at DESIGN SCALE (fixed px,
 * centre-anchored) and stays TRANSPARENT over the shared sky — the fixed
 * <Background/> (fill → grain → clouds) shows through, so the Figma mock's own
 * #62abff fill + grain are intentionally NOT reproduced here.
 *
 * Layout: a viewport-centred column —
 *   • Heading (504:501, 49px / −1.47px tracking / 1.1 leading): "let's get you
 *     off the " in Product Sans Light + "ground" in Instrument Serif — the same
 *     italic-feel accent the other sections use.
 *   • Button row (510:520, gap-16px): both are the site's shared <Button>
 *     (components/ui/button.tsx) — "choose a plan" is `solid` (white-gradient
 *     fill, dark text, hover aura), "book a 15-min intro call" is `clear` (glass:
 *     white/10 fill, white border, backdrop-blur). The design's two pills map
 *     1:1 onto those existing variants, so no new button styling is introduced.
 *
 * The heading uses the shared word-by-word blur-rise reveal (final-cta-reveal.tsx)
 * driving [data-final-cta-head]; the button row settles a beat after, matching
 * the head→sub cadence of the other sections. Markup renders FINISHED (SSR /
 * no-JS / reduced-motion show the full CTA); the driver only hides + plays once
 * it knows it'll animate.
 *
 * Button actions are intentionally left unwired (real <button>s, no handler) —
 * "choose a plan" → pricing and "book a 15-min intro call" → Cal.com get wired
 * when those integrations land (see CLAUDE.md's Stripe / Cal.com note).
 */
export default function FinalCta() {
  return (
    <section
      data-final-cta
      // No min-h-dvh. ASYMMETRIC padding, and the TOP is deliberately NOT the
      // house 25dvh: the FAQ already contributes its own 25dvh bottom, and
      // stacking two of them put ~490px of empty sky above a block that is only
      // ~130px of ink (heading + button row) — the CTA read as marooned rather
      // than as the close of the page. Sections either side of a dense neighbour
      // can afford the doubled gap; this one can't. 8dvh here lands the total
      // lead-in near ~320px, in line with the rest of the page's rhythm.
      // The BOTTOM stays tight (clamped ~128px) so the buttons sit close to the
      // footer below — it adds its own sky headroom, and a bigger bottom here
      // would re-open the dead gap before it. Mobile keeps its symmetric padding.
      className="relative flex w-full items-center justify-center overflow-hidden pt-[8dvh] pb-[clamp(96px,13dvh,136px)] max-md:pt-[9dvh] max-md:pb-[9dvh]"
    >
      {/* Content block, flow-centred so a viewport shorter than the block grows
          the section (page scrolls) instead of clipping it. Below md it goes
          full-width with a 24px gutter so the heading can wrap and the CTAs can
          stack (docs/responsive-system.md §5, Archetype A). */}
      <div className="flex flex-col items-center gap-[32px] max-md:w-full max-md:gap-[24px] max-md:px-6">
        {/* Word-by-word blur reveal on the heading (see final-cta-reveal.tsx). */}
        <FinalCtaReveal />

        {/* Heading (504:501) — Product Sans Light with an Instrument Serif
            "ground". Fluid `text-display` token + em tracking (−0.03em == the
            design's −1.47px @ 49px, unchanged on desktop). Single-lined on
            desktop; wraps within the gutter below md. */}
        <h2
          data-final-cta-head
          className="whitespace-nowrap text-center text-display leading-[1.1] tracking-[-0.03em] text-white max-md:w-full max-md:whitespace-normal"
        >
          <span className="font-light">let&rsquo;s get you off the </span>
          <span className="font-instrument">ground</span>
        </h2>

        {/* Button row (510:520) — the site's shared Button, two variants. Stacks
            full-width (capped) below md for thumb-friendly tap targets. */}
        <div
          data-final-cta-actions
          className="flex items-center gap-[16px] max-md:w-full max-md:max-w-[360px] max-md:flex-col max-md:gap-[12px]"
        >
          <Button variant="solid" className="max-md:w-full">
            choose a plan
          </Button>
          <Button variant="clear" className="max-md:w-full">
            book a 15-min intro call
          </Button>
        </div>
      </div>
    </section>
  );
}
