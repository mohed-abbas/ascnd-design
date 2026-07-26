/**
 * Central adaptive-quality store (docs/performance-audit.md §6 C2–C3).
 *
 * A tiny framework-agnostic store (no React import — the cursor sim and cloud
 * pump read it imperatively; React components use use-quality.ts). It holds the
 * current tier and the detected refresh rate, notifies subscribers on change,
 * and owns the two mutations: `initQuality` (startup pick) and `stepDownTier`
 * (the watchdog's only lever).
 *
 * Step-down is ONE-WAY by design. Bouncing tiers up and down produces visible
 * quality flicker, so once the watchdog drops a tier we stay there for the
 * session — a conservative choice worth revisiting after on-hardware tuning.
 */

import type { GpuStrength } from "./gpu-tier";
import { TIER_ORDER, TIERS, type QualityConfig, type TierName } from "./tiers";

let currentTier: TierName = "high";
let refreshHz = 60;
// When a tier is forced (debug/calibration override), the watchdog's step-down
// is ignored so the pinned tier stays put for A/B comparison.
let overridden = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/**
 * Is the primary input a finger? Memoised — the caps below are read inside
 * frame loops, so this must not touch matchMedia per call.
 *
 * The tier system has NO viewport or input signal, and that gap lands hardest
 * exactly where it hurts. Both common phones resolve to tier `high`: iOS
 * reports renderer "Apple GPU" (no /apple m\d/ match in gpu-tier.ts), exposes
 * no navigator.deviceMemory and 6 cores, so classifyFromContext falls through
 * to `unknown` — which pickInitialTier deliberately treats as capable — while
 * a flagship Adreno matches `strong` outright. Both then land on `high`, where
 * heavyEffectFpsCap() returned 0 (uncapped) below 70Hz and scrollRepaintFpsCap()
 * returned 0 unconditionally.
 *
 * The consequence was that every throttle written to protect these paths was
 * inert on the devices that needed them — makeCappedInvalidate on the why-stay
 * reel, and the portfolio globe's ticker. The frame-time watchdog would
 * eventually demote a struggling device, but only after the jank it exists to
 * prevent has already been felt, and mounted features lock their tier anyway.
 * Gating on the input type fixes it at the source instead of guessing GPUs.
 */
let coarsePointer: boolean | undefined;
function isCoarsePointer(): boolean {
  if (coarsePointer === undefined) {
    coarsePointer =
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches;
  }
  return coarsePointer;
}

/** Pick the starting tier from (refresh rate × GPU). Conservative: unknown → high. */
export function pickInitialTier(hz: number, gpu: GpuStrength): TierName {
  if (gpu === "weak") return hz >= 90 ? "low" : "medium";
  // strong | unknown → assume capable; the watchdog demotes if wrong.
  return "high";
}

/**
 * Run once at startup with the detected refresh rate + GPU strength. Records
 * refreshHz (needed for the fps cap) and picks the starting tier — unless a tier
 * is already forced (debug override), in which case the tier is left pinned.
 * Always emits so fps-cap consumers re-read heavyEffectFpsCap() for the new Hz.
 */
export function initQuality(hz: number, gpu: GpuStrength): void {
  refreshHz = hz;
  if (!overridden) {
    currentTier = pickInitialTier(hz, gpu);
  }
  emit();
}

/** Drop one tier. Returns false if already at the floor or overridden. Watchdog-only. */
export function stepDownTier(): boolean {
  if (overridden) return false;
  const i = TIER_ORDER.indexOf(currentTier);
  if (i >= TIER_ORDER.length - 1) return false;
  currentTier = TIER_ORDER[i + 1];
  emit();
  return true;
}

/**
 * Pin a tier for debug/calibration (e.g. `?tier=low`). Freezes the watchdog so
 * the tier stays put for side-by-side comparison. Pass a valid tier to force,
 * or `null` to release the override (auto-adaptation resumes).
 */
export function forceTier(tier: TierName | null): void {
  overridden = tier !== null;
  if (tier !== null && tier !== currentTier) {
    currentTier = tier;
    emit();
  }
}

export function getQualityConfig(): QualityConfig {
  return TIERS[currentTier];
}

export function getTierName(): TierName {
  return currentTier;
}

export function getRefreshHz(): number {
  return refreshHz;
}

/**
 * The fps cap for the *heavy, SELF-ANIMATING* effects — the intro liquid
 * glass's paint pump, the tile conveyor's drift, the portfolio globe's ticker.
 * These have no on-screen reference frame, so they
 * really are visually identical above 60 fps but cost ~2× on a 120 Hz panel —
 * cap them to 60 on any fast panel OR any stepped-down tier (audit item 9).
 * Returns 0 = uncapped (ride the display) on a 60 Hz high tier. The clouds'
 * living morph is already 30 fps-throttled.
 *
 * NOT for scroll-linked repaints — those use scrollRepaintFpsCap() below.
 */
export function heavyEffectFpsCap(): number {
  if (isCoarsePointer()) return 30;
  return refreshHz > 70 || currentTier !== "high" ? 60 : 0;
}

/**
 * The repaint cap for SCROLL-LINKED demand-canvas repaints (the cloud/intro
 * scroll rigs + the why-stay reel write, via makeCappedInvalidate). Unlike the
 * self-animating effects above, these layers move in lockstep with DOM content
 * that scrolls at the panel's native rate — capping them below it makes the
 * weld visibly stagger (60 Hz rock-base clouds against 120 Hz cliffs, the
 * tile field lagging the hero). So on the high tier they ride the display
 * (0 = uncapped); stepped-down tiers keep 60, where the GPU is the scarcer
 * resource and the stagger is the lesser evil. Affordable on high since the
 * intro glass fix (2026-07-18, see intro-scene.tsx measurement note) removed
 * the GPU backpressure the old blanket 60 cap was protecting against.
 */
export function scrollRepaintFpsCap(): number {
  // 60, never 0, on a phone — but never 30 either. These repaints are welded to
  // content that scrolls at the panel's native rate, so capping them too far
  // below it makes the weld visibly stagger; 60 halves the work on a 120Hz
  // phone while staying in step with the scroller.
  if (isCoarsePointer()) return 60;
  return currentTier !== "high" ? 60 : 0;
}

export function subscribeQuality(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
