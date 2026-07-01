/**
 * Adaptive quality tiers (docs/performance-audit.md §6 C2, Phase 2 items 8–10).
 *
 * One tier = one coherent set of GPU-cost knobs shared by every heavy effect
 * (cursor fluid sim, volumetric clouds, intro liquid glass). The quality store
 * (quality-store.ts) holds the *current* tier; the frame-time watchdog
 * (frame-watchdog.ts) steps it DOWN under sustained load. Consumers read the
 * derived config and never touch tier logic directly.
 *
 * ── CALIBRATION NOTE ──────────────────────────────────────────────────────
 * The numbers below are the plumbing's starting defaults, NOT final values.
 * `high` intentionally reproduces the CURRENTLY SHIPPED look 1:1 so that
 * mounting this system changes nothing on a capable machine (no regression).
 * `medium`/`low` are conservative first guesses — they MUST be A/B'd on a real
 * 120 Hz panel + a genuinely weak GPU before trusting them. The per-tier fps
 * cap is computed centrally in the store (heavyEffectFpsCap), not stored here.
 * ──────────────────────────────────────────────────────────────────────────
 */

export type TierName = "high" | "medium" | "low";

/** Ordered strongest→weakest. The watchdog walks this to step down. */
export const TIER_ORDER: readonly TierName[] = ["high", "medium", "low"] as const;

export interface QualityConfig {
  readonly tier: TierName;

  // ── Cursor fluid sim (components/cursor/cursor-trail-canvas.tsx) ──
  /** Ping-pong render-target resolution scale. Lower = fewer fragment ops. */
  readonly cursorRtScale: number;

  // ── Volumetric clouds (components/background/cloud-canvas.tsx) ──
  /** Upper bound of the Canvas `dpr={[1, x]}`. The soft sprite hides low dpr. */
  readonly cloudDprMax: number;

  // ── Intro liquid glass (components/sections/intro/intro-scene.tsx) ──
  /** MeshTransmissionMaterial blur taps. */
  readonly mtmSamples: number;
  /** MeshTransmissionMaterial FBO resolution (square). */
  readonly mtmResolution: number;
  /** Second (backside) scene render — the single costliest MTM lever. */
  readonly mtmBackside: boolean;
  /** Text3D curve tessellation (one-time CPU geometry build). */
  readonly text3dCurveSegments: number;
  /** Text3D bevel tessellation. */
  readonly text3dBevelSegments: number;
}

export const TIERS: Record<TierName, QualityConfig> = {
  // Reproduces the shipped visuals exactly — the safe default (see note above).
  high: {
    tier: "high",
    cursorRtScale: 0.5,
    cloudDprMax: 2,
    mtmSamples: 8,
    mtmResolution: 512,
    mtmBackside: true,
    text3dCurveSegments: 32,
    text3dBevelSegments: 12,
  },
  medium: {
    tier: "medium",
    cursorRtScale: 0.45,
    cloudDprMax: 1.5,
    mtmSamples: 6,
    mtmResolution: 384,
    mtmBackside: true,
    text3dCurveSegments: 16,
    text3dBevelSegments: 8,
  },
  low: {
    tier: "low",
    cursorRtScale: 0.4,
    cloudDprMax: 1.25,
    mtmSamples: 4,
    mtmResolution: 256,
    mtmBackside: false,
    text3dCurveSegments: 16,
    text3dBevelSegments: 6,
  },
};
