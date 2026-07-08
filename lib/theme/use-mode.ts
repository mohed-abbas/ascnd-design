"use client";

import { useSyncExternalStore } from "react";
import { getMode, subscribeMode } from "./mode-store";
import { DEFAULT_MODE, type ThemeMode } from "./palette";

/**
 * React binding for the theme-mode store. Re-renders the consumer whenever the
 * mode changes. The server snapshot is DEFAULT_MODE — matching the store's seed
 * default and the SSR sky — so there's no hydration mismatch (same pattern as
 * useQuality and the device gates).
 */
export function useMode(): ThemeMode {
  return useSyncExternalStore(subscribeMode, getMode, () => DEFAULT_MODE);
}
