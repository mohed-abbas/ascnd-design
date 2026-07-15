/**
 * The pricing feature tick — Figma node 469:796 (the repeated 20×20 "Frame").
 *
 * Same two-tone construction as the comparison matrix tick (comparison-icons.tsx):
 * two overlaid strokes — one full-white leg, one at 40% opacity — for the subtle
 * diagonal light. Paths are lifted verbatim from the Figma SVG export at its
 * native 20×20 viewBox. Kept inline (vs. a /public SVG) so it inherits the flow,
 * needs no extra request, and stays trivially styleable.
 */
export function CheckMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      role="img"
      aria-label="included"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8.4405 14.587L9.10342 13.9241L7.77763 12.5983L5.03792 9.85861C4.6718 9.49244 4.0782 9.49244 3.71208 9.85861C3.34597 10.2247 3.34598 10.8183 3.71209 11.1844L7.11471 14.587C7.48083 14.9532 8.07442 14.9532 8.4405 14.587Z"
        fill="white"
      />
      <path
        opacity="0.4"
        d="M16.2877 6.74006C16.6537 6.37394 16.6537 5.78035 16.2877 5.41424C15.9215 5.04812 15.3279 5.04812 14.9618 5.41424L7.77734 12.5987L9.10315 13.9245L16.2877 6.74006Z"
        fill="white"
      />
    </svg>
  );
}

// Reconstructed centreline of the Figma dashed connector (node 469:855). The
// export bakes the dashed stroke into a filled compound path — no stroke to
// animate — so the skeleton was recovered (nearest-neighbour chain over the dash
// centres) and re-authored as an actual stroked path. This is what makes the
// draw-on possible: a stroke can dash-offset, a fill cannot.
const CONNECTOR_PATH =
  "M1.6 57.2C2.8 56.5 6.6 54.2 8.9 52.8C11.2 51.4 13.4 50.2 15.7 48.9C17.9 47.6 20.1 46.3 22.4 45.0C24.6 43.7 26.9 42.4 29.2 41.1C31.4 39.8 33.6 38.5 35.9 37.2C38.1 35.9 40.5 34.6 42.7 33.3C45.0 32.0 47.1 30.7 49.4 29.4C51.6 28.1 54.0 26.8 56.2 25.5C58.5 24.2 60.6 22.9 62.9 21.6C65.2 20.3 67.5 19.0 69.7 17.7C72.0 16.4 74.2 15.1 76.4 13.8C78.7 12.5 80.2 11.5 83.2 9.9C86.2 8.3 91.0 5.3 94.1 4.0C97.2 2.7 99.1 2.2 101.6 1.8C104.1 1.4 106.7 1.4 109.3 1.4C111.9 1.4 114.6 1.3 117.2 1.6C119.8 1.9 122.2 2.6 124.7 3.4C127.2 4.2 129.6 5.3 131.9 6.5C134.2 7.7 136.3 9.2 138.4 10.8C140.5 12.4 142.5 14.1 144.3 16.2C146.1 18.2 148.0 21.1 149.3 23.1C150.7 25.1 151.3 26.2 152.4 28.2C153.5 30.2 154.8 33.2 156.1 35.2C157.4 37.2 158.6 38.7 160.3 40.5C162.0 42.3 164.1 44.4 166.4 45.9C168.7 47.4 171.4 48.6 173.9 49.4C176.4 50.2 178.9 50.5 181.6 50.6C184.3 50.7 187.2 50.4 190.1 49.8C192.9 49.1 196.4 47.8 198.7 46.7C201.0 45.7 202.0 44.7 204.1 43.5C206.2 42.3 208.7 40.8 211.0 39.5C213.3 38.2 215.7 36.8 218.0 35.5C220.3 34.2 222.3 33.0 224.9 31.5C227.5 30.0 231.1 27.6 233.7 26.4C236.2 25.2 237.7 24.4 240.2 24.5C242.7 24.6 246.4 25.4 248.8 26.9C251.2 28.3 253.5 30.5 254.6 33.2C255.7 35.9 255.1 40.1 255.2 43.0C255.3 45.9 254.6 48.0 255.3 50.4C256.0 52.8 257.3 55.7 259.2 57.6C261.1 59.5 264.0 61.2 266.9 61.6C269.8 62.0 274.1 60.8 276.6 60.0C279.1 59.2 279.9 57.8 281.9 56.7C283.9 55.6 286.2 54.4 288.4 53.2C290.6 52.0 292.9 50.4 295.0 49.3C297.1 48.2 298.9 47.2 301.3 46.7C303.7 46.2 306.8 46.2 309.4 46.6C312.0 47.0 314.8 47.8 317.1 48.9C319.5 50.0 321.6 51.5 323.5 53.4C325.4 55.3 327.2 57.9 328.3 60.4C329.4 62.9 329.6 65.9 329.9 68.4C330.2 70.9 330.0 73.1 330.0 75.6C330.0 78.1 330.0 80.9 330.0 83.5C330.0 86.1 330.0 88.8 330.0 91.4C330.0 94.0 330.0 96.7 330.0 99.3C330.0 101.9 330.0 104.5 330.0 107.1C330.0 109.7 330.0 112.4 330.0 115.0C330.0 117.6 330.0 120.3 330.0 122.9C330.0 125.5 330.1 128.0 330.0 130.8C329.9 133.6 329.6 138.2 329.5 139.7";

