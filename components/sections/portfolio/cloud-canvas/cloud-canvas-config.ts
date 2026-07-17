/**
 * CloudCanvas — the tunable config surface (the "config we import").
 *
 * This is the single source of truth for how the image globe looks and moves. The
 * lab sandbox (app/lab/cloud-canvas) edits a live CloudCanvasConfig with on-screen
 * controls and can COPY the result as JSON; you paste a tuned object back here as a
 * named preset, and the portfolio `cloudCanvas` variant imports it — so the scene
 * ships a frozen preset while the lab stays free to explore.
 *
 * Distilled from the reference `image-cloud-canvas.html` settings object; only the
 * knobs that matter for a fixed-content showcase are kept (upload / flat-board /
 * share-URL machinery from the reference is intentionally out of scope for pass 1).
 * Every numeric field carries the reference's own min/max in CONFIG_RANGES so the
 * lab sliders and any validation read one table.
 */

/**
 * How tile slot shapes are chosen:
 *   • "manual"   — each project's authored `form` (cloud-canvas-data.ts) wins.
 *                  The shipped portfolio mode: the registry is the control panel.
 *   • "auto"     — classified from each image's natural aspect ratio.
 *   • "balanced" — a fixed repeating cycle, independent of content.
 *   • "custom"   — distributed to match the `balance` ratios.
 */
export type CloudLayoutMode = "manual" | "auto" | "balanced" | "custom";

/**
 * Formation — how the tiles are arranged and how they move. One engine, one glass
 * tile recipe, four arrangements of the same matter (the site's air/altitude
 * vocabulary: a world, an orbit, a thermal, a cloud):
 *
 *   • "globe"   — Fibonacci sphere; slow spin (the shipped look).
 *   • "halo"    — a braided two-radius orbital ring, echoing the testimonial
 *                 rocks' orbit outlines; stable (no roll wobble).
 *   • "ascent"  — a rising double-helix column; tiles climb and wrap, fading in
 *                 at the base and out at the top (the brand name, literally).
 *   • "cumulus" — a flattened cloud-bank scatter (volume, not shell) with slow
 *                 collective drift + per-tile bob, matching the drei cloud layer's
 *                 motion grammar.
 */
export type CloudCanvasMode = "globe" | "halo" | "ascent" | "cumulus";

export interface CloudCanvasConfig {
  /** Formation: how tiles are arranged + their characteristic motion. */
  mode: CloudCanvasMode;
  /** Globe radius multiplier — how far apart the tiles sit on the sphere. */
  spread: number;
  /** Per-tile scale. */
  size: number;
  /** z-perspective strength (how much depth grows/shrinks near vs far tiles). */
  depth: number;
  /**
   * Vertical orbit centre as a fraction of the canvas height (0.47 = the
   * reference's slightly-above-centre). The portfolio preset pushes it down to
   * clear the section header while the canvas stays full-bleed (a smaller
   * canvas would hard-clip tiles at its own edge).
   */
  centerY: number;
  /** Idle auto-rotation rate (0 = the globe rests unless dragged). */
  autoSpeed: number;
  /** How many images are laid onto the globe; "all" uses the full set. */
  visibleCount: number | "all";
  /**
   * Cap for the "all" FILTER TAB only: the first N registry entries are laid
   * out, the rest stay evaporated. Type tabs are never capped — every project
   * of that type shows. "none" disables the cap. (Distinct from visibleCount,
   * which trims the card set itself and applies to every tab.)
   */
  allMax: number | "none";
  /** How tile slot shapes (portrait/landscape/square) are chosen. */
  layout: CloudLayoutMode;
  /** Only used when `layout === "custom"` — relative weights, normalised at use. */
  balance: { portrait: number; landscape: number; square: number };
  /**
   * Optional in-canvas edge fade — each pair is [start, end] as fractions of
   * the canvas height: tile alpha ramps 0→1 across `top` and 1→0 across
   * `bottom` (a destination-in gradient fill after all tiles are drawn, read
   * live in render — never part of a layout rebuild). This replaces the old
   * .cloud-globe-mask CSS mask-image: a CSS mask on a canvas that repaints
   * every frame forced a full-screen render-surface + mask pass per frame in
   * the compositor. Omit for no fade (the lab / default presets). In the
   * engine's lite mode (CPU-rasterized canvas2d, locked at init) the SAME
   * stops drive a per-tile alpha ramp instead of the gradient composite.
   */
  edgeFade?: { top: [number, number]; bottom: [number, number] };
  /** Tiles rotate slightly to face the globe centre. */
  tiltToCenter: boolean;
  /** Far tiles fade + darken (depth cue). */
  fadeBack: boolean;
  /** Resting camera. yaw/pitch in radians; zoom clamped by CONFIG_RANGES.zoom. */
  camera: { yaw: number; pitch: number; zoom: number };
}

/**
 * Slider bounds for every numeric knob (min, max, step) — carried over verbatim
 * from the reference so the lab controls and the engine agree on limits.
 */
