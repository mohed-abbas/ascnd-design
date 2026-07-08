/**
 * Single source of truth for the project-showcase wheel — Figma node 435:515
 * ("SectionProjectShowcase", the "stuff we've shipped" section).
 *
 * THE MECHANISM (see docs/portfolio-showcase-research.md): the cards are NOT
 * placed by hand-authored x/y. They are all stacked at ONE point and each is
 * rotated by `(index − REST_CENTER_INDEX) × ANGULAR_STEP` degrees around a pivot
 * placed PIVOT_DISTANCE px BELOW the card centre. Because that radius is huge, the
 * top few cards spread into the shallow fanned arc of the Figma final state
 * (centre upright, neighbours ±8°, outer pair ±16°, the rest swung off-screen and
 * down). Geometry lives here once; a future animation can reuse it by rotating the
 * shared parent, but the current section is the STATIC arc only.
 *
 * Derivation of the constants from the Figma coordinates (frame 1512×982):
 *   inner cards sit ±387px from centre and read as ~8° tilt,
 *   outer cards sit ±756px and read as ~16° tilt.
 *   For a wheel, horizontal offset = R·sin(θ):
 *     387 / sin(8°)  ≈ 2781      756 / sin(16°) ≈ 2743   → R ≈ 2760px.
 * So ANGULAR_STEP = 8° and PIVOT_DISTANCE = 2760px reproduce the arc by pure
 * rotation. (The Figma y-drops are wrapper-bounding-box artifacts; the true
 * circle — y = R·(1−cosθ) — is used instead so the arc is geometrically exact.)
 *
 * Pure data + numbers — no imports, no framework.
 */

// ── Card geometry (Figma node 435:526) ──────────────────────────────────────
/** Card box, px at the base frame (1512×982), before its arc rotation. */
export const CARD_WIDTH = 296;
export const CARD_HEIGHT = 424;
/** Corner radius + white hairline border of the card (Figma). */
export const CARD_RADIUS = 20;
export const CARD_BORDER = 1.5;
/** Gap between the card and its caption (Figma: 440 − 424). */
export const CAPTION_GAP = 16;

// ── Wheel geometry ──────────────────────────────────────────────────────────
/** Degrees between adjacent cards around the wheel. */
export const ANGULAR_STEP = 8;
/** Distance (px) from a card's centre down to the shared rotation pivot. */
export const PIVOT_DISTANCE = 2760;

// ── The logical frame the section is composed in (like the hero) ────────────
/** Design frame; everything is positioned in these px then centred in the viewport. */
export const FRAME_WIDTH = 1512;
export const FRAME_HEIGHT = 982;
/** The wheel's resting point — where the upright centre card's CENTRE sits.
 *  x = frame centre; y = Figma centre-card centre (group top 130 + card half 212). */
export const WHEEL_POINT_X = FRAME_WIDTH / 2; // 756
export const WHEEL_POINT_Y = 342;
/** The section caption block ("stuff we've shipped" + CTA) — centred, lower third
 *  (Figma node 435:521: group-relative top 610 → frame 740). */
export const CAPTION_TOP = 740;

/**
 * The wheel's shared rotation pivot, in FRAME px — directly below the visible
 * arc. This is the same point the DOM cards rotate around (their transform-origin
 * is `CARD_WIDTH/2px  CARD_HEIGHT/2 + PIVOT_DISTANCE px`, which resolves to this
 * frame point). Exported so the WebGL wheel (showcase-canvas.tsx) fans its card
 * planes around the EXACT same pivot, keeping the two renderers pixel-aligned.
 */
export const WHEEL_PIVOT_X = WHEEL_POINT_X; // 756
export const WHEEL_PIVOT_Y = WHEEL_POINT_Y + PIVOT_DISTANCE; // 342 + 2760 = 3102
/** Distance from the pivot up to a card's centre — i.e. the wheel radius (px). */
export const WHEEL_RADIUS = PIVOT_DISTANCE; // 2760

// ── Projects ─────────────────────────────────────────────────────────────────
export type Project = {
  /** Stable unique id / React key. */
  id: string;
  /** Card title shown under the card. */
  title: string;
  /** Small glass tag pills under the title. */
  tags: string[];
  /** Local image (public/showcase/*). PLACEHOLDERS for now — real work later. */
  src: string;
};

/** Cycle the 5 downloaded Figma gradient placeholders across the slots. */
const PLACEHOLDERS = [
  "/showcase/placeholder-1.jpg",
  "/showcase/placeholder-2.jpg",
  "/showcase/placeholder-3.jpg",
  "/showcase/placeholder-4.jpg",
  "/showcase/placeholder-5.jpg",
];

/**
 * 12 projects (placeholder content). Order = wheel order, far-left → far-right.
 */
export const PROJECTS: Project[] = Array.from({ length: 12 }, (_, i) => ({
  id: `project-${i + 1}`,
  title: `Project ${i + 1}`,
  tags: ["brand", "web"],
  src: PLACEHOLDERS[i % PLACEHOLDERS.length],
}));

// ── Resting arc ──────────────────────────────────────────────────────────────
/**
 * Which card is upright at the top of the wheel at rest. Chosen mid-array so the
 * static arc is symmetric — two cards off each edge, five visible.
 * (Animation was reverted 2026-07-08; the sweep/reveal constants that lived here
 * are gone — this is the static structure only.)
 */
export const REST_CENTER_INDEX = Math.floor(PROJECTS.length / 2); // 6

/** Resting rotation (deg) for card `index`: 0 = upright centre, ± = fanned out. */
export function cardAngle(index: number): number {
  return (index - REST_CENTER_INDEX) * ANGULAR_STEP;
}
