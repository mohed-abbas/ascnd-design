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
  /** Hit-testing: "none" so scroll/clicks pass through to page DOM. Interactive
   *  planes stay "none" AND set `interactive` (below) — drei <View> picking is
   *  wired through the page's event source, not the fixed canvas. */
  readonly pointerEvents: "none" | "auto";
  /** GL `antialias` (context-creation flag — see the note above). */
  readonly antialias: boolean;
  /** GL `powerPreference` (context-creation flag). */
  readonly powerPreference: WebGLPowerPreference;
  /**
   * drei <View> POINTER PICKING (Phase 3 — testimonial rock hover-dodge).
   *
   * A fixed root-mounted plane canvas and a feature's track <div> live in
   * SEPARATE DOM subtrees. drei's <View> gates picking on `event.target ===
   * track.current` (node_modules/@react-three/drei/web/View.js compute), and the
   * R3F event listeners are attached to whatever element the Canvas `connect`s to
   * — the canvas wrapper by default, which is NOT an ancestor of the track, so a
   * track-targeted pointer event NEVER bubbles to it. `setEvents({connected})`
   * inside drei's Container only records the field; it does NOT re-attach DOM
   * listeners (verified: fiber setEvents merges state, only `connect()` calls
   * addEventListener). So picking is impossible unless the Canvas's `eventSource`
   * is a shared ANCESTOR of the track. When true, the host points `eventSource`
   * at document.documentElement (+ eventPrefix "client"), the canvas stays
   * pointer-events:none (pointer passes through to the pointer-events:auto track),
   * and drei's compute fires with event.target === track. One interactive view
   * per plane (last-mounted-wins events.connected — Phase-1 known limitation).
   */
  readonly interactive?: boolean;
  /**
   * Optional plane dpr ceiling BELOW the site cap (1.5). Measured 2026-07-19:
   * the sky clouds' fill-rate (dozens of overlapping alpha sprites, repainted
   * per morph tick) was the dominant dropped-frame source — REAR at dpr 1.0 is
   * visually indistinguishable (soft billows have no pixel-scale detail) and
   * returned the sections to display rate. Leave unset for sharp content.
   */
  readonly dprMax?: number;
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
    interactive: false,
  },
  /** MID — an in-band plane between the DOM sky/clouds and page content, for
   *  effects that sit behind ONE section's own text rather than straddling all
   *  page content: the testimonial GLB rocks (Phase 3). z 0 (NOT the z-61 FRONT
   *  overlay) is the crux of the stacking investigation: the section's pull-quote
   *  is `relative z-10` and its ring outlines are `absolute` (POSITIONED, z-auto).
   *  A fixed z-0 canvas is a stack-level-0 positioned box, painted in the same
   *  group as those z-auto rings in DOM-tree order — and SharedCanvasHost is
   *  mounted BEFORE {children} in app/layout.tsx, so the canvas is tree-earlier
   *  and paints BELOW the rings AND below the z-10 quote. Result: rocks < rings <
   *  quote, exactly as the standalone canvas ordered them — with NO section-local
   *  z tweaks. (z 0 also sits above the -z-20 sky / -z-10 clouds, so the rocks
   *  float in the sky in front of the clouds.) antialias:true — the GLB rock
   *  silhouette needs it (this plane is alone, so the FRONT AA conflict doesn't
   *  apply here); powerPreference matches the standalone rock canvas's
   *  "high-performance". `interactive` wires the hover-dodge picking (see the
   *  PlaneConfig field doc). */
  mid: {
    zIndex: 0,
    pointerEvents: "none",
    antialias: true,
    powerPreference: "high-performance",
    interactive: true,
  },
  /** REAR — behind page content, above the -z-20 DOM sky backdrop: distant sky
   *  clouds. */
  rear: {
    zIndex: -10,
    pointerEvents: "none",
    antialias: false,
    powerPreference: "default",
    interactive: false,
    // Sky clouds only — soft alpha billows; dpr 1 invisible, halves the
    // dominant morph-paint fill cost (see dprMax doc above).
    dprMax: 1.0,
  },
} as const satisfies Record<string, PlaneConfig>;

export type PlaneName = keyof typeof PLANE_CONFIG;

export const PLANES = Object.keys(PLANE_CONFIG) as PlaneName[];
