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
      className="relative min-h-dvh w-full overflow-hidden"
    >
      {/* Word-by-word headline reveal + serif flourish + paragraph blur-in;
          renders nothing, drives the [data-ww-*] nodes below. */}
      <WorkingWithReveal />

      {/* Centred statement block (design frame 423:464), viewport-centred. */}
      <div className="absolute left-1/2 top-1/2 flex w-[726px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[48px] text-center text-white">
        {/* Headline — Product Sans Light with an Instrument Serif "working".
            Each word is an inline-block span so it can rise/blur independently;
            the serif word carries data-ww-serif for its distinct settle+glow. */}
        <p
          data-ww-headline
          className="whitespace-nowrap text-[49px] font-light leading-[1.1] tracking-[-1.47px]"
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
        <p data-ww-para className="text-[25px] leading-[1.1]">
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
