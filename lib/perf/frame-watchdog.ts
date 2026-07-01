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
 * ── CALIBRATE ── THRESHOLD_MS/SUSTAIN/WARMUP/COOLDOWN are conservative starting
 * points. Tune THRESHOLD_MS against a real weak GPU: too low demotes healthy
 * 90 Hz machines; too high never catches a genuine 45 fps stutter. ~12 ms ≈ a
 * ceiling of ~83 fps before we consider the frame "over budget".
 */

import gsap from "gsap";
import { stepDownTier } from "./quality-store";

export interface WatchdogOptions {
  /** Frame-time budget in ms; sustained overrun triggers a step-down. */
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

export function startFrameWatchdog(opts: WatchdogOptions = {}): () => void {
  const THRESHOLD_MS = opts.thresholdMs ?? 12;
  const EMA_ALPHA = opts.emaAlpha ?? 0.1;
  const SUSTAIN_MS = opts.sustainMs ?? 1500;
  const WARMUP_MS = opts.warmupMs ?? 3000;
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

    if (ema > THRESHOLD_MS) {
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
