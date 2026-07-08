/**
 * Global site-wide sky backdrop: one fixed layer of solid fill + grain.
 * Mounted once at the root (layout.tsx).
 *
 * The volumetric clouds are a SEPARATE sibling layer (<CloudLayer/>, also
 * mounted at the root) so they can be z-stacked and toggled independently of
 * the sky — this backdrop sits at -z-20, the clouds at -z-10, content above.
 *
 * IMPORTANT: must have no `filter`/`backdrop-filter` ancestor — that breaks
 * `position: fixed` descendants (see docs/cloud-rendering-research.md §4).
 */

// The film-grain — an inline SVG feTurbulence data-URI (~0.8K in the bundle,
// ZERO network requests), so the grain paints with the very first render even
// on a 3G cold load. Replaces textures/grain.png (514K): noise is pure entropy
// and resisted every codec, and as the last heavy texture on the critical path
// it cost ~2.5s of 3G bandwidth. Parameters (baseFrequency .55, 2 octaves,
// 2.4x contrast, saturate 0) were visually matched against grain.png at 10%
// opacity over the sky blue — variant "A" of the side-by-side. stitchTiles
// makes the 256px tile seamless. The PNG stays in the repo as the reference
// for now. NOTE: this is a static background image — the filter rasterizes
// once, no per-frame cost, so the heavy-effect contract doesn't apply.
// (Grain currently disabled — see the commented overlay in the JSX below.)
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%27256%27%20height%3D%27256%27%3E%3Cfilter%20id%3D%27n%27%3E%3CfeTurbulence%20type%3D%27fractalNoise%27%20baseFrequency%3D%270.55%27%20numOctaves%3D%272%27%20stitchTiles%3D%27stitch%27%2F%3E%3CfeColorMatrix%20type%3D%27saturate%27%20values%3D%270%27%2F%3E%3CfeComponentTransfer%3E%3CfeFuncR%20type%3D%27linear%27%20slope%3D%272.4%27%20intercept%3D%27-0.7%27%2F%3E%3CfeFuncG%20type%3D%27linear%27%20slope%3D%272.4%27%20intercept%3D%27-0.7%27%2F%3E%3CfeFuncB%20type%3D%27linear%27%20slope%3D%272.4%27%20intercept%3D%27-0.7%27%2F%3E%3CfeFuncA%20type%3D%27linear%27%20slope%3D%271.4%27%20intercept%3D%270%27%2F%3E%3C%2FfeComponentTransfer%3E%3C%2Ffilter%3E%3Crect%20width%3D%27256%27%20height%3D%27256%27%20filter%3D%27url%28%23n%29%27%2F%3E%3C%2Fsvg%3E\")";

// Vertical sky gradient built from the theme-mode CSS variables (--sky-*), which
// ThemeDriver sets inline on <html> per mode (and tweens on a switch). Each var
// carries a DAY fallback, so the gradient renders the brand sky even before JS
// runs (or if the globals.css [data-mode] rule isn't loaded) — it must never be
// varless/blank. The solid `bg-[#62abff]` beneath is a last-ditch floor so the
// sky can never fall through to black. The `mid` stop at 55% keeps the warm
// `bottom` band reading as a lower-viewport horizon glow for sunrise/sunset.
const SKY_GRADIENT =
  "linear-gradient(to bottom, var(--sky-top, #4a9dff) 0%, var(--sky-mid, #62abff) 55%, var(--sky-bottom, #9cc9ff) 100%)";

export default function Background() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-20 bg-[#62abff]"
      style={{ backgroundImage: SKY_GRADIENT }}
    >
      {/* Grain — 256px seamless noise tile above the fill. Opacity is per-MODE
          (--grain-opacity, set/tweened by ThemeDriver from PALETTES[mode].grain);
          the 0.1 fallback is the day baseline for pre-JS / no-JS. */}
      <div
        className="absolute inset-0 bg-[length:256px_256px] bg-left-top"
        style={{ backgroundImage: GRAIN, opacity: "var(--grain-opacity, 0.1)" }}
      />
    </div>
  );
}
