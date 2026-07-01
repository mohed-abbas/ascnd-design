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
import { INTRO_REVEAL_EVENT, introWillPlay } from "@/components/sections/intro/intro-state";

// The intro (MTM compile + Text3D geometry build) is a bounded, one-time GPU
// spike. Arming the watchdog during it would falsely demote the whole session,
// so we wait for the dock event + a short settle. If the intro is skipped, the
// event never fires — arm on a failsafe timer instead.
const WATCHDOG_SETTLE_MS = 800;
const WATCHDOG_FAILSAFE_MS = 8000;

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
 *   1. sniff GPU strength (sync)                → gpu-tier.ts
 *   2. sample rAF deltas for the refresh rate   → refresh-rate.ts
 *   3. pick the starting tier                   → quality-store.initQuality
 *   4. arm the frame-time watchdog AFTER the intro → frame-watchdog.ts
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
    const cleanups: Array<() => void> = [];

    const isDev = process.env.NODE_ENV !== "production";
    const override = parseTierParam();
    const gpu = detectGpuStrength();

    // Apply a forced tier SYNCHRONOUSLY (before refresh detection resolves) so
    // the intro glass — which snapshots the tier at mount — sees it.
    if (override) forceTier(override);

    if (isDev) {
      cleanups.push(
        subscribeQuality(() =>
          console.info(
            `[quality] tier=${getTierName()} refreshHz=${getRefreshHz()}`
          )
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
    }

    detectRefreshRate().then((hz) => {
      if (cancelled) return;

      // Records refreshHz (needed for the fps cap) and picks the starting tier —
      // leaves the tier pinned if `override` forced one above.
      initQuality(hz, gpu);

      if (isDev) {
        console.info(
          `[quality] boot: gpu=${gpu} refreshHz=${getRefreshHz()} tier=${getTierName()}` +
            (override ? " (forced via ?tier)" : "")
        );
      }

      // Arm the watchdog once, after the intro transient has passed.
      let armed = false;
      const arm = () => {
        if (armed || cancelled) return;
        armed = true;
        cleanups.push(startFrameWatchdog());
        if (isDev) console.info("[quality] watchdog armed");
      };

      if (introWillPlay()) {
        const onReveal = () => window.setTimeout(arm, WATCHDOG_SETTLE_MS);
        window.addEventListener(INTRO_REVEAL_EVENT, onReveal, { once: true });
        const failsafe = window.setTimeout(arm, WATCHDOG_FAILSAFE_MS);
        cleanups.push(() => {
          window.removeEventListener(INTRO_REVEAL_EVENT, onReveal);
          window.clearTimeout(failsafe);
        });
      } else {
        arm();
      }
    });

    return () => {
      cancelled = true;
      for (const c of cleanups) c();
    };
  }, []);

  return null;
}
