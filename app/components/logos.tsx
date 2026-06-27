/**
 * "Logos" trusted-by row — Figma node 103:6.
 * A caption ("trusted by founders shipping fast", with an Instrument Serif
 * "founders" accent) above an infinite marquee of brand wordmarks at 50%
 * opacity, scrolling slowly leftward.
 *
 * The design fades both ends of the row with an alpha mask (exported as a PNG
 * in Figma) — here it's reproduced with an equivalent CSS linear-gradient mask,
 * so there's no asset to ship; it doubles as the marquee's edge feather, hiding
 * wordmarks as they enter/leave. Aeonik Bold (proprietary) falls back to
 * Product Sans Bold, matching how the other proprietary fonts are handled.
 *
 * Markup is a single brand "group" inside a `[data-logos-track]`; the marquee
 * orchestrator (logos-marquee.tsx) clones the group to fill the viewport and
 * drives the seamless scroll. With no JS / reduced motion the one group stays
 * put, centred under the edge-fade mask.
 */

const BRANDS = [
  "Acme Corp",
  "Nebula",
  "Vertex AI",
  "Orion Labs",
  "Polaris",
  "Vercel",
  "Figma",
];

// Symmetric edge fade — matches the Figma mask that dissolves the row toward
// both horizontal edges of the 1351px frame.
const EDGE_FADE =
  "linear-gradient(to right, transparent 0%, #000 9%, #000 91%, transparent 100%)";

export default function Logos() {
  return (
    <div className="font-product flex flex-col items-center gap-[20px] text-white">
      {/* Reveal #6 — fade + lift, not a clip: the oversized Instrument-Serif
          "founders" accent overflows the line-box, which a mask would shave. */}
      <p
        data-reveal-fade
        data-reveal-order={6}
        className="whitespace-nowrap text-[16px] tracking-[-0.32px]"
      >
        trusted by{" "}
        <span className="font-instrument text-[25px] tracking-[-0.5px]">
          founders
        </span>{" "}
        shipping fast
      </p>

      {/* Reveal #7 — fade the wrapper (not the row) so the row keeps its
          opacity-50 brand look and its own mask-image edge fade. */}
      <div
        data-reveal-fade
        data-reveal-order={7}
        className="flex w-full justify-center"
      >
        {/* Marquee viewport: clips the scrolling track and feathers both ends
            with the edge-fade mask. justify-center keeps the single group
            centred in the static (no-JS / reduced-motion) fallback; the
            orchestrator switches to left-anchored before it animates. */}
        <div
          aria-hidden
          className="flex w-full max-w-[1351px] justify-center overflow-hidden opacity-50"
          style={{
            maskImage: EDGE_FADE,
            WebkitMaskImage: EDGE_FADE,
          }}
        >
          <div
            data-logos-track
            className="flex w-max items-center gap-[43px] whitespace-nowrap text-[25px] font-bold leading-[1.2] text-white"
          >
            <div
              data-logos-group
              className="flex shrink-0 items-center gap-[43px]"
            >
              {BRANDS.map((brand) => (
                <span key={brand} className="shrink-0">
                  {brand}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
