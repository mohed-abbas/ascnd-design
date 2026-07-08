import Button from "@/components/ui/button";
import ShowcaseCard from "./showcase-card";
import ShowcaseReveal from "./showcase-reveal";
import {
  cardAngle,
  CARD_HEIGHT,
  CARD_WIDTH,
  CAPTION_TOP,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  PIVOT_DISTANCE,
  PROJECTS,
  REST_CENTER_INDEX,
  WHEEL_POINT_X,
  WHEEL_POINT_Y,
} from "./showcase-spec";

/**
 * "stuff we've shipped" — the project-showcase wheel (Figma node 435:515).
 * See docs/portfolio-showcase-research.md for the full architecture.
 *
 * The cards + CTA are static; the HEADING has a per-word blur-rise reveal on
 * scroll (showcase-reveal.tsx), matching the why-stay heading. The wheel
 * scroll/load animation was reverted (2026-07-08) and will be redefined.
 *
 * Everything is composed in a centred FRAME_WIDTH×FRAME_HEIGHT logical frame (the
 * same absolute-px approach as the hero), so the arc pixel-matches the Figma.
 *
 * The wheel: every card box is centred on the same point (WHEEL_POINT), then
 * rotated around a pivot PIVOT_DISTANCE px below that centre — the huge radius
 * fans the top few cards into the shallow arc (centre upright, ±8°, ±16°). The
 * inline `transform` IS the layout (no-JS safe, no flash). `[data-showcase]` /
 * `[data-showcase-wheel]` / `[data-showcase-card]` are stable hooks left for the
 * future animation.
 */

// The rotation pivot relative to a single card's own box (centre-x, centre-y +
// distance) — what fans each card onto the arc.
const CARD_ORIGIN = `${CARD_WIDTH / 2}px ${CARD_HEIGHT / 2 + PIVOT_DISTANCE}px`;

export default function Showcase() {
  return (
    <section
      data-showcase
      className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden"
    >
      {/* Heading per-word blur-rise reveal on scroll; renders nothing. */}
      <ShowcaseReveal />
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
              <ShowcaseCard project={project} priority={i === REST_CENTER_INDEX} />
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
    </section>
  );
}
