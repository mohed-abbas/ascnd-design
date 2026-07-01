/**
 * "why teams stay" — Figma node 302:180 (frame 1512×982, GlassSliderSection
 * 302:1462). A clear liquid-glass "slot reel" over the shared sky: a stack of
 * selling points scrolls vertically, and a see-through glass pill sits over the
 * centre — refracting and distorting the phrase behind it (real backdrop
 * displacement, not a frost). Like the hero/cards it renders at design scale
 * (fixed px, centre-anchored) and stays transparent so the fixed <Background/> +
 * clouds show through.
 *
 * Motion is SCROLL-SCRUBBED + PINNED (why-stay-reveal.tsx): as the section rises
 * in, the heading rolls up per character and the pill fades in; the section then
 * PINS to the viewport and continued scrolling glides the reel linearly through
 * every phrase (one continuous scrub, no dwell) before the pin releases and the
 * page scrolls on. Resting state (SSR / no-JS / reduced-motion) shows the heading
 * assembled and the first phrase centred, with no pin.
 *
 * The glass is <GlassSurface/> (components/ui) — a transparent pill whose
 * `backdrop-filter` runs a chromatic per-channel SVG displacement, so the bright
 * reel text painted BEHIND it bends and disperses like real liquid glass. It's
 * empty (no children); the wrapper carries the position + the reveal's fade/scale.
 * backdrop-filter here is safe — the pill is a sibling of the root-mounted fixed
 * <Background/>, not an ancestor, so it doesn't turn the sky's fixed layers into
 * a backdrop root (see CLAUDE.md, same as CardShell). The displacement is
 * Chromium-first; Safari/Firefox fall back to a plain frosted glass (GlassSurface
 * detects and degrades).
 */
import GlassSurface from "@/components/ui/glass-surface";
import WhyStayReveal from "./why-stay-reveal";
import { PHRASES, REEL_STEP } from "./why-stay-data";

// Heading segments — "stay" is the Instrument Serif accent (Figma 302:1460).
const HEADING: { text: string; serif: boolean }[] = [
  { text: "why teams ", serif: false },
  { text: "stay", serif: true },
];

// Glass pill size + radius (Figma 302:1457). The glass look/feel is the
// user-supplied GlassSurface config applied below.
const PILL_W = 876;
const PILL_H = 133;
const PILL_RADIUS = 103;

/** The heading split into per-character clip → mover units (same roll-up mechanic
 *  as the tagline). Spaces are inert spacers; a visually-hidden copy carries the
 *  real reading text so the split markup stays accessible. */
function HeadingChars() {
  let k = 0;
  return HEADING.flatMap((seg) =>
    seg.text.split("").map((ch) => {
      const key = k++;
      if (ch === " ") {
        return (
          <span key={key} aria-hidden className="inline-block whitespace-pre">
            {" "}
          </span>
        );
      }
      return (
        <span
          key={key}
          aria-hidden
          className="inline-block overflow-hidden align-bottom"
          style={{ marginBottom: "-0.2em" }}
        >
          <span
            data-whschar
            className={`relative inline-block will-change-transform ${
              seg.serif ? "font-instrument" : ""
            }`}
            style={{ paddingBottom: "0.2em" }}
          >
            {ch}
          </span>
        </span>
      );
    }),
  );
}

export default function WhyStay() {
  return (
    <section data-whystay className="relative min-h-dvh w-full overflow-hidden">
      {/* Scrubs the whole section (heading roll-up + pill fade + reel) as it
          crosses the viewport; renders nothing. */}
      <WhyStayReveal />

      {/* Design block (Figma 302:1462, 876×434) centred in the viewport. It
          carries --reel-y, inherited by the reel column. */}
      <div
        data-whystay-stage
        className="absolute left-1/2 top-1/2 h-[434px] w-[876px] max-w-full -translate-x-1/2 -translate-y-1/2"
      >
        {/* Heading (Figma 302:1460) — top of the block, centred. */}
        <h2 className="absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap text-center font-product text-[49px] font-light leading-[1.1] tracking-[-1.47px] text-white">
          <span className="sr-only">why teams stay</span>
          <HeadingChars />
        </h2>

        {/* The reel — bright phrases scrolling behind the glass. Masked to fade
            above/below the pill band (globals.css [data-whystay-window]) so only
            the framed phrase (and its neighbours as fog) shows. Sits BEHIND the
            pill, which refracts it. */}
        <div
          data-whystay-window
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[calc(50%+27.5px)] h-[380px] w-[748px] max-w-full -translate-x-1/2 -translate-y-1/2"
        >
          <div data-reel-col className="absolute inset-0">
            {PHRASES.map((phrase, i) => (
              <span
                key={phrase}
                className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-product text-[95px] font-bold leading-[0.961] tracking-[-2.85px] text-white"
                style={{ top: `calc(50% + ${i * REEL_STEP}px)` }}
              >
                {phrase}
              </span>
            ))}
          </div>
        </div>

        {/* Clear liquid-glass pill (Figma 302:1457) — <GlassSurface/> refracts the
            reel text behind it (chromatic per-channel displacement). Empty (no
            children); the wrapper carries the position + reveal hooks. */}
        <div
          data-whystay-pill
          aria-hidden
          className="pointer-events-none absolute left-0 top-[178px]"
        >
          <GlassSurface
            width={PILL_W}
            height={PILL_H}
            borderRadius={PILL_RADIUS}
            borderWidth={0.07}
            brightness={50}
            opacity={0.9}
            blur={12}
            displace={0.5}
            backgroundOpacity={0}
            saturation={1}
            distortionScale={-180}
            redOffset={0}
            greenOffset={10}
            blueOffset={20}
            className="max-w-full"
          />
        </div>

        {/* Accessible, motion-free rendition of the reel for assistive tech. */}
        <ul className="sr-only">
          {PHRASES.map((phrase) => (
            <li key={phrase}>{phrase}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