// The arrowhead — Figma's original filled tip, kept verbatim. Revealed as a pop
// once the line finishes drawing (see pricing-reveal.tsx).
const CONNECTOR_HEAD =
  "M329.301 141.364C329.692 141.755 330.325 141.755 330.716 141.364L337.08 135C337.47 134.61 337.47 133.977 337.08 133.586C336.689 133.196 336.056 133.196 335.665 133.586L330.008 139.243L324.352 133.586C323.961 133.196 323.328 133.196 322.937 133.586C322.547 133.977 322.547 134.61 322.937 135L329.301 141.364Z";

/**
 * The dashed connector arrow (Figma node 469:855). Traces from the "most
 * founders start here" badge down into the fixed-sprint card; the gradient fades
 * it from the badge end (transparent) to the arrowhead (white).
 *
 * Re-authored from Figma's filled export as a real stroked, dashed path so it can
 * DRAW on scroll-in (pricing-reveal.tsx animates the brush's stroke-dashoffset;
 * the brush is a fat solid stroke used as a mask that wipes along the path,
 * revealing the dashes, then the arrowhead pops). Default markup is fully drawn —
 * brush offset 0, head opacity 1 — so SSR / no-JS / reduced-motion show the
 * finished arrow with no hidden state; the reveal parks it empty then draws it.
 * Native 338×142 box.
 */
export function ConnectorArrow({
  className,
  ...rest
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 338 142"
      fill="none"
      className={className}
      aria-hidden
      {...rest}
    >
      <defs>
        {/* Soft fade-in at the badge tip only — kept SHORT (fades to solid over
            the first ~14% of the path) so the draw-on reads clearly from the very
            start instead of tracing an invisible transparent lead-in. Everything
            past the badge tip, including the arrowhead, is solid white. */}
        <linearGradient id="pricingArrowFade" x1="2" y1="56" x2="58" y2="25" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0" />
          <stop offset="1" stopColor="white" />
        </linearGradient>
        {/* Draw brush: a fat solid stroke of the same centreline. pathLength=1
            normalises the length so the draw is a simple dashoffset 1→0 wipe. */}
        <mask id="pricingArrowDraw">
          <path
            data-pricing-arrow-brush
            d={CONNECTOR_PATH}
            fill="none"
            stroke="white"
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={0}
          />
        </mask>
      </defs>

      {/* Dashed line — masked by the brush so it appears to draw on. */}
      <path
        d={CONNECTOR_PATH}
        mask="url(#pricingArrowDraw)"
        fill="none"
        stroke="url(#pricingArrowFade)"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeDasharray="1.6 3.4"
      />
      {/* Arrowhead — pops in as the draw lands. */}
      <path data-pricing-arrow-head d={CONNECTOR_HEAD} fill="url(#pricingArrowFade)" />
    </svg>
  );
}
