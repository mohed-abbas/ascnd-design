/**
 * Testimonials geometry + copy (Figma node 482:418).
 *
 * GEOMETRY (UNITS) — shared by the server section (rings/dots + flat fallback
 * rocks) and the client 3D rock canvas, so they stay in one place. The block is
 * the Figma `TestimonialRocks` group; every unit is a rock + its ring + its dot
 * sharing one centre (the ring centre = Figma ellipse frame offset (20.28,17) +
 * each circle's centre; dot offset = dot centre − ring centre; rocks share the
 * ring centre). `size` is the rock's intended on-screen footprint in px — the
 * rock overflows its ring as in the mock (~1.36× the ring diameter).
 *
 * COPY (TESTIMONIALS) — a quote is a list of segments so the mixed-font accent
 * (`already raised` in Instrument Serif) survives as structured data and the
 * section can later cycle several quotes with one renderer.
 */

/** The Figma TestimonialRocks group bounds — the centre-anchored design block. */
export const GROUP_W = 1239.771;
export const GROUP_H = 595.775;

/**
 * The Figma rock box is narrower than its ring, but the design's rock art bleeds
 * past the outline on every side. The flat fallback fills a box scaled by this
 * so it overflows the ring like the mock; the 3D rocks use each unit's `size`.
 */
export const ROCK_SCALE = 1.34;

export type Unit = {
  /** Shared centre of the rock + ring, in the group's px space. */
  cx: number;
  cy: number;
  /** Rock's on-screen footprint (px) — sized to overflow the ring. */
  size: number;
  rock: { w: number; h: number; rotate: number };
  ring: { r: number; stroke: number };
  /** Dot offset from the centre + its radius. */
  dot: { dx: number; dy: number; r: number };
};

export const UNITS: Unit[] = [
  {
    cx: 152.999,
    cy: 101,
    size: 200,
    rock: { w: 136.844, h: 168.309, rotate: 60 },
    ring: { r: 73.5, stroke: 1 },
    dot: { dx: 49, dy: -78, r: 6 },
  }, // 0 · large · top-left
  {
    cx: 1133.8,
    cy: 487.555,
    size: 200,
    rock: { w: 136.844, h: 168.309, rotate: 135 },
    ring: { r: 73.5, stroke: 1 },
    dot: { dx: -71, dy: -68, r: 6 },
  }, // 1 · large · bottom-right
  {
    cx: 1179.72,
    cy: 54.7432,
    size: 90,
    rock: { w: 59.472, h: 73.147, rotate: 135 },
    ring: { r: 31.9429, stroke: 0.434597 },
    dot: { dx: -30.86, dy: -29.5526, r: 2.60758 },
  }, // 2 · small · top-right
  {
    cx: 62.198,
    cy: 487.926,
    size: 116,
    rock: { w: 77.517, h: 95.341, rotate: 135 },
    ring: { r: 41.6349, stroke: 0.566462 },
    dot: { dx: 13.7814, dy: -38.519, r: 3.39877 },
  }, // 3 · small · bottom-left
];

export type QuoteSegment = {
  text: string;
  /** Render this run in the Instrument Serif accent face. */
  serif?: boolean;
};

export type Testimonial = {
  id: string;
  quote: QuoteSegment[];
};

export const TESTIMONIALS: Testimonial[] = [
  {
    id: "already-raised",
    quote: [
      { text: "“they made us look like a company that " },
      { text: "already raised", serif: true },
      { text: ", three weeks before we pitched.”" },
    ],
  },
];
