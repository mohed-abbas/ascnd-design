/**
 * Rock mode-adaptation TREATMENT — which technique (if any) recolours the
 * rocks for the current sky mode. A dev-only A/B switch for comparing the
 * options in docs/rocks-by-mode.html; same tiny store shape as mode-store.ts.
 *
 *   none        — rocks stay day-lit in every mode (the shipped look)
 *   filter      — A: a per-mode CSS filter on each rock
 *   tint        — B: a sky-tinted multiply gradient over each rock
 *   baked       — C: a pre-graded image per mode, crossfaded in
 *   tint-night  — B for sunrise/sunset, the baked night grade at night
 *   split       — A on the bare rocks, B on the grass (RockArt `kind`): the
 *                 current pick, and the dev default
 *   relight     — prototype: the hero cliffs drawn in WebGL and relit per mode
 *                 from a normal map (components/ui/relit-rock.tsx); grass and
 *                 the footer keep B's tint, other bare rocks A's filter
 *
 * The current value is stamped on <html data-rock-treatment>, which globals.css
 * keys every treatment off, so switching is a pure CSS change (plus the bake
 * layers mounting). Production builds pin it to "none" and ignore storage, so
 * a deploy of this branch looks exactly like before; only `next dev` (where
 * the selector exists) can change it.
 */

export const ROCK_TREATMENTS = [
  "none",
  "filter",
  "tint",
  "baked",
  "tint-night",
  "split",
  "relight",
] as const;
export type RockTreatment = (typeof ROCK_TREATMENTS)[number];

export const ROCK_TREATMENT_LABELS: Record<RockTreatment, string> = {
  none: "None",
  filter: "A · Filter",
  tint: "B · Tint",
  baked: "C · Baked",
  "tint-night": "B + night bake",
  split: "A rock · B grass",
  relight: "2.5D relight",
};

/** What production pins, and the SSR snapshot. */
export const DEFAULT_ROCK_TREATMENT: RockTreatment = "none";
/** What `next dev` starts on when nothing is stored. */
const DEV_DEFAULT: RockTreatment = "split";
const STORAGE_KEY = "ascnd:rock-treatment";
const DEV = process.env.NODE_ENV !== "production";

function isTreatment(v: unknown): v is RockTreatment {
  return typeof v === "string" && (ROCK_TREATMENTS as readonly string[]).includes(v);
}

function readStored(): RockTreatment {
  if (!DEV || typeof window === "undefined") return DEFAULT_ROCK_TREATMENT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isTreatment(raw) ? raw : DEV_DEFAULT;
  } catch {
    return DEV_DEFAULT;
  }
}

function stamp(t: RockTreatment) {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.rockTreatment = t;
  }
}

let current: RockTreatment = readStored();
stamp(current);
const listeners = new Set<() => void>();

export function getRockTreatment(): RockTreatment {
  return current;
}

export function setRockTreatment(t: RockTreatment): void {
  if (!DEV || t === current) return;
  current = t;
  stamp(t);
  try {
    window.localStorage.setItem(STORAGE_KEY, t);
  } catch {
    // best effort
  }
  for (const l of listeners) l();
}

export function subscribeRockTreatment(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Bake modes a treatment needs mounted (C: all three; B+N: night only). */
export function bakedModesFor(t: RockTreatment): readonly ("sunrise" | "sunset" | "night")[] {
  if (t === "baked") return ["sunrise", "sunset", "night"];
  if (t === "tint-night") return ["night"];
  return [];
}
