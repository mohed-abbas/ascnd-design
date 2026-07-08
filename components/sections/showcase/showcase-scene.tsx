"use client";

import dynamic from "next/dynamic";
import Button from "@/components/ui/button";
import ShowcaseCard from "./showcase-card";
import ShowcaseScroll from "./showcase-scroll";
import { useHydrated, useWebglEligible } from "@/lib/perf/use-webgl-eligible";
import {
  cardAngle,
  CAPTION_TOP,
  CARD_HEIGHT,
  CARD_WIDTH,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  PIVOT_DISTANCE,
  PROJECTS,
  REST_CENTER_INDEX,
  WHEEL_POINT_X,
  WHEEL_POINT_Y,
} from "./showcase-spec";

// The WebGL wheel is client-only; ssr:false must live in a Client Component
// (Next disallows it in Server Components).
const ShowcaseCanvas = dynamic(() => import("./showcase-canvas"), { ssr: false });

// The DOM card's rotation pivot, in its own box coords — what fans each card
// onto the arc (identical to the WebGL wheel's pivot, in frame coords).
const CARD_ORIGIN = `${CARD_WIDTH / 2}px ${CARD_HEIGHT / 2 + PIVOT_DISTANCE}px`;

/**
 * The composed showcase: the fanned cards + the heading/CTA caption, and — on
 * capable devices — the WebGL wheel that takes over the card IMAGES.
 *
 * Owns the single eligibility decision (shared gate: WebGL · not reduced-motion ·
 * > 768px), so the DOM fan and the canvas can never disagree:
 * - Ineligible / SSR / no-JS / mobile / reduced-motion → the DOM fan renders its
 *   image chrome (the existing static arc) — the fallback, server-rendered.
 * - Eligible (after hydration) → the DOM cards drop their image chrome
 *   (`imageHidden`) but KEEP their captions in place, and the WebGL canvas draws
 *   the images over them, fanned around the same pivot.
 *
 * The canvas fills the whole SECTION (not the 1512 frame) so card overflow past
 * the frame shows exactly as the DOM fan's does. It's transparent, so the sky
 * shows through and the captions below the cards composite under it.
 *
 * `[data-showcase-*]` hooks are kept for the motion phases; the heading keeps its
 * per-word blur-rise reveal (showcase-reveal.tsx).
 */
export default function ShowcaseScene() {
  const eligible = useWebglEligible();
  const hydrated = useHydrated();
  const webglOn = hydrated && eligible;

  return (
    <>
      {webglOn && (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <ShowcaseCanvas />
          </div>
          {/* Pins the section + scrubs the wheel's rotation; renders nothing. */}
          <ShowcaseScroll />
        </>
      )}

      <div className="relative" style={{ width: FRAME_WIDTH, height: FRAME_HEIGHT }}>
        {/* The wheel — a group of cards fanned around the shared pivot. */}
        <div data-showcase-wheel className="absolute inset-0">
          {PROJECTS.map((project, i) => (
            <div
              key={project.id}
              data-showcase-card
              data-index={i}
              className="absolute"
              style={{
                left: WHEEL_POINT_X,
                top: WHEEL_POINT_Y,
                marginLeft: -CARD_WIDTH / 2,
                marginTop: -CARD_HEIGHT / 2,
                transformOrigin: CARD_ORIGIN,
                transform: `rotate(${cardAngle(i)}deg)`,
              }}
            >
              <ShowcaseCard
                project={project}
                priority={i === REST_CENTER_INDEX}
                imageHidden={webglOn}
              />
            </div>
          ))}
        </div>

        {/* Caption + CTA (Figma node 435:521) — centred, lower third. */}
        <div
          className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-[25px]"
          style={{ top: CAPTION_TOP, width: 344 }}
        >
          {/* Split into per-word movers for the blur-rise reveal (each word
              rises, fades in, and clears from a soft blur — same as the hero /
              why-stay headings). No overflow clip: a hard mask would shear the
              blur halo. A visually-hidden copy carries the real reading text so
              the split markup stays accessible. */}
          <h2
            data-showcase-heading
            className="text-center text-[49px] leading-[1.1] font-light text-white"
            style={{ letterSpacing: "-1.47px" }}
          >
            <span className="sr-only">stuff we&apos;ve shipped</span>
            <span
              data-showcase-word
              aria-hidden
              className="inline-block will-change-transform"
            >
              stuff
            </span>
            <span aria-hidden className="inline-block whitespace-pre">
              {" "}
            </span>
            <span
              data-showcase-word
              aria-hidden
              className="inline-block will-change-transform"
            >
              we&apos;ve
            </span>
            <span aria-hidden className="inline-block whitespace-pre">
              {" "}
            </span>
            <span
              data-showcase-word
              aria-hidden
              className="inline-block font-instrument will-change-transform"
            >
              shipped
            </span>
          </h2>
          {/* Shared site CTA (components/ui/button) — solid variant matches the
              Figma pill and carries the standard hover aura. */}
          <Button variant="solid" href="#" className="whitespace-nowrap">
            see all work
          </Button>
        </div>
      </div>
    </>
  );
}
