import Image from "next/image";
import TestimonialsDrift from "./testimonials-drift";
import { TESTIMONIALS } from "./testimonials-data";

/**
 * Testimonials (Figma node 482:418). A single centred pull-quote floating in
 * open sky, framed by four grey rocks — two large in opposite corners, two
 * small — each encircled by a thin white "orbit" outline with an accent dot.
 *
 * Like every other section it renders at DESIGN SCALE (fixed px, centre-
 * anchored) and stays TRANSPARENT over the global fixed <Background/> (fill →
 * grain → clouds) mounted in layout.tsx. The Figma frame's own #62abff fill,
 * grain and the decorative bottom-left cloud are intentionally NOT reproduced —
 * the shared sky + global cloud layer already provide that atmosphere.
 *
 * The one centre-anchored block is the Figma `TestimonialRocks` group
 * (1239.771 × 595.775, itself centred in the 1512×982 frame).
 *
 * ── UNIT MODEL (the layout is authored for the drift animation) ────────────
 * Each rock + its ring + its dot is ONE co-located "unit", positioned as a
 * zero-size POINT at the shared centre (ring centre from Figma — the rock is
 * ~2px off in the mock; here they share one centre so they stay concentric).
 * Every moving layer is its own point-anchored child so a rotation pivots about
 * that centre, not a box corner:
 *   [data-tm-ring]   — ring outline + dot; rotating it revolves the dot
 *   [data-tm-holder] — the rock's orbit carrier (drift translates it)
 *   [data-tm-spin]   — the rock's self-spin (drift rotates it); the resting
 *                      Figma angle lives on the inner box's static transform
 * At rest (SSR / reduced-motion / low tier) every layer is untouched, so the
 * unit renders at its exact Figma pose. TestimonialsDrift drives the motion.
 *
 * Rocks are bigger than their rings and spill past the outline (as in Figma) —
 * the source PNG is trimmed to the rock silhouette so object-cover fills the box.
 */

type Unit = {
  /** Shared centre of the rock + ring, in the group's px space. */
  cx: number;
  cy: number;
  rock: { w: number; h: number; rotate: number };
  ring: { r: number; stroke: number };
  /** Dot offset from the centre + its radius. */
  dot: { dx: number; dy: number; r: number };
};

// Ring centres = Figma ellipse frame offset (20.28, 17) + each circle's centre;
// dot offsets = dot centre − ring centre. Rocks share the ring centre.
const UNITS: Unit[] = [
  {
    cx: 152.999,
    cy: 101,
    rock: { w: 136.844, h: 168.309, rotate: 60 },
    ring: { r: 73.5, stroke: 1 },
    dot: { dx: 49, dy: -78, r: 6 },
  }, // 0 · large · top-left
  {
    cx: 1133.8,
    cy: 487.555,
    rock: { w: 136.844, h: 168.309, rotate: 135 },
    ring: { r: 73.5, stroke: 1 },
    dot: { dx: -71, dy: -68, r: 6 },
  }, // 1 · large · bottom-right
  {
    cx: 1179.72,
    cy: 54.7432,
    rock: { w: 59.472, h: 73.147, rotate: 135 },
    ring: { r: 31.9429, stroke: 0.434597 },
    dot: { dx: -30.86, dy: -29.5526, r: 2.60758 },
  }, // 2 · small · top-right
  {
    cx: 62.198,
    cy: 487.926,
    rock: { w: 77.517, h: 95.341, rotate: 135 },
    ring: { r: 41.6349, stroke: 0.566462 },
    dot: { dx: 13.7814, dy: -38.519, r: 3.39877 },
  }, // 3 · small · bottom-left
];

export default function Testimonials() {
  const { quote } = TESTIMONIALS[0];

  return (
    <section
      data-testimonials
      className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden"
    >
      {/* Centre-anchored design block = the Figma TestimonialRocks group. */}
      <div className="relative h-[595.775px] w-[1239.771px]">
        {UNITS.map((u, i) => (
          <div
            key={i}
            data-tm-unit
            className="absolute"
            style={{ left: u.cx, top: u.cy }}
          >
            {/* Ring outline + dot — revolve together about the centre. */}
            <div
              data-tm-ring
              aria-hidden
              className="pointer-events-none absolute left-0 top-0 h-0 w-0"
            >
              <span
                className="absolute rounded-full border border-solid border-white"
                style={{
                  left: -u.ring.r,
                  top: -u.ring.r,
                  width: u.ring.r * 2,
                  height: u.ring.r * 2,
                  borderWidth: u.ring.stroke,
                }}
              />
              <span
                className="absolute rounded-full bg-white"
                style={{
                  left: u.dot.dx - u.dot.r,
                  top: u.dot.dy - u.dot.r,
                  width: u.dot.r * 2,
                  height: u.dot.r * 2,
                }}
              />
            </div>

            {/* Rock — holder (orbit) → spin (tumble) → box (resting angle). */}
            <div data-tm-holder className="absolute left-0 top-0 h-0 w-0">
              <div data-tm-spin className="absolute left-0 top-0 h-0 w-0">
                <div
                  className="relative"
                  style={{
                    width: u.rock.w,
                    height: u.rock.h,
                    transform: `translate(-50%, -50%) rotate(${u.rock.rotate}deg)`,
                  }}
                >
                  <Image
                    src="/rocks/testimonial-rock.png"
                    alt=""
                    aria-hidden
                    fill
                    sizes={`${Math.ceil(u.rock.w)}px`}
                    className="select-none object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* The pull-quote — centred in the group (box left 120, w 1000). Same
            49px mixed-font heading treatment as the sibling sections. */}
        <div className="absolute left-[120px] top-[244px] w-[1000px] text-center">
          <p
            data-testimonials-quote
            className="text-[49px] font-light leading-[1.1] tracking-[-1.47px] text-white [word-break:break-word]"
          >
            {quote.map((seg, i) => (
              <span key={i} className={seg.serif ? "font-instrument" : undefined}>
                {seg.text}
              </span>
            ))}
          </p>
        </div>
      </div>

      <TestimonialsDrift />
    </section>
  );
}
