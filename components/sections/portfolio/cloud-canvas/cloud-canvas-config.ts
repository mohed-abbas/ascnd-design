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

export type CloudLayoutMode = "auto" | "balanced" | "custom";

export interface CloudCanvasConfig {
  /** Globe radius multiplier — how far apart the tiles sit on the sphere. */
  spread: number;
  /** Per-tile scale. */
  size: number;
  /** z-perspective strength (how much depth grows/shrinks near vs far tiles). */
  depth: number;
  /** Idle auto-rotation rate (0 = the globe rests unless dragged). */
  autoSpeed: number;
  /** How many images are laid onto the globe; "all" uses the full set. */
  visibleCount: number | "all";
  /** How tile slot shapes (portrait/landscape/square) are chosen. */
  layout: CloudLayoutMode;
  /** Only used when `layout === "custom"` — relative weights, normalised at use. */
  balance: { portrait: number; landscape: number; square: number };
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
  autoSpeed: { min: 0, max: 1.2, step: 0.01 },
  zoom: { min: 0.55, max: 1.9, step: 0.01 },
  /** pitch is clamped every frame so the globe can't flip past its poles. */
  pitch: { min: -1.05, max: 1.05 },
  balance: { min: 0, max: 100, step: 5 },
} as const;

/** The neutral starting point — matches the reference's raw control defaults. */
export const DEFAULT_CLOUD_CANVAS_CONFIG: CloudCanvasConfig = {
  spread: 1,
  size: 1,
  depth: 1,
  autoSpeed: 0.35,
  visibleCount: "all",
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
  spread: 1.2,
  size: 1.2,
  depth: 1.59,
  autoSpeed: 0.2,
  visibleCount: "all",
  layout: "custom",
  balance: { portrait: 30, landscape: 60, square: 20 },
  tiltToCenter: true,
  fadeBack: true,
  camera: { yaw: -0.35, pitch: 0.17, zoom: 1 },
};

/**
 * Named looks (the reference's presets, merged onto the defaults). The lab starts
 * from one of these; a tuned favourite becomes the preset the portfolio variant
 * imports. Extend this map with your own once you've dialled a look in the lab.
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
  orbit: {
    ...DEFAULT_CLOUD_CANVAS_CONFIG,
    spread: 1.18,
    autoSpeed: 0.48,
    size: 0.92,
    depth: 1.24,
    layout: "balanced",
  },
  dense: {
    ...DEFAULT_CLOUD_CANVAS_CONFIG,
    spread: 0.72,
    autoSpeed: 0.22,
    size: 0.82,
    depth: 1.02,
    layout: "custom",
  },
};
