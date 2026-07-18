/**
 * View-index allocation for the shared canvas planes (Phase 1 of
 * docs/canvas-consolidation-plan.md).
 *
 * drei's <View> renders its scissored viewport in a useFrame at priority = its
 * `index` prop, and the host places a per-view tone-mapping setter at priority
 * `index - 1` (see tone-mapping.tsx). So every index MUST be:
 *   1. UNIQUE per plane — two views at the same index have an undefined render
 *      order and their tone setters collide.
 *   2. SPACED ≥2 apart — leaves room for the `index - 1` setter of the higher
 *      view without landing on the lower view's render slot.
 *
 * These named constants pin the planned occupants so a collision is impossible
 * in practice: pass one of these to `useSharedView`/`<SharedView index={…}>`.
 * The values are spaced by 10 (generous headroom; a plane can hold ~arbitrary
 * views). Phases 2–5 migrate onto exactly these slots.
 */

/** FRONT plane (fixed inset-0, z-[61], pointer-events-none) — effects that sit
 *  ABOVE page content: intro tiles, rock-base clouds, testimonial rocks, footer
 *  glass. */
export const FRONT_INDEX = {
  /** Phase 2 — intro/conveyor tile field. */
  INTRO_TILES: 10,
  /** Phase 4 — rock-base (ROCK_SPECS) clouds welded to the cliff feet. */
  ROCK_CLOUDS: 20,
  /** Phase 5 — footer liquid-glass wordmark. */
  FOOTER_GLASS: 40,
} as const;

/**
 * Phase 3 — testimonial GLB rocks. Kept SEPARATE from FRONT_INDEX because the
 * audit found the rocks can't live on the FRONT plane (they'd cover the section's
 * pull-quote, which renders above them at z-10). They will likely land on a
 * future in-flow "MID" plane; the plane is chosen at the call site (the
 * `plane` arg to useSharedView), so moving them is a one-line change here + there.
 * The index only needs to be unique/spaced ≥2 on whatever plane they end up on.
 */
export const TESTIMONIAL_ROCKS_INDEX = 30;

/** REAR plane (fixed inset-0, -z-10) — effects BEHIND page content but above the
 *  -z-20 DOM sky backdrop: the distant sky clouds. */
export const REAR_INDEX = {
  /** Phase 4 — distant sky (SKY_SPECS) clouds, depth-damped parallax. */
  SKY_CLOUDS: 10,
} as const;
