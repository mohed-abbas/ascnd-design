"use client";

import { useSyncExternalStore } from "react";
import {
  getQualityConfig,
  subscribeQuality,
} from "./quality-store";
import { TIERS, type QualityConfig } from "./tiers";

/**
 * React binding for the adaptive-quality store. Re-renders the consumer whenever
 * the tier changes (startup pick or watchdog step-down). Server snapshot is the
 * `high` config so SSR renders the full-quality tree — matching the store's
 * default and avoiding a hydration mismatch (same pattern as the device gates).
 */
export function useQuality(): QualityConfig {
  return useSyncExternalStore(
    subscribeQuality,
    getQualityConfig,
    () => TIERS.high
  );
}
