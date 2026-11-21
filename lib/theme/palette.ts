/**
 * Sky-mode palettes — the SINGLE SOURCE OF TRUTH for the theme controller.
 *
 * Four times of day (sunrise · day · sunset · night). Each is:
 *   - a vertical SKY GRADIENT (top → mid → bottom horizon), rendered by the DOM
 *     <Background/> via the --sky-top / --sky-mid / --sky-bottom CSS variables, and
 *   - a CLOUD light pair (ambient fill + directional key), applied inside the R3F
 *     canvas (cloud-canvas.tsx). The clouds are lit by position-INDEPENDENT lights
 *     precisely so a mode is just a light-colour swap — see CLOUD_THEME's original
 *     note in cloud-canvas.tsx.
 *
 * Both sides read from here and animate with the SAME CROSSFADE constant, so the
 * sky and the clouds recolour in lockstep. Colours are pastel, derived from the
 * brand blue #62abff (day ≈ today's look), not air.inc's more saturated tones.
 *
 * These are STARTING values, tuned further in-browser. Keep the hue family of
 * `night` close to the brand blue so the site's white text/glass stay legible.
 */

export const THEME_MODES = ["sunrise", "day", "sunset", "night"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

/** The mode shown before any user choice (Phase 2 will auto-pick by local time). */
export const DEFAULT_MODE: ThemeMode = "day";

/** localStorage key holding the persisted mode. */
export const MODE_STORAGE_KEY = "ascnd:mode";

export type Light = { color: string; intensity: number };

export type ModePalette = {
  /** Vertical sky gradient stops (top of viewport → horizon). */
  sky: { top: string; mid: string; bottom: string };
  /**
   * Cloud lighting for this mode (see cloud-canvas.tsx ThemeRig). `cssFilter`
   * is the STATIC-sprite equivalent: the baked mobile/no-WebGL cloud sprites
   * (public/clouds/sprites/, day-lit white) are retinted per mode with a CSS
   * filter on each <img> (static-cloud-layer.tsx) — approximating what the
   * ambient/key light pair does to the live clouds. Keep the two in the same
   * mood when tuning either.
   */
  cloud: { ambient: Light; key: Light; cssFilter: string };
  /**
   * Film-grain overlay opacity for this mode (0–1), applied to the noise tile in
   * background.tsx via --grain-opacity. Tunable per mode: darker/flatter skies
   * (night) can carry more grain for texture; brighter ones less. day = 0.10 is
   * the original baseline. ThemeDriver crossfades this with the sky on a switch.
   */
  grain: number;
  /**
   * Rock mode-adaptation (docs/rocks-by-mode.html). Which of these is live is
   * picked by the rock treatment (lib/theme/rock-treatment.ts):
   * - `tint`  — B: a top→bottom multiply gradient over the rock (white = none).
   *   ThemeDriver tweens it as --rock-tint-top / --rock-tint-bottom.
   * - `filter` — A: a CSS filter on the rock. EVERY mode lists the SAME
   *   functions in the SAME order, so ThemeDriver can interpolate one string to
   *   the next (as --rock-filter) instead of snapping.
   * - `lights` — the 3D testimonial rocks: per-mode light rig + the colour stops
   *   of their sky-gradient environment map. day = the original hand-tuned rig.
   * C (baked art) needs no palette entry — the per-mode files sit next to each
   * source as `<name>.<mode>.avif`.
   */
  rock: {
    tint: { top: string; bottom: string };
    filter: string;
    lights: RockLights;
  };
};

export type RockLights = {
  ambient: Light;
  hemi: { sky: string; ground: string; intensity: number };
  key: Light;
  rim: Light;
  /** Environment gradient: zenith, sky, horizon. */
  env: [string, string, string];
  envIntensity: number;
};

export const PALETTES: Record<ThemeMode, ModePalette> = {
  // Cool blue up top melting into a warm gold horizon — early, gentle warmth.
  // Clouds are lit BRIGHTER than the pale warm sky (key above day's 2.6) and pulled
  // back to near-white with only a whisper of gold — a saturated warm tint made
  // them the same tone as the sky and dissolved them, so this keeps the crisp
  // day-like pop with just a faint warm cast.
  sunrise: {
    sky: { top: "#8ec0f2", mid: "#f4c9b0", bottom: "#ffe0b8" },
    cloud: {
      ambient: { color: "#fff5ea", intensity: 1.6 },
      key: { color: "#ffeed6", intensity: 3.0 },
      cssFilter: "brightness(1.03) sepia(0.12) saturate(1.05)",
    },
    grain: 0.06,
    rock: {
      tint: { top: "#fff1e6", bottom: "#ffd6b8" },
      filter: "brightness(1.02) contrast(1) sepia(0.2) hue-rotate(-10deg) saturate(1.1)",
      lights: {
        ambient: { color: "#fff1e6", intensity: 0.3 },
        hemi: { sky: "#ffe6d0", ground: "#c9b6c8", intensity: 1.0 },
        key: { color: "#ffd9b0", intensity: 1.4 },
        rim: { color: "#bcd2f2", intensity: 0.5 },
        env: ["#f4d8c4", "#e8b9a8", "#ffe0b8"],
        envIntensity: 0.6,
      },
    },
  },
  // The brand daytime sky — essentially today's #62abff, now a subtle gradient.
  day: {
    sky: { top: "#4a9dff", mid: "#62abff", bottom: "#9cc9ff" },
    cloud: {
      ambient: { color: "#ffffff", intensity: 1.5 },
      key: { color: "#ffffff", intensity: 2.6 },
      // Sprites are baked day-lit — day needs no correction.
      cssFilter: "none",
    },
    grain: 0.1,
    rock: {
      tint: { top: "#ffffff", bottom: "#ffffff" },
      filter: "brightness(1) contrast(1) sepia(0) hue-rotate(0deg) saturate(1)",
      lights: {
        ambient: { color: "#ffffff", intensity: 0.3 },
        hemi: { sky: "#dcecff", ground: "#9fc4e8", intensity: 1.0 },
        key: { color: "#fff4e0", intensity: 1.35 },
        rim: { color: "#bfe0ff", intensity: 0.6 },
        env: ["#cfe4ff", "#7fb2f0", "#e8f2ff"],
        envIntensity: 0.6,
      },
    },
  },
  // Lavender-blue drifting through mauve into an amber horizon — warmer, richer.
  // Same fix as sunrise: bright, near-white clouds (key above day's 2.6) with only
  // a faint rose-warm cast, so they pop off the warm sky instead of blending in.
  sunset: {
    sky: { top: "#8f9fe0", mid: "#d9a9d4", bottom: "#ffbf9c" },
    cloud: {
      ambient: { color: "#fff2ee", intensity: 1.6 },
      key: { color: "#ffe6dc", intensity: 3.0 },
      cssFilter: "brightness(1.02) sepia(0.16) saturate(1.08) hue-rotate(-10deg)",
    },
    grain: 0.05,
    rock: {
      tint: { top: "#dccbf2", bottom: "#ffc0a0" },
      filter: "brightness(0.9) contrast(1) sepia(0.3) hue-rotate(-25deg) saturate(1.15)",
      lights: {
        ambient: { color: "#ffe9e0", intensity: 0.28 },
        hemi: { sky: "#f0c8d8", ground: "#a08cc0", intensity: 0.9 },
        key: { color: "#ffb890", intensity: 1.3 },
        rim: { color: "#a8b4f0", intensity: 0.55 },
        env: ["#c8b8ee", "#d9a9d4", "#ffbf9c"],
        envIntensity: 0.6,
      },
    },
  },
  // Deep, desaturated brand navy with a slightly lifted horizon; dim cool
  // moonlight on the clouds so they don't glare white against the dark sky.
  night: {
    sky: { top: "#0e2a52", mid: "#1c3f6e", bottom: "#2d5688" },
    cloud: {
      ambient: { color: "#8fa8c8", intensity: 0.5 },
      key: { color: "#c4d4ec", intensity: 1.0 },
      // Dim + pull toward the moonlit slate-blue of the live night lights.
      cssFilter: "brightness(0.74) sepia(0.3) saturate(1.3) hue-rotate(180deg)",
    },
    grain: 0.05,
    rock: {
      tint: { top: "#6683b8", bottom: "#2a426c" },
      filter: "brightness(0.5) contrast(1.05) sepia(0.45) hue-rotate(180deg) saturate(1.3)",
      lights: {
        ambient: { color: "#6f88b0", intensity: 0.1 },
        hemi: { sky: "#4f6fa8", ground: "#101c34", intensity: 0.3 },
        key: { color: "#9fb4dc", intensity: 0.4 },
        rim: { color: "#3f5c96", intensity: 0.3 },
        env: ["#2d5688", "#1c3f6e", "#0e2a52"],
        envIntensity: 0.2,
      },
    },
  },
};

/**
 * Shared crossfade for BOTH the sky vars (ThemeDriver) and the cloud lights
 * (ThemeRig), so a mode change animates as one continuous recolour. Reduced
 * motion snaps instead (duration 0) — consumers check that themselves.
 */
export const CROSSFADE = { duration: 0.9, ease: "power2.inOut" } as const;

/** Narrow an arbitrary string to a valid ThemeMode (for persisted/URL values). */
export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === "string" && (THEME_MODES as readonly string[]).includes(value);
}
