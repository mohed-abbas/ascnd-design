/**
 * "who you're working with" — Figma frame node 423:412 (1512×982).
 *
 * A quiet, full-viewport statement section: a mixed-font headline over a
 * two-tone paragraph, centred in the frame. Like the tagline and pills, it
 * renders at DESIGN SCALE (fixed px, centre-anchored) and stays TRANSPARENT
 * over the shared sky — the Figma mockup paints its own #62abff fill, grain and
 * two soft cloud overlays, but in this app the sky is the global fixed
 * <Background/> (fill → grain → volumetric clouds) mounted in layout.tsx, so
 * scrolling into here stays in one continuous world (no double grain, no baked
 * cloud PNGs fighting the live R3F cloud field).
 *
 * Layout (Figma frame 423:464, 726×214 at frame centre): a centred column,
 * `gap-48px`, text-centre —
 *   • Headline (423:465, 49px / −1.47px tracking / 1.1 leading): "who you're "
 *     and " with" in Product Sans Light (font-light), "working" in Instrument
 *     Serif (font-instrument) — the same italic-feel accent the hero uses.
 *   • Paragraph (423:466, 25px / 1.1 leading, Product Sans Regular): the first
 *     sentence is full white; the remainder drops to white/60, exactly as the
 *     design fades the supporting copy.
 *
 * The scroll reveal (see working-with-reveal.tsx) drives the [data-ww-*] nodes
 * below; the markup renders FINISHED (SSR / no-JS / reduced-motion show the full
 * statement), the driver only hides + plays once it knows it'll animate. The
 * headline is authored as explicit per-word spans (not SplitText) so the serif
 * "working" can carry its own data-hook and get a distinct beat.
 */
import WorkingWithReveal from "./working-with-reveal";

export default function WorkingWith() {
  return (
    <section
      data-working-with
      // Content-driven (no min-h-dvh): this is the sparsest section (~213px of
      // text), so a full-viewport box left it floating in near-double the air of
      // a dense one. `py-section` is the shared rhythm token (--gap-section in
      // globals.css — see comparison.tsx for the rationale), which keeps this
      // boundary identical to every other one. Mobile keeps its full-height
      // layout; the token drops to 12dvh there on its own.
      className="relative flex max-md:min-h-dvh w-full items-center justify-center overflow-hidden py-section"
    >
      {/* Word-by-word headline reveal + serif flourish + paragraph blur-in;
          renders nothing, drives the [data-ww-*] nodes below. */}
      <WorkingWithReveal />

      {/* Centred statement block (design frame 423:464), flow-centred by the
          section's flex so its height drives the section (no absolute centring
          in a forced-full-height parent). */}
      <div className="flex w-[726px] flex-col items-center gap-[48px] text-center text-white max-md:w-full max-md:gap-[32px] max-md:px-6">
        {/* Headline — Product Sans Light with an Instrument Serif "working".
            Each word is an inline-block span so it can rise/blur independently;
            the serif word carries data-ww-serif for its distinct settle+glow. */}
        <p
          data-ww-headline
          className="whitespace-nowrap text-display font-light leading-[1.1] tracking-[-0.03em] max-md:whitespace-normal"
        >
          <span data-ww-word className="inline-block">
            who
          </span>{" "}
          <span data-ww-word className="inline-block">
            you&rsquo;re
          </span>{" "}
          <span data-ww-word data-ww-serif className="inline-block font-instrument">
            working
          </span>{" "}
          <span data-ww-word className="inline-block">
            with
          </span>
        </p>

        {/* Supporting copy — a full-white lede that stays lit, then a white/60
            "unfilled" continuation (data-ww-fill) that inks up to full white on
            scroll (see working-with-reveal.tsx). */}
        <p data-ww-para className="text-[25px] leading-[1.1] max-md:text-[19px] max-md:leading-[1.25]">
          no matched freelancer, no rotating roster. same senior team every
          request,{" "}
          <span data-ww-fill className="text-white/60">
            the people who&rsquo;ve been designing and shipping for startups for
            eight years. we called it ascnd because that&rsquo;s the job. take
            what you&rsquo;ve got, take it up a level.
          </span>
        </p>
      </div>
    </section>
  );
}
