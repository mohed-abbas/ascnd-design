import { WHYSTAY_PIN_EXTRA } from "@/components/sections/why-stay/why-stay-data";

// Static (sprite) cloud placement data — the mobile/no-WebGL counterpart of
// cloud-specs.ts. Consumed by static-cloud-layer.tsx, which renders each entry
// as a positioned <img> and drives its scroll drift with GSAP/ScrollTrigger.
// THIS FILE IS THE TUNING SURFACE: add/move/resize clouds here, no component
// changes needed. Sprites are baked from the live WebGL clouds by
// /lab/cloud-sprites into public/clouds/sprites/.
//
// Coordinates are viewport percentages of the CLOUD'S CENTRE — x in vw from
// the left edge, y in vh from the top — so a cloud lands at the same screen
// spot on any phone. Values may run past 0/100 to bleed off-screen (the rock
// skirts and footer banks do).
//
// Anchoring modes, mirroring the WebGL layer:
//  - FIELD clouds (no `trigger`): rest at (x, y) when the page is at scroll 0
//    (the hero) and travel UP with the page as you scroll — 1:1 at speed 1
//    (welded to the hero rocks), slower below 1 (depth parallax, calmer).
//  - SECTION clouds (`trigger` = the section's root data-attribute selector):
//    drift continuously through their (x, y) rest spot across the section's
//    viewport crossing — `travel` below rest as the section enters, rest as it
//    centres, `travel` above as it leaves (SectionRig "Option B" in DOM).
//    Robust to section reflow/reordering; no viewport-height counting.
//  - PIN clouds (`trigger` + `pin`): for PINNED sections (why-stay), whose
//    element crossing is far shorter than their real scroll span. Driven
//    across entrance + pin + exit; `pin.at` welds the cloud to a reel option
//    and `flow` sets the conveyor speed/spacing. See the `pin` field docs.
export type StaticCloudSpec = {
  key: string;
  /** Sprite filename under public/clouds/sprites/. */
  sprite: string;
  /**
   * Stacking: "sky" renders BEHIND the page content (like SKY_CLOUDS);
   * "front" renders above it, over the rock bases (like ROCK_CLOUDS).
   */
  layer: "sky" | "front";
  /** Section anchor selector (e.g. "[data-cards]"). Omit for FIELD clouds. */
  trigger?: string;
  /** Cloud-centre rest position: vw from the left. */
  x: number;
  /** Cloud-centre rest position: vh from the top. */
  y: number;
  /** Rendered width in vw — the primary size/depth knob. */
  width: number;
  /**
   * FIELD clouds only: scroll damping. 1 = moves 1:1 with the page (welded to
   * the rocks); < 1 = drifts slower (reads as further away). Default 1.
   */
  speed?: number;
  /**
   * SECTION clouds only: how far (vh) the cloud sweeps to EACH side of its
   * rest spot across the crossing. Bigger = longer, faster-moving drift.
   * Default 100 — one full viewport each side, matching the desktop
   * SectionRig's `travel: 1` default. ⚠️ Parking constraint (same as the
   * desktop footer clouds): while its section is far below, the cloud parks
   * `travel` vh BELOW its rest spot — `y + travel` must clear ~100vh plus
   * half the cloud's rendered height, or it pokes into view on every earlier
   * section (the layer is fixed). Keep travel large, or rest the cloud low.
   */
  travel?: number;
  /**
   * SECTION clouds: the crossing progress [0..1] at which the cloud rests at
   * (x, y). Default 0.5 = section centred. Stagger values (e.g. 0.32 / 0.68)
   * to space several clouds through a TALL section (comparison, pricing) so
   * one is always around. ⚠️ Off-centre `at` shrinks the parking clearance on
   * one side: parked below by 2·at·travel while the section is down-page, and
   * above by 2·(1−at)·travel once passed — BOTH must push the cloud off-screen
   * (see the `travel` constraint), so off-centre clouds usually want a larger
   * travel.
   */
  at?: number;
  /**
   * Perspective swell — the DOM stand-in for the WebGL `perspectiveScroll`
   * look. Scale multiplier reached at the END of a section cloud's drift
   * (entering it is correspondingly smaller): 1 = flat/constant size
   * (default), 1.15 = grows 15% as it rises past rest, as if drifting toward
   * the lens.
   */
  swell?: number;
  /** Extra opacity 0–1 for depth layering (sprites already carry alpha). */
  opacity?: number;
  /**
   * PINNED-section binding (the why-stay reel). Instead of the element's short
   * viewport crossing, the cloud is driven across the section's FULL pinned
   * journey — one viewport of entrance + `extra` px of pin + one viewport of
   * exit. `at` is the pin progress [0..1] at which the cloud rests at (x, y):
   * with N reel options, option i centres at i/(N-1), so `at: i/(N-1)` welds
   * cloud i to option i. Overrides `travel`/`swell` (the drift is `flow`).
   */
  pin?: {
    /** Extra scroll the section's pin adds, in px (import it from the
     *  section's data module — e.g. WHYSTAY_PIN_EXTRA — never hardcode). */
    extra: number;
    /** Pin progress [0..1] where this cloud is at its (x, y) rest spot. */
    at: number;
  };
  /**
   * Pin clouds: vh the cloud travels across the WHOLE crossing (default 500).
   * Spacing between consecutive clouds ≈ flow × (their `at` gap × pin share),
   * so one value for all clouds in a section = an evenly-spaced conveyor.
   * Bigger = faster streak, wider gaps.
   */
  flow?: number;
};

