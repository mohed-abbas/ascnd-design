import TestimonialRocks from "./testimonial-rocks";
import TestimonialsDrift from "./testimonials-drift";
import { TESTIMONIALS, UNITS } from "./testimonials-data";

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
 * (1239.771 × 595.775, itself centred in the 1512×982 frame). Layers, back→front:
 *   1. <TestimonialRocks/> — the rocks: a 3D GLB canvas on capable devices, a
 *      flat PNG still otherwise.
 *   2. rings + dots (DOM, per unit) — painted ABOVE the rocks so the outline
 *      hoop passes in front of the rock (its z-axis position), not behind it;
 *      the dot revolves via TestimonialsDrift.
 *   3. the quote (on top, always legible)
 *
 * Geometry (UNITS) lives in testimonials-data.ts so the rings here and the rocks
 * in the canvas share one source of truth.
 */
export default function Testimonials() {
  const { quote } = TESTIMONIALS[0];

  return (
    <section
      data-testimonials
      className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden"
    >
      {/* Centre-anchored design block = the Figma TestimonialRocks group. */}
      <div className="relative h-[595.775px] w-[1239.771px]">
        {/* Rocks — 3D GLB canvas (capable devices) or flat PNG fallback.
            Rendered FIRST so the rings below paint on top of it. */}
        <TestimonialRocks />

        {/* Ring outlines + dots — one point-anchored unit each; the dot revolves
            about the centre (TestimonialsDrift). Painted after the rocks so the
            hoop crosses IN FRONT of the rock (its z-position), not behind it. */}
        {UNITS.map((u, i) => (
          <div
            key={i}
            data-tm-unit
            aria-hidden
            className="pointer-events-none absolute"
            style={{ left: u.cx, top: u.cy }}
          >
            <div data-tm-ring className="absolute left-0 top-0 h-0 w-0">
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
          </div>
        ))}

        {/* The pull-quote — centred in the group (box left 120, w 1000). Same
            49px mixed-font heading treatment as the sibling sections. */}
        <div className="absolute left-[120px] top-[244px] w-[1000px] text-center">
          <p
            data-testimonials-quote
            className="relative z-10 text-[49px] font-light leading-[1.1] tracking-[-1.47px] text-white [word-break:break-word]"
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
