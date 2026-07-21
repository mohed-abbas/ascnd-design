// Cloud placement data — plain values, no Three.js/R3F. Kept separate from
// cloud-canvas.tsx so cloud-layer.tsx can read the specs without eagerly
// pulling the heavy WebGL bundle (which stays behind dynamic(ssr:false)).
//
// Position is given in screen-NDC (x,y each in [-1,1] — centre is 0, +x right,
// +y up) so each cloud lands at a fixed spot on screen regardless of viewport;
// <CloudPlacement> projects it onto the camera ray. `dist` is how far along
// that ray to sit and only affects SIZE, not the screen position. bounds/volume
// set the puffiness (bounds.x widens the bank; volume packs in more puffs).
//
// `anchorVh` makes clouds scroll WITH the page instead of staying pinned to the
// viewport (approach C). It's the section the cloud belongs to, in viewport
// heights down the document: 0 = hero (at rest at scroll 0), 1 = the next
// full-viewport section down, etc. <ScrollAnchorRig> translates the field by
// scroll so a cloud sits at its `ndc` spot exactly when scroll reaches
// anchorVh viewports — then it travels up and out as you keep scrolling, and
// the next section's clouds rise into view. So the same canvas carries every
// section's clouds (2 WebGL contexts total, regardless of section count).
//
// The clouds are split into two DOM layers (see cloud-layer.tsx): SKY_CLOUDS
// render behind the page content; ROCK_CLOUDS render in FRONT of the cliffs so
// they overlap the rock bases. Both share the same camera/lighting, so they
// look consistent — only their z-stacking differs.
export type CloudSpec = {
  key: string;
  ndc: [number, number];
  dist: number;
  seed: number;
  bounds: [number, number, number];
  volume: number;
  /**
   * FIELD clouds (hero + rock bases): section anchor in viewport heights down the
   * page (0 = hero). These parallax continuously with the page. Mutually exclusive
   * with `section`.
   */
  anchorVh?: number;
  /**
   * SECTION clouds: bind the cloud to a section so it drifts continuously through
   * its `ndc` rest spot over that section's scroll crossing — reaching rest as the
   * section centres, then floating on out — WITHOUT counting viewport-heights (the
   * `anchorVh` alternative). Mutually exclusive with `anchorVh`. Motion is Option
   * B (constant-velocity drift, no hold); see <SectionRig>.
   */
  section?: SectionBind;
  /**
   * Scroll-motion axis. Unset (default) → FLAT: the cloud travels along the
   * camera's up-axis, so it moves straight up the screen at CONSTANT size.
   * `true` → PERSPECTIVE: travels along world-Y, which under the tilted camera
   * pulls it toward the lens as it rises, so it SWELLS on the way out (the
   * original look). Governs both the scroll parallax of FIELD clouds (anchorVh,
   * via <ScrollAnchorRig>/<CloudPlacement>) and the slide of SECTION clouds
   * (via <SectionRig>) — flat clouds slide along camera-up, perspective ones
   * along world-Y.
   */
  perspectiveScroll?: boolean;
};

export type SectionBind = {
  /** CSS selector for the section element (e.g. "[data-cards]"). */
  trigger: string;
  /**
   * RESERVED for the future docking mode (Option C): the fixed distance (in
   * viewport-heights) a cloud would spend sliding in/out before HOLDING at rest.
   * Unused by the current continuous-drift motion (Option B). See <SectionRig>
   * and docs/cloud-rendering-research.md § "Section-cloud motion".
   */
  slide?: number;
  /**
   * How far (in viewport-heights) the cloud sweeps to EACH side of its rest spot
   * across the crossing (default 1): `travel` below rest at section-enter, rest at
   * section-centre, `travel` above at section-exit. Bigger = a longer, slower drift.
   */
  travel?: number;
};

