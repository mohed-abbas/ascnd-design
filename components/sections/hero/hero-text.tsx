/**
 * "Hero Text" — Figma node 103:22.
 * Headline (Product Sans Light, with an Instrument Serif "hiring" accent),
 * subtext, and the two CTAs. Stacked, centered, gap 23px.
 */
export default function HeroText() {
  return (
    <div className="font-product flex flex-col items-center gap-[23px] text-center text-white">
      {/* Reveal #3 — headline rolls up per character (SplitText chars + mask). */}
      <h1
        data-reveal-split
        data-reveal-order={3}
        className="w-[775px] max-w-full text-[56px] font-light leading-[1.1] tracking-[-1.68px]"
      >
        your design and front-end team, without the{" "}
        <span className="font-instrument tracking-[-0.5px]">hiring</span>
      </h1>

      {/* Reveal #4 — sub-paragraph rolls up per word (SplitText words + mask). */}
      <p
        data-reveal-words
        data-reveal-order={4}
        className="w-[567px] max-w-full text-[16px] leading-normal tracking-[0.32px]"
      >
        subscribe and request unlimited brand, web, and product design.
        delivered in days, shipped as real code.
      </p>

      {/* Reveal #5 — the CTAs roll up too. Each button sits in a clip that is
          armed only while hidden (see globals.css) and lifted the moment the
          roll-up finishes, so a permanent overflow never shaves the buttons'
          hover scale / focus ring. */}
      <div className="flex items-center gap-[13px]">
        <span data-reveal-cta data-reveal-order={5} className="inline-flex">
          <a
            href="#plans"
            className="relative rounded-[32px] bg-gradient-to-b from-white to-[#efefef] px-[20px] py-[7px] text-[16px] text-[#263138] shadow-[inset_0px_-2px_1px_0px_#f2f2f2,inset_0px_-2px_2px_0px_rgba(0,0,0,0.5)] transition-transform hover:scale-[1.02]"
          >
            see plans
          </a>
        </span>
        <span data-reveal-cta data-reveal-order={5} className="inline-flex">
          <a
            href="#book"
            className="rounded-[32px] border border-solid border-white bg-white/10 px-[20px] py-[7px] text-[16px] text-white backdrop-blur-[2px] transition-colors hover:bg-white/20"
          >
            book a 15-min intro call
          </a>
        </span>
      </div>
    </div>
  );
}
