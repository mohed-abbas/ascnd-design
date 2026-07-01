"use client";

import { useEffect } from "react";
import { detectGpuStrength } from "@/lib/perf/gpu-tier";
import { detectRefreshRate } from "@/lib/perf/refresh-rate";
import { startFrameWatchdog } from "@/lib/perf/frame-watchdog";
import {
  forceTier,
  getQualityConfig,
  getRefreshHz,
  getTierName,
  initQuality,
  stepDownTier,
  subscribeQuality,
} from "@/lib/perf/quality-store";
import { TIER_ORDER, type TierName } from "@/lib/perf/tiers";

function parseTierParam(): TierName | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("tier");
  return (TIER_ORDER as readonly string[]).includes(raw ?? "")
    ? (raw as TierName)
    : null;
}

/**
 * Boots the adaptive-quality system (docs/performance-audit.md §6, Phase 2).
 * Renders nothing — it runs detection once and arms the runtime watchdog:
 *
 *   1. sniff GPU strength (sync)               → gpu-tier.ts
 *   2. sample rAF deltas for the refresh rate  → refresh-rate.ts
 *   3. pick the starting tier                  → quality-store.initQuality
 *   4. arm the frame-time watchdog on the ticker → frame-watchdog.ts
 *
 * CALIBRATION AFFORDANCES (a capable machine never trips the watchdog, so you
 * need to drive tiers by hand to eyeball medium/low):
 *   • `?tier=high|medium|low` pins a tier (freezes the watchdog) for A/B.
 *   • In dev, `window.__quality` exposes { tier, refreshHz, config, force,
 *     stepDown } and every tier change is logged to the console.
 */
export default function QualityController() {
  useEffect(() => {
    let cancelled = false;
    let stopWatchdog: (() => void) | undefined;

    const isDev = process.env.NODE_ENV !== "production";
    const override = parseTierParam();
    const gpu = detectGpuStrength();

    // Apply a forced tier SYNCHRONOUSLY (before refresh detection resolves) so
    // the intro glass — which snapshots the tier at mount — sees it. initQuality
    // below then records refreshHz without disturbing the pinned tier.
    if (override) forceTier(override);

    if (isDev) {
      const unlog = subscribeQuality(() =>
        console.info(
          `[quality] tier=${getTierName()} refreshHz=${getRefreshHz()}`
        )
      );
      const w = window as typeof window & { __quality?: unknown };
      w.__quality = {
        get tier() {
          return getTierName();
        },
        get refreshHz() {
          return getRefreshHz();
        },
        get config() {
          return getQualityConfig();
        },
        force: (t: TierName | null) => forceTier(t),
        stepDown: () => stepDownTier(),
      };
      // Fold the log-unsubscribe into teardown.
      const priorStop = () => unlog();
      stopWatchdog = priorStop;
    }

    detectRefreshRate().then((hz) => {
      if (cancelled) return;
      // initQuality records refreshHz (needed for the fps cap) and picks the
      // starting tier — but leaves the tier pinned if `override` forced one above.
      initQuality(hz, gpu);

      if (isDev) {
        console.info(
          `[quality] boot: gpu=${gpu} refreshHz=${getRefreshHz()} tier=${getTierName()}` +
            (override ? " (forced via ?tier)" : "")
        );
      }

      const stopW = startFrameWatchdog();
      const prev = stopWatchdog;
      stopWatchdog = () => {
        prev?.();
        stopW();
      };
    });

    return () => {
      cancelled = true;
      stopWatchdog?.();
    };
  }, []);

  return null;
}
