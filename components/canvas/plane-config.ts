/**
 * Plane config table — the SINGLE source of truth for the shared-canvas planes
 * (Phase 1 of docs/canvas-consolidation-plan.md).
 *
 * A "plane" is one GL context = one slot in the page's stacking order. Effects
 * straddle page content, so it can't be one canvas — it's one canvas PER Z-PLANE.
 * Everything else in components/canvas/ derives from this table: PlaneName is its
 * keys, the registry builds one store per entry, and the host reads the
 * positioning + GL flags here. Adding a plane later (e.g. the Phase-3 "MID"
 * in-flow band for the testimonial rocks — they can't live on FRONT because the
 * section's pull-quote renders above them at z-10) is a single additive entry;
 * nothing hard-codes the "front" | "rear" union outside this file + types
 * derived from it.
 *
 * ── GL FLAGS ARE PER-PLANE (open decision, values are today's) ───────────────
 * antialias + powerPreference are CONTEXT-CREATION flags (fixed for the life of
 * the context), and the future FRONT tenants disagree: the intro glass measured
 * antialias:false + powerPreference:"high-performance"; the clouds currently run
 * antialias:true + the default powerPreference. That conflict is UNRESOLVED — it
 * gets settled when Phase 2/4 actually co-mount on FRONT. For now FRONT takes the
 * intro's flags (its migration is Phase 2, first) and REAR (clouds only) takes
 * antialias:false too; flip a value here when the decision lands — a one-liner.
 */

export interface PlaneConfig {
  /** Stacking order of the fixed <Canvas> (inline zIndex — R3F sets inline
   *  styles on its container that would override a className, so positioning
   *  goes through `style`, mirroring cloud-canvas.tsx). */
  readonly zIndex: number;
  /** Hit-testing: "none" so scroll/clicks pass through to page DOM. Set "auto"
   *  per-plane once a tenant needs drei View picking (Phase-3 rock hover-dodge). */
  readonly pointerEvents: "none" | "auto";
  /** GL `antialias` (context-creation flag — see the note above). */
  readonly antialias: boolean;
  /** GL `powerPreference` (context-creation flag). */
  readonly powerPreference: WebGLPowerPreference;
}

export const PLANE_CONFIG = {
  /** FRONT — above page content: intro tiles, rock-base clouds, footer glass
   *  (testimonial rocks likely move to a future MID plane, not here). z 61
   *  matches today's rock-cloud layer; pointer-events none in Phase 1 (drei View
   *  picking for the rocks' hover-dodge is enabled per-plane when Phase 3 lands). */
  front: {
    zIndex: 61,
    pointerEvents: "none",
    antialias: false,
    powerPreference: "high-performance",
  },
  /** REAR — behind page content, above the -z-20 DOM sky backdrop: distant sky
   *  clouds. */
  rear: {
    zIndex: -10,
    pointerEvents: "none",
    antialias: false,
    powerPreference: "default",
  },
} as const satisfies Record<string, PlaneConfig>;

export type PlaneName = keyof typeof PLANE_CONFIG;

export const PLANES = Object.keys(PLANE_CONFIG) as PlaneName[];
