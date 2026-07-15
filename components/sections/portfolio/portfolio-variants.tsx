"use client";

/**
 * PortfolioVariants — swaps the portfolio section between its designs and hosts
 * the selector that toggles them:
 *
 *   • "depth"     — the Codrops depth-gallery port (WebGL fly-through, crossfade).
 *   • "cloudline" — V2: a horizontal drift where stills pass like clouds.
 *   • "sweep" / "punch" / "coverflow" — V3: the depth idea with NO fade (crisp,
 *     depth-buffer occlusion); the active card scales up and leaves frame, in
 *     three arrangements (side-sweep · head-on punch-through · coverflow arc).
 *   • "cloudCanvas" — V4: an image globe (2D canvas, Fibonacci sphere) of the
 *     projects that auto-spins and drags to rotate. Unlike the others it doesn't
 *     pin/scrub; it floats over the sky as an explorable object.
 *
 * The pinned variants share the same `[data-portfolio]` section, but only one is
 * mounted at a time, so their ScrollTriggers never collide — unmounting one kills
 * its pin before the other builds its own (cloudCanvas creates no pin). The
 * selector is a house-glass segmented control (same recipe as the navbar / mode
 * rail) and persists across the swap.
 *
 * Defaults to "cloudCanvas" (V4) for review; flip to compare the rest.
 */
import { useState } from "react";
import PortfolioScene from "./portfolio-scene";
import CloudlineScene from "./cloudline-scene";
import CarouselScene from "./carousel-scene";
import CloudCanvasScene from "./cloud-canvas-scene";

type Variant = "depth" | "cloudline" | "sweep" | "punch" | "coverflow" | "cloudCanvas";

const VARIANTS: Variant[] = ["depth", "cloudline", "sweep", "punch", "coverflow", "cloudCanvas"];

export default function PortfolioVariants() {
  const [variant, setVariant] = useState<Variant>("cloudCanvas");

  const renderVariant = () => {
    switch (variant) {
      case "depth":
        return <PortfolioScene />;
      case "cloudline":
        return <CloudlineScene />;
      case "cloudCanvas":
        return <CloudCanvasScene />;
      default:
        // sweep · punch · coverflow — keyed so a change remounts the engine.
        return <CarouselScene key={variant} mode={variant} />;
    }
  };

  return (
    <>
      <div
        role="group"
        aria-label="Portfolio style"
        className="pointer-events-auto absolute left-1/2 top-[28px] z-[90] flex -translate-x-1/2 items-center gap-[2px] rounded-full border border-white/30 bg-white/10 p-[4px] shadow-[inset_0_0_28.3px_0_rgba(255,255,255,0.25)] backdrop-blur-[10px]"
      >
        {VARIANTS.map((option) => {
          const isActive = option === variant;
          return (
            <button
              key={option}
              type="button"
              onClick={() => setVariant(option)}
              aria-pressed={isActive}
              className={`rounded-full px-[16px] py-[7px] font-mono text-[11px] lowercase tracking-[0.06em] transition-colors duration-200 ${
                isActive ? "bg-white/20 text-white" : "text-white/50 hover:text-white/80"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>

      {renderVariant()}
    </>
  );
}