export const SKY_CLOUDS: CloudSpec[] = [
  { key: "top-right", ndc: [0.78, 0.72], dist: 22, seed: 4, bounds: [4, 1.2, 1], volume: 4, anchorVh: 0, perspectiveScroll: false },
  // Cards section ("ground to launch in days") — one sky cloud low on the right,
  // same size as the hero top-right. It slides in with the card row, holds at the
  // bottom-right while the section is on screen, then slides out.
  { key: "bottom-left", ndc: [-0.78, -0.9], dist: 22, seed: 4, bounds: [4, 1.2, 1], volume: 4, anchorVh: 1, perspectiveScroll: false },
  {
    key: "cards-br",
    ndc: [0.78, -1],
    dist: 22,
    seed: 11,
    bounds: [7, 1.4, 1],
    volume: 6,
    anchorVh: 2,
    perspectiveScroll: false,
  },
  // Why-stay section ("why teams stay") — a BIGGER cloud on the left. The section
  // PINS, so its scroll crossing is long; the cloud holds left of the glass reel
  // for that whole span, then slides out.
  {
    key: "whystay-bl",
    ndc: [-0.78, -0.72],
    dist: 24,
    seed: 11,
    bounds: [4, 1.2, 1],
    volume: 4,
    anchorVh: 3,
    perspectiveScroll: false,
  },
  {
    key: "whystay-br",
    ndc: [0.78, -0.72],
    dist: 50,
    seed: 11,
    bounds: [8, 2.4, 1],
    volume: 8,
    anchorVh: 3.5,
    perspectiveScroll: false,
  },
  {
    key: "whystay-bl-2",
    ndc: [-0.78, -0.72],
    dist: 24,
    seed: 11,
    bounds: [4, 1.5, 1],
    volume: 8,
    anchorVh: 4,
    perspectiveScroll: false,
  },
  {
    key: "workingwith-left",
    ndc: [-0.95, -0.90],
    dist: 24,
    seed: 11,
    bounds: [6, 1.4, 1],
    volume: 4,
    anchorVh: 7,
    perspectiveScroll: false,
  },
  {
    key: "workingwith-right-bottom",
    ndc: [0.90, 0.5],
    dist: 24,
    seed: 11,
    bounds: [3, 1, 1],
    volume: 3,
    section: { trigger: "[data-working-with]" },
    perspectiveScroll: false,
  },
  {
    key: "testimonials-right-top",
    ndc: [0.90, 0.55],
    dist: 24,
    seed: 11,
    bounds: [4, 1.4, 1],
    volume: 4,
    section: { trigger: "[data-testimonials]" },
    perspectiveScroll: false,
  },
  {
    key: "testimonials-left-bottom",
    ndc: [-0.90, -0.55],
    dist: 24,
    seed: 11,
    bounds: [6, 1.4, 1],
    volume: 4,
    section: { trigger: "[data-testimonials]" },
    perspectiveScroll: false,
  },
  // data-working-with

  // Final CTA ("let's get you off the ground") — two corner banks that frame the
  // centred heading + buttons diagonally: one top-left, one bottom-right. Bound
  // to the section (not anchorVh) so they drift continuously through their corner
  // rest spots as the CTA crosses the viewport — reaching rest as it centres, then
  // floating on out (SectionRig Option B, no hold). The bind needs no viewport-
  // height counting, so it stays correct as sections are added/reordered above.
  {
    key: "finalcta-tl",
    ndc: [-0.85, 0.78],
    dist: 22,
    seed: 4,
    bounds: [4, 1.2, 1],
    volume: 4,
    section: { trigger: "[data-final-cta]" },
    perspectiveScroll: false,
  },
  {
    key: "finalcta-br",
    ndc: [0.85, -0.8],
    dist: 22,
    seed: 11,
    bounds: [5, 1.3, 1],
    volume: 4,
    section: { trigger: "[data-final-cta]" },
    perspectiveScroll: false,
  },
];

// Rock-base banks — a WIDE, SHALLOW strip that just skirts the foot of each
// cliff to hide its hard bottom cut, without billowing up into the scene. The
// look is a thin horizontal band, not a tall puff: bounds.x stays wide for
// full-foot coverage while bounds.y is a sliver, so the puffs distribute along
// the strip (dense across, short up). Sat just past -1 so it rides the very
// bottom edge. Keeping it low + thin preserves the site's open, fluid feel.
export const ROCK_CLOUDS: CloudSpec[] = [
  { key: "rock-left", ndc: [-0.88, -1.02], dist: 22, seed: 7, bounds: [6.5, 0.45, 1], volume: 8, anchorVh: 0, perspectiveScroll: false },
  { key: "rock-right", ndc: [0.88, -1.02], dist: 22, seed: 3, bounds: [6.5, 0.45, 1], volume: 8, anchorVh: 0, perspectiveScroll: false },
];

// ── Pricing route (/pricing) ───────────────────────────────────────────────
// The pricing page reuses the homepage Pricing section as its hero but has its
// OWN cloud arrangement — the homepage's specs are calibrated to the homepage's
// sections (anchorVh counts + [data-cards]/[data-testimonials]/[data-final-cta]
// section binds), which don't map onto this route, so sharing them would scatter
// clouds at the wrong scroll spots. A starter set for now: two banks framing the
// hero cards, anchored to the hero (anchorVh 0). Extend this as the page's lower
// sections land — bind them with `section` selectors (this page's own) or
// `anchorVh`, exactly like SKY_CLOUDS. No rock-base band: this route has no hero
// cliffs (the footer's rocks sit far down the page, not at the hero foot).
export const PRICING_SKY_CLOUDS: CloudSpec[] = [
  { key: "pricing-hero-tl", ndc: [-0.82, 0.7], dist: 22, seed: 4, bounds: [4, 1.2, 1], volume: 4, anchorVh: 0, perspectiveScroll: false },
  { key: "pricing-hero-br", ndc: [0.86, -0.86], dist: 26, seed: 11, bounds: [6, 1.4, 1], volume: 5, anchorVh: 0, perspectiveScroll: false },
];

export const PRICING_ROCK_CLOUDS: CloudSpec[] = [];

// ── Per-route scene registry ────────────────────────────────────────────────
// The clouds mount ONCE at the root (cloud-layer.tsx) so the shared WebGL context
// survives client-side navigation; only the registered specs swap per route. Each
// route names its own `sky` (REAR plane, behind content) and `rock` (FRONT plane,
// over the cliffs) sets. Unmapped routes fall back to the home scene — the site's
// pre-existing "clouds everywhere" behaviour — so adding a page is opt-in: give it
// an entry here to break away from the homepage arrangement.
export type CloudScene = { sky: CloudSpec[]; rock: CloudSpec[] };

export const CLOUD_SCENES: Record<string, CloudScene> = {
  "/": { sky: SKY_CLOUDS, rock: ROCK_CLOUDS },
  "/pricing": { sky: PRICING_SKY_CLOUDS, rock: PRICING_ROCK_CLOUDS },
};

/** The cloud scene for a route, falling back to the home scene when unmapped. */
export function cloudSceneForPath(pathname: string): CloudScene {
  return CLOUD_SCENES[pathname] ?? CLOUD_SCENES["/"];
}
