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
  /** Cloud lighting for this mode (see cloud-canvas.tsx ThemeRig). */
  cloud: { ambient: Light; key: Light };
  /**
   * Film-grain overlay opacity for this mode (0–1), applied to the noise tile in
   * background.tsx via --grain-opacity. Tunable per mode: darker/flatter skies
   * (night) can carry more grain for texture; brighter ones less. day = 0.10 is
   * the original baseline. ThemeDriver crossfades this with the sky on a switch.
   */
  grain: number;
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
    },
    grain: 0.11,
  },
  // The brand daytime sky — essentially today's #62abff, now a subtle gradient.
  day: {
    sky: { top: "#4a9dff", mid: "#62abff", bottom: "#9cc9ff" },
    cloud: {
      ambient: { color: "#ffffff", intensity: 1.5 },
      key: { color: "#ffffff", intensity: 2.6 },
    },
    grain: 0.1,
  },
  // Lavender-blue drifting through mauve into an amber horizon — warmer, richer.
  // Same fix as sunrise: bright, near-white clouds (key above day's 2.6) with only
  // a faint rose-warm cast, so they pop off the warm sky instead of blending in.
  sunset: {
    sky: { top: "#8f9fe0", mid: "#d9a9d4", bottom: "#ffbf9c" },
    cloud: {
      ambient: { color: "#fff2ee", intensity: 1.6 },
      key: { color: "#ffe6dc", intensity: 3.0 },
    },
    grain: 0.12,
  },
  // Deep, desaturated brand navy with a slightly lifted horizon; dim cool
  // moonlight on the clouds so they don't glare white against the dark sky.
  night: {
    sky: { top: "#0e2a52", mid: "#1c3f6e", bottom: "#2d5688" },
    cloud: {
      ambient: { color: "#8fa8c8", intensity: 0.5 },
      key: { color: "#c4d4ec", intensity: 1.0 },
    },
    grain: 0.14,
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
