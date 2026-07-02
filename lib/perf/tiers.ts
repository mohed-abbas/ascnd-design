/**
 * Adaptive quality tiers (docs/performance-audit.md §6 C2, Phase 2 items 8–10).
 *
 * One tier = one coherent set of GPU-cost knobs shared by every heavy effect
 * (volumetric clouds, intro liquid glass). The quality store
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

  // ── Volumetric clouds (components/background/cloud-canvas.tsx) ──
  /** Upper bound of the Canvas `dpr={[1, x]}`. The soft sprite hides low dpr. */
  readonly cloudDprMax: number;
  /**
   * drei <Cloud> `segments` — billboards per cloud, THE fill-rate knob (audit
   * F4.3: ~7 clouds × segments large transparent sprites through one instanced
   * draw). Form holds up at lower counts because the sprite carries the detail.
   * Snapshotted at canvas mount (a live change would rebuild the geometry
   * on-screen), so a mid-session step-down applies on the next mount.
   */
  readonly cloudSegments: number;

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
  high: {
    tier: "high",
    // 2→1.5: on a retina panel dpr 2 is 4× the fragments of dpr 1. The cloud
    // sprite is soft, so 1.5 is imperceptible but cuts each 30fps repaint ~44%.
    cloudDprMax: 1.5,
    // 20 = the currently shipped look (was hardcoded in cloud-canvas.tsx).
    cloudSegments: 20,
    // The glass was GPU-bound even on an M4 at 512/8/backside — the presented
    // rate fell to ~33fps during the intro (the main thread ran 120fps; the GPU
    // couldn't keep up). `backside` renders a WHOLE extra scene pass, and on
    // this height=0 (zero-extrusion) text its back face is near-coincident with
    // the front, so it contributes almost nothing here — dropped. `resolution`
    // 512→384 cuts FBO fragments ~44% (imperceptible on small telephoto text).
    // `samples` stays 8 to preserve the refraction-blur sharpness.
    mtmSamples: 8,
    mtmResolution: 384,
    mtmBackside: false,
    text3dCurveSegments: 32,
    text3dBevelSegments: 12,
  },
  medium: {
    tier: "medium",
    cloudDprMax: 1.5,
    cloudSegments: 14,
    mtmSamples: 6,
    mtmResolution: 320,
    mtmBackside: false,
    text3dCurveSegments: 16,
    text3dBevelSegments: 8,
  },
  low: {
    tier: "low",
    cloudDprMax: 1.25,
    cloudSegments: 10,
    mtmSamples: 4,
    mtmResolution: 256,
    mtmBackside: false,
    text3dCurveSegments: 16,
    text3dBevelSegments: 6,
  },
};
