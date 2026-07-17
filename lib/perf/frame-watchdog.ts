/**
 * Runtime frame-time watchdog (docs/performance-audit.md §6 C3).
 *
 * Rides the ONE shared GSAP ticker (no new rAF loop — same mandate as
 * lenis-provider.tsx). Keeps an EMA of frame time; if it stays above the budget
 * for a sustained window, it steps the quality tier DOWN once, then cools off.
 * This is what actually delivers the "60 fps floor": capable machines sit at
 * high forever, struggling ones settle onto a tier they can sustain.
 *
 * The tick receives GSAP's `deltaMs` (ms since last tick) directly — with
 * lagSmoothing(0) set globally it's the raw, unsmoothed frame time we want.
 *
 * THE BUDGET IS REFRESH-RATE-AWARE. A fixed ~12 ms budget only makes sense on a
 * 120 Hz panel (8.3 ms native frame) — on a perfectly healthy 60 Hz display rAF
 * *cannot* deliver faster than ~16.7 ms deltas, so a fixed 12 ms budget would
 * demote every 60 Hz machine on pure arithmetic, no jank required. Instead the
 * budget is derived from the measured refresh rate:
 *
 *   threshold = max(12, (1000 / refreshHz) * 1.45)
 *
 * i.e. the EMA must sit ~45% over the display's native frame time before we call
 * it a sustained overrun. At 120 Hz that evaluates to ~12.1 ms (the original
 * fast-panel behavior, preserved); at 60 Hz it becomes ~24.2 ms (≈41 fps), so
 * only genuine dropped-frame jank trips it. The Hz measurement (refresh-rate.ts)
 * settles asynchronously, so the threshold is recomputed from the store on every
 * sample — one function call per tick, effectively free — rather than cached at
 * arm time with a possibly stale pre-settle value.
 *
 * ── CALIBRATE ── the 1.45 ratio /SUSTAIN/WARMUP/COOLDOWN are conservative
 * starting points. Tune the ratio against a real weak GPU: too low demotes
 * healthy machines riding their native cadence; too high never catches a
 * genuine sustained stutter.
 */

import gsap from "gsap";
import { getRefreshHz, stepDownTier } from "./quality-store";

export interface WatchdogOptions {
  /**
   * Fixed frame-time budget in ms; sustained overrun triggers a step-down.
   * When set it wins outright — the refresh-aware derivation is bypassed.
   */
  thresholdMs?: number;
  /** EMA smoothing factor (0–1); higher = reacts faster, noisier. */
  emaAlpha?: number;
  /** How long the EMA must stay over budget before stepping down (ms). */
  sustainMs?: number;
  /** Grace period after start — ignores the boot/intro compile burst (ms). */
  warmupMs?: number;
  /** Quiet period after a step-down before another can fire (ms). */
  cooldownMs?: number;
}

// Never budget tighter than this, whatever the panel claims (see file header).
const THRESHOLD_FLOOR_MS = 12;
// The EMA must sit this far over the display's native frame time to count as an
// overrun — riding the native cadence (16.7 ms on 60 Hz) is healthy, not jank.
const OVER_BUDGET_RATIO = 1.45;

export function startFrameWatchdog(opts: WatchdogOptions = {}): () => void {
  // Refresh-aware budget, re-read per sample: the Hz measurement can settle
  // AFTER arming, and getRefreshHz() is a plain field read — cheaper than any
  // subscribe-and-cache dance would be. An explicit opts.thresholdMs pins it.
  const thresholdMs = () =>
    opts.thresholdMs ??
    Math.max(THRESHOLD_FLOOR_MS, (1000 / getRefreshHz()) * OVER_BUDGET_RATIO);
  const EMA_ALPHA = opts.emaAlpha ?? 0.1;
  const SUSTAIN_MS = opts.sustainMs ?? 1500;
  // Short by design: the controller already arms this AFTER the intro transient,
  // so warmup only needs to absorb the first-frame burst at the arm moment.
  const WARMUP_MS = opts.warmupMs ?? 1000;
  const COOLDOWN_MS = opts.cooldownMs ?? 4000;

  let ema = 0;
  let startedAtMs = -1;
  let overSinceMs = -1;
  let lastStepMs = -Infinity;

  const tick = (timeSec: number, deltaMs: number) => {
    const nowMs = timeSec * 1000;
    if (startedAtMs < 0) startedAtMs = nowMs;

    // Drop absurd deltas: a backgrounded tab or a debugger pause parks rAF and
    // produces a multi-hundred-ms gap that is not a real render cost.
    if (deltaMs <= 0 || deltaMs > 200) return;

    ema = ema === 0 ? deltaMs : ema + EMA_ALPHA * (deltaMs - ema);

    if (nowMs - startedAtMs < WARMUP_MS) return;
    if (nowMs - lastStepMs < COOLDOWN_MS) {
      overSinceMs = -1;
      return;
    }

    if (ema > thresholdMs()) {
      if (overSinceMs < 0) {
        overSinceMs = nowMs;
      } else if (nowMs - overSinceMs >= SUSTAIN_MS) {
        if (stepDownTier()) lastStepMs = nowMs;
        overSinceMs = -1;
      }
    } else {
      overSinceMs = -1;
    }
  };

  gsap.ticker.add(tick);
  return () => gsap.ticker.remove(tick);
}
