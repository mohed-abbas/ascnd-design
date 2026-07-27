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
// BLEED. The layer extends 10lvh PAST the viewport at both ends (see the render
// below), so the stops are remapped from 0/55/100 onto that taller box: with a
// 100lvh viewport the box is 120lvh and the visible slice runs 10→110, i.e.
// 8.333%→91.667%. Those three numbers are the original 0/55/100 measured in the
// new box, so the gradient INSIDE the viewport is pixel-identical to before.
// Past the end stops a CSS gradient clamps to its end colour, which is exactly
// what the bleed wants: solid --sky-top above, solid --sky-bottom below, each
// continuing the edge it adjoins.
const SKY_GRADIENT =
  "linear-gradient(to bottom, var(--sky-top, #4a9dff) 8.333%, var(--sky-mid, #62abff) 54.167%, var(--sky-bottom, #9cc9ff) 91.667%)";

export default function Background() {
  return (
    <div
      aria-hidden
      // BLEEDS 10lvh past the viewport at top AND bottom, rather than sitting
      // flush at inset-0.
      //
      // A fixed layer at inset-0 is only as tall as the LAYOUT viewport, and on
      // iOS the page is painted edge-to-edge behind the translucent browser
      // chrome — so the strip under the toolbar isn't covered by this element at
      // all, and what shows there is the page canvas (body's flat --sky-mid):
      // no gradient, no grain. Measured off a device screenshot, the strip read
      // #5ba8fc–#6eb0fd against #a5cdf9 for the real sky directly above it —
      // i.e. --sky-mid where --sky-bottom belonged. `min-h-[100lvh]` was tried
      // first and does NOT fix it: the box already resolves to about that, and
      // the uncovered strip is BELOW it.
      //
      // Bleeding past both edges sidesteps the question of exactly how big the
      // viewport is at any moment: there is simply more sky than viewport in
      // every direction, so no chrome position can expose the canvas. The
      // gradient stops above are remapped to keep the visible slice identical,
      // and the grain child spans the bleed with it. Desktop: the bleed is
      // off-screen and nothing changes.
      className="pointer-events-none fixed inset-x-0 top-[-10lvh] bottom-[-10lvh] -z-20 bg-[#62abff]"
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
