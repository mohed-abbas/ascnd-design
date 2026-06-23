/**
 * "Logos" trusted-by row — Figma node 103:6.
 * A caption ("trusted by founders shipping fast", with an Instrument Serif
 * "founders" accent) above a single row of brand wordmarks at 50% opacity.
 *
 * The design fades both ends of the row with an alpha mask (exported as a PNG
 * in Figma) — here it's reproduced with an equivalent CSS linear-gradient mask,
 * so there's no asset to ship. Aeonik Bold (proprietary) falls back to
 * Product Sans Bold, matching how the other proprietary fonts are handled.
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
      <p className="whitespace-nowrap text-[16px] tracking-[-0.32px]">
        trusted by{" "}
        <span className="font-instrument text-[25px] tracking-[-0.5px]">
          founders
        </span>{" "}
        shipping fast
      </p>

      <div
        aria-hidden
        className="flex w-full max-w-[1351px] items-center justify-center gap-[43px] whitespace-nowrap text-[25px] font-bold leading-[1.2] text-white opacity-50"
        style={{
          maskImage: EDGE_FADE,
          WebkitMaskImage: EDGE_FADE,
        }}
      >
        {BRANDS.map((brand) => (
          <span key={brand} className="shrink-0">
            {brand}
          </span>
        ))}
      </div>
    </div>
  );
}
