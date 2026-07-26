"use client";

/**
 * CloudCanvasScene — the portfolio `cloudCanvas` variant: the image globe as a
 * project showcase. Mounts the reusable CloudCanvasView with the locked preset
 * (CLOUD_CANVAS_PORTFOLIO_CONFIG, tuned in app/lab/cloud-canvas on branch `dev`) and real project
 * imagery, filling the shared [data-portfolio] section.
 *
 * Loaded via next/dynamic({ ssr:false }) — the 2D canvas + image decode are
 * browser-only (a Server Component can't set ssr:false), mirroring the other
 * variants. Stays TRANSPARENT over the global sky/cloud layers like the rest of
 * the section, so the globe floats over the real atmosphere here (unlike the lab,
 * which paints its own flat sky).
 *
 * Unlike the depth/carousel variants it does NOT pin or scroll-scrub: the globe is
 * an explorable object, not a scroll narrative. It auto-spins, drags to rotate, and
 * click-focuses a tile. Wheel-zoom is OFF (wheelZoom={false}) so the wheel scrolls
 * the page normally instead of being trapped by the canvas.
 */
import dynamic from "next/dynamic";
import { CLOUD_CANVAS_PORTFOLIO_CONFIG } from "./cloud-canvas/cloud-canvas-config";
import type { CloudFilter } from "./cloud-canvas/cloud-canvas-data";

const CloudCanvasView = dynamic(() => import("./cloud-canvas/cloud-canvas-view"), {
  ssr: false,
});

export default function CloudCanvasScene({
  filter = "all",
}: {
  /** Type filter owned by the section's tabs (portfolio.tsx). */
  filter?: CloudFilter;
}) {
  return (
    // Full-bleed ON PURPOSE — the canvas is the drawing surface, so an inset
    // region would hard-clip tiles at its own edge. Header clearance comes from
    // the preset's centerY/zoom instead (cloud-canvas-config.ts): the orbit
    // centre sits lower in the full-height canvas, and any far tile that still
    // reaches up fades behind the z-10 header like the rest of the atmosphere.
    <div className="absolute inset-0">
      {/* The edge fade lives IN the engine (config.edgeFade): tiles dissolve
          into the sky as they rise toward the header — the pills section's
          edge-mask device, but composited in-canvas. The old CSS mask-image on
          this canvas forced a per-frame full-screen mask pass (the layer's
          contents change every frame, so nothing was cacheable). */}
      {/* initFrom: hold the 28-image (1.44MB) fetch + decode until the pinned
          WhyStay reel has released. The view's near-view observer arms 1000px
          ahead of this canvas, and with the portfolio section sitting before
          Comparison that reach lands inside the WhyStay pin — the page's
          heaviest scroll moment — so the two would compete.

          [data-pills], NOT [data-whystay]: Pills is the first section AFTER the
          pin, so reaching its top (5260) means the pin has just released — but
          unlike WhyStay it isn't pinned itself, so the trigger resolves against
          plain document flow no matter when it's created. Pointing at the
          pinned section does work today; this just doesn't depend on pin
          re-measurement from a next/dynamic'd trigger created out of page
          order. Homepage-specific by nature, which is why it's passed here
          rather than baked into the reusable view. */}
      <CloudCanvasView
        config={CLOUD_CANVAS_PORTFOLIO_CONFIG}
        filter={filter}
        wheelZoom={false}
        initFrom="[data-pills]"
        className="block h-full w-full"
      />
    </div>
  );
}
