/**
 * Single source of truth for the design-shots tiles — shared by BOTH renderers:
 *   • the DOM collage (design-shots.tsx) — the fallback for ineligible sessions
 *     and for returning/mid-page loads where the welcome intro doesn't play;
 *   • the persistent WebGL scene (intro-scene.tsx) — the primary renderer when
 *     the intro plays, where the SAME tile planes scatter behind the glass, fly
 *     onto the arc, then run the conveyor for the rest of the session.
 *
 * Keeping order / identity / arc-slot / scatter in one place is what makes the
 * intro tiles and the necklace arc line up by construction (one definition, not
 * two that must be kept in sync). Pure data — no imports, no framework.
 */

// Render box for every DOM tile = the largest (center) slot, so its inline scale
// is always ≤1 and the source is never upscaled. (WebGL scales unit quads, so it
// doesn't use this — it's the DOM collage's base box.)
export const SHOT_BASE = 261;

// Each tile is a GLASS-MATTED FRAME, not a bare image (Figma node 357:7072): a
// thin liquid-glass mat wraps an inset, rounded shot — styled like the navbar
// "menu" glass (white/30 edge + inset white sheen). Both ratios are constant
// across every tile (Figma insets scale 1:1 with tile size — 6.381/261 =
// 1.858/76 = 2.445%), so they're expressed as a FRACTION of the tile's edge and
// applied by both renderers (the DOM collage + the WebGL necklace).
//   • MAT_RATIO   — mat width (padding between the frame edge and the shot).
//   • RADIUS_RATIO— the Figma-native shot corner (3.829/261). Retained for
//     reference; the shot now shares the frame's corner (SHOT_FRAME_RADIUS)
//     rather than this near-square value — see below.
export const SHOT_MAT_RATIO = 0.0245;
export const SHOT_RADIUS_RATIO = 0.0147;
// The glass frame's corner radius, in px at the BASE box, used by BOTH the outer
// frame AND the shot inside it, so the screenshot's corners round to match the
// frame instead of staying near-square. Authored at BASE and scaled down with
// the tile by both renderers (DOM `borderRadius` + WebGL rounded-alpha/window).
export const SHOT_FRAME_RADIUS = 14;

/**
 * The loop the conveyor rides (size belongs to the SLOT, not the tile). Slots
 * 0..6 are the seven visible arc positions (far-L → far-R). Slot 7 is an
 * off-screen RETURN position above the frame: a true conveyor needs one more
 * slot than the visible count so a tile can travel hidden from far-R back to
 * far-L while all seven visible slots stay filled (no gap). far-R(6) → return(7)
 * → far-L(0) arcs up and over, off-screen, so the wrap is never seen.
 */
export const SHOT_ARC_SLOTS: { x: number; y: number; size: number }[] = [
  { x: -476.5, y: -207.5, size: 76 }, // 0 far-L
  { x: -404, y: -74, size: 117 }, //     1 mid-L
  { x: -253.5, y: 50.5, size: 158 }, //  2 inner-L
  { x: 0, y: 115, size: 261 }, //        3 center
  { x: 253.5, y: 50.5, size: 158 }, //   4 inner-R
  { x: 404, y: -74, size: 117 }, //      5 mid-R
  { x: 476.5, y: -207.5, size: 76 }, //  6 far-R
  { x: 0, y: -480, size: 60 }, //        7 return (off-screen, above the frame)
];

/** Where a tile blooms in during the intro (behind the glass), in the 1920×1080
 *  introV2 design frame: centre offset from the frame centre (+y down) + edge. */
export type ShotScatter = { dx: number; dy: number; size: number };

export type Shot = {
  src: string;
  /** square box size in px at the tile's resting arc slot */
  size: number;
  /** corner radius in px at its resting size */
  radius: number;
  /** resting offset from collage center (px, negative = left/up) */
  x: number;
  y: number;
  /** mirror horizontally (left-side tiles) — fixed per tile, never flips */
  mirror: boolean;
  /** eager-load the largest above-the-fold tile (LCP candidate) */
  priority?: boolean;
  /** ring out from the center (0 = center) — drives the DOM bloom stagger */
  ring: number;
  /** index into SHOT_ARC_SLOTS — the tile's resting slot / conveyor phase, and a
   *  stable UNIQUE key per tile. */
  arc: number;
  alt: string;
  /** intro bloom-in spot behind the glass. Absent on the hidden return tile,
   *  which never flies in — it materialises on the conveyor's return leg. */
  scatter?: ShotScatter;
};

/**
 * The eight tiles, in DOM paint order (center first → out, then the hidden
 * return). `arc` is the unique key + resting slot; `scatter` is the intro spot.
 * Scatter offsets are read from the introV2 Figma frame (node 210:268); the
 * shot↔arc pairing matches the hero necklace exactly (shot2→center, shot8→far-L…).
 */
export const SHOTS: Shot[] = [
  { src: "/shots/shot2.avif", size: 261, radius: 3.84, x: 0, y: 115, mirror: false, ring: 0, arc: 3, priority: true, alt: "", scatter: { dx: -310, dy: 226.5, size: 223 } }, // center / pendant
  { src: "/shots/shot3.avif", size: 158, radius: 2.32, x: 253.5, y: 50.5, mirror: false, ring: 1, arc: 4, alt: "", scatter: { dx: -34.5, dy: -103, size: 158 } }, // inner-R
  { src: "/shots/shot6.avif", size: 158, radius: 2.32, x: -253.5, y: 50.5, mirror: false, ring: 1, arc: 2, alt: "", scatter: { dx: -684.5, dy: -94, size: 158 } }, // inner-L
  { src: "/shots/shot4.avif", size: 117, radius: 1.72, x: 404, y: -74, mirror: false, ring: 2, arc: 5, alt: "", scatter: { dx: 209.5, dy: 211, size: 204 } }, // mid-R
  { src: "/shots/shot7.avif", size: 117, radius: 1.72, x: -404, y: -74, mirror: false, ring: 2, arc: 1, alt: "", scatter: { dx: 417.5, dy: -114, size: 212 } }, // mid-L
  { src: "/shots/shot5.avif", size: 76, radius: 1.12, x: 476.5, y: -207.5, mirror: false, ring: 3, arc: 6, alt: "", scatter: { dx: 762, dy: 231.5, size: 165 } }, // far-R
  { src: "/shots/shot8.avif", size: 76, radius: 1.12, x: -476.5, y: -207.5, mirror: false, ring: 3, arc: 0, alt: "", scatter: { dx: 687.5, dy: -200, size: 76 } }, // far-L
  { src: "/shots/shot9.avif", size: 60, radius: 0.88, x: 0, y: -480, mirror: false, ring: 0, arc: 7, alt: "" }, // return (hidden) — 8th unique shot (TroxEstate) so no image ever repeats on the conveyor
];
