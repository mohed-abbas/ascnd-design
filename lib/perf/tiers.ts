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
 *
 * ── CONSUMER REGISTRY ── every live tier consumer, kept current ───────────
 * | Consumer                                   | Knobs read                               |
 * |--------------------------------------------|------------------------------------------|
 * | components/background/cloud-canvas.tsx     | cloudDprMax (live), cloudSegments (mount |
 * |                                            | snapshot), makeCappedInvalidate (morph   |
 * |                                            | pump + scroll-invalidate caps)           |
 * | components/sections/intro/intro-scene.tsx  | mtm*, text3d* (mount snapshot),          |
 * |                                            | heavyEffectFpsCap() (IntroFrameCap),     |
 * |                                            | makeCappedInvalidate (ScrollRig)         |
 * | components/ui/glass-surface.tsx            | NONE (2026-07-03, Decision 6): reads no   |
 * |                                            | tier knob. Its consumer (why-stay pill)   |
 * |                                            | now passes chromatic={false} on EVERY     |
 * |                                            | tier — single-map displacement + static   |
 * |                                            | chromatic ring (~⅓ the 3-channel chain's  |
 * |                                            | cost) uniformly, for max fps across       |
 * |                                            | devices. Was: tier-latched, low-only.     |
 * |                                            | Never frost/clear (stakeholder call — a   |
 * |                                            | blur reads as a milky blue bar over sky). |
 * | components/sections/why-stay/              | makeCappedInvalidate (--reel-y writes    |
 * |   why-stay-reveal.tsx                      | behind the glass pill)                   |
 * | components/sections/comparison/            | comparisonAuraSweep — gates the featured |
 * |   ascnd-aura.tsx                           | column's orbiting rainbow (per-frame     |
 * |                                            | conic-gradient + blur repaint). false on |
 * |                                            | low → static aura, no orbit. Also idles  |
 * |                                            | to zero off-screen (IntersectionObserver)|
 * |                                            | and rides the shared GSAP ticker.        |
 * | components/sections/testimonials/          | testimonialsDrift — gates the ring dots' |
 * |   testimonials-drift.tsx +                 | revolve (transform GSAP loop) AND the 3D |
 * |   testimonial-rocks(-canvas).tsx           | GLB rock canvas (orbit+tumble). false on |
 * |                                            | low → flat PNG rocks, no revolve. Canvas |
 * |                                            | is frameloop=never, driven by the shared |
 * |                                            | GSAP ticker + advance(), dpr≤1.5, and    |
 * |                                            | idles to zero off-screen (IO). No-WebGL/ |
 * |                                            | reduced-motion/mobile also → flat PNG.   |
 * |                                            | When true, the wrapper idle-preloads the |
 * |                                            | canvas chunk + GLB before near-view so   |
 * |                                            | the mount is cache-hot, not a cold       |
 * |                                            | chunk→GLB download waterfall.            |
 * | components/sections/portfolio/             | heavyEffectFpsCap() (ticker paint cap).  |
 * |   cloud-canvas/                            | 2D-canvas image globe. Idles to zero     |
 * |                                            | off-screen via IO (0px margin), defers   |
 * |                                            | its 28-image fetch+decode init until     |
 * |                                            | ~1000px near-view, and self-caps its     |
 * |                                            | backing store at dpr≤1.5.                |
 * | components/sections/portfolio/             | NONE, and this row exists to say WHY —   |
 * |   grid/grid-marquee.tsx                    | the ★ RULE below is about being listed,  |
 * |                                            | not about having knobs. The portfolio    |
 * |                                            | wall's drift is ONE `y` tween per column |
 * |                                            | (4 max) on a promoted layer: no repaint, |
 * |                                            | no fill-rate, nothing an fps cap would   |
 * |                                            | make cheaper — capping it would only    |
 * |                                            | make a compositor animation judder. It   |
 * |                                            | rides the shared gsap.ticker and idles   |
 * |                                            | to zero off-screen via IO. The cost that |
 * |                                            | IS real here is layer + decoded-image    |
 * |                                            | memory, which no tier knob addresses;    |
 * |                                            | it is held down by `sizes` (real srcset, |
 * |                                            | unlike the canvas' one global 900px) and |
 * |                                            | by will-change living on the 4 tracks    |
 * |                                            | rather than on every tile. The two       |
 * |                                            | portfolio modes are mutually exclusive   |
 * |                                            | MOUNTS, so this and the globe above are  |
 * |                                            | never both live.                         |
 *
 * ★ RULE (audit 2026-07-02 F5.1): any NEW heavy effect — a WebGL canvas, a
 * free-running loop, a per-frame SVG/CSS filter — must be added to this table
 * AND given tier knobs here IN THE SAME PR that introduces it. The SplashCursor
 * regression happened exactly because a swapped-in effect skipped this file:
 * the table's biggest lever (cursorRtScale) pointed at deleted code while the
 * new cursor ran tier-blind at full res. See also the heavy-effect contract in
 * CLAUDE.md.
 *
 * ── KNOWN BLIND SPOT (audit F5.2) ── the frame-time watchdog reads MAIN-
 * THREAD rAF deltas only. A GPU-bound present-rate drop (the intro glass's
 * documented failure mode: rAF reads 120 fps while the panel presents ~33)
 * is invisible to it. GPU protection therefore comes solely from the INITIAL
 * tier pick (gpu-tier.ts). The DevTools FPS meter is the only ground truth
 * for presented fps — never verify with rAF sampling alone.
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

  // ── Comparison featured-column aura (components/sections/comparison/ascnd-aura.tsx) ──
  /**
   * Whether the featured "ascnd" column's rainbow aura ORBITS. The orbit is a
   * per-frame conic-gradient + blur repaint; on the weakest tier we hold it
   * static (a fixed-angle rainbow, no repaint) to drop that cost. Higher tiers
   * still idle to zero off-screen (the orbit only runs while the section is in
   * view). Reduced-motion also forces it static regardless of tier.
   */
  readonly comparisonAuraSweep: boolean;

  // ── Testimonials rock/ring drift (components/sections/testimonials/testimonials-drift.tsx) ──
  /**
   * Whether the testimonials rocks orbit + tumble and their ring dots revolve.
   * All motion is transform-only GSAP loops on the shared ticker, gated to
   * in-view (idle to zero off-screen). false on low → rocks/rings render at
   * their resting Figma pose, no loops. Reduced-motion forces the same
   * regardless of tier.
   */
  readonly testimonialsDrift: boolean;
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
    comparisonAuraSweep: true,
    testimonialsDrift: true,
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
    comparisonAuraSweep: true,
    testimonialsDrift: true,
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
    comparisonAuraSweep: false,
    testimonialsDrift: false,
  },
};
