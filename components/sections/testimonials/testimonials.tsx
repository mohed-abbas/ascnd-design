import Image from "next/image";
import TestimonialRings from "./testimonial-rings";
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
 * (1239.771 × 595.775, itself centred in the 1512×982 frame). Every child is
 * pinned by its Figma metric so the rocks stay concentric with their rings.
 *
 * Layout is authored animation-first: each rock is an independently positioned
 * wrapper (transform-free, so a reveal/float can drive its transform) with the
 * static rotation on an inner layer; the rings live in one overlay SVG with a
 * data hook per ring/dot; the quote is one node carrying [data-testimonials-
 * quote]. The reveal itself is added separately.
 */

// Rocks keyed by their CENTRE point in the group's space (so each sits
// concentric with the matching ring in testimonial-rings.tsx), plus the box
// size and static rotation lifted from the Figma instances (482:456–459).
const ROCKS = [
  { cx: 151.0855, cy: 101.3325, w: 136.844, h: 168.309, rotate: 60 }, // large · top-left
  { cx: 1131.8855, cy: 487.8875, w: 136.844, h: 168.309, rotate: 135 }, // large · bottom-right
  { cx: 1178.8855, cy: 54.8875, w: 59.472, h: 73.147, rotate: 135 }, // small · top-right
  { cx: 61.1155, cy: 488.1145, w: 77.517, h: 95.341, rotate: 135 }, // small · bottom-left
] as const;

export default function Testimonials() {
  const { quote } = TESTIMONIALS[0];

  return (
    <section
      data-testimonials
      className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden"
    >
      {/* Centre-anchored design block = the Figma TestimonialRocks group. */}
      <div className="relative h-[595.775px] w-[1239.771px]">
        {/* Rocks — each anchored by its centre (left/top = centre − half-size)
            so the wrapper stays transform-free for animation; rotation is on
            the inner layer. */}
        {ROCKS.map((rock, i) => (
          <div
            key={i}
            data-testimonials-rock={i}
            className="absolute"
            style={{
              left: rock.cx - rock.w / 2,
              top: rock.cy - rock.h / 2,
              width: rock.w,
              height: rock.h,
            }}
          >
            <div
              className="relative size-full"
              style={{ transform: `rotate(${rock.rotate}deg)` }}
            >
              <Image
                src="/rocks/testimonial-rock.png"
                alt=""
                aria-hidden
                fill
                sizes={`${Math.ceil(rock.w)}px`}
                className="select-none object-cover"
              />
            </div>
          </div>
        ))}

        {/* Orbit outlines + dots overlay (482:460), in the group's space. */}
        <TestimonialRings
          data-testimonials-rings
          className="pointer-events-none absolute left-[20.28px] top-[17px] h-[544.555px] w-[1191.602px]"
        />

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
    </section>
  );
}