// Default drift sweep for section clouds (vh to each side of rest) — one
// viewport per side, the desktop SectionRig default.
export const DEFAULT_TRAVEL = 100;

// Default full-crossing travel for PIN clouds (vh). ~500 ≈ page-scroll speed
// through the why-stay pin, with ~55vh between consecutive clouds.
export const DEFAULT_FLOW = 500;

/**
 * The mobile cloud set — mirrors the desktop distribution (hero, cards,
 * why-stay, working-with, testimonials, final CTA, footer) with one or two
 * clouds per section, placed for a phone-portrait frame. Starting values —
 * tune by eye.
 */
export const STATIC_CLOUDS: StaticCloudSpec[] = [
  // ——— Hero (field: travel with the page) ———
  // Distant puff up in the top-right, slightly damped so it lags the page.
  { key: "hero-tr", sprite: "hero-puff.webp", layer: "sky", x: 86, y: 12, width: 58, speed: 0.85 },
  { key: "hero-ml", sprite: "hero-puff.webp", layer: "sky", x: 0, y: 100, width: 90, speed: 0.95 },
  // Rock-skirt strips hugging the cliff feet — welded 1:1 to the page so they
  // never slide off the rocks (same mandate as ROCK_CLOUDS scrollFactor 1).
  { key: "rock-skirt-l", sprite: "rock-skirt-left.webp", layer: "sky", trigger: "[data-tagline]", x: 100, y: 50, width: 110, speed: 0.85 },
  // { key: "rock-skirt-r", sprite: "rock-skirt-right.webp", layer: "front", x: 92, y: 101, width: 95, speed: 1 },

  // ——— Cards ("ground to launch in days") ———
  { key: "cards-br", sprite: "cards-bank.webp", layer: "sky", trigger: "[data-cards]", x: 84, y: 80, width: 68 },

  // ——— Why-stay (pinned reel) — the cloud CONVEYOR ———
  // One cloud per reel option, welded to it via `at: i/(N-1)`: cloud i sits at
  // its (x, y) rest exactly when phrase i is centred in the glass pill, and the
  // shared `flow` keeps them evenly spaced — a continuous streak, so the sky is
  // never empty during the long pin. Sides alternate; y varies so the stream
  // doesn't read as a rigid queue.
  { key: "whystay-1", sprite: "whystay-left.webp", layer: "sky", trigger: "[data-whystay]", pin: { extra: WHYSTAY_PIN_EXTRA, at: 0 / 5 }, x: 14, y: 42, width: 56 },
  { key: "whystay-2", sprite: "puff-soft.webp", layer: "sky", trigger: "[data-whystay]", pin: { extra: WHYSTAY_PIN_EXTRA, at: 1 / 5 }, x: 86, y: 55, width: 48 },
  { key: "whystay-3", sprite: "wide-bank.webp", layer: "sky", trigger: "[data-whystay]", pin: { extra: WHYSTAY_PIN_EXTRA, at: 2 / 5 }, x: 12, y: 60, width: 60 },
  { key: "whystay-4", sprite: "whystay-small.webp", layer: "sky", trigger: "[data-whystay]", pin: { extra: WHYSTAY_PIN_EXTRA, at: 3 / 5 }, x: 88, y: 38, width: 50 },
  { key: "whystay-5", sprite: "puff-small.webp", layer: "sky", trigger: "[data-whystay]", pin: { extra: WHYSTAY_PIN_EXTRA, at: 4 / 5 }, x: 16, y: 52, width: 44 },
  { key: "whystay-6", sprite: "whystay-wide.webp", layer: "sky", trigger: "[data-whystay]", pin: { extra: WHYSTAY_PIN_EXTRA, at: 5 / 5 }, x: 84, y: 62, width: 66 },

  // ——— Working-with ———
  { key: "workingwith-l", sprite: "wide-bank.webp", layer: "sky", trigger: "[data-working-with]", x: 8, y: 86, width: 100 },
  { key: "workingwith-r", sprite: "puff-soft.webp", layer: "sky", trigger: "[data-working-with]", x: 95, y: 25, width: 70 },

  // ——— Comparison ("none of the above") ———
  // ~2.7 viewports tall on mobile, so two staggered clouds (at 0.32 / 0.68)
  // carry the sky through the long crossing.
  { key: "comparison-tr", sprite: "puff-soft.webp", layer: "sky", trigger: "[data-comparison]", x: 88, y: 30, width: 50, at: 0.32, travel: 130 },
  { key: "comparison-bl", sprite: "wide-bank.webp", layer: "sky", trigger: "[data-comparison]", x: 10, y: 58, width: 60, at: 0.68, travel: 130 },

  // ——— Testimonials ———
  { key: "testimonials-tr", sprite: "puff-soft.webp", layer: "sky", trigger: "[data-testimonials]", x: 88, y: 18, width: 52 },
  { key: "testimonials-bl", sprite: "wide-bank.webp", layer: "sky", trigger: "[data-testimonials]", x: 10, y: 76, width: 64, swell: 1.1 },

  // ——— Pricing ———
  // ~2.2 viewports tall — same staggered-pair treatment as comparison.
  { key: "pricing-tr", sprite: "puff-small.webp", layer: "sky", trigger: "[data-pricing]", x: 86, y: 30, width: 46, at: 0.35, travel: 130 },
  { key: "pricing-bl", sprite: "cards-bank.webp", layer: "sky", trigger: "[data-pricing]", x: 12, y: 66, width: 58, at: 0.7, travel: 130 },

  // ——— Final CTA → footer transition ———
  // Kept DELIBERATELY sparse: the CTA and footer are adjacent and the sky band
  // between the buttons and the mountains is short, so extra clouds there read
  // as clutter. One low CTA cloud hugging the fold into the footer, plus the
  // footer's own two mountain clouds — nothing floating in the middle.
  { key: "finalcta-br", sprite: "cta-bank.webp", layer: "sky", trigger: "[data-final-cta]", x: 85, y: 90, width: 56 },

  // ——— Footer (mountain range) ———
  // The footer is the LAST section and never scroll-centres — the page ends at
  // ~0.2 crossing progress (d ≈ -0.6), so the cloud only ever climbs ~0.6 ×
  // travel of its way back up to rest. Rest `y` is set so the page-end resting
  // spot (≈ y + 0.6 × travel vh) sits low, near the ridgeline, rather than
  // floating mid-gap; travel stays big enough to satisfy the parking constraint.
  // Bank BEHIND the peaks (sky layer) — only its top wisps crest the ridge.
  { key: "footer-behind", sprite: "footer-bank.webp", layer: "sky", trigger: "[data-footer]", x: 22, y: 12, width: 82, travel: 125 },
  // Thin wisp IN FRONT of the peaks (front layer), low on the right.
  { key: "footer-wisp", sprite: "footer-wisp.webp", layer: "front", trigger: "[data-footer]", x: 82, y: 30, width: 54, travel: 95 },
];
