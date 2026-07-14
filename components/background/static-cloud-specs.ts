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
// Two anchoring modes, mirroring the WebGL layer:
//  - FIELD clouds (no `trigger`): rest at (x, y) when the page is at scroll 0
//    (the hero) and travel UP with the page as you scroll — 1:1 at speed 1
//    (welded to the hero rocks), slower below 1 (depth parallax, calmer).
//  - SECTION clouds (`trigger` = the section's root data-attribute selector):
//    drift continuously through their (x, y) rest spot across the section's
//    viewport crossing — `travel` below rest as the section enters, rest as it
//    centres, `travel` above as it leaves (SectionRig "Option B" in DOM).
//    Robust to section reflow/reordering; no viewport-height counting.
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
   * Perspective swell — the DOM stand-in for the WebGL `perspectiveScroll`
   * look. Scale multiplier reached at the END of a section cloud's drift
   * (entering it is correspondingly smaller): 1 = flat/constant size
   * (default), 1.15 = grows 15% as it rises past rest, as if drifting toward
   * the lens.
   */
  swell?: number;
  /** Extra opacity 0–1 for depth layering (sprites already carry alpha). */
  opacity?: number;
};

// Default drift sweep for section clouds (vh to each side of rest) — one
// viewport per side, the desktop SectionRig default.
export const DEFAULT_TRAVEL = 100;

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
  // Rock-skirt strips hugging the cliff feet — welded 1:1 to the page so they
  // never slide off the rocks (same mandate as ROCK_CLOUDS scrollFactor 1).
  { key: "rock-skirt-l", sprite: "rock-skirt-left.webp", layer: "front", x: 22, y: 99, width: 110, speed: 1 },
  { key: "rock-skirt-r", sprite: "rock-skirt-right.webp", layer: "front", x: 92, y: 101, width: 95, speed: 1 },

  // ——— Cards ("ground to launch in days") ———
  { key: "cards-br", sprite: "cards-bank.webp", layer: "sky", trigger: "[data-cards]", x: 84, y: 80, width: 68 },

  // ——— Why-stay (pinned reel) ———
  { key: "whystay-bl", sprite: "whystay-left.webp", layer: "sky", trigger: "[data-whystay]", x: 12, y: 78, width: 62 },

  // ——— Working-with ———
  { key: "workingwith-l", sprite: "wide-bank.webp", layer: "sky", trigger: "[data-working-with]", x: 8, y: 86, width: 70 },

  // ——— Testimonials ———
  { key: "testimonials-tr", sprite: "puff-soft.webp", layer: "sky", trigger: "[data-testimonials]", x: 88, y: 18, width: 52 },
  { key: "testimonials-bl", sprite: "wide-bank.webp", layer: "sky", trigger: "[data-testimonials]", x: 10, y: 76, width: 64, swell: 1.1 },

  // ——— Final CTA (diagonal corner frame, like desktop) ———
  { key: "finalcta-tl", sprite: "hero-puff.webp", layer: "sky", trigger: "[data-final-cta]", x: 12, y: 16, width: 54 },
  { key: "finalcta-br", sprite: "cta-bank.webp", layer: "sky", trigger: "[data-final-cta]", x: 88, y: 82, width: 60 },

  // ——— Footer (mountain range) ———
  // The footer is the LAST section and never scroll-centres — the page ends at
  // ~0.2 crossing progress (d ≈ -0.57), so the cloud only ever climbs ~0.57 ×
  // travel of its way back up to rest. Same fix as the desktop footer clouds:
  // the `y` rest is set HIGH above the visible target to compensate, and
  // travel stays big enough to satisfy the parking constraint. Visible spot at
  // page end ≈ y + 0.57 × travel.
  // Bank BEHIND the peaks (sky layer) — only its top wisps crest the ridge.
  { key: "footer-behind", sprite: "footer-bank.webp", layer: "sky", trigger: "[data-footer]", x: 25, y: 8, width: 82, travel: 105 },
  // Thin wisp IN FRONT of the peaks (front layer), low on the right.
  { key: "footer-wisp", sprite: "footer-wisp.webp", layer: "front", trigger: "[data-footer]", x: 80, y: 57, width: 58, travel: 50 },
];