export const CONFIG_RANGES = {
  spread: { min: 0.55, max: 1.55, step: 0.01 },
  size: { min: 0.55, max: 1.45, step: 0.01 },
  depth: { min: 0.45, max: 1.65, step: 0.01 },
  centerY: { min: 0.35, max: 0.7, step: 0.01 },
  autoSpeed: { min: 0, max: 1.2, step: 0.01 },
  zoom: { min: 0.55, max: 1.9, step: 0.01 },
  /** pitch is clamped every frame so the globe can't flip past its poles. */
  pitch: { min: -1.05, max: 1.05 },
  balance: { min: 0, max: 100, step: 5 },
} as const;

/** The neutral starting point — matches the reference's raw control defaults. */
export const DEFAULT_CLOUD_CANVAS_CONFIG: CloudCanvasConfig = {
  mode: "globe",
  spread: 1,
  size: 1,
  depth: 1,
  centerY: 0.47,
  autoSpeed: 0.35,
  visibleCount: "all",
  allMax: 30,
  layout: "balanced",
  balance: { portrait: 45, landscape: 35, square: 20 },
  tiltToCenter: true,
  fadeBack: true,
  camera: { yaw: -0.35, pitch: 0.17, zoom: 1.5 },
};

/**
 * The LOCKED look the portfolio `cloudCanvas` variant ships — tuned in the lab
 * (app/lab/cloud-canvas) and pasted here. Re-tune in the lab and replace this
 * object to change the production globe; the scene imports exactly this.
 */
export const CLOUD_CANVAS_PORTFOLIO_CONFIG: CloudCanvasConfig = {
  mode: "globe",
  spread: 1.2,
  size: 1.2,
  depth: 1.59,
  // centerY 0.56 + zoom 0.9: the orbit sits below the section header ("stuff
  // we've shipped", Figma 424:487) instead of colliding with it.
  centerY: 0.56,
  autoSpeed: 0.2,
  visibleCount: "all",
  // The "all" tab shows at most 30 projects (registry order — put the ones
  // that must always be visible first). Type tabs still show every match.
  allMax: 30,
  // "manual": every tile's shape is authored per project in cloud-canvas-data.ts
  // (the old "custom" 30/60/20 spread assigned shapes by position, not project).
  layout: "manual",
  balance: { portrait: 30, landscape: 60, square: 20 },
  // The old .cloud-globe-mask stops, verbatim: tiles dissolve into the sky
  // under the "stuff we've shipped" header (opaque by ~34% ≈ just below the
  // header block) and again toward the section's bottom edge.
  edgeFade: { top: [0.16, 0.34], bottom: [0.86, 0.98] },
  tiltToCenter: true,
  fadeBack: true,
  camera: { yaw: -0.35, pitch: 0.17, zoom: 0.9 },
};

/**
 * Named looks (globe looks from the reference + one tuned start per formation).
 * The lab starts from one of these; a tuned favourite becomes the preset the
 * portfolio variant imports. Extend this map once you've dialled a look in.
 *
 * (The reference's "orbit" globe-look was retired — that name now belongs to an
 * actual orbit, the "halo" formation.)
 */
export const CLOUD_PRESETS: Record<string, CloudCanvasConfig> = {
  editorial: {
    ...DEFAULT_CLOUD_CANVAS_CONFIG,
    spread: 0.82,
    autoSpeed: 0.28,
    size: 1.08,
    depth: 1.08,
    layout: "balanced",
  },
  gallery: {
    ...DEFAULT_CLOUD_CANVAS_CONFIG,
    spread: 1.08,
    autoSpeed: 0.18,
    size: 1.16,
    depth: 0.82,
    layout: "auto",
  },
  dense: {
    ...DEFAULT_CLOUD_CANVAS_CONFIG,
    spread: 0.72,
    autoSpeed: 0.22,
    size: 0.82,
    depth: 1.02,
    layout: "custom",
  },
  halo: {
    ...DEFAULT_CLOUD_CANVAS_CONFIG,
    mode: "halo",
    spread: 1.18,
    size: 1.05,
    depth: 1.15,
    autoSpeed: 0.3,
    layout: "balanced",
    camera: { yaw: -0.2, pitch: 0.42, zoom: 1.15 },
  },
  ascent: {
    ...DEFAULT_CLOUD_CANVAS_CONFIG,
    mode: "ascent",
    spread: 0.95,
    size: 1,
    depth: 1.2,
    autoSpeed: 0.4,
    layout: "balanced",
    camera: { yaw: -0.3, pitch: 0.1, zoom: 1.25 },
  },
  cumulus: {
    ...DEFAULT_CLOUD_CANVAS_CONFIG,
    mode: "cumulus",
    spread: 1.3,
    size: 1.12,
    depth: 1,
    autoSpeed: 0.25,
    layout: "auto",
    camera: { yaw: -0.15, pitch: 0.12, zoom: 1.4 },
  },
};
