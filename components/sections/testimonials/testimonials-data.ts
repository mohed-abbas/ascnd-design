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

/**
 * Reveal choreography — shared by the 3D rocks (canvas) and the DOM rings so
 * they stay in lockstep across the two render systems. The rocks FLY IN from
 * off-screen: each starts at base × `flyFactor` (well outside the viewport,
 * along its own outward radial → the four arrive from four directions) and eases
 * to its home position over `flyDur`, staggered by `flyStagger`. Once a rock
 * lands, its ring draws in around it (`ringDelay` = that rock's landing time).
 * Both sides start from ONE shared signal (testimonials-reveal.ts), so identical
 * timing here === visual sync.
 *
 * These are the tunable knobs: `flyFactor` sets how far off-screen (and thus how
 * much on-screen travel you see — smaller = the rock enters closer to home);
 * `flyEase`/`flyDur` shape the landing.
 */
export const REVEAL = {
  /** Rock fly-in start position = base × flyFactor (off-screen), tween → base. */
  flyFactor: 3.5,
  flyDur: 0.85,
  flyEase: "power3.out",
  flyStagger: 0.08,
  ringDur: 0.5,
  ringEase: "back.out(1.8)",
  /** When rock i launches, relative to the shared reveal start (secs). */
  flyDelay: (i: number) => REVEAL.flyStagger * i,
  /** When ring i draws in — just after rock i lands. */
  ringDelay: (i: number) => REVEAL.flyDelay(i) + REVEAL.flyDur + 0.05,
} as const;

export type Unit = {
  /** Shared centre of the rock + ring, in the group's px space. */
  cx: number;
  cy: number;
  /**
   * Below md the 1239px group is ~3× the phone width, so the four rocks are
   * re-anchored to frame the (independently reflowed) portrait quote: `mx`/`my`
   * are the unit's mobile centre as CSS lengths relative to the section-filling
   * block (percent → robust across phone sizes), and `ms` scales the whole unit
   * (rock + ring) down so it reads as a corner accent. Switched in under md via
   * CSS vars (testimonials.tsx / testimonial-rocks.tsx), the pills-data pattern —
   * both the rock and its ring read the same trio so they stay concentric.
   */
  mx: string;
  my: string;
  ms: number;
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
    mx: "18%",
    my: "18%",
    ms: 0.5,
    size: 200,
    rock: { w: 136.844, h: 168.309, rotate: 60 },
    ring: { r: 73.5, stroke: 1 },
    dot: { dx: 49, dy: -78, r: 6 },
  }, // 0 · large · top-left
  {
    cx: 1133.8,
    cy: 487.555,
    mx: "82%",
    my: "82%",
    ms: 0.5,
    size: 200,
    rock: { w: 136.844, h: 168.309, rotate: 135 },
    ring: { r: 73.5, stroke: 1 },
    dot: { dx: -71, dy: -68, r: 6 },
  }, // 1 · large · bottom-right
  {
    cx: 1179.72,
    cy: 54.7432,
    mx: "84%",
    my: "14%",
    ms: 0.8,
    size: 90,
    rock: { w: 59.472, h: 73.147, rotate: 135 },
    ring: { r: 31.9429, stroke: 0.434597 },
    dot: { dx: -30.86, dy: -29.5526, r: 2.60758 },
  }, // 2 · small · top-right
  {
    cx: 62.198,
    cy: 487.926,
    mx: "16%",
    my: "86%",
    ms: 0.8,
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

/** Seconds each quote holds before cycling to the next (quote-reveal driver). */
export const QUOTE_CYCLE_SECS = 2.5;

/**
 * The rotating pull-quotes. SSR renders [0]; the quote-reveal driver then
 * cycles through the rest every QUOTE_CYCLE_SECS with the shared word-by-word
 * blur-rise. Varied lengths on purpose (one-liners to three-liners) so the
 * rotation doesn't read as a template.
 */
export const TESTIMONIALS: Testimonial[] = [
  {
    id: "already-raised",
    quote: [
      { text: "“they made us look like a company that " },
      { text: "already raised", serif: true },
      { text: ", three weeks before we pitched.”" },
    ],
  },
  {
    id: "investors-asked",
    quote: [
      { text: "“our investors asked who did the rebrand. " },
      { text: "twice", serif: true },
      { text: ".”" },
    ],
  },
  {
    id: "stopped-explaining",
    quote: [
      { text: "“we stopped explaining the product in meetings, the new site " },
      { text: "does it for us", serif: true },
      { text: ", better than we ever did.”" },
    ],
  },
  {
    id: "first-draft",
    quote: [
      { text: "“the first draft looked better than what our old agency shipped after " },
      { text: "six weeks", serif: true },
      { text: " and three kickoff calls.”" },
    ],
  },
  {
    id: "design-on-tap",
    quote: [
      { text: "“it’s design " },
      { text: "on tap", serif: true },
      { text: ". we open the tap, things ship.”" },
    ],
  },
  {
    id: "same-week",
    quote: [
      { text: "“same-week turnarounds, every single week. i still don’t know " },
      { text: "how they do it", serif: true },
      { text: ".”" },
    ],
  },
  {
    id: "paused-came-back",
    quote: [
      { text: "“we paused over the summer, came back in september, and it felt like they’d " },
      { text: "never left", serif: true },
      { text: ". zero friction, zero re-onboarding.”" },
    ],
  },
  {
    id: "conversion-doubled",
    quote: [
      { text: "“conversion " },
      { text: "doubled", serif: true },
      { text: " the week the new landing page went live.”" },
    ],
  },
];
