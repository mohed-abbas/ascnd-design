"use client";

/**
 * Portfolio section — the cloud-canvas image globe.
 *
 * A 2D-canvas image globe (Fibonacci sphere, hand-rolled 3D projection, no
 * WebGL) of the project stills: it auto-spins, drags to rotate, and click-
 * focuses a tile. Unlike a scroll narrative it does NOT pin or scroll-scrub —
 * it's an explorable object that floats over the shared sky/cloud atmosphere.
 *
 * Ported standalone from the lab/portfolio-V2 variant selector (which also
 * carried the depth-gallery / carousel / cloudline designs); only the globe
 * came across. Tune presets live in the /lab/cloud-canvas sandbox (branch `dev`); the locked
 * portfolio preset (CLOUD_CANVAS_PORTFOLIO_CONFIG) is applied by CloudCanvasScene.
 *
 * Slots between Testimonials and Pricing. Stays TRANSPARENT with z-index at
 * `auto` (below the site's front cloud layer) ON PURPOSE, so the sky/cloud
 * atmosphere reads through the globe.
 *
 * LAYOUT — tabs at the top, heading at the globe's core:
 *
 *   • FILTER TABS sit alone in the top header row: one glass pill segmented
 *     control on the navbar's glass recipe (white/10 fill, white/30 hairline,
 *     inset sheen, backdrop-blur; blur is safe here — the tabs are a SIBLING of
 *     the fixed sky/cloud layers, never an ancestor). Selecting a type re-forms
 *     the globe to just that type's projects (cloud-canvas-engine.ts setFilter);
 *     "all" is the default. This is why the section is a client component: the
 *     tabs and the scene share the filter state.
 *
 *   • The HEADING (Figma 424:487 — the house 49px mixed-font display: "stuff
 *     we've " in Product Sans Light + "shipped" in Instrument Serif) is NOT a
 *     DOM element here. It's drawn by the engine at the globe's core, spliced
 *     into the painter's sort (config.coreLabel → cloud-canvas-engine.ts
 *     render()), so far tiles pass behind it and near tiles pass IN FRONT.
 *     A DOM heading can only sit above the whole canvas or below it — above
 *     made the type cover the portfolio, below let any faded far tile chop the
 *     words. Depth is what's being bought. The <h2> below is the accessible
 *     twin, visually hidden.
 *
 * The tab row is z-10 over the canvas and pointer-events-none, so nothing
 * blocks the globe's drag (only the tabs themselves re-enable hits).
 *
 * (No "see all work" button: the section is the whole body of work.)
 */
import { useState } from "react";
import CloudCanvasScene from "./cloud-canvas-scene";
import {
  PROJECT_FILTERS,
  type CloudFilter,
} from "./cloud-canvas/cloud-canvas-data";

export default function Portfolio() {
  const [filter, setFilter] = useState<CloudFilter>("all");

  return (
    // ASYMMETRIC padding, and the only section that can't just take `py-section`
    // on both sides — because its two edges present very differently:
    //   • BOTTOM: the sphere's lowest tiles run right to the canvas edge, so the
    //     boundary starts at hard imagery. It takes the full `pb-section`, and
    //     Comparison's own `pt-section` completes the house gap.
    //   • TOP: the band already opens with 10dvh of its own sky above the filter
    //     tabs (below), which is part of the same boundary. Only the remainder
    //     is padded here, or the gap coming out of working-with would run to
    //     ~1.5× the house value.
    // Both edges therefore land on the SAME boundary as every other section.
    <section
      id="work"
      data-portfolio
      className="relative w-full overflow-hidden pt-[8dvh] pb-section"
    >
      {/* The GLOBE BAND — an in-flow 100dvh block, and the containing block for
          the absolutely-positioned canvas.

          This exists so the section's bottom padding cannot reach the canvas.
          With `min-h-dvh` + padding on the section itself the padding lands
          INSIDE the 100dvh border box (border-box sizing), so the section never
          grows and the gap never changes; sizing the band explicitly and letting
          the section be content-driven puts the padding genuinely below it. It
          also pins the canvas to exactly 100dvh, which the tuned preset depends
          on — see cloud-canvas-scene.tsx for why a taller canvas would rescale
          the sphere instead of clearing it. */}
      {/* max-md:h-svh — the band must NOT be dynamically sized on a phone.
          `dvh` tracks the URL bar, so scrolling (especially UPWARD, which is
          what re-reveals the bar) changed this band's height mid-scroll, the
          ResizeObserver on the canvas fired, and engine.resize() reassigned
          canvas.width — which CLEARS the backing store. Every URL-bar movement
          therefore cost at least one blank frame, read as the tiles flashing
          and juddering the whole way up. `svh` is the SMALL viewport height:
          fixed, URL-bar-independent, so the band never resizes and the canvas
          is never reallocated during a scroll. Desktop keeps dvh (no URL bar,
          and dvh == svh there anyway). */}
      <div className="relative h-dvh w-full max-md:h-svh">
        {/* Top row — filter tabs only; the heading lives at the globe's core. */}
        <div className="pointer-events-none relative z-10 flex w-full flex-col items-center pt-[10dvh] max-md:px-6">
          <div
            role="group"
            aria-label="Filter projects by type"
            className="pointer-events-auto flex items-center gap-[2px] rounded-full border border-white/30 bg-white/10 p-[4px] shadow-[inset_0_0_18px_0_rgba(255,255,255,0.25)] backdrop-blur-[10px]"
          >
            {PROJECT_FILTERS.map(({ value, label }) => {
              const isActive = value === filter;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  aria-pressed={isActive}
                  className={`rounded-full px-5 py-[7px] text-[14px] lowercase leading-none transition-colors duration-300 max-md:px-3.5 max-md:text-[13px] ${
                    isActive
                      ? "bg-white/25 text-white"
                      : "text-white/60 hover:text-white/90"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* The VISIBLE heading is painted by the engine (config.coreLabel), not
            by this element — that's the only way to get a tile in front of the
            type on its near pass and behind it on the far pass. Canvas text is
            invisible to screen readers and crawlers, so the real <h2> stays here,
            same words, visually hidden. Keep the two in sync. */}
        <h2 className="sr-only">stuff we&apos;ve shipped</h2>

        <CloudCanvasScene filter={filter} />
      </div>
    </section>
  );
}
