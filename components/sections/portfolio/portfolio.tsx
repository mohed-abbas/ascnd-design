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
 * came across. Tune presets live in the /lab/cloud-canvas sandbox; the locked
 * portfolio preset (CLOUD_CANVAS_PORTFOLIO_CONFIG) is applied by CloudCanvasScene.
 *
 * Slots between Testimonials and Pricing. Stays TRANSPARENT with z-index at
 * `auto` (below the site's front cloud layer) ON PURPOSE, so the sky/cloud
 * atmosphere reads through the globe.
 *
 * Header (Figma 424:487): the house 49px mixed-font display heading — "stuff
 * we've " (Product Sans Light) + "shipped" (Instrument Serif) — over the shared
 * solid <Button> ("see all work", the exact white-gradient pill from the Figma
 * frame). The header wrapper is pointer-events-none so it never blocks the
 * globe's drag; only the tabs and button re-enable hits. The globe region
 * starts below the header (see cloud-canvas-scene.tsx) so tiles orbit under
 * the heading, and any faded far tile that drifts up passes BEHIND it (header
 * z-10) — the same "content floating among the atmosphere" move as the
 * testimonials quote.
 *
 * FILTER TABS (above the heading): one glass pill segmented control — the
 * navbar's glass recipe (white/10 fill, white/30 hairline, inset sheen,
 * backdrop-blur; blur is safe here, the tabs are a SIBLING of the fixed
 * sky/cloud layers, never an ancestor). Selecting a type re-forms the globe
 * to just that type's projects (cloud-canvas-engine.ts setFilter); "all" is
 * the default. This is why the section is a client component: the tabs and
 * the scene share the filter state.
 */
import { useState } from "react";
import Button from "@/components/ui/button";
import CloudCanvasScene from "./cloud-canvas-scene";
import {
  PROJECT_FILTERS,
  type CloudFilter,
} from "./cloud-canvas/cloud-canvas-data";

export default function Portfolio() {
  const [filter, setFilter] = useState<CloudFilter>("all");

  return (
    <section data-portfolio className="relative min-h-dvh w-full overflow-hidden">
      {/* Section header — filter tabs over the Figma 424:487 heading + button. */}
      <div className="pointer-events-none relative z-10 flex w-full flex-col items-center gap-[25px] pt-[10dvh] max-md:px-6">
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

        <h2 className="text-center text-display font-light leading-[1.1] tracking-[-0.03em] text-white [word-break:break-word]">
          stuff we&apos;ve <span className="font-instrument">shipped</span>
        </h2>
        <Button variant="solid" className="pointer-events-auto">
          see all work
        </Button>
      </div>

      <CloudCanvasScene filter={filter} />
    </section>
  );
}
