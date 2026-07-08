/**
 * Central theme-mode store (same tiny framework-agnostic shape as
 * lib/perf/quality-store.ts). It holds the current sky mode, persists it to
 * localStorage, and notifies subscribers on change.
 *
 * No React import — it's read from both sides of the R3F boundary: the DOM
 * ThemeDriver + the switcher use the useMode() hook (use-mode.ts), while the
 * in-canvas ThemeRig may also subscribe imperatively. useSyncExternalStore on
 * each side keeps them in sync without prop-drilling across the reconcilers.
 *
 * The module seeds `currentMode` from localStorage at load (client only) so the
 * store agrees with the pre-paint inline script in layout.tsx that stamps
 * <html data-mode> — no flash, no first-render disagreement.
 */

import {
  DEFAULT_MODE,
  MODE_STORAGE_KEY,
  isThemeMode,
  type ThemeMode,
} from "./palette";

/** Read the persisted mode (client only); DEFAULT_MODE if absent/invalid/blocked. */
function readStored(): ThemeMode {
  if (typeof window === "undefined") return DEFAULT_MODE;
  try {
    const raw = window.localStorage.getItem(MODE_STORAGE_KEY);
    return isThemeMode(raw) ? raw : DEFAULT_MODE;
  } catch {
    // localStorage can throw (privacy mode, disabled storage) — fall back.
    return DEFAULT_MODE;
  }
}

let currentMode: ThemeMode = readStored();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function getMode(): ThemeMode {
  return currentMode;
}

/**
 * Switch the sky mode. No-ops if unchanged. Persists to localStorage (best
 * effort) and emits so the DOM sky, the clouds and the switcher all react.
 */
export function setMode(mode: ThemeMode): void {
  if (mode === currentMode) return;
  currentMode = mode;
  try {
    window.localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    // Persistence is best-effort; the in-memory mode still applies this session.
  }
  emit();
}

export function subscribeMode(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
