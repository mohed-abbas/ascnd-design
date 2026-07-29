import BookACallReveal from "./book-a-call-reveal";
import CalEmbed from "./cal-embed";

/**
 * "not sure which fits? talk to us." — Figma frame 746:4592.
 *
 * The pricing page's booking section, sitting just before the FAQ: a centred
 * heading + subhead over a large glass box that hosts the Cal.com inline embed
 * (cal-embed.tsx). Like every section it renders at DESIGN SCALE (a 900px
 * centre-anchored block) and stays TRANSPARENT over the shared sky — the mock's
 * own #62abff fill + grain are intentionally NOT reproduced.
 *
 * Layout (content group 746:4592, 900px, gap-40):
 *   • Heading (746:4548, 49px / −0.03em / 1.1 leading): "not sure which fits? "
 *     in Product Sans Light + "talk to us." in Instrument Serif — the same
 *     italic-feel accent the other section heads use.
 *   • Subhead (746:4549, 16px / +0.02em): the honest-15-minutes line.
 *   • Calendar box (746:4550, 563px tall): a dashed-edge glass frame —
 *     rounded-20, black 10→5 gradient, the site's inset-white veil in place of
 *     the Figma backdrop-blur (frost-swept convention, matching the FAQ pills).
 *
 * The calendar box hosts the LIVE Cal.com inline embed (cal-embed.tsx →
 * cal.com/ascndd/intro-session, lazy-loaded on approach). The embed keeps
 * Cal's own light look regardless of the site's sky mode — deliberate.
 *
 * The reveal (book-a-call-reveal.tsx) drives [data-book-a-call-head/-sub/-box]
 * with the shared word-by-word blur-rise; markup renders FINISHED (SSR / no-JS /
 * reduced-motion show it whole), the driver only hides + plays once it knows it
 * will animate.
 */
export default function BookACall() {
  return (
    <section
      id="book"
      data-book-a-call
      // Shared section rhythm (--gap-section, globals.css — see comparison.tsx):
      // /pricing runs on the same boundary as the homepage.
      className="relative flex w-full items-center justify-center overflow-hidden py-section"
    >
      <div className="flex w-[900px] max-w-full flex-col items-center gap-[40px] max-md:gap-[28px] max-md:px-6">
        {/* Word-by-word blur reveal on the heading + fades on the subhead / box. */}
        <BookACallReveal />

        {/* Heading + subhead (746:4547). */}
        <div className="flex w-[628px] max-w-full flex-col items-center gap-[25px] text-center text-white max-md:gap-[18px]">
          <h2
            data-book-a-call-head
            className="w-full text-display leading-[1.1] tracking-[-0.03em]"
          >
            <span className="font-light">not sure which fits? </span>
            <span className="font-instrument">talk to us.</span>
          </h2>
          <p
            data-book-a-call-sub
            className="w-full text-body font-light leading-normal tracking-[0.02em] text-white/90 max-md:text-balance"
          >
            a 15-minute call. we&apos;ll look at what you&apos;ve got, tell you
            honestly which mode fits, and you&apos;ll leave with a plan either
            way.
          </p>
        </div>

        {/* Calendar box (746:4550) — dashed glass frame hosting the Cal.com
            inline embed. No height of its own: while loading, CalEmbed's
            placeholder holds the design height; once ready the frame hugs the
            booker card exactly (CalEmbed clips Cal's in-iframe branding strip
            off the bottom — the overflow-hidden here is what does the crop).
            Cal's credit is re-rendered in white BELOW the box instead. */}
        <div
          data-book-a-call-box
          className="flex w-full items-center justify-center overflow-hidden rounded-[20px] border border-dashed border-white/40 bg-gradient-to-b from-black/10 to-black/5 shadow-[inset_0_0_0_999px_rgba(255,255,255,0.06)]"
        >
          <CalEmbed />
        </div>

        {/* The Cal.com credit the clip above removes — same destination link,
            but white and OUTSIDE the frame. -mt tightens the column gap. */}
        <a
          href="https://go.cal.com/booking"
          target="_blank"
          rel="noopener noreferrer"
          className="-mt-[24px] text-[14px] font-bold tracking-[0.01em] text-white/80 transition-colors hover:text-white max-md:-mt-[16px]"
        >
          Cal.com
        </a>
      </div>
    </section>
  );
}
