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

/**
 * A heading drawn AT THE GLOBE'S CORE — in-canvas, in the middle of the
 * painter's sort, so far tiles pass behind it and near tiles pass IN FRONT.
 *
 * It has to be canvas text rather than a DOM layer for exactly that reason: a
 * DOM element can only be above the whole canvas or below the whole canvas, and
 * both of those read wrong (above = the type covers the work; below = even a
 * faded far tile chops the words). Depth is the thing being bought here.
 *
 * Everything visual is pulled from CSS custom properties at draw time rather
 * than hardcoded, so the canvas type stays in lockstep with the design tokens —
 * including --fs-display's mobile clamp(). The consumer keeps a visually-hidden
 * <h2> with the same words, since canvas text is invisible to a11y and search.
 */
export interface CloudCoreLabel {
  /**
   * The line, in runs — one per font. Rendered left-to-right on a single
   * baseline and centred as a whole, which is how the mixed Product Sans /
   * Instrument Serif display heading is set everywhere else on the site.
   */
  runs: {
    text: string;
    /** CSS custom property holding the family stack, e.g. "--font-instrument". */
    familyVar: string;
    weight?: string;
    style?: string;
  }[];
  /**
   * Where the type sits along the view axis, in the same units as a tile's
   * projected z (the unit sphere, so -1 = back pole, 0 = dead centre, 1 =
   * front pole). Only tiles NEARER than this draw over it.
   *
   * This is the legibility dial, and 0 is the wrong answer even though it's
   * the geometric centre: half the sphere is nearer than the core, so the
   * headline spends most of its life behind a tile. Pushing it forward keeps
   * the effect — tiles still eclipse the words on their closest pass — while
   * making that an event rather than the resting state.
   */
  z: number;
  /**
   * Alpha of the SHOW-THROUGH pass: the label redrawn over every tile so the
   * headline stays readable through whatever is eclipsing it (0 = off).
   *
   * Depth sorting alone can't carry this — the sphere's near pole projects onto
   * screen centre, which is where the label is, so the tiles that cross it are
   * the biggest and most opaque ones on screen. The alternative fix, ghosting
   * the crossing TILE, was rejected: it dims exactly the nearest tiles and so
   * inverts the depth cue it's meant to serve. Redrawing the type instead
   * leaves every tile at full strength and is invisible over open sky (it lands
   * on the opaque first pass — white on the same white).
   */
  showThrough: number;
  /** CSS custom property holding the font size, e.g. "--text-display". */
  sizeVar: string;
  /** Fallback px size if that property is missing or unparseable. */
  size: number;
  /** CSS letter-spacing, applied via ctx.letterSpacing where supported. */
  letterSpacing?: string;
  color: string;
  /**
   * Soft shadow under the type. Still earns its keep even with depth sorting:
   * a FAR tile behind the words is dimmed but not gone, and white-on-light is
   * the one case sorting can't fix.
   */
  shadow?: { color: string; blur: number; offsetY?: number };
}

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
  /**
   * Optional heading drawn at the formation's core, depth-sorted among the
   * tiles. Omit for a bare globe (the lab / default presets).
   */
  coreLabel?: CloudCoreLabel;
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
  // centerY 0.56 + zoom 0.9: the orbit centre clears the filter tabs at the top
  // of the section. ⚠️ The heading ("stuff we've shipped", Figma 424:487) is
  // absolutely parked ON this fraction — portfolio.tsx pins it at top-[56%] so
  // the tiles revolve AROUND the type. Retune this and move that with it.
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
  // Tiles dissolve into the sky at both ends of the section. The top ramp only
  // has to clear the filter tabs now (≈10dvh + a 36px pill ⇒ done by ~0.14) —
  // it was [0.16, 0.34] when the heading sat under them, and holding that would
  // leave a bald band where the type used to be. Starting the fade-in at the
  // tabs lets the sphere read as a full orbit around the centred heading.
  edgeFade: { top: [0.1, 0.22], bottom: [0.86, 0.98] },
  // The section heading, living AT the core of the sphere (Figma 424:487). It
  // renders between the far and near halves of the painter's sort, so the work
  // orbits it in real depth — near tiles eclipse the words on their way past
  // rather than the type sitting on top of the portfolio like a watermark.
  // portfolio.tsx keeps the matching sr-only <h2>.
  coreLabel: {
    runs: [
      { text: "stuff we've ", familyVar: "--font-product", weight: "300" },
      { text: "shipped", familyVar: "--font-instrument", weight: "400" },
    ],
    // Well forward of the core. At 0 (the geometric centre) half the sphere is
    // nearer than the type and the headline is behind something more often than
    // not; 0.78 leaves only the front-most tiles crossing it, so the eclipse is
    // an event rather than the resting state. Measured at 1512×950: at 0.42 the
    // two nearest tiles both cut the line, at 0.78 only the front one does.
    z: 0.78,
    // 0 = the tiles win outright. The heading is complimentary here, not the
    // subject: nothing is ever laid over a project, and a tile crossing the
    // core simply eclipses the words until it passes. z (above) is what keeps
    // that from being the resting state — most of the sphere is behind the type.
    showThrough: 0,
    sizeVar: "--text-display",
    size: 49,
    letterSpacing: "-0.03em",
    color: "#ffffff",
    shadow: { color: "rgba(24,54,96,0.45)", blur: 26, offsetY: 2 },
  },
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
