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
 * `backdrop-filter` runs a SINGLE-map SVG displacement, so the bright reel text
 * painted BEHIND it bends like real liquid glass. It's empty (no children); the
 * wrapper carries the position + the reveal's fade/scale. backdrop-filter here is
 * safe — the pill is a sibling of the root-mounted fixed <Background/>, not an
 * ancestor, so it doesn't turn the sky's fixed layers into a backdrop root (see
 * CLAUDE.md, same as CardShell). The displacement is Chromium-first;
 * Safari/Firefox fall back to a clear glass — crisp rim + static chromatic ring,
 * no frost (GlassSurface detects and degrades).
 *
 * PERF (2026-07-03): the pill runs `chromatic={false}` on EVERY tier — one
 * feDisplacementMap + a static chromatic ring, ~⅓ the filter cost of the old
 * 3-channel chain. The 3-channel dispersion re-evaluated every scrolled frame
 * (the sampled backdrop is the moving reel text), which kept the pinned scrub
 * off max fps even on capable machines. Uniform single-map trades live rim
 * dispersion for a static ring so the scrub costs the same minimal chain
 * everywhere (docs/why-stay-glass-optimization.md Decision 6). Previously the
 * single-map path was tier `low` only.
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

/** The heading split into per-word movers for the blur reveal (each word rises,
 *  fades in, and clears from a soft blur to crisp — the same mechanic as the hero
 *  and cards headings). No overflow clip: a hard mask would shear the blur halo.
 *  Spaces are inert spacers; a visually-hidden copy carries the real reading text
 *  so the split markup stays accessible. */
function HeadingWords() {
  let k = 0;
  return HEADING.flatMap((seg) =>
    seg.text
      .split(/(\s+)/)
      .filter((token) => token.length > 0)
      .map((token) => {
        const key = k++;
        if (/^\s+$/.test(token)) {
          return (
            <span key={key} aria-hidden className="inline-block whitespace-pre">
              {token}
            </span>
          );
        }
        return (
          <span
            key={key}
            data-whsword
            aria-hidden
            className={`inline-block will-change-transform ${
              seg.serif ? "font-instrument" : ""
            }`}
          >
            {token}
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
          carries --reel-y, inherited by the reel column.

          `isolate` is load-bearing (docs/why-stay-glass-optimization.md O2):
          per Filter Effects 2, `isolation: isolate` forms a BACKDROP ROOT, so
          the pill's backdrop-filter samples ONLY this stage subtree (the reel
          text) instead of the whole page behind it. Two wins:
          - the fixed cloud canvas + sky/grain no longer invalidate the
            displacement chain (the clouds morph at 30fps behind this section —
            without the root, the pill re-filtered even while idle);
          - the sampled image is text-on-transparent, not the full composite.
          Look is preserved because bending the flat sky was invisible anyway —
          all visible refraction is the text, and the sky now shows through
          unbent. */}
      {/* Heading (Figma 302:1460) — OUTSIDE the scaled stage, on the shared
          text-display token, so it sizes like every other section heading
          (inside, the stage's max-md:scale-[0.4] shrank it to ~20px vs the
          ~29px fluid display size the rest of the page uses). Desktop is
          unchanged: text-display = 49px and top 50% − 217px is exactly the old
          stage-top line (stage centre − half its 434px height); the -1.47px
          tracking is the same -0.03em, now in em so it scales with the token.
          On mobile it rests 115px above centre, clear of the 0.4-scaled reel. */}
      <h2 className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[217px] max-md:-translate-y-[115px] whitespace-nowrap text-center font-product text-display font-light leading-[1.1] tracking-[-0.03em] text-white">
        <span className="sr-only">why teams stay</span>
        <HeadingWords />
      </h2>

      <div
        data-whystay-stage
        // Below md the whole 876×434 design block is scaled down as ONE unit
        // (max-w-none keeps its design width; scale-[0.4] fits it to the phone),
        // so the reel phrases, REEL_STEP, --reel-y translation and glass pill
        // all shrink together — the exact composition, just smaller, with no
        // change to the (tightly coupled) reel geometry or the pin driver. (The
        // heading lives OUTSIDE, above, so it keeps the shared display size.)
        className="isolate absolute left-1/2 top-1/2 h-[434px] w-[876px] max-w-full -translate-x-1/2 -translate-y-1/2 max-md:max-w-none max-md:scale-[0.4]"
      >
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
            reel text behind it (single-map displacement + static chromatic ring).
            Empty (no children); the wrapper carries the position + reveal hooks. */}
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
            // 0 drops the feGaussianBlur primitive entirely (a full-region
            // convolution per scrolled frame for a half-pixel soften — audit
            // O4). The map's own baked blur carries the softness.
            displace={0}
            backgroundOpacity={0}
            saturation={1}
            distortionScale={-180}
            redOffset={0}
            greenOffset={10}
            blueOffset={20}
            // Single-map variant on EVERY tier (was: 3-channel on high/medium,
            // single-map on low). One feDisplacementMap + a static chromatic
            // ring at ~⅓ the filter cost — retires the per-frame chromatic
            // chain that kept the pinned scrub off max fps on all hardware.
            // Look trade accepted: live rim dispersion → static ring, already
            // validated as close to the old high look (Decision 6).
            chromatic={false}
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
